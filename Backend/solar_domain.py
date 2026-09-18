"""
Domain configuration for Solar Panel Efficiency experiments.

Synthetic prototype dataset — not validated real-world data.
"""

from __future__ import annotations

from dataclasses import dataclass
from typing import Dict, List, Tuple

import numpy as np

DOMAIN: str = "solar_efficiency"
DOMAIN_LABEL: str = "Solar Panel Efficiency"
TARGET_NAME: str = "energy_conversion_efficiency"
TARGET_UNIT: str = "%"
TARGET_DESCRIPTION: str = "Energy conversion efficiency (%)"

FEATURE_NAMES: List[str] = [
    "cell_thickness_nm",
    "doping_concentration",
    "annealing_temperature_c",
    "light_intensity_lux",
    "operating_temperature_c",
]

NUMERIC_FEATURES: List[str] = FEATURE_NAMES
CATEGORICAL_FEATURES: List[str] = []

RANGES: Dict[str, Tuple[float, float]] = {
    "cell_thickness_nm": (50.0, 300.0),
    "doping_concentration": (1.0e15, 1.0e18),
    "annealing_temperature_c": (500.0, 900.0),
    "light_intensity_lux": (20000.0, 120000.0),
    "operating_temperature_c": (15.0, 75.0),
}

SAFE_ENVELOPE: Dict[str, Tuple[float, float]] = {
    "cell_thickness_nm": (80.0, 250.0),
    "doping_concentration": (5.0e15, 5.0e17),
    "annealing_temperature_c": (600.0, 800.0),
    "light_intensity_lux": (30000.0, 100000.0),
    "operating_temperature_c": (20.0, 55.0),
}

UNITS: Dict[str, str] = {
    "cell_thickness_nm": "nm",
    "doping_concentration": "cm^-3",
    "annealing_temperature_c": "degC",
    "light_intensity_lux": "lux",
    "operating_temperature_c": "degC",
    TARGET_NAME: "%",
}

DATASET_PROVENANCE: str = "synthetic_prototype_v1"

NOISE_SD: float = 1.5

# Target ceiling varies with cell design
TARGET_MIN: float = 8.0
TARGET_MAX: float = 23.0


@dataclass(frozen=True)
class SolarProfile:
    """Behaviour shapes for the synthetic solar surrogate."""

    thickness_opt: float
    thickness_sigma: float
    doping_opt: float
    doping_sigma: float
    anneal_opt: float
    anneal_sigma: float
    temp_sensitivity: float
    label: str


SOLAR_PROFILES: Dict[str, SolarProfile] = {}


def normalise_doping(value: float) -> float:
    """Log-normalise doping for the surrogate math."""
    return float(np.log10(max(value, 1e10)))


def solar_efficiency(
    cell_thickness_nm: float,
    doping_concentration: float,
    annealing_temperature_c: float,
    light_intensity_lux: float,
    operating_temperature_c: float,
    *,
    noise_sd: float = 0.0,
    rng: np.random.Generator | None = None,
) -> float:
    """
    Authored synthetic surrogate for solar panel energy conversion efficiency.

    Non-random structure:
      * cell thickness has an optimum (too thin = poor absorption, too thick = recombination)
      * doping concentration has an optimum region (too low = poor carrier transport,
        too high = increased recombination)
      * annealing temperature has an optimal window (too low = poor crystallisation,
        too high = degradation)
      * light intensity gives saturating improvement
      * operating temperature degrades efficiency (positive temperature coefficient loss)
      * nonlinear interactions and noise make Random Forest meaningful
    """
    thickness_z = (cell_thickness_nm - 150.0) / 60.0
    thickness_factor = float(np.exp(-0.5 * thickness_z * thickness_z))

    doping_log = normalise_doping(doping_concentration)
    doping_z = (doping_log - 16.5) / 0.8
    doping_factor = float(np.exp(-0.5 * doping_z * doping_z))

    anneal_z = (annealing_temperature_c - 700.0) / 80.0
    anneal_factor = float(np.exp(-0.5 * anneal_z * anneal_z))

    light_norm = float(np.clip((light_intensity_lux - 20000.0) / 100000.0, 0.0, 1.0))
    light_factor = float(1.0 - 0.35 * np.exp(-light_norm * 3.0))

    temp_penalty = float(np.exp(-0.018 * max(operating_temperature_c - 25.0, 0.0)))

    base = 12.0 + 11.0 * thickness_factor * doping_factor * anneal_factor * light_factor * temp_penalty

    interaction = 1.0
    if thickness_factor > 0.7 and doping_factor > 0.7:
        interaction += 0.08 * thickness_factor * doping_factor
    if annealing_temperature_c > 800.0:
        interaction *= (1.0 - 0.15 * float(np.clip((annealing_temperature_c - 800.0) / 100.0, 0.0, 1.0)))
    if operating_temperature_c > 50.0:
        interaction *= float(np.exp(-0.04 * (operating_temperature_c - 50.0)))

    value = base * interaction
    value = float(np.clip(value, TARGET_MIN, TARGET_MAX))

    if noise_sd > 0.0:
        if rng is None:
            rng = np.random.default_rng()
        value += rng.normal(0.0, noise_sd)

    return float(np.clip(value, TARGET_MIN, TARGET_MAX))


def factor_contributions(
    cell_thickness_nm: float,
    doping_concentration: float,
    annealing_temperature_c: float,
    light_intensity_lux: float,
    operating_temperature_c: float,
) -> Dict[str, float]:
    """Individual factor scores (0-1) for human-readable explanations."""
    thickness_z = (cell_thickness_nm - 150.0) / 60.0
    doping_log = normalise_doping(doping_concentration)
    doping_z = (doping_log - 16.5) / 0.8
    anneal_z = (annealing_temperature_c - 700.0) / 80.0

    return {
        "cell_thickness": round(float(np.exp(-0.5 * thickness_z * thickness_z)), 4),
        "doping_concentration": round(float(np.exp(-0.5 * doping_z * doping_z)), 4),
        "annealing_temperature": round(float(np.exp(-0.5 * anneal_z * anneal_z)), 4),
        "light_intensity": round(float(1.0 - 0.35 * np.exp(-float(np.clip((light_intensity_lux - 20000.0) / 100000.0, 0.0, 1.0)) * 3.0)), 4),
        "operating_temperature": round(float(np.exp(-0.018 * max(operating_temperature_c - 25.0, 0.0))), 4),
    }


def sample_experiment(rng: np.random.Generator, *, uniform: bool = True) -> Dict[str, object]:
    """Draw one random experiment from the solar design space."""
    del uniform
    return {
        "cell_thickness_nm": float(rng.uniform(*RANGES["cell_thickness_nm"])),
        "doping_concentration": float(rng.uniform(*RANGES["doping_concentration"])),
        "annealing_temperature_c": float(rng.uniform(*RANGES["annealing_temperature_c"])),
        "light_intensity_lux": float(rng.uniform(*RANGES["light_intensity_lux"])),
        "operating_temperature_c": float(rng.uniform(*RANGES["operating_temperature_c"])),
    }


def experiment_from_vector(vector: List[float]) -> Dict[str, object]:
    """Rebuild an experiment dict from the numeric search vector."""
    return {
        "cell_thickness_nm": float(vector[0]),
        "doping_concentration": float(vector[1]),
        "annealing_temperature_c": float(vector[2]),
        "light_intensity_lux": float(vector[3]),
        "operating_temperature_c": float(vector[4]),
    }


def to_vector(experiment: Dict[str, object]) -> List[float]:
    """Numeric search vector (all numeric for solar)."""
    return [
        float(experiment["cell_thickness_nm"]),
        float(experiment["doping_concentration"]),
        float(experiment["annealing_temperature_c"]),
        float(experiment["light_intensity_lux"]),
        float(experiment["operating_temperature_c"]),
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
