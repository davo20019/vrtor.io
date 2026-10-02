"""The sand for /fly: Poly Haven's Coast Sand 02 (CC0, https://polyhaven.com/a/coast_sand_02),
1k, its colors lifted to pale Outer Banks sand. Babylon's standard material can't light a texture
brighter than its own colors, so the brightness has to be in the image.

Run: python3 scripts/prepare-flyer-sand.py   (needs Pillow and numpy)
Writes apps/fly/public/textures/coast_sand_02_{diff,nor_gl}_1k.jpg.
"""
import io
import urllib.request
from pathlib import Path

import numpy as np
from PIL import Image

OUT = Path(__file__).resolve().parent.parent / 'apps/fly/public/textures'
SRC = 'https://dl.polyhaven.org/file/ph-assets/Textures/jpg/1k/coast_sand_02/coast_sand_02_{}_1k.jpg'
# Average color of the result (sRGB 0..1), and how much of the texture's contrast to keep.
PALE_SAND = np.array([0.80, 0.75, 0.66])
CONTRAST = 0.75


def fetch(kind):
  return Image.open(io.BytesIO(urllib.request.urlopen(SRC.format(kind)).read())).convert('RGB')


OUT.mkdir(parents=True, exist_ok=True)
diff = np.asarray(fetch('diff')).astype(np.float32) / 255
mean = diff.reshape(-1, 3).mean(0)
pale = np.clip((diff - mean) * CONTRAST + PALE_SAND, 0, 1)
Image.fromarray((pale * 255).astype(np.uint8)).save(OUT / 'coast_sand_02_diff_1k.jpg', quality=82, optimize=True)
fetch('nor_gl').save(OUT / 'coast_sand_02_nor_gl_1k.jpg', quality=82, optimize=True)
print('wrote', sorted(p.name for p in OUT.iterdir()))
