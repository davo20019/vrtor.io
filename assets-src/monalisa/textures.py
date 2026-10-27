"""The painting's textures from the C2RMF scan, and the drawn textures for the wood, the keys and the frame.

In:  raw/c2rmf.jpg (fetch.sh), the public-domain C2RMF scan of the whole panel, 7854 x 11498.
Out: work/front_{4k,2k}_{color,normal}.png and work/front_2k_orm.png, the painted face straightened to the
     panel's rectangle (794 x 534 mm, Louvre); work/back_*.png, work/oak_*.png, work/walnut_color.png,
     work/canvas_color.png, work/gilt_*.png (drawn, see spec.md "Unknowns"); work/front.json with the corners
     found and the scan's scale.

The scan already shows the panel as the eye sees it under even light (the varnish's yellow included), so it is
the base colour as it is. The relief is inferred, not measured: the craquelure and wood grain are the scan's
fine dark lines, read as grooves.
"""
import json
from pathlib import Path

import cv2
import numpy as np
from PIL import Image

Image.MAX_IMAGE_PIXELS = None
HERE = Path(__file__).parent
WORK = HERE / 'work'
WORK.mkdir(exist_ok=True)
SPEC = json.loads((HERE / 'params.json').read_text())
H_MM, W_MM = SPEC['panel_h'], SPEC['panel_w']
RNG = np.random.default_rng(1503)


def save(name, a, mode=None):
    Image.fromarray(np.clip(a, 0, 255).astype(np.uint8), mode).save(WORK / name, optimize=False, compress_level=3)


# ---------------------------------------------------------------- the panel's corners in the scan

def edge_lines(img):
    """The panel's four edges as lines, from where the wood (R > B) meets the dark blue-grey cloth it lay on.
    Robust line fits over the middle of each edge; the corners themselves are worn, so they come from the lines."""
    h, w, _ = img.shape
    rb = cv2.blur(img[..., 0].astype(np.float32) - img[..., 2].astype(np.float32), (9, 9))
    m = rb > 10
    rows = np.arange(int(h * 0.05), int(h * 0.95), 40)
    cols = np.arange(int(w * 0.05), int(w * 0.95), 40)
    band = 600
    left = np.array([np.argmax(m[r, :band]) for r in rows])
    right = np.array([w - 1 - np.argmax(m[r, ::-1][:band]) for r in rows])
    top = np.array([np.argmax(m[:band, c]) for c in cols])
    bottom = np.array([h - 1 - np.argmax(m[::-1, c][:band]) for c in cols])

    def fit(x, y):
        ok = np.ones(len(x), bool)
        for _ in range(5):
            p = np.polyfit(x[ok], y[ok], 1)
            r = y - np.polyval(p, x)
            ok = np.abs(r) < np.median(np.abs(r[ok])) * 3 + 1
        return p, float(ok.mean())

    return {'left': fit(rows, left), 'right': fit(rows, right), 'top': fit(cols, top), 'bottom': fit(cols, bottom)}


def corners(lines):
    """Intersections: left/right are x = a*y + b, top/bottom are y = a*x + b."""
    def meet(v, hz):
        (a1, b1), (a2, b2) = v[0], hz[0]
        y = (a2 * b1 + b2) / (1 - a2 * a1)
        return [a1 * y + b1, y]
    L, R, T, B = lines['left'], lines['right'], lines['top'], lines['bottom']
    return np.float32([meet(L, T), meet(R, T), meet(R, B), meet(L, B)])


# ---------------------------------------------------------------- relief from the scan

def relief(color, px_per_mm):
    """Height (0..1, 1 = the varnish surface) and a crack mask from the scan's thin dark lines. Craquelure is
    0.05 to 0.3 mm wide; anything wider than about 1 mm is the painting itself, not relief."""
    lum = cv2.cvtColor(color, cv2.COLOR_RGB2GRAY).astype(np.float32) / 255.0
    lum = np.power(lum, 2.2)
    s_fine = max(0.6, 0.35 * px_per_mm)
    local = cv2.GaussianBlur(lum, (0, 0), 0.7 * px_per_mm)
    fine = cv2.GaussianBlur(lum, (0, 0), s_fine * 0.25)
    # How much darker than its surroundings, relative: a crack in a dark robe counts as much as one in the sky.
    dark = np.clip((local - fine) / (local + 0.02), 0, 1)
    cracks = np.clip(dark * 3.0, 0, 1)
    height = 1.0 - 0.8 * cracks
    # The islands between cracks are slightly cupped: a little lower in the middle than at their rims.
    rims = cv2.GaussianBlur(cracks, (0, 0), 0.5 * px_per_mm)
    height -= 0.15 * (1 - np.clip(rims * 4, 0, 1))
    return height.astype(np.float32), cracks.astype(np.float32)


def normal_map(height, depth_px):
    """Tangent-space normal map (glTF: +Y up in the image) from a height field. depth_px: the height range in
    pixels of the texture it is used with."""
    hh = height * depth_px
    dx = cv2.Sobel(hh, cv2.CV_32F, 1, 0, ksize=3) / 8.0
    dy = cv2.Sobel(hh, cv2.CV_32F, 0, 1, ksize=3) / 8.0
    n = np.dstack([-dx, dy, np.ones_like(hh)])
    n /= np.linalg.norm(n, axis=2, keepdims=True)
    return ((n * 0.5 + 0.5) * 255).astype(np.uint8)


def front():
    scan = np.asarray(Image.open(HERE / 'raw/c2rmf.jpg').convert('RGB'))
    half = cv2.resize(scan, (scan.shape[1] // 2, scan.shape[0] // 2), interpolation=cv2.INTER_AREA)
    lines = edge_lines(half)
    c = corners(lines) * 2
    top_px = np.hypot(*(c[1] - c[0])); bottom_px = np.hypot(*(c[2] - c[3]))
    left_px = np.hypot(*(c[3] - c[0])); right_px = np.hypot(*(c[2] - c[1]))
    px_w = (top_px + bottom_px) / 2; px_h = (left_px + right_px) / 2
    info = {
        'corners_px': c.round(1).tolist(),
        'fit_inliers': {k: round(v[1], 3) for k, v in lines.items()},
        'panel_px': [int(round(px_w)), int(round(px_h))],
        'px_per_mm_w': round(float(px_w) / W_MM, 3), 'px_per_mm_h': round(float(px_h) / H_MM, 3),
        'aspect_scan': round(float(px_w / px_h), 4), 'aspect_louvre': round(W_MM / H_MM, 4),
    }
    print('[textures] panel in scan', info)

    W, H = 4096, 6144
    dst = np.float32([[0, 0], [W, 0], [W, H], [0, H]])
    M = cv2.getPerspectiveTransform(c, dst)
    col = cv2.warpPerspective(scan, M, (W, H), flags=cv2.INTER_AREA, borderMode=cv2.BORDER_REPLICATE)
    del scan
    # The panel's edges are worn and not straight: where the cloth it lay on shows inside the rectangle, fill
    # it from the wood next to it. Only within 1.5 % of the edges.
    rb = col[..., 0].astype(np.int16) - col[..., 2].astype(np.int16)
    edge = np.zeros((H, W), bool)
    b = int(0.015 * W)
    edge[:b] = edge[-b:] = True; edge[:, :b] = edge[:, -b:] = True
    cloth = edge & (rb < 4) & (col.max(axis=2) < 70)
    cloth = cv2.dilate(cloth.astype(np.uint8), np.ones((5, 5), np.uint8))
    col = cv2.inpaint(col, cloth, 6, cv2.INPAINT_TELEA)
    info['cloth_filled_px'] = int(cloth.sum())

    px_mm = W / W_MM
    height, cracks = relief(col, px_mm)
    # Paint stops a few mm short of the edges, where the bare wood and the "barbe" are (spec.md); the margin
    # is matte and rougher.
    yy, xx = np.mgrid[0:H, 0:W].astype(np.float32)
    mm_x = xx / px_mm; mm_y = yy / px_mm
    m = SPEC['paint_margin_mm']
    inset = np.minimum.reduce([mm_x - m['left'], W_MM - mm_x - m['right'], mm_y - m['top'], H_MM - mm_y - m['bottom']])
    painted = np.clip(inset / 2.0 + 0.5, 0, 1)
    del xx, yy, mm_x, mm_y, inset
    # Aged varnish: glossy, a little uneven, rougher in the cracks.
    blotch = cv2.resize(RNG.random((48, 32)).astype(np.float32), (W // 2, H // 2), interpolation=cv2.INTER_CUBIC)
    rough = SPEC['varnish_roughness'] + 0.05 * (blotch - 0.5)
    rough = cv2.resize(rough, (W, H))
    rough = rough + 0.35 * cracks
    rough = painted * rough + (1 - painted) * SPEC['margin_roughness']
    # Bare wood is fibrous: deeper relief there.
    depth_px = SPEC['relief_depth_mm'] * px_mm * (painted + (1 - painted) * 2.5)

    for size, name in ((4096, '4k'), (2048, '2k')):
        s = size / W
        cc = col if s == 1 else cv2.resize(col, (size, int(H * s)), interpolation=cv2.INTER_AREA)
        save(f'front_{name}_color.png', cc)
        hh = height if s == 1 else cv2.resize(height, (size, int(H * s)), interpolation=cv2.INTER_AREA)
        dd = depth_px if s == 1 else cv2.resize(depth_px, (size, int(H * s))) * s
        save(f'front_{name}_normal.png', normal_map(hh, dd))
    r2 = cv2.resize(rough, (2048, 3072), interpolation=cv2.INTER_AREA)
    orm = np.dstack([np.full_like(r2, 1.0), r2, np.zeros_like(r2)]) * 255
    save('front_2k_orm.png', orm)
    save('front_512_color.png', cv2.resize(col, (512, 768), interpolation=cv2.INTER_AREA))
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


def grain(h, w, along_y=True, rings=40, wobble=0.04):
    """Long-grain wood: fine fibres along the grain plus wider growth bands, distorted a little."""
    if not along_y:
        return grain(w, h, True, rings, wobble).T.copy()
    fibres = cv2.resize(RNG.random((h // 24, w)).astype(np.float32), (w, h), interpolation=cv2.INTER_LINEAR)
    fibres = cv2.GaussianBlur(fibres, (0, 0), sigmaX=0.6, sigmaY=6)
    warp = fbm(h, w, 4, 3, (1, 1)) - 0.5
    x = np.linspace(0, 1, w, dtype=np.float32)[None, :] + wobble * warp
    bands = 0.5 + 0.5 * np.sin(2 * np.pi * rings * x + 3 * fbm(h, w, 3, 2, (4, 1)))
    bands = bands ** 3
    return (0.55 * fibres + 0.45 * bands).astype(np.float32)


def tint(v, dark, light):
    dark = np.float32(dark); light = np.float32(light)
    return dark[None, None] + (light - dark)[None, None] * v[..., None]


def back():
    """The back of the poplar panel, five centuries old: grey-brown, darkened, with the grain running down its
    length (vertical). 1024 x 1536 for 534 x 794 mm (0.52 mm/px)."""
    h, w = 1536, 1024
    g = grain(h, w, True, rings=26, wobble=0.06)
    stain = fbm(h, w, 5, 3)
    v = np.clip(0.35 * g + 0.45 * stain + 0.1 * RNG.random((h, w)).astype(np.float32), 0, 1)
    col = tint(v, (58, 44, 33), (128, 104, 80))
    save('back_color.png', col)
    save('back_normal.png', normal_map(cv2.GaussianBlur(g, (0, 0), 1.0), 2.0))
    # End and side grain for the panel's edges.
    eg = grain(256, 1024, False, rings=60, wobble=0.02)
    save('edge_color.png', tint(eg, (70, 52, 38), (135, 110, 84)))


def oak():
    h, w = 1024, 256
    g = grain(h, w, True, rings=18, wobble=0.08)
    rays = (RNG.random((h, w)) > 0.995).astype(np.float32)
    rays = cv2.GaussianBlur(cv2.dilate(rays, np.ones((9, 1))), (0, 0), 0.8)
    v = np.clip(0.75 * g + 0.25 * fbm(h, w, 4, 2) + 0.4 * rays, 0, 1)
    save('oak_color.png', tint(v, (92, 66, 40), (170, 132, 92)))
    save('oak_normal.png', normal_map(g, 2.5))


def walnut():
    h, w = 256, 512
    g = grain(h, w, False, rings=10, wobble=0.1)
    save('walnut_color.png', tint(g, (38, 24, 16), (92, 62, 40)))


def canvas():
    h = w = 256
    x = np.arange(w)[None, :]; y = np.arange(h)[:, None]
    weave = (0.5 + 0.5 * np.sin(x * 2 * np.pi / 6) * np.sin(y * 2 * np.pi / 6))
    v = 0.6 * weave + 0.4 * fbm(h, w, 3, 2)
    save('canvas_color.png', tint(v, (92, 78, 58), (150, 132, 102)))


def gilt():
    """The frame's gilding. The frieze is flat, as on the Italian "cassetta" frames of the 16th century, its gold
    worked with a punched pattern: rows of small rings between two bead mouldings. Not the real frame's ornament,
    which is not published (spec.md): a period-correct stand-in, kept quiet so it doesn't draw the eye. The gold is
    rubbed through to the red bole on the high points and dirt sits in the hollows. 2048 x 256, tiled along the
    frame (one bay per 256 px)."""
    h, w = 256, 2048
    yy, xx = np.mgrid[0:h, 0:w].astype(np.float32)
    hgt = np.zeros((h, w), np.float32)
    # Bead mouldings along both edges of the frieze.
    for cy in (14, h - 14):
        bead = np.cos(2 * np.pi * xx / 16) * 0.5 + 0.5
        hgt = np.maximum(hgt, np.exp(-((yy - cy) / 7) ** 2) * (0.6 + 0.4 * bead))
    # Punched rings, staggered, in three rows.
    for row, cy in enumerate((h * 0.3, h * 0.5, h * 0.7)):
        off = 16 if row % 2 else 0
        dx = ((xx + off) % 32) - 16
        r = np.hypot(dx, yy - cy)
        hgt -= 0.35 * np.exp(-((r - 5) / 1.4) ** 2)
    # Chasing: a faint fine texture all over, as the gold was burnished unevenly.
    hgt += 0.08 * fbm(h, w, 5, 8, (1, 8))
    hgt = cv2.GaussianBlur(hgt, (0, 0), 0.8)
    save('gilt_normal.png', normal_map(hgt, 3.0))
    rub = fbm(h, w, 4, 4, (1, 8))
    wear = np.clip((hgt - 0.55) * 4, 0, 1) * (rub > 0.6) * 0.8
    dirt = np.clip(-hgt * 1.5, 0, 1) * 0.5 + 0.12 * (1 - rub)
    gold = np.float32([190, 150, 84]); bole = np.float32([128, 66, 44]); grime = np.float32([74, 56, 34])
    col = gold[None, None] * (1 - wear[..., None]) + bole[None, None] * wear[..., None]
    col = col * (1 - dirt[..., None]) + grime[None, None] * dirt[..., None]
    save('gilt_color.png', col)
    metal = 1 - wear
    rough = 0.34 + 0.25 * dirt + 0.3 * wear
    save('gilt_orm.png', np.dstack([np.ones_like(rough), rough, metal]) * 255)
    # The plain parts of the moulding: smooth worn gilding.
    v = fbm(256, 256, 4, 3)
    save('giltplain_color.png', tint(v, (156, 120, 66), (200, 164, 100)))


if __name__ == '__main__':
    import sys
    if '--drawn' not in sys.argv:
        front()
    back(); oak(); walnut(); canvas(); gilt()
    print('[textures] done')
