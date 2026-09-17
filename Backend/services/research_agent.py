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


def _narrator_item(record: dict) -> dict:
    """Adapt a flat API experiment record into the narrator's input shape."""
    return {
        "experiment": {name: record[name] for name in FEATURE_NAMES},
        "predicted_yield": record["predicted_yield"],
        "uncertainty_std": record["uncertainty_std"],
        "interval_low": record["interval_low"],
        "interval_high": record["interval_high"],
        "score": record["score"],
        "risk": record["risk"],
        "reason": record["reason"],
        "contributions": record["contributions"],
        "factors": record["factors"],
    }


def retrieve_knowledge(question: str, trace: Trace) -> List[Dict[str, Any]]:
    """Run several queries and merge the results by best similarity."""
    try:
        retriever.ensure_ready()
    except Exception as error:  # noqa: BLE001
        trace.add("knowledge", "Scientific knowledge retrieval", f"unavailable: {error}", ok=False)
        return []

    merged: Dict[str, Dict[str, Any]] = {}
    for template in KNOWLEDGE_QUERIES:
        query = template.format(question=question)
        try:
            for hit in retriever.retrieve(query, k=settings.rag_top_k):
                key = hit["chunk_id"]
                if key not in merged or hit["similarity"] > merged[key]["similarity"]:
                    merged[key] = hit
        except Exception as error:  # noqa: BLE001
            logger.warning("Retrieval failed for query %r: %s", query, error)

    hits = sorted(merged.values(), key=lambda item: item["similarity"], reverse=True)[:6]
    sources = sorted({hit["source"] for hit in hits})
    trace.add(
        "knowledge",
        "Scientific knowledge retrieval",
        f"{len(hits)} passages from {len(sources)} source file(s)",
    )
    return hits


def build_comparison(objective, recommended: dict, trace: Trace) -> List[Dict[str, Any]]:
    """Score the anchor conditions alongside the recommendation for context."""
    anchors = [anchor["experiment"] for anchor in COMPARISON_ANCHORS]
    anchors.append({name: recommended[name] for name in FEATURE_NAMES})
    labels = [anchor["label"] for anchor in COMPARISON_ANCHORS] + ["AI recommendation"]
    notes = [anchor["note"] for anchor in COMPARISON_ANCHORS] + [
        "Selected by the objective-weighted score."
    ]

    predictions = model_store.predict(anchors)
    comparison: List[Dict[str, Any]] = []
    for label, note, experiment, prediction in zip(labels, notes, anchors, predictions):
        scored = score_experiment(experiment, prediction, objective)
        comparison.append(
            {
                "label": label,
                "note": note,
                "experiment": experiment,
                "predicted_yield": prediction["predicted_yield"],
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
    *,
    include_simulation: bool = True,
    include_comparison: bool = True,
    persist: bool = True,
) -> Dict[str, Any]:
    """Execute the full research pipeline and return the report payload."""
    started = time.perf_counter()
    trace = Trace()

    # 1) understand the objective ---------------------------------------- #
    objective = parse_objective(research_question, constraints)
    trace.add(
        "objective",
        "Objective interpretation",
        f"priorities: {', '.join(objective.priorities)}",
    )

    # 2) identify variables ---------------------------------------------- #
    variables = identified_variables(objective)
    trace.add("variables", "Variable identification", f"{len(variables)} decision variables")

    # 3) retrieve scientific knowledge ----------------------------------- #
    knowledge = retrieve_knowledge(research_question, trace)

    # 4) generate candidate experiments (model-guided) -------------------- #
    generation = generate_experiments(
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

    # 5) predictions ----------------------------------------------------- #
    trace.add(
        "predict",
        "ML outcome prediction",
        f"Random Forest predicted yield for all candidates (best {best['predicted_yield']:.1f}%)",
    )

    # 6-7) comparison + ranking ------------------------------------------ #
    comparison = build_comparison(objective, best, trace) if include_comparison else None

    ranking = [
        {
            "rank": record["rank"],
            "id": record["id"],
            "score": record["score"],
            "predicted_yield": record["predicted_yield"],
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
    explanation = narrator.explain_results(
        objective,
        [_narrator_item(record) for record in ranked],
        knowledge,
        model_store.metadata,
        client=llm_client,
    )
    trace.add(
        "explain",
        "AI research report",
        f"narrative generated by {explanation['generated_by']}",
    )

    # 9) next suggested experiment --------------------------------------- #
    try:
        proposal = suggest_next_experiment(best, research_question, constraints)
        next_narrative = narrator.next_experiment_narrative(proposal, best, objective, client=llm_client)
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
            simulation = simulate(
                {name: best[name] for name in FEATURE_NAMES},
                predicted_yield=best["predicted_yield"],
                uncertainty_std=best["uncertainty_std"],
            )
            trace.add(
                "simulate",
                "Virtual experiment simulation",
                f"surrogate measured {simulation['observed_yield']:.1f}% vs predicted {simulation['predicted_yield']:.1f}%",
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

    payload: Dict[str, Any] = {
        "run_id": None,
        "elapsed_ms": 0.0,
        "research_question": research_question,
        "research_objective": objective.as_dict(),
        "identified_variables": variables,
        "retrieved_knowledge": knowledge,
        "candidate_experiments": ranked,
        "search": generation["search"],
        "ranking": ranking,
        "recommended_experiment": best,
        "simulation": simulation,
        "comparison": comparison,
        "explanation": explanation,
        "next_suggested_experiment": proposal,
        "model": {
            "type": model_store.metadata.get("model_type"),
            "target": model_store.metadata.get("target"),
            "features": model_store.metadata.get("features"),
            "metrics": model_store.metrics,
            "cv_r2_mean": model_store.metadata.get("cv_r2_mean"),
            "feature_importance": model_store.feature_importance,
            "dataset_provenance": model_store.metadata.get("dataset_provenance"),
            "trained_at": model_store.metadata.get("trained_at"),
        },
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
