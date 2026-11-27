"""Shrinks the Codex PNGs in art-src/ into the WebP files the site loads, in public/art/.

    python scripts/art-webp.py

Backgrounds (bg-*) become 1600 px wide and accents (hero-*) 1200 px wide, each squeezed until it's under
150 KB. Needs Pillow (pip install pillow).
"""
from pathlib import Path

from PIL import Image

SRC = Path('art-src')
OUT = Path('public/art')
LIMIT = 150 * 1024
OUT.mkdir(parents=True, exist_ok=True)

for png in sorted(SRC.glob('*.png')):
    width = 1600 if png.stem.startswith('bg-') else 1200
    img = Image.open(png).convert('RGB')
    if img.width > width:
        img = img.resize((width, round(img.height * width / img.width)), Image.LANCZOS)
    dest = OUT / f'{png.stem}.webp'
    for quality in (82, 74, 66, 58, 50, 42):
        img.save(dest, 'WEBP', quality=quality, method=6)
        if dest.stat().st_size <= LIMIT:
            break
    print(f'{dest}  {img.width}x{img.height}  q{quality}  {dest.stat().st_size // 1024} KB')
