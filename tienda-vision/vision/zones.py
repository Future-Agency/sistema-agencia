"""Máquina de estados de zonas y líneas.

Es Python puro (sin modelo ni OpenCV) para poder testearla sola.
Recibe por frame la lista de (track_id, x, y) en coordenadas relativas 0..1
y devuelve eventos: cruces de línea, entradas/salidas de zona, fin de track.
"""
from __future__ import annotations

from dataclasses import dataclass, field


Point = tuple[float, float]


def point_in_polygon(x: float, y: float, polygon: list[Point]) -> bool:
    """Ray casting clásico."""
    inside = False
    n = len(polygon)
    j = n - 1
    for i in range(n):
        xi, yi = polygon[i]
        xj, yj = polygon[j]
        if (yi > y) != (yj > y):
            x_cross = (xj - xi) * (y - yi) / ((yj - yi) or 1e-12) + xi
            if x < x_cross:
                inside = not inside
        j = i
    return inside


def side_of_line(p: Point, a: Point, b: Point) -> float:
    """Signo del producto cruzado: >0 un lado, <0 el otro."""
    return (b[0] - a[0]) * (p[1] - a[1]) - (b[1] - a[1]) * (p[0] - a[0])


@dataclass
class Zone:
    id: str
    kind: str
    polygon: list[Point]
    restricted_always: bool = False


@dataclass
class Line:
    id: str
    start: Point
    end: Point
    in_direction: str = "down"  # down | up | left | right

    def direction_of(self, before: Point, after: Point) -> str:
        dx = after[0] - before[0]
        dy = after[1] - before[1]
        moved = {
            "down": dy > 0,
            "up": dy < 0,
            "right": dx > 0,
            "left": dx < 0,
        }[self.in_direction]
        return "in" if moved else "out"


@dataclass
class TrackState:
    track_id: int
    first_ts: float
    last_ts: float
    last_pos: Point
    zone_enter_ts: dict[str, float] = field(default_factory=dict)
    line_side: dict[str, float] = field(default_factory=dict)
    path: list[str] = field(default_factory=list)


@dataclass
class ZoneTracker:
    camera_id: str
    zones: list[Zone]
    lines: list[Line]
    track_timeout_s: float = 3.0
    tracks: dict[int, TrackState] = field(default_factory=dict)

    def update(self, ts: float, positions: list[tuple[int, float, float]]) -> list[dict]:
        events: list[dict] = []
        seen: set[int] = set()

        for track_id, x, y in positions:
            seen.add(track_id)
            pos = (x, y)
            st = self.tracks.get(track_id)
            if st is None:
                st = TrackState(track_id=track_id, first_ts=ts, last_ts=ts, last_pos=pos)
                self.tracks[track_id] = st
                for line in self.lines:
                    st.line_side[line.id] = side_of_line(pos, line.start, line.end)

            # Líneas
            for line in self.lines:
                prev_side = st.line_side.get(line.id)
                side = side_of_line(pos, line.start, line.end)
                if prev_side is not None and prev_side != 0 and side != 0 and (prev_side > 0) != (side > 0):
                    events.append({
                        "type": "line_cross",
                        "camera_id": self.camera_id,
                        "ts": ts,
                        "track_id": track_id,
                        "line_id": line.id,
                        "direction": line.direction_of(st.last_pos, pos),
                    })
                st.line_side[line.id] = side

            # Zonas
            for zone in self.zones:
                inside = point_in_polygon(x, y, zone.polygon)
                was_inside = zone.id in st.zone_enter_ts
                if inside and not was_inside:
                    st.zone_enter_ts[zone.id] = ts
                    st.path.append(zone.id)
                    events.append({
                        "type": "zone_enter",
                        "camera_id": self.camera_id,
                        "ts": ts,
                        "track_id": track_id,
                        "zone_id": zone.id,
                        "zone_kind": zone.kind,
                    })
                elif not inside and was_inside:
                    enter_ts = st.zone_enter_ts.pop(zone.id)
                    events.append(self._exit_event(zone, st, ts, enter_ts))

            st.last_ts = ts
            st.last_pos = pos

        # Tracks que desaparecieron
        for track_id in list(self.tracks):
            st = self.tracks[track_id]
            if track_id in seen or ts - st.last_ts < self.track_timeout_s:
                continue
            for zone in self.zones:
                if zone.id in st.zone_enter_ts:
                    enter_ts = st.zone_enter_ts.pop(zone.id)
                    events.append(self._exit_event(zone, st, st.last_ts, enter_ts))
            events.append({
                "type": "track_end",
                "camera_id": self.camera_id,
                "ts": st.last_ts,
                "track_id": track_id,
                "duration_s": round(st.last_ts - st.first_ts, 2),
                "path": list(st.path),
            })
            del self.tracks[track_id]

        return events

    def _exit_event(self, zone: Zone, st: TrackState, ts: float, enter_ts: float) -> dict:
        return {
            "type": "zone_exit",
            "camera_id": self.camera_id,
            "ts": ts,
            "track_id": st.track_id,
            "zone_id": zone.id,
            "zone_kind": zone.kind,
            "dwell_s": round(ts - enter_ts, 2),
        }

    def occupancy(self) -> dict[str, int]:
        counts = {z.id: 0 for z in self.zones}
        for st in self.tracks.values():
            for zone_id in st.zone_enter_ts:
                counts[zone_id] += 1
        return counts

    def dwell_so_far(self, ts: float) -> list[tuple[int, str, float]]:
        """(track_id, zone_id, segundos) de cada track que está dentro de una zona ahora."""
        out = []
        for st in self.tracks.values():
            for zone_id, enter_ts in st.zone_enter_ts.items():
                out.append((st.track_id, zone_id, ts - enter_ts))
        return out


def zones_from_config(cam_cfg: dict) -> tuple[list[Zone], list[Line]]:
    zones = [
        Zone(
            id=z["id"],
            kind=z.get("kind", "generica"),
            polygon=[tuple(p) for p in z["polygon"]],
            restricted_always=bool(z.get("restricted_always", False)),
        )
        for z in cam_cfg.get("zones", [])
    ]
    lines = [
        Line(
            id=ln["id"],
            start=tuple(ln["start"]),
            end=tuple(ln["end"]),
            in_direction=ln.get("in_direction", "down"),
        )
        for ln in cam_cfg.get("lines", [])
    ]
    return zones, lines
