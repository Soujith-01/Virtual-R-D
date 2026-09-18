"""
Generalized domain model training pipeline.

Trains a RandomForestRegressor for any domain with a synthetic dataset.

Run from the backend directory:

    python training/train_domain_model.py --domain solar_efficiency
    python training/train_domain_model.py --domain all
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
from sklearn.preprocessing import StandardScaler

BACKEND_ROOT = Path(__file__).resolve().parents[1]
if str(BACKEND_ROOT) not in sys.path:
    sys.path.insert(0, str(BACKEND_ROOT))

from config import settings

RANDOM_STATE = 42
DEFAULT_N_ESTIMATORS = 300


DOMAIN_MODULES = {
    "reaction_yield": ("domain", "reaction_yield", "yield"),
    "solar_efficiency": ("solar_domain", "solar_efficiency", "energy_conversion_efficiency"),
    "plant_growth": ("plant_domain", "biomass_yield", "biomass_yield"),
    "battery_performance": ("battery_domain", "capacity_retention_percent", "capacity_retention_percent"),
    "water_purification": ("water_domain", "turbidity_removal_percent", "turbidity_removal_percent"),
}

DATASET_FILES = {
    "reaction_yield": BACKEND_ROOT / "training" / "dataset.csv",
    "solar_efficiency": BACKEND_ROOT / "training" / "solar_efficiency_training.csv",
    "plant_growth": BACKEND_ROOT / "training" / "plant_growth_training.csv",
    "battery_performance": BACKEND_ROOT / "training" / "battery_performance_training.csv",
    "water_purification": BACKEND_ROOT / "training" / "water_purification_training.csv",
}

MODEL_FILES = {
    "reaction_yield": BACKEND_ROOT / "models" / "reaction_yield_model.pkl",
    "solar_efficiency": BACKEND_ROOT / "models" / "solar_efficiency_model.pkl",
    "plant_growth": BACKEND_ROOT / "models" / "plant_growth_model.pkl",
    "battery_performance": BACKEND_ROOT / "models" / "battery_performance_model.pkl",
    "water_purification": BACKEND_ROOT / "models" / "water_purification_model.pkl",
}

METADATA_FILES = {
    "reaction_yield": BACKEND_ROOT / "models" / "reaction_yield_metadata.json",
    "solar_efficiency": BACKEND_ROOT / "models" / "solar_efficiency_metadata.json",
    "plant_growth": BACKEND_ROOT / "models" / "plant_growth_metadata.json",
    "battery_performance": BACKEND_ROOT / "models" / "battery_performance_metadata.json",
    "water_purification": BACKEND_ROOT / "models" / "water_purification_metadata.json",
}


def build_pipeline(
    numeric_features: list[str],
    categorical_features: list[str],
    n_estimators: int = DEFAULT_N_ESTIMATORS,
) -> Pipeline:
    """Preprocessing + Random Forest in a single picklable object."""
    transformers = []

    if categorical_features:
        transformers.append(
            (
                "categorical",
                __import__("sklearn.preprocessing").preprocessing.OneHotEncoder(
                    handle_unknown="ignore", sparse_output=False
                ),
                categorical_features,
            )
        )

    if numeric_features:
        transformers.append(("numeric", StandardScaler(), numeric_features))

    if not transformers:
        raise ValueError("No features defined for pipeline")

    preprocessor = ColumnTransformer(
        transformers=transformers,
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


def predict_with_uncertainty(
    pipeline: Pipeline,
    X: pd.DataFrame,
) -> tuple[np.ndarray, np.ndarray]:
    """Point prediction plus the standard deviation across the forest's trees."""
    transformed = pipeline.named_steps["preprocessor"].transform(X)
    tree_predictions = np.vstack(
        [tree.predict(transformed) for tree in pipeline.named_steps["model"].estimators_]
    )
    return tree_predictions.mean(axis=0), tree_predictions.std(axis=0)


def load_dataset(
    domain: str,
    path: Path,
) -> pd.DataFrame:
    """Load and validate a domain dataset."""
    if not path.exists():
        raise FileNotFoundError(f"Dataset not found at {path}")

    if domain == "reaction_yield":
        from domain import FEATURE_NAMES as FN, TARGET_NAME as TN
        feature_names = FN
        target_name = TN
        frame = pd.read_csv(path)
        if "catalyst" in frame.columns:
            from domain import CATALYSTS
            frame['catalyst'] = frame['catalyst'].apply(lambda x: str(x) if str(x) in CATALYSTS or str(x) == 'None' else 'None')
    elif domain == "solar_efficiency":
        from solar_domain import FEATURE_NAMES as FN, TARGET_NAME as TN
        feature_names = FN
        target_name = TN
        frame = pd.read_csv(path)
    elif domain == "plant_growth":
        from plant_domain import FEATURE_NAMES as FN, TARGET_NAME as TN
        feature_names = FN
        target_name = TN
        frame = pd.read_csv(path)
    elif domain == "battery_performance":
        from battery_domain import FEATURE_NAMES as FN, TARGET_NAME as TN
        feature_names = FN
        target_name = TN
        frame = pd.read_csv(path)
    elif domain == "water_purification":
        from water_domain import FEATURE_NAMES as FN, TARGET_NAME as TN
        feature_names = FN
        target_name = TN
        frame = pd.read_csv(path)
    else:
        raise ValueError(f"Unknown domain: {domain}")

    missing = [col for col in feature_names + [target_name] if col not in frame.columns]
    if missing:
        raise ValueError(f"Dataset missing required columns: {missing}")

    # Convert only numeric feature columns to numeric
    for column in feature_names:
        if column != 'catalyst':  # catalyst is categorical
            frame[column] = pd.to_numeric(frame[column], errors="raise")
    frame[target_name] = pd.to_numeric(frame[target_name], errors="raise")

    return frame


def evaluate(y_true: np.ndarray, y_pred: np.ndarray) -> dict[str, float]:
    return {
        "mae": float(mean_absolute_error(y_true, y_pred)),
        "rmse": float(np.sqrt(mean_squared_error(y_true, y_pred))),
        "r2": float(r2_score(y_true, y_pred)),
    }


def get_domain_config(domain: str) -> dict:
    """Get feature config for a domain."""
    if domain == "reaction_yield":
        from domain import CATEGORICAL_FEATURES, DATASET_PROVENANCE, NUMERIC_FEATURES, TARGET_UNIT
        return {
            "categorical_features": CATEGORICAL_FEATURES,
            "numeric_features": NUMERIC_FEATURES,
            "dataset_provenance": DATASET_PROVENANCE,
            "target_unit": TARGET_UNIT,
        }
    elif domain == "solar_efficiency":
        from solar_domain import DATASET_PROVENANCE, TARGET_UNIT
        return {
            "categorical_features": [],
            "numeric_features": ["cell_thickness_nm", "doping_concentration", "annealing_temperature_c", "light_intensity_lux", "operating_temperature_c"],
            "dataset_provenance": DATASET_PROVENANCE,
            "target_unit": TARGET_UNIT,
        }
    elif domain == "plant_growth":
        from plant_domain import DATASET_PROVENANCE, TARGET_UNIT
        return {
            "categorical_features": [],
            "numeric_features": ["light_intensity_lux", "co2_concentration_ppm", "nutrient_concentration_mm", "temperature_c", "water_supply_ml_day"],
            "dataset_provenance": DATASET_PROVENANCE,
            "target_unit": TARGET_UNIT,
        }
    elif domain == "battery_performance":
        from battery_domain import DATASET_PROVENANCE, TARGET_UNIT
        return {
            "categorical_features": [],
            "numeric_features": ["electrolyte_concentration_m", "charging_rate_c", "operating_temperature_c", "discharge_rate_c", "cycle_count"],
            "dataset_provenance": DATASET_PROVENANCE,
            "target_unit": TARGET_UNIT,
        }
    elif domain == "water_purification":
        from water_domain import DATASET_PROVENANCE, TARGET_UNIT
        return {
            "categorical_features": [],
            "numeric_features": ["coagulant_dose_mg_l", "ph", "contact_time_min", "temperature_c", "mixing_speed_rpm"],
            "dataset_provenance": DATASET_PROVENANCE,
            "target_unit": TARGET_UNIT,
        }
    else:
        raise ValueError(f"Unknown domain: {domain}")


def get_domain_info(domain: str) -> dict:
    """Get domain metadata for display."""
    info_map = {
        "reaction_yield": {
            "label": "Reaction Yield Optimization",
            "target_name": "yield",
            "target_description": "Reaction yield (%)",
            "feature_labels": {
                "temperature": "Temperature",
                "pressure": "Pressure",
                "catalyst": "Catalyst",
                "concentration": "Concentration",
                "reaction_time": "Reaction Time",
            },
        },
        "solar_efficiency": {
            "label": "Solar Panel Efficiency",
            "target_name": "energy_conversion_efficiency",
            "target_description": "Energy conversion efficiency (%)",
            "feature_labels": {
                "cell_thickness_nm": "Cell Thickness",
                "doping_concentration": "Doping Concentration",
                "annealing_temperature_c": "Annealing Temperature",
                "light_intensity_lux": "Light Intensity",
                "operating_temperature_c": "Operating Temperature",
            },
        },
        "plant_growth": {
            "label": "Plant Growth Optimization",
            "target_name": "biomass_yield",
            "target_description": "Biomass Yield (g)",
            "feature_labels": {
                "light_intensity_lux": "Light Intensity",
                "co2_concentration_ppm": "CO₂ Concentration",
                "nutrient_concentration_mm": "Nutrient Concentration",
                "temperature_c": "Temperature",
                "water_supply_ml_day": "Water Supply",
            },
        },
        "battery_performance": {
            "label": "Battery Performance",
            "target_name": "capacity_retention_percent",
            "target_description": "Capacity Retention (%)",
            "feature_labels": {
                "electrolyte_concentration_m": "Electrolyte Concentration",
                "charging_rate_c": "Charging Rate",
                "operating_temperature_c": "Operating Temperature",
                "discharge_rate_c": "Discharge Rate",
                "cycle_count": "Cycle Count",
            },
        },
        "water_purification": {
            "label": "Water Purification",
            "target_name": "turbidity_removal_percent",
            "target_description": "Turbidity Removal (%)",
            "feature_labels": {
                "coagulant_dose_mg_l": "Coagulant Dose",
                "ph": "pH",
                "contact_time_min": "Contact Time",
                "temperature_c": "Temperature",
                "mixing_speed_rpm": "Mixing Speed",
            },
        },
    }
    return info_map.get(domain, {})


def train(
    domain: str,
    dataset_path: Path,
    model_path: Path,
    metadata_path: Path,
    *,
    n_estimators: int = DEFAULT_N_ESTIMATORS,
    test_size: float = 0.2,
    run_cv: bool = True,
) -> dict:
    """Train, evaluate, persist. Returns the metadata dictionary."""

    if domain == "reaction_yield":
        from domain import FEATURE_NAMES, TARGET_NAME
    elif domain == "solar_efficiency":
        from solar_domain import FEATURE_NAMES, TARGET_NAME
    elif domain == "plant_growth":
        from plant_domain import FEATURE_NAMES, TARGET_NAME
    elif domain == "battery_performance":
        from battery_domain import FEATURE_NAMES, TARGET_NAME
    elif domain == "water_purification":
        from water_domain import FEATURE_NAMES, TARGET_NAME
    else:
        raise ValueError(f"Unknown domain: {domain}")

    config = get_domain_config(domain)
    frame = load_dataset(domain, dataset_path)

    X = frame[FEATURE_NAMES]
    y = frame[TARGET_NAME].to_numpy(dtype=float)

    X_train, X_test, y_train, y_test = train_test_split(
        X, y, test_size=test_size, random_state=RANDOM_STATE
    )

    pipeline = build_pipeline(
        config["numeric_features"],
        config["categorical_features"],
        n_estimators=n_estimators,
    )
    pipeline.fit(X_train, y_train)

    y_pred = pipeline.predict(X_test)
    metrics = evaluate(y_test, y_pred)

    residual_std = float(np.std(y_test - y_pred, ddof=1))

    cv_r2: list[float] = []
    if run_cv:
        folds = KFold(n_splits=5, shuffle=True, random_state=RANDOM_STATE)
        cv_r2 = [float(score) for score in cross_val_score(pipeline, X, y, cv=folds, scoring="r2", n_jobs=-1)]

    feature_names_out = list(pipeline.named_steps["preprocessor"].get_feature_names_out())
    importances = pipeline.named_steps["model"].feature_importances_
    importance_pairs = sorted(
        zip(feature_names_out, (float(value) for value in importances)),
        key=lambda pair: pair[1],
        reverse=True,
    )

    importance_groups: dict[str, float] = {}
    for name, value in importance_pairs:
        base = name if name in FEATURE_NAMES else "catalyst" if "cat" in name.lower() else name.split("_")[0]
        importance_groups[base] = round(importance_groups.get(base, 0.0) + value, 6)

    metadata = {
        "app": "Nucleus AI R&D Lab",
        "domain": domain,
        "model_type": "RandomForestRegressor",
        "target": TARGET_NAME,
        "target_unit": config["target_unit"],
        "target_description": get_domain_info(domain).get("target_description", TARGET_NAME),
        "features": FEATURE_NAMES,
        "feature_labels": get_domain_info(domain).get("feature_labels", {}),
        "categorical_features": config["categorical_features"],
        "numeric_features": config["numeric_features"],
        "n_estimators": n_estimators,
        "n_train": int(len(X_train)),
        "n_test": int(len(X_test)),
        "dataset_rows": int(len(frame)),
        "dataset_provenance": config["dataset_provenance"],
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
        "domain_label": get_domain_info(domain).get("label", domain),
        "disclaimer": (
            "Trained on a SIMULATED prototype dataset. Predictions demonstrate the "
            "workflow and are not validated real-world results."
        ),
    }

    bundle = {
        "pipeline": pipeline,
        "metadata": metadata,
        "feature_names": FEATURE_NAMES,
        "residual_std": residual_std,
        "domain": domain,
    }

    model_path.parent.mkdir(parents=True, exist_ok=True)
    joblib.dump(bundle, model_path)
    metadata_path.write_text(json.dumps(metadata, indent=2), encoding="utf-8")

    report(metadata, model_path, metadata_path, domain)

    demo_index = {0: 90, 1: 2, 2: "B", 3: 0.20, 4: 45}
    if domain != "reaction_yield":
        demo = {FEATURE_NAMES[i]: list(demo_index.values())[i] if isinstance(list(demo_index.values())[i], (int, float, str)) else list(demo_index.values())[i] for i in range(len(FEATURE_NAMES))}
        if domain == "solar_efficiency":
            demo = {"cell_thickness_nm": 150, "doping_concentration": 3.16e16, "annealing_temperature_c": 700, "light_intensity_lux": 80000, "operating_temperature_c": 25}
        elif domain == "plant_growth":
            demo = {"light_intensity_lux": 35000, "co2_concentration_ppm": 800, "nutrient_concentration_mm": 4.0, "temperature_c": 26, "water_supply_ml_day": 250}
        elif domain == "battery_performance":
            demo = {"electrolyte_concentration_m": 1.4, "charging_rate_c": 0.6, "operating_temperature_c": 22, "discharge_rate_c": 0.6, "cycle_count": 100}
        elif domain == "water_purification":
            demo = {"coagulant_dose_mg_l": 40, "ph": 6.8, "contact_time_min": 45, "temperature_c": 18, "mixing_speed_rpm": 120}

        demo_frame = pd.DataFrame([demo])[FEATURE_NAMES]
        prediction, spread = predict_with_uncertainty(pipeline, demo_frame)
        print("--- test prediction ---")
        print(f"input                 : {demo}")
        print(f"predicted target      : {prediction[0]:.2f} {config['target_unit']}")
        print(f"tree spread (sd)      : {spread[0]:.2f} {config['target_unit']}  (model-derived uncertainty proxy)")

    reloaded = joblib.load(model_path)
    assert "pipeline" in reloaded and "metadata" in reloaded
    print(f"reload check          : OK ({model_path.name})")
    print("=" * 78)

    return metadata


def report(metadata: dict, model_path: Path, metadata_path: Path, domain: str) -> None:
    """Print training report."""
    line = "=" * 78
    print(line)
    print(f"NUCLEUS AI R&D LAB — MODEL TRAINING REPORT ({get_domain_info(domain).get('label', domain)})")
    print(line)
    print(f"domain                : {metadata['domain_label']}")
    print(f"dataset               : {metadata['dataset_rows']} rows "
          f"({metadata['dataset_provenance']} - SIMULATED prototype data)")
    print(f"split                 : {metadata['n_train']} train / {metadata['n_test']} test")
    print(f"model                 : {metadata['model_type']} (n_estimators={metadata['n_estimators']})")
    print()
    print("--- held-out test metrics ---")
    print(f"MAE                   : {metadata['metrics']['mae']:.4f} {metadata['target_unit']}")
    print(f"RMSE                  : {metadata['metrics']['rmse']:.4f} {metadata['target_unit']}")
    print(f"R^2                   : {metadata['metrics']['r2']:.4f}")
    if metadata["cv_r2_mean"] is not None:
        print()
        print("--- 5-fold cross-validation (R^2) ---")
        print("folds                 : " + ", ".join(f"{score:.4f}" for score in metadata["cv_r2_scores"]))
        print(f"mean +/- std          : {metadata['cv_r2_mean']:.4f} +/- {metadata['cv_r2_std']:.4f}")
    print()
    print("--- feature importance (grouped) ---")
    for name, value in sorted(
        metadata["feature_importance_by_group"].items(), key=lambda pair: pair[1], reverse=True
    ):
        bar = "#" * max(1, int(round(value * 60)))
        print(f"{name:<20} {value:6.3f}  {bar}")
    print()
    print(f"saved model           : {model_path}")
    print(f"saved metadata        : {metadata_path}")
    print(f"trained at            : {metadata['trained_at']}  (sklearn {metadata['sklearn_version']})")
    print(f"disclaimer            : {metadata['disclaimer']}")
    print()


def main(argv: list[str] | None = None) -> int:
    parser = argparse.ArgumentParser(description="Train a domain-specific Random Forest model.")
    parser.add_argument(
        "--domain",
        type=str,
        required=True,
        choices=["reaction_yield", "solar_efficiency", "plant_growth", "battery_performance", "water_purification", "all"],
        help="domain to train (or 'all' for all domains)",
    )
    parser.add_argument("--estimators", type=int, default=DEFAULT_N_ESTIMATORS, help="number of trees")
    parser.add_argument("--test-size", type=float, default=0.2, help="test split fraction")
    parser.add_argument("--no-cv", action="store_true", help="skip cross-validation")
    args = parser.parse_args(argv)

    domains = list(DATASET_FILES.keys()) if args.domain == "all" else [args.domain]

    results = {}
    for domain in domains:
        print(f"\n{'='*78}")
        print(f"Training model for: {domain}")
        print(f"{'='*78}")

        try:
            metadata = train(
                domain=domain,
                dataset_path=DATASET_FILES[domain],
                model_path=MODEL_FILES[domain],
                metadata_path=METADATA_FILES[domain],
                n_estimators=args.estimators,
                test_size=args.test_size,
                run_cv=not args.no_cv,
            )
            results[domain] = metadata
        except (FileNotFoundError, ValueError) as error:
            print(f"ERROR training {domain}: {error}", file=sys.stderr)
            results[domain] = {"error": str(error)}

    print(f"\n{'='*78}")
    print("TRAINING SUMMARY")
    print(f"{'='*78}")
    for domain, result in results.items():
        if "error" in result:
            print(f"{domain}: FAILED - {result['error']}")
        else:
            print(f"{domain}: R²={result['metrics']['r2']:.4f}, MAE={result['metrics']['mae']:.4f}, "
                  f"model={MODEL_FILES[domain].name}")

    return 0


if __name__ == "__main__":
    raise SystemExit(main())
