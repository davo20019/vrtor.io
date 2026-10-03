"""Drawn textures to parts/: brushed-steel roughness, tyre tread and sidewall normal map, tonneau slat normal map.

Normal maps are drawn as height fields (PIL, supersampled) and converted with numpy. No wordmarks: the
tyre's sidewall lettering and the tailgate badge are left out.
"""
from pathlib import Path
import numpy as np
from PIL import Image, ImageDraw, ImageFilter

OUT = Path(__file__).parent / 'parts'
OUT.mkdir(exist_ok=True)
rng = np.random.default_rng(7)

def normal_from_height(h, strength):
    h = h.astype(np.float32) / 255.0
    gy, gx = np.gradient(h)
    n = np.dstack([-gx * strength, gy * strength, np.ones_like(h)])
    n /= np.linalg.norm(n, axis=2, keepdims=True)
    return Image.fromarray(((n * 0.5 + 0.5) * 255).astype(np.uint8))

# Brushed stainless: roughness with fine streaks along u (the truck's length in the body UVs).
W = 1024
base = rng.normal(0, 1, (W, 1)).repeat(W, 1)                          # one value per row: long streaks
fine = rng.normal(0, 1, (W, W // 32))                                 # shorter streaks, stretched along u
fine = np.array(Image.fromarray(((fine * 40 + 128).clip(0, 255)).astype(np.uint8)).resize((W, W), Image.BICUBIC)).astype(np.float32)
rough = 0.33 + 0.035 * base + 0.03 * (fine - 128) / 40
img = (rough.clip(0, 1) * 255).astype(np.uint8)
Image.fromarray(img).save(OUT / 'steel_rough.png')

# Tyre: 2048 x 512. v 0..0.6 is the tread across its width, 0.6..1 the sidewall from bead to shoulder.
TW, TH, SS = 2048, 512, 2
h = Image.new('L', (TW * SS, TH * SS), 60)
d = ImageDraw.Draw(h)
pitches = 64                                          # tread pitches round the tyre
pw = TW * SS / pitches
tread_h = int(0.6 * TH * SS)
for k in range(pitches):
    x = k * pw
    off = (pw * 0.5) if k % 2 else 0
    # shoulder blocks, two rows of centre blocks, staggered, with sipes
    for (v0, v1, dx) in ((0.00, 0.20, 0), (0.24, 0.47, off * 0.6), (0.53, 0.76, -off * 0.6), (0.80, 1.00, 0)):
        y0, y1 = v0 * tread_h, v1 * tread_h
        d.polygon([(x + dx + 4, y0), (x + dx + pw - 10, y0 + 6), (x + dx + pw - 14, y1), (x + dx, y1 - 6)], fill=200)
        d.line([(x + dx + pw * 0.45, y0 + 8), (x + dx + pw * 0.5, y1 - 8)], fill=120, width=3)
# sidewall: shoulder lugs near the tread (v 0.88..1.0), plain rubber towards the bead
for k in range(pitches // 2):
    x = k * 2 * pw
    d.rectangle([x + 6, int(0.90 * TH * SS), x + pw * 1.3, TH * SS], fill=150)
h = h.filter(ImageFilter.GaussianBlur(1.5)).resize((TW, TH), Image.LANCZOS)
normal_from_height(np.array(h), 6.0).save(OUT / 'tyre_normal.png')

# Tonneau: slats across the deck every ~ 1/8 of the tile.
S = 512
h = Image.new('L', (S * SS, S * SS), 180)
d = ImageDraw.Draw(h)
for k in range(8):
    y = k * S * SS / 8
    d.rectangle([0, y, S * SS, y + 10], fill=40)
h = h.filter(ImageFilter.GaussianBlur(2)).resize((S, S), Image.LANCZOS)
normal_from_height(np.array(h), 4.0).save(OUT / 'tonneau_normal.png')
print('textures: wrote steel_rough.png, tyre_normal.png, tonneau_normal.png')

# Centre screen (also used, smaller, on the rear screen): a vehicle panel on the left with the truck's
# outline drawn from its side profile, a map on the right, a dock along the bottom. No logos or wordmarks.
SW, SH = 1024, 576
img = Image.new('RGB', (SW * SS, SH * SS), (236, 237, 239))
d = ImageDraw.Draw(img)
k = SS
d.rectangle([int(0.40 * SW * k), 0, SW * k, SH * k], fill=(214, 220, 214))           # map
for i in range(14):                                                                 # streets
    y = int((i * 47 + 20) * k)
    d.line([(int(0.40 * SW * k), y), (SW * k, y + 60 * k)], fill=(250, 250, 250), width=6 * k)
for i in range(9):
    x = int((0.42 * SW + i * 70) * k)
    d.line([(x, 0), (x - 90 * k, SH * k)], fill=(250, 250, 250), width=5 * k)
d.line([(int(0.55 * SW * k), int(0.85 * SH * k)), (int(0.68 * SW * k), int(0.45 * SH * k)), (int(0.86 * SW * k), int(0.20 * SH * k))],
       fill=(60, 120, 240), width=14 * k)
d.ellipse([int(0.545 * SW * k) - 14 * k, int(0.85 * SH * k) - 14 * k, int(0.545 * SW * k) + 14 * k, int(0.85 * SH * k) + 14 * k], fill=(60, 120, 240))
# the truck in profile (our own outline: light bar, hood, apex, deck, tailgate), wheels below
prof = [(0.04, 0.55), (0.05, 0.47), (0.17, 0.40), (0.30, 0.30), (0.37, 0.36), (0.37, 0.50), (0.33, 0.56), (0.05, 0.57)]
d.polygon([(int(x * SW * k), int(y * SH * k)) for x, y in prof], fill=(200, 202, 206), outline=(120, 122, 126))
for x in (0.10, 0.31):
    cx, cy, r = int(x * SW * k), int(0.57 * SH * k), int(0.035 * SW * k)
    d.ellipse([cx - r, cy - r, cx + r, cy + r], fill=(60, 60, 64))
d.rectangle([0, int(0.88 * SH * k), SW * k, SH * k], fill=(250, 250, 251))           # dock
for i in range(9):
    x = int((0.12 + i * 0.09) * SW * k)
    d.rounded_rectangle([x, int(0.905 * SH * k), x + 38 * k, int(0.905 * SH * k) + 38 * k], radius=8 * k, fill=(190, 192, 196))
img.resize((SW, SH), Image.LANCZOS).save(OUT / 'screen.png')
print('textures: wrote screen.png')

# Cabin surfaces, all tiling over 250 mm (the cabin parts' first UV set, box-projected per face):
# pebbled leather on the seats and armrests, suede on the dash top, pillars and headliner, carpet on the floor.
def tiling_noise(size, cell, seed):
    """Smooth noise that wraps at the edges: random values on a grid of `cell` px, upsampled with wrap."""
    r = np.random.default_rng(seed)
    n = size // cell
    g = r.normal(0, 1, (n, n))
    g = np.tile(g, (3, 3))
    big = np.array(Image.fromarray(((g * 40 + 128).clip(0, 255)).astype(np.uint8)).resize((size * 3, size * 3), Image.BICUBIC), dtype=np.float32)
    return big[size:2 * size, size:2 * size] - 128

def normal_wrapped(h, strength):
    h = h.astype(np.float32) / 255.0
    gx = (np.roll(h, -1, 1) - np.roll(h, 1, 1)) / 2
    gy = (np.roll(h, -1, 0) - np.roll(h, 1, 0)) / 2
    n = np.dstack([-gx * strength, gy * strength, np.ones_like(h)])
    n /= np.linalg.norm(n, axis=2, keepdims=True)
    return Image.fromarray(((n * 0.5 + 0.5) * 255).astype(np.uint8))

C = 1024                                           # 4 px per mm over the 250 mm tile
# Leather: pebbles about 1.2 mm across with a softer 6 mm undulation.
peb = tiling_noise(C, 4, 11) + 0.5 * tiling_noise(C, 2, 12)
peb = np.sign(peb) * np.abs(peb) ** 0.7 * 6
leather = (128 + peb + 0.6 * tiling_noise(C, 32, 13)).clip(0, 255)
normal_wrapped(leather, 2.2).save(OUT / 'leather_normal.png')
# Suede: fine fibres, no pattern.
suede = (128 + 1.2 * tiling_noise(C, 2, 21) + 0.6 * tiling_noise(C, 8, 22)).clip(0, 255)
normal_wrapped(suede, 1.4).save(OUT / 'suede_normal.png')
# Carpet: loop pile, about 2 mm, deep.
pile = (128 + 2.5 * tiling_noise(C, 8, 31) + 1.5 * tiling_noise(C, 4, 32)).clip(0, 255)
normal_wrapped(pile, 4.0).save(OUT / 'carpet_normal.png')
print('textures: wrote leather_normal.png, suede_normal.png, carpet_normal.png')

# The dash shelf's weave (dgRcedIkNOM-14): a 2 x 2 basket of 4 mm blocks, threads 2 mm apart, alternating
# direction block by block, like carbon fibre. 16 px blocks divide the 1024 px tile, so it wraps cleanly.
yy, xx = np.mgrid[0:C, 0:C]
block = ((xx // 16) + (yy // 16)) % 2
along_x = 0.5 + 0.5 * np.cos(2 * np.pi * yy / 8)
along_y = 0.5 + 0.5 * np.cos(2 * np.pi * xx / 8)
weave = np.where(block == 0, along_x, along_y) * 70 + 90 + 0.4 * tiling_noise(C, 4, 41)
normal_wrapped(weave.clip(0, 255), 2.0).save(OUT / 'weave_normal.png')
print('textures: wrote weave_normal.png')
