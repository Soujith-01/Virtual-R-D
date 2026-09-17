"""
Phase 4 - Trained-model service.

Loads the joblib bundle produced by ``training/train_model.py`` once per process
and exposes prediction helpers used by the API.

Uncertainty handling
--------------------
Random Forests are ensembles: the spread of the individual tree predictions is a
useful *disagreement* signal. We expose it as ``uncertainty_std`` and derive an
``estimated_confidence`` from it. This is a model-derived uncertainty proxy, NOT
a calibrated statistical confidence, and every API response says so explicitly.
"""

from __future__ import annotations

import threading
from pathlib import Path
from typing import Dict, List, Sequence

import joblib
import numpy as np
import pandas as pd

from config import settings
from domain import FEATURE_NAMES, normalise_catalyst

#: How much tree disagreement (in % yield) maps to a confidence of 1.0 -> 0.5.
CONFIDENCE_SCALE = 25.0
#: z-multiplier for the reported approximate interval (~90 %).
INTERVAL_Z = 1.645


class ModelNotTrainedError(RuntimeError):
    """Raised when the model artifact is missing or unreadable."""


class ModelStore:
    """Thread-safe lazy singleton around the persisted scikit-learn pipeline."""

    def __init__(self, model_path: str | Path | None = None) -> None:
        self._model_path = Path(model_path or settings.model_path)
        self._lock = threading.Lock()
        self._bundle: dict | None = None

    # ------------------------------------------------------------------ #
    # lifecycle
    # ------------------------------------------------------------------ #
    @property
    def model_path(self) -> Path:
        return self._model_path

    @property
    def is_loaded(self) -> bool:
        return self._bundle is not None

    def load(self, *, force: bool = False) -> dict:
        """Load (and cache) the model bundle."""
        with self._lock:
            if self._bundle is not None and not force:
                return self._bundle

            if not self._model_path.exists():
                raise ModelNotTrainedError(
                    f"No trained model at {self._model_path}. "
                    "Train it first:  python training/generate_dataset.py && "
                    "python training/train_model.py"
                )

            try:
                bundle = joblib.load(self._model_path)
            except Exception as error:  # pragma: no cover - corrupt artifact
                raise ModelNotTrainedError(
                    f"Could not load model from {self._model_path}: {error}"
                ) from error

            if not isinstance(bundle, dict) or "pipeline" not in bundle:
                raise ModelNotTrainedError(
                    f"Unexpected model artifact format at {self._model_path}"
                )

            self._bundle = bundle
            return bundle

    def reload(self) -> dict:
        """Force a re-read from disk (used after retraining)."""
        return self.load(force=True)

    # ------------------------------------------------------------------ #
    # metadata
    # ------------------------------------------------------------------ #
    @property
    def metadata(self) -> dict:
        return dict(self.load().get("metadata", {}))

    @property
    def residual_std(self) -> float:
        bundle = self.load()
        value = bundle.get("residual_std")
        if value is None:
            value = bundle.get("metadata", {}).get("residual_std", 4.0)
        return float(value)

    # ------------------------------------------------------------------ #
    # inference
    # ------------------------------------------------------------------ #
    @staticmethod
    def _to_frame(experiments: Sequence[dict]) -> pd.DataFrame:
        rows = []
        for experiment in experiments:
            rows.append(
                {
                    "temperature": float(experiment["temperature"]),
                    "pressure": float(experiment["pressure"]),
                    "catalyst": normalise_catalyst(experiment.get("catalyst")),
                    "concentration": float(experiment["concentration"]),
                    "reaction_time": float(experiment["reaction_time"]),
                }
            )
        return pd.DataFrame(rows, columns=FEATURE_NAMES)

    def predict(self, experiments: Sequence[dict]) -> List[Dict[str, float]]:
        """
        Predict yield for one or many experiments.

        Returns one dict per experiment with ``predicted_yield`` (clipped to
        0-100), ``uncertainty_std``, ``estimated_confidence`` and an approximate
        ``interval`` around the point estimate.
        """
        if not experiments:
            return []

        bundle = self.load()
        pipeline = bundle["pipeline"]
        frame = self._to_frame(experiments)

        transformed = pipeline.named_steps["preprocessor"].transform(frame)
        trees = pipeline.named_steps["model"].estimators_
        tree_predictions = np.vstack([tree.predict(transformed) for tree in trees])

        means = tree_predictions.mean(axis=0)
        spreads = tree_predictions.std(axis=0)
        baseline = self.residual_std

        results: List[Dict[str, float]] = []
        for mean, spread in zip(means, spreads):
            predicted = float(np.clip(mean, 0.0, 100.0))
            uncertainty = float(max(spread, 0.0))
            confidence = float(
                np.clip(1.0 - uncertainty / CONFIDENCE_SCALE, 0.05, 0.99)
            )
            half_width = float(
                np.clip(
                    INTERVAL_Z * float(np.sqrt(baseline**2 + uncertainty**2)), 0.0, 100.0
                )
            )
            results.append(
                {
                    "predicted_yield": round(predicted, 2),
                    "uncertainty_std": round(uncertainty, 2),
                    "estimated_confidence": round(confidence, 3),
                    "interval_low": round(max(predicted - half_width, 0.0), 2),
                    "interval_high": round(min(predicted + half_width, 100.0), 2),
                }
            )
        return results

    def predict_one(self, experiment: dict) -> Dict[str, float]:
        return self.predict([experiment])[0]

    # ------------------------------------------------------------------ #
    # reporting helpers
    # ------------------------------------------------------------------ #
    @property
    def feature_importance(self) -> Dict[str, float]:
        metadata = self.metadata
        return dict(metadata.get("feature_importance_by_group", {}))

    @property
    def metrics(self) -> Dict[str, float]:
        return dict(self.metadata.get("metrics", {}))


#: Module-level singleton used by the API routers.
model_store = ModelStore()
