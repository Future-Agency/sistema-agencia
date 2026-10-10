"""Genera un CSV de transacciones de ejemplo de un día, con un cajero que se comporta raro.

Uso: python samples/make_sample_pos.py samples/pos_ventas_ejemplo.csv [2026-10-09]
"""
from __future__ import annotations

import csv
import random
import sys
from datetime import datetime, timedelta


def main(out: str, day: str = "2026-10-09") -> None:
    rng = random.Random(7)
    base = datetime.fromisoformat(day + "T08:00:00")
    cashiers = [("Ana", "CAJA1"), ("Lucas", "CAJA1"), ("Mia", "CAJA2")]
    rows: list[dict] = []
    n = 0

    def add(ts, terminal, cashier, tipo, total=0.0, items=0, desc=0.0, ref=""):
        nonlocal n
        n += 1
        rows.append({"id": f"T{n:05d}", "fecha": ts.strftime("%Y-%m-%d %H:%M:%S"), "terminal": terminal,
                     "cajero": cashier, "tipo": tipo, "total": f"{total:.2f}", "items": items,
                     "descuento_pct": f"{desc:.0f}", "ref": ref})
        return f"T{n:05d}"

    # turnos: Ana 8-14 en CAJA1, Lucas 14-21 en CAJA1, Mia 8-21 en CAJA2
    for cashier, terminal, start_h, end_h, per_hour in [("Ana", "CAJA1", 8, 14, 7), ("Lucas", "CAJA1", 14, 21, 7),
                                                         ("Mia", "CAJA2", 8, 21, 5)]:
        sales = []
        for h in range(start_h, end_h):
            for _ in range(per_hour + rng.randint(-2, 2)):
                ts = base.replace(hour=h, minute=rng.randint(0, 59), second=rng.randint(0, 59))
                items = rng.randint(1, 9)
                total = round(sum(rng.uniform(300, 4000) for _ in range(items)), 2)
                desc = rng.choice([0, 0, 0, 0, 5, 10])
                sales.append((ts, add(ts, terminal, cashier, "venta", total, items, desc)))
        sales.sort()
        # comportamiento normal: alguna anulación inmediata, alguna devolución con ticket
        for ts, tid in rng.sample(sales, 2):
            add(ts + timedelta(minutes=1), terminal, cashier, "anulacion", 1500, 1, 0, tid)
        ts, tid = rng.choice(sales)
        add(ts + timedelta(hours=2), terminal, cashier, "devolucion", 900, 1, 0, tid)
        add(base.replace(hour=start_h, minute=5), terminal, cashier, "sin venta")

        if cashier == "Lucas":
            # anulaciones tardías de ventas grandes
            for ts, tid in rng.sample(sales, 6):
                add(ts + timedelta(minutes=rng.randint(20, 90)), terminal, cashier, "anulacion",
                    rng.uniform(5000, 15000), 1, 0, tid)
            # anulaciones sin referencia
            for _ in range(3):
                ts = base.replace(hour=rng.randint(15, 20), minute=rng.randint(0, 59))
                add(ts, terminal, cashier, "anulacion", rng.uniform(2000, 8000), 1, 0, "")
            # devoluciones sin ticket
            for _ in range(2):
                ts = base.replace(hour=rng.randint(15, 20), minute=rng.randint(0, 59))
                add(ts, terminal, cashier, "devolucion", rng.uniform(3000, 9000), 1, 0, "")
            # descuentos altos
            for _ in range(3):
                ts = base.replace(hour=rng.randint(15, 20), minute=rng.randint(0, 59))
                add(ts, terminal, cashier, "venta", rng.uniform(4000, 12000), 3, rng.choice([35, 50, 60]))
            # cajón sin venta a cada rato
            for _ in range(5):
                ts = base.replace(hour=rng.randint(15, 20), minute=rng.randint(0, 59))
                add(ts, terminal, cashier, "sin venta")

    rows.sort(key=lambda r: r["fecha"])
    with open(out, "w", newline="", encoding="utf-8") as f:
        w = csv.DictWriter(f, fieldnames=["id", "fecha", "terminal", "cajero", "tipo", "total", "items",
                                          "descuento_pct", "ref"])
        w.writeheader()
        w.writerows(rows)
    print(f"escrito {out}: {len(rows)} transacciones")


if __name__ == "__main__":
    main(sys.argv[1] if len(sys.argv) > 1 else "samples/pos_ventas_ejemplo.csv",
         sys.argv[2] if len(sys.argv) > 2 else "2026-10-09")
