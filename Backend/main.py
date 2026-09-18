"""
Virtual R&D Lab - FastAPI application (Phase 4 entrypoint).

Run from the backend directory:

    python -m uvicorn main:app --reload
    python main.py            # same thing, without the reloader

Interactive docs:  http://127.0.0.1:8000/docs
"""

from __future__ import annotations

import logging
import sys
import threading
import time
from contextlib import asynccontextmanager
from pathlib import Path
from typing import Any, Dict

from fastapi import FastAPI, Request
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import JSONResponse

BACKEND_ROOT = Path(__file__).resolve().parent
if str(BACKEND_ROOT) not in sys.path:
    sys.path.insert(0, str(BACKEND_ROOT))

from api import admin as admin_router  # noqa: E402
from api import auth as auth_router  # noqa: E402
from api import experiments as experiments_router  # noqa: E402
from api import models as models_router  # noqa: E402
from api import papers as papers_router  # noqa: E402
from api import prediction as prediction_router  # noqa: E402
from api import research as research_router  # noqa: E402
from api.schemas import HealthResponse  # noqa: E402
from config import settings  # noqa: E402
from db.store import run_store  # noqa: E402
from rag.retriever import retriever  # noqa: E402
from services.auth import hash_password  # noqa: E402
from services.llm import llm_client  # noqa: E402
from services.model_store import ModelNotTrainedError, model_store  # noqa: E402


logging.basicConfig(
    level=logging.INFO,
    format="%(asctime)s %(levelname)-7s %(name)s: %(message)s",
    datefmt="%H:%M:%S",
)
logger = logging.getLogger("virtual_rd_lab")

DISCLAIMER = (
    "The prediction model is trained on a SIMULATED prototype dataset. Outputs demonstrate an "
    "AI-driven experimental discovery workflow and are not validated real-world results."
)


def _warm_knowledge_base() -> None:
    """Build/load the RAG index in the background so startup stays instant."""
    try:
        started = time.perf_counter()
        retriever.ensure_ready()
        logger.info(
            "Knowledge base ready: %d chunks, %s (%.0f ms)",
            len(retriever.chunks),
            retriever.embedder.description if retriever.embedder else "n/a",
            (time.perf_counter() - started) * 1000.0,
        )
    except Exception as error:  # noqa: BLE001
        logger.warning("Knowledge base warm-up failed: %s", error)


@asynccontextmanager
async def lifespan(app: FastAPI):
    """Startup: warm the model, the knowledge index and the history store."""
    logger.info("Starting %s v%s", settings.app_name, settings.app_version)

    try:
        metadata = model_store.metadata
        metrics = metadata.get("metrics", {})
        logger.info(
            "Model loaded from %s (R2=%.3f, MAE=%.2f, provenance=%s)",
            model_store.model_path.name,
            metrics.get("r2", float("nan")),
            metrics.get("mae", float("nan")),
            metadata.get("dataset_provenance"),
        )
    except ModelNotTrainedError as error:
        logger.warning("Model not available yet: %s", error)

    run_store.init()
    # Seed initial administrator account if not existing
    try:
        admin_pwd_hash = hash_password(settings.admin_password)
        seeded = run_store.seed_admin_if_needed(
            email=settings.admin_email,
            password_hash=admin_pwd_hash,
            name=settings.admin_name,
            organization=settings.admin_organization,
        )
        if seeded:
            logger.info("Default administrator account initialized (%s)", settings.admin_email)
    except Exception as error:  # noqa: BLE001
        logger.warning("Could not seed default admin user: %s", error)

    threading.Thread(target=_warm_knowledge_base, name="rag-warmup", daemon=True).start()

    logger.info("Reasoning backend: %s", llm_client.info["note"])
    logger.info("Docs: http://127.0.0.1:8000/docs")
    yield
    logger.info("Shutting down.")


app = FastAPI(
    title=settings.app_name,
    version=settings.app_version,
    description=(
        "AI-powered virtual R&D environment for prioritising experiments before they are run "
        "in a real laboratory.\n\n"
        f"**Scientific disclaimer:** {DISCLAIMER}"
    ),
    lifespan=lifespan,
)

app.add_middleware(
    CORSMiddleware,
    allow_origins=settings.cors_origin_list,
    # Any localhost port, so a Vite port bump (5173 -> 5174 -> ...) cannot break
    # the dashboard with an opaque CORS failure. Disable via CORS_ORIGIN_REGEX=.
    allow_origin_regex=settings.cors_origin_pattern,
    allow_credentials=False,
    allow_methods=["*"],
    allow_headers=["*"],
)

app.include_router(auth_router.router)
app.include_router(admin_router.router)
app.include_router(prediction_router.router)
app.include_router(models_router.router)
app.include_router(experiments_router.router)
app.include_router(research_router.router)
app.include_router(papers_router.router)


@app.exception_handler(Exception)
async def unhandled_exception_handler(request: Request, exc: Exception) -> JSONResponse:
    """Return a clean JSON error instead of a bare traceback."""
    logger.exception("Unhandled error on %s %s", request.method, request.url.path)
    return JSONResponse(
        status_code=500,
        content={"detail": "internal server error", "error": f"{type(exc).__name__}: {exc}"},
    )


@app.get("/", tags=["Meta"], summary="Service overview")
def root() -> Dict[str, Any]:
    """Service metadata and the endpoint map."""
    return {
        "app": settings.app_name,
        "version": settings.app_version,
        "description": "AI-powered experimental discovery platform for reaction-yield optimisation.",
        "docs": "/docs",
        "endpoints": {
            "GET /": "this overview",
            "GET /health": "readiness of model, knowledge base, LLM and history",
            "GET /design-space": "supported variables, ranges and protocol levels",
            "POST /predict": "predict yield for one experiment",
            "POST /generate-experiments": "generate + rank candidate experiments",
            "POST /simulate": "virtual reactor stage timeline",
            "POST /research": "full AI research pipeline",
            "GET /model-info": "trained model metrics and metadata",
            "GET /knowledge/search": "query the retrieval knowledge base",
            "GET /history": "recent research runs",
            "GET /history/{run_id}": "one stored run with its full report",
        },
        "disclaimer": DISCLAIMER,
    }


@app.get("/health", response_model=HealthResponse, tags=["Meta"], summary="Readiness check")
def health() -> HealthResponse:
    """Report whether each subsystem is ready, plus any non-fatal problems."""
    warnings: list[str] = []

    try:
        metadata = model_store.metadata
        model_loaded = True
    except ModelNotTrainedError as error:
        metadata = {}
        model_loaded = False
        warnings.append(str(error))

    try:
        kb = retriever.status()
        if not kb.get("ready"):
            warnings.append("knowledge base index not built yet (building in the background)")
    except Exception as error:  # noqa: BLE001
        kb = {"ready": False, "error": str(error)}
        warnings.append(f"knowledge base unavailable: {error}")

    if not llm_client.available:
        warnings.append(
            "no external LLM configured - deterministic template narration is in use "
            "(set LLM_PROVIDER/LLM_API_KEY in backend/.env to enable one)"
        )

    if not run_store.init():
        warnings.append("history store unavailable - runs will not be persisted")

    return HealthResponse(
        status="ok" if model_loaded else "degraded",
        app=settings.app_name,
        version=settings.app_version,
        model_loaded=model_loaded,
        model_path=str(model_store.model_path),
        model_metrics=metadata.get("metrics", {}),
        knowledge_base=kb,
        llm=llm_client.info,
        history={"available": run_store.available, "runs": run_store.count()},
        warnings=warnings,
    )


if __name__ == "__main__":
    import uvicorn

    uvicorn.run("main:app", host="127.0.0.1", port=8000, reload=settings.debug)
