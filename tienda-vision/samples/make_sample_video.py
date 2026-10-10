"""Genera un video sintético de prueba con una persona real recortada de una foto.

La persona cruza la línea de la puerta hacia abajo, se queda un rato en la zona
"vidriera" (para disparar la alerta de merodeo) y se va. Sirve para probar el
motor sin tener una cámara conectada.

Uso: python samples/make_sample_video.py samples/demo_entrada.mp4
"""
from __future__ import annotations

import sys
from pathlib import Path

import cv2
import numpy as np

HERE = Path(__file__).parent


def crop_person(src: Path) -> np.ndarray:
    from ultralytics import YOLO

    img = cv2.imread(str(src))
    res = YOLO("yolo11n.pt")(img, classes=[0], conf=0.5, verbose=False)[0]
    boxes = res.boxes.xyxy.tolist()
    if not boxes:
        sys.exit("no encontré personas en la imagen fuente")
    # la más alta (más nítida)
    x1, y1, x2, y2 = max(boxes, key=lambda b: b[3] - b[1])
    return img[int(y1):int(y2), int(x1):int(x2)]


def paste(bg: np.ndarray, sprite: np.ndarray, cx: int, foot_y: int) -> np.ndarray:
    h, w = sprite.shape[:2]
    x1, y1 = cx - w // 2, foot_y - h
    x2, y2 = x1 + w, foot_y
    H, W = bg.shape[:2]
    sx1, sy1 = max(0, -x1), max(0, -y1)
    sx2, sy2 = w - max(0, x2 - W), h - max(0, y2 - H)
    x1, y1, x2, y2 = max(0, x1), max(0, y1), min(W, x2), min(H, y2)
    if x2 > x1 and y2 > y1:
        bg[y1:y2, x1:x2] = sprite[sy1:sy2, sx1:sx2]
    return bg


def main(out: str, fps: int = 10, size=(640, 360)) -> None:
    W, H = size
    sprite = crop_person(HERE / "persona_fuente.jpg")
    scale = (H * 0.45) / sprite.shape[0]
    sprite = cv2.resize(sprite, None, fx=scale, fy=scale)

    rng = np.random.default_rng(0)
    base = np.full((H, W, 3), 170, dtype=np.uint8)
    base = cv2.add(base, rng.integers(0, 25, (H, W, 3), dtype=np.uint8))
    cv2.rectangle(base, (0, int(H * 0.35)), (W, int(H * 0.35) + 2), (90, 90, 90), -1)  # la "puerta"

    # trayectoria: entra por arriba a la derecha, cruza la línea, va a la vidriera (arriba izq) y se queda
    keyframes = [  # (segundo, x_rel, y_rel_pie)
        (0.0, 0.80, 0.25),
        (3.0, 0.80, 0.60),   # cruza la puerta hacia abajo (entra)
        (6.0, 0.60, 0.85),
        (8.0, 0.25, 0.80),   # entra a la vidriera
        (16.0, 0.22, 0.82),  # se queda (merodeo con loitering_seconds bajo)
        (19.0, 0.70, 0.60),
        (22.0, 0.80, 0.25),  # sale por la puerta hacia arriba
    ]
    total_s = keyframes[-1][0] + 1
    vw = cv2.VideoWriter(out, cv2.VideoWriter_fourcc(*"mp4v"), fps, (W, H))
    n = int(total_s * fps)
    for i in range(n):
        t = i / fps
        # interpolación lineal entre keyframes
        for (t0, x0, y0), (t1, x1, y1) in zip(keyframes, keyframes[1:]):
            if t0 <= t <= t1:
                a = (t - t0) / (t1 - t0)
                x, y = x0 + (x1 - x0) * a, y0 + (y1 - y0) * a
                break
        else:
            x, y = keyframes[-1][1:]
        frame = paste(base.copy(), sprite, int(x * W), int(y * H))
        vw.write(frame)
    vw.release()
    print(f"escrito {out}: {n} frames, {total_s:.0f} s")


if __name__ == "__main__":
    main(sys.argv[1] if len(sys.argv) > 1 else str(HERE / "demo_entrada.mp4"))
