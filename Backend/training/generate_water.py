"""
Synthetic prototype dataset generator for Water Purification.

Run from the backend directory:

    python training/generate_water.py
    python training/generate_water.py --rows 5000 --seed 7
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

from water_domain import (
    DATASET_PROVENANCE,
    FEATURE_NAMES,
    NOISE_SD,
    RANGES,
    TARGET_NAME,
    TARGET_MIN,
    TARGET_MAX,
    turbidity_removal_percent,
)

DEFAULT_ROWS = 4000
DEFAULT_SEED = 42
DEFAULT_OUTPUT = Path(__file__).resolve().parent / "water_purification_training.csv"


def generate_dataset(
    rows: int = DEFAULT_ROWS,
    seed: int = DEFAULT_SEED,
    noise_sd: float = NOISE_SD,
) -> pd.DataFrame:
    """Build the synthetic water purification dataset."""
    if rows <= 0:
        raise ValueError("rows must be positive")

    rng = np.random.default_rng(seed)
    n_focus = int(rows * 0.35)
    n_uniform = rows - n_focus

    # Uniform coverage
    dose = rng.uniform(*RANGES["coagulant_dose_mg_l"], n_uniform)
    ph = rng.uniform(*RANGES["ph"], n_uniform)
    contact = rng.uniform(*RANGES["contact_time_min"], n_uniform)
    temp = rng.uniform(*RANGES["temperature_c"], n_uniform)
    mixing = rng.uniform(*RANGES["mixing_speed_rpm"], n_uniform)

    # Focused sampling around optimal regions
    focus_dose = np.clip(rng.normal(40.0, 12.0, n_focus), *RANGES["coagulant_dose_mg_l"])
    focus_ph = np.clip(rng.normal(6.8, 0.8, n_focus), *RANGES["ph"])
    focus_contact = np.clip(rng.gamma(shape=2.0, scale=20.0, size=n_focus), *RANGES["contact_time_min"])
    focus_temp = np.clip(rng.normal(18.0, 6.0, n_focus), *RANGES["temperature_c"])
    focus_mixing = np.clip(rng.normal(120.0, 30.0, n_focus), *RANGES["mixing_speed_rpm"])

    frame = pd.DataFrame(
        {
            "coagulant_dose_mg_l": np.concatenate([dose, focus_dose]),
            "ph": np.concatenate([ph, focus_ph]),
            "contact_time_min": np.concatenate([contact, focus_contact]),
            "temperature_c": np.concatenate([temp, focus_temp]),
            "mixing_speed_rpm": np.concatenate([mixing, focus_mixing]),
        }
    )

    frame[TARGET_NAME] = [
        turbidity_removal_percent(
            row.coagulant_dose_mg_l,
            row.ph,
            row.contact_time_min,
            row.temperature_c,
            row.mixing_speed_rpm,
            noise_sd=noise_sd,
            rng=rng,
        )
        for row in frame.itertuples(index=False)
    ]

    for column in FEATURE_NAMES + [TARGET_NAME]:
        frame[column] = frame[column].astype(float).round(4)

    frame = frame.sample(frac=1.0, random_state=seed).reset_index(drop=True)
    frame.insert(0, "experiment_id", [f"WAT-{i:05d}" for i in range(1, len(frame) + 1)])
    frame["source"] = DATASET_PROVENANCE

    return frame[["experiment_id", *FEATURE_NAMES, TARGET_NAME, "source"]]


def describe(frame: pd.DataFrame) -> None:
    """Print dataset report."""
    line = "=" * 78
    print(line)
    print("WATER PURIFICATION — SYNTHETIC PROTOTYPE DATASET")
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
    print(f"removal range   : {target.min():.2f} .. {target.max():.2f} %")
    print(f"removal mean    : {target.mean():.2f} %")
    print(f"missing values  : {int(frame.isna().sum().sum())}")
    print(f"out-of-range    : {int(((target < TARGET_MIN) | (target > TARGET_MAX)).sum())}")
    print(line)


def main(argv: list[str] | None = None) -> int:
    parser = argparse.ArgumentParser(description="Generate water purification training dataset.")
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
