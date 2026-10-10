"""Importa transacciones desde un CSV exportado del POS.

Cada POS exporta distinto, así que el mapeo de columnas es configurable.
El mapeo "generico" espera este encabezado:

  id,fecha,terminal,cajero,tipo,total,items,descuento_pct,ref

Para otro POS, pasá un mapeo propio {campo_normalizado: nombre_columna}.
"""
from __future__ import annotations

import csv
import io
from datetime import datetime

from ...schemas import TransactionIn

GENERIC_MAPPING = {
    "pos_tx_id": "id",
    "ts": "fecha",
    "terminal": "terminal",
    "cashier": "cajero",
    "type": "tipo",
    "total": "total",
    "items_count": "items",
    "discount_pct": "descuento_pct",
    "ref_tx_id": "ref",
}

TYPE_ALIASES = {
    "venta": "sale", "sale": "sale", "ticket": "sale", "factura": "sale",
    "anulacion": "void", "anulación": "void", "void": "void", "nota de credito": "void",
    "devolucion": "refund", "devolución": "refund", "refund": "refund",
    "sin venta": "no_sale", "apertura": "no_sale", "apertura cajon": "no_sale", "no_sale": "no_sale",
    "descuento": "discount", "discount": "discount",
    "cancelacion": "cancel", "cancelación": "cancel", "cancel": "cancel",
}

DATE_FORMATS = ["%Y-%m-%d %H:%M:%S", "%Y-%m-%dT%H:%M:%S", "%d/%m/%Y %H:%M:%S", "%d/%m/%Y %H:%M", "%Y-%m-%d %H:%M"]


def parse_date(s: str) -> datetime:
    s = s.strip()
    try:
        return datetime.fromisoformat(s)
    except ValueError:
        pass
    for fmt in DATE_FORMATS:
        try:
            return datetime.strptime(s, fmt)
        except ValueError:
            continue
    raise ValueError(f"fecha no reconocida: {s!r}")


def normalize_type(s: str) -> str:
    key = (s or "").strip().lower()
    return TYPE_ALIASES.get(key, key or "sale")


def _num(s: str | None) -> float:
    """Acepta 1234.56, 1.234,56 (formato local) y 1,234.56."""
    s = str(s or "").strip().replace("$", "").replace(" ", "")
    if not s:
        return 0.0
    if "," in s and "." in s:
        s = s.replace(".", "").replace(",", ".") if s.rfind(",") > s.rfind(".") else s.replace(",", "")
    elif "," in s:
        s = s.replace(",", ".")
    return float(s)


def parse_csv(content: str | bytes, mapping: dict | None = None) -> list[TransactionIn]:
    if isinstance(content, bytes):
        content = content.decode("utf-8-sig")
    m = {**GENERIC_MAPPING, **(mapping or {})}
    reader = csv.DictReader(io.StringIO(content))
    out: list[TransactionIn] = []
    for row in reader:
        get = lambda k: (row.get(m[k]) or "").strip() if m.get(k) else ""  # noqa: E731
        out.append(TransactionIn(
            pos_tx_id=get("pos_tx_id"),
            ts=parse_date(get("ts")),
            terminal=get("terminal") or None,
            cashier=get("cashier") or None,
            type=normalize_type(get("type")),
            total=_num(get("total")),
            items_count=int(float(get("items_count") or 0)),
            discount_pct=_num(get("discount_pct")),
            ref_tx_id=get("ref_tx_id") or None,
            raw=dict(row),
        ))
    return out
