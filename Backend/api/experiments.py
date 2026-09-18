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
def design_space(domain: str = Query("reaction_yield", description="Domain ID")) -> Dict[str, Any]:
    """The experimental design space the model was trained on."""
    clean_domain = (domain or "reaction_yield").replace("-", "_")
    if clean_domain != "reaction_yield":
        from services.domain_generator import get_domain_config
        return get_domain_config(clean_domain)

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
    raw_domain = payload.domain or "reaction_yield"
    clean_domain = raw_domain.replace("-", "_")

    try:
        if clean_domain == "reaction_yield":
            _require_model()
            result = generate_experiments(
                payload.objective,
                num_experiments=payload.num_experiments,
                constraints=payload.constraints,
            )
        else:
            from services.domain_generator import generate_experiments as domain_generate
            result = domain_generate(
                clean_domain,
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
    raw_domain = payload.model_dump().get('domain') or 'reaction_yield'
    domain = raw_domain.replace('-', '_')
    if domain == 'reaction_yield':
        _require_model()
    else:
        from services.model_registry import model_registry
        try:
            model_registry.load(domain)
        except ModelNotTrainedError as error:
            raise HTTPException(status_code=status.HTTP_503_SERVICE_UNAVAILABLE, detail=str(error)) from error

    # Extract experiment params based on domain — exclude control fields and None values
    # (SimulationRequest has Optional reaction_yield fields that arrive as None for other domains)
    experiment = {
        k: v for k, v in payload.model_dump(exclude={"speed"}).items()
        if k != 'domain' and v is not None
    }
    
    try:
        if domain == 'reaction_yield':
            prediction = model_store.predict_one(experiment)
            result = simulate(
                experiment,
                predicted_yield=prediction["predicted_yield"],
                uncertainty_std=prediction["uncertainty_std"],
                speed=payload.speed,
            )
        else:
            from simulator.domain_simulator import simulate as domain_simulate
            from services.model_registry import model_registry
            prediction = model_registry.predict_one(domain, experiment)
            pred_key = {
                'solar_efficiency': 'predicted_efficiency',
                'plant_growth': 'predicted_biomass_yield',
                'battery_performance': 'predicted_capacity_retention',
                'water_purification': 'predicted_turbidity_removal',
            }.get(domain, 'predicted_value')
            result = domain_simulate(
                experiment,
                domain=domain,
                predicted_target=prediction.get(pred_key, 0),
                uncertainty_std=prediction.get('uncertainty_std', 0),
                speed=payload.speed,
            )
    except ValueError as error:
        raise HTTPException(status_code=status.HTTP_422_UNPROCESSABLE_ENTITY, detail=str(error)) from error

    if "predicted_yield" not in result:
        result["predicted_yield"] = result.get("predicted_target")
    if "observed_yield" not in result:
        result["observed_yield"] = result.get("observed_target")

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
