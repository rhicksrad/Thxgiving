"""Shrinks the Codex PNGs in art-src/ into the WebP files the site loads, in public/art/.

    python scripts/art-webp.py

Backgrounds (bg-*) become 1600 px wide and accents (hero-*) 1200 px wide, each squeezed until it's under
150 KB. Spots (spot-*) become 512 px with see-through backgrounds. Needs Pillow and numpy.
"""
from pathlib import Path

import numpy as np
from PIL import Image

SRC = Path('art-src')
OUT = Path('public/art')
LIMIT = 150 * 1024
OUT.mkdir(parents=True, exist_ok=True)

for png in sorted(SRC.glob('*.png')):
    width = 512 if png.stem.startswith('spot-') else 1200 if png.stem.startswith('hero-') else 1600
    img = Image.open(png).convert('RGB')
    if img.width > width:
        img = img.resize((width, round(img.height * width / img.width)), Image.LANCZOS)
    if png.stem.startswith('spot-'):
        # Spots are painted on black: turn the black into see-through, fading in over the darkest shades so the
        # painting's soft edges stay soft. Colors are brightened back by the same amount (un-premultiplied).
        rgb = np.asarray(img).astype(np.float32)
        alpha = np.clip((rgb.max(axis=2) - 18) / 52, 0, 1)
        color = np.clip(rgb / np.maximum(alpha, 1 / 255)[..., None], 0, 255)
        img = Image.fromarray(np.dstack([color, alpha * 255]).round().astype(np.uint8), 'RGBA')
    dest = OUT / f'{png.stem}.webp'
    for quality in (82, 74, 66, 58, 50, 42):
        img.save(dest, 'WEBP', quality=quality, method=6)
        if dest.stat().st_size <= LIMIT:
            break
    print(f'{dest}  {img.width}x{img.height}  q{quality}  {dest.stat().st_size // 1024} KB')
