"""
Phase 7 - Virtual reactor simulator.

Produces a deterministic, reproducible stage-by-stage timeline that the frontend
animates. This is a **visual simulation for demonstration only** - it is not a
laboratory control system and issues no real set-points.

Two numbers are reported and deliberately kept separate:

* ``predicted_yield`` - what the Random Forest model said before the run
* ``observed_yield``  - what the simulator's internal surrogate "measured"

Showing both lets the demo illustrate model-vs-virtual-experiment agreement
(and disagreement) honestly, instead of pretending the prediction is a result.
"""

from __future__ import annotations

import hashlib
from typing import Dict, List

import numpy as np

from domain import (
    CATALYST_PROFILES,
    RANGES,
    UNITS,
    envelope_violations,
    factor_contributions,
    reaction_yield,
)

AMBIENT_TEMPERATURE = 25.0
COOLDOWN_TEMPERATURE = 40.0

#: (stage key, label, share of total duration, operator description)
STAGE_PLAN = [
    ("INITIALIZING", "Initializing", 0.08, "Sealing vessel, purging headspace, running sensor checks"),
    ("HEATING", "Heating", 0.22, "Ramping jacket temperature to the set-point"),
    ("STABILIZING", "Stabilizing", 0.10, "Holding set-point, checking thermal drift"),
    ("REACTION", "Reaction", 0.42, "Charging catalyst feed and monitoring conversion"),
    ("ANALYZING", "Analyzing", 0.12, "Quenching, sampling and quantifying product"),
    ("COMPLETE", "Complete", 0.06, "Run finished, results handed to the ranking service"),
]

STAGE_KEYS: List[str] = [stage[0] for stage in STAGE_PLAN]

#: Wall-clock length of the animation (ms). The whole demo stays well under 60 s.
BASE_DURATION_MS = 13_000
FRAME_INTERVAL_MS = 200


def _seed_for(experiment: dict) -> int:
    """Stable seed so the same experiment always replays identically."""
    key = "|".join(
        f"{name}={float(experiment[name]):.4f}"
        for name in ("temperature", "pressure", "concentration", "reaction_time")
    ) + f"|catalyst={experiment['catalyst']}"
    return int(hashlib.sha256(key.encode("utf-8")).hexdigest()[:8], 16)


def _temperature_curve(stage: str, fraction: float, target: float) -> float:
    """Temperature at a point inside a stage."""
    if stage == "INITIALIZING":
        return AMBIENT_TEMPERATURE + 4.0 * fraction
    if stage == "HEATING":
        # First-order approach to the set-point, like a real jacket.
        return target - (target - AMBIENT_TEMPERATURE) * float(np.exp(-4.0 * fraction))
    if stage == "STABILIZING":
        return target + 1.2 * float(np.sin(fraction * 6.0)) * (1.0 - fraction)
    if stage == "REACTION":
        return target + 0.8 * float(np.sin(fraction * 12.0))
    if stage == "ANALYZING":
        return target - (target - COOLDOWN_TEMPERATURE) * float(np.exp(-3.0 * fraction))
    return COOLDOWN_TEMPERATURE


def _pressure_curve(stage: str, fraction: float, target: float) -> float:
    """Pressure at a point inside a stage."""
    if stage in ("INITIALIZING", "HEATING"):
        return 1.0 + (target - 1.0) * float(fraction ** 1.4)
    if stage in ("STABILIZING", "REACTION"):
        ripple = 0.12 * float(np.sin(fraction * 9.0))
        return max(target * (1.0 + ripple), 1.0)
    if stage == "ANALYZING":
        return max(target * (1.0 - 0.85 * fraction), 1.0)
    return 1.0


def _stage_log(stage: str, experiment: dict, health: List[str]) -> List[str]:
    """Operator-style log lines emitted when a stage starts."""
    temperature = float(experiment["temperature"])
    pressure = float(experiment["pressure"])
    catalyst = str(experiment["catalyst"])
    reaction_time = float(experiment["reaction_time"])
    concentration = float(experiment["concentration"])
    catalyst_label = CATALYST_PROFILES[catalyst].label if catalyst in CATALYST_PROFILES else catalyst

    logs = {
        "INITIALIZING": [
            "reactor sealed, headspace purged with inert gas",
            f"sensor check OK - set-point creep {temperature:.0f} degC / {pressure:.1f} bar",
        ],
        "HEATING": [
            f"jacket ramp engaged -> {temperature:.0f} degC",
            f"charge prepared: {concentration:.2f} M feed",
        ],
        "STABILIZING": [
            f"thermal drift inside +/- 0.6 degC at {temperature:.0f} degC",
            f"pressurised to {pressure:.1f} bar",
        ],
        "REACTION": [
            f"catalyst charged: {catalyst_label}",
            f"reaction clock started - target {reaction_time:.0f} min",
        ],
        "ANALYZING": ["quench applied, mixture sampled", "quantifying product by calibrated assay"],
        "COMPLETE": ["run complete, data archived to the virtual lab record"],
    }
    return list(logs.get(stage, [])) + (health if stage == "STABILIZING" else [])


def _health_flags(experiment: dict) -> List[str]:
    flags: List[str] = []
    temperature = float(experiment["temperature"])
    pressure = float(experiment["pressure"])
    if temperature > 150.0:
        flags.append(f"HIGH THERMAL LOAD - jacket set-point {temperature:.0f} degC")
    if pressure > 8.0:
        flags.append(f"HIGH PRESSURE - vessel at {pressure:.1f} bar")
    if not flags:
        flags.append("all monitored variables inside the comfortable operating window")
    return flags


def simulate(
    experiment: dict,
    *,
    predicted_yield: float = 0.0,
    uncertainty_std: float = 0.0,
    speed: float = 1.0,
    frame_interval_ms: int = FRAME_INTERVAL_MS,
    base_duration_ms: int = BASE_DURATION_MS,
) -> Dict[str, object]:
    """
    Build the full simulation timeline for one experiment.

    Parameters
    ----------
    experiment
        Validated experiment parameters.
    predicted_yield, uncertainty_std
        Output of the ML model - echoed into the timeline so the UI can show the
        prediction alongside the simulated measurement.
    speed
        Playback multiplier (2.0 = twice as fast). The frontend can also simply
        play the frames back at its own pace.
    """
    speed = max(float(speed), 0.1)
    total_ms = int(base_duration_ms / speed)

    # --- validate ranges ---------------------------------------------------- #
    for name, (low, high) in RANGES.items():
        value = float(experiment[name])
        if not (low <= value <= high):
            raise ValueError(
                f"{name}={value:g} is outside the supported range [{low:g}, {high:g}]"
            )

    rng = np.random.default_rng(_seed_for(experiment))

    # --- "measurement" from the simulator's internal surrogate -------------- #
    observed = reaction_yield(
        experiment["temperature"],
        experiment["pressure"],
        str(experiment["catalyst"]),
        experiment["concentration"],
        experiment["reaction_time"],
        noise_sd=1.6,
        rng=rng,
    )
    observed = float(np.clip(observed, 0.0, 100.0))
    predicted = float(np.clip(predicted_yield, 0.0, 100.0))

    health = _health_flags(experiment)

    # --- stage table -------------------------------------------------------- #
    stage_table: List[dict] = []
    cursor_ms = 0
    for key, label, share, description in STAGE_PLAN:
        duration_ms = int(round(total_ms * share))
        stage_table.append(
            {
                "stage": key,
                "label": label,
                "description": description,
                "start_ms": cursor_ms,
                "duration_ms": duration_ms,
                "log": _stage_log(key, experiment, health),
                "status": "pending",
            }
        )
        cursor_ms += duration_ms
    total_ms = cursor_ms

    # --- frames ------------------------------------------------------------ #
    target_temperature = float(experiment["temperature"])
    target_pressure = float(experiment["pressure"])
    reaction_time = float(experiment["reaction_time"])

    frames: List[dict] = []
    for t_ms in range(0, total_ms + 1, frame_interval_ms):
        progress = min(t_ms / total_ms, 1.0) if total_ms else 1.0

        current = stage_table[-1]
        for entry in stage_table:
            if t_ms >= entry["start_ms"]:
                current = entry
            else:
                break

        stage = str(current["stage"])
        stage_progress = (
            min((t_ms - current["start_ms"]) / max(current["duration_ms"], 1), 1.0)
            if stage != "COMPLETE"
            else 1.0
        )

        temperature = _temperature_curve(stage, stage_progress, target_temperature)
        pressure = _pressure_curve(stage, stage_progress, target_pressure)

        # Elapsed reaction time is scaled from the compressed animation window.
        if STAGE_KEYS.index(stage) < STAGE_KEYS.index("REACTION"):
            elapsed_reaction_time = 0.0
        elif stage == "REACTION":
            elapsed_reaction_time = reaction_time * stage_progress
        else:
            elapsed_reaction_time = reaction_time

        # Conversion curve: product forms during the REACTION stage.
        if STAGE_KEYS.index(stage) < STAGE_KEYS.index("REACTION"):
            yield_so_far = 0.0
        elif stage == "REACTION":
            yield_so_far = observed * (1.0 - float(np.exp(-2.6 * stage_progress)))
        else:
            yield_so_far = observed

        status = {
            "INITIALIZING": "standby",
            "HEATING": "ramping",
            "STABILIZING": "holding",
            "REACTION": "converting",
            "ANALYZING": "measuring",
            "COMPLETE": "complete",
        }[stage]

        frames.append(
            {
                "t_ms": t_ms,
                "progress": round(progress * 100.0, 2),
                "stage": stage,
                "stage_progress": round(stage_progress * 100.0, 2),
                "temperature": round(temperature, 2),
                "pressure": round(max(pressure, 1.0), 2),
                "reaction_time_elapsed": round(elapsed_reaction_time, 2),
                "reaction_time_target": reaction_time,
                "yield_so_far": round(yield_so_far, 2),
                "predicted_yield": round(predicted, 2),
                "status": status,
            }
        )

    # --- stage statuses for the finished run ------------------------------- #
    for entry in stage_table:
        entry["status"] = "complete"

    delta = observed - predicted
    return {
        "experiment": {
            "temperature": target_temperature,
            "pressure": target_pressure,
            "catalyst": str(experiment["catalyst"]),
            "concentration": float(experiment["concentration"]),
            "reaction_time": reaction_time,
        },
        "predicted_yield": round(predicted, 2),
        "uncertainty_std": round(float(uncertainty_std), 2),
        "observed_yield": round(observed, 2),
        "prediction_error": round(delta, 2),
        "stages": stage_table,
        "frames": frames,
        "total_duration_ms": total_ms,
        "frame_interval_ms": frame_interval_ms,
        "factor_contributions": factor_contributions(
            target_temperature,
            target_pressure,
            str(experiment["catalyst"]),
            float(experiment["concentration"]),
            reaction_time,
        ),
        "safety": {
            "flags": health,
            "envelope_violations": envelope_violations(experiment),
            "within_comfortable_window": not envelope_violations(experiment),
        },
        "summary": (
            f"Virtual run finished in {total_ms / 1000:.1f} s of animation time "
            f"(simulated set-point {target_temperature:.0f} degC / {target_pressure:.1f} bar / "
            f"{reaction_time:.0f} min). Predicted {predicted:.1f}% yield, "
            f"simulator surrogate measured {observed:.1f}% ({delta:+.1f} points)."
        ),
        "units": UNITS,
        "disclaimer": (
            "Virtual simulation for demonstration only - not a real laboratory "
            "control system and not a validated experimental result."
        ),
    }
