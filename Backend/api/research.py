"""POST /research, run history and model introspection endpoints."""

from __future__ import annotations

import logging
from typing import Any, Dict

from fastapi import APIRouter, HTTPException, Query, status

from api.schemas import ResearchRequest, ResearchResponse
from db.store import run_store
from services.llm import llm_client
from services.model_store import ModelNotTrainedError, model_store
from services.research_agent import run_research

logger = logging.getLogger("virtual_rd_lab.api.research")

router = APIRouter(tags=["Research agent"])


@router.post(
    "/research",
    response_model=ResearchResponse,
    summary="Run the full AI research pipeline for a research question",
)
def research(payload: ResearchRequest) -> ResearchResponse:
    """
    End-to-end agent run: interpret the objective, identify variables, retrieve
    scientific knowledge, generate candidates, predict, compare, rank, explain
    and propose the next experiment.
    """
    try:
        model_store.load()
    except ModelNotTrainedError as error:
        raise HTTPException(status_code=status.HTTP_503_SERVICE_UNAVAILABLE, detail=str(error)) from error

    try:
        result = run_research(
            payload.research_question,
            num_experiments=payload.num_experiments,
            constraints=payload.constraints,
            include_simulation=payload.include_simulation,
            include_comparison=payload.include_comparison,
        )
    except ValueError as error:
        raise HTTPException(status_code=status.HTTP_422_UNPROCESSABLE_ENTITY, detail=str(error)) from error

    return ResearchResponse(**result)


@router.get("/model-info", summary="Trained model metadata and evaluation metrics")
def model_info() -> Dict[str, Any]:
    """Surface the training metrics so the demo can quote them honestly."""
    try:
        metadata = model_store.metadata
    except ModelNotTrainedError as error:
        raise HTTPException(status_code=status.HTTP_503_SERVICE_UNAVAILABLE, detail=str(error)) from error

    return {
        "model_path": str(model_store.model_path),
        "metadata": metadata,
        "reasoning_backend": llm_client.info,
        "history_runs": run_store.count(),
    }


@router.get("/history", summary="Recent research runs")
def history(limit: int = Query(20, ge=1, le=200)) -> Dict[str, Any]:
    """Newest-first list of persisted research runs."""
    return {
        "available": run_store.available,
        "count": run_store.count(),
        "runs": run_store.list_runs(limit=limit),
    }


@router.get("/history/{run_id}", summary="One research run including its full report")
def history_detail(run_id: str) -> Dict[str, Any]:
    record = run_store.get_run(run_id)
    if record is None:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail=f"run {run_id!r} not found")
    return record
