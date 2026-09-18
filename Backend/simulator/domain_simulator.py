"""
Domain-specific virtual experiment simulators.

Each domain has its own stage sequence and simulation logic.
"""

from __future__ import annotations

import hashlib
from typing import Any, Dict, List

import numpy as np

from config import settings


# Import domain functions
from solar_domain import (
    RANGES as SOLAR_RANGES,
    TARGET_MIN as SOLAR_MIN,
    TARGET_MAX as SOLAR_MAX,
    solar_efficiency,
)
from plant_domain import (
    RANGES as PLANT_RANGES,
    TARGET_MIN as PLANT_MIN,
    TARGET_MAX as PLANT_MAX,
    biomass_yield,
)
from battery_domain import (
    RANGES as BATTERY_RANGES,
    TARGET_MIN as BATTERY_MIN,
    TARGET_MAX as BATTERY_MAX,
    capacity_retention_percent,
)
from water_domain import (
    RANGES as WATER_RANGES,
    TARGET_MIN as WATER_MIN,
    TARGET_MAX as WATER_MAX,
    turbidity_removal_percent,
)
from domain import (
    RANGES as REACTION_RANGES,
    TARGET_MIN as REACTION_MIN,
    TARGET_MAX as REACTION_MAX,
    reaction_yield,
    envelope_violations as reaction_envelope_violations,
    factor_contributions as reaction_factor_contributions,
)


AMBIENT_TEMPERATURE = 25.0
BASE_DURATION_MS = 13000
FRAME_INTERVAL_MS = 200


def _seed_for(experiment: dict, domain: str) -> int:
    """Stable seed so the same experiment always replays identically."""
    if domain == "solar_efficiency":
        keys = ["cell_thickness_nm", "doping_concentration", "annealing_temperature_c", "light_intensity_lux", "operating_temperature_c"]
    elif domain == "plant_growth":
        keys = ["light_intensity_lux", "co2_concentration_ppm", "nutrient_concentration_mm", "temperature_c", "water_supply_ml_day"]
    elif domain == "battery_performance":
        keys = ["electrolyte_concentration_m", "charging_rate_c", "operating_temperature_c", "discharge_rate_c", "cycle_count"]
    elif domain == "water_purification":
        keys = ["coagulant_dose_mg_l", "ph", "contact_time_min", "temperature_c", "mixing_speed_rpm"]
    else:
        keys = ["temperature", "pressure", "concentration", "reaction_time"]

    key = "|".join(f"{k}={float(experiment.get(k, 0)):.4f}" for k in keys)
    return int(hashlib.sha256(key.encode("utf-8")).hexdigest()[:8], 16)


# Stage definitions per domain
DOMAIN_STAGES = {
    "reaction_yield": [
        ("INITIALIZING", "Initializing", 0.08, "Sealing vessel, purging headspace, running sensor checks"),
        ("HEATING", "Heating", 0.22, "Ramping jacket temperature to the set-point"),
        ("STABILIZING", "Stabilizing", 0.10, "Holding set-point, checking thermal drift"),
        ("REACTION", "Reaction", 0.42, "Charging catalyst feed and monitoring conversion"),
        ("ANALYZING", "Analyzing", 0.12, "Quenching, sampling and quantifying product"),
        ("COMPLETE", "Complete", 0.06, "Run finished, results handed to the ranking service"),
    ],
    "solar_efficiency": [
        ("INITIALIZE", "Initialize", 0.08, "Setting up cell parameters and environmental controls"),
        ("SET_ENVIRONMENT", "Set Environment", 0.15, "Configuring temperature and light conditions"),
        ("APPLY_LIGHT", "Apply Light", 0.30, "Shining light source and measuring response"),
        ("MEASURE_OUTPUT", "Measure Output", 0.25, "Recording voltage, current and efficiency"),
        ("ANALYZE", "Analyze", 0.12, "Analyzing cell performance data"),
        ("COMPLETE", "Complete", 0.10, "Run finished, results recorded"),
    ],
    "plant_growth": [
        ("PREPARE_ENVIRONMENT", "Prepare Environment", 0.10, "Setting up growth chamber conditions"),
        ("SET_LIGHT", "Set Light", 0.12, "Configuring light intensity and spectrum"),
        ("SET_CO2", "Set CO₂", 0.10, "Adjusting CO₂ concentration"),
        ("APPLY_NUTRIENTS", "Apply Nutrients", 0.13, "Adding nutrient solution"),
        ("WATERING", "Watering", 0.10, "Setting water supply schedule"),
        ("GROWTH_SIMULATION", "Growth Simulation", 0.35, "Simulating plant growth over time"),
        ("ANALYZE", "Analyze", 0.08, "Measuring biomass and health indicators"),
        ("COMPLETE", "Complete", 0.02, "Growth run complete, results recorded"),
    ],
    "battery_performance": [
        ("INITIALIZE_CELL", "Initialize Cell", 0.08, "Preparing battery cell for test"),
        ("SET_TEMPERATURE", "Set Temperature", 0.12, "Stabilizing operating temperature"),
        ("CHARGE", "Charge", 0.25, "Charging cell at specified rate"),
        ("REST", "Rest", 0.10, "Rest period for cell stabilization"),
        ("DISCHARGE", "Discharge", 0.25, "Discharging cell at specified rate"),
        ("CYCLE_ANALYSIS", "Cycle Analysis", 0.12, "Analyzing cycle performance data"),
        ("COMPLETE", "Complete", 0.08, "Test complete, capacity retention calculated"),
    ],
    "water_purification": [
        ("PREPARE_SAMPLE", "Prepare Sample", 0.10, "Collecting and measuring raw water sample"),
        ("ADD_COAGULANT", "Add Coagulant", 0.12, "Dosing coagulant into water sample"),
        ("ADJUST_PH", "Adjust pH", 0.10, "Adjusting pH to optimal level"),
        ("MIX", "Mix", 0.15, "Mixing water at specified speed"),
        ("CONTACT_PERIOD", "Contact Period", 0.28, "Maintaining contact time for coagulation"),
        ("MEASURE_TURBIDITY", "Measure Turbidity", 0.15, "Measuring final turbidity levels"),
        ("ANALYZE", "Analyze", 0.07, "Analyzing purification effectiveness"),
        ("COMPLETE", "Complete", 0.03, "Purification run complete, removal calculated"),
    ],
}


def _get_stage_keys(domain: str) -> List[str]:
    return [s[0] for s in DOMAIN_STAGES[domain]]


def _get_ranges(domain: str):
    if domain == "solar_efficiency":
        return SOLAR_RANGES
    elif domain == "plant_growth":
        return PLANT_RANGES
    elif domain == "battery_performance":
        return BATTERY_RANGES
    elif domain == "water_purification":
        return WATER_RANGES
    else:
        return REACTION_RANGES


def _get_target_bounds(domain: str):
    if domain == "solar_efficiency":
        return SOLAR_MIN, SOLAR_MAX
    elif domain == "plant_growth":
        return PLANT_MIN, PLANT_MAX
    elif domain == "battery_performance":
        return BATTERY_MIN, BATTERY_MAX
    elif domain == "water_purification":
        return WATER_MIN, WATER_MAX
    else:
        return REACTION_MIN, REACTION_MAX


def _get_simulate_func(domain: str):
    if domain == "solar_efficiency":
        return solar_efficiency
    elif domain == "plant_growth":
        return biomass_yield
    elif domain == "battery_performance":
        return capacity_retention_percent
    elif domain == "water_purification":
        return turbidity_removal_percent
    else:
        return reaction_yield


def simulate(
    experiment: dict,
    *,
    domain: str = "reaction_yield",
    predicted_target: float = 0.0,
    uncertainty_std: float = 0.0,
    speed: float = 1.0,
    frame_interval_ms: int = FRAME_INTERVAL_MS,
    base_duration_ms: int = BASE_DURATION_MS,
) -> Dict[str, Any]:
    """Build the full simulation timeline for one experiment in any domain."""

    ranges = _get_ranges(domain)
    target_min, target_max = _get_target_bounds(domain)
    simulate_func = _get_simulate_func(domain)
    stage_keys = _get_stage_keys(domain)

    speed = max(float(speed), 0.1)
    total_ms = int(base_duration_ms / speed)

    # Validate ranges
    for name, (low, high) in ranges.items():
        if name in experiment:
            value = float(experiment[name])
            if not (low <= value <= high):
                raise ValueError(f"{name}={value:g} is outside the supported range [{low:g}, {high:g}]")

    rng = np.random.default_rng(_seed_for(experiment, domain))

    # Get observed value from domain surrogate
    observed = simulate_func(
        **{k: float(experiment[k]) for k in experiment if k in ranges},
        noise_sd=1.6,
        rng=rng,
    )
    observed = float(np.clip(observed, target_min, target_max))
    predicted = float(np.clip(predicted_target, target_min, target_max))

    # Build stage table
    stage_plan = DOMAIN_STAGES[domain]
    stage_table: List[dict] = []
    cursor_ms = 0
    for key, label, share, description in stage_plan:
        duration_ms = int(round(total_ms * share))
        stage_table.append({
            "stage": key,
            "label": label,
            "description": description,
            "start_ms": cursor_ms,
            "duration_ms": duration_ms,
            "log": _get_stage_logs(key, experiment, domain),
            "status": "pending",
        })
        cursor_ms += duration_ms
    total_ms = cursor_ms

    # Generate frames
    frames = []
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
            if stage != stage_keys[-1]
            else 1.0
        )

        frame = {
            "t_ms": t_ms,
            "progress": round(progress * 100.0, 2),
            "stage": stage,
            "stage_progress": round(stage_progress * 100.0, 2),
            "predicted_target": round(predicted, 2),
            "uncertainty_std": round(float(uncertainty_std), 2),
        }

        frame.update(_get_stage_values(stage, stage_progress, experiment, domain, observed, stage_keys))
        frames.append(frame)

    for entry in stage_table:
        entry["status"] = "complete"

    delta = observed - predicted
    return {
        "experiment": {k: float(experiment.get(k, 0)) for k in experiment},
        "predicted_target": round(predicted, 2),
        "uncertainty_std": round(float(uncertainty_std), 2),
        "observed_target": round(observed, 2),
        "prediction_error": round(delta, 2),
        "stages": stage_table,
        "frames": frames,
        "total_duration_ms": total_ms,
        "frame_interval_ms": frame_interval_ms,
        "domain": domain,
        "target_unit": _get_target_unit(domain),
        "safety": {
            "flags": _get_safety_flags(experiment, domain),
            "envelope_violations": _get_envelope_violations(experiment, domain),
            "within_comfortable_window": not _get_envelope_violations(experiment, domain),
        },
        "summary": _get_summary(experiment, predicted, observed, delta, domain, total_ms),
        "disclaimer": "Virtual simulation for demonstration only - not a real laboratory control system and not a validated experimental result.",
    }


def _get_stage_logs(stage: str, experiment: dict, domain: str) -> List[str]:
    """Get log lines for a stage."""
    logs_map = {
        "reaction_yield": {
            "INITIALIZING": ["reactor sealed, headspace purged with inert gas", "sensor check OK"],
            "HEATING": ["jacket ramp engaged", "charge prepared"],
            "STABILIZING": ["thermal drift inside tolerance", "pressurized to target"],
            "REACTION": ["catalyst charged", "reaction clock started"],
            "ANALYZING": ["quench applied, mixture sampled", "quantifying product"],
            "COMPLETE": ["run complete, data archived"],
        },
        "solar_efficiency": {
            "INITIALIZE": ["cell parameters loaded", "environmental controls initialized"],
            "SET_ENVIRONMENT": ["temperature stabilized at setpoint", "light chamber configured"],
            "APPLY_LIGHT": ["light source activated at target intensity", "monitoring cell response"],
            "MEASURE_OUTPUT": ["recording voltage and current", "calculating efficiency metrics"],
            "ANALYZE": ["analyzing IV curve data", "computing conversion efficiency"],
            "COMPLETE": ["solar cell test complete", "results recorded"],
        },
        "plant_growth": {
            "PREPARE_ENVIRONMENT": ["growth chamber initialized", "environmental sensors calibrated"],
            "SET_LIGHT": ["light intensity set to target", "light spectrum configured"],
            "SET_CO2": ["CO₂ concentration adjusted", "gas flow stabilized"],
            "APPLY_NUTRIENTS": ["nutrient solution prepared", "nutrients added to growth medium"],
            "WATERING": ["water supply configured", "irrigation schedule set"],
            "GROWTH_SIMULATION": ["growth cycle initiated", "monitoring plant development"],
            "ANALYZE": ["measuring biomass", "assessing plant health indicators"],
            "COMPLETE": ["growth run complete", "biomass yield recorded"],
        },
        "battery_performance": {
            "INITIALIZE_CELL": ["battery cell connected", "test equipment calibrated"],
            "SET_TEMPERATURE": ["temperature chamber stabilized", "cell at operating temperature"],
            "CHARGE": ["charge cycle initiated", "charging at specified C-rate"],
            "REST": ["cell resting", "voltage stabilizing"],
            "DISCHARGE": ["discharge cycle initiated", "discharging at specified C-rate"],
            "CYCLE_ANALYSIS": ["analyzing cycle data", "computing capacity retention"],
            "COMPLETE": ["battery test complete", "capacity retention calculated"],
        },
        "water_purification": {
            "PREPARE_SAMPLE": ["water sample collected", "initial turbidity measured"],
            "ADD_COAGULANT": ["coagulant dosed into sample", "chemical added at target concentration"],
            "ADJUST_PH": ["pH adjusted to target", "pH stabilized"],
            "MIX": ["mixing initiated at target speed", "homogenizing suspension"],
            "CONTACT_PERIOD": ["contact time maintained", "floc formation in progress"],
            "MEASURE_TURBIDITY": ["final turbidity measured", "comparing to initial turbidity"],
            "ANALYZE": ["analyzing purification data", "computing turbidity removal"],
            "COMPLETE": ["purification run complete", "removal percentage recorded"],
        },
    }
    return logs_map.get(domain, {}).get(stage, ["stage active"])


def _get_stage_values(stage: str, stage_progress: float, experiment: dict, domain: str, observed: float, stage_keys: List[str]) -> dict:
    """Get stage-specific values for a frame."""
    values = {
        "temperature": 25.0,
        "progress_value": 0.0,
    }

    if domain == "solar_efficiency":
        values = _solar_stage_values(stage, stage_progress, experiment, observed)
    elif domain == "plant_growth":
        values = _plant_stage_values(stage, stage_progress, experiment, observed)
    elif domain == "battery_performance":
        values = _battery_stage_values(stage, stage_progress, experiment, observed)
    elif domain == "water_purification":
        values = _water_stage_values(stage, stage_progress, experiment, observed)
    else:
        values = _reaction_stage_values(stage, stage_progress, experiment, observed)

    return values


def _solar_stage_values(stage: str, stage_progress: float, experiment: dict, observed: float) -> dict:
    target_temp = float(experiment.get("operating_temperature_c", 25))
    target_light = float(experiment.get("light_intensity_lux", 50000))

    if stage == "INITIALIZE":
        return {"light_intensity": 0, "cell_temperature": 25.0, "output_power": 0.0}
    elif stage == "SET_ENVIRONMENT":
        return {"light_intensity": 0, "cell_temperature": target_temp * stage_progress, "output_power": 0.0}
    elif stage == "APPLY_LIGHT":
        light = target_light * stage_progress
        return {"light_intensity": light, "cell_temperature": target_temp, "output_power": 0.0}
    elif stage == "MEASURE_OUTPUT":
        output = observed * (1 - np.exp(-3 * stage_progress))
        return {"light_intensity": target_light, "cell_temperature": target_temp, "output_power": output}
    elif stage == "ANALYZE":
        return {"light_intensity": target_light, "cell_temperature": target_temp, "output_power": observed}
    else:
        return {"light_intensity": target_light, "cell_temperature": target_temp, "output_power": observed}


def _plant_stage_values(stage: str, stage_progress: float, experiment: dict, observed: float) -> dict:
    target_light = float(experiment.get("light_intensity_lux", 35000))
    target_co2 = float(experiment.get("co2_concentration_ppm", 800))
    target_water = float(experiment.get("water_supply_ml_day", 250))

    if stage == "PREPARE_ENVIRONMENT":
        return {"light_intensity": 0, "co2_concentration": 400, "water_supply": 0, "biomass": 0.0}
    elif stage == "SET_LIGHT":
        return {"light_intensity": target_light * stage_progress, "co2_concentration": 400, "water_supply": 0, "biomass": 0.0}
    elif stage == "SET_CO2":
        return {"light_intensity": target_light, "co2_concentration": target_co2 * stage_progress + 400 * (1 - stage_progress), "water_supply": 0, "biomass": 0.0}
    elif stage == "APPLY_NUTRIENTS":
        return {"light_intensity": target_light, "co2_concentration": target_co2, "water_supply": 0, "biomass": 0.0}
    elif stage == "WATERING":
        return {"light_intensity": target_light, "co2_concentration": target_co2, "water_supply": target_water * stage_progress, "biomass": 0.0}
    elif stage == "GROWTH_SIMULATION":
        growth = observed * (1 - np.exp(-2 * stage_progress))
        return {"light_intensity": target_light, "co2_concentration": target_co2, "water_supply": target_water, "biomass": growth}
    elif stage == "ANALYZE":
        return {"light_intensity": target_light, "co2_concentration": target_co2, "water_supply": target_water, "biomass": observed}
    else:
        return {"light_intensity": target_light, "co2_concentration": target_co2, "water_supply": target_water, "biomass": observed}


def _battery_stage_values(stage: str, stage_progress: float, experiment: dict, observed: float) -> dict:
    target_temp = float(experiment.get("operating_temperature_c", 22))
    target_charge = float(experiment.get("charging_rate_c", 0.6))
    target_discharge = float(experiment.get("discharge_rate_c", 0.6))

    if stage == "INITIALIZE_CELL":
        return {"temperature": target_temp, "charge_rate": 0, "discharge_rate": 0, "capacity": 0.0, "voltage": 3.0}
    elif stage == "SET_TEMPERATURE":
        return {"temperature": target_temp * stage_progress, "charge_rate": 0, "discharge_rate": 0, "capacity": 0.0, "voltage": 3.0}
    elif stage == "CHARGE":
        return {"temperature": target_temp, "charge_rate": target_charge, "discharge_rate": 0, "capacity": observed * 0.5 * stage_progress, "voltage": 4.2 * stage_progress}
    elif stage == "REST":
        return {"temperature": target_temp, "charge_rate": 0, "discharge_rate": 0, "capacity": observed * 0.5, "voltage": 3.7}
    elif stage == "DISCHARGE":
        discharge_capacity = observed * stage_progress
        return {"temperature": target_temp, "charge_rate": 0, "discharge_rate": target_discharge, "capacity": discharge_capacity, "voltage": 3.7 - 0.7 * stage_progress}
    elif stage == "CYCLE_ANALYSIS":
        return {"temperature": target_temp, "charge_rate": 0, "discharge_rate": 0, "capacity": observed, "voltage": 3.0}
    else:
        return {"temperature": target_temp, "charge_rate": 0, "discharge_rate": 0, "capacity": observed, "voltage": 3.0}


def _water_stage_values(stage: str, stage_progress: float, experiment: dict, observed: float) -> dict:
    target_dose = float(experiment.get("coagulant_dose_mg_l", 40))
    target_ph = float(experiment.get("ph", 6.8))
    target_contact = float(experiment.get("contact_time_min", 45))
    target_mixing = float(experiment.get("mixing_speed_rpm", 120))

    if stage == "PREPARE_SAMPLE":
        return {"turbidity": 100.0, "coagulant_dose": 0, "ph": 7.0, "mixing_speed": 0, "removal": 0.0}
    elif stage == "ADD_COAGULANT":
        return {"turbidity": 100.0, "coagulant_dose": target_dose * stage_progress, "ph": 7.0, "mixing_speed": 0, "removal": 0.0}
    elif stage == "ADJUST_PH":
        return {"turbidity": 100.0, "coagulant_dose": target_dose, "ph": target_ph * stage_progress + 7.0 * (1 - stage_progress), "mixing_speed": 0, "removal": 0.0}
    elif stage == "MIX":
        return {"turbidity": 100.0, "coagulant_dose": target_dose, "ph": target_ph, "mixing_speed": target_mixing * stage_progress, "removal": 0.0}
    elif stage == "CONTACT_PERIOD":
        removal = observed * (1 - np.exp(-2.5 * stage_progress))
        return {"turbidity": 100.0 - removal, "coagulant_dose": target_dose, "ph": target_ph, "mixing_speed": target_mixing, "removal": removal}
    elif stage == "MEASURE_TURBIDITY":
        return {"turbidity": 100.0 - observed, "coagulant_dose": target_dose, "ph": target_ph, "mixing_speed": 0, "removal": observed}
    elif stage == "ANALYZE":
        return {"turbidity": 100.0 - observed, "coagulant_dose": target_dose, "ph": target_ph, "mixing_speed": 0, "removal": observed}
    else:
        return {"turbidity": 100.0 - observed, "coagulant_dose": target_dose, "ph": target_ph, "mixing_speed": 0, "removal": observed}


def _reaction_stage_values(stage: str, stage_progress: float, experiment: dict, observed: float) -> dict:
    target_temp = float(experiment.get("temperature", 90))
    target_pressure = float(experiment.get("pressure", 2))

    if stage == "INITIALIZING":
        return {"temperature": 25 + 4 * stage_progress, "pressure": 1.0, "yield_so_far": 0.0}
    elif stage == "HEATING":
        temp = target_temp - (target_temp - 25) * np.exp(-4 * stage_progress)
        return {"temperature": temp, "pressure": 1 + (target_pressure - 1) * stage_progress**1.4, "yield_so_far": 0.0}
    elif stage == "STABILIZING":
        temp = target_temp + 1.2 * np.sin(stage_progress * 6) * (1 - stage_progress)
        return {"temperature": temp, "pressure": target_pressure, "yield_so_far": 0.0}
    elif stage == "REACTION":
        temp = target_temp + 0.8 * np.sin(stage_progress * 12)
        yield_so_far = observed * (1 - np.exp(-2.6 * stage_progress))
        return {"temperature": temp, "pressure": target_pressure, "yield_so_far": yield_so_far}
    elif stage == "ANALYZING":
        temp = target_temp - (target_temp - 40) * np.exp(-3 * stage_progress)
        return {"temperature": temp, "pressure": max(target_pressure * (1 - 0.85 * stage_progress), 1.0), "yield_so_far": observed}
    else:
        return {"temperature": 40, "pressure": 1.0, "yield_so_far": observed}


def _get_safety_flags(experiment: dict, domain: str) -> List[str]:
    flags = []
    ranges = _get_ranges(domain)

    for name, (low, high) in ranges.items():
        if name in experiment:
            value = float(experiment[name])
            if value < low * 0.8:
                flags.append(f"LOW {name.upper()} - {value:g} below minimum {low:g}")
            elif value > high * 1.2:
                flags.append(f"HIGH {name.upper()} - {value:g} above maximum {high:g}")

    return flags if flags else ["all monitored variables inside operating range"]


def _get_envelope_violations(experiment: dict, domain: str) -> List[str]:
    if domain == "reaction_yield":
        from domain import envelope_violations
        return envelope_violations(experiment)
    elif domain == "solar_efficiency":
        from solar_domain import envelope_violations
        return envelope_violations(experiment)
    elif domain == "plant_growth":
        from plant_domain import envelope_violations
        return envelope_violations(experiment)
    elif domain == "battery_performance":
        from battery_domain import envelope_violations
        return envelope_violations(experiment)
    elif domain == "water_purification":
        from water_domain import envelope_violations
        return envelope_violations(experiment)
    return []


def _get_target_unit(domain: str) -> str:
    units = {
        "reaction_yield": "%",
        "solar_efficiency": "%",
        "plant_growth": "g",
        "battery_performance": "%",
        "water_purification": "%",
    }
    return units.get(domain, "%")


def _get_summary(experiment: dict, predicted: float, observed: float, delta: float, domain: str, duration_ms: int) -> str:
    target_units = {
        "reaction_yield": "yield",
        "solar_efficiency": "conversion efficiency",
        "plant_growth": "biomass",
        "battery_performance": "capacity retention",
        "water_purification": "turbidity removal",
    }
    target = target_units.get(domain, "result")

    return (
        f"Virtual run finished in {duration_ms / 1000:.1f}s of animation time. "
        f"Predicted {target} {predicted:.1f}%, simulator surrogate measured {observed:.1f}% ({delta:+.1f} points)."
    )
