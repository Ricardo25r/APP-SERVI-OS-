"""Regenera os splash.png do Android com FUNDO BRANCO + logo centralizado.

O splash anterior tinha o azul (#0D47A1) "queimado" no bitmap. Este script
repinta cada splash.png (todas as densidades/orientações/night) preservando as
dimensões originais: fundo branco + logo (casa + aperto de mão) ao centro.

Uso: python scripts/gen_android_splash.py
Fonte do logo: design-system/assets/icon-app.png
"""

from __future__ import annotations

import glob
import os

from PIL import Image

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
LOGO = os.path.join(ROOT, "design-system", "assets", "icon-app.png")
RES = os.path.join(ROOT, "frontend", "android", "app", "src", "main", "res")
BG = (255, 255, 255)
FACTOR = 0.42  # logo ocupa ~42% da menor dimensão do splash

logo = Image.open(LOGO).convert("RGBA")
paths = sorted(glob.glob(os.path.join(RES, "drawable*", "splash.png")))
print(f"{len(paths)} splash.png encontrados")
for p in paths:
    with Image.open(p) as base:
        w, h = base.size
    canvas = Image.new("RGB", (w, h), BG)
    target = int(min(w, h) * FACTOR)
    lw, lh = logo.size
    scale = target / max(lw, lh)
    nw, nh = max(1, int(lw * scale)), max(1, int(lh * scale))
    resized = logo.resize((nw, nh), Image.LANCZOS)
    canvas.paste(resized, ((w - nw) // 2, (h - nh) // 2), resized)
    canvas.save(p, "PNG")
    print(f"  ok {os.path.relpath(p, RES)} {w}x{h}")
print("Concluido.")
