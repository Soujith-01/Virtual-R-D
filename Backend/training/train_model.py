"""
Phase 3 - Train the reaction-yield prediction model.

Pipeline
--------
    ColumnTransformer(OneHotEncoder(catalyst) + passthrough(4 numeric))
        -> RandomForestRegressor

Reports MAE / RMSE / R-squared on a held-out test split plus 5-fold CV
R-squared, prints permutation-free feature importances, saves the fitted
scikit-learn pipeline and a JSON metadata sidecar, and finishes with a live
test prediction.

Run from the backend directory:

    python training/train_model.py
"""

from __future__ import annotations

import argparse
import json
import platform
import sys
from datetime import datetime, timezone
from pathlib import Path

import joblib
import numpy as np
import pandas as pd
import sklearn
from sklearn.compose import ColumnTransformer
from sklearn.ensemble import RandomForestRegressor
from sklearn.metrics import mean_absolute_error, mean_squared_error, r2_score
from sklearn.model_selection import KFold, cross_val_score, train_test_split
from sklearn.pipeline import Pipeline
from sklearn.preprocessing import OneHotEncoder

BACKEND_ROOT = Path(__file__).resolve().parents[1]
if str(BACKEND_ROOT) not in sys.path:
    sys.path.insert(0, str(BACKEND_ROOT))

from domain import (  # noqa: E402
    CATEGORICAL_FEATURES,
    DATASET_PROVENANCE,
    FEATURE_NAMES,
    NUMERIC_FEATURES,
    TARGET_NAME,
    normalise_catalyst,
)

DEFAULT_DATASET = Path(__file__).resolve().parent / "dataset.csv"
DEFAULT_MODEL = BACKEND_ROOT / "models" / "experiment_model.pkl"
DEFAULT_METADATA = BACKEND_ROOT / "models" / "model_metadata.json"

RANDOM_STATE = 42


def build_pipeline(n_estimators: int = 300) -> Pipeline:
    """Preprocessing + Random Forest in a single picklable object."""
    preprocessor = ColumnTransformer(
        transformers=[
            ("catalyst", OneHotEncoder(handle_unknown="ignore", sparse_output=False), CATEGORICAL_FEATURES),
            ("numeric", "passthrough", NUMERIC_FEATURES),
        ],
        remainder="drop",
        verbose_feature_names_out=False,
    )

    model = RandomForestRegressor(
        n_estimators=n_estimators,
        min_samples_leaf=2,
        max_features=0.7,
        n_jobs=-1,
        random_state=RANDOM_STATE,
    )

    return Pipeline([("preprocessor", preprocessor), ("model", model)])


def load_dataset(path: Path) -> pd.DataFrame:
    if not path.exists():
        raise FileNotFoundError(
            f"dataset not found at {path}\n"
            "Generate it first:  python training/generate_dataset.py"
        )
    # keep_default_na=False so the legitimate catalyst label "None" is not
    # silently turned into a missing value (see domain.normalise_catalyst).
    frame = pd.read_csv(path, keep_default_na=False)
    missing = [column for column in [*FEATURE_NAMES, TARGET_NAME] if column not in frame.columns]
    if missing:
        raise ValueError(f"dataset is missing required columns: {missing}")

    frame["catalyst"] = frame["catalyst"].map(normalise_catalyst)
    for column in [*NUMERIC_FEATURES, TARGET_NAME]:
        frame[column] = pd.to_numeric(frame[column], errors="raise")
    return frame


def evaluate(
    y_true: np.ndarray, y_pred: np.ndarray
) -> dict[str, float]:
    return {
        "mae": float(mean_absolute_error(y_true, y_pred)),
        "rmse": float(np.sqrt(mean_squared_error(y_true, y_pred))),
        "r2": float(r2_score(y_true, y_pred)),
    }


def train(
    dataset_path: Path = DEFAULT_DATASET,
    model_path: Path = DEFAULT_MODEL,
    metadata_path: Path = DEFAULT_METADATA,
    *,
    n_estimators: int = 300,
    test_size: float = 0.2,
    run_cv: bool = True,
) -> dict:
    """Train, evaluate, persist. Returns the metadata dictionary."""
    frame = load_dataset(dataset_path)

    X = frame[FEATURE_NAMES]
    y = frame[TARGET_NAME].to_numpy(dtype=float)

    X_train, X_test, y_train, y_test = train_test_split(
        X, y, test_size=test_size, random_state=RANDOM_STATE
    )

    pipeline = build_pipeline(n_estimators=n_estimators)
    pipeline.fit(X_train, y_train)

    y_pred = pipeline.predict(X_test)
    metrics = evaluate(y_test, y_pred)

    # Uncertainty proxy for the API: spread of the test residuals.
    residual_std = float(np.std(y_test - y_pred, ddof=1))

    cv_r2: list[float] = []
    if run_cv:
        folds = KFold(n_splits=5, shuffle=True, random_state=RANDOM_STATE)
        cv_r2 = [float(score) for score in cross_val_score(pipeline, X, y, cv=folds, scoring="r2", n_jobs=-1)]

    # --- feature importance on the encoded feature space ------------------- #
    feature_names_out = list(pipeline.named_steps["preprocessor"].get_feature_names_out())
    importances = pipeline.named_steps["model"].feature_importances_
    importance_pairs = sorted(
        zip(feature_names_out, (float(value) for value in importances)),
        key=lambda pair: pair[1],
        reverse=True,
    )
    importance_groups: dict[str, float] = {}
    for name, value in importance_pairs:
        base = name if name in FEATURE_NAMES else "catalyst"
        importance_groups[base] = round(importance_groups.get(base, 0.0) + value, 6)

    metadata = {
        "app": "Virtual R&D Lab",
        "model_type": "RandomForestRegressor",
        "target": TARGET_NAME,
        "target_unit": "%",
        "features": FEATURE_NAMES,
        "categorical_features": CATEGORICAL_FEATURES,
        "numeric_features": NUMERIC_FEATURES,
        "n_estimators": n_estimators,
        "n_train": int(len(X_train)),
        "n_test": int(len(X_test)),
        "dataset_rows": int(len(frame)),
        "dataset_provenance": str(frame["source"].iloc[0]) if "source" in frame.columns else DATASET_PROVENANCE,
        "metrics": {
            "mae": round(metrics["mae"], 4),
            "rmse": round(metrics["rmse"], 4),
            "r2": round(metrics["r2"], 4),
        },
        "cv_r2_scores": [round(score, 4) for score in cv_r2],
        "cv_r2_mean": round(float(np.mean(cv_r2)), 4) if cv_r2 else None,
        "cv_r2_std": round(float(np.std(cv_r2)), 4) if cv_r2 else None,
        "residual_std": round(residual_std, 4),
        "feature_importance": dict(importance_pairs),
        "feature_importance_by_group": importance_groups,
        "trained_at": datetime.now(timezone.utc).isoformat(timespec="seconds"),
        "sklearn_version": sklearn.__version__,
        "python_version": platform.python_version(),
        "random_state": RANDOM_STATE,
        "disclaimer": (
            "Trained on a SIMULATED prototype dataset. Predictions demonstrate the "
            "workflow and are not validated real-world chemical results."
        ),
    }

    bundle = {
        "pipeline": pipeline,
        "metadata": metadata,
        "feature_names": FEATURE_NAMES,
        "residual_std": residual_std,
    }

    model_path.parent.mkdir(parents=True, exist_ok=True)
    joblib.dump(bundle, model_path)
    metadata_path.write_text(json.dumps(metadata, indent=2), encoding="utf-8")

    report(metadata, model_path, metadata_path)

    # --- live smoke test --------------------------------------------------- #
    demo = {
        "temperature": 90.0,
        "pressure": 2.0,
        "catalyst": "B",
        "concentration": 0.20,
        "reaction_time": 45.0,
    }
    demo_frame = pd.DataFrame([demo])[FEATURE_NAMES]
    prediction, spread = predict_with_uncertainty(pipeline, demo_frame)
    print("--- test prediction ---")
    print(f"input            : {demo}")
    print(f"predicted yield  : {prediction[0]:.2f} %")
    print(f"tree spread (sd) : {spread[0]:.2f} %  (model-derived uncertainty proxy)")

    reloaded = joblib.load(model_path)
    assert "pipeline" in reloaded and "metadata" in reloaded
    print(f"reload check     : OK ({model_path.name})")
    print("=" * 78)

    return metadata


def predict_with_uncertainty(
    pipeline: Pipeline, X: pd.DataFrame
) -> tuple[np.ndarray, np.ndarray]:
    """
    Point prediction plus the standard deviation across the forest's trees.

    This spread is an *uncertainty proxy*: it measures disagreement between
    trees, not a calibrated statistical confidence interval.
    """
    transformed = pipeline.named_steps["preprocessor"].transform(X)
    tree_predictions = np.vstack(
        [tree.predict(transformed) for tree in pipeline.named_steps["model"].estimators_]
    )
    return tree_predictions.mean(axis=0), tree_predictions.std(axis=0)


def report(metadata: dict, model_path: Path, metadata_path: Path) -> None:
    line = "=" * 78
    print(line)
    print("VIRTUAL R&D LAB - MODEL TRAINING REPORT")
    print(line)
    print(f"dataset          : {metadata['dataset_rows']} rows "
          f"({metadata['dataset_provenance']} - SIMULATED prototype data)")
    print(f"split            : {metadata['n_train']} train / {metadata['n_test']} test")
    print(f"model            : {metadata['model_type']} (n_estimators={metadata['n_estimators']})")
    print()
    print("--- held-out test metrics ---")
    print(f"MAE              : {metadata['metrics']['mae']:.4f} % yield")
    print(f"RMSE             : {metadata['metrics']['rmse']:.4f} % yield")
    print(f"R^2              : {metadata['metrics']['r2']:.4f}")
    if metadata["cv_r2_mean"] is not None:
        print()
        print("--- 5-fold cross-validation (R^2) ---")
        print("folds            : " + ", ".join(f"{score:.4f}" for score in metadata["cv_r2_scores"]))
        print(f"mean +/- std     : {metadata['cv_r2_mean']:.4f} +/- {metadata['cv_r2_std']:.4f}")
    print()
    print("--- feature importance (grouped) ---")
    for name, value in sorted(
        metadata["feature_importance_by_group"].items(), key=lambda pair: pair[1], reverse=True
    ):
        bar = "#" * max(1, int(round(value * 60)))
        print(f"{name:<16} {value:6.3f}  {bar}")
    print()
    print("--- feature importance (detailed, one-hot expanded) ---")
    for name, value in list(metadata["feature_importance"].items())[:10]:
        print(f"{name:<28} {value:6.4f}")
    print()
    print(f"saved model      : {model_path}")
    print(f"saved metadata   : {metadata_path}")
    print(f"trained at       : {metadata['trained_at']}  (sklearn {metadata['sklearn_version']})")
    print(f"disclaimer       : {metadata['disclaimer']}")


def main(argv: list[str] | None = None) -> int:
    parser = argparse.ArgumentParser(description="Train the reaction-yield Random Forest.")
    parser.add_argument("--dataset", type=Path, default=DEFAULT_DATASET)
    parser.add_argument("--output", type=Path, default=DEFAULT_MODEL)
    parser.add_argument("--metadata", type=Path, default=DEFAULT_METADATA)
    parser.add_argument("--estimators", type=int, default=300)
    parser.add_argument("--test-size", type=float, default=0.2)
    parser.add_argument("--no-cv", action="store_true", help="skip cross-validation")
    args = parser.parse_args(argv)

    try:
        train(
            dataset_path=args.dataset,
            model_path=args.output,
            metadata_path=args.metadata,
            n_estimators=args.estimators,
            test_size=args.test_size,
            run_cv=not args.no_cv,
        )
    except (FileNotFoundError, ValueError) as error:
        print(f"ERROR: {error}", file=sys.stderr)
        return 1
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
