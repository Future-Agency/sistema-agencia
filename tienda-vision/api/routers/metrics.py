"""Métricas de patrones de compra: tráfico, permanencia, ocupación, mapa de calor, conversión."""
from __future__ import annotations

from collections import defaultdict
from datetime import datetime
from statistics import median
from zoneinfo import ZoneInfo

from fastapi import APIRouter, Depends, Query
from sqlalchemy import select
from sqlalchemy.orm import Session

from ..db import get_db
from ..models import Alert, Event, Heatmap, Transaction
from ..settings import Settings, get_settings

router = APIRouter(prefix="/metrics", tags=["métricas"])


def _bucket(ts: float, bucket: str, tz: str) -> str:
    d = datetime.fromtimestamp(ts, ZoneInfo(tz))
    if bucket == "day":
        return d.strftime("%Y-%m-%d")
    if bucket == "weekday_hour":
        return f"{d.strftime('%a')} {d.hour:02d}"
    return d.strftime("%Y-%m-%d %H:00")


def _range(q, col, from_, to):
    if from_:
        q = q.where(col >= from_.timestamp())
    if to:
        q = q.where(col <= to.timestamp())
    return q


@router.get("/traffic")
def traffic(camera_id: str | None = None, line_id: str | None = None,
            from_: datetime | None = Query(default=None, alias="from"), to: datetime | None = None,
            bucket: str = Query(default="hour", pattern="^(hour|day|weekday_hour)$"),
            db: Session = Depends(get_db), settings: Settings = Depends(get_settings)) -> list[dict]:
    """Entradas y salidas por franja (cruces de línea)."""
    q = _range(select(Event).where(Event.type == "line_cross"), Event.ts, from_, to)
    if camera_id:
        q = q.where(Event.camera_id == camera_id)
    if line_id:
        q = q.where(Event.line_id == line_id)
    agg: dict[str, dict] = defaultdict(lambda: {"in": 0, "out": 0})
    for e in db.scalars(q).all():
        agg[_bucket(e.ts, bucket, settings.timezone)][(e.data or {}).get("direction", "in")] += 1
    return [{"bucket": k, **v} for k, v in sorted(agg.items())]


@router.get("/dwell")
def dwell(camera_id: str | None = None, zone_id: str | None = None,
          from_: datetime | None = Query(default=None, alias="from"), to: datetime | None = None,
          bucket: str = Query(default="day", pattern="^(hour|day|weekday_hour)$"),
          db: Session = Depends(get_db), settings: Settings = Depends(get_settings)) -> list[dict]:
    """Tiempo de permanencia por zona: visitas, promedio y mediana en segundos."""
    q = _range(select(Event).where(Event.type == "zone_exit"), Event.ts, from_, to)
    if camera_id:
        q = q.where(Event.camera_id == camera_id)
    if zone_id:
        q = q.where(Event.zone_id == zone_id)
    agg: dict[tuple, list[float]] = defaultdict(list)
    for e in db.scalars(q).all():
        agg[(e.camera_id, e.zone_id, _bucket(e.ts, bucket, settings.timezone))].append(float((e.data or {}).get("dwell_s", 0)))
    return [{"camera_id": c, "zone_id": z, "bucket": b, "visits": len(v), "avg_s": round(sum(v) / len(v), 1),
             "median_s": round(median(v), 1), "max_s": round(max(v), 1)}
            for (c, z, b), v in sorted(agg.items())]


@router.get("/occupancy")
def occupancy(camera_id: str | None = None,
              from_: datetime | None = Query(default=None, alias="from"), to: datetime | None = None,
              bucket: str = Query(default="hour", pattern="^(hour|day|weekday_hour)$"),
              db: Session = Depends(get_db), settings: Settings = Depends(get_settings)) -> list[dict]:
    """Ocupación promedio y máxima por zona (para colas y zonas calientes)."""
    q = _range(select(Event).where(Event.type == "occupancy"), Event.ts, from_, to)
    if camera_id:
        q = q.where(Event.camera_id == camera_id)
    agg: dict[tuple, list[int]] = defaultdict(list)
    for e in db.scalars(q).all():
        b = _bucket(e.ts, bucket, settings.timezone)
        for z, n in ((e.data or {}).get("zones") or {}).items():
            agg[(e.camera_id, z, b)].append(int(n))
        agg[(e.camera_id, "__total__", b)].append(int((e.data or {}).get("people", 0)))
    return [{"camera_id": c, "zone_id": z, "bucket": b, "avg": round(sum(v) / len(v), 2), "max": max(v),
             "samples": len(v)} for (c, z, b), v in sorted(agg.items())]


@router.get("/heatmap")
def heatmap(camera_id: str, from_: datetime | None = Query(default=None, alias="from"), to: datetime | None = None,
            db: Session = Depends(get_db)) -> dict:
    """Mapa de calor acumulado (grilla normalizada 0..1) para dibujar sobre la imagen de la cámara."""
    q = _range(select(Heatmap).where(Heatmap.camera_id == camera_id), Heatmap.ts, from_, to)
    rows = db.scalars(q).all()
    if not rows:
        return {"camera_id": camera_id, "rows": 0, "cols": 0, "grid": [], "windows": 0}
    r, c = rows[0].rows, rows[0].cols
    acc = [[0] * c for _ in range(r)]
    for h in rows:
        if h.rows != r or h.cols != c:
            continue
        for i in range(r):
            for j in range(c):
                acc[i][j] += h.grid[i][j]
    mx = max(max(row) for row in acc) or 1
    return {"camera_id": camera_id, "rows": r, "cols": c, "windows": len(rows),
            "grid": [[round(v / mx, 3) for v in row] for row in acc]}


@router.get("/conversion")
def conversion(from_: datetime | None = Query(default=None, alias="from"), to: datetime | None = None,
               bucket: str = Query(default="hour", pattern="^(hour|day|weekday_hour)$"),
               db: Session = Depends(get_db), settings: Settings = Depends(get_settings)) -> list[dict]:
    """Visitantes (entradas) vs ventas del POS por franja. Esto es lo que dice a qué hora se te escapan."""
    eq = _range(select(Event).where(Event.type == "line_cross"), Event.ts, from_, to)
    if settings.entrance_cameras:
        eq = eq.where(Event.camera_id.in_(settings.entrance_cameras))
    visitors: dict[str, int] = defaultdict(int)
    for e in db.scalars(eq).all():
        if (e.data or {}).get("direction") == "in":
            visitors[_bucket(e.ts, bucket, settings.timezone)] += 1
    tq = _range(select(Transaction).where(Transaction.type == "sale"), Transaction.ts, from_, to)
    sales: dict[str, dict] = defaultdict(lambda: {"n": 0, "total": 0.0})
    for t in db.scalars(tq).all():
        b = _bucket(t.ts, bucket, settings.timezone)
        sales[b]["n"] += 1
        sales[b]["total"] += t.total
    out = []
    for b in sorted(set(visitors) | set(sales)):
        v, s = visitors.get(b, 0), sales[b]
        out.append({"bucket": b, "visitors": v, "sales": s["n"], "sales_total": round(s["total"], 2),
                    "conversion": round(s["n"] / v, 3) if v else None,
                    "ticket_avg": round(s["total"] / s["n"], 2) if s["n"] else None})
    return out


@router.get("/summary")
def summary(from_: datetime | None = Query(default=None, alias="from"), to: datetime | None = None,
            db: Session = Depends(get_db), settings: Settings = Depends(get_settings)) -> dict:
    eq = _range(select(Event).where(Event.type == "line_cross"), Event.ts, from_, to)
    if settings.entrance_cameras:
        eq = eq.where(Event.camera_id.in_(settings.entrance_cameras))
    ins = sum(1 for e in db.scalars(eq).all() if (e.data or {}).get("direction") == "in")
    tq = _range(select(Transaction).where(Transaction.type == "sale"), Transaction.ts, from_, to)
    sales = db.scalars(tq).all()
    aq = _range(select(Alert), Alert.ts, from_, to)
    alerts = db.scalars(aq).all()
    by_type: dict[str, int] = defaultdict(int)
    for a in alerts:
        by_type[a.alert_type] += 1
    return {
        "visitors": ins,
        "sales": len(sales),
        "sales_total": round(sum(t.total for t in sales), 2),
        "conversion": round(len(sales) / ins, 3) if ins else None,
        "alerts_open": sum(1 for a in alerts if a.status == "open"),
        "alerts_by_type": dict(by_type),
    }
