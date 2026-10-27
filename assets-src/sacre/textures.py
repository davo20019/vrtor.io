"""The painting's textures from the photograph of the whole canvas, and the drawn textures for the lining, the
stretcher and the frame.

In:  raw/sacre.jpg (fetch.sh), a straight-on photograph of the painting inside its frame, 11058 x 6874,
     public domain (refs/SOURCES.md).
Out: work/tile_<row><col>_{4k,1k,512}.png, the painted face cut into tiles_y x tiles_x tiles over the frame's sight
     opening (the canvas, 6210 x 9790 mm, Louvre, less the rebate); work/tile_<row><col>_normal.png, the seam's
     ridge; work/weave_detail.png, the canvas weave as a Babylon detail map; work/lining_*.png, work/pine_*.png,
     work/gilt*.png, work/egg_*.png, work/leaf_*.png, work/plaque_color.png (drawn, see spec.md "Unknowns");
     work/front.json with the scales.

The photograph already shows the painting as the eye sees it in its room, varnish included, so it is the base
colour as it is. It covers the sight opening exactly (checked against two other photographs, spec.md); its own
ratio is 1.609 against the sight's 1.580, so it is stretched 1.8 % taller to the published size.
"""
import json
from pathlib import Path

import cv2
import numpy as np
from PIL import Image, ImageDraw, ImageFont

Image.MAX_IMAGE_PIXELS = None
HERE = Path(__file__).parent
WORK = HERE / 'work'
WORK.mkdir(exist_ok=True)
P = json.loads((HERE / 'params.json').read_text())
SIGHT_W = P['canvas_w'] - 2 * P['rebate']
SIGHT_H = P['canvas_h'] - 2 * P['rebate']
RNG = np.random.default_rng(1804)


def save(name, a, mode=None):
    Image.fromarray(np.clip(a, 0, 255).astype(np.uint8), mode).save(WORK / name, optimize=False, compress_level=3)


def normal_map(height, depth_px):
    """Tangent-space normal map (glTF: +Y up in the image) from a height field; depth_px is the height range in
    pixels of the texture it is used with."""
    hh = height * depth_px
    dx = cv2.Sobel(hh, cv2.CV_32F, 1, 0, ksize=3) / 8.0
    dy = cv2.Sobel(hh, cv2.CV_32F, 0, 1, ksize=3) / 8.0
    n = np.dstack([-dx, dy, np.ones_like(hh)])
    n /= np.linalg.norm(n, axis=2, keepdims=True)
    return ((n * 0.5 + 0.5) * 255).astype(np.uint8)


# ---------------------------------------------------------------- the painted face

def front():
    photo = np.asarray(Image.open(HERE / 'raw/sacre.jpg').convert('RGB'))
    ph, pw = photo.shape[:2]
    nx, ny = P['tiles_x'], P['tiles_y']
    info = {
        'photo_px': [pw, ph], 'sight_mm': [SIGHT_W, SIGHT_H],
        'aspect_photo': round(pw / ph, 4), 'aspect_sight': round(SIGHT_W / SIGHT_H, 4),
        'px_per_mm_photo': [round(pw / SIGHT_W, 4), round(ph / SIGHT_H, 4)],
        'mm_per_px_4k': [round(SIGHT_W / nx / 4096, 3), round(SIGHT_H / ny / 4096, 3)],
        'tiles': [ny, nx],
    }
    print('[textures]', info)
    # The seam between the two widths of canvas: a horizontal line found across the whole photo (spec.md), sewn
    # flat, a low ridge on the front.
    seam_y = P['seam_from_top'] * SIGHT_H
    for r in range(ny):
        for c in range(nx):
            x0, x1 = pw * c / nx, pw * (c + 1) / nx
            y0, y1 = ph * r / ny, ph * (r + 1) / ny
            # A tile's own pixels plus a 2 px apron from its neighbours, so the tiles meet without a seam of their own.
            pad = 2
            ax0, ax1 = max(0, int(x0) - pad), min(pw, int(np.ceil(x1)) + pad)
            ay0, ay1 = max(0, int(y0) - pad), min(ph, int(np.ceil(y1)) + pad)
            crop = photo[ay0:ay1, ax0:ax1]
            # Map exactly [x0, x1] x [y0, y1] of the photo onto 4096 x 4096.
            S = 4096
            sx = S / (x1 - x0); sy = S / (y1 - y0)
            M = np.float32([[sx, 0, -(x0 - ax0) * sx], [0, sy, -(y0 - ay0) * sy]])
            tile = cv2.warpAffine(crop, M, (S, S), flags=cv2.INTER_LANCZOS4, borderMode=cv2.BORDER_REPLICATE)
            key = f'{r}{c}'
            save(f'tile_{key}_4k.png', tile)
            save(f'tile_{key}_1k.png', cv2.resize(tile, (1024, 1024), interpolation=cv2.INTER_AREA))
            save(f'tile_{key}_512.png', cv2.resize(tile, (512, 512), interpolation=cv2.INTER_AREA))
            # Normal: flat but for the seam where it crosses the tile. 2048 px over a tile.
            N = 2048
            tile_h_mm = SIGHT_H / ny
            mm_px = tile_h_mm / N
            # The seam wanders a little along its length, as sewn.
            wob = cv2.resize(RNG.random((1, 64)).astype(np.float32), (N, 1), interpolation=cv2.INTER_CUBIC)[0]
            shift = (wob - 0.5) * 3 / mm_px
            yi = np.arange(N, dtype=np.float32)[:, None] - shift[None, :]
            dd = ((yi + 0.5) * mm_px + r * tile_h_mm - seam_y) / (P['seam_width_mm'] / 2)
            h = np.exp(-dd * dd * 2).astype(np.float32)
            save(f'tile_{key}_normal.png', normal_map(h, P['seam_ridge_mm'] / mm_px))
            del tile
    (WORK / 'front.json').write_text(json.dumps(info, indent=1))


# ---------------------------------------------------------------- drawn textures

def fbm(h, w, octaves=5, base=4, aspect=(1, 1)):
    out = np.zeros((h, w), np.float32)
    amp = 1.0
    for o in range(octaves):
        gh, gw = max(2, int(base * aspect[0] * 2 ** o)), max(2, int(base * aspect[1] * 2 ** o))
        n = RNG.random((gh, gw)).astype(np.float32)
        out += amp * cv2.resize(n, (w, h), interpolation=cv2.INTER_CUBIC)
        amp *= 0.5
    out -= out.min(); out /= out.max()
    return out


def tint(v, dark, light):
    dark = np.float32(dark); light = np.float32(light)
    return dark[None, None] + (light - dark)[None, None] * v[..., None]


def weave_height(n_threads, px_per_thread):
    """Plain weave: warp and weft over and under each other, each thread a little uneven in thickness."""
    S = n_threads * px_per_thread
    t = (np.arange(S, dtype=np.float32) + 0.5) / px_per_thread
    x = t[None, :]; y = t[:, None]
    ix = np.floor(x).astype(int); iy = np.floor(y).astype(int)
    over = ((ix + iy) % 2 == 0)
    fx = x - ix; fy = y - iy
    warp = np.sin(np.pi * fx)          # a vertical thread's cross-section
    weft = np.sin(np.pi * fy)
    thick_x = 0.8 + 0.4 * RNG.random(n_threads).astype(np.float32)
    thick_y = 0.8 + 0.4 * RNG.random(n_threads).astype(np.float32)
    warp = warp * thick_x[ix % n_threads] * (0.6 + 0.4 * np.sin(np.pi * fy))
    weft = weft * thick_y[iy % n_threads] * (0.6 + 0.4 * np.sin(np.pi * fx))
    return np.where(over, np.maximum(warp, 0.7 * weft), np.maximum(weft, 0.7 * warp)).astype(np.float32)


def weave():
    """The canvas weave under the paint, as a Babylon detail map tiled at one repeat per 32 threads (1 mm each,
    estimated). Channels: R albedo (0.5 = none), G normal y, B roughness (0.5 = none), A normal x. The paint fills
    the weave, so it shows as a gentle relief, mostly under raking light."""
    h = weave_height(32, 16)
    h = cv2.GaussianBlur(h, (0, 0), 1.2)
    n = normal_map(h, 1.2)
    S = h.shape[0]
    alb = 128 + (h - h.mean()) * 10
    rgba = np.dstack([alb, n[..., 1], np.full((S, S), 128, np.float32), n[..., 0]])
    save('weave_detail.png', rgba, 'RGBA')


def lining():
    """The back: the relining canvas, unpainted linen gone brown with age and glue. Also the tacking margins."""
    h = weave_height(64, 8)
    v = 0.55 * h + 0.45 * fbm(512, 512, 5, 3)
    save('lining_color.png', tint(v, (96, 76, 52), (160, 136, 100)))
    save('lining_normal.png', normal_map(h, 1.5))


def grain(h, w, rings=40, wobble=0.04):
    fibres = cv2.resize(RNG.random((h // 24, w)).astype(np.float32), (w, h), interpolation=cv2.INTER_LINEAR)
    fibres = cv2.GaussianBlur(fibres, (0, 0), sigmaX=0.6, sigmaY=6)
    warp = fbm(h, w, 4, 3) - 0.5
    x = np.linspace(0, 1, w, dtype=np.float32)[None, :] + wobble * warp
    bands = (0.5 + 0.5 * np.sin(2 * np.pi * rings * x + 3 * fbm(h, w, 3, 2, (4, 1)))) ** 3
    return (0.55 * fibres + 0.45 * bands).astype(np.float32)


def pine():
    """The stretcher: softwood, two centuries old, dark at the surface."""
    g = grain(1024, 256, rings=14, wobble=0.1)
    knots = np.zeros((1024, 256), np.float32)
    for _ in range(3):
        cy, cx = RNG.integers(100, 924), RNG.integers(40, 216)
        yy, xx = np.mgrid[0:1024, 0:256]
        knots += np.exp(-(((yy - cy) / 18.0) ** 2 + ((xx - cx) / 10.0) ** 2))
    v = np.clip(0.7 * g + 0.3 * fbm(1024, 256, 4, 2) - 0.5 * knots, 0, 1)
    save('pine_color.png', tint(v, (84, 60, 36), (158, 124, 84)))
    save('pine_normal.png', normal_map(g, 2.0))


GOLD = np.float32([196, 156, 86]); BOLE = np.float32([140, 74, 48]); GRIME = np.float32([80, 60, 36])


def gilded(name, hgt, along):
    """Colour, normal and ORM for a gilded band from its height field (0..1): the gold rubbed to the red bole on the
    high points, dirt in the hollows."""
    h, w = hgt.shape
    rub = fbm(h, w, 4, 4, (1, along))
    wear = np.clip((hgt - 0.75) * 4, 0, 1) * (rub > 0.62) * 0.7
    dirt = np.clip((0.35 - hgt) * 1.6, 0, 1) * 0.55 + 0.08 * (1 - rub)
    col = GOLD[None, None] * (1 - wear[..., None]) + BOLE[None, None] * wear[..., None]
    col = col * (1 - dirt[..., None]) + GRIME[None, None] * dirt[..., None]
    save(f'{name}_color.png', col)
    save(f'{name}_normal.png', normal_map(hgt, 6.0))
    rough = 0.3 + 0.3 * dirt + 0.3 * wear
    save(f'{name}_orm.png', np.dstack([np.ones_like(rough), rough, 1 - wear]) * 255)


def egg():
    """The outer ovolo: egg-and-dart, one egg per repeat (85 mm, estimated from the photographs). 256 across one
    repeat, 256 across the band; v = 0 at the band's inner edge."""
    S = 256
    yy, xx = np.mgrid[0:S, 0:S].astype(np.float32)
    u = xx / S - 0.5; v = yy / S - 0.5
    shell = np.clip(1 - ((u / 0.40) ** 2 + (v / 0.46) ** 2), 0, 1)            # the cup round the egg
    eggh = np.sqrt(np.clip(1 - ((u / 0.30) ** 2 + (v / 0.38) ** 2), 0, 1))     # the egg itself, domed
    rim = np.clip(1 - np.abs(np.hypot(u / 0.40, v / 0.46) - 0.88) * 9, 0, 1)
    dart = np.clip(1 - np.abs(np.abs(u) - 0.5) * 18, 0, 1) * np.clip(1 - np.abs(v) * 2.4, 0, 1)
    hgt = 0.25 + 0.55 * eggh + 0.25 * rim + 0.35 * dart - 0.25 * (shell > 0) * (eggh == 0)
    band = np.clip(1 - np.abs(v) * 2.2, 0, 1)
    hgt = hgt * (0.5 + 0.5 * band) + 0.05 * fbm(S, S, 4, 6)
    gilded('egg', cv2.GaussianBlur(hgt.astype(np.float32), (0, 0), 1.2), 1)


def leaf():
    """The sight edge: a band of water leaves, one leaf per repeat (42 mm, estimated)."""
    S = 256
    yy, xx = np.mgrid[0:S, 0:S].astype(np.float32)
    u = xx / S - 0.5; v = yy / S
    width = 0.42 * np.sin(np.pi * np.clip(v, 0, 1)) ** 0.6
    leafm = np.clip(1 - np.abs(u) / (width + 1e-3), 0, 1)
    rib = np.clip(1 - np.abs(u) * 30, 0, 1) * (v > 0.1) * (v < 0.9)
    hgt = 0.15 + 0.55 * np.sqrt(leafm) + 0.08 * rib + 0.05 * fbm(S, S, 4, 6)
    gilded('leaf', cv2.GaussianBlur(hgt.astype(np.float32), (0, 0), 1.0), 1)


def gilt_plain():
    """The flat frieze and the plain mouldings: smooth, worn gilding with faint brush marks of the gesso."""
    h = 0.5 + 0.08 * fbm(256, 256, 5, 3, (1, 6))
    gilded('giltplain', h.astype(np.float32), 6)


def plaque():
    """The museum's name plaque on the frame's bottom rail, as photographed (refs: cc0_room.jpg): two lines,
    engraved and filled dark, on a gilt plate with clipped corners. 2048 x 272 for 830 x 110 mm."""
    W, H = 2048, 272
    img = Image.new('RGB', (W, H), (208, 172, 104))
    d = ImageDraw.Draw(img)
    fonts = Path('/System/Library/Fonts/Supplemental')
    face = lambda name, size: ImageFont.truetype(str(fonts / name), size) if (fonts / name).exists() else ImageFont.load_default()
    # Upright capitals and lining figures, as on the plate.
    big = face('Times New Roman Bold.ttf', 112)
    mid = face('Times New Roman.ttf', 66)
    small = face('Times New Roman.ttf', 48)
    ink = (58, 40, 26)
    line1 = [('DAVID', big), (' (Jacques-Louis) 1748-1825', mid)]
    widths = [d.textlength(t, font=f) for t, f in line1]
    x = (W - sum(widths)) / 2
    for (t, f), wdt in zip(line1, widths):
        d.text((x, 150), t, font=f, fill=ink, anchor='ls')
        x += wdt
    line2 = 'SACRE de NAPOLÉON Ier à NOTRE-DAME de PARIS par le PAPE PIE VII'
    d.text((W / 2, 238), line2, font=small, fill=ink, anchor='ms')
    a = np.asarray(img).astype(np.float32)
    a = a * (0.92 + 0.08 * fbm(H, W, 4, 3, (1, 8)))[..., None]
    # Two screws.
    for sx in (90, W - 90):
        yy, xx = np.mgrid[0:H, 0:W]
        m = ((xx - sx) ** 2 + (yy - H / 2) ** 2) < 11 ** 2
        a[m] = (70, 52, 30)
    save('plaque_color.png', a)


if __name__ == '__main__':
    import sys
    if '--drawn' not in sys.argv:
        front()
    weave(); lining(); pine(); egg(); leaf(); gilt_plain(); plaque()
    print('[textures] done')
