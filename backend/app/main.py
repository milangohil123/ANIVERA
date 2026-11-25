"""PashuRakshak FastAPI Application Entrypoint."""
from contextlib import asynccontextmanager
import os
from fastapi import FastAPI, Request
from fastapi.middleware.cors import CORSMiddleware
from fastapi.exceptions import RequestValidationError
from fastapi.responses import JSONResponse
from fastapi.staticfiles import StaticFiles
from app.api.v1.router import api_router
from app.core.config import settings
from app.core.logging import logger, setup_logging
from app.db.session import close_db_connection
from app.db.health_workflow_schema import ensure_health_workflow_schema


@asynccontextmanager
async def lifespan(app: FastAPI):
    """Application startup and shutdown lifecycle management."""
    setup_logging()
    logger.info("Starting %s backend service (v%s)...", settings.PROJECT_NAME, settings.VERSION)
    logger.info("Environment: %s | Debug: %s", settings.ENVIRONMENT, settings.DEBUG)
    try:
        await ensure_health_workflow_schema()
    except Exception as e:
        logger.warning("Startup schema check error: %s", e)
    yield
    logger.info("Shutting down %s backend service...", settings.PROJECT_NAME)
    await close_db_connection()


app = FastAPI(
    title=settings.PROJECT_NAME,
    version=settings.VERSION,
    description="PashuRakshak Botad — Digital Livestock Vaccination Tracking and Disease Early-Warning Platform",
    openapi_url=f"{settings.API_V1_STR}/openapi.json",
    docs_url=f"{settings.API_V1_STR}/docs",
    redoc_url=f"{settings.API_V1_STR}/redoc",
    lifespan=lifespan
)

# CORS Configuration
if settings.BACKEND_CORS_ORIGINS:
    app.add_middleware(
        CORSMiddleware,
        allow_origins=settings.BACKEND_CORS_ORIGINS,
        allow_credentials=True,
        allow_methods=["*"],
        allow_headers=["*"],
    )

# Include API v1 Router
app.include_router(api_router, prefix=settings.API_V1_STR)

# Ensure storage directories exist and mount static storage
storage_root = os.path.abspath(settings.STORAGE_LOCAL_ROOT)
os.makedirs(storage_root, exist_ok=True)
os.makedirs(os.path.abspath(settings.DISEASE_ATTACHMENTS_DIR), exist_ok=True)
app.mount("/storage", StaticFiles(directory=storage_root), name="storage")


@app.exception_handler(RequestValidationError)
async def validation_exception_handler(request: Request, exc: RequestValidationError):
    """Clean Gujarati/English error diagnostics for schema validation failures."""
    field_errors = []
    for error in exc.errors():
        loc_parts = [str(x) for x in error.get("loc", []) if x != "body"]
        field_name = " -> ".join(loc_parts)
        msg = error.get("msg", "અમાન્ય વિગત")
        if field_name:
            field_errors.append(f"{field_name}: {msg}")
        else:
            field_errors.append(msg)
    joined_msg = "; ".join(field_errors) if field_errors else "અમાન્ય ફોર્મ વિગતો."
    logger.warning("Request validation failed on %s %s: %s", request.method, request.url.path, joined_msg)
    return JSONResponse(
        status_code=422,
        content={"detail": joined_msg, "message": joined_msg},
    )


@app.exception_handler(Exception)
async def global_exception_handler(request: Request, exc: Exception):
    """Global fallback exception handler providing descriptive Gujarati/English error diagnostics."""
    logger.exception("Unhandled server exception at %s %s: %s", request.method, request.url.path, exc)
    return JSONResponse(
        status_code=500,
        content={"detail": f"સર્વર આંતરિક ભૂલ: {str(exc)}"},
    )


@app.get("/", tags=["system"])
async def root():
    """Root redirect / information endpoint."""
    return {
        "project": settings.PROJECT_NAME,
        "version": settings.VERSION,
        "environment": settings.ENVIRONMENT,
        "docs_url": f"{settings.API_V1_STR}/docs",
        "health_url": f"{settings.API_V1_STR}/health"
    }
