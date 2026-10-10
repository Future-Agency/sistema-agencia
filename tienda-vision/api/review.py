"""Revisión de un clip con Claude: saca algunos frames y pide un veredicto estructurado.

Solo se usa sobre clips cortos de alertas, nunca sobre video continuo.
"""
from __future__ import annotations

import base64
import json
import os
from typing import Literal

import cv2
from pydantic import BaseModel, Field

MODEL = "claude-opus-5-5"


class ClipReview(BaseModel):
    resumen: str = Field(description="Qué se ve en el clip, en dos o tres frases")
    sospechoso: bool = Field(description="Si lo que se ve amerita que una persona lo revise")
    confianza: float = Field(ge=0, le=1, description="0 a 1, qué tan seguro es el veredicto")
    tipo: Literal["ocultamiento", "no_escaneo", "cajon", "fuera_de_horario", "nada_raro", "no_se_ve", "otro"]
    detalles: str = Field(description="Qué gesto, objeto o momento concreto motiva el veredicto")
    recomendacion: str = Field(description="Qué debería hacer el dueño con esta alerta")


SYSTEM = """Sos un analista de prevención de pérdidas de un comercio. Te muestran frames de un clip corto
de una cámara de seguridad junto con el contexto de por qué se generó la alerta.
Describí objetivamente qué se ve. No identifiques personas ni infieras intenciones a partir de su aspecto.
Marcá como sospechoso solo lo que un supervisor humano debería mirar: productos que se guardan en bolsos,
bolsillos o ropa; productos que pasan por caja sin escanearse; cajón abierto sin cliente; alguien en una zona
donde no debería estar. Si los frames no alcanzan para decidir, decilo (tipo "no_se_ve") y bajá la confianza."""


def sample_frames(clip_path: str, n: int = 6, max_width: int = 960) -> list[bytes]:
    cap = cv2.VideoCapture(clip_path)
    total = int(cap.get(cv2.CAP_PROP_FRAME_COUNT))
    if total <= 0:
        cap.release()
        return []
    idxs = sorted({int(i * (total - 1) / max(1, n - 1)) for i in range(n)})
    frames: list[bytes] = []
    for i in idxs:
        cap.set(cv2.CAP_PROP_POS_FRAMES, i)
        ok, frame = cap.read()
        if not ok:
            continue
        h, w = frame.shape[:2]
        if w > max_width:
            frame = cv2.resize(frame, (max_width, int(h * max_width / w)))
        ok, buf = cv2.imencode(".jpg", frame, [cv2.IMWRITE_JPEG_QUALITY, 80])
        if ok:
            frames.append(buf.tobytes())
    cap.release()
    return frames


def _schema() -> dict:
    s = ClipReview.model_json_schema()
    s["additionalProperties"] = False
    return s


def review_clip(clip_path: str, context: str, n_frames: int = 6) -> ClipReview:
    import anthropic

    if not os.environ.get("ANTHROPIC_API_KEY") and not os.environ.get("ANTHROPIC_AUTH_TOKEN"):
        raise RuntimeError("falta ANTHROPIC_API_KEY")
    frames = sample_frames(clip_path, n_frames)
    if not frames:
        raise RuntimeError(f"no pude leer frames de {clip_path}")

    content: list[dict] = []
    for i, jpg in enumerate(frames):
        content.append({"type": "text", "text": f"Frame {i + 1} de {len(frames)}:"})
        content.append({"type": "image", "source": {"type": "base64", "media_type": "image/jpeg",
                                                     "data": base64.standard_b64encode(jpg).decode()}})
    content.append({"type": "text", "text": f"Contexto de la alerta: {context}\n\nDevolvé el veredicto en el formato pedido."})

    client = anthropic.Anthropic()
    # Fallback server-side: si el modelo principal rechaza el pedido por política, la API reintenta con otro modelo.
    response = client.beta.messages.create(
        model=MODEL,
        max_tokens=2048,
        system=SYSTEM,
        messages=[{"role": "user", "content": content}],
        output_config={"effort": "medium", "format": {"type": "json_schema", "schema": _schema()}},
        betas=["server-side-fallback-2026-07-01"],
        fallbacks="default",
    )
    if response.stop_reason == "refusal":
        return ClipReview(resumen="El modelo no pudo analizar este clip.", sospechoso=False, confianza=0.0,
                          tipo="no_se_ve", detalles=str(getattr(response, "stop_details", "") or ""),
                          recomendacion="Revisar manualmente.")
    text = "".join(b.text for b in response.content if b.type == "text")
    return ClipReview.model_validate(json.loads(text))
