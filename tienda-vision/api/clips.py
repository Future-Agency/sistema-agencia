"""Recorta un clip de las grabaciones continuas (vision/recorder.py) alrededor de un instante."""
from __future__ import annotations

import subprocess
from datetime import datetime
from pathlib import Path


def _segment_start(path: Path) -> datetime | None:
    try:
        return datetime.strptime(path.stem, "%Y%m%d_%H%M%S")
    except ValueError:
        return None


def extract_clip(camera_id: str, ts: float, recordings_dir: str, clips_dir: str,
                 before_s: float = 10, after_s: float = 20, segment_s: int = 60, tag: str = "pos") -> str | None:
    seg_dir = Path(recordings_dir) / camera_id
    if not seg_dir.exists():
        return None
    t0 = datetime.fromtimestamp(ts - before_s)
    t1 = datetime.fromtimestamp(ts + after_s)
    segs = []
    for f in sorted(seg_dir.glob("*.mp4")):
        st = _segment_start(f)
        if st is None:
            continue
        if st <= t1 and (st.timestamp() + segment_s) >= t0.timestamp():
            segs.append((st, f))
    if not segs:
        return None

    out_dir = Path(clips_dir) / camera_id
    out_dir.mkdir(parents=True, exist_ok=True)
    out = out_dir / (datetime.fromtimestamp(ts).strftime("%Y%m%d_%H%M%S") + f"_{tag}.mp4")
    offset = max(0.0, t0.timestamp() - segs[0][0].timestamp())
    duration = before_s + after_s

    list_file = out_dir / f".concat_{out.stem}.txt"
    list_file.write_text("".join(f"file '{f.resolve()}'\n" for _, f in segs))
    cmd = ["ffmpeg", "-y", "-hide_banner", "-loglevel", "error",
           "-f", "concat", "-safe", "0", "-i", str(list_file),
           "-ss", f"{offset:.2f}", "-t", f"{duration:.2f}", "-c", "copy", str(out)]
    try:
        subprocess.run(cmd, check=True)
    except (subprocess.CalledProcessError, FileNotFoundError):
        return None
    finally:
        list_file.unlink(missing_ok=True)
    return str(out)
