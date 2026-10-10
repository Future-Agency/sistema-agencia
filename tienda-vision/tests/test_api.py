import os
import sys
from pathlib import Path

import pytest

ROOT = Path(__file__).resolve().parents[1]


@pytest.fixture
def client(tmp_path, monkeypatch):
    monkeypatch.setenv("DATABASE_URL", f"sqlite:///{tmp_path}/t.db")
    monkeypatch.setenv("CONFIG_PATH", str(ROOT / "config" / "cameras.yaml"))
    monkeypatch.setenv("RECORDINGS_DIR", str(tmp_path / "rec"))
    monkeypatch.setenv("CLIPS_DIR", str(tmp_path / "clips"))
    for m in [m for m in sys.modules if m == "api" or m.startswith("api.")]:
        del sys.modules[m]
    from fastapi.testclient import TestClient

    from api.main import app

    with TestClient(app) as c:
        yield c


T0 = 1_791_558_000.0  # 2026-10-09 ~15:00 UTC


def test_full_flow(client):
    assert client.get("/health").json()["ok"]

    # 1) eventos del motor de visión
    events = [
        {"type": "line_cross", "camera_id": "entrada", "ts": T0 + 10, "track_id": 1, "line_id": "puerta", "direction": "in"},
        {"type": "line_cross", "camera_id": "entrada", "ts": T0 + 20, "track_id": 2, "line_id": "puerta", "direction": "in"},
        {"type": "line_cross", "camera_id": "entrada", "ts": T0 + 90, "track_id": 1, "line_id": "puerta", "direction": "out"},
        {"type": "zone_enter", "camera_id": "entrada", "ts": T0 + 15, "track_id": 1, "zone_id": "vidriera", "zone_kind": "gondola"},
        {"type": "zone_exit", "camera_id": "entrada", "ts": T0 + 75, "track_id": 1, "zone_id": "vidriera", "zone_kind": "gondola", "dwell_s": 60},
        {"type": "occupancy", "camera_id": "caja1", "ts": T0 + 40, "zones": {"cola": 2, "cliente_caja": 0, "cajero": 1}, "people": 3},
        {"type": "occupancy", "camera_id": "caja1", "ts": T0 + 300, "zones": {"cola": 0, "cliente_caja": 1, "cajero": 1}, "people": 2},
        {"type": "heatmap", "camera_id": "entrada", "ts": T0 + 60, "window_s": 60, "rows": 2, "cols": 2, "grid": [[4, 0], [0, 2]]},
        {"type": "alert", "camera_id": "entrada", "ts": T0 + 70, "alert_type": "merodeo", "severity": "media",
         "track_id": 1, "zone_id": "vidriera", "description": "x", "clip_path": None},
    ]
    r = client.post("/events/batch", json={"events": events})
    assert r.json() == {"events": 7, "alerts": 1, "heatmaps": 1}

    # 2) transacciones del POS
    txs = [
        {"pos_tx_id": "T1", "ts": "2026-10-09T15:00:45", "terminal": "CAJA1", "cashier": "Lucas", "type": "sale", "total": 5000, "items_count": 2},
        {"pos_tx_id": "T2", "ts": "2026-10-09T15:05:00", "terminal": "CAJA1", "cashier": "Lucas", "type": "sale", "total": 800, "items_count": 1},
        {"pos_tx_id": "T3", "ts": "2026-10-09T15:40:00", "terminal": "CAJA1", "cashier": "Lucas", "type": "void", "total": 5000, "ref_tx_id": "T1"},
    ]
    # alineamos la venta T1 con el snapshot sin cliente (ts T0+40 ±45 s)
    from datetime import datetime, timezone
    txs[0]["ts"] = datetime.fromtimestamp(T0 + 45, timezone.utc).isoformat()
    txs[1]["ts"] = datetime.fromtimestamp(T0 + 300, timezone.utc).isoformat()
    txs[2]["ts"] = datetime.fromtimestamp(T0 + 2400, timezone.utc).isoformat()
    assert client.post("/pos/transactions", json=txs).json() == {"created": 3, "updated": 0}
    assert client.post("/pos/transactions", json=txs[:1]).json() == {"created": 0, "updated": 1}

    # 3) análisis de excepciones
    found = client.post("/pos/analyze", json={}).json()
    assert sorted(a["alert_type"] for a in found) == ["anulacion_tardia", "venta_sin_cliente"]
    assert all(a["camera_id"] == "caja1" for a in found)
    assert client.post("/pos/analyze", json={}).json() == []  # sin duplicados

    # 4) alertas
    alerts = client.get("/alerts").json()
    assert len(alerts) == 3
    a = client.patch(f"/alerts/{alerts[0]['id']}", json={"status": "dismissed", "note": "falsa alarma"}).json()
    assert a["status"] == "dismissed"
    assert client.post(f"/alerts/{alerts[0]['id']}/clip").status_code in (400, 404)

    # 5) métricas
    traffic = client.get("/metrics/traffic", params={"bucket": "day"}).json()
    assert traffic[0]["in"] == 2 and traffic[0]["out"] == 1
    dwell = client.get("/metrics/dwell", params={"zone_id": "vidriera"}).json()
    assert dwell[0]["visits"] == 1 and dwell[0]["avg_s"] == 60
    occ = client.get("/metrics/occupancy", params={"camera_id": "caja1", "bucket": "day"}).json()
    cola = next(o for o in occ if o["zone_id"] == "cola")
    assert cola["max"] == 2 and cola["avg"] == 1
    hm = client.get("/metrics/heatmap", params={"camera_id": "entrada"}).json()
    assert hm["grid"] == [[1.0, 0.0], [0.0, 0.5]]
    conv = client.get("/metrics/conversion", params={"bucket": "day"}).json()
    assert conv[0]["visitors"] == 2 and conv[0]["sales"] == 2 and conv[0]["conversion"] == 1.0
    s = client.get("/metrics/summary").json()
    assert s["sales_total"] == 5800 and s["alerts_open"] == 2
    cashiers = client.get("/pos/cashiers").json()
    assert cashiers[0]["cashier"] == "Lucas" and cashiers[0]["void"] == 1 and cashiers[0]["alerts"] == 2


def test_csv_import(client):
    csv_path = ROOT / "samples" / "pos_ventas_ejemplo.csv"
    if not csv_path.exists():
        pytest.skip("generar con samples/make_sample_pos.py")
    with open(csv_path, "rb") as f:
        r = client.post("/pos/import/csv", files={"file": ("pos.csv", f, "text/csv")})
    assert r.status_code == 200 and r.json()["created"] > 100
    found = client.post("/pos/analyze", json={}).json()
    kinds = {a["alert_type"] for a in found}
    assert {"anulacion_tardia", "anulacion_sin_referencia", "devolucion_sin_ticket", "descuento_alto",
            "cajon_sin_venta_frecuente", "ratio_cajero"} <= kinds
    assert all(a["cashier"] == "Lucas" for a in found if a["alert_type"] == "ratio_cajero")
