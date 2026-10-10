from api.pos.adapters.csv_adapter import _num, normalize_type, parse_csv

CSV = """id,fecha,terminal,cajero,tipo,total,items,descuento_pct,ref
T1,2026-10-09 10:15:00,CAJA1,Ana,Venta,"1.250,50",3,0,
T2,09/10/2026 10:20,CAJA1,Ana,Anulación,1250.50,3,0,T1
T3,2026-10-09T11:00:00,CAJA2,Mia,sin venta,,0,,
"""


def test_parse_generic():
    txs = parse_csv(CSV)
    assert [t.type for t in txs] == ["sale", "void", "no_sale"]
    assert txs[0].total == 1250.5 and txs[1].total == 1250.5
    assert txs[1].ref_tx_id == "T1" and txs[1].ts.hour == 10 and txs[1].ts.minute == 20
    assert txs[2].terminal == "CAJA2" and txs[2].raw["cajero"] == "Mia"


def test_custom_mapping():
    content = "nro;hora;caja;empleado;clase\n7;2026-01-01 09:00:00;P1;Lu;devolucion\n".replace(";", ",")
    txs = parse_csv(content, {"pos_tx_id": "nro", "ts": "hora", "terminal": "caja", "cashier": "empleado",
                              "type": "clase", "total": None, "items_count": None, "discount_pct": None,
                              "ref_tx_id": None})
    assert txs[0].type == "refund" and txs[0].cashier == "Lu" and txs[0].total == 0


def test_numbers_and_types():
    assert _num("1.234,56") == 1234.56
    assert _num("1,234.56") == 1234.56
    assert _num("$ 99,9") == 99.9
    assert _num("") == 0
    assert normalize_type("Apertura cajon") == "no_sale"
    assert normalize_type("algo raro") == "algo raro"
