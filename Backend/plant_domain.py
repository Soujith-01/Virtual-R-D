"""
Domain configuration for Plant Growth Optimization experiments.

Synthetic prototype dataset — not validated real-world data.
"""

from __future__ import annotations

from typing import Dict, List, Tuple

import numpy as np

DOMAIN: str = "plant_growth"
DOMAIN_LABEL: str = "Plant Growth Optimization"
TARGET_NAME: str = "biomass_yield"
TARGET_UNIT: str = "g"
TARGET_DESCRIPTION: str = "Biomass yield (g)"

FEATURE_NAMES: List[str] = [
    "light_intensity_lux",
    "co2_concentration_ppm",
    "nutrient_concentration_mm",
    "temperature_c",
    "water_supply_ml_day",
]

NUMERIC_FEATURES: List[str] = FEATURE_NAMES
CATEGORICAL_FEATURES: List[str] = []

RANGES: Dict[str, Tuple[float, float]] = {
    "light_intensity_lux": (5000.0, 80000.0),
    "co2_concentration_ppm": (400.0, 1200.0),
    "nutrient_concentration_mm": (0.5, 10.0),
    "temperature_c": (15.0, 40.0),
    "water_supply_ml_day": (50.0, 500.0),
}

SAFE_ENVELOPE: Dict[str, Tuple[float, float]] = {
    "light_intensity_lux": (10000.0, 60000.0),
    "co2_concentration_ppm": (600.0, 1000.0),
    "nutrient_concentration_mm": (1.0, 8.0),
    "temperature_c": (20.0, 32.0),
    "water_supply_ml_day": (80.0, 400.0),
}

UNITS: Dict[str, str] = {
    "light_intensity_lux": "lux",
    "co2_concentration_ppm": "ppm",
    "nutrient_concentration_mm": "mM",
    "temperature_c": "degC",
    "water_supply_ml_day": "ml/day",
    TARGET_NAME: "g",
}

DATASET_PROVENANCE: str = "synthetic_prototype_v1"
NOISE_SD: float = 3.0
TARGET_MIN: float = 10.0
TARGET_MAX: float = 180.0


def biomass_yield(
    light_intensity_lux: float,
    co2_concentration_ppm: float,
    nutrient_concentration_mm: float,
    temperature_c: float,
    water_supply_ml_day: float,
    *,
    noise_sd: float = 0.0,
    rng: np.random.Generator | None = None,
) -> float:
    """
    Authored synthetic surrogate for biomass yield.

    Growth improves within an optimal range and declines when conditions move
    too far from the optimum — classic bell-shaped environmental response.
    """
    light_z = (light_intensity_lux - 35000.0) / 15000.0
    light_factor = float(np.exp(-0.5 * light_z * light_z))

    co2_z = (co2_concentration_ppm - 800.0) / 200.0
    co2_factor = float(np.exp(-0.5 * co2_z * co2_z))

    nutrient_z = (nutrient_concentration_mm - 4.0) / 2.0
    nutrient_factor = float(np.exp(-0.5 * nutrient_z * nutrient_z))

    temp_z = (temperature_c - 26.0) / 5.0
    temp_factor = float(np.exp(-0.5 * temp_z * temp_z))

    water_norm = float(np.clip((water_supply_ml_day - 50.0) / 450.0, 0.0, 1.0))
    water_factor = float(1.0 - 0.3 * np.exp(-water_norm * 4.0))

    base = 20.0 + 150.0 * light_factor * co2_factor * nutrient_factor * temp_factor * water_factor

    interaction = 1.0
    if light_factor > 0.8 and co2_factor > 0.8:
        interaction += 0.10
    if temperature_c < 18.0 or temperature_c > 34.0:
        interaction *= 0.7
    if nutrient_concentration_mm > 9.0:
        interaction *= float(np.exp(-0.3 * (nutrient_concentration_mm - 9.0)))
    if water_supply_ml_day < 60.0:
        interaction *= float(np.clip(water_supply_ml_day / 60.0, 0.2, 1.0))

    value = base * interaction
    value = float(np.clip(value, TARGET_MIN, TARGET_MAX))

    if noise_sd > 0.0:
        if rng is None:
            rng = np.random.default_rng()
        value += rng.normal(0.0, noise_sd)

    return float(np.clip(value, TARGET_MIN, TARGET_MAX))


def factor_contributions(
    light_intensity_lux: float,
    co2_concentration_ppm: float,
    nutrient_concentration_mm: float,
    temperature_c: float,
    water_supply_ml_day: float,
) -> Dict[str, float]:
    """Individual factor scores (0-1) for human-readable explanations."""
    light_z = (light_intensity_lux - 35000.0) / 15000.0
    co2_z = (co2_concentration_ppm - 800.0) / 200.0
    nutrient_z = (nutrient_concentration_mm - 4.0) / 2.0
    temp_z = (temperature_c - 26.0) / 5.0
    water_norm = float(np.clip((water_supply_ml_day - 50.0) / 450.0, 0.0, 1.0))

    return {
        "light_intensity": round(float(np.exp(-0.5 * light_z * light_z)), 4),
        "co2_concentration": round(float(np.exp(-0.5 * co2_z * co2_z)), 4),
        "nutrient_concentration": round(float(np.exp(-0.5 * nutrient_z * nutrient_z)), 4),
        "temperature": round(float(np.exp(-0.5 * temp_z * temp_z)), 4),
        "water_supply": round(float(1.0 - 0.3 * np.exp(-water_norm * 4.0)), 4),
    }


def sample_experiment(rng: np.random.Generator, *, uniform: bool = True) -> Dict[str, object]:
    """Draw one random experiment from the plant growth design space."""
    del uniform
    return {
        "light_intensity_lux": float(rng.uniform(*RANGES["light_intensity_lux"])),
        "co2_concentration_ppm": float(rng.uniform(*RANGES["co2_concentration_ppm"])),
        "nutrient_concentration_mm": float(rng.uniform(*RANGES["nutrient_concentration_mm"])),
        "temperature_c": float(rng.uniform(*RANGES["temperature_c"])),
        "water_supply_ml_day": float(rng.uniform(*RANGES["water_supply_ml_day"])),
    }


def experiment_from_vector(vector: List[float]) -> Dict[str, object]:
    """Rebuild an experiment dict from the numeric search vector."""
    return {
        "light_intensity_lux": float(vector[0]),
        "co2_concentration_ppm": float(vector[1]),
        "nutrient_concentration_mm": float(vector[2]),
        "temperature_c": float(vector[3]),
        "water_supply_ml_day": float(vector[4]),
    }


def to_vector(experiment: Dict[str, object]) -> List[float]:
    """Numeric search vector (all numeric for plant growth)."""
    return [
        float(experiment["light_intensity_lux"]),
        float(experiment["co2_concentration_ppm"]),
        float(experiment["nutrient_concentration_mm"]),
        float(experiment["temperature_c"]),
        float(experiment["water_supply_ml_day"]),
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
