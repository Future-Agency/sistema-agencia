from vision.zones import Line, Zone, ZoneTracker, point_in_polygon, zones_from_config

SQUARE = [(0.0, 0.0), (0.5, 0.0), (0.5, 0.5), (0.0, 0.5)]


def test_point_in_polygon():
    assert point_in_polygon(0.25, 0.25, SQUARE)
    assert not point_in_polygon(0.75, 0.25, SQUARE)
    assert not point_in_polygon(0.25, 0.75, SQUARE)


def make_tracker():
    return ZoneTracker(
        camera_id="cam",
        zones=[Zone(id="vidriera", kind="gondola", polygon=SQUARE)],
        lines=[Line(id="puerta", start=(0.0, 0.6), end=(1.0, 0.6), in_direction="down")],
        track_timeout_s=2.0,
    )


def test_line_cross_in_and_out():
    zt = make_tracker()
    assert zt.update(0.0, [(1, 0.8, 0.5)]) == []
    evs = zt.update(1.0, [(1, 0.8, 0.7)])
    assert [(e["type"], e["direction"]) for e in evs] == [("line_cross", "in")]
    evs = zt.update(2.0, [(1, 0.8, 0.5)])
    assert [(e["type"], e["direction"]) for e in evs] == [("line_cross", "out")]


def test_zone_enter_exit_dwell_and_track_end():
    zt = make_tracker()
    zt.update(0.0, [(7, 0.8, 0.8)])
    evs = [e for e in zt.update(1.0, [(7, 0.2, 0.2)]) if e["type"] != "line_cross"]
    assert evs[0]["type"] == "zone_enter" and evs[0]["zone_id"] == "vidriera"
    assert zt.occupancy() == {"vidriera": 1}
    assert zt.dwell_so_far(5.0) == [(7, "vidriera", 4.0)]
    evs = [e for e in zt.update(6.0, [(7, 0.8, 0.8)]) if e["type"] != "line_cross"]
    assert evs[0]["type"] == "zone_exit" and evs[0]["dwell_s"] == 5.0
    # desaparece: pasado el timeout se cierra el track con su recorrido
    assert zt.update(7.0, []) == []
    evs = zt.update(9.0, [])
    assert evs[-1]["type"] == "track_end"
    assert evs[-1]["path"] == ["vidriera"]
    assert evs[-1]["duration_s"] == 6.0
    assert zt.tracks == {}


def test_track_lost_inside_zone_emits_exit():
    zt = make_tracker()
    zt.update(0.0, [(1, 0.2, 0.2)])
    evs = zt.update(10.0, [])
    assert [e["type"] for e in evs] == ["zone_exit", "track_end"]


def test_zones_from_config():
    zones, lines = zones_from_config({
        "zones": [{"id": "z", "kind": "cola", "polygon": [[0, 0], [1, 0], [1, 1]]}],
        "lines": [{"id": "l", "start": [0, 0.5], "end": [1, 0.5], "in_direction": "up"}],
    })
    assert zones[0].polygon == [(0, 0), (1, 0), (1, 1)]
    assert lines[0].in_direction == "up"
    assert lines[0].direction_of((0.5, 0.6), (0.5, 0.4)) == "in"
