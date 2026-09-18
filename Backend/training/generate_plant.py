"""
Synthetic prototype dataset generator for Plant Growth Optimization.

Run from the backend directory:

    python training/generate_plant.py
    python training/generate_plant.py --rows 5000 --seed 7
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

from plant_domain import (
    DATASET_PROVENANCE,
    FEATURE_NAMES,
    NOISE_SD,
    RANGES,
    TARGET_NAME,
    TARGET_MIN,
    TARGET_MAX,
    biomass_yield,
)

DEFAULT_ROWS = 4000
DEFAULT_SEED = 42
DEFAULT_OUTPUT = Path(__file__).resolve().parent / "plant_growth_training.csv"


def generate_dataset(
    rows: int = DEFAULT_ROWS,
    seed: int = DEFAULT_SEED,
    noise_sd: float = NOISE_SD,
) -> pd.DataFrame:
    """Build the synthetic plant growth dataset."""
    if rows <= 0:
        raise ValueError("rows must be positive")

    rng = np.random.default_rng(seed)
    n_focus = int(rows * 0.35)
    n_uniform = rows - n_focus

    # Uniform coverage
    light = rng.uniform(*RANGES["light_intensity_lux"], n_uniform)
    co2 = rng.uniform(*RANGES["co2_concentration_ppm"], n_uniform)
    nutrient = rng.uniform(*RANGES["nutrient_concentration_mm"], n_uniform)
    temp = rng.uniform(*RANGES["temperature_c"], n_uniform)
    water = rng.uniform(*RANGES["water_supply_ml_day"], n_uniform)

    # Focused sampling around optimal regions
    focus_light = np.clip(rng.normal(35000.0, 10000.0, n_focus), *RANGES["light_intensity_lux"])
    focus_co2 = np.clip(rng.normal(800.0, 120.0, n_focus), *RANGES["co2_concentration_ppm"])
    focus_nutrient = np.clip(rng.normal(4.0, 1.2, n_focus), *RANGES["nutrient_concentration_mm"])
    focus_temp = np.clip(rng.normal(26.0, 3.0, n_focus), *RANGES["temperature_c"])
    focus_water = rng.uniform(100.0, 450.0, n_focus)

    frame = pd.DataFrame(
        {
            "light_intensity_lux": np.concatenate([light, focus_light]),
            "co2_concentration_ppm": np.concatenate([co2, focus_co2]),
            "nutrient_concentration_mm": np.concatenate([nutrient, focus_nutrient]),
            "temperature_c": np.concatenate([temp, focus_temp]),
            "water_supply_ml_day": np.concatenate([water, focus_water]),
        }
    )

    frame[TARGET_NAME] = [
        biomass_yield(
            row.light_intensity_lux,
            row.co2_concentration_ppm,
            row.nutrient_concentration_mm,
            row.temperature_c,
            row.water_supply_ml_day,
            noise_sd=noise_sd,
            rng=rng,
        )
        for row in frame.itertuples(index=False)
    ]

    for column in FEATURE_NAMES + [TARGET_NAME]:
        frame[column] = frame[column].astype(float).round(4)

    frame = frame.sample(frac=1.0, random_state=seed).reset_index(drop=True)
    frame.insert(0, "experiment_id", [f"PLT-{i:05d}" for i in range(1, len(frame) + 1)])
    frame["source"] = DATASET_PROVENANCE

    return frame[["experiment_id", *FEATURE_NAMES, TARGET_NAME, "source"]]


def describe(frame: pd.DataFrame) -> None:
    """Print dataset report."""
    line = "=" * 78
    print(line)
    print("PLANT GROWTH OPTIMIZATION — SYNTHETIC PROTOTYPE DATASET")
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
    print(f"biomass range   : {target.min():.2f} .. {target.max():.2f} g")
    print(f"biomass mean    : {target.mean():.2f} g")
    print(f"missing values  : {int(frame.isna().sum().sum())}")
    print(f"out-of-range    : {int(((target < TARGET_MIN) | (target > TARGET_MAX)).sum())}")
    print(line)


def main(argv: list[str] | None = None) -> int:
    parser = argparse.ArgumentParser(description="Generate plant growth training dataset.")
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
