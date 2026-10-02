"""Build the Apollo 11 room's night sky (apps/apo): the real stars, and the planets where they were
when Eagle landed (1969-07-20 20:17:40 UTC), seen from the Moon.
Run: python3 scripts/prepare-apollo-sky.py   (needs astronomy-engine: pip install astronomy-engine)

Sources:
- Stars: the Yale Bright Star Catalogue, 5th revised edition (Hoffleit & Warren 1991), every star
  down to about magnitude 6.5, which is what the eye can see. Public domain, via CDS:
  https://cdsarc.cds.unistra.fr/viz-bin/cat/V/50
- Sun, Earth and planets: computed with Astronomy Engine (Don Cross, MIT), from the Moon's centre.

All directions are J2000 ecliptic (the Earth's orbit as the equator), written left-handed for Babylon:
x toward the March equinox, y toward the north ecliptic pole, z toward ecliptic longitude 90.
Positions are J2000 rather than 1969's: the 0.4 degree of precession between them doesn't show.

Outputs:
- apps/apo/public/sky/stars.bin  per star, little-endian int16: x, y, z (times 32767), V magnitude
                                 (times 100), B-V colour index (times 1000)
- apps/apo/src/sky-1969.json     the Sun, Earth and planets: direction, and magnitude for the planets;
                                 and how the Moon and Earth were turned (moonFrame, earthFrame: their
                                 mesh axes, as rows, in the same ecliptic frame), so the scene can stand
                                 under the real sky and Earth can show the side that faced the Moon
"""
import gzip, json, math, struct, subprocess
from pathlib import Path
import astronomy

repo = Path(__file__).resolve().parent.parent
cache = Path('/tmp/vrtor-apollo-sky')
cache.mkdir(exist_ok=True)
BSC5 = 'https://cdsarc.cds.unistra.fr/ftp/V/50/catalog.gz'
LANDING = astronomy.Time.Make(1969, 7, 20, 20, 17, 40)
PLANETS = ['Mercury', 'Venus', 'Mars', 'Jupiter', 'Saturn']
EQJ_ECL = astronomy.Rotation_EQJ_ECL()


def ecliptic(v):
  """An EQJ vector (anything with x, y, z) as a left-handed J2000 ecliptic unit vector."""
  e = astronomy.RotateVector(EQJ_ECL, astronomy.Vector(v.x, v.y, v.z, LANDING))
  n = math.sqrt(e.x * e.x + e.y * e.y + e.z * e.z)
  return [e.x / n, e.z / n, e.y / n]


def stars():
  path = cache / 'bsc5.gz'
  if not path.exists():
    subprocess.run(['curl', '-sfL', '--retry', '3', '-o', str(path), BSC5], check=True)
  out = []
  for line in gzip.open(path, 'rt', encoding='latin-1'):
    line = line.ljust(197)
    # Byte columns from the catalogue's ReadMe (1-based): J2000 position 76-90, V 103-107, B-V 110-114.
    if not line[75:77].strip() or not line[102:107].strip():
      continue  # a few entries (novae, clusters) have no position or magnitude
    ra = (int(line[75:77]) + int(line[77:79]) / 60 + float(line[79:83]) / 3600) * 15
    dec = int(line[84:86]) + int(line[86:88]) / 60 + int(line[88:90]) / 3600
    if line[83] == '-':
      dec = -dec
    mag = float(line[102:107])
    bv = float(line[109:114]) if line[109:114].strip() else 0.6
    ra, dec = math.radians(ra), math.radians(dec)
    v = astronomy.Vector(math.cos(dec) * math.cos(ra), math.cos(dec) * math.sin(ra), math.sin(dec), LANDING)
    out.append((ecliptic(v), mag, bv))
  return out


def lh(rows):
  """A right-handed body-from-EQJ matrix as left-handed mesh-from-catalogue rows (swap y and z on both sides)."""
  ecl_eqj = astronomy.InverseRotation(EQJ_ECL).rot  # columns: ecliptic axes in EQJ
  m = [[sum(rows[i][k] * ecl_eqj[j][k] for k in range(3)) for j in range(3)] for i in range(3)]
  swap = [0, 2, 1]
  return [[round(m[swap[i]][swap[j]], 7) for j in range(3)] for i in range(3)]


def moon_frame():
  """Selenographic axes (IAU 2015: prime meridian toward Earth, north pole) in EQJ."""
  axis = astronomy.RotationAxis(astronomy.Body.Moon, LANDING)
  n = [axis.north.x, axis.north.y, axis.north.z]
  q = [-n[1], n[0], 0.0]  # ascending node of the Moon's equator on the Earth's: z cross n
  ql = math.hypot(q[0], q[1])
  q = [c / ql for c in q]
  nq = [n[1] * q[2] - n[2] * q[1], n[2] * q[0] - n[0] * q[2], n[0] * q[1] - n[1] * q[0]]
  w = math.radians(axis.spin)
  x = [math.cos(w) * a + math.sin(w) * b for a, b in zip(q, nq)]
  y = [n[1] * x[2] - n[2] * x[1], n[2] * x[0] - n[0] * x[2], n[0] * x[1] - n[1] * x[0]]
  return [x, y, n]


def earth_frame():
  """The Earth's axes (Greenwich, 90 east, north pole) in EQJ: the equator of date, turned by sidereal time."""
  eqd = astronomy.Rotation_EQJ_EQD(LANDING).rot
  g = math.radians(astronomy.SiderealTime(LANDING) * 15)
  # astronomy-engine stores rot[i][j] as the matrix applied v'[j] = sum_i rot[i][j] v[i]: rows of the frame are its columns.
  rows = [[eqd[k][i] for k in range(3)] for i in range(3)]
  x = [math.cos(g) * a + math.sin(g) * b for a, b in zip(rows[0], rows[1])]
  y = [-math.sin(g) * a + math.cos(g) * b for a, b in zip(rows[0], rows[1])]
  return [x, y, rows[2]]


def from_moon(body, moon):
  g = astronomy.GeoVector(body, LANDING, True)
  return ecliptic(astronomy.Vector(g.x - moon.x, g.y - moon.y, g.z - moon.z, LANDING))


def main():
  catalogue = stars()
  sky = repo / 'apps/apo/public/sky'
  sky.mkdir(parents=True, exist_ok=True)
  with open(sky / 'stars.bin', 'wb') as f:
    for (x, y, z), mag, bv in catalogue:
      f.write(struct.pack('<5h', round(x * 32767), round(y * 32767), round(z * 32767), round(mag * 100), round(bv * 1000)))

  moon = astronomy.GeoMoon(LANDING)
  data = {
    'time': '1969-07-20T20:17:40Z',
    'sun': from_moon(astronomy.Body.Sun, moon),
    'earth': ecliptic(astronomy.Vector(-moon.x, -moon.y, -moon.z, LANDING)),
    'planets': [
      {
        'name': name,
        'dir': [round(c, 6) for c in from_moon(getattr(astronomy.Body, name), moon)],
        'mag': round(astronomy.Illumination(getattr(astronomy.Body, name), LANDING).mag, 2),
      }
      for name in PLANETS
    ],
  }
  data['moonFrame'] = lh(moon_frame())
  data['earthFrame'] = lh(earth_frame())
  data['sun'] = [round(c, 6) for c in data['sun']]
  data['earth'] = [round(c, 6) for c in data['earth']]
  (repo / 'apps/apo/src/sky-1969.json').write_text(json.dumps(data, indent=2) + '\n')

  dot = lambda a, b: sum(p * q for p, q in zip(a, b))
  angle = lambda a, b: round(math.degrees(math.acos(max(-1, min(1, dot(a, b))))), 1)
  print(f'{len(catalogue)} stars; Sun to Earth {angle(data["sun"], data["earth"])} deg')
  for p in data['planets']:
    print(f'  {p["name"]}: mag {p["mag"]}, {angle(p["dir"], data["sun"])} deg from the Sun')


if __name__ == '__main__':
  main()
