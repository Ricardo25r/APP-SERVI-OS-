"""Gera os gráficos exigidos pela Google Play Store para a ficha do FazTudo.

Saídas em design-system/play-store/:
- icon-512.png        → ícone de alta resolução (512x512, fundo branco, opaco)
- feature-1024x500.png → gráfico de destaque/capa (1024x500)

Uso: python scripts/gen_playstore_assets.py
"""

from __future__ import annotations

import os

from PIL import Image

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
ASSETS = os.path.join(ROOT, "design-system", "assets")
OUT = os.path.join(ROOT, "design-system", "play-store")
os.makedirs(OUT, exist_ok=True)
WHITE = (255, 255, 255)


def _fit(img: Image.Image, box_w: int, box_h: int) -> Image.Image:
    w, h = img.size
    scale = min(box_w / w, box_h / h)
    return img.resize((max(1, int(w * scale)), max(1, int(h * scale))), Image.LANCZOS)


# 1) Ícone 512x512 (opaco, fundo branco — Google aplica a máscara dos cantos).
icon = Image.open(os.path.join(ASSETS, "icon-app.png")).convert("RGBA")
canvas = Image.new("RGB", (512, 512), WHITE)
fitted = _fit(icon, 512, 512)
canvas.paste(fitted, ((512 - fitted.width) // 2, (512 - fitted.height) // 2), fitted)
canvas.save(os.path.join(OUT, "icon-512.png"), "PNG")
print("icon-512.png ok")

# 2) Gráfico de destaque 1024x500 (lockup com mascotes centralizado, fundo branco).
full = Image.open(os.path.join(ASSETS, "logo-faztudo-full.png")).convert("RGBA")
feat = Image.new("RGB", (1024, 500), WHITE)
lk = _fit(full, 940, 440)
feat.paste(lk, ((1024 - lk.width) // 2, (500 - lk.height) // 2), lk)
feat.save(os.path.join(OUT, "feature-1024x500.png"), "PNG")
print("feature-1024x500.png ok")
print("Saida em:", OUT)
