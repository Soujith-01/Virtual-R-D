"""
FastAPI Router for the Experiment Copilot (Phase 13).

Provides the clean internal endpoint POST /api/experiment-chat.
Strictly local: consumes the local RAG retriever and local models without external APIs.
"""

from __future__ import annotations

import logging
from typing import Any, Dict, List, Optional

from fastapi import APIRouter, HTTPException, status
from pydantic import BaseModel, Field

from services.copilot import ask_experiment_copilot

logger = logging.getLogger("virtual_rd_lab.api.copilot")

router = APIRouter(prefix="/api", tags=["Experiment Copilot"])


class CopilotChatRequest(BaseModel):
    """Payload for an Experiment Copilot conversation turn."""

    question: str = Field(..., min_length=1, max_length=1500, description="Researcher query")
    context: Optional[Dict[str, Any]] = Field(default_factory=dict, description="Active UI/experiment context")
    history: Optional[List[Dict[str, str]]] = Field(default_factory=list, description="Recent conversation turns")


class CopilotChatResponse(BaseModel):
    """Grounded response with structured sources and telemetry."""

    answer: str
    sources: List[Dict[str, Any]] = Field(default_factory=list)
    context_used: List[str] = Field(default_factory=list)
    timestamp: str
    model_backend: Optional[str] = None
    guardrail_triggered: bool = False


@router.post(
    "/experiment-chat",
    response_model=CopilotChatResponse,
    summary="Ask the persistent Experiment Copilot",
)
def experiment_chat(payload: CopilotChatRequest) -> CopilotChatResponse:
    """
    Directs the researcher's query into the local RAG knowledge pipeline and
    local models, returning a grounded, source-attributed answer.
    """
    try:
        result = ask_experiment_copilot(
            question=payload.question,
            context=payload.context or {},
            history=payload.history or [],
        )
        return CopilotChatResponse(**result)
    except Exception as error:
        logger.exception("Error processing Copilot chat turn: %s", error)
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Experiment Copilot failed to generate response: {error}",
        ) from error
