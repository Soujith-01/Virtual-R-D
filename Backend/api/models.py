"""
API endpoints for model management and status.

Provides:
- GET /models/status - status of all trained models
- POST /models/train - train a specific model or all models
"""

from __future__ import annotations

import logging
from pathlib import Path
from typing import Any, Dict, List

from fastapi import APIRouter, HTTPException, status

from config import settings
from services.model_registry import ModelNotTrainedError, model_registry

logger = logging.getLogger("virtual_rd_lab.api.models")

router = APIRouter(tags=["Models"])


@router.get("/models/status", summary="Status of all trained models")
def models_status() -> Dict[str, Any]:
    """Return status of all domain models."""
    try:
        return {
            "status": "ok",
            "models": model_registry.all_status(),
            "count": len(model_registry.all_status()),
        }
    except Exception as error:
        logger.exception("Failed to get model status: %s", error)
        raise HTTPException(status_code=500, detail=f"Failed to get model status: {error}")


@router.post("/models/train", summary="Train a specific model or all models")
def train_model(payload: Dict[str, Any] | None = None) -> Dict[str, Any]:
    """Train a specific domain model or all models."""
    from training.train_domain_model import train, MODEL_FILES, METADATA_FILES, DATASET_FILES

    body = payload or {}
    domain = body.get("domain", "all")

    if domain == "all":
        domains = list(DATASET_FILES.keys())
    elif domain in DATASET_FILES:
        domains = [domain]
    else:
        raise HTTPException(
            status_code=400,
            detail=f"Unknown domain: {domain}. Valid options: {list(DATASET_FILES.keys())} or 'all'"
        )

    results: Dict[str, Any] = {}
    errors: List[str] = []

    for dom in domains:
        try:
            logger.info("Training model for domain: %s", dom)
            metadata = train(
                domain=dom,
                dataset_path=DATASET_FILES[dom],
                model_path=MODEL_FILES[dom],
                metadata_path=METADATA_FILES[dom],
            )
            results[dom] = {
                "status": "trained",
                "model_path": str(MODEL_FILES[dom]),
                "metadata_path": str(METADATA_FILES[dom]),
                "metadata": metadata,
            }
            logger.info("Successfully trained %s model: R²=%.4f, MAE=%.4f", dom, metadata["metrics"]["r2"], metadata["metrics"]["mae"])
        except Exception as error:
            error_msg = str(error)
            logger.error("Failed to train %s model: %s", dom, error_msg)
            errors.append(f"{dom}: {error_msg}")
            results[dom] = {
                "status": "failed",
                "error": error_msg,
            }

    if errors:
        status_code = status.HTTP_207_MULTI_STATUS
    else:
        status_code = status.HTTP_200_OK

    return {
        "status": "ok" if not errors else "partial_failure",
        "domains_trained": len([r for r in results.values() if r.get("status") == "trained"]),
        "domains_failed": len(errors),
        "results": results,
        "disclaimer": "Models are trained on synthetic prototype datasets for demonstration purposes only.",
    }


@router.get("/models/{domain}/info", summary="Get info for a specific domain model")
def model_info(domain: str) -> Dict[str, Any]:
    """Get detailed info for a specific domain model."""
    if domain not in model_registry.all_status():
        raise HTTPException(status_code=404, detail=f"Unknown domain: {domain}")

    try:
        status_info = model_registry.all_status()[domain]
        if status_info.get("status") != "ready":
            raise HTTPException(status_code=503, detail=f"Model for {domain} is not ready")

        return {
            "domain": domain,
            "status": "ready",
            "label": status_info.get("label"),
            "algorithm": status_info.get("algorithm"),
            "model_path": status_info.get("model_path"),
            "metrics": {
                "r2": status_info.get("r2"),
                "mae": status_info.get("mae"),
                "rmse": status_info.get("rmse"),
            },
            "training_info": {
                "training_samples": status_info.get("training_samples"),
                "test_samples": status_info.get("test_samples"),
                "dataset_rows": status_info.get("dataset_rows"),
                "dataset_provenance": status_info.get("dataset_provenance"),
            },
            "target": status_info.get("target"),
            "target_unit": status_info.get("target_unit"),
            "features": status_info.get("features"),
            "disclaimer": status_info.get("disclaimer"),
        }
    except ModelNotTrainedError as error:
        raise HTTPException(status_code=503, detail=str(error))
    except Exception as error:
        logger.exception("Failed to get model info for %s: %s", domain, error)
        raise HTTPException(status_code=500, detail=f"Failed to get model info: {error}")
