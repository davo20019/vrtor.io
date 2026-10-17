"""A crop of a photo with a labelled pixel grid, for reading feature positions in the photo's own pixels.
  python tools/grid.py <photo> x0 y0 x1 y1 <out.png> [step] [--marks marks.json]

The crop is scaled to about 1,600 px wide; grid lines every `step` photo pixels (default: about 12 across), labelled
in full-resolution photo pixels. --marks draws named points ({name: [x, y]}) as small cyan crosses, to check a reading.
"""
import json, sys
from PIL import Image, ImageDraw, ImageFont

a = [x for x in sys.argv[1:] if not x.startswith('--')]
photo, x0, y0, x1, y1, out = a[0], *map(int, a[1:5]), a[5]
step = int(a[6]) if len(a) > 6 else None
marks = {}
if '--marks' in sys.argv:
    marks = json.load(open(sys.argv[sys.argv.index('--marks') + 1]))
im = Image.open(photo).convert('RGB').crop((x0, y0, x1, y1))
k = 1600 / im.width
im = im.resize((round(im.width * k), round(im.height * k)), Image.LANCZOS)
d = ImageDraw.Draw(im)
step = step or max(5, round((x1 - x0) / 12 / 5) * 5)
try:
    font = ImageFont.truetype('/System/Library/Fonts/Supplemental/Arial.ttf', 18)
except OSError:
    font = ImageFont.load_default()
for gx in range((x0 // step + 1) * step, x1, step):
    X = (gx - x0) * k
    d.line([(X, 0), (X, im.height)], fill=(255, 220, 0), width=1)
    d.text((X + 2, 2), str(gx), fill=(255, 220, 0), font=font)
for gy in range((y0 // step + 1) * step, y1, step):
    Y = (gy - y0) * k
    d.line([(0, Y), (im.width, Y)], fill=(0, 255, 120), width=1)
    d.text((2, Y + 2), str(gy), fill=(0, 255, 120), font=font)
for n, (mx, my) in marks.items():
    if x0 <= mx <= x1 and y0 <= my <= y1:
        X, Y = (mx - x0) * k, (my - y0) * k
        d.line([(X - 9, Y), (X + 9, Y)], fill=(0, 255, 255), width=2)
        d.line([(X, Y - 9), (X, Y + 9)], fill=(0, 255, 255), width=2)
        d.text((X + 6, Y + 4), n, fill=(0, 255, 255), font=font)
im.save(out)
