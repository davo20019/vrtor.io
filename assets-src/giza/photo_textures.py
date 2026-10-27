"""Photographed surfaces for the Great Pyramid (apps/giza/public/tex), from CC0 photo-scanned materials.

Each material is a scan of real stone (Poly Haven, ambientCG; both CC0): its albedo, its OpenGL normal map and its
roughness. The albedo is graded to the colour of the stone at Giza: the core's to a CC0 photograph of the pyramid's
north face (refs/SOURCES.md), the others to the values in spec.md, "Materials". The scans tile seamlessly as published.

    python3 -I assets-src/giza/photo_textures.py
Downloads go to assets-src/giza/.cache (not committed).
"""
import io
import pathlib
import urllib.request
import zipfile

import numpy as np
from PIL import Image, ImageFilter

HERE = pathlib.Path(__file__).resolve().parent
CACHE = HERE / '.cache'
OUT = HERE.parents[1] / 'apps/giza/public/tex'

PH = 'https://dl.polyhaven.org/file/ph-assets/Textures/jpg/2k/{id}/{id}_{map}_2k.jpg'
ACG = 'https://ambientcg.com/get?file={id}_2K-JPG.zip'
# A CC0 photograph of the north face (Wikimedia Commons), used only to measure the core's colour.
PHOTO = 'https://commons.wikimedia.org/wiki/Special:FilePath/Giza_Old_and_New_Entrances_to_Great_Pyramid_of_Khufu_(9793880364).jpg?width=1600'

# name: (source, id, output size, albedo target mean sRGB or 'photo', spread kept)
MATERIALS = {
    'core': ('ph', 'rock_05', 2048, 'photo', 0.9),
    'fine': ('ph', 'rock_01', 2048, (214, 202, 180), 0.8),
    'sand': ('ph', 'sandy_gravel_02', 1024, (206, 178, 136), 0.9),
    'wood': ('ph', 'brown_planks_09', 1024, None, 1.0),
    'granite': ('acg', 'Granite006B', 1024, (138, 100, 88), 1.25),
}


def get(url, name):
    CACHE.mkdir(exist_ok=True)
    path = CACHE / name
    if not path.exists():
        req = urllib.request.Request(url, headers={'User-Agent': 'vrtor-giza-texture-build/1.0 (+https://vrtor.io)'})
        with urllib.request.urlopen(req, timeout=120) as r:
            path.write_bytes(r.read())
        print('downloaded', name, path.stat().st_size // 1024, 'KB')
    return path


def maps(src, aid):
    """Albedo, normal (OpenGL) and roughness images of one material."""
    if src == 'ph':
        f = {m: get(PH.format(id=aid, map=m), f'{aid}_{m}.jpg') for m in ('diff', 'nor_gl', 'rough')}
        return [Image.open(f[m]).convert('RGB') for m in ('diff', 'nor_gl', 'rough')]
    z = zipfile.ZipFile(get(ACG.format(id=aid), f'{aid}.zip'))
    pick = lambda key: next(n for n in z.namelist() if key in n)
    return [Image.open(io.BytesIO(z.read(pick(k)))).convert('RGB') for k in ('_Color', '_NormalGL', '_Roughness')]


def photo_core_colour():
    """The mean colour of the core blocks in the photograph: the sunlit masonry in its middle band, sky and
    ground excluded by brightness and hue."""
    im = np.asarray(Image.open(get(PHOTO, 'north_face.jpg')).convert('RGB'), float)
    h, w, _ = im.shape
    band = im[int(h * 0.25):int(h * 0.75), int(w * 0.1):int(w * 0.9)].reshape(-1, 3)
    r, g, b = band.T
    stone = (r > g) & (g > b) & (r - b > 25) & (band.sum(1) > 200) & (band.sum(1) < 700)
    mean = band[stone].mean(0)
    print('core colour in the photograph', mean.round(1), f'from {stone.mean():.0%} of the band')
    # The photograph is of stone in warm daylight: the albedo is a little darker and a quarter less saturated
    # (the sun's colour taken out), spec.md, "Materials".
    grey = mean.mean()
    return (grey + (mean - grey) * 0.75) * 0.92


def grade(img, target, spread):
    """Balance each channel so the mean is the target colour; keep the scan's detail, scaled by `spread`."""
    a = np.asarray(img, float)
    if target is None:
        return a
    t = np.array(target, float)
    scaled = a * (t / np.maximum(a.reshape(-1, 3).mean(0), 1))
    return t + (scaled - t) * spread


def flatten(arr, radius):
    """Take out light and shade broader than `radius` px: a tile repeated over a plain shows its broad gradient as
    stripes, the stone's own detail doesn't."""
    img = Image.fromarray(np.clip(arr, 0, 255).astype(np.uint8))
    # Wrap the tile before blurring, so the blur is seamless too.
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
    core_target = None
    for name, (src, aid, size, target, spread) in MATERIALS.items():
        diff, nor, rough = maps(src, aid)
        if target == 'photo':
            core_target = core_target if core_target is not None else photo_core_colour()
            target = core_target
        alb = grade(diff, target, spread)
        if name in ('sand', 'core'):
            alb = flatten(alb, diff.size[0] / 6)
        save(f'{name}_albedo.jpg', alb, size, 86)
        save(f'{name}_normal.jpg', np.asarray(nor, float), size, 90)
        save(f'{name}_rough.jpg', np.asarray(rough, float), size // 2, 85)


if __name__ == '__main__':
    main()
