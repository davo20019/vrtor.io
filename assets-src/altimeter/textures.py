"""Textures: the printed dial face (metric) to parts/dial.png, spanning the 56 mm dial disc, and the webbing normal map.

Layout from spec.md: one revolution = 4000 m, minor ticks every 50 m below 1000 m and 100 m above, scale ring r = 17.4 mm, red 0 to 780 m, yellow 780 to 1000 m.
"""
import math
from pathlib import Path
from PIL import Image, ImageDraw, ImageFont

OUT = Path(__file__).parent / 'parts' / 'dial.png'
SS = 4                                # supersample, then shrink for clean edges
PX = 1024 * SS
DIAL_MM = 56.0
K = PX / DIAL_MM                      # pixels per mm
C = PX / 2

CREAM = (234, 237, 222)
INK = (22, 22, 22)
RED = (247, 92, 58)
YELLOW = (240, 238, 40)
RIM = (196, 198, 192)

FONT = '/System/Library/Fonts/Supplemental/Arial Bold.ttf'
FONT_REG = '/System/Library/Fonts/Supplemental/Arial.ttf'

def at(r_mm, metres):
    a = metres / 4000 * 2 * math.pi           # clockwise from 12 o'clock
    return C + r_mm * K * math.sin(a), C - r_mm * K * math.cos(a)

def tick(d, metres, r0, r1, w):
    d.line([at(r0, metres), at(r1, metres)], fill=INK, width=round(w * K))

img = Image.new('RGB', (PX, PX), RIM)
d = ImageDraw.Draw(img)
d.ellipse([C - 26.8 * K, C - 26.8 * K, C + 26.8 * K, C + 26.8 * K], fill=CREAM)   # outside: the lens' clear rim shows the seat

ring = 17.4
box = [C - ring * K, C - ring * K, C + ring * K, C + ring * K]
d.pieslice(box, -90, -90 + 780 / 4000 * 360, fill=RED)
d.pieslice(box, -90 + 780 / 4000 * 360, 0, fill=YELLOW)
d.ellipse(box, outline=INK, width=round(0.45 * K))

for m in list(range(0, 1000, 50)) + list(range(1000, 4000, 100)):   # 50 m steps below 1000 m
    if m % 500 == 0:
        tick(d, m, ring - 1.6, ring + 1.6, 0.75)
    else:
        tick(d, m, ring, ring + 1.3, 0.38)

big = ImageFont.truetype(FONT, round(5.6 * K))
small = ImageFont.truetype(FONT, round(3.6 * K))
for m in range(0, 4000, 500):
    label = str(m // 1000) if m % 1000 == 0 else f'{m / 1000:g}'
    font = big if m % 1000 == 0 else small
    r = 22.6 if m % 1000 == 0 else 22.4
    d.text(at(r, m), label, font=font, fill=INK, anchor='mm')

caption = ImageFont.truetype(FONT_REG, round(1.75 * K))
d.text((C - 5.6 * K, C - 8.6 * K), 'X1000', font=caption, fill=INK, anchor='mm')
d.text((C - 5.6 * K, C - 6.2 * K), 'METRES', font=caption, fill=INK, anchor='mm')

img.resize((PX // SS, PX // SS), Image.LANCZOS).save(OUT)
print('dial: wrote', OUT)

# Webbing: a tileable normal map of fine ribs running across the strap (one tile = 8 mm of strap).
import numpy as np
N = 256
v = np.arange(N) / N
ribs = np.sin(v * 2 * np.pi * 16)                       # 16 ribs per tile, 0.5 mm pitch
grain = np.random.default_rng(1).normal(0, 0.15, (N, N))
h = ribs[None, :] + grain                               # height, ribs vary along u (the strap's length)
dx = np.roll(h, -1, 1) - np.roll(h, 1, 1)
dy = np.roll(h, -1, 0) - np.roll(h, 1, 0)
n = np.dstack([-dx * 0.6, -dy * 0.6, np.ones_like(h)])
n /= np.linalg.norm(n, axis=2, keepdims=True)
Image.fromarray(((n * 0.5 + 0.5) * 255).astype(np.uint8)).save(OUT.parent / 'webbing_normal.png')
print('textures: wrote', OUT.parent / 'webbing_normal.png')
