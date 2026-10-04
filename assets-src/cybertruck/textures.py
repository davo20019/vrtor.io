"""Drawn textures to parts/: brushed-steel roughness, tyre tread and sidewall normal map, tonneau slat normal map.

Normal maps are drawn as height fields (PIL, supersampled) and converted with numpy. No wordmarks: the
tyre's sidewall lettering and the tailgate badge are left out.
"""
from pathlib import Path
import numpy as np
from PIL import Image, ImageDraw, ImageFilter, ImageFont

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
rough = 0.33 + 0.012 * base + 0.01 * (fine - 128) / 40      # faint: stronger streaks read as wood grain from a few metres; the real grain only shows up close
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
# Bed floor: raised ribs along the truck, 9 to the 800 mm tile (~89 mm apart: 14 across the manual's top view).
h = Image.new('L', (S * SS, S * SS), 90)
d = ImageDraw.Draw(h)
for k in range(9):
    y = k * S * SS / 9
    d.rectangle([0, y + 8, S * SS, y + S * SS / 9 * 0.45], fill=200)
h = h.filter(ImageFilter.GaussianBlur(3)).resize((S, S), Image.LANCZOS)
normal_from_height(np.array(h), 4.0).save(OUT / 'bedfloor_normal.png')
print('textures: wrote steel_rough.png, tyre_normal.png, tonneau_normal.png, bedfloor_normal.png')

# The bed's outlet plate (manual, Cargo Bed Outlets): two 120 V 20 A outlets (NEMA 5-20: one T slot, one
# straight, a round ground) over one 240 V outlet (NEMA 14-50: a straight slot either side, the neutral
# across the top, a round ground), light grey faces on a dark plate. 256 x 512, top of the plate at the top.
OW, OH = 256, 512
img = Image.new('RGB', (OW * SS, OH * SS), (40, 40, 42))
d = ImageDraw.Draw(img)
k = SS
def face(cx, cy, w, h):
    d.rounded_rectangle([(cx - w / 2) * k, (cy - h / 2) * k, (cx + w / 2) * k, (cy + h / 2) * k], radius=14 * k, fill=(196, 196, 192))
def slot(cx, cy, w, h):
    d.rectangle([(cx - w / 2) * k, (cy - h / 2) * k, (cx + w / 2) * k, (cy + h / 2) * k], fill=(22, 22, 24))
for cy in (100, 215):                                   # NEMA 5-20
    face(128, cy, 120, 100)
    slot(100, cy - 12, 8, 34); slot(156, cy - 12, 8, 34); slot(148, cy - 12, 24, 8)
    d.ellipse([(128 - 12) * k, (cy + 18) * k, (128 + 12) * k, (cy + 42) * k], fill=(22, 22, 24))
d.ellipse([(128 - 74) * k, (380 - 74) * k, (128 + 74) * k, (380 + 74) * k], fill=(196, 196, 192))   # NEMA 14-50
slot(86, 362, 10, 46); slot(170, 362, 10, 46); slot(128, 340, 34, 10)
d.ellipse([(128 - 14) * k, (402 - 14) * k, (128 + 14) * k, (402 + 14) * k], fill=(22, 22, 24))
img.resize((OW, OH), Image.LANCZOS).save(OUT / 'outlets.png')
print('textures: wrote outlets.png')

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
# Carpet: a fine, even cut pile under 1 mm (dgRcedIkNOM-25: smooth at arm's length, no pebbling).
pile = (128 + 1.6 * tiling_noise(C, 2, 31) + 0.8 * tiling_noise(C, 4, 32)).clip(0, 255)
normal_wrapped(pile, 2.0).save(OUT / 'carpet_normal.png')
# The mats: a denser velour, finer and flatter than the carpet round them.
velour = (128 + 1.2 * tiling_noise(C, 2, 33) + 0.3 * tiling_noise(C, 16, 34)).clip(0, 255)
normal_wrapped(velour, 1.4).save(OUT / 'mat_normal.png')
print('textures: wrote leather_normal.png, suede_normal.png, carpet_normal.png, mat_normal.png')

# The dash shelf's weave (dgRcedIkNOM-14): a 2 x 2 basket of 4 mm blocks, threads 2 mm apart, alternating
# direction block by block, like carbon fibre. 16 px blocks divide the 1024 px tile, so it wraps cleanly.
yy, xx = np.mgrid[0:C, 0:C]
block = ((xx // 16) + (yy // 16)) % 2
along_x = 0.5 + 0.5 * np.cos(2 * np.pi * yy / 8)
along_y = 0.5 + 0.5 * np.cos(2 * np.pi * xx / 8)
weave = np.where(block == 0, along_x, along_y) * 70 + 90 + 0.4 * tiling_noise(C, 4, 41)
normal_wrapped(weave.clip(0, 255), 2.0).save(OUT / 'weave_normal.png')
print('textures: wrote weave_normal.png')

# The yoke's button pods (manual, Steering: the left and right scroll button pictures, E2AF1DEC straight on):
# light grey symbols printed on the dark pods, placed on a 10 mm grid over the straight-on render. The
# texture spans x -130..130, y -20..45 mm in the yoke's frame (cad.py yoke_decal: driver's view, x to the
# right), 2048 x 512, so 7.88 px/mm. Left pod: right and left turn signals with a line between them, high
# beam, the four-way icon. Right pod: the custom button (hexagon), the gauge, wipers, a line, voice. Dark
# rings round both scroll wheels.
YW, YH = 2048, 512
k = YW / 260 * SS                                        # px per mm, supersampled
img = Image.new('RGB', (YW * SS, YH * SS), (30, 30, 32))
d = ImageDraw.Draw(img)
ink, lw = (165, 165, 168), max(1, round(0.35 * k))
def P(x, y):                                             # yoke mm -> pixel
    return ((x + 130) * k, (45 - y) * k)
def line(pts, w=lw):
    d.line([P(*q) for q in pts], fill=ink, width=w, joint='curve')
def arrow(cx, cy, s):                                    # outlined turn-signal arrow pointing toward s (+1 right)
    pts = [(-2.2, 0.8), (0.2, 0.8), (0.2, 1.9), (2.4, 0), (0.2, -1.9), (0.2, -0.8), (-2.2, -0.8), (-2.2, 0.8)]
    line([(cx + s * x, cy + y) for x, y in pts])
def high_beam(cx, cy):                                   # D lamp with three beams to its left
    d.chord([P(cx - 0.6, cy + 1.7), P(cx + 2.8, cy - 1.7)], 270, 90, outline=ink, width=lw)
    line([(cx + 1.1, cy + 1.7), (cx + 1.1, cy - 1.7)])
    for dy in (-1.2, 0, 1.2):
        line([(cx - 2.6, cy + dy), (cx - 0.4, cy + dy)])
def four_way(cx, cy):                                    # four small arrowheads round a dot
    r = lw / k * 1.4
    d.ellipse([P(cx - r, cy + r), P(cx + r, cy - r)], fill=ink)
    for ax, ay in ((1, 0), (-1, 0), (0, 1), (0, -1)):
        tip = (cx + ax * 2.3, cy + ay * 2.3)
        b1 = (cx + ax * 1.3 - ay * 0.8, cy + ay * 1.3 + ax * 0.8)
        b2 = (cx + ax * 1.3 + ay * 0.8, cy + ay * 1.3 - ax * 0.8)
        d.polygon([P(*tip), P(*b1), P(*b2)], fill=ink)
def hexagon(cx, cy):
    import math as m
    line([(cx + 2.0 * m.cos(m.radians(30 + 60 * i)), cy + 2.0 * m.sin(m.radians(30 + 60 * i))) for i in range(7)])
    d.ellipse([P(cx - 0.8, cy + 0.8), P(cx + 0.8, cy - 0.8)], outline=ink, width=lw)
def gauge(cx, cy):                                       # dial arc open at the bottom, needle up and right
    d.arc([P(cx - 2.1, cy + 2.1), P(cx + 2.1, cy - 2.1)], 135, 45, fill=ink, width=lw)
    line([(cx, cy), (cx + 1.1, cy + 1.1)])
def wiper(cx, cy):                                       # windscreen, the blade across it, spray above
    d.arc([P(cx - 2.6, cy + 1.4), P(cx + 2.6, cy - 3.8)], 200, 340, fill=ink, width=lw)
    line([(cx - 2.4, cy - 1.6), (cx + 2.4, cy - 1.6)])
    line([(cx, cy - 1.6), (cx + 1.4, cy + 0.9)])
    for dx in (-1.6, -0.5, 0.6, 1.7):
        d.ellipse([P(cx + dx - 0.25, cy + 2.2), P(cx + dx + 0.25, cy + 1.7)], fill=ink)
def mic(cx, cy):
    d.rounded_rectangle([P(cx - 0.8, cy + 2.4), P(cx + 0.8, cy - 0.3)], radius=0.8 * k, outline=ink, width=lw)
    d.arc([P(cx - 1.6, cy + 1.6), P(cx + 1.6, cy - 1.4)], 0, 180, fill=ink, width=lw)
    line([(cx, cy - 1.4), (cx, cy - 2.3)])
    line([(cx - 0.9, cy - 2.3), (cx + 0.9, cy - 2.3)])
for sx in (-1, 1):                                       # rings round the scroll wheels
    cx, cy = sx * 85.2, 16.0
    d.ellipse([P(cx - 9.2, cy + 9.2), P(cx + 9.2, cy - 9.2)], fill=(14, 14, 15))
    line([(sx * 104 - 5.5, 17.7), (sx * 104 + 5.5, 17.7)], w=round(0.9 * k))
arrow(-98.1, 25.3, 1); arrow(-104.0, 9.8, -1); high_beam(-74.2, 27.8); four_way(-71.2, 14.3)
hexagon(74.2, 27.8); gauge(71.2, 14.3); wiper(98.1, 25.3); mic(104.0, 9.8)
img.resize((YW, YH), Image.LANCZOS).save(OUT / 'yoke_icons.png')
print('textures: wrote yoke_icons.png')

# The licence plate: Virginia's standard design (the DMV's specimen, Commons "Virginia 2016 License Plate.jpg",
# public domain), personalised BELLA, 305 x 152 (4 px/mm). White with an embossed rim; VIRGINIA in blue serif
# capitals across the top; the characters tall condensed blue serifs, embossed; the tourism line and Virginia.org
# under them. No decals: Virginia stopped issuing them in 2017. Fonts are macOS's, drawn to the specimen's
# proportions (fractions of the plate below).
PLATE_TEXT = 'BELLA'
PW, PH, SS = 1220, 610, 2
W2, H2 = PW * SS, PH * SS
FONTS = Path('/System/Library/Fonts')
img = Image.new('RGB', (W2, H2), (240, 242, 244))
d = ImageDraw.Draw(img)
BLUE, INK, RED = (30, 72, 158), (26, 26, 28), (200, 24, 40)
d.rounded_rectangle([0.012 * W2, 0.022 * H2, 0.988 * W2, 0.978 * H2], radius=0.03 * H2, outline=(214, 216, 220), width=int(0.008 * H2))

def mask(text, font):
    g = Image.new('L', (font.size * (len(text) + 2), font.size * 2))
    ImageDraw.Draw(g).text((font.size // 2, font.size // 4), text, font=font, fill=255)
    return g.crop(g.getbbox())

def line(text, font, box, color):
    """A line of text fitted into box (x0, y0, x1, y1, fractions), centred; returns its pixel box."""
    m = mask(text, font)
    x0, y0, x1, y1 = box[0] * W2, box[1] * H2, box[2] * W2, box[3] * H2
    k = min((x1 - x0) / m.width, (y1 - y0) / m.height)
    m = m.resize((round(m.width * k), round(m.height * k)), Image.LANCZOS)
    at = (round((x0 + x1 - m.width) / 2), round(y1 - m.height))
    img.paste(color, at, m)
    return at[0], at[1], m.width, m.height, k

def characters(text, font, box, color, squeeze, gap, emboss):
    """The registration: each character its own glyph, the box's height, narrowed by squeeze (the plate's die
    is a condensed serif), spaced by gap and centred; pressed in, so a soft shadow under and right of each."""
    x0, y0, x1, y1 = box[0] * W2, box[1] * H2, box[2] * W2, box[3] * H2
    h = y1 - y0
    ms = [mask(ch, font) for ch in text]
    ws = [m.width * h / m.height * squeeze for m in ms]
    x = (x0 + x1) / 2 - (sum(ws) + gap * W2 * (len(ms) - 1)) / 2
    for m, w in zip(ms, ws):
        m = m.resize((round(w), round(h)), Image.LANCZOS)
        sh = m.filter(ImageFilter.GaussianBlur(emboss * 0.6))
        img.paste((150, 152, 158), (round(x + emboss), round(y0 + emboss)), sh)
        img.paste(color, (round(x), round(y0)), m)
        x += w + gap * W2

serif = ImageFont.truetype(str(FONTS / 'Supplemental' / 'Times New Roman Bold.ttf'), 300)
line("VIRGINIA", serif, (0.27, 0.10, 0.73, 0.235), BLUE)
characters(PLATE_TEXT, serif, (0.06, 0.30, 0.94, 0.75), BLUE, squeeze=0.43, gap=0.02, emboss=0.006 * H2)
sans = ImageFont.truetype(str(FONTS / 'Supplemental' / 'GillSans.ttc'), 200, index=4)
slogan = 'VIRGINIA IS FOR LOVERS'
x, y, w, h, k = line(slogan, sans, (0.25, 0.80, 0.75, 0.855), INK)
# the O of LOVERS is a red heart
pre = sans.getbbox('VIRGINIA IS FOR L')[2] - sans.getbbox('V')[0]
o = sans.getbbox('O')
ox0, ox1 = x + pre * k, x + (pre + o[2] - o[0]) * k + 4
d.rectangle([ox0, y - 2, ox1, y + h + 2], fill=(240, 242, 244))
hx, hy, hr = (ox0 + ox1) / 2, y + h * 0.5, h * 0.5
d.ellipse([hx - hr, hy - hr, hx, hy], fill=RED)
d.ellipse([hx, hy - hr, hx + hr, hy], fill=RED)
d.polygon([(hx - hr * 0.98, hy - hr * 0.42), (hx + hr * 0.98, hy - hr * 0.42), (hx, hy + hr * 1.0)], fill=RED)
line('Virginia.org', ImageFont.truetype(str(FONTS / 'Supplemental' / 'GillSans.ttc'), 200, index=0), (0.585, 0.875, 0.745, 0.93), INK)
for fx, fy in ((0.21, 0.12), (0.79, 0.12), (0.21, 0.875), (0.79, 0.875)):         # the mounting screws
    r = 0.022 * H2
    d.ellipse([fx * W2 - r, fy * H2 - r, fx * W2 + r, fy * H2 + r], fill=(120, 122, 126), outline=(90, 92, 96), width=3)
img.resize((PW, PH), Image.LANCZOS).save(OUT / 'plate.png')
print('textures: wrote plate.png')
