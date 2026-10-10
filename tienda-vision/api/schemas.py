from __future__ import annotations

from datetime import datetime
from typing import Any, Literal
from zoneinfo import ZoneInfo

from pydantic import BaseModel, ConfigDict, Field

from .settings import get_settings


def ts_to_iso(ts: float | None) -> str | None:
    """Epoch -> ISO en la zona horaria del negocio (store.timezone del config)."""
    if ts is None:
        return None
    return datetime.fromtimestamp(ts, ZoneInfo(get_settings().timezone)).isoformat()


class EventIn(BaseModel):
    model_config = ConfigDict(extra="allow")
    type: str
    camera_id: str
    ts: float


class EventsBatchIn(BaseModel):
    events: list[EventIn]


class EventOut(BaseModel):
    id: int
    camera_id: str
    ts: float
    ts_iso: str | None = None
    type: str
    track_id: int | None
    zone_id: str | None
    line_id: str | None
    data: dict


class TransactionIn(BaseModel):
    pos_tx_id: str
    ts: datetime
    terminal: str | None = None
    cashier: str | None = None
    type: Literal["sale", "void", "refund", "no_sale", "discount", "cancel"] = "sale"
    total: float = 0.0
    items_count: int = 0
    discount_pct: float = 0.0
    ref_tx_id: str | None = None
    lines: list[dict[str, Any]] = Field(default_factory=list)
    raw: dict[str, Any] = Field(default_factory=dict)


class TransactionOut(BaseModel):
    id: int
    pos_tx_id: str
    ts: float
    ts_iso: str | None = None
    terminal: str | None
    cashier: str | None
    type: str
    total: float
    items_count: int
    discount_pct: float
    ref_tx_id: str | None


class AlertOut(BaseModel):
    id: int
    ts: float
    ts_iso: str | None = None
    source: str
    alert_type: str
    severity: str
    camera_id: str | None
    track_id: int | None
    zone_id: str | None
    transaction_id: int | None
    cashier: str | None
    description: str
    clip_path: str | None
    review: dict | None
    status: str
    note: str | None
    data: dict


class AlertPatch(BaseModel):
    status: Literal["open", "reviewed", "dismissed", "confirmed"] | None = None
    note: str | None = None


class AnalyzeRequest(BaseModel):
    from_ts: datetime | None = Field(default=None, alias="from")
    to_ts: datetime | None = Field(default=None, alias="to")
    model_config = ConfigDict(populate_by_name=True)
