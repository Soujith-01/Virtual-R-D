"""
Phase 5 - Candidate experiment generation (model-guided search).

How candidates are produced (no oracle chemistry is hardcoded):

  1. **Explore** - sample a stratified pool of experiments over the discrete
     protocol levels (``domain.FEATURE_LEVELS``) so surfaced conditions look like
     real lab set-points.
  2. **Predict** - push the whole pool through the trained Random Forest.
  3. **Score** - apply the transparent objective-weighted score (Phase 6).
  4. **Refine** - take the best candidate found and search its neighbourhood with
     two shrinking radii, i.e. a crude surrogate-guided local optimiser.
  5. **Diversify** - greedily select the final shortlist so the researcher sees
     genuinely different options rather than five near-identical points.

The generation is deterministic for a given objective + count, which makes the
hackathon demo reproducible.
"""

from __future__ import annotations

import hashlib
from typing import Dict, List, Sequence

import numpy as np

from config import settings
from domain import (
    CATALYSTS,
    FEATURE_LEVELS,
    FEATURE_NAMES,
    RANGES,
    factor_contributions,
    normalise,
    normalise_catalyst,
)
from services import narrator
from services.model_store import model_store
from services.scoring import Objective, parse_objective, score_experiment

NUMERIC_KEYS = ["temperature", "pressure", "concentration", "reaction_time"]
#: Weight of the catalyst dimension when measuring candidate diversity.
CATALYST_DISTANCE_WEIGHT = 1.0


# --------------------------------------------------------------------------- #
# helpers
# --------------------------------------------------------------------------- #

def _seed_from(*parts: object) -> int:
    payload = "|".join(str(part) for part in parts)
    return int(hashlib.sha256(payload.encode("utf-8")).hexdigest()[:8], 16)


def _level_index(key: str, value: float) -> int:
    """Nearest discrete level index for a feature value."""
    levels = FEATURE_LEVELS[key]
    return int(np.argmin(np.abs(levels - float(value))))


def _snap(key: str, value: float) -> float:
    """Snap a value onto the nearest protocol level and clip to the range."""
    levels = FEATURE_LEVELS[key]
    snapped = float(levels[_level_index(key, value)])
    low, high = RANGES[key]
    return float(min(max(snapped, low), high))


def _normalise_params(params: dict) -> dict:
    return {key: _snap(key, params[key]) for key in NUMERIC_KEYS} | {
        "catalyst": normalise_catalyst(params.get("catalyst"))
    }


def _key(params: dict) -> tuple:
    return tuple([round(float(params[name]), 4) for name in NUMERIC_KEYS] + [str(params["catalyst"])])


def _dedupe(candidates: Sequence[dict]) -> List[dict]:
    seen: set[tuple] = set()
    unique: List[dict] = []
    for candidate in candidates:
        key = _key(candidate)
        if key in seen:
            continue
        seen.add(key)
        unique.append(candidate)
    return unique


def _distance(left: dict, right: dict) -> float:
    """Normalised distance in the 4-D numeric space plus a catalyst mismatch term."""
    numeric = np.array(
        [normalise(left[name], name) - normalise(right[name], name) for name in NUMERIC_KEYS]
    )
    catalyst_term = (
        0.0 if str(left["catalyst"]) == str(right["catalyst"]) else CATALYST_DISTANCE_WEIGHT
    )
    return float(np.sqrt((numeric**2).sum() + catalyst_term**2) / np.sqrt(len(NUMERIC_KEYS) + CATALYST_DISTANCE_WEIGHT))


def _violates_constraints(params: dict, objective: Objective) -> bool:
    for key, ceiling in objective.constraints.items():
        if key in params and float(params[key]) > float(ceiling):
            return True
    return False


# --------------------------------------------------------------------------- #
# 1) exploration pool
# --------------------------------------------------------------------------- #

def _sample_pool(rng: np.random.Generator, size: int) -> List[dict]:
    """Stratified random sample over the discrete protocol levels."""
    catalysts = [CATALYSTS[index % len(CATALYSTS)] for index in range(size)]
    rng.shuffle(catalysts)

    columns = {
        key: FEATURE_LEVELS[key][rng.integers(0, len(FEATURE_LEVELS[key]), size=size)]
        for key in NUMERIC_KEYS
    }

    return [
        {key: float(columns[key][index]) for key in NUMERIC_KEYS} | {"catalyst": catalysts[index]}
        for index in range(size)
    ]


def _refine(
    centre: dict, rng: np.random.Generator, size: int, spread: float
) -> List[dict]:
    """Sample the neighbourhood of `centre` on the discrete level grid."""
    samples: List[dict] = []
    for _ in range(size):
        candidate = {}
        for key in NUMERIC_KEYS:
            levels = FEATURE_LEVELS[key]
            index = _level_index(key, centre[key])
            jitter = int(round(rng.normal(0.0, spread)))
            index = int(np.clip(index + jitter, 0, len(levels) - 1))
            candidate[key] = float(levels[index])

        # Mostly keep the same catalyst, occasionally probe another one.
        if rng.random() < 0.75:
            candidate["catalyst"] = str(centre["catalyst"])
        else:
            candidate["catalyst"] = str(rng.choice(CATALYSTS))
        samples.append(candidate)
    return samples


# --------------------------------------------------------------------------- #
# 2-3) predict + score
# --------------------------------------------------------------------------- #

def _predict_and_score(candidates: Sequence[dict], objective: Objective) -> List[dict]:
    """Run the model and the scorer over a batch of candidates."""
    predictions = model_store.predict(list(candidates))
    records: List[dict] = []
    for params, prediction in zip(candidates, predictions):
        scored = score_experiment(params, prediction, objective)
        records.append(
            {
                "params": params,
                "prediction": prediction,
                "scored": scored,
            }
        )
    return records


def _select_diverse(records: Sequence[dict], count: int) -> List[dict]:
    """
    Greedy max-score-with-diversity selection.

    Walks the score-sorted list and accepts a candidate only when it is far
    enough from everything already selected. The threshold relaxes until the
    shortlist is full.
    """
    ordered = sorted(records, key=lambda item: item["scored"]["score"], reverse=True)
    if len(ordered) <= count:
        return ordered

    for min_distance in (0.20, 0.15, 0.10, 0.05):
        selected: List[dict] = []
        for record in ordered:
            if len(selected) >= count:
                break
            if all(_distance(record["params"], other["params"]) >= min_distance for other in selected):
                selected.append(record)
        if len(selected) >= count:
            return selected

    # Fallback: relaxation was not enough (tiny/degenerate pool).
    return ordered[:count]


# --------------------------------------------------------------------------- #
# public API
# --------------------------------------------------------------------------- #

def _flatten(index: int, record: dict, objective: Objective, origin: str, *, with_rationale: bool) -> dict:
    params = record["params"]
    prediction = record["prediction"]
    scored = record["scored"]
    experiment = {
        "id": f"EXP-{index:02d}",
        "rank": index,
        **params,
        "predicted_yield": prediction["predicted_yield"],
        "uncertainty_std": prediction["uncertainty_std"],
        "estimated_confidence": prediction["estimated_confidence"],
        "interval_low": prediction["interval_low"],
        "interval_high": prediction["interval_high"],
        "score": scored["score"],
        "components": scored["components"],
        "weights": scored["weights"],
        "contributions": scored["contributions"],
        "risk": scored["risk"],
        "reason": scored["reason"],
        "constraint_violations": scored["constraint_violations"],
        "factors": factor_contributions(
            params["temperature"],
            params["pressure"],
            str(params["catalyst"]),
            params["concentration"],
            params["reaction_time"],
        ),
        "origin": origin,
    }
    if with_rationale:
        experiment["rationale"] = narrator.experiment_rationale(experiment, scored, objective, index)
    return experiment


def generate_experiments(
    objective_text: str,
    num_experiments: int | None = None,
    constraints: Dict[str, float] | None = None,
    *,
    pool_size: int | None = None,
    with_rationale: bool = True,
) -> dict:
    """
    Generate the shortlist of candidate experiments for a research objective.

    Returns ``{"objective", "experiments", "search", "method", "disclaimer"}``.
    """
    objective = parse_objective(objective_text, constraints)
    count = int(num_experiments or settings.default_num_experiments)
    if count < 1:
        raise ValueError("num_experiments must be >= 1")
    if count > 20:
        raise ValueError("num_experiments is capped at 20 for the MVP")

    pool_size = int(pool_size or settings.search_grid_size)
    rng = np.random.default_rng(_seed_from(objective.text, count, sorted(objective.constraints)))

    # 1) explore ---------------------------------------------------------- #
    pool = [candidate for candidate in _sample_pool(rng, pool_size) if not _violates_constraints(candidate, objective)]
    if not pool:
        raise ValueError("no candidates satisfy the requested constraints")

    pool = _dedupe(pool)
    records = _predict_and_score(pool, objective)
    best = max(records, key=lambda item: item["scored"]["score"])
    search_trace = [
        {
            "stage": "explore",
            "candidates": len(pool),
            "best_score": round(best["scored"]["score"], 2),
            "best_yield": best["prediction"]["predicted_yield"],
        }
    ]

    # 2) refine (two shrinking radii) ------------------------------------- #
    refined: List[dict] = []
    centre = best["params"]
    for spread, size in ((3.0, max(pool_size // 2, 150)), (1.2, max(pool_size // 4, 80))):
        batch = [candidate for candidate in _refine(centre, rng, size, spread) if not _violates_constraints(candidate, objective)]
        if not batch:
            continue
        batch = _dedupe(batch)
        batch_records = _predict_and_score(batch, objective)
        stage_best = max(batch_records, key=lambda item: item["scored"]["score"])
        if stage_best["scored"]["score"] > best["scored"]["score"]:
            best = stage_best
            centre = stage_best["params"]
        refined.extend(batch_records)
        search_trace.append(
            {
                "stage": f"refine(sd={spread})",
                "candidates": len(batch),
                "best_score": round(best["scored"]["score"], 2),
                "best_yield": best["prediction"]["predicted_yield"],
            }
        )

    # 3) diversify + shortlist -------------------------------------------- #
    refined_keys = {_key(record["params"]) for record in refined}
    combined = _dedupe_records(records + refined)
    shortlist = _select_diverse(combined, count)
    experiments = [
        _flatten(
            index,
            record,
            objective,
            "refined" if _key(record["params"]) in refined_keys else "explore",
            with_rationale=with_rationale,
        )
        for index, record in enumerate(shortlist, start=1)
    ]

    return {
        "objective": objective.as_dict(),
        "experiments": experiments,
        "search": {
            "method": "Random Forest surrogate + objective-weighted scoring + greedy diversity selection",
            "pool_evaluated": len(combined),
            "shortlist_size": len(experiments),
            "trace": search_trace,
            "deterministic": True,
        },
        "model": {
            "type": model_store.metadata.get("model_type"),
            "target": model_store.metadata.get("target"),
            "metrics": model_store.metrics,
            "dataset_provenance": model_store.metadata.get("dataset_provenance"),
        },
        "disclaimer": (
            "Candidate experiments are machine-generated hypotheses ranked by a model trained on "
            "SIMULATED prototype data. They are suggestions for a lab to test, not validated results."
        ),
    }


def _dedupe_records(records: Sequence[dict]) -> List[dict]:
    seen: set[tuple] = set()
    unique: List[dict] = []
    for record in records:
        key = _key(record["params"])
        if key in seen:
            continue
        seen.add(key)
        unique.append(record)
    return unique


def suggest_next_experiment(
    best_experiment: dict,
    objective_text: str,
    constraints: Dict[str, float] | None = None,
    *,
    size: int = 300,
) -> dict:
    """
    Phase 9 - propose the single follow-up experiment.

    Strategy: probe the neighbourhood of the current best candidate and return
    the highest-scoring neighbour that is actually *different* from it. If no
    neighbour beats it, the proposal is still useful as a confirmation run.
    """
    objective = parse_objective(objective_text, constraints)
    centre = _normalise_params(best_experiment)

    rng = np.random.default_rng(_seed_from("next", _key(centre), objective.text))
    batch = [candidate for candidate in _refine(centre, rng, size, 2.2) if not _violates_constraints(candidate, objective)]
    if not batch:
        raise ValueError("could not propose a follow-up experiment inside the given constraints")

    batch = [candidate for candidate in _dedupe(batch) if _key(candidate) != _key(centre)]
    if not batch:
        raise ValueError("follow-up search produced no distinct neighbour")

    records = _predict_and_score(batch, objective)
    chosen = max(records, key=lambda item: item["scored"]["score"])

    baseline_prediction = model_store.predict_one(centre)
    baseline_score = score_experiment(centre, baseline_prediction, objective)

    changed = _diff(centre, chosen["params"])

    score_delta = round(chosen["scored"]["score"] - baseline_score["score"], 2)
    yield_delta = round(chosen["prediction"]["predicted_yield"] - baseline_prediction["predicted_yield"], 2)
    probe_type = "local refinement" if len(changed) <= 2 else "exploratory probe"

    proposal = _flatten(0, chosen, objective, "next_probe", with_rationale=False)
    proposal["id"] = "NEXT-01"
    proposal["rank"] = 1
    proposal["probe_type"] = probe_type
    proposal["changed_variables"] = changed
    proposal["score_delta"] = score_delta
    proposal["yield_delta"] = yield_delta
    def _format_change(item: dict) -> str:
        if item["variable"] == "catalyst":
            return f"catalyst {item['from']} -> {item['to']}"
        return f"{item['variable']} {item['from']:g} -> {item['to']:g}"

    change_phrase = ", ".join(_format_change(item) for item in changed) or "no material change"
    proposal["rationale"] = (
        f"Re-probing the neighbourhood of the current best run with a {probe_type}: {change_phrase}. "
        f"Predicted yield {proposal['predicted_yield']:.1f}% ({yield_delta:+.1f} points) at score "
        f"{proposal['score']:.1f} ({score_delta:+.1f}); {proposal['reason']}"
    )
    proposal["hypothesis"] = (
        f"The yield surface around {narrator.describe_experiment(centre)} is not yet flat; "
        f"the proposed set-point should confirm whether the optimum is sharp or broad."
    )
    return proposal


def _diff(left: dict, right: dict) -> List[dict]:
    changed: List[dict] = []
    for key in NUMERIC_KEYS:
        if abs(float(left[key]) - float(right[key])) > 1e-9:
            changed.append({"variable": key, "from": float(left[key]), "to": float(right[key])})
    if str(left["catalyst"]) != str(right["catalyst"]):
        changed.append({"variable": "catalyst", "from": str(left["catalyst"]), "to": str(right["catalyst"])})
    return changed


def supported_features() -> List[dict]:
    """Design-space description for the API and the UI parameter controls."""
    return [
        {
            "name": "temperature",
            "unit": "degC",
            "min": RANGES["temperature"][0],
            "max": RANGES["temperature"][1],
            "levels": [float(value) for value in FEATURE_LEVELS["temperature"]],
        },
        {
            "name": "pressure",
            "unit": "bar",
            "min": RANGES["pressure"][0],
            "max": RANGES["pressure"][1],
            "levels": [float(value) for value in FEATURE_LEVELS["pressure"]],
        },
        {
            "name": "catalyst",
            "unit": "",
            "options": CATALYSTS,
        },
        {
            "name": "concentration",
            "unit": "M",
            "min": RANGES["concentration"][0],
            "max": RANGES["concentration"][1],
            "levels": [float(value) for value in FEATURE_LEVELS["concentration"]],
        },
        {
            "name": "reaction_time",
            "unit": "min",
            "min": RANGES["reaction_time"][0],
            "max": RANGES["reaction_time"][1],
            "levels": [float(value) for value in FEATURE_LEVELS["reaction_time"]],
        },
    ]
