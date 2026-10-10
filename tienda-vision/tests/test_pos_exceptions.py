from api.pos.exceptions import Tx, analyze

T0 = 1_800_000_000.0


def sale(i, ts, cashier="Ana", terminal="CAJA1", total=1000.0, discount=0.0):
    return Tx(i, f"T{i}", ts, terminal, cashier, "sale", total, 2, discount)


def types(findings):
    return sorted(f.alert_type for f in findings)


def test_void_rules():
    txs = [sale(1, T0), Tx(2, "T2", T0 + 60, "CAJA1", "Ana", "void", 1000, ref_tx_id="T1"),
           sale(3, T0 + 100), Tx(4, "T4", T0 + 100 + 30 * 60, "CAJA1", "Ana", "void", 1000, ref_tx_id="T3"),
           Tx(5, "T5", T0 + 200, "CAJA1", "Ana", "void", 500, ref_tx_id=None)]
    f = analyze(txs)
    assert types(f) == ["anulacion_sin_referencia", "anulacion_tardia"]
    tardia = next(x for x in f if x.alert_type == "anulacion_tardia")
    assert tardia.transaction_id == 4 and tardia.data["delay_min"] == 30.0


def test_refund_discount_and_no_sale():
    txs = [Tx(1, "T1", T0, "CAJA1", "Ana", "refund", 900, ref_tx_id=None),
           Tx(2, "T2", T0, "CAJA1", "Ana", "refund", 900, ref_tx_id="T0"),
           sale(3, T0, discount=50)]
    txs += [Tx(10 + i, f"N{i}", T0 + i * 600, "CAJA1", "Ana", "no_sale") for i in range(4)]
    f = analyze(txs)
    assert types(f) == ["cajon_sin_venta_frecuente", "descuento_alto", "devolucion_sin_ticket"]


def test_cashier_ratio_vs_peers():
    txs = []
    i = 0
    for cashier in ("Ana", "Mia", "Lucas"):
        for _ in range(30):
            i += 1
            txs.append(sale(i, T0 + i, cashier))
        bad = 10 if cashier == "Lucas" else 1
        for _ in range(bad):
            i += 1
            txs.append(Tx(i, f"T{i}", T0 + i, "CAJA1", cashier, "void", 100, ref_tx_id=f"T{i - 1}"))
    f = [x for x in analyze(txs) if x.alert_type == "ratio_cajero"]
    assert len(f) == 1 and f[0].cashier == "Lucas"


def test_sale_without_customer_in_camera():
    txs = [sale(1, T0 + 100), sale(2, T0 + 500)]
    events = [
        {"type": "occupancy", "camera_id": "caja1", "ts": T0 + 90, "zones": {"cliente_caja": 0, "cola": 0}},
        {"type": "occupancy", "camera_id": "caja1", "ts": T0 + 110, "zones": {"cliente_caja": 0, "cola": 1}},
        {"type": "occupancy", "camera_id": "caja1", "ts": T0 + 495, "zones": {"cliente_caja": 1, "cola": 0}},
    ]
    f = analyze(txs, events, {"CAJA1": "caja1"}, {"caja1": ["cliente_caja"]})
    assert types(f) == ["venta_sin_cliente"]
    assert f[0].transaction_id == 1 and f[0].camera_id == "caja1"


def test_sale_without_customer_skipped_when_no_camera_data():
    txs = [sale(1, T0 + 100)]
    assert analyze(txs, [], {"CAJA1": "caja1"}, {"caja1": ["cliente_caja"]}) == []


def test_customer_without_sale():
    txs = [sale(1, T0 + 1000)]
    events = [
        {"type": "zone_exit", "camera_id": "caja1", "ts": T0 + 200, "zone_id": "cliente_caja", "dwell_s": 90, "track_id": 4},
        {"type": "zone_exit", "camera_id": "caja1", "ts": T0 + 1010, "zone_id": "cliente_caja", "dwell_s": 90, "track_id": 5},
        {"type": "zone_exit", "camera_id": "caja1", "ts": T0 + 300, "zone_id": "cliente_caja", "dwell_s": 10, "track_id": 6},
    ]
    f = analyze(txs, events, {"CAJA1": "caja1"}, {"caja1": ["cliente_caja"]})
    assert types(f) == ["cliente_sin_venta"]
    assert f[0].data["track_id"] == 4
