"""
Phase 2 - Synthetic prototype dataset generator.

Generates a NON-random, learnable experimental dataset for the reaction-yield
optimization demo and writes it to ``backend/training/dataset.csv``.

Run from the backend directory:

    python training/generate_dataset.py
    python training/generate_dataset.py --rows 5000 --seed 7

SCIENTIFIC DISCLAIMER
---------------------
This dataset is SIMULATED. Rows are produced by the authored surrogate in
``domain.reaction_yield`` and carry ``source=synthetic_prototype_v1``. It is a
prototype used to demonstrate the AI-driven discovery workflow and must not be
presented as validated real-world experimental data.
"""

from __future__ import annotations

import argparse
import sys
from pathlib import Path

import numpy as np
import pandas as pd

# --- allow "python training/generate_dataset.py" from the backend directory ---
BACKEND_ROOT = Path(__file__).resolve().parents[1]
if str(BACKEND_ROOT) not in sys.path:
    sys.path.insert(0, str(BACKEND_ROOT))

from domain import (  # noqa: E402  (import after sys.path bootstrap)
    CATALYST_PROFILES,
    CATALYSTS,
    DATASET_PROVENANCE,
    FEATURE_NAMES,
    NOISE_SD,
    RANGES,
    TARGET_NAME,
    reaction_yield,
)

DEFAULT_ROWS = 3000
DEFAULT_SEED = 42
DEFAULT_OUTPUT = Path(__file__).resolve().parent / "dataset.csv"


def generate_dataset(
    rows: int = DEFAULT_ROWS, seed: int = DEFAULT_SEED, noise_sd: float = NOISE_SD
) -> pd.DataFrame:
    """
    Build the synthetic dataset.

    Sampling strategy (deliberately non-uniform so the model sees the whole
    design space, including the poor regions):
      * 70 % uniform over the full design space - gives coverage
      * 30 % focused around the individually-optimal regions - gives resolution
        where the interesting optimum lives, which makes the yield landscape
        learnable instead of vanishingly sparse.
    """
    if rows <= 0:
        raise ValueError("rows must be positive")

    rng = np.random.default_rng(seed)
    n_focus = int(rows * 0.30)
    n_uniform = rows - n_focus

    # --- uniform coverage -------------------------------------------------- #
    temp = rng.uniform(*RANGES["temperature"], n_uniform)
    pres = rng.uniform(*RANGES["pressure"], n_uniform)
    conc = rng.uniform(*RANGES["concentration"], n_uniform)
    time = rng.uniform(*RANGES["reaction_time"], n_uniform)
    catalysts = rng.choice(CATALYSTS, size=n_uniform, p=_catalyst_weights())

    # --- focused sampling around catalyst-specific optima ------------------ #
    focus_catalysts = rng.choice(CATALYSTS, size=n_focus, p=_catalyst_weights())
    focus_temp = np.empty(n_focus)
    focus_conc = np.empty(n_focus)
    for catalyst in CATALYSTS:
        mask = focus_catalysts == catalyst
        if not mask.any():
            continue
        profile = CATALYST_PROFILES[catalyst]
        count = int(mask.sum())
        focus_temp[mask] = np.clip(
            rng.normal(profile.t_opt, profile.t_sigma * 0.85, count),
            *RANGES["temperature"],
        )
        focus_conc[mask] = np.clip(
            rng.normal(profile.conc_opt, profile.conc_sigma * 0.85, count),
            *RANGES["concentration"],
        )

    focus_pres = rng.uniform(1.5, 8.0, n_focus)
    focus_time = np.clip(
        rng.gamma(shape=2.2, scale=22.0, size=n_focus), *RANGES["reaction_time"]
    )

    frame = pd.DataFrame(
        {
            "temperature": np.concatenate([temp, focus_temp]),
            "pressure": np.concatenate([pres, focus_pres]),
            "catalyst": np.concatenate([catalysts, focus_catalysts]),
            "concentration": np.concatenate([conc, focus_conc]),
            "reaction_time": np.concatenate([time, focus_time]),
        }
    )

    # --- target ------------------------------------------------------------ #
    frame[TARGET_NAME] = [
        reaction_yield(
            row.temperature,
            row.pressure,
            row.catalyst,
            row.concentration,
            row.reaction_time,
            noise_sd=noise_sd,
            rng=rng,
        )
        for row in frame.itertuples(index=False)
    ]

    # --- tidy up ----------------------------------------------------------- #
    for column in ("temperature", "pressure", "concentration", "reaction_time", TARGET_NAME):
        frame[column] = frame[column].astype(float).round(4)
    frame = frame.sample(frac=1.0, random_state=seed).reset_index(drop=True)
    frame.insert(0, "experiment_id", [f"SYN-{i:05d}" for i in range(1, len(frame) + 1)])
    frame["source"] = DATASET_PROVENANCE
    return frame[["experiment_id", *FEATURE_NAMES, TARGET_NAME, "source"]]


def _catalyst_weights() -> np.ndarray:
    """Mildly non-uniform catalyst mix (B is the most interesting catalyst)."""
    weights = np.array([0.22, 0.28, 0.20, 0.18, 0.12], dtype=float)
    return weights / weights.sum()


def describe(frame: pd.DataFrame) -> None:
    """Print the dataset report used during the hackathon demo."""
    line = "=" * 78
    print(line)
    print("VIRTUAL R&D LAB - SYNTHETIC PROTOTYPE DATASET")
    print(line)
    print("DISCLAIMER: simulated data for workflow demonstration only.")
    print("            Not validated real-world experimental results.\n")

    print(f"shape: {frame.shape}  (rows x columns)")
    print(f"columns: {list(frame.columns)}\n")

    print("--- first 5 rows ---")
    print(frame.head(5).to_string(index=False))
    print()

    print("--- descriptive statistics (numeric) ---")
    print(frame[FEATURE_NAMES[0:2] + FEATURE_NAMES[3:] + [TARGET_NAME]].describe().round(3).to_string())
    print()

    print("--- catalyst distribution ---")
    print(frame["catalyst"].value_counts().to_string())
    print()

    print("--- yield by catalyst (%) ---")
    print(
        frame.groupby("catalyst")[TARGET_NAME]
        .agg(["count", "mean", "std", "min", "max"])
        .round(2)
        .to_string()
    )
    print()

    print("--- top 5 recorded experiments by yield ---")
    top = frame.nlargest(5, TARGET_NAME)
    print(top.to_string(index=False))
    print()

    target = frame[TARGET_NAME]
    print("--- target sanity checks ---")
    print(f"yield range      : {target.min():.2f} .. {target.max():.2f} %")
    print(f"yield mean/std   : {target.mean():.2f} / {target.std():.2f}")
    print(f"out-of-range rows: {int(((target < 0) | (target > 100)).sum())}")
    print(f"missing values   : {int(frame.isna().sum().sum())}")
    print(f"duplicate rows   : {int(frame.duplicated(subset=FEATURE_NAMES).sum())}")
    print(line)


def main(argv: list[str] | None = None) -> int:
    parser = argparse.ArgumentParser(description="Generate the synthetic prototype dataset.")
    parser.add_argument("--rows", type=int, default=DEFAULT_ROWS, help="number of records")
    parser.add_argument("--seed", type=int, default=DEFAULT_SEED, help="random seed")
    parser.add_argument(
        "--noise", type=float, default=NOISE_SD, help="gaussian measurement noise (std, % yield)"
    )
    parser.add_argument("--output", type=Path, default=DEFAULT_OUTPUT, help="output CSV path")
    args = parser.parse_args(argv)

    frame = generate_dataset(rows=args.rows, seed=args.seed, noise_sd=args.noise)

    args.output.parent.mkdir(parents=True, exist_ok=True)
    frame.to_csv(args.output, index=False)
    print(f"saved -> {args.output}\n")

    describe(frame)
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
