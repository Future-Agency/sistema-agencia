"""API de tienda-vision.

  uvicorn api.main:app --reload --port 8000
  docs interactivas: http://localhost:8000/docs
"""
from __future__ import annotations

from contextlib import asynccontextmanager

from fastapi import FastAPI

from .db import init_db
from .routers import alerts, events, metrics, pos
from .settings import get_settings


@asynccontextmanager
async def lifespan(app: FastAPI):
    init_db()
    yield


app = FastAPI(title="tienda-vision", version="0.1.0", lifespan=lifespan,
              description="Eventos de cámaras, transacciones del POS, alertas de pérdida y métricas de compra.")
app.include_router(events.router)
app.include_router(pos.router)
app.include_router(alerts.router)
app.include_router(metrics.router)


@app.get("/health")
def health() -> dict:
    s = get_settings()
    return {"ok": True, "db": s.database_url.split("://")[0], "cameras": [c["id"] for c in s.cfg.get("cameras", [])]}
