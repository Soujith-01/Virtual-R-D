"""
Domain-aware scoring and ranking for multi-domain experiment system.

Extends the scoring logic to work with any domain.
"""

from __future__ import annotations

from dataclasses import dataclass, field
from typing import Dict, List, Sequence

from services.model_registry import model_registry

# Import domain configs
from domain import RANGES as REACTION_RANGES, SAFE_ENVELOPE as REACTION_SAFE
from solar_domain import RANGES as SOLAR_RANGES, SAFE_ENVELOPE as SOLAR_SAFE
from plant_domain import RANGES as PLANT_RANGES, SAFE_ENVELOPE as PLANT_SAFE
from battery_domain import RANGES as BATTERY_RANGES, SAFE_ENVELOPE as BATTERY_SAFE
from water_domain import RANGES as WATER_RANGES, SAFE_ENVELOPE as WATER_SAFE

DOMAIN_RANGES = {
    "reaction_yield": REACTION_RANGES,
    "solar_efficiency": SOLAR_RANGES,
    "plant_growth": PLANT_RANGES,
    "battery_performance": BATTERY_RANGES,
    "water_purification": WATER_RANGES,
}

DOMAIN_SAFE = {
    "reaction_yield": REACTION_SAFE,
    "solar_efficiency": SOLAR_SAFE,
    "plant_growth": PLANT_SAFE,
    "battery_performance": BATTERY_SAFE,
    "water_purification": WATER_SAFE,
}

DOMAIN_UNITS = {
    "reaction_yield": {"temperature": "degC", "pressure": "bar", "concentration": "M", "reaction_time": "min", "yield": "%"},
    "solar_efficiency": {"cell_thickness_nm": "nm", "doping_concentration": "cm^-3", "annealing_temperature_c": "degC", "light_intensity_lux": "lux", "operating_temperature_c": "degC", "energy_conversion_efficiency": "%"},
    "plant_growth": {"light_intensity_lux": "lux", "co2_concentration_ppm": "ppm", "nutrient_concentration_mm": "mM", "temperature_c": "degC", "water_supply_ml_day": "ml/day", "biomass_yield": "g"},
    "battery_performance": {"electrolyte_concentration_m": "M", "charging_rate_c": "C", "operating_temperature_c": "degC", "discharge_rate_c": "C", "cycle_count": "cycles", "capacity_retention_percent": "%"},
    "water_purification": {"coagulant_dose_mg_l": "mg/L", "ph": "", "contact_time_min": "min", "temperature_c": "degC", "mixing_speed_rpm": "rpm", "turbidity_removal_percent": "%"},
}


def _clamp(value: float, low: float, high: float) -> float:
    return float(min(max(value, low), high))


def domain_normalise(value: float, feature: str, domain: str) -> float:
    """Map a feature value into [0, 1] using the domain's ranges."""
    ranges = DOMAIN_RANGES.get(domain, {})
    if feature not in ranges:
        return 0.5
    low, high = ranges[feature]
    return _clamp((float(value) - low) / (high - low), 0.0, 1.0)


def domain_in_safe_envelope(experiment: dict, domain: str) -> bool:
    """True when every knob sits inside the comfortable operating window."""
    safe = DOMAIN_SAFE.get(domain, {})
    for name, (low, high) in safe.items():
        if name in experiment:
            if not (low <= float(experiment[name]) <= high):
                return False
    return True


def domain_envelope_violations(experiment: dict, domain: str) -> List[str]:
    """Human-readable list of operating-window breaches."""
    problems: List[str] = []
    safe = DOMAIN_SAFE.get(domain, {})
    for name, (low, high) in safe.items():
        if name in experiment:
            value = float(experiment[name])
            if value < low:
                problems.append(f"{name} below comfortable window ({value:g} < {low:g})")
            elif value > high:
                problems.append(f"{name} above comfortable window ({value:g} > {high:g})")
    return problems


# Objective parsing with domain awareness
PRIORITY_KEYWORDS: Dict[str, Sequence[str]] = {
    "maximize_yield": (
        "yield", "maximize yield", "maximise yield", "increase yield", "conversion",
        "efficiency", "maximize efficiency", "maximise efficiency",
        "biomass", "maximize biomass", "maximise biomass",
        "retention", "maximize retention", "maximise retention",
        "removal", "maximize removal", "maximise removal",
    ),
    "minimize_time": (
        "time", "fast", "fastest", "quick", "short", "duration", "minutes",
        "throughput", "contact time", "reaction time",
    ),
    "minimize_temperature": (
        "temperature", "temp", "mild", "energy", "heating", "cooler", "lower heat",
        "operating temperature",
    ),
    "minimize_pressure": ("pressure", "bar", "atmospheric"),
    "minimize_cost": ("cost", "cheap", "economic", "budget", "expensive", "resource"),
    "minimize_risk": ("risk", "safe", "safety", "robust", "stable", "reproducib"),
    "minimize_water": ("water", "minimize water", "minimise water", "water usage", "water consumption"),
    "minimize_charging": ("charging", "charge rate", "charging rate", "charging time"),
    "minimize_coagulant": ("coagulant", "chemical", "minimize chemical", "minimise chemical"),
}

BASE_WEIGHTS: Dict[str, float] = {
    "yield": 1.00,
    "time": 0.70,
    "temperature": 0.40,
    "pressure": 0.30,
    "risk": 0.60,
    "water": 0.50,
    "charging": 0.50,
    "coagulant": 0.50,
}

PRIORITY_MULTIPLIERS: Dict[str, Dict[str, float]] = {
    "maximize_yield": {"yield": 1.60},
    "minimize_time": {"time": 2.40},
    "minimize_temperature": {"temperature": 2.60},
    "minimize_pressure": {"pressure": 2.80},
    "minimize_cost": {"pressure": 1.60, "time": 1.40, "temperature": 1.50},
    "minimize_risk": {"risk": 1.80},
    "minimize_water": {"water": 2.50},
    "minimize_charging": {"charging": 2.50},
    "minimize_coagulant": {"coagulant": 2.50},
}

PRIORITY_DESCRIPTIONS: Dict[str, str] = {
    "maximize_yield": "maximise predicted target",
    "minimize_time": "shorten duration/contact time",
    "minimize_temperature": "reduce operating temperature",
    "minimize_pressure": "operate at lower pressure",
    "minimize_cost": "reduce overall resource intensity",
    "minimize_risk": "prefer robust, comfortable conditions",
    "minimize_water": "reduce water consumption",
    "minimize_charging": "reduce charging rate/stress",
    "minimize_coagulant": "reduce chemical/coagulant usage",
}

DOMAIN_PRIORITY_MAPPING = {
    "solar_efficiency": {
        "minimize_temperature": ["temperature"],
        "maximize_yield": ["yield"],
        "minimize_time": ["time"],
    },
    "plant_growth": {
        "maximize_yield": ["yield"],
        "minimize_time": ["time"],
        "minimize_water": ["water"],
        "minimize_temperature": ["temperature"],
    },
    "battery_performance": {
        "maximize_yield": ["yield"],
        "minimize_time": ["time"],
        "minimize_charging": ["charging"],
        "minimize_temperature": ["temperature"],
    },
    "water_purification": {
        "maximize_yield": ["yield"],
        "minimize_time": ["time"],
        "minimize_coagulant": ["coagulant"],
        "minimize_temperature": ["temperature"],
    },
    "reaction_yield": {
        "maximize_yield": ["yield"],
        "minimize_time": ["time"],
        "minimize_temperature": ["temperature"],
        "minimize_pressure": ["pressure"],
        "minimize_risk": ["risk"],
    },
}


def parse_objective(text: str, constraints: Dict[str, float] | None = None, domain: str = "reaction_yield") -> "Objective":
    """Turn free text into explicit priorities and scoring weights."""
    text = (text or "").strip()
    if not text:
        raise ValueError("research objective must not be empty")

    haystack = text.lower()
    priorities: List[str] = []

    for priority, keywords in PRIORITY_KEYWORDS.items():
        if any(keyword in haystack for keyword in keywords):
            priorities.append(priority)

    if not priorities:
        priorities = ["maximize_yield"]

    weights = dict(BASE_WEIGHTS)
    for priority in priorities:
        for component, multiplier in PRIORITY_MULTIPLIERS.get(priority, {}).items():
            weights[component] = weights.get(component, 1.0) * multiplier

    total = sum(weights.values()) or 1.0
    weights = {key: value / total for key, value in weights.items()}

    objective = Objective(
        text=text,
        priorities=priorities,
        weights={key: round(value, 4) for key, value in weights.items()},
        constraints=dict(constraints or {}),
        notes=[],
    )
    objective.notes = [PRIORITY_DESCRIPTIONS[priority] for priority in priorities]
    if objective.constraints:
        objective.notes.append(
            "hard constraints: " + ", ".join(f"{key} <= {value:g}" for key, value in objective.constraints.items())
        )
    return objective


@dataclass
class Objective:
    text: str
    priorities: List[str] = field(default_factory=list)
    weights: Dict[str, float] = field(default_factory=dict)
    constraints: Dict[str, float] = field(default_factory=dict)
    notes: List[str] = field(default_factory=list)

    def as_dict(self) -> dict:
        return {
            "text": self.text,
            "priorities": self.priorities,
            "notes": self.notes,
            "weights": {key: round(value, 4) for key, value in self.weights.items()},
            "constraints": self.constraints,
        }


def identify_variables(objective: Objective, domain: str) -> List[dict]:
    """Identify which variables the objective is optimizing."""
    mapping: Dict[str, List[tuple]] = {
        "maximize_yield": [("target", "maximise", "predicted target", DOMAIN_UNITS.get(domain, {}).get("target", "%"))],
        "minimize_time": [
            ("reaction_time", "minimise", "reaction time", "min"),
            ("contact_time_min", "minimise", "contact time", "min"),
        ],
        "minimize_temperature": [("temperature", "minimise", "operating temperature", "degC")],
        "minimize_pressure": [("pressure", "minimise", "operating pressure", "bar")],
        "minimize_cost": [("pressure", "minimise", "pressure (cost driver)", "bar")],
        "minimize_risk": [("temperature", "cap", "temperature (risk driver)", "degC")],
        "minimize_water": [("water_supply_ml_day", "minimise", "water supply", "ml/day")],
        "minimize_charging": [("charging_rate_c", "minimise", "charging rate", "C")],
        "minimize_coagulant": [("coagulant_dose_mg_l", "minimise", "coagulant dose", "mg/L")],
    }

    seen: set[str] = set()
    variables: List[dict] = []

    domain_priorities = DOMAIN_PRIORITY_MAPPING.get(domain, {})
    for priority in objective.priorities:
        for name, role, description, unit in mapping.get(priority, []):
            if name in seen:
                continue
            seen.add(name)
            variables.append({
                "variable": name,
                "role": role,
                "description": description,
                "unit": unit,
                "optimal_range": list(DOMAIN_RANGES.get(domain, {}).get(name, [0, 100])),
            })

    return variables


def assess_risk(experiment: dict, prediction: dict, domain: str) -> dict:
    """Heuristic safety/robustness penalty (0-100)."""
    factors: List[str] = []
    penalty = 0.0

    uncertainty = float(prediction.get("uncertainty_std", 0.0))
    uncertainty_penalty = min(uncertainty * 2.5, 25.0)
    if uncertainty_penalty > 3.0:
        factors.append(f"model disagreement across trees (sd {uncertainty:.1f}%)")
    penalty += uncertainty_penalty

    violations = domain_envelope_violations(experiment, domain)
    if violations:
        penalty += min(12.0 * len(violations), 30.0)
        factors.extend(violations)

    ranges = DOMAIN_RANGES.get(domain, {})
    for name, (low, high) in ranges.items():
        if name in experiment:
            value = float(experiment[name])
            mid = (low + high) / 2
            extreme_threshold = high * 0.9 if high > 0 else 90
            if value > extreme_threshold:
                penalty += 10.0
                factors.append(f"extreme {name} ({value:g} near upper limit {high:g})")

    target_key = _get_prediction_key(domain)
    yield_value = float(prediction.get(target_key, 0.0))

    ranges_meta = {
        "reaction_yield": (30, 100),
        "solar_efficiency": (8, 23),
        "plant_growth": (10, 180),
        "battery_performance": (40, 98),
        "water_purification": (30, 97),
    }
    low, high = ranges_meta.get(domain, (0, 100))
    if yield_value < low + (high - low) * 0.2:
        penalty += 8.0
        factors.append(f"low-{target_key.replace('predicted_', '')} region (predicted {yield_value:.1f}) - limited information gain")

    penalty = float(min(penalty, 100.0))

    if penalty < 15.0:
        level = "low"
    elif penalty < 35.0:
        level = "moderate"
    else:
        level = "high"

    return {
        "level": level,
        "score": round(penalty, 2),
        "factors": factors or ["within the comfortable operating window"],
    }


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


def _get_target_description(domain: str) -> str:
    """Get human-readable target description."""
    descriptions = {
        "reaction_yield": "yield",
        "solar_efficiency": "energy conversion efficiency",
        "plant_growth": "biomass yield",
        "battery_performance": "capacity retention",
        "water_purification": "turbidity removal",
    }
    return descriptions.get(domain, "target value")


def component_scores(experiment: dict, prediction: dict, objective: Objective, domain: str) -> Dict[str, float]:
    """Raw 0-100 component scores (all 'higher is better')."""
    risk = assess_risk(experiment, prediction, domain)
    target_key = _get_prediction_key(domain)

    scores: Dict[str, float] = {}

    if "yield" in objective.weights:
        scores["yield"] = round(float(prediction.get(target_key, 0.0)), 2)

    for time_key in ["reaction_time", "contact_time_min"]:
        if time_key in experiment and "time" in objective.weights:
            scores["time"] = round(100.0 * (1.0 - domain_normalise(experiment[time_key], time_key, domain)), 2)
            break

    if "temperature" in objective.weights and "operating_temperature_c" in experiment:
        scores["temperature"] = round(100.0 * (1.0 - domain_normalise(experiment["operating_temperature_c"], "operating_temperature_c", domain)), 2)
    elif "temperature" in objective.weights and "temperature_c" in experiment:
        scores["temperature"] = round(100.0 * (1.0 - domain_normalise(experiment["temperature_c"], "temperature_c", domain)), 2)

    if "pressure" in objective.weights and "pressure" in experiment:
        scores["pressure"] = round(100.0 * (1.0 - domain_normalise(experiment["pressure"], "pressure", domain)), 2)

    if "risk" in objective.weights:
        scores["risk"] = round(100.0 - float(risk["score"]), 2)

    if "water" in objective.weights and "water_supply_ml_day" in experiment:
        scores["water"] = round(100.0 * (1.0 - domain_normalise(experiment["water_supply_ml_day"], "water_supply_ml_day", domain)), 2)

    if "charging" in objective.weights and "charging_rate_c" in experiment:
        scores["charging"] = round(100.0 * (1.0 - domain_normalise(experiment["charging_rate_c"], "charging_rate_c", domain)), 2)

    if "coagulant" in objective.weights and "coagulant_dose_mg_l" in experiment:
        scores["coagulant"] = round(100.0 * (1.0 - domain_normalise(experiment["coagulant_dose_mg_l"], "coagulant_dose_mg_l", domain)), 2)

    return scores


def score_experiment(experiment: dict, prediction: dict, objective: Objective, domain: str = "reaction_yield") -> dict:
    """Score one experiment against the parsed objective."""
    components = component_scores(experiment, prediction, objective, domain)
    weights = objective.weights

    contributions = {
        key: round(weights.get(key, 0.0) * components[key], 2) for key in components
    }
    score = round(float(sum(contributions.values())), 2)
    risk = assess_risk(experiment, prediction, domain)

    flags: List[str] = []
    for key, ceiling in objective.constraints.items():
        if key in experiment and float(experiment[key]) > float(ceiling):
            flags.append(f"{key} violates constraint ({experiment[key]:g} > {ceiling:g})")

    return {
        "score": score,
        "components": components,
        "weights": {key: round(weights.get(key, 0.0), 4) for key in components},
        "contributions": contributions,
        "risk": risk,
        "reason": _reason(experiment, prediction, components, objective, domain),
        "constraint_violations": flags,
        "disclaimer": (
            "Score is a transparent weighted sum of predicted target, efficiency factors, and a heuristic "
            "risk penalty - not a measured process-economics figure."
        ),
    }


def _reason(experiment: dict, prediction: dict, components: Dict[str, float], objective: Objective, domain: str) -> str:
    """Build a human-auditable justification for the score."""
    target_key = _get_prediction_key(domain)
    target_desc = _get_target_description(domain)
    predicted = float(prediction.get(target_key, 0.0))
    uncertainty = float(prediction.get("uncertainty_std", 0.0))

    if predicted >= 85.0:
        yield_phrase = f"high predicted {target_desc} ({predicted:.1f}%)"
    elif predicted >= 70.0:
        yield_phrase = f"solid predicted {target_desc} ({predicted:.1f}%)"
    elif predicted >= 50.0:
        yield_phrase = f"moderate predicted {target_desc} ({predicted:.1f}%)"
    else:
        yield_phrase = f"low predicted {target_desc} ({predicted:.1f}%)"

    driver = max(
        components.keys(),
        key=lambda key: objective.weights.get(key, 0.0) * components.get(key, 0),
    )
    driver_phrase = {
        "yield": f"{target_desc} benefit dominates the objective",
        "time": "time saving drives the score",
        "temperature": "milder conditions drive the score",
        "pressure": "lower pressure drives the score",
        "risk": "robustness drives the score",
        "water": "lower water usage drives the score",
        "charging": "lower charging rate drives the score",
        "coagulant": "lower coagulant dose drives the score",
    }.get(driver, "objective weighting drives the score")

    if not domain_in_safe_envelope(experiment, domain):
        window = "outside"
    else:
        window = "inside"

    if uncertainty <= 2.5:
        uncertainty_phrase = f"model agreement is tight (sd {uncertainty:.1f}%)"
    elif uncertainty <= 5.0:
        uncertainty_phrase = f"model uncertainty is moderate (sd {uncertainty:.1f}%)"
    else:
        uncertainty_phrase = f"model uncertainty is high (sd {uncertainty:.1f}%)"

    return (
        f"{yield_phrase} - {window} the comfortable operating window, and {driver_phrase}. "
        f"Uncertainty proxy: {uncertainty_phrase}."
    )


def score_many(
    experiments: Sequence[dict],
    predictions: Sequence[dict],
    objective: Objective,
    domain: str = "reaction_yield",
) -> List[dict]:
    """Score a batch of experiments against the objective."""
    return [
        score_experiment(experiment, prediction, objective, domain)
        for experiment, prediction in zip(experiments, predictions)
    ]


def rank(scored: Sequence[dict]) -> List[dict]:
    """Return scored experiments ordered best-first."""
    return sorted(scored, key=lambda item: item["score"], reverse=True)
