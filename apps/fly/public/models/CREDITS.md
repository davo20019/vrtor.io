# Wright Flyer: sources

## The Flyer (`flyer.glb`)

1903 Wright Flyer (A19610048000), 3D scan by the Smithsonian Institution, National Air and Space
Museum (Smithsonian Digitization Program Office), released as CC0 through Smithsonian Open Access:
https://3d.si.edu/object/3d/1903-wright-flyer:d8c62e5e-4ebc-11ea-b77f-2e728ce88125

The CC0 mark is on both the Open Access record and its 3D media (`3d_voyager`, package
`d8c62e5e-4ebc-11ea-b77f-2e728ce88125`), as published in the Smithsonian Open Access metadata
(`s3://smithsonian-open-access/metadata/edan/nasm/`).

The scan has shape but no color. `scripts/prepare-flyer.py` takes the Smithsonian's three web
parts (wings, frame, engine), unchanged in shape, and colors each piece by what it is made of:
unbleached muslin, spruce and ash, steel wire, cast aluminum and steel. The colors are ours,
chosen from the museum's description ("natural fabric finish, no sealant or paint of any kind")
and the curators' articles. It also makes the two propellers separate meshes so they can turn,
and reduces the textures to 2048.

Tour stop positions are the curators' annotations in the Smithsonian's 3D scene; the tour text is
our own, drawing on the record and the articles by Peter Jakab in that scene.

## The sand (`../textures/`)

Coast Sand 02 by Rob Tuytel, Poly Haven, CC0: https://polyhaven.com/a/coast_sand_02. Lightened
to pale Outer Banks sand by `scripts/prepare-flyer-sand.py`.

## Everything else

The launch rail, the camp sheds, the dunes and the sky are drawn in code (`src/world.js`).
