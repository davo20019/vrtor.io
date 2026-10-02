"""Fetch Columbia (the Smithsonian scans) and build the Moon and Earth textures for the Apollo 11 room (apps/apo).
Run: python3 scripts/prepare-apollo.py   (needs numpy and Pillow)

Sources (all NASA, public domain):
- Moon colour and elevation: NASA SVS CGI Moon Kit (LRO LROC WAC colour, LOLA elevation),
  https://svs.gsfc.nasa.gov/4720 (lroc_color_poles_16k.tif, ldem_16.tif, ldem_4.tif)
- Earth: Blue Marble Next Generation, July 2004 (world.topo.bathy.200407.3x5400x2700.jpg),
  and Blue Marble clouds (cloud_combined_2048.jpg), NASA Earth Observatory.

Outputs in apps/apo/public/textures/:
- moon-color.jpg      whole Moon, equirectangular, 4096x2048
- moon-slope.jpg      whole Moon, east/north slopes in R/G (0.5 = flat), 2048x1024
- moon-near-color.jpg the sharp patch under the orbit (PATCH below), 4096x2048
- moon-near-slope.jpg its slopes, 2048x1024
- earth.jpg           2048x1024, cloud cover blended over the July Blue Marble
"""
import math, subprocess
from pathlib import Path
import numpy as np
from PIL import Image

Image.MAX_IMAGE_PIXELS = None
repo = Path(__file__).resolve().parent.parent
out = repo / 'apps/apo/public/textures'
out.mkdir(parents=True, exist_ok=True)
cache = Path('/tmp/vrtor-apollo-sky')
cache.mkdir(exist_ok=True)

MOON_KIT = 'https://svs.gsfc.nasa.gov/vis/a000000/a004700/a004720/'
EARTH = 'https://assets.science.nasa.gov/content/dam/science/esd/eo/images/bmng/bmng-topography-bathymetry/july/world.topo.bathy.200407.3x5400x2700.jpg'
CLOUDS = 'https://eoimages.gsfc.nasa.gov/images/imagerecords/57000/57747/cloud_combined_2048.jpg'
MOON_RADIUS_KM = 1737.4
# The patch under Columbia's orbit: longitude and latitude bounds in degrees (keep in sync with moon.js).
PATCH = (-17.0, 63.0, -20.0, 20.0)
# Slopes are stored as 0.5 + slope / SLOPE_RANGE / 2 (so +-SLOPE_RANGE fills 0..1).
SLOPE_RANGE = 0.6


def fetch(url, name):
  path = cache / name
  if not path.exists():
    subprocess.run(['curl', '-sfL', '--retry', '3', '-o', str(path), url], check=True)
  return Image.open(path)


def crop(img, lon0, lon1, lat0, lat1):
  """A longitude/latitude box of an equirectangular map whose left edge is -180 and top is +90."""
  w, h = img.size
  box = ((lon0 + 180) / 360 * w, (90 - lat1) / 180 * h, (lon1 + 180) / 360 * w, (90 - lat0) / 180 * h)
  return img.crop(tuple(round(v) for v in box))


def slopes(height_km, lat0, lat1, lon_span):
  """East and north slopes (rise over run) of a height grid covering lat0..lat1 and lon_span degrees."""
  h = np.asarray(height_km, dtype=np.float64)
  rows, cols = h.shape
  lat = np.radians(np.linspace(lat1, lat0, rows))[:, None]
  dx = MOON_RADIUS_KM * np.cos(lat) * math.radians(lon_span / cols)
  dy = MOON_RADIUS_KM * math.radians((lat1 - lat0) / rows)
  east = (np.roll(h, -1, axis=1) - np.roll(h, 1, axis=1)) / (2 * np.maximum(dx, 1e-6))
  north = (np.roll(h, 1, axis=0) - np.roll(h, -1, axis=0)) / (2 * dy)
  north[0] = north[1]
  north[-1] = north[-2]
  return east, north


def slope_image(east, north, size):
  enc = lambda s: np.clip(0.5 + s / SLOPE_RANGE / 2, 0, 1) * 255
  rgb = np.dstack([enc(east), enc(north), np.full(east.shape, 128.0)]).astype(np.uint8)
  return Image.fromarray(rgb).resize(size, Image.BICUBIC)


def main():
  color = fetch(MOON_KIT + 'lroc_color_poles_16k.tif', 'lroc_color_poles_16k.tif').convert('RGB')
  color.resize((4096, 2048), Image.LANCZOS).save(out / 'moon-color.jpg', quality=88)
  crop(color, *PATCH).resize((4096, 2048), Image.LANCZOS).save(out / 'moon-near-color.jpg', quality=90)

  far = np.asarray(fetch(MOON_KIT + 'ldem_4.tif', 'ldem_4.tif'), dtype=np.float32)
  e, n = slopes(far, -90, 90, 360)
  slope_image(e, n, (2048, 1024)).save(out / 'moon-slope.jpg', quality=92)

  near = crop(fetch(MOON_KIT + 'ldem_16.tif', 'ldem_16.tif'), *PATCH)
  e, n = slopes(np.asarray(near, dtype=np.float32), PATCH[2], PATCH[3], PATCH[1] - PATCH[0])
  slope_image(e, n, (2048, 1024)).save(out / 'moon-near-slope.jpg', quality=92)

  earth = fetch(EARTH, 'earth-200407.jpg').convert('RGB').resize((2048, 1024), Image.LANCZOS)
  clouds = fetch(CLOUDS, 'clouds-2048.jpg').convert('L').resize((2048, 1024), Image.LANCZOS)
  a = (np.asarray(clouds, dtype=np.float32) / 255)[..., None] ** 1.2
  blend = np.asarray(earth, dtype=np.float32) * (1 - a) + 250 * a
  Image.fromarray(blend.clip(0, 255).astype(np.uint8)).save(out / 'earth.jpg', quality=88)

  for f in sorted(out.iterdir()):
    print(f.name, f.stat().st_size)
  fetch_capsule()


# Columbia itself: the Smithsonian's 3D scans of the Apollo 11 command module (CC0), as published
# for its Voyager viewer. Interior and exterior share one frame, but for a 9.5 cm offset (capsule.js).
SI = 'https://3d-api.si.edu/content/document/3d_package:'
INTERIOR = SI + 'd8c63e8a-4ebc-11ea-b77f-2e728ce88125/'
EXTERIOR = SI + 'd8c6457e-4ebc-11ea-b77f-2e728ce88125/'
CAPSULE = {
  'interior-hull.glb': INTERIOR + 'x3d-cm-interior-hull-uvs-150k-2048-medium.glb',
  'interior-seats.glb': INTERIOR + 'x3d-cm-interior-seats-uvs-150k-2048-medium.glb',
  # The panels carry the most fine print: the 4096 texture keeps the switch labels legible.
  'interior-panel.glb': INTERIOR + 'x3d-cm-interior-panel-uvs-150k-4096-high.glb',
  'interior-graffiti.glb': INTERIOR + 'x3d-cm-interior-graffiti-uvs-150k-2048-high.glb',
  'exterior-shell.glb': EXTERIOR + 'x3d-cm-exterior-shell-90k-uvs-150k-4096-high.glb',
  'exterior-top.glb': EXTERIOR + 'x3d-cm-exterior-top-160k-uvs-150k-2048-medium.glb',
}


def fetch_capsule():
  models = repo / 'apps/apo/public/models'
  models.mkdir(parents=True, exist_ok=True)
  for name, url in CAPSULE.items():
    path = models / name
    if not path.exists():
      subprocess.run(['curl', '-sfL', '--retry', '3', '-o', str(path), url], check=True)
    print(name, path.stat().st_size)


if __name__ == '__main__':
  main()
