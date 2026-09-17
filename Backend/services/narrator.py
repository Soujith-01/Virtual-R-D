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


def _as_params(record: dict) -> dict:
    """
    Accept either a flat experiment record (parameters at the top level) or one
    already wrapped as ``{"experiment": {...}}``, and return the parameter dict.
    """
    nested = record.get("experiment")
    if isinstance(nested, dict):
        return nested
    return {name: record[name] for name in FEATURE_NAMES}


def _catalyst_label(catalyst: str) -> str:
    profile = CATALYST_PROFILES.get(catalyst)
    return profile.label if profile else catalyst


def describe_experiment(experiment: dict) -> str:
    """One-line protocol description, e.g. 'B at 90 degC / 2.0 bar / 0.20 M / 45 min'."""
    return (
        f"{_catalyst_label(str(experiment['catalyst']))} at "
        f"{float(experiment['temperature']):.0f} {UNITS['temperature']}, "
        f"{float(experiment['pressure']):.1f} {UNITS['pressure']}, "
        f"{float(experiment['concentration']):.2f} {UNITS['concentration']}, "
        f"{float(experiment['reaction_time']):.0f} {UNITS['reaction_time']}"
    )


def experiment_rationale(experiment: dict, scored: dict, objective, index: int) -> str:
    """Deterministic one-paragraph rationale for a single candidate."""
    predicted = float(experiment.get("predicted_yield", 0.0))
    uncertainty = float(experiment.get("uncertainty_std", 0.0))
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
        f"Candidate {index} ({describe_experiment(experiment)}): the surrogate predicts "
        f"{predicted:.1f}% yield with a {uncertainty:.1f} point tree-disagreement proxy. "
        f"The run is carried mainly by {verb[strongest[0]]} and {verb[strongest[1]]}; "
        f"{verb[weakest]} is the limiting factor, and {penalty_phrase}. "
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
            "parameters": best["experiment"],
            "predicted_yield": best["predicted_yield"],
            "score": best["score"],
            "risk": best["risk"],
            "reason": best["reason"],
        },
        "runner_ups": [
            {
                "parameters": item["experiment"],
                "predicted_yield": item["predicted_yield"],
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
            "highlights": highlights or _template_highlights(best, ranked),
            "caveats": caveats or _template_caveats(),
            "generated_by": f"{result.provider}:{result.model}",
            "used_external_llm": True,
        }

    return {
        "explanation": _template_explanation(objective, best, ranked, knowledge, model_metadata),
        "highlights": _template_highlights(best, ranked),
        "caveats": _template_caveats(),
        "generated_by": "deterministic-template",
        "used_external_llm": False,
        "llm_error": result.error,
    }


def _passes_grounding_check(text: str) -> bool:
    """Reject LLM output that fabricates publication metadata."""
    lowered = text.lower()
    return not any(token in lowered for token in _FORBIDDEN_TOPICS)


def _template_highlights(best: dict, ranked: Sequence[dict]) -> List[str]:
    experiment = best["experiment"]
    spread = ranked[0]["predicted_yield"] - ranked[-1]["predicted_yield"] if len(ranked) > 1 else 0.0
    top_driver = max(
        best["contributions"], key=lambda key: best["contributions"][key]
    )
    return [
        f"Best candidate: {describe_experiment(experiment)}",
        f"Predicted yield {best['predicted_yield']:.1f}% "
        f"(interval {best.get('interval_low', 0):.1f}-{best.get('interval_high', 100):.1f}%).",
        f"Objective-weighted score {best['score']:.1f}/100, risk level {best['risk']['level']}.",
        f"Dominant scoring component: {top_driver}.",
        f"Candidate spread across the shortlist: {spread:.1f} yield points.",
    ]


def _template_caveats() -> List[str]:
    return [
        "The prediction model was trained on a SIMULATED prototype dataset "
        "(provenance: synthetic_prototype_v1). Predictions illustrate the workflow and are "
        "not validated experimental results.",
        "Confidence and intervals are model-derived uncertainty proxies "
        "(tree disagreement + residual spread), not calibrated statistical guarantees.",
        "Replace backend/training/dataset.csv with validated in-house measurements and "
        "retrain to obtain defensible numbers.",
    ]


def _template_explanation(
    objective,
    best: dict,
    ranked: Sequence[dict],
    knowledge: Sequence[dict],
    model_metadata: Dict,
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
        f"The nearest alternative is {describe_experiment(runner_up['experiment'])} at "
        f"{runner_up['predicted_yield']:.1f}% predicted yield (score {runner_up['score']:.1f}), "
        f"which trades score for a different risk/effort balance. "
        if runner_up
        else ""
    )

    penalties = [
        f"{name} {value:.0%}" for name, value in (best["factors"] or {}).items() if name == "over_reaction_penalty" and value < 0.97
    ]
    penalty_phrase = f" Penalty: over-reaction factor {penalties[0]}." if penalties else ""

    return (
        f"Objective: {objective.text} The agent prioritised "
        f"{', '.join(objective.priorities)} and scored candidates with an explicit weighted sum "
        f"(yield {objective.weights.get('yield', 0):.0%}, time {objective.weights.get('time', 0):.0%}, "
        f"temperature {objective.weights.get('temperature', 0):.0%}, "
        f"pressure {objective.weights.get('pressure', 0):.0%}, risk {objective.weights.get('risk', 0):.0%}). "
        f"The recommended run is {describe_experiment(best['experiment'])}, predicted to reach "
        f"{best['predicted_yield']:.1f}% yield (approximate interval "
        f"{best.get('interval_low', 0):.1f}-{best.get('interval_high', 100):.1f}%). "
        f"{best['reason']}{penalty_phrase} "
        f"{runner_up_phrase}"
        f"The Random Forest regressor reports R2={metrics.get('r2', float('nan')):.3f} and "
        f"MAE={metrics.get('mae', float('nan')):.2f} yield points on a held-out test split; the most "
        f"influential variables are {feature_phrase}, which is consistent with the retrieved "
        f"process knowledge. {source_phrase} "
        f"Because the training data is simulated, treat this as a ranked hypothesis for the lab to "
        f"test, not an experimental result."
    )


def next_experiment_narrative(
    proposal: dict, best: dict, objective, *, client: LLMClient | None = None
) -> dict:
    """Narrate the follow-up experiment suggestion."""
    client = client or llm_client
    experiment = _as_params(proposal)
    best_params = _as_params(best)

    parsed, result = client.chat_json(
        SYSTEM_PROMPT,
        (
            "A researcher has seen the ranked shortlist. Propose and justify the single next "
            "experiment to run.\nReturn JSON: {\"rationale\": string (60-120 words), "
            "\"hypothesis\": string (one sentence)}.\n\n"
            f"OBJECTIVE: {objective.text}\n"
            f"CURRENT BEST: {best_params} -> {best['predicted_yield']:.1f}% yield, "
            f"score {best['score']:.1f}\n"
            f"PROPOSED NEXT: {experiment} -> {proposal['predicted_yield']:.1f}% predicted yield, "
            f"score {proposal['score']:.1f}, probe type {proposal['probe_type']}\n"
        ),
    )

    if parsed and isinstance(parsed, dict) and parsed.get("rationale"):
        return {
            "rationale": str(parsed["rationale"]).strip(),
            "hypothesis": str(parsed.get("hypothesis", "")).strip(),
            "generated_by": f"{result.provider}:{result.model}",
            "used_external_llm": True,
        }

    delta = proposal["predicted_yield"] - best["predicted_yield"]
    return {
        "rationale": proposal["rationale"],
        "hypothesis": proposal["hypothesis"],
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
