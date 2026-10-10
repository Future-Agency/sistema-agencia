"""Motor de visión de una cámara.

Flujo por frame: YOLO (solo personas) + tracker ByteTrack -> posiciones relativas
-> ZoneTracker (líneas/zonas) -> reglas de alerta -> eventos al sink.

Guarda solo eventos, nunca video continuo. Para las alertas escribe un clip corto
desde un buffer en memoria de los últimos segundos.
"""
from __future__ import annotations

import sys
import time
from collections import deque
from datetime import datetime, time as dtime
from pathlib import Path
from zoneinfo import ZoneInfo

import cv2
import numpy as np

from .zones import ZoneTracker, zones_from_config


class CameraEngine:
    def __init__(self, cam_cfg: dict, cfg: dict, sink, clips_dir: str = "./clips"):
        from ultralytics import YOLO  # import tardío: tarda y no hace falta en tests

        self.cam = cam_cfg
        self.cfg = cfg
        self.sink = sink
        self.camera_id = cam_cfg["id"]
        mcfg = cfg.get("model", {})
        self.model = YOLO(mcfg.get("weights", "yolo11n.pt"))
        self.conf = float(mcfg.get("confidence", 0.35))
        self.imgsz = int(mcfg.get("imgsz", 640))
        self.stride = int(mcfg.get("frame_stride", 3))
        self.tracker = mcfg.get("tracker", "bytetrack.yaml")

        zones, lines = zones_from_config(cam_cfg)
        self.zones = {z.id: z for z in zones}
        self.zt = ZoneTracker(camera_id=self.camera_id, zones=zones, lines=lines)

        acfg = cfg.get("alerts", {})
        self.loitering_s = float(acfg.get("loitering_seconds", 120))
        self.queue_max = int(acfg.get("queue_max", 4))
        self.occ_every = float(acfg.get("occupancy_every_s", 10))
        self.heat_every = float(acfg.get("heatmap_every_s", 60))
        cols, rows = acfg.get("heatmap_grid", [32, 18])
        self.heat = np.zeros((rows, cols), dtype=np.int32)
        self.clip_before = float(acfg.get("clip_before_s", 10))
        self.clip_after = float(acfg.get("clip_after_s", 8))

        store = cfg.get("store", {})
        self.tz = ZoneInfo(store.get("timezone", "UTC"))
        oh = store.get("open_hours", {"start": "00:00", "end": "23:59"})
        self.open_start = dtime.fromisoformat(oh["start"])
        self.open_end = dtime.fromisoformat(oh["end"])

        self.clips_dir = Path(clips_dir) / self.camera_id
        self.clips_dir.mkdir(parents=True, exist_ok=True)
        self.ring: deque[tuple[float, np.ndarray]] = deque()
        self.pending_clips: list[dict] = []
        self.alerted: dict[tuple, float] = {}
        self.last_occ_ts: float | None = None
        self.last_heat_ts: float | None = None
        self.fps_est = 10.0

    # ---------- utilidades ----------
    def is_open(self, ts: float) -> bool:
        t = datetime.fromtimestamp(ts, self.tz).time()
        if self.open_start <= self.open_end:
            return self.open_start <= t <= self.open_end
        return t >= self.open_start or t <= self.open_end  # horario que cruza medianoche

    def _dedupe(self, key: tuple, ts: float, window_s: float) -> bool:
        """True si hay que emitir (no se emitió esta misma alerta en la ventana)."""
        last = self.alerted.get(key)
        if last is not None and ts - last < window_s:
            return False
        self.alerted[key] = ts
        return True

    # ---------- detección ----------
    def detect(self, frame: np.ndarray) -> list[tuple[int, float, float, tuple[int, int, int, int]]]:
        """Devuelve (track_id, x_rel, y_rel_pie, bbox_px) por persona trackeada."""
        h, w = frame.shape[:2]
        results = self.model.track(
            frame, persist=True, classes=[0], conf=self.conf, imgsz=self.imgsz,
            tracker=self.tracker, verbose=False,
        )
        out = []
        if not results:
            return out
        boxes = results[0].boxes
        if boxes is None or boxes.id is None:
            return out
        ids = boxes.id.int().tolist()
        xyxy = boxes.xyxy.tolist()
        for tid, (x1, y1, x2, y2) in zip(ids, xyxy):
            cx = (x1 + x2) / 2 / w
            foot = y2 / h
            out.append((int(tid), float(cx), float(foot), (int(x1), int(y1), int(x2), int(y2))))
        return out

    # ---------- reglas de alerta ----------
    def alerts_for(self, ts: float, events: list[dict], people: list) -> list[dict]:
        alerts: list[dict] = []
        is_open = self.is_open(ts)

        if people and not is_open:
            for tid, *_ in people:
                if self._dedupe(("fuera_de_horario", tid), ts, 600):
                    alerts.append(self._alert(ts, "fuera_de_horario", "alta", tid, None,
                                              "Persona detectada con el local cerrado"))

        for ev in events:
            if ev["type"] == "zone_enter" and ev["zone_kind"] == "restringida":
                zone = self.zones[ev["zone_id"]]
                if zone.restricted_always or not is_open:
                    if self._dedupe(("zona_restringida", ev["track_id"], zone.id), ts, 600):
                        alerts.append(self._alert(ts, "zona_restringida", "alta", ev["track_id"], zone.id,
                                                  f"Persona entró a zona restringida '{zone.id}'"))

        for tid, zone_id, dwell in self.zt.dwell_so_far(ts):
            zone = self.zones[zone_id]
            if zone.kind in ("gondola", "generica") and dwell >= self.loitering_s:
                if self._dedupe(("merodeo", tid, zone_id), ts, 3600):
                    alerts.append(self._alert(ts, "merodeo", "media", tid, zone_id,
                                              f"Persona lleva {int(dwell)} s en '{zone_id}'"))

        for zone_id, count in self.zt.occupancy().items():
            if self.zones[zone_id].kind == "cola" and count > self.queue_max:
                if self._dedupe(("cola_larga", zone_id), ts, 300):
                    alerts.append(self._alert(ts, "cola_larga", "baja", None, zone_id,
                                              f"{count} personas en la cola (máx {self.queue_max})"))
        return alerts

    def _alert(self, ts, alert_type, severity, track_id, zone_id, description) -> dict:
        clip_path = self._schedule_clip(ts, alert_type)
        return {
            "type": "alert",
            "camera_id": self.camera_id,
            "ts": ts,
            "alert_type": alert_type,
            "severity": severity,
            "track_id": track_id,
            "zone_id": zone_id,
            "description": description,
            "clip_path": clip_path,
        }

    # ---------- clips ----------
    def _schedule_clip(self, ts: float, tag: str) -> str:
        name = datetime.fromtimestamp(ts, self.tz).strftime("%Y%m%d_%H%M%S") + f"_{tag}.mp4"
        path = self.clips_dir / name
        frames = [f for t, f in self.ring if t >= ts - self.clip_before]
        self.pending_clips.append({"path": path, "frames": frames, "end_ts": ts + self.clip_after})
        return str(path)

    def _feed_clips(self, ts: float, frame: np.ndarray) -> None:
        self.ring.append((ts, frame))
        while self.ring and ts - self.ring[0][0] > self.clip_before + 1:
            self.ring.popleft()
        done = []
        for pc in self.pending_clips:
            pc["frames"].append(frame)
            if ts >= pc["end_ts"]:
                self._write_clip(pc["path"], pc["frames"])
                done.append(pc)
        for pc in done:
            self.pending_clips.remove(pc)

    def _write_clip(self, path: Path, frames: list[np.ndarray]) -> None:
        if not frames:
            return
        h, w = frames[0].shape[:2]
        fps = max(2.0, self.fps_est / self.stride)
        vw = cv2.VideoWriter(str(path), cv2.VideoWriter_fourcc(*"mp4v"), fps, (w, h))
        for f in frames:
            vw.write(f)
        vw.release()

    def flush_clips(self) -> None:
        for pc in self.pending_clips:
            self._write_clip(pc["path"], pc["frames"])
        self.pending_clips.clear()

    # ---------- un frame ----------
    def process_frame(self, frame: np.ndarray, ts: float) -> list[dict]:
        people = self.detect(frame)
        positions = [(tid, x, y) for tid, x, y, _ in people]
        events = self.zt.update(ts, positions)

        rows, cols = self.heat.shape
        for _, x, y in positions:
            self.heat[min(rows - 1, int(y * rows)), min(cols - 1, int(x * cols))] += 1

        if self.last_occ_ts is None or ts - self.last_occ_ts >= self.occ_every:
            self.last_occ_ts = ts
            events.append({"type": "occupancy", "camera_id": self.camera_id, "ts": ts,
                           "zones": self.zt.occupancy(), "people": len(people)})

        if self.last_heat_ts is None:
            self.last_heat_ts = ts
        elif ts - self.last_heat_ts >= self.heat_every and self.heat.any():
            events.append({"type": "heatmap", "camera_id": self.camera_id, "ts": ts,
                           "window_s": round(ts - self.last_heat_ts, 1),
                           "rows": rows, "cols": cols, "grid": self.heat.tolist()})
            self.heat[:] = 0
            self.last_heat_ts = ts

        events.extend(self.alerts_for(ts, events, people))
        self._feed_clips(ts, frame)
        return events

    # ---------- loop ----------
    def run(self, source: str | int, start_ts: float | None = None, max_frames: int | None = None,
            realtime: bool = False) -> int:
        is_stream = isinstance(source, int) or str(source).startswith(("rtsp://", "http://", "https://"))
        cap = cv2.VideoCapture(source)
        if not cap.isOpened():
            raise RuntimeError(f"No pude abrir la fuente: {source}")
        fps = cap.get(cv2.CAP_PROP_FPS) or 10.0
        self.fps_est = fps
        base_ts = start_ts if start_ts is not None else time.time()
        idx = 0
        processed = 0
        last_ts = base_ts
        print(f"[{self.camera_id}] fuente={source} fps={fps:.1f} stride={self.stride}", file=sys.stderr)
        try:
            while True:
                ok, frame = cap.read()
                if not ok:
                    if is_stream:
                        print(f"[{self.camera_id}] stream cortado, reconecto en 3 s", file=sys.stderr)
                        time.sleep(3)
                        cap.release()
                        cap = cv2.VideoCapture(source)
                        continue
                    break
                idx += 1
                if idx % self.stride:
                    continue
                ts = time.time() if is_stream and start_ts is None else base_ts + idx / fps
                last_ts = ts
                events = self.process_frame(frame, ts)
                if events:
                    self.sink.emit(events)
                processed += 1
                if max_frames and processed >= max_frames:
                    break
                if realtime and not is_stream:
                    time.sleep(self.stride / fps)
        finally:
            cap.release()
            # cerrar tracks abiertos al terminar un archivo
            tail = self.zt.update(last_ts + self.zt.track_timeout_s + 1, [])
            if tail:
                self.sink.emit(tail)
            self.flush_clips()
            self.sink.close()
        return processed
