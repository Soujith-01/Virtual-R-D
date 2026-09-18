"""
Domain configuration for Water Purification experiments.

Synthetic prototype dataset — not validated real-world data.
"""

from __future__ import annotations

from typing import Dict, List, Tuple

import numpy as np

DOMAIN: str = "water_purification"
DOMAIN_LABEL: str = "Water Purification"
TARGET_NAME: str = "turbidity_removal_percent"
TARGET_UNIT: str = "%"
TARGET_DESCRIPTION: str = "Turbidity removal (%)"

FEATURE_NAMES: List[str] = [
    "coagulant_dose_mg_l",
    "ph",
    "contact_time_min",
    "temperature_c",
    "mixing_speed_rpm",
]

NUMERIC_FEATURES: List[str] = FEATURE_NAMES
CATEGORICAL_FEATURES: List[str] = []

RANGES: Dict[str, Tuple[float, float]] = {
    "coagulant_dose_mg_l": (5.0, 100.0),
    "ph": (4.0, 10.0),
    "contact_time_min": (5.0, 120.0),
    "temperature_c": (5.0, 40.0),
    "mixing_speed_rpm": (50.0, 300.0),
}

SAFE_ENVELOPE: Dict[str, Tuple[float, float]] = {
    "coagulant_dose_mg_l": (15.0, 80.0),
    "ph": (5.5, 8.5),
    "contact_time_min": (10.0, 90.0),
    "temperature_c": (10.0, 30.0),
    "mixing_speed_rpm": (80.0, 200.0),
}

UNITS: Dict[str, str] = {
    "coagulant_dose_mg_l": "mg/L",
    "ph": "",
    "contact_time_min": "min",
    "temperature_c": "degC",
    "mixing_speed_rpm": "rpm",
    TARGET_NAME: "%",
}

DATASET_PROVENANCE: str = "synthetic_prototype_v1"
NOISE_SD: float = 2.0
TARGET_MIN: float = 30.0
TARGET_MAX: float = 97.0


def turbidity_removal_percent(
    coagulant_dose_mg_l: float,
    ph: float,
    contact_time_min: float,
    temperature_c: float,
    mixing_speed_rpm: float,
    *,
    noise_sd: float = 0.0,
    rng: np.random.Generator | None = None,
) -> float:
    """
    Authored synthetic surrogate for turbidity removal.

    Nonlinear relationships:
      * coagulant dose has an optimal region
      * pH has an optimal region
      * more contact time generally helps until saturation
      * mixing speed has an optimal range
      * temperature has a smaller effect
    """
    dose_z = (coagulant_dose_mg_l - 40.0) / 18.0
    dose_factor = float(np.exp(-0.5 * dose_z * dose_z))

    ph_z = (ph - 6.8) / 1.2
    ph_factor = float(np.exp(-0.5 * ph_z * ph_z))

    contact_norm = float(np.clip(contact_time_min / 120.0, 0.0, 1.0))
    contact_factor = float(1.0 - 0.45 * np.exp(-contact_norm * 3.5))

    mixing_z = (mixing_speed_rpm - 120.0) / 50.0
    mixing_factor = float(np.exp(-0.5 * mixing_z * mixing_z))

    temp_norm = float(np.clip((temperature_c - 5.0) / 35.0, 0.0, 1.0))
    temp_factor = float(1.0 - 0.15 * np.exp(-temp_norm * 2.0))

    base = 35.0 + 60.0 * dose_factor * ph_factor * contact_factor * mixing_factor * temp_factor

    interaction = 1.0
    if coagulant_dose_mg_l > 75.0:
        interaction *= (1.0 - 0.12 * float(np.clip((coagulant_dose_mg_l - 75.0) / 25.0, 0.0, 1.0)))
    if ph < 5.0:
        interaction *= float(np.clip((ph - 4.0) / 1.0, 0.3, 1.0))
    if ph > 9.0:
        interaction *= float(np.clip((10.0 - ph) / 1.0, 0.3, 1.0))
    if mixing_speed_rpm > 220.0:
        interaction *= float(np.exp(-0.015 * (mixing_speed_rpm - 220.0)))
    if contact_time_min > 100.0:
        interaction *= float(np.clip(1.0 - 0.05 * (contact_time_min - 100.0) / 20.0, 0.8, 1.0))

    value = base * interaction
    value = float(np.clip(value, TARGET_MIN, TARGET_MAX))

    if noise_sd > 0.0:
        if rng is None:
            rng = np.random.default_rng()
        value += rng.normal(0.0, noise_sd)

    return float(np.clip(value, TARGET_MIN, TARGET_MAX))


def factor_contributions(
    coagulant_dose_mg_l: float,
    ph: float,
    contact_time_min: float,
    temperature_c: float,
    mixing_speed_rpm: float,
) -> Dict[str, float]:
    """Individual factor scores (0-1) for human-readable explanations."""
    dose_z = (coagulant_dose_mg_l - 40.0) / 18.0
    ph_z = (ph - 6.8) / 1.2
    mixing_z = (mixing_speed_rpm - 120.0) / 50.0
    contact_norm = float(np.clip(contact_time_min / 120.0, 0.0, 1.0))
    temp_norm = float(np.clip((temperature_c - 5.0) / 35.0, 0.0, 1.0))

    return {
        "coagulant_dose": round(float(np.exp(-0.5 * dose_z * dose_z)), 4),
        "ph": round(float(np.exp(-0.5 * ph_z * ph_z)), 4),
        "mixing_speed": round(float(np.exp(-0.5 * mixing_z * mixing_z)), 4),
        "contact_time": round(float(1.0 - 0.45 * np.exp(-contact_norm * 3.5)), 4),
        "temperature": round(float(1.0 - 0.15 * np.exp(-temp_norm * 2.0)), 4),
    }


def sample_experiment(rng: np.random.Generator, *, uniform: bool = True) -> Dict[str, object]:
    """Draw one random experiment from the water purification design space."""
    del uniform
    return {
        "coagulant_dose_mg_l": float(rng.uniform(*RANGES["coagulant_dose_mg_l"])),
        "ph": float(rng.uniform(*RANGES["ph"])),
        "contact_time_min": float(rng.uniform(*RANGES["contact_time_min"])),
        "temperature_c": float(rng.uniform(*RANGES["temperature_c"])),
        "mixing_speed_rpm": float(rng.uniform(*RANGES["mixing_speed_rpm"])),
    }


def experiment_from_vector(vector: List[float]) -> Dict[str, object]:
    """Rebuild an experiment dict from the numeric search vector."""
    return {
        "coagulant_dose_mg_l": float(vector[0]),
        "ph": float(vector[1]),
        "contact_time_min": float(vector[2]),
        "temperature_c": float(vector[3]),
        "mixing_speed_rpm": float(vector[4]),
    }


def to_vector(experiment: Dict[str, object]) -> List[float]:
    """Numeric search vector (all numeric for water purification)."""
    return [
        float(experiment["coagulant_dose_mg_l"]),
        float(experiment["ph"]),
        float(experiment["contact_time_min"]),
        float(experiment["temperature_c"]),
        float(experiment["mixing_speed_rpm"]),
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
