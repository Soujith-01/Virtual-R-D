"""
Synthetic prototype dataset generator for Battery Performance.

Run from the backend directory:

    python training/generate_battery.py
    python training/generate_battery.py --rows 5000 --seed 7
"""

from __future__ import annotations

import argparse
import sys
from pathlib import Path

import numpy as np
import pandas as pd

BACKEND_ROOT = Path(__file__).resolve().parents[1]
if str(BACKEND_ROOT) not in sys.path:
    sys.path.insert(0, str(BACKEND_ROOT))

from battery_domain import (
    DATASET_PROVENANCE,
    FEATURE_NAMES,
    NOISE_SD,
    RANGES,
    TARGET_NAME,
    TARGET_MIN,
    TARGET_MAX,
    capacity_retention_percent,
)

DEFAULT_ROWS = 4000
DEFAULT_SEED = 42
DEFAULT_OUTPUT = Path(__file__).resolve().parent / "battery_performance_training.csv"


def generate_dataset(
    rows: int = DEFAULT_ROWS,
    seed: int = DEFAULT_SEED,
    noise_sd: float = NOISE_SD,
) -> pd.DataFrame:
    """Build the synthetic battery performance dataset."""
    if rows <= 0:
        raise ValueError("rows must be positive")

    rng = np.random.default_rng(seed)
    n_focus = int(rows * 0.35)
    n_uniform = rows - n_focus

    # Uniform coverage
    electrolyte = rng.uniform(*RANGES["electrolyte_concentration_m"], n_uniform)
    charge = rng.uniform(*RANGES["charging_rate_c"], n_uniform)
    temp = rng.uniform(*RANGES["operating_temperature_c"], n_uniform)
    discharge = rng.uniform(*RANGES["discharge_rate_c"], n_uniform)
    cycles = rng.uniform(*RANGES["cycle_count"], n_uniform)

    # Focused sampling around optimal regions
    focus_electrolyte = np.clip(rng.normal(1.4, 0.3, n_focus), *RANGES["electrolyte_concentration_m"])
    focus_charge = np.clip(rng.normal(0.6, 0.3, n_focus), *RANGES["charging_rate_c"])
    focus_temp = np.clip(rng.normal(22.0, 6.0, n_focus), *RANGES["operating_temperature_c"])
    focus_discharge = np.clip(rng.normal(0.6, 0.3, n_focus), *RANGES["discharge_rate_c"])
    focus_cycles = rng.uniform(20.0, 250.0, n_focus)

    frame = pd.DataFrame(
        {
            "electrolyte_concentration_m": np.concatenate([electrolyte, focus_electrolyte]),
            "charging_rate_c": np.concatenate([charge, focus_charge]),
            "operating_temperature_c": np.concatenate([temp, focus_temp]),
            "discharge_rate_c": np.concatenate([discharge, focus_discharge]),
            "cycle_count": np.concatenate([cycles, focus_cycles]),
        }
    )

    frame[TARGET_NAME] = [
        capacity_retention_percent(
            row.electrolyte_concentration_m,
            row.charging_rate_c,
            row.operating_temperature_c,
            row.discharge_rate_c,
            row.cycle_count,
            noise_sd=noise_sd,
            rng=rng,
        )
        for row in frame.itertuples(index=False)
    ]

    for column in FEATURE_NAMES + [TARGET_NAME]:
        frame[column] = frame[column].astype(float).round(4)

    frame = frame.sample(frac=1.0, random_state=seed).reset_index(drop=True)
    frame.insert(0, "experiment_id", [f"BAT-{i:05d}" for i in range(1, len(frame) + 1)])
    frame["source"] = DATASET_PROVENANCE

    return frame[["experiment_id", *FEATURE_NAMES, TARGET_NAME, "source"]]


def describe(frame: pd.DataFrame) -> None:
    """Print dataset report."""
    line = "=" * 78
    print(line)
    print("BATTERY PERFORMANCE — SYNTHETIC PROTOTYPE DATASET")
    print(line)
    print("DISCLAIMER: simulated data for workflow demonstration only.")
    print("            Not validated real-world experimental results.\n")

    print(f"shape: {frame.shape}  (rows x columns)")
    print(f"columns: {list(frame.columns)}\n")

    print("--- first 5 rows ---")
    print(frame.head(5).to_string(index=False))
    print()

    print("--- descriptive statistics ---")
    print(frame[FEATURE_NAMES + [TARGET_NAME]].describe().round(3).to_string())
    print()

    target = frame[TARGET_NAME]
    print("--- target sanity checks ---")
    print(f"retention range : {target.min():.2f} .. {target.max():.2f} %")
    print(f"retention mean  : {target.mean():.2f} %")
    print(f"missing values  : {int(frame.isna().sum().sum())}")
    print(f"out-of-range    : {int(((target < TARGET_MIN) | (target > TARGET_MAX)).sum())}")
    print(line)


def main(argv: list[str] | None = None) -> int:
    parser = argparse.ArgumentParser(description="Generate battery performance training dataset.")
    parser.add_argument("--rows", type=int, default=DEFAULT_ROWS, help="number of records")
    parser.add_argument("--seed", type=int, default=DEFAULT_SEED, help="random seed")
    parser.add_argument("--noise", type=float, default=NOISE_SD, help="measurement noise std")
    parser.add_argument("--output", type=Path, default=DEFAULT_OUTPUT, help="output CSV path")
    args = parser.parse_args(argv)

    frame = generate_dataset(rows=args.rows, seed=args.seed, noise_sd=args.noise)
    args.output.parent.mkdir(parents=True, exist_ok=True)
    frame.to_csv(args.output, index=False)
    print(f"\nsaved -> {args.output}")
    describe(frame)
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
