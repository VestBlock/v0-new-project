from __future__ import annotations

import hmac
import logging
import uuid
from contextlib import asynccontextmanager

from fastapi import Depends, FastAPI, HTTPException, Request, status
from fastapi.middleware.trustedhost import TrustedHostMiddleware
from fastapi.responses import JSONResponse
from starlette.concurrency import run_in_threadpool

from app.callback import CallbackDeliveryError, deliver_research_callback
from app.models import ResearchRequest, ResearchResponse
from app.policy import PolicyViolation
from app.research import ResearchRunner
from app.settings import Settings

logger = logging.getLogger("vestblock.scrapling_worker")


def create_app(settings: Settings | None = None, runner: ResearchRunner | None = None) -> FastAPI:
    active_settings = settings or Settings.from_env()
    active_runner = runner or ResearchRunner(active_settings)

    @asynccontextmanager
    async def lifespan(_: FastAPI):
        error = active_settings.startup_error()
        if error:
            raise RuntimeError(error)
        yield

    app = FastAPI(
        title="Vestblock Public Research Worker",
        docs_url=None,
        redoc_url=None,
        openapi_url=None,
        lifespan=lifespan,
    )
    app.add_middleware(TrustedHostMiddleware, allowed_hosts=list(active_settings.trusted_hosts))

    @app.middleware("http")
    async def reject_oversized_requests(request: Request, call_next):
        content_length = request.headers.get("content-length")
        if content_length and content_length.isdigit() and int(content_length) > active_settings.max_request_bytes:
            return JSONResponse({"detail": "Request body is too large."}, status_code=status.HTTP_413_REQUEST_ENTITY_TOO_LARGE)
        return await call_next(request)

    def require_worker_token(request: Request) -> None:
        expected = active_settings.worker_token
        provided = request.headers.get("authorization", "")
        if not expected:
            raise HTTPException(status_code=status.HTTP_503_SERVICE_UNAVAILABLE, detail="Research worker is not configured.")
        if not hmac.compare_digest(provided, f"Bearer {expected}"):
            raise HTTPException(status_code=status.HTTP_401_UNAUTHORIZED, detail="Unauthorized.")

    @app.get("/healthz")
    async def healthz() -> dict[str, str]:
        return {"status": "ready" if active_settings.startup_error() is None else "configuration_required"}

    @app.post("/v1/research", response_model=ResearchResponse, dependencies=[Depends(require_worker_token)])
    async def collect_public_research(payload: ResearchRequest) -> ResearchResponse:
        try:
            evidence = await run_in_threadpool(active_runner.collect, payload)
        except PolicyViolation as error:
            logger.info("research_request_blocked reason=%s", error)
            raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail=str(error)) from error
        if payload.job_id:
            try:
                request_id = await run_in_threadpool(deliver_research_callback, active_settings, payload.job_id, evidence)
            except CallbackDeliveryError as error:
                logger.warning("research_callback_failed job_id=%s reason=%s", payload.job_id, error)
                raise HTTPException(status_code=status.HTTP_502_BAD_GATEWAY, detail="Research evidence could not be delivered to Vestblock.") from error
        else:
            request_id = str(uuid.uuid4())
        return ResearchResponse(request_id=request_id, evidence=evidence)

    return app


app = create_app()
