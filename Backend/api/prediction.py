"""POST /predict - single-experiment ML outcome prediction."""

from __future__ import annotations

from fastapi import APIRouter, HTTPException, status

from api.schemas import ExperimentParams, PredictionResponse
from services.model_store import ModelNotTrainedError, model_store

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
    summary="Predict reaction yield for one experiment",
)
def predict(payload: ExperimentParams) -> PredictionResponse:
    """Run the trained surrogate model on a single set of conditions."""
    experiment = payload.model_dump()

    try:
        prediction = model_store.predict_one(experiment)
        metadata = model_store.metadata
    except ModelNotTrainedError as error:
        raise HTTPException(status_code=status.HTTP_503_SERVICE_UNAVAILABLE, detail=str(error)) from error

    return PredictionResponse(
        predicted_yield=prediction["predicted_yield"],
        confidence=prediction["estimated_confidence"],
        confidence_label="estimated_model_confidence (uncertainty proxy, not a statistical guarantee)",
        confidence_basis=CONFIDENCE_BASIS,
        uncertainty_std=prediction["uncertainty_std"],
        interval_low=prediction["interval_low"],
        interval_high=prediction["interval_high"],
        interval_label=INTERVAL_LABEL,
        experiment=experiment,
        model={
            "type": metadata.get("model_type"),
            "target": metadata.get("target"),
            "trained_at": metadata.get("trained_at"),
            "metrics": metadata.get("metrics"),
            "dataset_provenance": metadata.get("dataset_provenance"),
        },
        disclaimer=str(metadata.get("disclaimer", "")),
    )
