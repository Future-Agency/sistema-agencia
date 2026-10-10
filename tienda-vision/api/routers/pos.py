from __future__ import annotations

import json
from datetime import datetime
from zoneinfo import ZoneInfo

from fastapi import APIRouter, Depends, File, Form, HTTPException, Query, UploadFile
from sqlalchemy import func, select
from sqlalchemy.orm import Session

from ..db import get_db
from ..models import Alert, Event, Transaction
from ..pos.adapters.csv_adapter import parse_csv
from ..pos.exceptions import Finding, Tx, analyze
from ..schemas import AlertOut, AnalyzeRequest, TransactionIn, TransactionOut, ts_to_iso
from ..settings import Settings, get_settings
from .alerts import alert_out

router = APIRouter(prefix="/pos", tags=["pos"])


def _to_epoch(dt: datetime, tz: str) -> float:
    """El POS suele exportar fechas sin zona horaria: se interpretan en la zona del negocio."""
    if dt.tzinfo is None:
        dt = dt.replace(tzinfo=ZoneInfo(tz))
    return dt.timestamp()


def _upsert(db: Session, txs: list[TransactionIn], tz: str) -> dict:
    created = updated = 0
    for t in txs:
        row = db.scalar(select(Transaction).where(Transaction.pos_tx_id == t.pos_tx_id))
        values = dict(ts=_to_epoch(t.ts, tz), terminal=t.terminal, cashier=t.cashier, type=t.type, total=t.total,
                      items_count=t.items_count, discount_pct=t.discount_pct, ref_tx_id=t.ref_tx_id,
                      lines=t.lines, raw=t.raw)
        if row:
            for k, v in values.items():
                setattr(row, k, v)
            updated += 1
        else:
            db.add(Transaction(pos_tx_id=t.pos_tx_id, **values))
            created += 1
    db.commit()
    return {"created": created, "updated": updated}


@router.post("/transactions")
def add_transactions(txs: list[TransactionIn], db: Session = Depends(get_db),
                     settings: Settings = Depends(get_settings)) -> dict:
    """Carga de transacciones en JSON (para integrar un POS con API o webhook)."""
    return _upsert(db, txs, settings.timezone)


@router.post("/import/csv")
async def import_csv(file: UploadFile = File(...), mapping: str | None = Form(default=None),
                     db: Session = Depends(get_db), settings: Settings = Depends(get_settings)) -> dict:
    """Carga un CSV exportado del POS. `mapping` es un JSON opcional {campo: columna}."""
    try:
        m = json.loads(mapping) if mapping else None
        txs = parse_csv(await file.read(), m)
    except (ValueError, KeyError) as e:
        raise HTTPException(400, f"CSV inválido: {e}")
    return _upsert(db, txs, settings.timezone)


@router.get("/transactions", response_model=list[TransactionOut])
def list_transactions(
    cashier: str | None = None,
    terminal: str | None = None,
    type: str | None = None,
    from_: datetime | None = Query(default=None, alias="from"),
    to: datetime | None = None,
    limit: int = Query(default=200, le=5000),
    db: Session = Depends(get_db),
) -> list[TransactionOut]:
    q = select(Transaction).order_by(Transaction.ts.desc()).limit(limit)
    if cashier:
        q = q.where(Transaction.cashier == cashier)
    if terminal:
        q = q.where(Transaction.terminal == terminal)
    if type:
        q = q.where(Transaction.type == type)
    if from_:
        q = q.where(Transaction.ts >= from_.timestamp())
    if to:
        q = q.where(Transaction.ts <= to.timestamp())
    return [TransactionOut(id=r.id, pos_tx_id=r.pos_tx_id, ts=r.ts, ts_iso=ts_to_iso(r.ts), terminal=r.terminal,
                           cashier=r.cashier, type=r.type, total=r.total, items_count=r.items_count,
                           discount_pct=r.discount_pct, ref_tx_id=r.ref_tx_id) for r in db.scalars(q).all()]


def _customer_zones(settings: Settings) -> dict[str, list[str]]:
    out: dict[str, list[str]] = {}
    for cam in settings.cfg.get("cameras", []):
        zs = [z["id"] for z in cam.get("zones", []) if z.get("kind") == "caja_cliente"]
        if zs:
            out[cam["id"]] = zs
    return out


@router.post("/analyze", response_model=list[AlertOut])
def analyze_pos(req: AnalyzeRequest | None = None, db: Session = Depends(get_db),
                settings: Settings = Depends(get_settings)) -> list[AlertOut]:
    """Corre el motor de excepciones sobre un rango y crea alertas nuevas (sin duplicar)."""
    req = req or AnalyzeRequest()
    q = select(Transaction)
    eq = select(Event).where(Event.type.in_(["occupancy", "zone_exit"]))
    if req.from_ts:
        q = q.where(Transaction.ts >= req.from_ts.timestamp())
        eq = eq.where(Event.ts >= req.from_ts.timestamp() - 120)
    if req.to_ts:
        q = q.where(Transaction.ts <= req.to_ts.timestamp())
        eq = eq.where(Event.ts <= req.to_ts.timestamp() + 120)

    txs = [Tx(id=r.id, pos_tx_id=r.pos_tx_id, ts=r.ts, terminal=r.terminal, cashier=r.cashier, type=r.type,
              total=r.total, items_count=r.items_count, discount_pct=r.discount_pct, ref_tx_id=r.ref_tx_id)
           for r in db.scalars(q).all()]
    events = [{"type": e.type, "camera_id": e.camera_id, "ts": e.ts, "zone_id": e.zone_id, "track_id": e.track_id,
               **(e.data or {})} for e in db.scalars(eq).all()]

    findings = analyze(txs, events, settings.terminal_camera, _customer_zones(settings), settings.pos_rules)

    existing = {(a.alert_type, a.transaction_id, a.cashier, int(a.ts))
                for a in db.scalars(select(Alert).where(Alert.source == "pos")).all()}
    created: list[Alert] = []
    for f in findings:
        if f.key() in existing:
            continue
        cam = f.camera_id or (settings.terminal_camera.get(f.terminal) if f.terminal else None)
        a = Alert(ts=f.ts, source="pos", alert_type=f.alert_type, severity=f.severity, camera_id=cam,
                  transaction_id=f.transaction_id, cashier=f.cashier, description=f.description,
                  data={**f.data, "terminal": f.terminal})
        db.add(a)
        created.append(a)
    db.commit()
    return [alert_out(a) for a in created]


@router.get("/cashiers")
def cashier_stats(from_: datetime | None = Query(default=None, alias="from"), to: datetime | None = None,
                  db: Session = Depends(get_db)) -> list[dict]:
    """Resumen por cajero: ventas, anulaciones, devoluciones, cajón sin venta, descuento promedio y alertas."""
    q = select(Transaction.cashier, Transaction.type, func.count(), func.sum(Transaction.total),
               func.avg(Transaction.discount_pct)).group_by(Transaction.cashier, Transaction.type)
    if from_:
        q = q.where(Transaction.ts >= from_.timestamp())
    if to:
        q = q.where(Transaction.ts <= to.timestamp())
    stats: dict[str, dict] = {}
    for cashier, type_, n, total, disc in db.execute(q).all():
        s = stats.setdefault(cashier or "(sin cajero)", {"cashier": cashier, "sale": 0, "void": 0, "refund": 0,
                                                          "no_sale": 0, "cancel": 0, "discount": 0,
                                                          "sales_total": 0.0, "avg_discount_pct": 0.0, "alerts": 0})
        s[type_] = n
        if type_ == "sale":
            s["sales_total"] = round(total or 0.0, 2)
            s["avg_discount_pct"] = round(disc or 0.0, 2)
    aq = select(Alert.cashier, func.count()).where(Alert.source == "pos").group_by(Alert.cashier)
    for cashier, n in db.execute(aq).all():
        if cashier in stats:
            stats[cashier]["alerts"] = n
    for s in stats.values():
        s["bad_ratio"] = round((s["void"] + s["refund"] + s["cancel"]) / s["sale"], 3) if s["sale"] else None
    return sorted(stats.values(), key=lambda s: -(s["bad_ratio"] or 0))
