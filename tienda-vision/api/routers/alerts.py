from __future__ import annotations

import os
from datetime import datetime

from fastapi import APIRouter, Depends, HTTPException, Query
from fastapi.responses import FileResponse
from sqlalchemy import select
from sqlalchemy.orm import Session

from ..clips import extract_clip
from ..db import get_db
from ..models import Alert, Transaction
from ..schemas import AlertOut, AlertPatch, ts_to_iso
from ..settings import Settings, get_settings

router = APIRouter(prefix="/alerts", tags=["alertas"])


def alert_out(a: Alert) -> AlertOut:
    return AlertOut(id=a.id, ts=a.ts, ts_iso=ts_to_iso(a.ts), source=a.source, alert_type=a.alert_type,
                    severity=a.severity, camera_id=a.camera_id, track_id=a.track_id, zone_id=a.zone_id,
                    transaction_id=a.transaction_id, cashier=a.cashier, description=a.description,
                    clip_path=a.clip_path, review=a.review, status=a.status, note=a.note, data=a.data or {})


def _get(db: Session, alert_id: int) -> Alert:
    a = db.get(Alert, alert_id)
    if not a:
        raise HTTPException(404, "alerta no encontrada")
    return a


@router.get("", response_model=list[AlertOut])
def list_alerts(
    status: str | None = None,
    source: str | None = None,
    alert_type: str | None = None,
    camera_id: str | None = None,
    cashier: str | None = None,
    from_: datetime | None = Query(default=None, alias="from"),
    to: datetime | None = None,
    limit: int = Query(default=100, le=2000),
    db: Session = Depends(get_db),
) -> list[AlertOut]:
    q = select(Alert).order_by(Alert.ts.desc()).limit(limit)
    for col, val in ((Alert.status, status), (Alert.source, source), (Alert.alert_type, alert_type),
                     (Alert.camera_id, camera_id), (Alert.cashier, cashier)):
        if val:
            q = q.where(col == val)
    if from_:
        q = q.where(Alert.ts >= from_.timestamp())
    if to:
        q = q.where(Alert.ts <= to.timestamp())
    return [alert_out(a) for a in db.scalars(q).all()]


@router.get("/{alert_id}", response_model=AlertOut)
def get_alert(alert_id: int, db: Session = Depends(get_db)) -> AlertOut:
    return alert_out(_get(db, alert_id))


@router.patch("/{alert_id}", response_model=AlertOut)
def patch_alert(alert_id: int, body: AlertPatch, db: Session = Depends(get_db)) -> AlertOut:
    a = _get(db, alert_id)
    if body.status:
        a.status = body.status
    if body.note is not None:
        a.note = body.note
    db.commit()
    return alert_out(a)


@router.post("/{alert_id}/clip", response_model=AlertOut)
def make_clip(alert_id: int, before_s: float = 10, after_s: float = 20, db: Session = Depends(get_db),
              settings: Settings = Depends(get_settings)) -> AlertOut:
    """Recorta el clip desde las grabaciones continuas (para alertas del POS, que no traen clip)."""
    a = _get(db, alert_id)
    if a.clip_path and os.path.exists(a.clip_path):
        return alert_out(a)
    if not a.camera_id:
        raise HTTPException(400, "la alerta no tiene cámara asociada (revisá pos.terminal_camera en el config)")
    path = extract_clip(a.camera_id, a.ts, settings.recordings_dir, settings.clips_dir, before_s, after_s,
                        tag=a.alert_type)
    if not path:
        raise HTTPException(404, f"no hay grabación de '{a.camera_id}' para ese momento en {settings.recordings_dir}")
    a.clip_path = path
    db.commit()
    return alert_out(a)


@router.get("/{alert_id}/clip.mp4")
def download_clip(alert_id: int, db: Session = Depends(get_db)):
    a = _get(db, alert_id)
    if not a.clip_path or not os.path.exists(a.clip_path):
        raise HTTPException(404, "esta alerta no tiene clip; pedilo con POST /alerts/{id}/clip")
    return FileResponse(a.clip_path, media_type="video/mp4")


@router.post("/{alert_id}/review", response_model=AlertOut)
def review_alert(alert_id: int, force: bool = False, db: Session = Depends(get_db)) -> AlertOut:
    """Manda los frames del clip a Claude y guarda el veredicto en `review`."""
    from ..review import review_clip

    a = _get(db, alert_id)
    if a.review and not force:
        return alert_out(a)
    if not a.clip_path or not os.path.exists(a.clip_path):
        raise HTTPException(400, "la alerta no tiene clip; pedilo primero con POST /alerts/{id}/clip")
    context = f"Tipo de alerta: {a.alert_type}. {a.description}."
    if a.transaction_id:
        t = db.get(Transaction, a.transaction_id)
        if t:
            context += (f" Transacción {t.pos_tx_id}: {t.type}, ${t.total:.2f}, {t.items_count} ítems, "
                        f"cajero {t.cashier}, terminal {t.terminal}.")
    try:
        result = review_clip(a.clip_path, context)
    except RuntimeError as e:
        raise HTTPException(503, str(e))
    a.review = result.model_dump()
    if a.status == "open" and not result.sospechoso and result.confianza >= 0.8:
        a.status = "reviewed"
    db.commit()
    return alert_out(a)
