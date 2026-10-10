from __future__ import annotations

import os
from functools import lru_cache

import yaml


class Settings:
    def __init__(self) -> None:
        self.database_url = os.environ.get("DATABASE_URL", "sqlite:///./tienda.db")
        self.config_path = os.environ.get("CONFIG_PATH", "./config/cameras.yaml")
        self.recordings_dir = os.environ.get("RECORDINGS_DIR", "./recordings")
        self.clips_dir = os.environ.get("CLIPS_DIR", "./clips")
        self._cfg: dict | None = None

    @property
    def cfg(self) -> dict:
        if self._cfg is None:
            if os.path.exists(self.config_path):
                with open(self.config_path, encoding="utf-8") as f:
                    self._cfg = yaml.safe_load(f) or {}
            else:
                self._cfg = {}
        return self._cfg

    @property
    def terminal_camera(self) -> dict[str, str]:
        """terminal del POS -> id de cámara de caja."""
        mapping = dict(self.cfg.get("pos", {}).get("terminal_camera", {}))
        for cam in self.cfg.get("cameras", []):
            if cam.get("terminal"):
                mapping.setdefault(cam["terminal"], cam["id"])
        return mapping

    @property
    def entrance_cameras(self) -> list[str]:
        return [c["id"] for c in self.cfg.get("cameras", []) if c.get("lines")]

    @property
    def timezone(self) -> str:
        return self.cfg.get("store", {}).get("timezone", "UTC")

    @property
    def pos_rules(self) -> dict:
        return dict(self.cfg.get("pos", {}).get("rules", {}))


@lru_cache
def get_settings() -> Settings:
    return Settings()
