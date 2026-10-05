"""Make the three-column review from matching-camera renders.
Usage: .venv/bin/python review/windshield/compare.py previous_render_dir updated_render_dir
The source photos and crop rectangles are fixed so each row is directly comparable.
"""
from pathlib import Path
from PIL import Image, ImageDraw, ImageFont
import sys
base=Path(__file__).resolve().parents[2]
before,after=map(Path,sys.argv[1:3])
rows=[('Athens 1 — lower corner','athens1','int-athens-1.jpg',(180,160,1000,690)),
      ('Athens 2 — support and glass','athens2','int-athens-2.jpg',(0,440,900,1200)),
      ('Exterior — approximate camera','exterior','c134-front-high.jpg',None)]
width,height=620,420
canvas=Image.new('RGB',(width*3,80+(height+42)*len(rows)), '#171b21')
draw=ImageDraw.Draw(canvas)
try:font=ImageFont.truetype('/System/Library/Fonts/Supplemental/Arial.ttf',24)
except OSError:font=ImageFont.load_default()
for i,label in enumerate(('Real car reference','Previous model','Updated model')):
 draw.text((i*width+16,18),label,font=font,fill='white')
for j,(title,key,photo,crop) in enumerate(rows):
 y=70+j*(height+42)
 draw.text((16,y),title,font=font,fill='#ced6e0')
 for i,path in enumerate((base/'refs/web'/photo,before/f'{key}.png',after/f'{key}.png')):
  im=Image.open(path).convert('RGB')
  if crop:im=im.crop(crop)
  im.thumbnail((width-16,height),Image.Resampling.LANCZOS)
  canvas.paste(im,(i*width+(width-im.width)//2,y+35+(height-im.height)//2))
canvas.save(Path(__file__).with_name('comparison.png'))
