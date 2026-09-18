"""
Synthetic prototype dataset generator for Solar Panel Efficiency.

Run from the backend directory:

    python training/generate_solar.py
    python training/generate_solar.py --rows 5000 --seed 7
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

from solar_domain import (
    DATASET_PROVENANCE,
    FEATURE_NAMES,
    NOISE_SD,
    RANGES,
    TARGET_NAME,
    TARGET_MIN,
    TARGET_MAX,
    normalise_doping,
    solar_efficiency,
)

DEFAULT_ROWS = 4000
DEFAULT_SEED = 42
DEFAULT_OUTPUT = Path(__file__).resolve().parent / "solar_efficiency_training.csv"


def _doping_weights() -> np.ndarray:
    """Non-uniform doping sampling around optimal region."""
    return np.array([0.25, 0.35, 0.25, 0.15], dtype=float)


def generate_dataset(
    rows: int = DEFAULT_ROWS,
    seed: int = DEFAULT_SEED,
    noise_sd: float = NOISE_SD,
) -> pd.DataFrame:
    """Build the synthetic solar efficiency dataset."""
    if rows <= 0:
        raise ValueError("rows must be positive")

    rng = np.random.default_rng(seed)
    n_focus = int(rows * 0.35)
    n_uniform = rows - n_focus

    # Uniform coverage
    thickness = rng.uniform(*RANGES["cell_thickness_nm"], n_uniform)
    doping = 10 ** rng.uniform(
        np.log10(RANGES["doping_concentration"][0]),
        np.log10(RANGES["doping_concentration"][1]),
        n_uniform,
    )
    anneal = rng.uniform(*RANGES["annealing_temperature_c"], n_uniform)
    light = rng.uniform(*RANGES["light_intensity_lux"], n_uniform)
    op_temp = rng.uniform(*RANGES["operating_temperature_c"], n_uniform)

    # Focused sampling around optimal regions
    focus_thickness = np.clip(
        rng.normal(150.0, 40.0, n_focus),
        *RANGES["cell_thickness_nm"],
    )
    focus_doping = 10 ** np.clip(
        rng.normal(16.5, 0.5, n_focus),
        np.log10(RANGES["doping_concentration"][0]),
        np.log10(RANGES["doping_concentration"][1]),
    )
    focus_anneal = np.clip(
        rng.normal(700.0, 50.0, n_focus),
        *RANGES["annealing_temperature_c"],
    )
    focus_light = rng.uniform(40000.0, 100000.0, n_focus)
    focus_temp = np.clip(
        rng.normal(25.0, 8.0, n_focus),
        *RANGES["operating_temperature_c"],
    )

    frame = pd.DataFrame(
        {
            "cell_thickness_nm": np.concatenate([thickness, focus_thickness]),
            "doping_concentration": np.concatenate([doping, focus_doping]),
            "annealing_temperature_c": np.concatenate([anneal, focus_anneal]),
            "light_intensity_lux": np.concatenate([light, focus_light]),
            "operating_temperature_c": np.concatenate([op_temp, focus_temp]),
        }
    )

    frame[TARGET_NAME] = [
        solar_efficiency(
            row.cell_thickness_nm,
            row.doping_concentration,
            row.annealing_temperature_c,
            row.light_intensity_lux,
            row.operating_temperature_c,
            noise_sd=noise_sd,
            rng=rng,
        )
        for row in frame.itertuples(index=False)
    ]

    for column in FEATURE_NAMES + [TARGET_NAME]:
        frame[column] = frame[column].astype(float).round(6 if column == "doping_concentration" else 4)

    frame = frame.sample(frac=1.0, random_state=seed).reset_index(drop=True)
    frame.insert(0, "experiment_id", [f"SOL-{i:05d}" for i in range(1, len(frame) + 1)])
    frame["source"] = DATASET_PROVENANCE

    return frame[["experiment_id", *FEATURE_NAMES, TARGET_NAME, "source"]]


def describe(frame: pd.DataFrame) -> None:
    """Print dataset report."""
    line = "=" * 78
    print(line)
    print("SOLAR PANEL EFFICIENCY — SYNTHETIC PROTOTYPE DATASET")
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
    print(f"efficiency range : {target.min():.2f} .. {target.max():.2f} %")
    print(f"efficiency mean  : {target.mean():.2f} %")
    print(f"missing values   : {int(frame.isna().sum().sum())}")
    print(f"out-of-range     : {int(((target < TARGET_MIN) | (target > TARGET_MAX)).sum())}")
    print(line)


def main(argv: list[str] | None = None) -> int:
    parser = argparse.ArgumentParser(description="Generate solar efficiency training dataset.")
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
