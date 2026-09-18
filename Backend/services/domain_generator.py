"""
Domain-aware candidate experiment generator.

Generates candidates for any domain using the trained model and objective scoring.
"""

from __future__ import annotations

import hashlib
from pathlib import Path
from typing import Any, Dict, List, Sequence

import numpy as np

from config import settings
from services import narrator
from services.model_registry import MODEL_PATHS, model_registry
from services.domain_scoring import Objective, parse_objective, score_experiment

NUMERIC_KEYS_MAP = {
    "reaction_yield": ["temperature", "pressure", "concentration", "reaction_time"],
    "solar_efficiency": ["cell_thickness_nm", "doping_concentration", "annealing_temperature_c", "light_intensity_lux", "operating_temperature_c"],
    "plant_growth": ["light_intensity_lux", "co2_concentration_ppm", "nutrient_concentration_mm", "temperature_c", "water_supply_ml_day"],
    "battery_performance": ["electrolyte_concentration_m", "charging_rate_c", "operating_temperature_c", "discharge_rate_c", "cycle_count"],
    "water_purification": ["coagulant_dose_mg_l", "ph", "contact_time_min", "temperature_c", "mixing_speed_rpm"],
}

# Discrete levels for each domain's numeric features
LEVELS_MAP = {
    "reaction_yield": {
        "temperature": np.arange(40.0, 160.0 + 1e-9, 5.0),
        "pressure": np.arange(1.0, 10.0 + 1e-9, 0.5),
        "concentration": np.round(np.arange(0.05, 0.50 + 1e-9, 0.01), 2),
        "reaction_time": np.arange(5.0, 180.0 + 1e-9, 5.0),
    },
    "solar_efficiency": {
        "cell_thickness_nm": np.arange(50.0, 300.0 + 1e-9, 10.0),
        "doping_concentration": np.logspace(15.0, 18.0, 30),
        "annealing_temperature_c": np.arange(500.0, 900.0 + 1e-9, 25.0),
        "light_intensity_lux": np.arange(20000.0, 120000.0 + 1e-9, 10000.0),
        "operating_temperature_c": np.arange(15.0, 75.0 + 1e-9, 5.0),
    },
    "plant_growth": {
        "light_intensity_lux": np.arange(5000.0, 80000.0 + 1e-9, 5000.0),
        "co2_concentration_ppm": np.arange(400.0, 1200.0 + 1e-9, 50.0),
        "nutrient_concentration_mm": np.round(np.arange(0.5, 10.0 + 1e-9, 0.5), 1),
        "temperature_c": np.arange(15.0, 40.0 + 1e-9, 1.0),
        "water_supply_ml_day": np.arange(50.0, 500.0 + 1e-9, 25.0),
    },
    "battery_performance": {
        "electrolyte_concentration_m": np.round(np.arange(0.5, 2.5 + 1e-9, 0.1), 1),
        "charging_rate_c": np.round(np.arange(0.2, 3.0 + 1e-9, 0.1), 1),
        "operating_temperature_c": np.arange(0.0, 50.0 + 1e-9, 2.0),
        "discharge_rate_c": np.round(np.arange(0.2, 3.0 + 1e-9, 0.1), 1),
        "cycle_count": np.arange(10.0, 500.0 + 1e-9, 25.0),
    },
    "water_purification": {
        "coagulant_dose_mg_l": np.arange(5.0, 100.0 + 1e-9, 5.0),
        "ph": np.round(np.arange(4.0, 10.0 + 1e-9, 0.5), 1),
        "contact_time_min": np.arange(5.0, 120.0 + 1e-9, 5.0),
        "temperature_c": np.arange(5.0, 40.0 + 1e-9, 2.0),
        "mixing_speed_rpm": np.arange(50.0, 300.0 + 1e-9, 10.0),
    },
}

SAFE_ENVELOPE_MAP = {
    "reaction_yield": {
        "temperature": (60.0, 140.0),
        "pressure": (1.0, 8.0),
        "concentration": (0.08, 0.42),
        "reaction_time": (10.0, 150.0),
    },
    "solar_efficiency": {
        "cell_thickness_nm": (80.0, 250.0),
        "doping_concentration": (5.0e15, 5.0e17),
        "annealing_temperature_c": (600.0, 800.0),
        "light_intensity_lux": (30000.0, 100000.0),
        "operating_temperature_c": (20.0, 55.0),
    },
    "plant_growth": {
        "light_intensity_lux": (10000.0, 60000.0),
        "co2_concentration_ppm": (600.0, 1000.0),
        "nutrient_concentration_mm": (1.0, 8.0),
        "temperature_c": (20.0, 32.0),
        "water_supply_ml_day": (80.0, 400.0),
    },
    "battery_performance": {
        "electrolyte_concentration_m": (0.8, 2.0),
        "charging_rate_c": (0.3, 1.5),
        "operating_temperature_c": (10.0, 35.0),
        "discharge_rate_c": (0.3, 1.5),
        "cycle_count": (20.0, 300.0),
    },
    "water_purification": {
        "coagulant_dose_mg_l": (15.0, 80.0),
        "ph": (5.5, 8.5),
        "contact_time_min": (10.0, 90.0),
        "temperature_c": (10.0, 30.0),
        "mixing_speed_rpm": (80.0, 200.0),
    },
}

RANGES_MAP = {
    "reaction_yield": {
        "temperature": (40.0, 160.0),
        "pressure": (1.0, 10.0),
        "concentration": (0.05, 0.50),
        "reaction_time": (5.0, 180.0),
    },
    "solar_efficiency": {
        "cell_thickness_nm": (50.0, 300.0),
        "doping_concentration": (1.0e15, 1.0e18),
        "annealing_temperature_c": (500.0, 900.0),
        "light_intensity_lux": (20000.0, 120000.0),
        "operating_temperature_c": (15.0, 75.0),
    },
    "plant_growth": {
        "light_intensity_lux": (5000.0, 80000.0),
        "co2_concentration_ppm": (400.0, 1200.0),
        "nutrient_concentration_mm": (0.5, 10.0),
        "temperature_c": (15.0, 40.0),
        "water_supply_ml_day": (50.0, 500.0),
    },
    "battery_performance": {
        "electrolyte_concentration_m": (0.5, 2.5),
        "charging_rate_c": (0.2, 3.0),
        "operating_temperature_c": (0.0, 50.0),
        "discharge_rate_c": (0.2, 3.0),
        "cycle_count": (10.0, 500.0),
    },
    "water_purification": {
        "coagulant_dose_mg_l": (5.0, 100.0),
        "ph": (4.0, 10.0),
        "contact_time_min": (5.0, 120.0),
        "temperature_c": (5.0, 40.0),
        "mixing_speed_rpm": (50.0, 300.0),
    },
}


def _seed_from(*parts: object) -> int:
    payload = "|".join(str(part) for part in parts)
    return int(hashlib.sha256(payload.encode("utf-8")).hexdigest()[:8], 16)


def _level_index(key: str, value: float, domain: str) -> int:
    levels = LEVELS_MAP[domain][key]
    return int(np.argmin(np.abs(levels - float(value))))


def _snap(key: str, value: float, domain: str) -> float:
    levels = LEVELS_MAP[domain][key]
    snapped = float(levels[_level_index(key, value, domain)])
    low, high = RANGES_MAP[domain][key]
    return float(min(max(snapped, low), high))


def _normalise_params(params: dict, domain: str) -> dict:
    numeric_keys = NUMERIC_KEYS_MAP[domain]
    return {key: _snap(key, params[key], domain) for key in numeric_keys}


def _key(params: dict, domain: str) -> tuple:
    numeric_keys = NUMERIC_KEYS_MAP[domain]
    return tuple([round(float(params[name]), 4) for name in numeric_keys])


def _dedupe(candidates: Sequence[dict], domain: str) -> List[dict]:
    seen: set[tuple] = set()
    unique: List[dict] = []
    for candidate in candidates:
        key = _key(candidate, domain)
        if key in seen:
            continue
        seen.add(key)
        unique.append(candidate)
    return unique


def _dedupe_records(records: Sequence[dict], domain: str) -> List[dict]:
    seen: set[tuple] = set()
    unique: List[dict] = []
    for record in records:
        key = _key(record["params"], domain)
        if key in seen:
            continue
        seen.add(key)
        unique.append(record)
    return unique


def _distance(left: dict, right: dict, domain: str) -> float:
    numeric_keys = NUMERIC_KEYS_MAP[domain]
    values = []
    for name in numeric_keys:
        low, high = RANGES_MAP[domain][name]
        norm_left = (float(left[name]) - low) / (high - low) if high > low else 0
        norm_right = (float(right[name]) - low) / (high - low) if high > low else 0
        values.append(norm_left - norm_right)
    return float(np.sqrt(np.sum(np.array(values)**2)) / np.sqrt(len(values)))


def _violates_constraints(params: dict, objective: Objective, domain: str) -> bool:
    for key, ceiling in objective.constraints.items():
        if key in params and float(params[key]) > float(ceiling):
            return True
    return False


def _sample_pool(rng: np.random.Generator, size: int, domain: str) -> List[dict]:
    """Stratified random sample over the discrete protocol levels."""
    numeric_keys = NUMERIC_KEYS_MAP[domain]
    columns = {
        key: LEVELS_MAP[domain][key][rng.integers(0, len(LEVELS_MAP[domain][key]), size=size)]
        for key in numeric_keys
    }

    return [
        {key: float(columns[key][index]) for key in numeric_keys}
        for index in range(size)
    ]


def _refine(centre: dict, rng: np.random.Generator, size: int, spread: float, domain: str) -> List[dict]:
    """Sample the neighbourhood of centre on the discrete level grid."""
    samples: List[dict] = []
    numeric_keys = NUMERIC_KEYS_MAP[domain]
    for _ in range(size):
        candidate = {}
        for key in numeric_keys:
            levels = LEVELS_MAP[domain][key]
            index = _level_index(key, centre[key], domain)
            jitter = int(round(rng.normal(0.0, spread)))
            index = int(np.clip(index + jitter, 0, len(levels) - 1))
            candidate[key] = float(levels[index])
        samples.append(candidate)
    return samples


def _predict_and_score(candidates: Sequence[dict], objective: Objective, domain: str) -> List[dict]:
    """Run the model and the scorer over a batch of candidates."""
    predictions = model_registry.predict(domain, list(candidates))
    records: List[dict] = []
    for params, prediction in zip(candidates, predictions):
        scored = score_experiment(params, prediction, objective, domain)
        records.append({
            "params": params,
            "prediction": prediction,
            "scored": scored,
        })
    return records


def _select_diverse(records: Sequence[dict], count: int, domain: str) -> List[dict]:
    """Greedy max-score-with-diversity selection."""
    ordered = sorted(records, key=lambda item: item["scored"]["score"], reverse=True)
    if len(ordered) <= count:
        return ordered

    for min_distance in (0.20, 0.15, 0.10, 0.05):
        selected: List[dict] = []
        for record in ordered:
            if len(selected) >= count:
                break
            if all(_distance(record["params"], other["params"], domain) >= min_distance for other in selected):
                selected.append(record)
        if len(selected) >= count:
            return selected

    return ordered[:count]


def _flatten(index: int, record: dict, objective: Objective, domain: str, origin: str, with_rationale: bool = True) -> dict:
    """Flatten a record into the API response format."""
    params = record["params"]
    prediction = record["prediction"]
    scored = record["scored"]

    numeric_keys = NUMERIC_KEYS_MAP[domain]
    prediction_key = _get_prediction_key(domain)

    experiment = {
        "id": f"{domain.upper()}-EXP-{index:03d}",
        "domain": domain,
        "rank": index,
        **params,
        prediction_key: prediction[prediction_key],
        "predicted_yield": float(prediction[prediction_key]),
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
        "origin": origin,
    }
    if with_rationale:
        experiment["rationale"] = narrator.experiment_rationale(experiment, scored, objective, index, domain)
    return experiment


def _get_prediction_key(domain: str) -> str:
    """Get the prediction key for a domain."""
    keys = {
        "reaction_yield": "predicted_yield",
        "solar_efficiency": "predicted_efficiency",
        "plant_growth": "predicted_biomass_yield",
        "battery_performance": "predicted_capacity_retention",
        "water_purification": "predicted_turbidity_removal",
    }
    return keys.get(domain, "predicted_value")


def _get_target_key(domain: str) -> str:
    """Get the target feature key for a domain."""
    return _get_prediction_key(domain).replace("predicted_", "")


def generate_experiments(
    domain: str,
    objective_text: str,
    num_experiments: int | None = None,
    constraints: Dict[str, float] | None = None,
    *,
    pool_size: int | None = None,
    with_rationale: bool = True,
) -> dict:
    """Generate the shortlist of candidate experiments for a research objective."""

    if domain not in NUMERIC_KEYS_MAP:
        raise ValueError(f"Unknown domain: {domain}")

    objective = parse_objective(objective_text, constraints, domain)
    count = int(num_experiments or settings.default_num_experiments)
    if count < 1:
        raise ValueError("num_experiments must be >= 1")
    if count > 20:
        raise ValueError("num_experiments is capped at 20 for the MVP")

    pool_size = int(pool_size or settings.search_grid_size)
    rng = np.random.default_rng(_seed_from(domain, objective.text, count, sorted(objective.constraints)))

    # 1) Explore
    pool = [c for c in _sample_pool(rng, pool_size, domain) if not _violates_constraints(c, objective, domain)]
    if not pool:
        raise ValueError("no candidates satisfy the requested constraints")
    pool = _dedupe(pool, domain)
    records = _predict_and_score(pool, objective, domain)
    best = max(records, key=lambda item: item["scored"]["score"])
    search_trace = [{
        "stage": "explore",
        "candidates": len(pool),
        "best_score": round(best["scored"]["score"], 2),
        "best_prediction": best["prediction"][_get_prediction_key(domain)],
    }]

    # 2) Refine (two shrinking radii)
    refined: List[dict] = []
    centre = best["params"]
    for spread, size in ((3.0, max(pool_size // 2, 150)), (1.2, max(pool_size // 4, 80))):
        batch = [c for c in _refine(centre, rng, size, spread, domain) if not _violates_constraints(c, objective, domain)]
        if not batch:
            continue
        batch = _dedupe(batch, domain)
        batch_records = _predict_and_score(batch, objective, domain)
        stage_best = max(batch_records, key=lambda item: item["scored"]["score"])
        if stage_best["scored"]["score"] > best["scored"]["score"]:
            best = stage_best
            centre = stage_best["params"]
        refined.extend(batch_records)
        search_trace.append({
            "stage": f"refine(sd={spread})",
            "candidates": len(batch),
            "best_score": round(best["scored"]["score"], 2),
            "best_prediction": best["prediction"][_get_prediction_key(domain)],
        })

    # 3) Diversify + shortlist
    refined_keys = {_key(record["params"], domain) for record in refined}
    combined = _dedupe_records(records + refined, domain)
    shortlist = _select_diverse(combined, count, domain)
    experiments = [
        _flatten(
            index,
            record,
            objective,
            domain,
            "refined" if _key(record["params"], domain) in refined_keys else "explore",
            with_rationale=with_rationale,
        )
        for index, record in enumerate(shortlist, start=1)
    ]

    metadata = model_registry.metadata(domain)

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
            "type": metadata.get("model_type"),
            "domain": domain,
            "domain_label": metadata.get("domain_label"),
            "target": metadata.get("target"),
            "target_unit": metadata.get("target_unit", ""),
            "metrics": model_registry.metrics(domain),
            "dataset_provenance": metadata.get("dataset_provenance"),
        },
        "disclaimer": (
            "Candidate experiments are machine-generated hypotheses ranked by a model trained on "
            "SIMULATED prototype data. They are suggestions for a lab to test, not validated results."
        ),
    }


def suggest_next_experiment(
    domain: str,
    best_experiment: dict,
    objective_text: str,
    constraints: Dict[str, float] | None = None,
    *,
    size: int = 300,
) -> dict:
    """Propose the single follow-up experiment."""
    objective = parse_objective(objective_text, constraints, domain)
    centre = _normalise_params(best_experiment, domain)

    rng = np.random.default_rng(_seed_from("next", _key(centre, domain), objective.text, domain))
    batch = [c for c in _refine(centre, rng, size, 2.2, domain) if not _violates_constraints(c, objective, domain)]
    if not batch:
        raise ValueError("could not propose a follow-up experiment inside the given constraints")

    batch = [c for c in _dedupe(batch, domain) if _key(c, domain) != _key(centre, domain)]
    if not batch:
        raise ValueError("follow-up search produced no distinct neighbour")

    records = _predict_and_score(batch, objective, domain)
    chosen = max(records, key=lambda item: item["scored"]["score"])

    baseline_prediction = model_registry.predict_one(domain, centre)
    baseline_score = score_experiment(centre, baseline_prediction, objective, domain)

    changed = _diff(centre, chosen["params"], domain)

    score_delta = round(chosen["scored"]["score"] - baseline_score["score"], 2)
    pred_key = _get_prediction_key(domain)
    yield_delta = round(chosen["prediction"][pred_key] - baseline_prediction[pred_key], 2)
    probe_type = "local refinement" if len(changed) <= 2 else "exploratory probe"

    proposal = _flatten(0, chosen, objective, domain, "next_probe", with_rationale=False)
    proposal["id"] = "NEXT-01"
    proposal["rank"] = 1
    proposal["probe_type"] = probe_type
    proposal["changed_variables"] = changed
    proposal["score_delta"] = score_delta
    proposal["yield_delta"] = yield_delta
    proposal["predicted_yield"] = proposal[pred_key]

    change_phrase = ", ".join(_format_change(item) for item in changed) or "no material change"
    proposal["rationale"] = (
        f"Re-probing the neighbourhood of the current best run with a {probe_type}: {change_phrase}. "
        f"Predicted {_get_target_key(domain)} {proposal[pred_key]:.1f} ({yield_delta:+.1f} points) at score "
        f"{proposal['score']:.1f} ({score_delta:+.1f}); {proposal['reason']}"
    )
    proposal["hypothesis"] = (
        f"The {_get_target_key(domain)} surface around the current best is not yet flat; "
        f"the proposed set-point should confirm whether the optimum is sharp or broad."
    )
    return proposal


def _diff(left: dict, right: dict, domain: str) -> List[dict]:
    """Return changed variables between two param sets."""
    changed: List[dict] = []
    for key in NUMERIC_KEYS_MAP[domain]:
        if abs(float(left[key]) - float(right[key])) > 1e-9:
            changed.append({"variable": key, "from": float(left[key]), "to": float(right[key])})
    return changed


def _format_change(item: dict) -> str:
    """Format a changed variable for display."""
    return f"{item['variable']} {item['from']:g} → {item['to']:g}"


def supported_features(domain: str) -> List[dict]:
    """Design-space description for the API and UI parameter controls."""
    if domain not in RANGES_MAP:
        return []

    numeric_keys = NUMERIC_KEYS_MAP[domain]
    features = []

    for name in numeric_keys:
        meta = {
            "name": name,
            "unit": _get_unit(name, domain),
            "min": RANGES_MAP[domain][name][0],
            "max": RANGES_MAP[domain][name][1],
            "comfortable_window": list(SAFE_ENVELOPE_MAP[domain].get(name, RANGES_MAP[domain][name])),
            "levels": [float(v) for v in LEVELS_MAP[domain][name]],
        }
        features.append(meta)

    return features


def _get_unit(feature: str, domain: str) -> str:
    """Get unit for a feature."""
    unit_maps = {
        "reaction_yield": {"temperature": "degC", "pressure": "bar", "concentration": "M", "reaction_time": "min"},
        "solar_efficiency": {"cell_thickness_nm": "nm", "doping_concentration": "cm^-3", "annealing_temperature_c": "degC", "light_intensity_lux": "lux", "operating_temperature_c": "degC"},
        "plant_growth": {"light_intensity_lux": "lux", "co2_concentration_ppm": "ppm", "nutrient_concentration_mm": "mM", "temperature_c": "degC", "water_supply_ml_day": "ml/day"},
        "battery_performance": {"electrolyte_concentration_m": "M", "charging_rate_c": "C", "operating_temperature_c": "degC", "discharge_rate_c": "C", "cycle_count": "cycles"},
        "water_purification": {"coagulant_dose_mg_l": "mg/L", "ph": "", "contact_time_min": "min", "temperature_c": "degC", "mixing_speed_rpm": "rpm"},
    }
    return unit_maps.get(domain, {}).get(feature, "")


def get_domain_config(domain: str) -> dict:
    """Get complete domain configuration for frontend."""
    if domain not in RANGES_MAP:
        return {}

    numeric_keys = NUMERIC_KEYS_MAP[domain]
    from services.model_registry import model_registry

    metadata = {}
    try:
        metadata = model_registry.metadata(domain)
    except Exception:
        pass

    return {
        "domain": domain,
        "domain_label": metadata.get("domain_label", domain),
        "target": metadata.get("target", _get_target_key(domain)),
        "target_unit": metadata.get("target_unit", ""),
        "target_description": metadata.get("target_description", ""),
        "features": numeric_keys,
        "feature_labels": _get_feature_labels(domain),
        "units": {k: _get_unit(k, domain) for k in numeric_keys},
        "ranges": {k: list(RANGES_MAP[domain][k]) for k in numeric_keys},
        "safe_envelope": {k: list(SAFE_ENVELOPE_MAP[domain].get(k, RANGES_MAP[domain][k])) for k in numeric_keys},
        "model_status": model_registry.all_status().get(domain, {}),
        "has_model": model_registry.is_loaded(domain) or MODEL_PATHS_PRESENT[domain],
    }


MODEL_PATHS_PRESENT = {
    domain: path.exists() for domain, path in MODEL_PATHS.items()
}


def _get_feature_labels(domain: str) -> dict:
    """Get human-readable feature labels."""
    labels_map = {
        "reaction_yield": {
            "temperature": "Temperature",
            "pressure": "Pressure",
            "catalyst": "Catalyst",
            "concentration": "Concentration",
            "reaction_time": "Reaction Time",
        },
        "solar_efficiency": {
            "cell_thickness_nm": "Cell Thickness",
            "doping_concentration": "Doping Concentration",
            "annealing_temperature_c": "Annealing Temperature",
            "light_intensity_lux": "Light Intensity",
            "operating_temperature_c": "Operating Temperature",
        },
        "plant_growth": {
            "light_intensity_lux": "Light Intensity",
            "co2_concentration_ppm": "CO₂ Concentration",
            "nutrient_concentration_mm": "Nutrient Concentration",
            "temperature_c": "Temperature",
            "water_supply_ml_day": "Water Supply",
        },
        "battery_performance": {
            "electrolyte_concentration_m": "Electrolyte Concentration",
            "charging_rate_c": "Charging Rate",
            "operating_temperature_c": "Operating Temperature",
            "discharge_rate_c": "Discharge Rate",
            "cycle_count": "Cycle Count",
        },
        "water_purification": {
            "coagulant_dose_mg_l": "Coagulant Dose",
            "ph": "pH",
            "contact_time_min": "Contact Time",
            "temperature_c": "Temperature",
            "mixing_speed_rpm": "Mixing Speed",
        },
    }
    return labels_map.get(domain, {})
