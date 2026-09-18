"""
Model registry for multi-domain AI experiment system.

Provides lazy loading, prediction, and metadata for all trained models.
"""

from __future__ import annotations

import threading
from pathlib import Path
from typing import Any, Dict, List, Optional, Sequence

import joblib
import numpy as np
import pandas as pd

from config import settings

CONFIDENCE_SCALE = 25.0
INTERVAL_Z = 1.645

MODEL_PATHS = {
    "reaction_yield": Path(settings.model_path),
    "solar_efficiency": Path(str(settings.model_path).replace("experiment_model.pkl", "solar_efficiency_model.pkl")),
    "plant_growth": Path(str(settings.model_path).replace("experiment_model.pkl", "plant_growth_model.pkl")),
    "battery_performance": Path(str(settings.model_path).replace("experiment_model.pkl", "battery_performance_model.pkl")),
    "water_purification": Path(str(settings.model_path).replace("experiment_model.pkl", "water_purification_model.pkl")),
}

METADATA_PATHS = {
    "reaction_yield": Path(str(settings.model_metadata_path).replace("model_metadata.json", "reaction_yield_metadata.json")),
    "solar_efficiency": Path(str(settings.model_metadata_path).replace("model_metadata.json", "solar_efficiency_metadata.json")),
    "plant_growth": Path(str(settings.model_metadata_path).replace("model_metadata.json", "plant_growth_metadata.json")),
    "battery_performance": Path(str(settings.model_metadata_path).replace("model_metadata.json", "battery_performance_metadata.json")),
    "water_purification": Path(str(settings.model_metadata_path).replace("model_metadata.json", "water_purification_metadata.json")),
}


class ModelNotTrainedError(RuntimeError):
    """Raised when a model artifact is missing or unreadable."""


class ModelRegistry:
    """Thread-safe registry for all domain models."""

    def __init__(self) -> None:
        self._lock = threading.Lock()
        self._bundles: Dict[str, dict] = {}
        self._metadata: Dict[str, dict] = {}
        self._residual_stds: Dict[str, float] = {}

    def load(self, domain: str, *, force: bool = False) -> dict:
        """Load and cache a model bundle."""
        if domain not in MODEL_PATHS:
            raise ValueError(f"Unknown domain: {domain}")

        with self._lock:
            if domain in self._bundles and not force:
                return self._bundles[domain]

            model_path = MODEL_PATHS[domain]
            if not model_path.exists():
                raise ModelNotTrainedError(
                    f"No trained model for {domain} at {model_path}. "
                    f"Train it first."
                )

            bundle = joblib.load(model_path)
            if not isinstance(bundle, dict) or "pipeline" not in bundle:
                raise ModelNotTrainedError(
                    f"Unexpected model artifact format for {domain} at {model_path}"
                )

            self._bundles[domain] = bundle
            self._metadata[domain] = dict(bundle.get("metadata", {}))
            self._residual_stds[domain] = float(
                bundle.get("residual_std", bundle.get("metadata", {}).get("residual_std", 4.0))
            )
            return bundle

    def reload(self, domain: str) -> dict:
        """Force a re-read from disk."""
        with self._lock:
            if domain in self._bundles:
                del self._bundles[domain]
            if domain in self._metadata:
                del self._metadata[domain]
            if domain in self._residual_stds:
                del self._residual_stds[domain]
            return self.load(domain, force=True)

    def is_loaded(self, domain: str) -> bool:
        return domain in self._bundles

    def metadata(self, domain: str) -> dict:
        if domain not in self._metadata:
            self.load(domain)
        return dict(self._metadata.get(domain, {}))

    def residual_std(self, domain: str) -> float:
        if domain not in self._residual_stds:
            self.load(domain)
        return float(self._residual_stds.get(domain, 4.0))

    def _to_frame(self, domain: str, experiments: Sequence[dict]) -> pd.DataFrame:
        """Convert experiment dicts to a DataFrame for prediction."""
        if domain == "reaction_yield":
            from domain import FEATURE_NAMES, normalise_catalyst
            rows = []
            for exp in experiments:
                rows.append({
                    "temperature": float(exp["temperature"]),
                    "pressure": float(exp["pressure"]),
                    "catalyst": normalise_catalyst(exp.get("catalyst")),
                    "concentration": float(exp["concentration"]),
                    "reaction_time": float(exp["reaction_time"]),
                })
            return pd.DataFrame(rows, columns=FEATURE_NAMES)
        elif domain == "solar_efficiency":
            from solar_domain import FEATURE_NAMES
            rows = []
            for exp in experiments:
                rows.append({
                    "cell_thickness_nm": float(exp["cell_thickness_nm"]),
                    "doping_concentration": float(exp["doping_concentration"]),
                    "annealing_temperature_c": float(exp["annealing_temperature_c"]),
                    "light_intensity_lux": float(exp["light_intensity_lux"]),
                    "operating_temperature_c": float(exp["operating_temperature_c"]),
                })
            return pd.DataFrame(rows, columns=FEATURE_NAMES)
        elif domain == "plant_growth":
            from plant_domain import FEATURE_NAMES
            rows = []
            for exp in experiments:
                rows.append({
                    "light_intensity_lux": float(exp["light_intensity_lux"]),
                    "co2_concentration_ppm": float(exp["co2_concentration_ppm"]),
                    "nutrient_concentration_mm": float(exp["nutrient_concentration_mm"]),
                    "temperature_c": float(exp["temperature_c"]),
                    "water_supply_ml_day": float(exp["water_supply_ml_day"]),
                })
            return pd.DataFrame(rows, columns=FEATURE_NAMES)
        elif domain == "battery_performance":
            from battery_domain import FEATURE_NAMES
            rows = []
            for exp in experiments:
                rows.append({
                    "electrolyte_concentration_m": float(exp["electrolyte_concentration_m"]),
                    "charging_rate_c": float(exp["charging_rate_c"]),
                    "operating_temperature_c": float(exp["operating_temperature_c"]),
                    "discharge_rate_c": float(exp["discharge_rate_c"]),
                    "cycle_count": float(exp["cycle_count"]),
                })
            return pd.DataFrame(rows, columns=FEATURE_NAMES)
        elif domain == "water_purification":
            from water_domain import FEATURE_NAMES
            rows = []
            for exp in experiments:
                rows.append({
                    "coagulant_dose_mg_l": float(exp["coagulant_dose_mg_l"]),
                    "ph": float(exp["ph"]),
                    "contact_time_min": float(exp["contact_time_min"]),
                    "temperature_c": float(exp["temperature_c"]),
                    "mixing_speed_rpm": float(exp["mixing_speed_rpm"]),
                })
            return pd.DataFrame(rows, columns=FEATURE_NAMES)
        else:
            raise ValueError(f"Unknown domain: {domain}")

    def predict(self, domain: str, experiments: Sequence[dict]) -> List[Dict[str, Any]]:
        """Predict target for one or many experiments."""
        if not experiments:
            return []

        bundle = self.load(domain)
        pipeline = bundle["pipeline"]
        frame = self._to_frame(domain, experiments)

        transformed = pipeline.named_steps["preprocessor"].transform(frame)
        trees = pipeline.named_steps["model"].estimators_
        tree_predictions = np.vstack([tree.predict(transformed) for tree in trees])

        means = tree_predictions.mean(axis=0)
        spreads = tree_predictions.std(axis=0)
        baseline = self.residual_std(domain)

        # Get target bounds for clipping
        if domain == "reaction_yield":
            target_min, target_max = 0.0, 100.0
            target_name = "predicted_yield"
            unit = "%"
        elif domain == "solar_efficiency":
            from solar_domain import TARGET_MIN, TARGET_MAX, TARGET_UNIT
            target_min, target_max = TARGET_MIN, TARGET_MAX
            target_name = "predicted_efficiency"
            unit = TARGET_UNIT
        elif domain == "plant_growth":
            from plant_domain import TARGET_MIN, TARGET_MAX, TARGET_UNIT
            target_min, target_max = TARGET_MIN, TARGET_MAX
            target_name = "predicted_biomass_yield"
            unit = TARGET_UNIT
        elif domain == "battery_performance":
            from battery_domain import TARGET_MIN, TARGET_MAX, TARGET_UNIT
            target_min, target_max = TARGET_MIN, TARGET_MAX
            target_name = "predicted_capacity_retention"
            unit = TARGET_UNIT
        elif domain == "water_purification":
            from water_domain import TARGET_MIN, TARGET_MAX, TARGET_UNIT
            target_min, target_max = TARGET_MIN, TARGET_MAX
            target_name = "predicted_turbidity_removal"
            unit = TARGET_UNIT
        else:
            target_min, target_max = 0.0, 100.0
            target_name = "predicted_value"
            unit = ""

        results = []
        for mean, spread in zip(means, spreads):
            predicted = float(np.clip(mean, target_min, target_max))
            uncertainty = float(max(spread, 0.0))
            confidence = float(np.clip(1.0 - uncertainty / CONFIDENCE_SCALE, 0.05, 0.99))
            half_width = float(
                np.clip(INTERVAL_Z * float(np.sqrt(baseline**2 + uncertainty**2)), 0.0, 100.0)
            )
            results.append({
                target_name: round(predicted, 2),
                "uncertainty_std": round(uncertainty, 2),
                "estimated_confidence": round(confidence, 3),
                "interval_low": round(max(predicted - half_width, target_min), 2),
                "interval_high": round(min(predicted + half_width, target_max), 2),
                "unit": unit,
            })
        return results

    def predict_one(self, domain: str, experiment: dict) -> Dict[str, Any]:
        return self.predict(domain, [experiment])[0]

    def metrics(self, domain: str) -> Dict[str, float]:
        return dict(self.metadata(domain).get("metrics", {}))

    def feature_importance(self, domain: str) -> Dict[str, float]:
        return dict(self.metadata(domain).get("feature_importance_by_group", {}))

    def all_status(self) -> Dict[str, Dict[str, Any]]:
        """Get status of all models."""
        status: Dict[str, Dict[str, Any]] = {}

        domain_labels = {
            "reaction_yield": "Reaction Yield Optimization",
            "solar_efficiency": "Solar Panel Efficiency",
            "plant_growth": "Plant Growth Optimization",
            "battery_performance": "Battery Performance",
            "water_purification": "Water Purification",
        }

        for domain in MODEL_PATHS:
            model_path = MODEL_PATHS[domain]
            if self.is_loaded(domain):
                metrics = self.metrics(domain)
                status[domain] = {
                    "status": "ready",
                    "label": domain_labels.get(domain, domain),
                    "algorithm": "Random Forest Regression",
                    "model_path": str(model_path),
                    "r2": metrics.get("r2", None),
                    "mae": metrics.get("mae", None),
                    "rmse": metrics.get("rmse", None),
                    "training_samples": self.metadata(domain).get("n_train", 0),
                    "test_samples": self.metadata(domain).get("n_test", 0),
                    "dataset_rows": self.metadata(domain).get("dataset_rows", 0),
                    "dataset_provenance": self.metadata(domain).get("dataset_provenance", "synthetic_prototype_v1"),
                    "target": self.metadata(domain).get("target", ""),
                    "target_unit": self.metadata(domain).get("target_unit", ""),
                    "features": self.metadata(domain).get("features", []),
                    "disclaimer": self.metadata(domain).get("disclaimer", "Prototype synthetic model"),
                }
            elif model_path.exists():
                try:
                    self.load(domain)
                    metrics = self.metrics(domain)
                    status[domain] = {
                        "status": "ready",
                        "label": domain_labels.get(domain, domain),
                        "algorithm": "Random Forest Regression",
                        "model_path": str(model_path),
                        "r2": metrics.get("r2", None),
                        "mae": metrics.get("mae", None),
                        "rmse": metrics.get("rmse", None),
                        "training_samples": self.metadata(domain).get("n_train", 0),
                        "test_samples": self.metadata(domain).get("n_test", 0),
                        "dataset_rows": self.metadata(domain).get("dataset_rows", 0),
                        "dataset_provenance": self.metadata(domain).get("dataset_provenance", "synthetic_prototype_v1"),
                        "target": self.metadata(domain).get("target", ""),
                        "target_unit": self.metadata(domain).get("target_unit", ""),
                        "features": self.metadata(domain).get("features", []),
                        "disclaimer": self.metadata(domain).get("disclaimer", "Prototype synthetic model"),
                    }
                except Exception:
                    status[domain] = {
                        "status": "error",
                        "label": domain_labels.get(domain, domain),
                        "algorithm": "Random Forest Regression",
                        "model_path": str(model_path),
                        "error": "Failed to load model",
                    }
            else:
                status[domain] = {
                    "status": "not_trained",
                    "label": domain_labels.get(domain, domain),
                    "algorithm": "Random Forest Regression",
                    "model_path": str(model_path),
                    "r2": None,
                    "mae": None,
                    "rmse": None,
                    "disclaimer": "Prototype synthetic model — not trained yet",
                }

        return status


model_registry = ModelRegistry()
