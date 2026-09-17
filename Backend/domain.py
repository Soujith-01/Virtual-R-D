"""
Virtual R&D Lab - experimental design space (single source of truth).

Everything that needs to know "what is a valid experiment" imports from here:
the dataset generator, the training pipeline, the API schemas, the experiment
generator and the virtual simulator.

SCIENTIFIC DISCLAIMER
---------------------
`reaction_yield()` is an **authored synthetic surrogate**, not a validated
physical/chemical model. It exists so the ML model has a learnable, non-random
signal to fit and so the virtual reactor has something to "read". Real validated
experimental data should replace it later.
"""

from __future__ import annotations

from dataclasses import dataclass
from typing import Dict, List, Tuple

import numpy as np

# --------------------------------------------------------------------------- #
# Feature / target schema
# --------------------------------------------------------------------------- #

CATALYSTS: List[str] = ["A", "B", "C", "D", "None"]

#: Accepted spellings for the "no catalyst" control run. "None" is a real
#: catalyst level in this design space (the uncatalysed control), NOT a missing
#: value - so it must survive CSV round-trips and API payloads intact.
_UNCATALYSED_ALIASES = {"none", "no catalyst", "uncatalysed", "uncatalyzed", "control", ""}


def normalise_catalyst(value: object) -> str:
    """
    Canonicalise a catalyst label.

    Guards against the classic trap of pandas parsing the string ``"None"`` in a
    CSV as a real ``NaN``, which would make the trained one-hot encoder treat the
    uncatalysed control as an unseen category at inference time.
    """
    if value is None or (isinstance(value, float) and np.isnan(value)):
        return "None"

    text = str(value).strip()
    if text.lower() in _UNCATALYSED_ALIASES:
        return "None"

    for catalyst in CATALYSTS:
        if text.upper() == catalyst.upper():
            return catalyst

    raise ValueError(f"unknown catalyst {value!r}; expected one of {CATALYSTS}")

CATEGORICAL_FEATURES: List[str] = ["catalyst"]
NUMERIC_FEATURES: List[str] = [
    "temperature",
    "pressure",
    "concentration",
    "reaction_time",
]
FEATURE_NAMES: List[str] = [
    "temperature",
    "pressure",
    "catalyst",
    "concentration",
    "reaction_time",
]
TARGET_NAME: str = "yield"

#: (min, max) for every numeric knob. Used for validation, sampling and
#: normalisation in the scorer.
RANGES: Dict[str, Tuple[float, float]] = {
    "temperature": (40.0, 160.0),   # degC
    "pressure": (1.0, 10.0),        # bar
    "concentration": (0.05, 0.50),  # M
    "reaction_time": (5.0, 180.0),  # minutes
}

#: Discrete "protocol" levels used by the experiment generator so that surfaced
#: candidates look like real lab set-points (85 degC, 2.5 bar, 0.18 M, 40 min)
#: instead of raw floating point noise.
FEATURE_LEVELS: Dict[str, np.ndarray] = {
    "temperature": np.arange(40.0, 160.0 + 1e-9, 5.0),
    "pressure": np.arange(1.0, 10.0 + 1e-9, 0.5),
    "concentration": np.round(np.arange(0.05, 0.50 + 1e-9, 0.01), 2),
    "reaction_time": np.arange(5.0, 180.0 + 1e-9, 5.0),
}

#: Acceptable operating envelope - conditions outside this window are flagged
#: as elevated risk by the ranking service.
SAFE_ENVELOPE: Dict[str, Tuple[float, float]] = {
    "temperature": (60.0, 140.0),
    "pressure": (1.0, 8.0),
    "concentration": (0.08, 0.42),
    "reaction_time": (10.0, 150.0),
}

UNITS: Dict[str, str] = {
    "temperature": "degC",
    "pressure": "bar",
    "concentration": "M",
    "reaction_time": "min",
    "yield": "%",
}

DATASET_PROVENANCE = "synthetic_prototype_v1"


# --------------------------------------------------------------------------- #
# Catalyst behaviour profiles (the "hidden chemistry" the RF model must learn)
# --------------------------------------------------------------------------- #

@dataclass(frozen=True)
class CatalystProfile:
    """Behaviour of one catalyst in the synthetic surrogate."""

    ceiling: float        # best achievable yield (%) for this catalyst
    t_opt: float          # optimal temperature (degC)
    t_sigma: float        # temperature tolerance (degC)
    tau: float            # time constant of the kinetic curve (min)
    conc_opt: float       # optimal concentration (M)
    conc_sigma: float     # concentration tolerance (M)
    label: str            # human readable name for reports

    def as_dict(self) -> Dict[str, float]:
        return {
            "ceiling": self.ceiling,
            "t_opt": self.t_opt,
            "t_sigma": self.t_sigma,
            "tau": self.tau,
            "conc_opt": self.conc_opt,
            "conc_sigma": self.conc_sigma,
            "label": self.label,
        }


CATALYST_PROFILES: Dict[str, CatalystProfile] = {
    "A": CatalystProfile(78.0, 110.0, 28.0, 40.0, 0.24, 0.10, "Catalyst A (baseline heterogeneous)"),
    "B": CatalystProfile(96.0, 92.0, 22.0, 22.0, 0.22, 0.09, "Catalyst B (high-activity, fast kinetics)"),
    "C": CatalystProfile(88.0, 125.0, 30.0, 65.0, 0.18, 0.08, "Catalyst C (high-temperature, slow)"),
    "D": CatalystProfile(64.0, 85.0, 26.0, 30.0, 0.30, 0.12, "Catalyst D (selective but low activity)"),
    "None": CatalystProfile(42.0, 135.0, 35.0, 80.0, 0.35, 0.14, "Uncatalysed (thermal only)"),
}

#: Relative influence of each factor in the geometric combination.
FACTOR_WEIGHTS: Dict[str, float] = {
    "temperature": 0.30,
    "reaction_time": 0.25,
    "pressure": 0.15,
    "concentration": 0.30,
}

NOISE_SD: float = 2.2


# --------------------------------------------------------------------------- #
# Synthetic surrogate
# --------------------------------------------------------------------------- #

def _clamp(value: float, low: float, high: float) -> float:
    return float(min(max(value, low), high))


def factor_temperature(temperature: float, profile: CatalystProfile) -> float:
    """Gaussian optimum: too cold is slow, too hot degrades (side reactions)."""
    z = (temperature - profile.t_opt) / profile.t_sigma
    return float(np.exp(-0.5 * z * z))


def factor_concentration(concentration: float, profile: CatalystProfile) -> float:
    """Optimal region, not monotonic - over-concentration promotes by-products."""
    z = (concentration - profile.conc_opt) / profile.conc_sigma
    return float(np.exp(-0.5 * z * z))


def factor_pressure(pressure: float) -> float:
    """Saturating benefit: most of the gain is realised by ~5 bar."""
    return float(1.0 - 0.55 * np.exp(-(pressure - 1.0) / 1.8))


def factor_time(reaction_time: float, profile: CatalystProfile) -> float:
    """First-order approach to completion, controlled by the catalyst tau."""
    return float(1.0 - np.exp(-reaction_time / profile.tau))


def over_reaction_penalty(
    temperature: float, reaction_time: float, concentration: float
) -> float:
    """Multiplicative penalty for harsher / longer / more concentrated runs."""
    penalty = 1.0
    hot = _clamp((temperature - 115.0) / 70.0, 0.0, 1.0)
    long = _clamp((reaction_time - 90.0) / 90.0, 0.0, 1.0)
    concentrated = _clamp((concentration - 0.38) / 0.12, 0.0, 1.0)
    penalty -= 0.45 * hot * long
    penalty -= 0.20 * concentrated
    return _clamp(penalty, 0.15, 1.0)


def reaction_yield(
    temperature: float,
    pressure: float,
    catalyst: str,
    concentration: float,
    reaction_time: float,
    *,
    noise_sd: float = 0.0,
    rng: np.random.Generator | None = None,
) -> float:
    """
    Authored synthetic surrogate for reaction yield (%).

    Non-random structure:
      * temperature has an optimum that depends on the catalyst
      * pressure saturates
      * each catalyst has a different ceiling and kinetic time constant
      * concentration has an optimal region
      * reaction time follows first-order kinetics (diminishing returns)
      * hot + long + concentrated conditions are penalised (over-reaction)

    With ``noise_sd > 0`` gaussian measurement noise is added and the result is
    clipped to [0, 100].
    """
    if catalyst not in CATALYST_PROFILES:
        raise ValueError(
            f"unknown catalyst {catalyst!r}; expected one of {CATALYSTS}"
        )

    profile = CATALYST_PROFILES[catalyst]

    factors = {
        "temperature": factor_temperature(temperature, profile),
        "reaction_time": factor_time(reaction_time, profile),
        "pressure": factor_pressure(pressure),
        "concentration": factor_concentration(concentration, profile),
    }

    combined = float(
        np.prod(
            [
                max(factors[name], 1e-9) ** weight
                for name, weight in FACTOR_WEIGHTS.items()
            ]
        )
    )

    value = profile.ceiling * combined
    value *= over_reaction_penalty(temperature, reaction_time, concentration)

    if noise_sd > 0.0:
        if rng is None:
            rng = np.random.default_rng()
        value += rng.normal(0.0, noise_sd)

    return _clamp(value, 0.0, 100.0)


def factor_contributions(
    temperature: float,
    pressure: float,
    catalyst: str,
    concentration: float,
    reaction_time: float,
) -> Dict[str, float]:
    """Individual factor scores (0-1) - used for human-readable explanations."""
    profile = CATALYST_PROFILES[catalyst]
    return {
        "temperature": round(factor_temperature(temperature, profile), 4),
        "pressure": round(factor_pressure(pressure), 4),
        "concentration": round(factor_concentration(concentration, profile), 4),
        "reaction_time": round(factor_time(reaction_time, profile), 4),
        "over_reaction_penalty": round(
            over_reaction_penalty(temperature, reaction_time, concentration), 4
        ),
    }


# --------------------------------------------------------------------------- #
# Sampling / validation helpers
# --------------------------------------------------------------------------- #

def sample_experiment(rng: np.random.Generator, *, uniform: bool = True) -> Dict[str, object]:
    """Draw one random experiment from the design space."""
    del uniform  # reserved for future sampling strategies
    return {
        "temperature": float(rng.uniform(*RANGES["temperature"])),
        "pressure": float(rng.uniform(*RANGES["pressure"])),
        "catalyst": str(rng.choice(CATALYSTS)),
        "concentration": float(rng.uniform(*RANGES["concentration"])),
        "reaction_time": float(rng.uniform(*RANGES["reaction_time"])),
    }


def experiment_from_vector(vector: List[float], catalyst: str) -> Dict[str, object]:
    """Rebuild an experiment dict from the numeric search vector."""
    return {
        "temperature": float(vector[0]),
        "pressure": float(vector[1]),
        "concentration": float(vector[2]),
        "reaction_time": float(vector[3]),
        "catalyst": catalyst,
    }


def to_vector(experiment: Dict[str, object]) -> List[float]:
    """Numeric search vector (the categorical catalyst is handled separately)."""
    return [
        float(experiment["temperature"]),
        float(experiment["pressure"]),
        float(experiment["concentration"]),
        float(experiment["reaction_time"]),
    ]


def normalise(value: float, feature: str) -> float:
    """Map a feature value into [0, 1] using the design-space ranges."""
    low, high = RANGES[feature]
    return _clamp((float(value) - low) / (high - low), 0.0, 1.0)


def in_safe_envelope(experiment: Dict[str, object]) -> bool:
    """True when every numeric knob sits inside the comfortable operating window."""
    for name, (low, high) in SAFE_ENVELOPE.items():
        if not (low <= float(experiment[name]) <= high):  # type: ignore[arg-type]
            return False
    return True


def envelope_violations(experiment: Dict[str, object]) -> List[str]:
    """Human-readable list of operating-window breaches."""
    problems: List[str] = []
    for name, (low, high) in SAFE_ENVELOPE.items():
        value = float(experiment[name])  # type: ignore[arg-type]
        if value < low:
            problems.append(f"{name} below comfortable window ({value:g} < {low:g})")
        elif value > high:
            problems.append(f"{name} above comfortable window ({value:g} > {high:g})")
    return problems
