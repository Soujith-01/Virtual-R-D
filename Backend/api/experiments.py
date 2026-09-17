"""POST /generate-experiments, POST /simulate and supporting endpoints."""

from __future__ import annotations

import logging
from typing import Any, Dict, List

from fastapi import APIRouter, HTTPException, Query, status

from api.schemas import (
    GenerateExperimentsRequest,
    GenerateExperimentsResponse,
    SimulationRequest,
    SimulationResponse,
)
from domain import CATALYSTS, FEATURE_LEVELS, RANGES, SAFE_ENVELOPE
from rag.retriever import retriever
from services.experiment_generator import generate_experiments
from services.llm import llm_client
from services.model_store import ModelNotTrainedError, model_store
from simulator.simulator import simulate

logger = logging.getLogger("virtual_rd_lab.api.experiments")

router = APIRouter(tags=["Experiments"])


def _require_model() -> None:
    try:
        model_store.load()
    except ModelNotTrainedError as error:
        raise HTTPException(status_code=status.HTTP_503_SERVICE_UNAVAILABLE, detail=str(error)) from error


@router.get("/design-space", summary="Supported variables, ranges and protocol levels")
def design_space() -> Dict[str, Any]:
    """The experimental design space the model was trained on."""
    return {
        "numeric_variables": [
            {
                "name": name,
                "unit": {"temperature": "degC", "pressure": "bar", "concentration": "M", "reaction_time": "min"}[name],
                "min": RANGES[name][0],
                "max": RANGES[name][1],
                "comfortable_window": list(SAFE_ENVELOPE[name]),
                "levels": [float(value) for value in FEATURE_LEVELS[name]],
            }
            for name in ("temperature", "pressure", "concentration", "reaction_time")
        ],
        "categorical_variables": [
            {"name": "catalyst", "options": CATALYSTS},
        ],
        "target": {"name": "yield", "unit": "%", "range": [0.0, 100.0]},
        "note": (
            "Ranges match the synthetic prototype dataset. Replace the dataset and retrain "
            "to move to different chemistry."
        ),
    }


@router.post(
    "/generate-experiments",
    response_model=GenerateExperimentsResponse,
    summary="Generate ranked candidate experiments for an objective",
)
def generate(payload: GenerateExperimentsRequest) -> GenerateExperimentsResponse:
    """
    Model-guided candidate generation: sample the design space, predict with the
    Random Forest, score against the parsed objective, refine locally, then keep a
    diverse shortlist.
    """
    _require_model()

    try:
        result = generate_experiments(
            payload.objective,
            num_experiments=payload.num_experiments,
            constraints=payload.constraints,
        )
    except ValueError as error:
        raise HTTPException(status_code=status.HTTP_422_UNPROCESSABLE_ENTITY, detail=str(error)) from error

    knowledge: List[Dict[str, Any]] = []
    try:
        knowledge = retriever.retrieve(payload.objective, k=3)
    except Exception as error:  # noqa: BLE001
        logger.warning("Knowledge retrieval failed: %s", error)

    return GenerateExperimentsResponse(
        objective=result["objective"],
        experiments=result["experiments"],
        search=result["search"],
        model=result["model"],
        knowledge=knowledge,
        disclaimer=result["disclaimer"],
    )


@router.post(
    "/simulate",
    response_model=SimulationResponse,
    summary="Run a virtual experiment and return its stage timeline",
)
def run_simulation(payload: SimulationRequest) -> SimulationResponse:
    """Produce the frame-by-frame timeline the frontend animates."""
    _require_model()

    experiment = payload.model_dump(exclude={"speed"})
    try:
        prediction = model_store.predict_one(experiment)
        result = simulate(
            experiment,
            predicted_yield=prediction["predicted_yield"],
            uncertainty_std=prediction["uncertainty_std"],
            speed=payload.speed,
        )
    except ValueError as error:
        raise HTTPException(status_code=status.HTTP_422_UNPROCESSABLE_ENTITY, detail=str(error)) from error

    return SimulationResponse(**result)


@router.get("/knowledge/search", summary="Query the retrieval knowledge base directly")
def knowledge_search(
    q: str = Query(..., min_length=2, description="free-text query"),
    k: int = Query(4, ge=1, le=20),
) -> Dict[str, Any]:
    """Expose the RAG layer so the retrieval step is auditable from the UI."""
    try:
        retriever.ensure_ready()
    except Exception as error:  # noqa: BLE001
        raise HTTPException(
            status_code=status.HTTP_503_SERVICE_UNAVAILABLE,
            detail=f"knowledge base unavailable: {error}",
        ) from error

    return {
        "query": q,
        "results": retriever.retrieve(q, k=k),
        "knowledge_base": retriever.status(),
        "reasoning_backend": llm_client.info,
    }
