"""CLI del motor de visión.

Ejemplos:
  # Una cámara real, mandando eventos a la API
  python -m vision.run --camera entrada --sink http

  # Un archivo de video en vez de la cámara, imprimiendo eventos
  python -m vision.run --camera caja1 --source samples/caja_demo.mp4 --sink print

  # Todas las cámaras del config (un proceso por cámara + grabación continua)
  python -m vision.run --all --sink http
"""
from __future__ import annotations

import argparse
import os
import subprocess
import sys
from datetime import datetime
from zoneinfo import ZoneInfo

import yaml


def load_config(path: str) -> dict:
    with open(path, encoding="utf-8") as f:
        return yaml.safe_load(f)


def parse_ts(s: str | None, tz: str = "UTC") -> float | None:
    if not s:
        return None
    dt = datetime.fromisoformat(s)
    if dt.tzinfo is None:
        dt = dt.replace(tzinfo=ZoneInfo(tz))
    return dt.timestamp()


def run_one(cfg: dict, camera_id: str, source: str | None, sink_kind: str, jsonl: str | None,
            start_ts: float | None, max_frames: int | None, realtime: bool) -> int:
    from .engine import CameraEngine
    from .sink import make_sink

    cam = next((c for c in cfg["cameras"] if c["id"] == camera_id), None)
    if cam is None:
        sys.exit(f"cámara '{camera_id}' no está en el config")
    sink = make_sink(sink_kind, api_url=cfg.get("api_url"), path=jsonl)
    engine = CameraEngine(cam, cfg, sink, clips_dir=os.environ.get("CLIPS_DIR", "./clips"))
    src = source or cam["source"]
    if isinstance(src, str) and src.isdigit():
        src = int(src)
    n = engine.run(src, start_ts=start_ts, max_frames=max_frames, realtime=realtime)
    print(f"[{camera_id}] frames procesados: {n}", file=sys.stderr)
    return n


def run_all(cfg: dict, config_path: str, sink_kind: str) -> None:
    procs = []
    for cam in cfg["cameras"]:
        procs.append(subprocess.Popen([sys.executable, "-m", "vision.run", "--config", config_path,
                                       "--camera", cam["id"], "--sink", sink_kind]))
        if cam.get("record"):
            procs.append(subprocess.Popen([sys.executable, "-m", "vision.recorder", "--camera", cam["id"],
                                           "--source", cam["source"],
                                           "--dir", os.environ.get("RECORDINGS_DIR", "./recordings")]))
    try:
        for p in procs:
            p.wait()
    except KeyboardInterrupt:
        for p in procs:
            p.terminate()


def main() -> None:
    ap = argparse.ArgumentParser(description="Motor de visión por cámara")
    ap.add_argument("--config", default=os.environ.get("CONFIG_PATH", "./config/cameras.yaml"))
    ap.add_argument("--camera", help="id de cámara del config")
    ap.add_argument("--all", action="store_true", help="correr todas las cámaras")
    ap.add_argument("--source", help="override de la fuente (archivo, rtsp://, o índice de webcam)")
    ap.add_argument("--sink", choices=["print", "jsonl", "http"], default="print")
    ap.add_argument("--jsonl", help="archivo de salida si --sink jsonl")
    ap.add_argument("--start-ts", help="timestamp ISO del primer frame (para archivos), ej 2026-10-09T15:00:00")
    ap.add_argument("--max-frames", type=int)
    ap.add_argument("--realtime", action="store_true", help="reproducir archivo a velocidad real")
    a = ap.parse_args()

    cfg = load_config(a.config)
    if a.all:
        run_all(cfg, a.config, a.sink)
    elif a.camera:
        tz = cfg.get("store", {}).get("timezone", "UTC")
        run_one(cfg, a.camera, a.source, a.sink, a.jsonl, parse_ts(a.start_ts, tz), a.max_frames, a.realtime)
    else:
        ap.error("indicá --camera ID o --all")


if __name__ == "__main__":
    main()
