"""Encode Machu Picchu textures as KTX2 (Basis ETC1S, UASTC for normal maps) so they stay GPU-compressed.
Run after prepare-machu-landscape.py, bake-machu-ao.py and bake-machu-scan.py: python3 scripts/encode-machu-ktx2.py
Needs basisu (Basis Universal 2.x, e.g. `brew install basis_universal`) and Pillow.
JPEG sources stay alongside as the regeneration inputs; the scene loads the .ktx2 files.
"""
import subprocess,tempfile
from pathlib import Path
from PIL import Image
materials=Path(__file__).resolve().parent.parent/'apps/mpc/public/materials'
# Shaders sample these directly. Imagery is read south-up (like a flipped JPEG upload), occlusion
# follows glTF UVs (top-down). Linear metrics: the terrain shader applies the sRGB curve itself.
# The placed scans' baked maps (bake-machu-scan.py) follow glTF UVs too. Their grey values stay sRGB-encoded (the
# material treats them as gamma space); normal maps use UASTC, which keeps their directions.
JOBS=[('andes-near',True,'etc1s'),('andes-far',True,'etc1s'),('citadel-ao',False,'etc1s')]
JOBS+=[(f'{scan}-walk-{kind}',False,'uastc' if kind=='normal' else 'etc1s') for scan in ('sun-temple','main-temple','water-room') for kind in ('gray','normal')]
with tempfile.TemporaryDirectory() as tmp:
  for name,flip,mode in JOBS:
    maps=materials.parents[3]/'assets-src/machu/.cache/maps'
    src=next(d/f'{name}.{ext}' for d in (materials,maps) for ext in ('jpg','png') if (d/f'{name}.{ext}').exists())
    png=Path(tmp)/f'{name}.png';image=Image.open(src).convert('RGB')
    (image.transpose(Image.Transpose.FLIP_TOP_BOTTOM) if flip else image).save(png)
    out=materials/f'{name}.ktx2'
    codec=['-uastc','-uastc_level','2','-uastc_rdo_l','1.0'] if mode=='uastc' else ['-etc1s','-quality','90','-effort','4']
    subprocess.run(['basisu',*codec,'-ktx2','-mipmap','-linear',str(png),'-output_file',str(out)],check=True,capture_output=True)
    print('KTX2',out.name,out.stat().st_size,'bytes',flush=True)
