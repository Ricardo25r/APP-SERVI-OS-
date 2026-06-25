"""Validação de imagem por **magic bytes** (#9 da esteira).

Não confia no ``Content-Type`` declarado pelo cliente (trivialmente forjável):
inspeciona os primeiros bytes do arquivo. Usado nos uploads (avatar, portfólio,
imagem de chat) para recusar conteúdo que não é imagem de verdade.
"""

from __future__ import annotations

__all__ = ["detect_image"]


def detect_image(data: bytes) -> str | None:
    """Content-type real da imagem pelos magic bytes, ou ``None`` se não for."""
    if len(data) < 12:
        return None
    if data[:3] == b"\xff\xd8\xff":
        return "image/jpeg"
    if data[:8] == b"\x89PNG\r\n\x1a\n":
        return "image/png"
    if data[:6] in (b"GIF87a", b"GIF89a"):
        return "image/gif"
    if data[:4] == b"RIFF" and data[8:12] == b"WEBP":
        return "image/webp"
    return None
