"""
Domain configuration for Battery Performance experiments.

Synthetic prototype dataset — not validated real-world data.
"""

from __future__ import annotations

from typing import Dict, List, Tuple

import numpy as np

DOMAIN: str = "battery_performance"
DOMAIN_LABEL: str = "Battery Performance"
TARGET_NAME: str = "capacity_retention_percent"
TARGET_UNIT: str = "%"
TARGET_DESCRIPTION: str = "Capacity retention (%)"

FEATURE_NAMES: List[str] = [
    "electrolyte_concentration_m",
    "charging_rate_c",
    "operating_temperature_c",
    "discharge_rate_c",
    "cycle_count",
]

NUMERIC_FEATURES: List[str] = FEATURE_NAMES
CATEGORICAL_FEATURES: List[str] = []

RANGES: Dict[str, Tuple[float, float]] = {
    "electrolyte_concentration_m": (0.5, 2.5),
    "charging_rate_c": (0.2, 3.0),
    "operating_temperature_c": (0.0, 50.0),
    "discharge_rate_c": (0.2, 3.0),
    "cycle_count": (10.0, 500.0),
}

SAFE_ENVELOPE: Dict[str, Tuple[float, float]] = {
    "electrolyte_concentration_m": (0.8, 2.0),
    "charging_rate_c": (0.3, 1.5),
    "operating_temperature_c": (10.0, 35.0),
    "discharge_rate_c": (0.3, 1.5),
    "cycle_count": (20.0, 300.0),
}

UNITS: Dict[str, str] = {
    "electrolyte_concentration_m": "M",
    "charging_rate_c": "C",
    "operating_temperature_c": "degC",
    "discharge_rate_c": "C",
    "cycle_count": "cycles",
    TARGET_NAME: "%",
}

DATASET_PROVENANCE: str = "synthetic_prototype_v1"
NOISE_SD: float = 1.8
TARGET_MIN: float = 40.0
TARGET_MAX: float = 98.0


def capacity_retention_percent(
    electrolyte_concentration_m: float,
    charging_rate_c: float,
    operating_temperature_c: float,
    discharge_rate_c: float,
    cycle_count: float,
    *,
    noise_sd: float = 0.0,
    rng: np.random.Generator | None = None,
) -> float:
    """
    Authored synthetic surrogate for battery capacity retention.

    Nonlinear relationships:
      * moderate charging rates better than extreme rates
      * operating temperature has an optimal range
      * excessive cycle count reduces retention
      * extreme discharge rates reduce retention
      * electrolyte concentration has a nonlinear optimum
    """
    electrolyte_z = (electrolyte_concentration_m - 1.4) / 0.5
    electrolyte_factor = float(np.exp(-0.5 * electrolyte_z * electrolyte_z))

    charge_z = (charging_rate_c - 0.6) / 0.8
    charge_factor = float(np.exp(-0.5 * charge_z * charge_z))

    discharge_z = (discharge_rate_c - 0.6) / 0.8
    discharge_factor = float(np.exp(-0.5 * discharge_z * discharge_z))

    temp_z = (operating_temperature_c - 22.0) / 10.0
    temp_factor = float(np.exp(-0.5 * temp_z * temp_z))

    cycle_norm = float(np.clip(cycle_count / 500.0, 0.0, 1.0))
    cycle_factor = float(np.exp(-1.8 * cycle_norm))

    base = 50.0 + 48.0 * electrolyte_factor * charge_factor * discharge_factor * temp_factor * cycle_factor

    interaction = 1.0
    if charging_rate_c > 2.0:
        interaction *= (1.0 - 0.25 * float(np.clip((charging_rate_c - 2.0) / 1.0, 0.0, 1.0)))
    if discharge_rate_c > 2.0:
        interaction *= (1.0 - 0.20 * float(np.clip((discharge_rate_c - 2.0) / 1.0, 0.0, 1.0)))
    if operating_temperature_c < 5.0:
        interaction *= float(np.clip(operating_temperature_c / 5.0, 0.3, 1.0))
    if operating_temperature_c > 40.0:
        interaction *= float(np.exp(-0.06 * (operating_temperature_c - 40.0)))
    if cycle_count < 30.0:
        interaction *= float(1.0 + 0.08 * (30.0 - cycle_count) / 30.0)

    value = base * interaction
    value = float(np.clip(value, TARGET_MIN, TARGET_MAX))

    if noise_sd > 0.0:
        if rng is None:
            rng = np.random.default_rng()
        value += rng.normal(0.0, noise_sd)

    return float(np.clip(value, TARGET_MIN, TARGET_MAX))


def factor_contributions(
    electrolyte_concentration_m: float,
    charging_rate_c: float,
    operating_temperature_c: float,
    discharge_rate_c: float,
    cycle_count: float,
) -> Dict[str, float]:
    """Individual factor scores (0-1) for human-readable explanations."""
    electrolyte_z = (electrolyte_concentration_m - 1.4) / 0.5
    charge_z = (charging_rate_c - 0.6) / 0.8
    discharge_z = (discharge_rate_c - 0.6) / 0.8
    temp_z = (operating_temperature_c - 22.0) / 10.0
    cycle_norm = float(np.clip(cycle_count / 500.0, 0.0, 1.0))

    return {
        "electrolyte_concentration": round(float(np.exp(-0.5 * electrolyte_z * electrolyte_z)), 4),
        "charging_rate": round(float(np.exp(-0.5 * charge_z * charge_z)), 4),
        "discharge_rate": round(float(np.exp(-0.5 * discharge_z * discharge_z)), 4),
        "operating_temperature": round(float(np.exp(-0.5 * temp_z * temp_z)), 4),
        "cycle_count": round(float(np.exp(-1.8 * cycle_norm)), 4),
    }


def sample_experiment(rng: np.random.Generator, *, uniform: bool = True) -> Dict[str, object]:
    """Draw one random experiment from the battery design space."""
    del uniform
    return {
        "electrolyte_concentration_m": float(rng.uniform(*RANGES["electrolyte_concentration_m"])),
        "charging_rate_c": float(rng.uniform(*RANGES["charging_rate_c"])),
        "operating_temperature_c": float(rng.uniform(*RANGES["operating_temperature_c"])),
        "discharge_rate_c": float(rng.uniform(*RANGES["discharge_rate_c"])),
        "cycle_count": float(rng.uniform(*RANGES["cycle_count"])),
    }


def experiment_from_vector(vector: List[float]) -> Dict[str, object]:
    """Rebuild an experiment dict from the numeric search vector."""
    return {
        "electrolyte_concentration_m": float(vector[0]),
        "charging_rate_c": float(vector[1]),
        "operating_temperature_c": float(vector[2]),
        "discharge_rate_c": float(vector[3]),
        "cycle_count": float(vector[4]),
    }


def to_vector(experiment: Dict[str, object]) -> List[float]:
    """Numeric search vector (all numeric for battery)."""
    return [
        float(experiment["electrolyte_concentration_m"]),
        float(experiment["charging_rate_c"]),
        float(experiment["operating_temperature_c"]),
        float(experiment["discharge_rate_c"]),
        float(experiment["cycle_count"]),
    ]


def normalise(value: float, feature: str) -> float:
    """Map a feature value into [0, 1] using the design-space ranges."""
    low, high = RANGES[feature]
    return float(min(max((float(value) - low) / (high - low), 0.0), 1.0))


def in_safe_envelope(experiment: Dict[str, object]) -> bool:
    """True when every knob sits inside the comfortable operating window."""
    for name, (low, high) in SAFE_ENVELOPE.items():
        if not (low <= float(experiment[name]) <= high):
            return False
    return True


def envelope_violations(experiment: Dict[str, object]) -> List[str]:
    """Human-readable list of operating-window breaches."""
    problems: List[str] = []
    for name, (low, high) in SAFE_ENVELOPE.items():
        value = float(experiment[name])
        if value < low:
            problems.append(f"{name} below comfortable window ({value:g} < {low:g})")
        elif value > high:
            problems.append(f"{name} above comfortable window ({value:g} > {high:g})")
    return problems
