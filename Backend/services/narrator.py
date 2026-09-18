"""
Phase 9 - Narration: turns numbers into language.

Every function here tries the configured LLM first and falls back to a
deterministic template. The template path is not a degraded stub - it is what
runs when no API key is present, and it produces the same factual content,
just phrased programmatically.

Guardrails baked into the prompts:
  * only use the retrieved context provided (never invent citations)
  * always state the synthetic-prototype caveat
  * never claim a validated real-world result
"""

from __future__ import annotations

from typing import Dict, List, Sequence

from config import settings
from domain import CATALYST_PROFILES, FEATURE_NAMES, UNITS, factor_contributions
from services.llm import LLMClient, llm_client

MAX_KNOWLEDGE_CHARS = 500

SYSTEM_PROMPT = (
    "You are the AI research agent inside the 'Virtual R&D Lab', a platform that "
    "helps researchers prioritise experiments before running them in a real lab.\n"
    "Hard rules you must never break:\n"
    "1. The machine-learning model was trained on a SIMULATED prototype dataset. "
    "Predictions are workflow demonstrations, never validated experimental results.\n"
    "2. Only cite the knowledge excerpts supplied to you. Never invent paper titles, "
    "authors, journals or DOIs.\n"
    "3. Be specific and quantitative. Use the exact numbers you are given.\n"
    "4. Write for a scientific jury: concise, technical, no marketing language."
)

#: Fields we are willing to accept from an LLM JSON reply.
_FORBIDDEN_TOPICS = ("doi", "journal", "et al.", "published in")


def _as_params(record: dict, domain: str = "reaction_yield") -> dict:
    """
    Accept either a flat experiment record (parameters at the top level) or one
    already wrapped as ``{"experiment": {...}}``, and return the parameter dict.
    """
    nested = record.get("experiment")
    if isinstance(nested, dict):
        return nested
    if domain == "reaction_yield":
        return {name: record[name] for name in FEATURE_NAMES if name in record}
    return {
        k: v for k, v in record.items()
        if k not in ("id", "rank", "domain", "score", "components", "weights", "contributions", "risk", "reason", "constraint_violations", "origin", "rationale", "predicted_yield", "uncertainty_std", "estimated_confidence", "interval_low", "interval_high", "factors")
    }


def _catalyst_label(catalyst: str) -> str:
    profile = CATALYST_PROFILES.get(catalyst)
    return profile.label if profile else catalyst


def describe_experiment(experiment: dict, domain: str = "reaction_yield") -> str:
    """One-line protocol description for any domain."""
    params = _as_params(experiment, domain)
    if domain == "reaction_yield" or "catalyst" in params:
        catalyst = _catalyst_label(str(params.get("catalyst", "None")))
        return (
            f"{catalyst} at "
            f"{float(params.get('temperature', 0)):.0f} degC, "
            f"{float(params.get('pressure', 0)):.1f} bar, "
            f"{float(params.get('concentration', 0)):.2f} M, "
            f"{float(params.get('reaction_time', 0)):.0f} min"
        )
    elif domain == "solar_efficiency" or "cell_thickness_nm" in params:
        return (
            f"Thickness: {float(params.get('cell_thickness_nm', 0)):.0f} nm, "
            f"Doping: {float(params.get('doping_concentration', 0)):.1e} cm^-3, "
            f"Anneal: {float(params.get('annealing_temperature_c', 0)):.0f} degC, "
            f"Light: {float(params.get('light_intensity_lux', 0)):.0f} lux, "
            f"Temp: {float(params.get('operating_temperature_c', 0)):.0f} degC"
        )
    elif domain == "plant_growth" or "co2_concentration_ppm" in params:
        return (
            f"Light: {float(params.get('light_intensity_lux', 0)):.0f} lux, "
            f"CO2: {float(params.get('co2_concentration_ppm', 0)):.0f} ppm, "
            f"Nutrients: {float(params.get('nutrient_concentration_mm', 0)):.1f} mM, "
            f"Temp: {float(params.get('temperature_c', 0)):.0f} degC, "
            f"Water: {float(params.get('water_supply_ml_day', 0)):.0f} ml/day"
        )
    elif domain == "battery_performance" or "electrolyte_concentration_m" in params:
        return (
            f"Electrolyte: {float(params.get('electrolyte_concentration_m', 0)):.1f} M, "
            f"Charging: {float(params.get('charging_rate_c', 0)):.1f} C, "
            f"Temp: {float(params.get('operating_temperature_c', 0)):.0f} degC, "
            f"Discharge: {float(params.get('discharge_rate_c', 0)):.1f} C, "
            f"Cycles: {float(params.get('cycle_count', 0)):.0f}"
        )
    elif domain == "water_purification" or "coagulant_dose_mg_l" in params:
        return (
            f"Coagulant: {float(params.get('coagulant_dose_mg_l', 0)):.1f} mg/L, "
            f"pH: {float(params.get('ph', 0)):.1f}, "
            f"Contact: {float(params.get('contact_time_min', 0)):.0f} min, "
            f"Temp: {float(params.get('temperature_c', 0)):.0f} degC, "
            f"Speed: {float(params.get('mixing_speed_rpm', 0)):.0f} rpm"
        )
    else:
        return ", ".join(f"{k}: {v}" for k, v in params.items())


def experiment_rationale(experiment: dict, scored: dict, objective, index: int, domain: str = "reaction_yield") -> str:
    """Deterministic one-paragraph rationale for a single candidate across any domain."""
    pred_key = {
        "solar_efficiency": "predicted_efficiency",
        "plant_growth": "predicted_biomass_yield",
        "battery_performance": "predicted_capacity_retention",
        "water_purification": "predicted_turbidity_removal",
    }.get(domain, "predicted_yield")
    predicted = float(experiment.get(pred_key, experiment.get("predicted_yield", 0.0)))
    uncertainty = float(experiment.get("uncertainty_std", 0.0))

    if domain == "reaction_yield" and "catalyst" in experiment:
        contributions = factor_contributions(
            experiment["temperature"],
            experiment["pressure"],
            str(experiment["catalyst"]),
            experiment["concentration"],
            experiment["reaction_time"],
        )

        strongest = sorted(
            ("temperature", "pressure", "concentration", "reaction_time"),
            key=lambda name: contributions[name],
            reverse=True,
        )[:2]
        weakest = min(
            ("temperature", "pressure", "concentration", "reaction_time"),
            key=lambda name: contributions[name],
        )

        verb = {
            "temperature": "thermal conditions",
            "pressure": "pressure set-point",
            "concentration": "feed concentration",
            "reaction_time": "residence time",
        }

        penalty = contributions["over_reaction_penalty"]
        penalty_phrase = (
            "no over-reaction penalty is triggered"
            if penalty > 0.97
            else f"over-reaction penalty {1.0 - penalty:.0%} applies"
        )

        return (
            f"Candidate {index} ({describe_experiment(experiment, domain)}): the surrogate predicts "
            f"{predicted:.1f}% yield with a {uncertainty:.1f} point tree-disagreement proxy. "
            f"The run is carried mainly by {verb[strongest[0]]} and {verb[strongest[1]]}; "
            f"{verb[weakest]} is the limiting factor, and {penalty_phrase}. "
            f"Objective-weighted score {scored['score']:.1f}/100 "
            f"(risk: {scored['risk']['level']})."
        )

    return (
        f"Candidate {index} ({describe_experiment(experiment, domain)}): predicted target is "
        f"{predicted:.1f} with uncertainty proxy {uncertainty:.1f}. "
        f"{scored.get('reason', '')} "
        f"Objective-weighted score {scored['score']:.1f}/100 "
        f"(risk: {scored['risk']['level']})."
    )


def format_knowledge(knowledge: Sequence[dict]) -> str:
    """Render retrieved chunks into a compact prompt block."""
    if not knowledge:
        return "(no knowledge base entries retrieved)"
    blocks = []
    for item in knowledge[:6]:
        text = str(item.get("text", ""))[:MAX_KNOWLEDGE_CHARS]
        blocks.append(f"[{item.get('source', 'unknown')}] {text}")
    return "\n\n".join(blocks)


def explain_results(
    objective,
    ranked: Sequence[dict],
    knowledge: Sequence[dict],
    model_metadata: Dict,
    *,
    client: LLMClient | None = None,
    domain: str = "reaction_yield",
) -> dict:
    """
    Explain the ranked candidate set. Returns
    ``{"explanation", "highlights", "caveats", "generated_by"}``.
    """
    client = client or llm_client
    if not ranked:
        raise ValueError("no ranked experiments to explain")

    best = ranked[0]
    metrics = model_metadata.get("metrics", {})
    importance = model_metadata.get("feature_importance_by_group", {})

    facts = {
        "objective": objective.text,
        "priorities": objective.priorities,
        "scoring_weights": objective.weights,
        "best_candidate": {
            "parameters": best.get("experiment", best),
            "predicted_yield": best.get("predicted_yield", 0.0),
            "score": best["score"],
            "risk": best["risk"],
            "reason": best["reason"],
        },
        "runner_ups": [
            {
                "parameters": item.get("experiment", item),
                "predicted_yield": item.get("predicted_yield", 0.0),
                "score": item["score"],
            }
            for item in ranked[1:4]
        ],
        "model": {
            "type": model_metadata.get("model_type"),
            "target": model_metadata.get("target"),
            "r2": metrics.get("r2"),
            "mae": metrics.get("mae"),
            "rmse": metrics.get("rmse"),
            "feature_importance": importance,
        },
        "knowledge_excerpts": [
            {"source": item.get("source"), "text": str(item.get("text", ""))[:MAX_KNOWLEDGE_CHARS]}
            for item in knowledge
        ],
        "dataset_provenance": model_metadata.get("dataset_provenance"),
    }

    parsed, result = client.chat_json(
        SYSTEM_PROMPT,
        (
            "Explain this experiment-selection decision to a scientific jury.\n"
            "Return JSON: {\"explanation\": string (120-220 words, quantitative, references the "
            "retrieved sources by their filename), \"highlights\": [3-5 short bullet strings], "
            "\"caveats\": [1-3 short strings about data provenance and uncertainty]}.\n\n"
            f"FACTS:\n{facts}"
        ),
    )

    if parsed and isinstance(parsed, dict) and parsed.get("explanation"):
        highlights = [str(item) for item in parsed.get("highlights", [])][:6]
        caveats = [str(item) for item in parsed.get("caveats", [])][:4]
        if not _passes_grounding_check(str(parsed["explanation"])):
            parsed = None  # fall through to the template rather than trust it

    if parsed and isinstance(parsed, dict) and parsed.get("explanation"):
        return {
            "explanation": str(parsed["explanation"]).strip(),
            "highlights": highlights or _template_highlights(best, ranked, domain),
            "caveats": caveats or _template_caveats(),
            "generated_by": f"{result.provider}:{result.model}",
            "used_external_llm": True,
        }

    return {
        "explanation": _template_explanation(objective, best, ranked, knowledge, model_metadata, domain),
        "highlights": _template_highlights(best, ranked, domain),
        "caveats": _template_caveats(),
        "generated_by": "deterministic-template",
        "used_external_llm": False,
        "llm_error": result.error,
    }


def _passes_grounding_check(text: str) -> bool:
    """Reject LLM output that fabricates publication metadata."""
    lowered = text.lower()
    return not any(token in lowered for token in _FORBIDDEN_TOPICS)


def _template_highlights(best: dict, ranked: Sequence[dict], domain: str = "reaction_yield") -> List[str]:
    experiment = best.get("experiment", best)
    spread = (ranked[0].get("predicted_yield", 0.0) - ranked[-1].get("predicted_yield", 0.0)) if len(ranked) > 1 else 0.0
    top_driver = max(
        best["contributions"], key=lambda key: best["contributions"][key]
    ) if best.get("contributions") else "objective priority"
    return [
        f"Best candidate: {describe_experiment(experiment, domain)}",
        f"Predicted target {best.get('predicted_yield', 0.0):.1f} "
        f"(interval {best.get('interval_low', 0):.1f}-{best.get('interval_high', 100):.1f}).",
        f"Objective-weighted score {best['score']:.1f}/100, risk level {best['risk']['level']}.",
        f"Dominant scoring component: {top_driver}.",
        f"Candidate spread across the shortlist: {spread:.1f} points.",
    ]


def _template_caveats() -> List[str]:
    return [
        "The prediction model was trained on a SIMULATED prototype dataset "
        "(provenance: synthetic_prototype_v1). Predictions illustrate the workflow and are "
        "not validated experimental results.",
        "Confidence and intervals are model-derived uncertainty proxies "
        "(tree disagreement + residual spread), not calibrated statistical guarantees.",
        "Replace synthetic training datasets with validated in-house measurements and "
        "retrain to obtain defensible numbers.",
    ]


def _template_explanation(
    objective,
    best: dict,
    ranked: Sequence[dict],
    knowledge: Sequence[dict],
    model_metadata: Dict,
    domain: str = "reaction_yield",
) -> str:
    metrics = model_metadata.get("metrics", {})
    importance = model_metadata.get("feature_importance_by_group", {})
    top_features = sorted(importance.items(), key=lambda pair: pair[1], reverse=True)[:3]
    feature_phrase = ", ".join(
        f"{name} ({value:.0%})" for name, value in top_features if value > 0
    ) or "n/a"

    sources = sorted({str(item.get("source", "unknown")) for item in knowledge})
    source_phrase = (
        "Retrieved internal knowledge base notes: " + ", ".join(sources) + "."
        if sources
        else "No knowledge base entries were retrieved for this objective."
    )

    runner_up = ranked[1] if len(ranked) > 1 else None
    runner_up_phrase = (
        f"The nearest alternative is {describe_experiment(runner_up.get('experiment', runner_up), domain)} at "
        f"{runner_up.get('predicted_yield', 0.0):.1f} predicted target (score {runner_up['score']:.1f}), "
        f"which trades score for a different risk/effort balance. "
        if runner_up
        else ""
    )

    penalties = [
        f"{name} {value:.0%}" for name, value in (best.get("factors") or {}).items() if name == "over_reaction_penalty" and value < 0.97
    ]
    penalty_phrase = f" Penalty: over-reaction factor {penalties[0]}." if penalties else ""

    weights_str = ", ".join(f"{k} {v:.0%}" for k, v in objective.weights.items())

    return (
        f"Objective: {objective.text} The agent prioritised "
        f"{', '.join(objective.priorities)} and scored candidates with an explicit weighted sum "
        f"({weights_str}). "
        f"The recommended run is {describe_experiment(best.get('experiment', best), domain)}, predicted to reach "
        f"{best.get('predicted_yield', 0.0):.1f} target (approximate interval "
        f"{best.get('interval_low', 0):.1f}-{best.get('interval_high', 100):.1f}). "
        f"{best['reason']}{penalty_phrase} "
        f"{runner_up_phrase}"
        f"The Random Forest regressor reports R2={metrics.get('r2', float('nan')):.3f} and "
        f"MAE={metrics.get('mae', float('nan')):.2f} points on a held-out test split; the most "
        f"influential variables are {feature_phrase}, which is consistent with the retrieved "
        f"process knowledge. {source_phrase} "
        f"Because the training data is simulated, treat this as a ranked hypothesis for the lab to "
        f"test, not an experimental result."
    )


def next_experiment_narrative(
    proposal: dict, best: dict, objective, *, client: LLMClient | None = None, domain: str = "reaction_yield"
) -> dict:
    """Narrate the follow-up experiment suggestion."""
    client = client or llm_client
    experiment = _as_params(proposal, domain)
    best_params = _as_params(best, domain)

    pred_key = {
        "reaction_yield": "predicted_yield",
        "solar_efficiency": "predicted_efficiency",
        "plant_growth": "predicted_biomass_yield",
        "battery_performance": "predicted_capacity_retention",
        "water_purification": "predicted_turbidity_removal",
    }.get(domain, "predicted_yield")

    best_val = float(best.get("predicted_yield", best.get(pred_key, 0.0)))
    prop_val = float(proposal.get("predicted_yield", proposal.get(pred_key, 0.0)))

    parsed, result = client.chat_json(
        SYSTEM_PROMPT,
        (
            "A researcher has seen the ranked shortlist. Propose and justify the single next "
            "experiment to run.\nReturn JSON: {\"rationale\": string (60-120 words), "
            "\"hypothesis\": string (one sentence)}.\n\n"
            f"OBJECTIVE: {objective.text}\n"
            f"CURRENT BEST: {best_params} -> {best_val:.1f} predicted target, "
            f"score {best.get('score', 0.0):.1f}\n"
            f"PROPOSED NEXT: {experiment} -> {prop_val:.1f} predicted target, "
            f"score {proposal.get('score', 0.0):.1f}, probe type {proposal.get('probe_type', 'local refinement')}\n"
        ),
    )

    if parsed and isinstance(parsed, dict) and parsed.get("rationale"):
        return {
            "rationale": str(parsed["rationale"]).strip(),
            "hypothesis": str(parsed.get("hypothesis", "")).strip(),
            "generated_by": f"{result.provider}:{result.model}",
            "used_external_llm": True,
        }

    delta = prop_val - best_val
    return {
        "rationale": proposal.get("rationale", ""),
        "hypothesis": proposal.get("hypothesis", ""),
        "generated_by": "deterministic-template",
        "used_external_llm": False,
        "estimated_yield_delta": round(delta, 2),
    }


def llm_status(client: LLMClient | None = None) -> dict:
    """Report which reasoning backend the API is currently using."""
    client = client or llm_client
    info = client.info
    info["configured_provider"] = settings.llm_provider
    return info
