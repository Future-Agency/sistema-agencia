"""Motor de excepciones del POS para detectar robo interno.

Python puro: recibe transacciones y eventos de visión como dataclasses/dicts y
devuelve hallazgos. No toca la base, así se testea sin nada levantado.

Reglas:
  anulacion_tardia          anulación mucho después de la venta original
  anulacion_sin_referencia  anulación que no apunta a ningún ticket
  devolucion_sin_ticket     devolución sin ticket original
  descuento_alto            descuento por encima del máximo
  cajon_sin_venta_frecuente demasiadas aperturas de cajón sin venta por cajero y día
  ratio_cajero              cajero con ratio de anulaciones/devoluciones muy por encima de sus pares
  venta_sin_cliente         venta registrada cuando la cámara no veía a nadie del lado del cliente
  cliente_sin_venta         cliente estuvo en caja un buen rato y no se registró ninguna venta
"""
from __future__ import annotations

from collections import defaultdict
from dataclasses import dataclass, field
from datetime import datetime
from statistics import median


DEFAULT_RULES: dict = {
    "void_delay_min": 5,
    "discount_pct_max": 20,
    "no_sale_max_per_day": 3,
    "ratio_multiplier": 2.0,
    "ratio_min_sales": 20,
    "ratio_min_value": 0.05,
    "sale_no_customer_window_s": 45,
    "customer_no_sale_min_dwell_s": 60,
    "customer_no_sale_window_s": 30,
}


@dataclass
class Tx:
    id: int
    pos_tx_id: str
    ts: float
    terminal: str | None
    cashier: str | None
    type: str
    total: float = 0.0
    items_count: int = 0
    discount_pct: float = 0.0
    ref_tx_id: str | None = None


@dataclass
class Finding:
    alert_type: str
    severity: str
    ts: float
    description: str
    transaction_id: int | None = None
    cashier: str | None = None
    terminal: str | None = None
    camera_id: str | None = None
    data: dict = field(default_factory=dict)

    def key(self) -> tuple:
        return (self.alert_type, self.transaction_id, self.cashier, int(self.ts))


def _day(ts: float) -> str:
    return datetime.fromtimestamp(ts).strftime("%Y-%m-%d")


def analyze(
    txs: list[Tx],
    events: list[dict] | None = None,
    terminal_camera: dict[str, str] | None = None,
    customer_zones: dict[str, list[str]] | None = None,
    rules: dict | None = None,
) -> list[Finding]:
    r = {**DEFAULT_RULES, **(rules or {})}
    events = events or []
    terminal_camera = terminal_camera or {}
    customer_zones = customer_zones or {}
    findings: list[Finding] = []
    by_pos_id = {t.pos_tx_id: t for t in txs}

    # --- reglas sobre transacciones sueltas ---
    for t in txs:
        if t.type == "void":
            ref = by_pos_id.get(t.ref_tx_id or "")
            if ref is None:
                findings.append(Finding("anulacion_sin_referencia", "media", t.ts,
                                        f"Anulación {t.pos_tx_id} sin ticket de referencia (${t.total:.2f})",
                                        t.id, t.cashier, t.terminal))
            else:
                delay_min = (t.ts - ref.ts) / 60
                if delay_min > r["void_delay_min"]:
                    findings.append(Finding("anulacion_tardia", "media", t.ts,
                                            f"Anulación {t.pos_tx_id} {delay_min:.0f} min después de la venta "
                                            f"{ref.pos_tx_id} (${t.total:.2f})",
                                            t.id, t.cashier, t.terminal, data={"delay_min": round(delay_min, 1)}))
        elif t.type == "refund" and not t.ref_tx_id:
            findings.append(Finding("devolucion_sin_ticket", "alta", t.ts,
                                    f"Devolución {t.pos_tx_id} sin ticket original (${t.total:.2f})",
                                    t.id, t.cashier, t.terminal))
        if t.type in ("sale", "discount") and t.discount_pct > r["discount_pct_max"]:
            findings.append(Finding("descuento_alto", "media", t.ts,
                                    f"Descuento de {t.discount_pct:.0f}% en {t.pos_tx_id} (máx {r['discount_pct_max']}%)",
                                    t.id, t.cashier, t.terminal, data={"discount_pct": t.discount_pct}))

    # --- cajón sin venta por cajero y día ---
    no_sales: dict[tuple, list[Tx]] = defaultdict(list)
    for t in txs:
        if t.type == "no_sale":
            no_sales[(t.cashier, _day(t.ts))].append(t)
    for (cashier, day), lst in no_sales.items():
        if len(lst) > r["no_sale_max_per_day"]:
            last = max(lst, key=lambda x: x.ts)
            findings.append(Finding("cajon_sin_venta_frecuente", "media", last.ts,
                                    f"{cashier}: {len(lst)} aperturas de cajón sin venta el {day} "
                                    f"(máx {r['no_sale_max_per_day']})",
                                    last.id, cashier, last.terminal, data={"count": len(lst), "day": day}))

    # --- ratio por cajero vs pares ---
    sales: dict = defaultdict(int)
    bad: dict = defaultdict(int)
    for t in txs:
        if not t.cashier:
            continue
        if t.type == "sale":
            sales[t.cashier] += 1
        elif t.type in ("void", "refund", "cancel"):
            bad[t.cashier] += 1
    ratios = {c: bad[c] / sales[c] for c in sales if sales[c] >= r["ratio_min_sales"]}
    if len(ratios) >= 2:
        for c, ratio in ratios.items():
            peers = [v for k, v in ratios.items() if k != c]
            base = median(peers)
            if ratio >= r["ratio_min_value"] and ratio > r["ratio_multiplier"] * max(base, 0.01):
                last = max((t for t in txs if t.cashier == c), key=lambda x: x.ts)
                findings.append(Finding("ratio_cajero", "alta", last.ts,
                                        f"{c}: {bad[c]} anulaciones/devoluciones sobre {sales[c]} ventas "
                                        f"({ratio:.0%}), pares {base:.0%}",
                                        None, c, last.terminal,
                                        data={"ratio": round(ratio, 3), "peers_median": round(base, 3),
                                              "sales": sales[c], "bad": bad[c]}))

    # --- cruce con visión ---
    occ_by_cam: dict[str, list[dict]] = defaultdict(list)
    exits_by_cam: dict[str, list[dict]] = defaultdict(list)
    for ev in events:
        if ev.get("type") == "occupancy":
            occ_by_cam[ev["camera_id"]].append(ev)
        elif ev.get("type") == "zone_exit":
            exits_by_cam[ev["camera_id"]].append(ev)
    for lst in occ_by_cam.values():
        lst.sort(key=lambda e: e["ts"])

    def customers_at(cam: str, ts: float, window: float) -> int | None:
        zones = customer_zones.get(cam, [])
        snaps = [e for e in occ_by_cam.get(cam, []) if abs(e["ts"] - ts) <= window]
        if not snaps or not zones:
            return None
        return max(sum(int((e.get("zones") or {}).get(z, 0)) for z in zones) for e in snaps)

    w = r["sale_no_customer_window_s"]
    for t in txs:
        if t.type != "sale" or not t.terminal:
            continue
        cam = terminal_camera.get(t.terminal)
        if not cam:
            continue
        n = customers_at(cam, t.ts, w)
        if n == 0:
            findings.append(Finding("venta_sin_cliente", "alta", t.ts,
                                    f"Venta {t.pos_tx_id} (${t.total:.2f}) sin cliente visible en '{cam}' "
                                    f"±{int(w)} s",
                                    t.id, t.cashier, t.terminal, camera_id=cam))

    cam_terminal = {v: k for k, v in terminal_camera.items()}
    sales_by_terminal: dict[str, list[Tx]] = defaultdict(list)
    for t in txs:
        if t.type == "sale" and t.terminal:
            sales_by_terminal[t.terminal].append(t)
    min_dwell = r["customer_no_sale_min_dwell_s"]
    w2 = r["customer_no_sale_window_s"]
    for cam, exits in exits_by_cam.items():
        term = cam_terminal.get(cam)
        zones = set(customer_zones.get(cam, []))
        if not term:
            continue
        for ev in exits:
            dwell = float(ev.get("dwell_s") or (ev.get("data") or {}).get("dwell_s") or 0)
            if ev.get("zone_id") not in zones or dwell < min_dwell:
                continue
            enter_ts = ev["ts"] - dwell
            had_sale = any(enter_ts - w2 <= s.ts <= ev["ts"] + w2 for s in sales_by_terminal.get(term, []))
            if not had_sale:
                findings.append(Finding("cliente_sin_venta", "media", ev["ts"],
                                        f"Cliente estuvo {int(dwell)} s en caja '{cam}' y no se registró venta",
                                        None, None, term, camera_id=cam,
                                        data={"track_id": ev.get("track_id"), "dwell_s": dwell}))

    findings.sort(key=lambda f: f.ts)
    return findings
