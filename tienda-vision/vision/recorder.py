"""Grabación continua por cámara en segmentos de 60 s con ffmpeg (sin recodificar).

Sirve para recuperar después el clip de cualquier momento, por ejemplo cuando el
motor de excepciones del POS marca una transacción sospechosa.
"""
from __future__ import annotations

import os
import subprocess
import sys
import time
from pathlib import Path


def segment_dir(recordings_dir: str, camera_id: str) -> Path:
    p = Path(recordings_dir) / camera_id
    p.mkdir(parents=True, exist_ok=True)
    return p


def ffmpeg_record_cmd(source: str, out_dir: Path, segment_s: int = 60) -> list[str]:
    cmd = ["ffmpeg", "-hide_banner", "-loglevel", "warning"]
    if source.startswith("rtsp://"):
        cmd += ["-rtsp_transport", "tcp"]
    cmd += [
        "-i", source,
        "-c", "copy",
        "-f", "segment",
        "-segment_time", str(segment_s),
        "-reset_timestamps", "1",
        "-strftime", "1",
        str(out_dir / "%Y%m%d_%H%M%S.mp4"),
    ]
    return cmd


def cleanup(out_dir: Path, retention_hours: float) -> int:
    limit = time.time() - retention_hours * 3600
    removed = 0
    for f in out_dir.glob("*.mp4"):
        if f.stat().st_mtime < limit:
            f.unlink(missing_ok=True)
            removed += 1
    return removed


def record_forever(camera_id: str, source: str, recordings_dir: str, retention_hours: float = 48) -> None:
    out_dir = segment_dir(recordings_dir, camera_id)
    while True:
        print(f"[recorder:{camera_id}] grabando a {out_dir}", file=sys.stderr)
        proc = subprocess.Popen(ffmpeg_record_cmd(source, out_dir))
        try:
            while proc.poll() is None:
                time.sleep(300)
                cleanup(out_dir, retention_hours)
        except KeyboardInterrupt:
            proc.terminate()
            return
        print(f"[recorder:{camera_id}] ffmpeg terminó (código {proc.returncode}), reintento en 5 s", file=sys.stderr)
        time.sleep(5)


if __name__ == "__main__":
    import argparse

    ap = argparse.ArgumentParser()
    ap.add_argument("--camera", required=True)
    ap.add_argument("--source", required=True)
    ap.add_argument("--dir", default=os.environ.get("RECORDINGS_DIR", "./recordings"))
    ap.add_argument("--retention-hours", type=float, default=48)
    a = ap.parse_args()
    record_forever(a.camera, a.source, a.dir, a.retention_hours)
