"""Encode Machu Picchu textures as KTX2 (Basis ETC1S) so they stay GPU-compressed.
Run after prepare-machu-landscape.py and bake-machu-ao.py: python3 scripts/encode-machu-ktx2.py
Needs basisu (Basis Universal 2.x, e.g. `brew install basis_universal`) and Pillow.
JPEG sources stay alongside as the regeneration inputs; the scene loads the .ktx2 files.
"""
import subprocess,tempfile
from pathlib import Path
from PIL import Image
materials=Path(__file__).resolve().parent.parent/'apps/mpc/public/materials'
# Shaders sample these directly. Imagery is read south-up (like a flipped JPEG upload), occlusion
# follows glTF UVs (top-down). Linear metrics: the terrain shader applies the sRGB curve itself.
JOBS=[('andes-near',True),('andes-far',True),('citadel-ao',False)]
with tempfile.TemporaryDirectory() as tmp:
  for name,flip in JOBS:
    png=Path(tmp)/f'{name}.png';image=Image.open(materials/f'{name}.jpg').convert('RGB')
    (image.transpose(Image.Transpose.FLIP_TOP_BOTTOM) if flip else image).save(png)
    out=materials/f'{name}.ktx2'
    subprocess.run(['basisu','-etc1s','-ktx2','-mipmap','-linear','-quality','90','-effort','4',str(png),'-output_file',str(out)],check=True,capture_output=True)
    print('KTX2',out.name,out.stat().st_size,'bytes',flush=True)
