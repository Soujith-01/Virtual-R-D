"""POST /predict - single-experiment ML outcome prediction."""

from __future__ import annotations

from typing import Any, Dict
from fastapi import APIRouter, HTTPException, status
from api.schemas import PredictionResponse
from services.model_store import ModelNotTrainedError, model_store
from services.model_registry import model_registry

router = APIRouter(tags=["Prediction"])

CONFIDENCE_BASIS = (
    "Estimated from the disagreement between the Random Forest's individual trees, "
    "combined with the residual spread measured on the held-out test split. "
    "This is a model-derived uncertainty proxy, NOT a calibrated probability and NOT "
    "statistical certainty about a real experiment."
)

INTERVAL_LABEL = "approximate_interval (model-derived, ~90% coverage assumption)"


@router.post(
    "/predict",
    response_model=PredictionResponse,
    summary="Predict outcome for one experiment",
)
def predict(payload: Dict[str, Any]) -> PredictionResponse:
    """Run the trained surrogate model on a single set of conditions."""
    domain = payload.get("domain", "reaction-yield").replace("-", "_")
    experiment = {k: v for k, v in payload.items() if k != "domain"}

    try:
        if domain == "reaction_yield":
            prediction = model_store.predict_one(experiment)
            metadata = model_store.metadata
        else:
            prediction = model_registry.predict_one(domain, experiment)
            metadata = model_registry.metadata(domain)
            pred_key = {
                'solar_efficiency': 'predicted_efficiency',
                'plant_growth': 'predicted_biomass_yield',
                'battery_performance': 'predicted_capacity_retention',
                'water_purification': 'predicted_turbidity_removal',
            }.get(domain, 'predicted_value')
            prediction["predicted_yield"] = prediction.get(pred_key, 0.0)
    except ModelNotTrainedError as error:
        raise HTTPException(status_code=status.HTTP_503_SERVICE_UNAVAILABLE, detail=str(error)) from error
    except Exception as error:
        raise HTTPException(status_code=status.HTTP_422_UNPROCESSABLE_ENTITY, detail=f"Prediction error for domain '{domain}': {error}") from error

    return PredictionResponse(
        predicted_yield=prediction.get("predicted_yield", 0.0),
        confidence=prediction.get("estimated_confidence", 0.8),
        confidence_label="estimated_model_confidence (uncertainty proxy, not a statistical guarantee)",
        confidence_basis=CONFIDENCE_BASIS,
        uncertainty_std=prediction.get("uncertainty_std", 2.0),
        interval_low=prediction.get("interval_low", 0.0),
        interval_high=prediction.get("interval_high", 100.0),
        interval_label=INTERVAL_LABEL,
        experiment=experiment,
        model={
            "type": metadata.get("model_type", "RandomForestRegressor"),
            "target": metadata.get("target", "Yield"),
            "trained_at": metadata.get("trained_at", ""),
            "metrics": metadata.get("metrics", {}),
            "dataset_provenance": metadata.get("dataset_provenance", "synthetic_prototype_v1"),
        },
        disclaimer=str(metadata.get("disclaimer", "")),
    )
