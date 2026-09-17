"""
Phase 6 - Transparent experiment scoring and ranking.

Design rule: **never rank on predicted yield alone.** Ranking on yield only
picks the slowest, hottest, most expensive run in the design space. The score
here is an explicit weighted sum of interpretable components, and every
component, its weight and the resulting reason string are returned to the
client so the jury can audit the decision.
"""

from __future__ import annotations

from dataclasses import dataclass, field
from typing import Dict, List, Sequence

from domain import (
    CATALYST_PROFILES,
    RANGES,
    SAFE_ENVELOPE,
    envelope_violations,
    normalise,
)

# --------------------------------------------------------------------------- #
# Objective parsing
# --------------------------------------------------------------------------- #

PRIORITY_KEYWORDS: Dict[str, Sequence[str]] = {
    "maximize_yield": ("yield", "maximize yield", "maximise yield", "increase yield", "conversion", "product"),
    "minimize_time": ("time", "fast", "fastest", "quick", "short", "duration", "minutes", "throughput"),
    "minimize_temperature": ("temperature", "temp", "mild", "energy", "heating", "cooler", "lower heat"),
    "minimize_pressure": ("pressure", "bar", "atmospheric"),
    "minimize_cost": ("cost", "cheap", "economic", "budget", "expensive", "resource"),
    "minimize_risk": ("risk", "safe", "safety", "robust", "stable", "reproducib"),
}

#: Baseline weight of each scoring component (before objective adjustments).
BASE_WEIGHTS: Dict[str, float] = {
    "yield": 1.00,
    "time": 0.70,
    "temperature": 0.40,
    "pressure": 0.30,
    "risk": 0.60,
}

#: Objective multipliers applied on top of the baseline weights.
PRIORITY_MULTIPLIERS: Dict[str, Dict[str, float]] = {
    "maximize_yield": {"yield": 1.60},
    "minimize_time": {"time": 2.40},
    "minimize_temperature": {"temperature": 2.60},
    "minimize_pressure": {"pressure": 2.80},
    "minimize_cost": {"pressure": 1.60, "time": 1.40, "temperature": 1.50},
    "minimize_risk": {"risk": 1.80},
}

PRIORITY_DESCRIPTIONS: Dict[str, str] = {
    "maximize_yield": "maximise predicted reaction yield",
    "minimize_time": "shorten reaction time (raise throughput)",
    "minimize_temperature": "reduce operating temperature (lower energy demand)",
    "minimize_pressure": "operate at lower pressure (simpler, cheaper equipment)",
    "minimize_cost": "reduce overall resource intensity per run",
    "minimize_risk": "prefer robust, comfortable operating conditions",
}


@dataclass
class Objective:
    """Parsed research objective."""

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


def parse_objective(text: str, constraints: Dict[str, float] | None = None) -> Objective:
    """
    Turn free text like "Maximize reaction yield while minimizing reaction time"
    into explicit priorities and scoring weights.
    """
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
    )
    objective.notes = [PRIORITY_DESCRIPTIONS[priority] for priority in priorities]
    if objective.constraints:
        objective.notes.append(
            "hard constraints: "
            + ", ".join(f"{key} <= {value:g}" for key, value in objective.constraints.items())
        )
    return objective


def identified_variables(objective: Objective) -> List[dict]:
    """Human-readable 'variables the agent decided to optimise' table."""
    mapping = {
        "maximize_yield": [("yield", "maximise", "predicted yield", "%")],
        "minimize_time": [("reaction_time", "minimise", "reaction time", "min")],
        "minimize_temperature": [("temperature", "minimise", "operating temperature", "degC")],
        "minimize_pressure": [("pressure", "minimise", "operating pressure", "bar")],
        "minimize_cost": [
            ("pressure", "minimise", "pressure (equipment cost driver)", "bar"),
            ("reaction_time", "minimise", "reaction time (occupancy cost driver)", "min"),
        ],
        "minimize_risk": [("temperature", "cap", "temperature (thermal risk driver)", "degC")],
    }

    seen: set[str] = set()
    variables: List[dict] = []
    for priority in objective.priorities:
        for name, role, description, unit in mapping.get(priority, []):
            if name in seen:
                continue
            seen.add(name)
            variables.append(
                {
                    "variable": name,
                    "role": role,
                    "description": description,
                    "unit": unit,
                    "optimal_range": list(RANGES.get(name, SAFE_ENVELOPE.get(name, (0.0, 0.0)))),
                }
            )
    return variables


# --------------------------------------------------------------------------- #
# Risk model
# --------------------------------------------------------------------------- #

def assess_risk(experiment: dict, prediction: dict) -> dict:
    """
    Heuristic safety/robustness penalty (0-100). This is an engineering
    heuristic over the operating envelope plus model disagreement - not a
    process-safety analysis.
    """
    factors: List[str] = []
    penalty = 0.0

    uncertainty = float(prediction.get("uncertainty_std", 0.0))
    uncertainty_penalty = min(uncertainty * 2.5, 25.0)
    if uncertainty_penalty > 3.0:
        factors.append(
            f"model disagreement across trees (sd {uncertainty:.1f}% yield)"
        )
    penalty += uncertainty_penalty

    violations = envelope_violations(experiment)
    if violations:
        penalty += min(12.0 * len(violations), 30.0)
        factors.extend(violations)

    temperature = float(experiment["temperature"])
    pressure = float(experiment["pressure"])
    reaction_time = float(experiment["reaction_time"])
    concentration = float(experiment["concentration"])

    if temperature > 150.0:
        penalty += 15.0
        factors.append(f"high thermal load ({temperature:.0f} degC > 150 degC)")
    if pressure > 8.0:
        penalty += 12.0
        factors.append(f"elevated pressure ({pressure:.1f} bar > 8 bar)")
    if reaction_time > 150.0:
        penalty += 8.0
        factors.append(f"long occupancy ({reaction_time:.0f} min > 150 min)")
    if concentration > 0.45:
        penalty += 8.0
        factors.append(f"concentrated feed ({concentration:.2f} M > 0.45 M)")

    yield_value = float(prediction.get("predicted_yield", 0.0))
    if yield_value < 30.0:
        penalty += 10.0
        factors.append(f"low-yield region (predicted {yield_value:.1f}%) - little information gained")

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


# --------------------------------------------------------------------------- #
# Scoring
# --------------------------------------------------------------------------- #

def component_scores(experiment: dict, prediction: dict) -> Dict[str, float]:
    """Raw 0-100 component scores (all 'higher is better')."""
    risk = assess_risk(experiment, prediction)
    return {
        "yield": round(float(prediction.get("predicted_yield", 0.0)), 2),
        "time": round(100.0 * (1.0 - normalise(experiment["reaction_time"], "reaction_time")), 2),
        "temperature": round(100.0 * (1.0 - normalise(experiment["temperature"], "temperature")), 2),
        "pressure": round(100.0 * (1.0 - normalise(experiment["pressure"], "pressure")), 2),
        "risk": round(100.0 - float(risk["score"]), 2),
    }


def _reason(experiment: dict, prediction: dict, components: Dict[str, float], objective: Objective) -> str:
    """Build a short, human-auditable justification for the score."""
    predicted = float(prediction.get("predicted_yield", 0.0))
    uncertainty = float(prediction.get("uncertainty_std", 0.0))
    reaction_time = float(experiment["reaction_time"])
    temperature = float(experiment["temperature"])
    pressure = float(experiment["pressure"])
    catalyst = str(experiment["catalyst"])

    if predicted >= 85.0:
        yield_phrase = f"high predicted yield ({predicted:.1f}%)"
    elif predicted >= 70.0:
        yield_phrase = f"solid predicted yield ({predicted:.1f}%)"
    elif predicted >= 50.0:
        yield_phrase = f"moderate predicted yield ({predicted:.1f}%)"
    else:
        yield_phrase = f"low predicted yield ({predicted:.1f}%)"

    time_share = components["time"]
    if time_share >= 75.0:
        time_phrase = f"very short reaction time ({reaction_time:.0f} min)"
    elif time_share >= 45.0:
        time_phrase = f"moderate reaction time ({reaction_time:.0f} min)"
    else:
        time_phrase = f"long reaction time ({reaction_time:.0f} min)"

    driver = max(
        ("yield", "time", "temperature", "pressure", "risk"),
        key=lambda key: objective.weights.get(key, 0.0) * components[key],
    )
    driver_phrase = {
        "yield": "yield benefit dominates the objective",
        "time": "time saving drives the score",
        "temperature": "milder conditions drive the score",
        "pressure": "lower pressure drives the score",
        "risk": "robustness drives the score",
    }[driver]

    window = "inside" if not envelope_violations(experiment) else "outside"
    if uncertainty <= 2.5:
        uncertainty_phrase = f"model agreement is tight (sd {uncertainty:.1f}%)"
    elif uncertainty <= 5.0:
        uncertainty_phrase = f"model uncertainty is moderate (sd {uncertainty:.1f}%)"
    else:
        uncertainty_phrase = f"model uncertainty is high (sd {uncertainty:.1f}%)"

    catalyst_label = CATALYST_PROFILES[catalyst].label if catalyst in CATALYST_PROFILES else catalyst

    return (
        f"{yield_phrase} with {time_phrase} using {catalyst_label} at {temperature:.0f} degC / "
        f"{pressure:.1f} bar - {window} the comfortable operating window, and {driver_phrase}. "
        f"Uncertainty proxy: {uncertainty_phrase}."
    )


def score_experiment(experiment: dict, prediction: dict, objective: Objective) -> dict:
    """Score one experiment against the parsed objective."""
    components = component_scores(experiment, prediction)
    weights = objective.weights

    contributions = {
        key: round(weights.get(key, 0.0) * components[key], 2) for key in components
    }
    score = round(float(sum(contributions.values())), 2)
    risk = assess_risk(experiment, prediction)

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
        "reason": _reason(experiment, prediction, components, objective),
        "constraint_violations": flags,
        "disclaimer": (
            "Score is a transparent weighted sum of predicted yield, time, temperature, "
            "pressure and a heuristic risk penalty - not a measured process-economics figure."
        ),
    }


def score_many(
    experiments: Sequence[dict], predictions: Sequence[dict], objective: Objective
) -> List[dict]:
    """Score a batch of experiments against the objective."""
    return [
        score_experiment(experiment, prediction, objective)
        for experiment, prediction in zip(experiments, predictions)
    ]


def rank(scored: Sequence[dict]) -> List[dict]:
    """Return scored experiments ordered best-first."""
    return sorted(scored, key=lambda item: item["score"], reverse=True)
