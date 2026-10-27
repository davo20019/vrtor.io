"""Photographed surfaces for the Machu Picchu citadel walk (apps/mpc/public/materials), from CC0 photo scans.

Each surface is a scan of a real one (Poly Haven, ambientCG; both CC0): its albedo and its OpenGL normal map.
The albedo is graded to the colour measured on photographs of Machu Picchu (refs/SOURCES.md): the granite of its
walls, its lawns and its packed earth floors. The scans tile seamlessly as published.

    python3 -I assets-src/machu/photo_textures.py
Downloads go to assets-src/machu/.cache (not committed).
"""
import io
import pathlib
import urllib.parse
import urllib.request
import zipfile

import numpy as np
from PIL import Image, ImageFilter

HERE = pathlib.Path(__file__).resolve().parent
CACHE = HERE / '.cache'
OUT = HERE.parents[1] / 'apps/mpc/public/materials'
UA = 'vrtor-machu-texture-build/1.0 (hello@vrtor.io)'

PH = 'https://dl.polyhaven.org/file/ph-assets/Textures/jpg/2k/{id}/{id}_{map}_2k.jpg'
ACG = 'https://ambientcg.com/get?file={id}_2K-JPG.zip'
# Photographs of the site (Wikimedia Commons), used only to measure colour; never shipped.
PHOTOS = {
    'stone': ['Peru_-_Machu_Picchu_023_-_broken_wall_in_the_sacred_square_(7367110798).jpg', 'Machu-picchu-c07.jpg',
              'Machu-picchu-c14.jpg', 'Machu_picchu_grande.jpg', '80_-_Machu_Picchu_-_Juin_2009_-_edit.jpg',
              'Lascar_The_Principal_Temple_(4548107947).jpg', 'Machu-picchu-c12.jpg'],
    'lawn': ['Machu_Picchu,_Perú,_2015-07-30,_DD_47.JPG', 'Machu_Picchu,_Perú,_2015-07-30,_DD_50.JPG',
             'Machu_Picchu,_Perú,_2015-07-30,_DD_60.JPG', 'Machu_picchu_grande.jpg'],
    # The packed earth floor in front of the Main Temple, overcast and in sun: (x0, y0, x1, y1) of the frame.
    'earth': [('Machu-picchu-c14.jpg', (.2, .88, .8, .97)), ('Lascar_The_Principal_Temple_(4548107947).jpg', (.2, .9, .8, .98))],
}

# name: (source, id, output size, metres per tile, spread kept)
MATERIALS = {
    # Rough fieldstone laid in mud: the pirka masonry of most of the citadel's walls and terraces.
    'stone': ('ph', 'stone_wall', 2048, 2.0, 1.0),
    'lawn': ('acg', 'Grass004', 1024, 1.4, 0.9),
    'earth': ('ph', 'dirt_floor', 1024, 2.07, 0.8),
    # Weathered granite without joints, for the laser-scan closeups, whose stones and joints are the scan's geometry.
    'rock': ('ph', 'rock_boulder_dry', 1024, 1.8, 1.0),
}


def get(url, name):
    CACHE.mkdir(exist_ok=True)
    path = CACHE / name
    if not path.exists():
        req = urllib.request.Request(url, headers={'User-Agent': UA})
        with urllib.request.urlopen(req, timeout=120) as r:
            path.write_bytes(r.read())
        print('downloaded', name, path.stat().st_size // 1024, 'KB')
    return path


def photo(name):
    url = 'https://commons.wikimedia.org/wiki/Special:FilePath/' + urllib.parse.quote(name) + '?width=1280'
    return np.asarray(Image.open(get(url, 'photo_' + name.replace('/', '_'))).convert('RGB'), float)


def maps(src, aid):
    """Albedo and normal (OpenGL) images of one material."""
    if src == 'ph':
        f = {m: get(PH.format(id=aid, map=m), f'{aid}_{m}.jpg') for m in ('diff', 'nor_gl')}
        return [Image.open(f[m]).convert('RGB') for m in ('diff', 'nor_gl')]
    z = zipfile.ZipFile(get(ACG.format(id=aid), f'{aid}.zip'))
    pick = lambda key: next(n for n in z.namelist() if key in n)
    return [Image.open(io.BytesIO(z.read(pick(k)))).convert('RGB') for k in ('_Color', '_NormalGL')]


def measured(name):
    """The mean colour of the surface in the photographs. Stone: neutral pixels that are not sky. Lawn: the sunlit
    half of the green pixels. Earth: the floor in the given boxes."""
    means = []
    for item in PHOTOS.get(name, ['rock']):
        if name == 'rock':
            return measured('stone')
        if name == 'earth':
            f, (x0, y0, x1, y1) = item
            im = photo(f)
            h, w, _ = im.shape
            means.append(im[int(y0 * h):int(y1 * h), int(x0 * w):int(x1 * w)].reshape(-1, 3).mean(0))
            continue
        a = photo(item).reshape(-1, 3)
        r, g, b = a.T
        mx, mn = a.max(1), a.min(1)
        if name == 'stone':
            pick = ((mx - mn) / np.maximum(mx, 1) < .22) & (mx > 70) & (mx < 230) & (r >= b)
            if pick.mean() > .1:
                means.append(a[pick].mean(0))
        else:
            x = a[(g > r * 1.02) & (g > b * 1.6) & (g > 60)]
            if len(x) > 2000:
                means.append(x[x.sum(1) > np.median(x.sum(1))].mean(0))
    mean = np.mean(means, 0)
    # The photographs are of surfaces in daylight: the albedo is a little darker and a quarter less saturated
    # (the light's colour and the camera's punch taken out), as for /giza.
    grey = mean.mean()
    target = (grey + (mean - grey) * 0.75) * 0.92
    print(name, 'in the photographs', mean.round(1), 'from', len(means), 'photos; albedo', target.round(1))
    return target


def grade(img, target, spread):
    """Balance each channel so the mean is the target colour; keep the scan's detail, scaled by `spread`."""
    a = np.asarray(img, float)
    t = np.array(target, float)
    scaled = a * (t / np.maximum(a.reshape(-1, 3).mean(0), 1))
    return t + (scaled - t) * spread


def flatten(arr, radius):
    """Take out light and shade broader than `radius` px: repeated over a wall, a tile's broad gradient shows as a
    grid; the stones' own detail doesn't."""
    img = Image.fromarray(np.clip(arr, 0, 255).astype(np.uint8))
    w, h = img.size
    big = Image.new('RGB', (w * 3, h * 3))
    for i in range(3):
        for j in range(3):
            big.paste(img, (i * w, j * h))
    blur = np.asarray(big.filter(ImageFilter.GaussianBlur(radius)).crop((w, h, 2 * w, 2 * h)), float)
    return arr - blur + blur.reshape(-1, 3).mean(0)


def save(name, arr, size, quality):
    img = Image.fromarray(np.clip(arr, 0, 255).astype(np.uint8)).resize((size, size), Image.LANCZOS)
    OUT.mkdir(parents=True, exist_ok=True)
    img.save(OUT / name, quality=quality, optimize=True, progressive=True)
    print('wrote', name, (OUT / name).stat().st_size // 1024, 'KB')


def main():
    for name, (src, aid, size, metres, spread) in MATERIALS.items():
        diff, nor = maps(src, aid)
        alb = flatten(grade(diff, measured(name), spread), diff.size[0] / 5)
        save(f'site-{name}-albedo.jpg', alb, size, 86)
        save(f'site-{name}-normal.jpg', np.asarray(nor, float), size, 90)


if __name__ == '__main__':
    main()
