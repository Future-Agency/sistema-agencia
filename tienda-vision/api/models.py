from __future__ import annotations

from sqlalchemy import JSON, Float, ForeignKey, Index, Integer, String, Text
from sqlalchemy.orm import Mapped, mapped_column

from .db import Base


class Event(Base):
    """Evento del motor de visión: cruce de línea, entrada/salida de zona, fin de track, ocupación."""

    __tablename__ = "events"
    id: Mapped[int] = mapped_column(Integer, primary_key=True, autoincrement=True)
    camera_id: Mapped[str] = mapped_column(String(64), index=True)
    ts: Mapped[float] = mapped_column(Float, index=True)  # epoch segundos
    type: Mapped[str] = mapped_column(String(32), index=True)
    track_id: Mapped[int | None] = mapped_column(Integer, nullable=True)
    zone_id: Mapped[str | None] = mapped_column(String(64), nullable=True)
    line_id: Mapped[str | None] = mapped_column(String(64), nullable=True)
    data: Mapped[dict] = mapped_column(JSON, default=dict)

    __table_args__ = (Index("ix_events_cam_type_ts", "camera_id", "type", "ts"),)


class Heatmap(Base):
    __tablename__ = "heatmaps"
    id: Mapped[int] = mapped_column(Integer, primary_key=True, autoincrement=True)
    camera_id: Mapped[str] = mapped_column(String(64), index=True)
    ts: Mapped[float] = mapped_column(Float, index=True)
    window_s: Mapped[float] = mapped_column(Float)
    rows: Mapped[int] = mapped_column(Integer)
    cols: Mapped[int] = mapped_column(Integer)
    grid: Mapped[list] = mapped_column(JSON)


class Transaction(Base):
    """Transacción del POS normalizada. `type`: sale | void | refund | no_sale | discount | cancel."""

    __tablename__ = "transactions"
    id: Mapped[int] = mapped_column(Integer, primary_key=True, autoincrement=True)
    pos_tx_id: Mapped[str] = mapped_column(String(128), unique=True)
    ts: Mapped[float] = mapped_column(Float, index=True)
    terminal: Mapped[str | None] = mapped_column(String(64), index=True, nullable=True)
    cashier: Mapped[str | None] = mapped_column(String(128), index=True, nullable=True)
    type: Mapped[str] = mapped_column(String(32), index=True)
    total: Mapped[float] = mapped_column(Float, default=0.0)
    items_count: Mapped[int] = mapped_column(Integer, default=0)
    discount_pct: Mapped[float] = mapped_column(Float, default=0.0)
    ref_tx_id: Mapped[str | None] = mapped_column(String(128), nullable=True)  # ticket original en anulaciones/devoluciones
    lines: Mapped[list] = mapped_column(JSON, default=list)
    raw: Mapped[dict] = mapped_column(JSON, default=dict)


class Alert(Base):
    """Alerta para revisar. `source`: vision | pos. `status`: open | reviewed | dismissed | confirmed."""

    __tablename__ = "alerts"
    id: Mapped[int] = mapped_column(Integer, primary_key=True, autoincrement=True)
    ts: Mapped[float] = mapped_column(Float, index=True)
    source: Mapped[str] = mapped_column(String(16), index=True)
    alert_type: Mapped[str] = mapped_column(String(48), index=True)
    severity: Mapped[str] = mapped_column(String(16), default="media")
    camera_id: Mapped[str | None] = mapped_column(String(64), nullable=True, index=True)
    track_id: Mapped[int | None] = mapped_column(Integer, nullable=True)
    zone_id: Mapped[str | None] = mapped_column(String(64), nullable=True)
    transaction_id: Mapped[int | None] = mapped_column(ForeignKey("transactions.id"), nullable=True)
    cashier: Mapped[str | None] = mapped_column(String(128), nullable=True, index=True)
    description: Mapped[str] = mapped_column(Text, default="")
    clip_path: Mapped[str | None] = mapped_column(String(512), nullable=True)
    review: Mapped[dict | None] = mapped_column(JSON, nullable=True)
    status: Mapped[str] = mapped_column(String(16), default="open", index=True)
    note: Mapped[str | None] = mapped_column(Text, nullable=True)
    data: Mapped[dict] = mapped_column(JSON, default=dict)

    __table_args__ = (Index("ix_alerts_type_tx", "alert_type", "transaction_id"),)
