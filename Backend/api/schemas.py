"""Pydantic request/response models for the Virtual R&D Lab API."""

from __future__ import annotations

from typing import Any, Dict, List, Literal, Optional

from pydantic import BaseModel, ConfigDict, Field, field_validator

from domain import CATALYSTS, RANGES

CatalystLiteral = Literal["A", "B", "C", "D", "None"]

_T_MIN, _T_MAX = RANGES["temperature"]
_P_MIN, _P_MAX = RANGES["pressure"]
_C_MIN, _C_MAX = RANGES["concentration"]
_TI_MIN, _TI_MAX = RANGES["reaction_time"]

EXAMPLE_EXPERIMENT = {
    "temperature": 90,
    "pressure": 2,
    "catalyst": "B",
    "concentration": 0.20,
    "reaction_time": 45,
}

#: Constraint keys are feature names, so they can be compared with an experiment.
CONSTRAINT_KEYS = ("temperature", "pressure", "concentration", "reaction_time")


class ExperimentParams(BaseModel):
    """A single experimental condition."""

    model_config = ConfigDict(
        json_schema_extra={"example": EXAMPLE_EXPERIMENT},
        extra="forbid",
    )

    temperature: float = Field(..., ge=_T_MIN, le=_T_MAX, description="Reaction temperature (degC)")
    pressure: float = Field(..., ge=_P_MIN, le=_P_MAX, description="Reactor pressure (bar)")
    catalyst: CatalystLiteral = Field(..., description=f"Catalyst level, one of {CATALYSTS}")
    concentration: float = Field(..., ge=_C_MIN, le=_C_MAX, description="Initial reagent concentration (M)")
    reaction_time: float = Field(..., ge=_TI_MIN, le=_TI_MAX, description="Hold time at set-point (min)")


class PredictionResponse(BaseModel):
    """Prediction for one experiment."""

    predicted_yield: float = Field(..., description="Predicted reaction yield (%)")
    confidence: float = Field(
        ...,
        description="Estimated model-derived confidence (0-1). NOT a calibrated probability.",
    )
    confidence_label: str = Field(
        "estimated_model_confidence",
        description="Reminder that `confidence` is an uncertainty proxy, not statistical certainty.",
    )
    confidence_basis: str
    uncertainty_std: float = Field(..., description="Standard deviation across the forest's trees (yield points)")
    interval_low: float
    interval_high: float
    interval_label: str
    experiment: Dict[str, Any]
    model: Dict[str, Any]
    disclaimer: str


class GenerateExperimentsRequest(BaseModel):
    """Request body for model-guided candidate generation."""

    model_config = ConfigDict(json_schema_extra={"example": {"objective": "Maximize reaction yield while minimizing reaction time.", "num_experiments": 5}})

    objective: str = Field(..., min_length=3, max_length=500, description="Free-text research objective")
    num_experiments: int = Field(5, ge=1, le=20, description="Shortlist size")
    constraints: Optional[Dict[str, float]] = Field(
        None,
        description=f"Optional hard upper bounds keyed by {list(CONSTRAINT_KEYS)}",
    )

    @field_validator("constraints")
    @classmethod
    def _validate_constraints(cls, value: Optional[Dict[str, float]]) -> Optional[Dict[str, float]]:
        if not value:
            return None
        unknown = [key for key in value if key not in CONSTRAINT_KEYS]
        if unknown:
            raise ValueError(f"unknown constraint key(s) {unknown}; allowed: {list(CONSTRAINT_KEYS)}")
        for key, ceiling in value.items():
            if not isinstance(ceiling, (int, float)):
                raise ValueError(f"constraint {key} must be numeric")
        return value


class GenerateExperimentsResponse(BaseModel):
    objective: Dict[str, Any]
    experiments: List[Dict[str, Any]]
    search: Dict[str, Any]
    model: Dict[str, Any]
    knowledge: Optional[List[Dict[str, Any]]] = None
    disclaimer: str


class SimulationRequest(ExperimentParams):
    """Request body for the virtual reactor."""

    speed: float = Field(1.0, gt=0.0, le=8.0, description="Playback multiplier for the timeline")


class SimulationResponse(BaseModel):
    experiment: Dict[str, Any]
    predicted_yield: float
    observed_yield: float
    prediction_error: float
    stages: List[Dict[str, Any]]
    frames: List[Dict[str, Any]]
    total_duration_ms: int
    frame_interval_ms: int
    factor_contributions: Dict[str, float]
    safety: Dict[str, Any]
    summary: str
    units: Dict[str, str]
    disclaimer: str


class ResearchRequest(BaseModel):
    """Request body for the full AI research agent."""

    model_config = ConfigDict(
        json_schema_extra={
            "example": {"research_question": "Maximize reaction yield while minimizing reaction time."}
        }
    )

    research_question: str = Field(..., min_length=3, max_length=500)
    num_experiments: int = Field(5, ge=1, le=20)
    constraints: Optional[Dict[str, float]] = None
    include_simulation: bool = Field(True, description="Also run the top candidate through the virtual reactor")
    include_comparison: bool = Field(
        True, description="Also rank a baseline and an aggressive control condition for context"
    )

    @field_validator("constraints")
    @classmethod
    def _validate_constraints(cls, value: Optional[Dict[str, float]]) -> Optional[Dict[str, float]]:
        return GenerateExperimentsRequest._validate_constraints(value)


class ResearchResponse(BaseModel):
    run_id: Optional[str] = None
    elapsed_ms: float
    research_question: str
    research_objective: Dict[str, Any]
    identified_variables: List[Dict[str, Any]]
    retrieved_knowledge: List[Dict[str, Any]]
    candidate_experiments: List[Dict[str, Any]]
    search: Optional[Dict[str, Any]] = None
    ranking: List[Dict[str, Any]]
    recommended_experiment: Dict[str, Any]
    simulation: Optional[Dict[str, Any]] = None
    comparison: Optional[List[Dict[str, Any]]] = None
    explanation: Dict[str, Any]
    next_suggested_experiment: Dict[str, Any]
    model: Dict[str, Any]
    reasoning_backend: Dict[str, Any]
    knowledge_base: Optional[Dict[str, Any]] = None
    agent_trace: List[Dict[str, Any]] = []
    disclaimers: List[str]


class HealthResponse(BaseModel):
    status: str
    app: str
    version: str
    model_loaded: bool
    model_path: str
    model_metrics: Dict[str, Any]
    knowledge_base: Dict[str, Any]
    llm: Dict[str, Any]
    history: Dict[str, Any]
    warnings: List[str] = []
