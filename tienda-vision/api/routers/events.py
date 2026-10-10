from __future__ import annotations

from datetime import datetime

from fastapi import APIRouter, Depends, Query
from sqlalchemy import select
from sqlalchemy.orm import Session

from ..db import get_db
from ..models import Alert, Event, Heatmap
from ..schemas import EventOut, EventsBatchIn, ts_to_iso

router = APIRouter(prefix="/events", tags=["eventos"])

ALERT_KEYS = {"type", "camera_id", "ts", "alert_type", "severity", "track_id", "zone_id", "description", "clip_path"}


@router.post("/batch")
def ingest_batch(batch: EventsBatchIn, db: Session = Depends(get_db)) -> dict:
    """Recibe lotes de eventos del motor de visión. Separa alertas y mapas de calor en sus tablas."""
    n_events = n_alerts = n_heat = 0
    for ev in batch.events:
        d = ev.model_dump()
        if ev.type == "alert":
            db.add(Alert(
                ts=ev.ts, source="vision", alert_type=d.get("alert_type", "desconocida"),
                severity=d.get("severity", "media"), camera_id=ev.camera_id, track_id=d.get("track_id"),
                zone_id=d.get("zone_id"), description=d.get("description", ""), clip_path=d.get("clip_path"),
                data={k: v for k, v in d.items() if k not in ALERT_KEYS},
            ))
            n_alerts += 1
        elif ev.type == "heatmap":
            db.add(Heatmap(camera_id=ev.camera_id, ts=ev.ts, window_s=d.get("window_s", 0),
                           rows=d["rows"], cols=d["cols"], grid=d["grid"]))
            n_heat += 1
        else:
            extra = {k: v for k, v in d.items() if k not in ("type", "camera_id", "ts", "track_id", "zone_id", "line_id")}
            db.add(Event(camera_id=ev.camera_id, ts=ev.ts, type=ev.type, track_id=d.get("track_id"),
                         zone_id=d.get("zone_id"), line_id=d.get("line_id"), data=extra))
            n_events += 1
    db.commit()
    return {"events": n_events, "alerts": n_alerts, "heatmaps": n_heat}


@router.get("", response_model=list[EventOut])
def list_events(
    camera_id: str | None = None,
    type: str | None = None,
    from_: datetime | None = Query(default=None, alias="from"),
    to: datetime | None = None,
    limit: int = Query(default=200, le=5000),
    db: Session = Depends(get_db),
) -> list[EventOut]:
    q = select(Event).order_by(Event.ts.desc()).limit(limit)
    if camera_id:
        q = q.where(Event.camera_id == camera_id)
    if type:
        q = q.where(Event.type == type)
    if from_:
        q = q.where(Event.ts >= from_.timestamp())
    if to:
        q = q.where(Event.ts <= to.timestamp())
    rows = db.scalars(q).all()
    return [EventOut(id=r.id, camera_id=r.camera_id, ts=r.ts, ts_iso=ts_to_iso(r.ts), type=r.type,
                     track_id=r.track_id, zone_id=r.zone_id, line_id=r.line_id, data=r.data or {}) for r in rows]
