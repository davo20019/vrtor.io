# Asset licences

The code in this repository is MIT ([LICENSE](LICENSE)). **The assets are not.** The 3D models,
scans, textures, imagery, terrain, audio and data under `apps/*/public/` (and the data files derived
from them) come from many sources, and each keeps its own licence. If you reuse an asset, follow
its licence, not the MIT one.

The authoritative credits are next to the files and in each app's About panel; this page is the
overview.

## Where the credits are

| Subject | Credits |
|---|---|
| Catalog, avatars, Space, Taj Mahal, Machu Picchu, card images | [apps/home/public/assets/CREDITS.md](apps/home/public/assets/CREDITS.md) |
| Machu Picchu | [apps/mpc/public/models/CREDITS.md](apps/mpc/public/models/CREDITS.md), [SITE-CREDITS.md](apps/mpc/public/models/SITE-CREDITS.md) |
| Apollo 11 | [apps/apo/public/models/CREDITS.md](apps/apo/public/models/CREDITS.md) |
| Wright Flyer | [apps/fly/public/models/CREDITS.md](apps/fly/public/models/CREDITS.md) |
| Orca | [apps/orca/public/models/CREDITS.md](apps/orca/public/models/CREDITS.md) |
| Human body | [apps/bdy/public/models/CREDITS.md](apps/bdy/public/models/CREDITS.md) |
| The heart, Mona Lisa, Coronation, Great Pyramid | the About text in `apps/<code>/src/content.js` |
| Parachute | `apps/jump/index.html`, `apps/jump/public/models/ec135.json` |
| Cybertruck | `apps/cyb/public/models/cybertruck.json`, `apps/cyb/public/bigsur/bigsur.json` |

## By licence

**Public domain and CC0**: reuse freely.
Smithsonian CC0 scans (Apollo 11 command module Columbia, 1903 Wright Flyer); NASA imagery and models
(Perseverance, Moon, Earth); Poly Haven and ambientCG textures; USGS terrain and NAIP imagery; Mapzen
terrain tiles; the Mona Lisa (C2RMF scan) and the Coronation of Napoleon (photograph), both
public-domain paintings; the US National Park Service orca recording.

**MIT**: Microsoft Rocketbox avatars and animations.

**Apache 2.0**: the Draco and KTX2/Basis decoders in `public/draco` and `public/ktx2` (licence files
alongside).

**CC BY 4.0**: reuse with attribution.
BodyParts3D (human body, heart); the Rodero et al. average-heart CT; Ministerio de Cultura Perú's
Machu Picchu model; the Taj Mahal model by Dinendra Neyo; "EC135" by NG; the Cafe-Misti and
Keynote hall venues; Sentinel-2 cloudless 2016 imagery by EOX.

**CC BY-SA 4.0**: attribution, and adaptations must use the same licence.
The University of Pisa orca and dolphin scans and the orca card image; Z-Anatomy and Wikipedia text
in the human body.

**ODbL**: OpenStreetMap-derived data (`apps/mpc/public/models/citadel-*.json`,
`apps/cyb/public/bigsur/map.json`); share-alike for derived databases.

**swisstopo free geodata (OGD)**: Parachute terrain, imagery and buildings; attribution required.

**CC BY-NC 3.0: non-commercial only.**
CAST's Machu Picchu laser scans (the six close-ups and the three buildings placed in the walk) and the
Machu Picchu card image. These must not be used commercially without CAST's permission.

**vrtor's own work** (MIT like the code): the Cybertruck, Roadster and altimeter replicas, the
cell, the Great Pyramid geometry generated from Petrie's survey, and everything else drawn in code.
Cybertruck and Roadster are trademarks of Tesla, Inc.; no Tesla logos are reproduced and Tesla does
not endorse vrtor.

## Not in this repository

Some files the live site uses can't be redistributed, so they are kept out of git. The apps work
without them:

- **Sound Lab voice clips** (`apps/snd/src/audio/`): made with macOS system voices, whose licence
  doesn't allow redistribution. On macOS, `node scripts/build-sound-audio.mjs` makes local copies.
- **Apollo 11 spacesuit and helmet** (`apps/apo/public/models/suit.glb`, `helmet.glb`): the
  Smithsonian's scan of Neil Armstrong's A7-L suit is under non-commercial educational terms, not CC0.
  Without it visitors appear as plain avatars.
- **Reference photos, manuals and video frames** used to measure the replicas
  (`assets-src/*/refs`, and the photo overlays under `measure/`, `review/` and `fit/`): copyrighted by
  their owners. Each `SOURCES.md` lists them.
