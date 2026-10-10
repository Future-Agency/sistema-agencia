"""A dónde van los eventos que genera el motor: consola, archivo JSONL o la API."""
from __future__ import annotations

import json
import sys
import time

import httpx


class PrintSink:
    def emit(self, events: list[dict]) -> None:
        for ev in events:
            print(json.dumps(ev, ensure_ascii=False), flush=True)

    def close(self) -> None:
        pass


class JsonlSink:
    def __init__(self, path: str):
        self.f = open(path, "a", encoding="utf-8")

    def emit(self, events: list[dict]) -> None:
        for ev in events:
            self.f.write(json.dumps(ev, ensure_ascii=False) + "\n")
        self.f.flush()

    def close(self) -> None:
        self.f.close()


class HttpSink:
    """Manda los eventos en lotes a POST /events/batch. Si la API no responde, los guarda y reintenta."""

    def __init__(self, api_url: str, batch_size: int = 50, flush_every_s: float = 2.0):
        self.url = api_url.rstrip("/") + "/events/batch"
        self.client = httpx.Client(timeout=10.0)
        self.buffer: list[dict] = []
        self.batch_size = batch_size
        self.flush_every_s = flush_every_s
        self.last_flush = time.monotonic()

    def emit(self, events: list[dict]) -> None:
        self.buffer.extend(events)
        if len(self.buffer) >= self.batch_size or time.monotonic() - self.last_flush > self.flush_every_s:
            self.flush()

    def flush(self) -> None:
        if not self.buffer:
            return
        try:
            r = self.client.post(self.url, json={"events": self.buffer})
            r.raise_for_status()
            self.buffer = []
        except httpx.HTTPError as e:
            print(f"[sink] no pude mandar {len(self.buffer)} eventos: {e}", file=sys.stderr)
            if len(self.buffer) > 5000:
                self.buffer = self.buffer[-5000:]
        self.last_flush = time.monotonic()

    def close(self) -> None:
        self.flush()
        self.client.close()


def make_sink(kind: str, api_url: str | None = None, path: str | None = None):
    if kind == "print":
        return PrintSink()
    if kind == "jsonl":
        return JsonlSink(path or "eventos.jsonl")
    if kind == "http":
        return HttpSink(api_url or "http://localhost:8000")
    raise ValueError(f"sink desconocido: {kind}")
