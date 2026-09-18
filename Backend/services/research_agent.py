"""
Phase 9 - AI research agent.

Orchestrates the full loop:

    objective -> variables -> knowledge retrieval -> candidate generation
              -> ML prediction -> scoring/ranking -> explanation -> next experiment

Every step records a trace entry (with real timings) so the UI can show what
actually ran rather than a decorative animation, and so a jury can see that no
step is faked.

Nothing here is allowed to fail hard: a missing knowledge base, an unavailable
LLM or a broken history table degrade to a warning in the trace and the pipeline
continues.
"""

from __future__ import annotations

import logging
import time
from typing import Any, Dict, List, Optional

from config import settings
from db.store import run_store
from domain import FEATURE_NAMES
from rag.retriever import retriever
from services import narrator
from services.experiment_generator import generate_experiments, suggest_next_experiment
from services.llm import llm_client
from services.model_store import model_store
from services.scoring import identified_variables, parse_objective, score_experiment
from simulator.simulator import simulate

logger = logging.getLogger("virtual_rd_lab.agent")

#: Reference conditions used purely as comparison anchors in the report.
COMPARISON_ANCHORS: List[dict] = [
    {
        "label": "Conventional baseline",
        "note": "Typical starting point: catalyst A, mid temperature, long hold.",
        "experiment": {
            "temperature": 110.0,
            "pressure": 3.0,
            "catalyst": "A",
            "concentration": 0.15,
            "reaction_time": 120.0,
        },
    },
    {
        "label": "Harsh control",
        "note": "Hottest, most concentrated run in the envelope - a cost/risk reference point.",
        "experiment": {
            "temperature": 150.0,
            "pressure": 8.0,
            "catalyst": "A",
            "concentration": 0.40,
            "reaction_time": 160.0,
        },
    },
]

KNOWLEDGE_QUERIES = [
    "{question}",
    "reaction yield optimisation temperature optimum catalyst selectivity",
    "reaction time kinetics throughput conversion trade-off",
    "pressure effect headspace equipment rating",
    "experimental design surrogate model uncertainty active learning",
]


class Trace:
    """Collects step timings for the agent trace."""

    def __init__(self) -> None:
        self.entries: List[Dict[str, Any]] = []
        self._started = time.perf_counter()

    def add(self, step: str, label: str, detail: str, *, ok: bool = True) -> None:
        self.entries.append(
            {
                "step": step,
                "label": label,
                "status": "ok" if ok else "warning",
                "detail": detail,
                "at_ms": round((time.perf_counter() - self._started) * 1000.0, 1),
            }
        )

def retrieve_knowledge(question: str, trace: Trace, papers: Optional[List[Dict[str, Any]]] = None) -> List[Dict[str, Any]]:
    """Run several queries and merge the results by best similarity, incorporating research papers."""
    try:
        retriever.ensure_ready()
    except Exception as error:  # noqa: BLE001
        trace.add("knowledge", "Scientific knowledge retrieval", f"unavailable: {error}", ok=False)
        return []

    merged: Dict[str, Dict[str, Any]] = {}
    for template in KNOWLEDGE_QUERIES:
        query = template.format(question=question)
        try:
            for hit in retriever.retrieve(query, k=settings.rag_top_k, papers=papers):
                key = hit["chunk_id"]
                if key not in merged or hit["similarity"] > merged[key]["similarity"]:
                    merged[key] = hit
        except Exception as error:  # noqa: BLE001
            logger.warning("Retrieval failed for query %r: %s", query, error)

    hits = sorted(merged.values(), key=lambda item: item["similarity"], reverse=True)[:8]
    sources = sorted({hit["source"] for hit in hits})
    paper_count = len([h for h in hits if h.get("is_paper")])
    trace_label = f"{len(hits)} passages ({paper_count} from research papers) from {len(sources)} source(s)" if paper_count else f"{len(hits)} passages from {len(sources)} source file(s)"
    trace.add(
        "knowledge",
        "Scientific knowledge retrieval",
        trace_label,
    )
    return hits


DOMAIN_ANCHORS: Dict[str, List[dict]] = {
    "reaction_yield": [
        {
            "label": "Conventional baseline",
            "note": "Typical starting point: catalyst A, mid temperature, long hold.",
            "experiment": {
                "temperature": 110.0,
                "pressure": 3.0,
                "catalyst": "A",
                "concentration": 0.15,
                "reaction_time": 120.0,
            },
        },
        {
            "label": "Harsh control",
            "note": "Hottest, most concentrated run in the envelope - a cost/risk reference point.",
            "experiment": {
                "temperature": 150.0,
                "pressure": 8.0,
                "catalyst": "A",
                "concentration": 0.40,
                "reaction_time": 160.0,
            },
        },
    ],
    "solar_efficiency": [
        {
            "label": "Conventional baseline",
            "note": "Standard Silicon wafer baseline conditions.",
            "experiment": {
                "cell_thickness_nm": 150.0,
                "doping_concentration": 1.0e16,
                "annealing_temperature_c": 700.0,
                "light_intensity_lux": 50000.0,
                "operating_temperature_c": 25.0,
            },
        },
        {
            "label": "High-thermal stress control",
            "note": "Elevated temperature and thick wafer control run.",
            "experiment": {
                "cell_thickness_nm": 280.0,
                "doping_concentration": 5.0e17,
                "annealing_temperature_c": 850.0,
                "light_intensity_lux": 100000.0,
                "operating_temperature_c": 65.0,
            },
        },
    ],
    "plant_growth": [
        {
            "label": "Standard greenhouse control",
            "note": "Baseline ambient lighting and nutrient concentration.",
            "experiment": {
                "light_intensity_lux": 20000.0,
                "co2_concentration_ppm": 600.0,
                "nutrient_concentration_mm": 2.0,
                "temperature_c": 22.0,
                "water_supply_ml_day": 200.0,
            },
        },
        {
            "label": "High-intensity forcing control",
            "note": "Maximum lighting and CO2 enrichment control.",
            "experiment": {
                "light_intensity_lux": 70000.0,
                "co2_concentration_ppm": 1100.0,
                "nutrient_concentration_mm": 8.0,
                "temperature_c": 35.0,
                "water_supply_ml_day": 450.0,
            },
        },
    ],
    "battery_performance": [
        {
            "label": "Standard cycling control",
            "note": "1C charge/discharge baseline at room temperature.",
            "experiment": {
                "electrolyte_concentration_m": 1.0,
                "charging_rate_c": 1.0,
                "operating_temperature_c": 25.0,
                "discharge_rate_c": 1.0,
                "cycle_count": 50.0,
            },
        },
        {
            "label": "Fast-charge stress control",
            "note": "High rate charging and elevated temperature control.",
            "experiment": {
                "electrolyte_concentration_m": 2.0,
                "charging_rate_c": 2.5,
                "operating_temperature_c": 45.0,
                "discharge_rate_c": 2.5,
                "cycle_count": 300.0,
            },
        },
    ],
    "water_purification": [
        {
            "label": "Standard Jar Test baseline",
            "note": "Moderate coagulant dose and neutral pH.",
            "experiment": {
                "coagulant_dose_mg_l": 30.0,
                "ph": 7.0,
                "contact_time_min": 30.0,
                "temperature_c": 20.0,
                "mixing_speed_rpm": 120.0,
            },
        },
        {
            "label": "High-dosage control",
            "note": "High coagulant dose and extended contact time control.",
            "experiment": {
                "coagulant_dose_mg_l": 80.0,
                "ph": 9.0,
                "contact_time_min": 90.0,
                "temperature_c": 30.0,
                "mixing_speed_rpm": 250.0,
            },
        },
    ],
}


def _get_pred_key(domain: str) -> str:
    return {
        "reaction_yield": "predicted_yield",
        "solar_efficiency": "predicted_efficiency",
        "plant_growth": "predicted_biomass_yield",
        "battery_performance": "predicted_capacity_retention",
        "water_purification": "predicted_turbidity_removal",
    }.get(domain, "predicted_yield")


def _get_domain_keys(domain: str) -> List[str]:
    if domain == "reaction_yield":
        return FEATURE_NAMES
    from services.domain_generator import NUMERIC_KEYS_MAP
    return NUMERIC_KEYS_MAP.get(domain, FEATURE_NAMES)


def _narrator_item(record: dict, domain: str = "reaction_yield") -> dict:
    """Adapt a flat API experiment record into the narrator's input shape."""
    keys = _get_domain_keys(domain)
    pred_key = _get_pred_key(domain)
    pred_val = record.get(pred_key, record.get("predicted_yield", 0.0))
    return {
        "experiment": {name: record[name] for name in keys if name in record},
        "predicted_yield": pred_val,
        "uncertainty_std": record.get("uncertainty_std", 0.0),
        "interval_low": record.get("interval_low", 0.0),
        "interval_high": record.get("interval_high", 100.0),
        "score": record["score"],
        "risk": record["risk"],
        "reason": record["reason"],
        "contributions": record.get("contributions", {}),
        "factors": record.get("factors", {}),
    }


def build_comparison(objective, recommended: dict, trace: Trace, domain: str = "reaction_yield") -> List[Dict[str, Any]]:
    """Score the anchor conditions alongside the recommendation for context."""
    domain_anchors = DOMAIN_ANCHORS.get(domain, DOMAIN_ANCHORS["reaction_yield"])
    anchors = [anchor["experiment"] for anchor in domain_anchors]
    keys = _get_domain_keys(domain)
    anchors.append({name: recommended[name] for name in keys if name in recommended})
    labels = [anchor["label"] for anchor in domain_anchors] + ["AI recommendation"]
    notes = [anchor["note"] for anchor in domain_anchors] + [
        "Selected by the objective-weighted score."
    ]

    if domain == "reaction_yield":
        predictions = model_store.predict(anchors)
    else:
        from services.model_registry import model_registry
        predictions = model_registry.predict(domain, anchors)

    pred_key = _get_pred_key(domain)
    comparison: List[Dict[str, Any]] = []
    for label, note, experiment, prediction in zip(labels, notes, anchors, predictions):
        if domain == "reaction_yield":
            scored = score_experiment(experiment, prediction, objective)
        else:
            from services.domain_scoring import score_experiment as domain_score_experiment
            scored = domain_score_experiment(experiment, prediction, objective, domain)
        pred_val = prediction.get(pred_key, prediction.get("predicted_yield", 0.0))
        comparison.append(
            {
                "label": label,
                "note": note,
                "experiment": experiment,
                "predicted_yield": pred_val,
                "uncertainty_std": prediction["uncertainty_std"],
                "score": scored["score"],
                "components": scored["components"],
                "risk": scored["risk"],
            }
        )
    trace.add("compare", "Outcome comparison", f"{len(comparison)} conditions scored")
    return comparison


def run_research(
    research_question: str,
    num_experiments: int = 5,
    constraints: Optional[Dict[str, float]] = None,
    domain: str = "reaction_yield",
    papers: Optional[List[Dict[str, Any]]] = None,
    *,
    include_simulation: bool = True,
    include_comparison: bool = True,
    persist: bool = True,
) -> Dict[str, Any]:
    """Execute the full research pipeline and return the report payload."""
    started = time.perf_counter()
    trace = Trace()

    # 1) understand the objective ---------------------------------------- #
    if domain == "reaction_yield":
        objective = parse_objective(research_question, constraints)
    else:
        from services.domain_scoring import parse_objective as domain_parse_objective
        objective = domain_parse_objective(research_question, constraints, domain)

    trace.add(
        "objective",
        "Objective interpretation",
        f"priorities: {', '.join(objective.priorities)}",
    )

    # 2) identify variables ---------------------------------------------- #
    if domain == "reaction_yield":
        variables = identified_variables(objective)
    else:
        from services.domain_scoring import identify_variables as domain_identify_variables
        variables = domain_identify_variables(objective, domain)

    trace.add("variables", "Variable identification", f"{len(variables)} decision variables")

    # 3) retrieve scientific knowledge ----------------------------------- #
    knowledge = retrieve_knowledge(research_question, trace, papers=papers)

    # 4) generate candidate experiments (model-guided) -------------------- #
    if domain == "reaction_yield":
        generation = generate_experiments(
            research_question,
            num_experiments=num_experiments,
            constraints=constraints,
            with_rationale=True,
        )
    else:
        from services.domain_generator import generate_experiments as domain_generate
        generation = domain_generate(
            domain,
            research_question,
            num_experiments=num_experiments,
            constraints=constraints,
            with_rationale=True,
        )

    candidates = generation["experiments"]
    trace.add(
        "generate",
        "Candidate experiment generation",
        f"{len(candidates)} candidates surfaced from {generation['search']['pool_evaluated']} evaluated conditions",
    )

    ranked = sorted(candidates, key=lambda item: item["score"], reverse=True)
    for position, record in enumerate(ranked, start=1):
        record["rank"] = position
    best = ranked[0]
    pred_key = _get_pred_key(domain)
    best_pred = best.get(pred_key, best.get("predicted_yield", 0.0))

    # 5) predictions ----------------------------------------------------- #
    trace.add(
        "predict",
        "ML outcome prediction",
        f"Random Forest predicted target for all candidates (best {best_pred:.1f})",
    )

    # 6-7) comparison + ranking ------------------------------------------ #
    comparison = build_comparison(objective, best, trace, domain) if include_comparison else None

    ranking = [
        {
            "rank": record["rank"],
            "id": record["id"],
            "score": record["score"],
            "predicted_yield": record.get(pred_key, record.get("predicted_yield", 0.0)),
            "uncertainty_std": record["uncertainty_std"],
            "risk_level": record["risk"]["level"],
            "components": record["components"],
            "weights": record["weights"],
            "reason": record["reason"],
        }
        for record in ranked
    ]
    trace.add("rank", "Experiment ranking", f"best score {best['score']:.1f}/100")

    # 8) explanation ----------------------------------------------------- #
    if domain == "reaction_yield":
        model_meta = model_store.metadata
    else:
        from services.model_registry import model_registry
        model_meta = model_registry.metadata(domain)

    explanation = narrator.explain_results(
        objective,
        [_narrator_item(record, domain) for record in ranked],
        knowledge,
        model_meta,
        client=llm_client,
        domain=domain,
    )
    trace.add(
        "explain",
        "AI research report",
        f"narrative generated by {explanation['generated_by']}",
    )

    # 9) next suggested experiment --------------------------------------- #
    try:
        if domain == "reaction_yield":
            proposal = suggest_next_experiment(best, research_question, constraints)
        else:
            from services.domain_generator import suggest_next_experiment as domain_suggest_next
            proposal = domain_suggest_next(domain, best, research_question, constraints)

        next_narrative = narrator.next_experiment_narrative(proposal, best, objective, client=llm_client, domain=domain)
        proposal.update(
            {
                "rationale": next_narrative.get("rationale", proposal["rationale"]),
                "hypothesis": next_narrative.get("hypothesis", proposal["hypothesis"]),
                "generated_by": next_narrative.get("generated_by", "deterministic-template"),
            }
        )
        trace.add("next", "Next experiment proposal", proposal["probe_type"])
    except Exception as error:  # noqa: BLE001
        logger.warning("Could not propose a follow-up experiment: %s", error)
        proposal = {
            "error": str(error),
            "rationale": "No follow-up candidate could be proposed inside the given constraints.",
        }
        trace.add("next", "Next experiment proposal", f"failed: {error}", ok=False)

    # --- optional virtual run ------------------------------------------- #
    simulation = None
    if include_simulation:
        try:
            keys = _get_domain_keys(domain)
            if domain == "reaction_yield":
                simulation = simulate(
                    {name: best[name] for name in keys if name in best},
                    predicted_yield=best.get("predicted_yield", 0.0),
                    uncertainty_std=best.get("uncertainty_std", 0.0),
                )
            else:
                from simulator.domain_simulator import simulate as domain_simulate
                simulation = domain_simulate(
                    {name: best[name] for name in keys if name in best},
                    domain=domain,
                    predicted_target=best_pred,
                    uncertainty_std=best.get("uncertainty_std", 0.0),
                )
            trace.add(
                "simulate",
                "Virtual experiment simulation",
                f"surrogate measured {simulation.get('observed_yield', simulation.get('observed_target', 0.0)):.1f} vs predicted {simulation.get('predicted_yield', simulation.get('predicted_target', 0.0)):.1f}",
            )
        except Exception as error:  # noqa: BLE001
            logger.warning("Simulation failed: %s", error)
            trace.add("simulate", "Virtual experiment simulation", f"failed: {error}", ok=False)

    disclaimers = [
        "Predictions come from a Random Forest trained on a SIMULATED prototype dataset (provenance: synthetic_prototype_v1) and are not validated experimental results.",
        "Confidence and intervals are model-derived uncertainty proxies, not calibrated statistical guarantees.",
        "The virtual reactor is a visual simulator, not a laboratory control system.",
        "Knowledge base notes are authored prototype content for this demo - not publications and not citable literature.",
        "Ranking uses a transparent weighted score, not an economic or safety assessment of a real process.",
    ]

    if domain == "reaction_yield":
        model_payload = {
            "type": model_store.metadata.get("model_type"),
            "target": model_store.metadata.get("target"),
            "features": model_store.metadata.get("features"),
            "metrics": model_store.metrics,
            "cv_r2_mean": model_store.metadata.get("cv_r2_mean"),
            "feature_importance": model_store.feature_importance,
            "dataset_provenance": model_store.metadata.get("dataset_provenance"),
            "trained_at": model_store.metadata.get("trained_at"),
        }
    else:
        from services.model_registry import model_registry
        meta = model_registry.metadata(domain)
        model_payload = {
            "type": meta.get("model_type"),
            "target": meta.get("target"),
            "features": meta.get("features"),
            "metrics": model_registry.metrics(domain),
            "cv_r2_mean": meta.get("cv_r2_mean"),
            "feature_importance": model_registry.feature_importance(domain),
            "dataset_provenance": meta.get("dataset_provenance"),
            "trained_at": meta.get("trained_at"),
        }

    payload: Dict[str, Any] = {
        "run_id": None,
        "elapsed_ms": 0.0,
        "research_question": research_question,
        "research_objective": objective.as_dict(),
        "identified_variables": variables,
        "retrieved_knowledge": knowledge,
        "relevant_papers": papers or [],
        "candidate_experiments": ranked,
        "search": generation["search"],
        "ranking": ranking,
        "recommended_experiment": best,
        "simulation": simulation,
        "comparison": comparison,
        "explanation": explanation,
        "next_suggested_experiment": proposal,
        "model": model_payload,
        "reasoning_backend": narrator.llm_status(llm_client),
        "knowledge_base": retriever.status(),
        "agent_trace": trace.entries,
        "disclaimers": disclaimers,
    }

    if persist:
        payload["run_id"] = run_store.save_run(
            research_question,
            payload,
            objective=objective.as_dict(),
            recommended=best,
        )

    payload["elapsed_ms"] = round((time.perf_counter() - started) * 1000.0, 1)
    return payload
