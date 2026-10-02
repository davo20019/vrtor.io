# Wright Flyer (vrtor.io/fly): design

## Intent

A new free subject: the real 1903 Wright Flyer, from the Smithsonian's 3D scan (CC0), standing on
the sand at Kill Devil Hills on the morning of December 17, 1903. Visitors walk around it at real
size, take a guided tour of how it works (wings, three-axis control, engine, chain drive,
propellers, launch rail), lie where Orville lay, and watch the first flight replayed in front of
them. It is the first subject about how machines work (the planned Mechanics area), and it meets
the asset bar set for vrtor: a museum scan with a clear license.

Success: it opens at vrtor.io/fly on a flat screen, phone and Quest browser; the tour reads well
and every fact traces to the Smithsonian's record or curators' articles; it holds frame rate on
Quest like Apollo 11; visitors can join each other as in the other subjects.

## Source and license

- Scan: Smithsonian NASM, 1903 Wright Flyer (A19610048000), 3D package
  `d8c62e5e-4ebc-11ea-b77f-2e728ce88125`. The Open Access record and its `3d_voyager` media are
  marked CC0 (checked in the Smithsonian Open Access bulk metadata).
- The scan's web derivatives come in three parts (wings, filler, engine), about 166k triangles,
  with normal and occlusion maps but no color at all. The Voyager scene carries 37 curator
  annotations (positions in the scan's frame, cm) and curators' articles by Peter Jakab.
- Colors are ours: unbleached muslin, spruce and ash, steel wire, cast aluminum, from the record
  ("natural fabric finish, no sealant or paint") and the articles. CREDITS.md says so.

## Asset pipeline

`scripts/prepare-flyer.py` (Blender, headless) downloads the three High parts, welds vertices,
splits each part into its pieces and colors each piece by what it is (vertex colors):
fabric (large surfaces), wood (struts, ribs, propellers, skids), wire (pieces under 1.5 cm
around), metal (engine, small fittings). The two propellers (the 2.57 m pieces) become their own
meshes with their origin at the hub, so they can spin. Normal and occlusion maps are reduced to
2048 JPEG. One Draco-compressed `flyer.glb` in metres, in the scan's frame.

## The scene

- Flat sand to the horizon with low dunes and Big Kill Devil Hill behind; a pale December sky;
  the Wrights' two wooden camp buildings; the 60 ft launch rail under the Flyer, pointing north
  into the wind.
- Flat screens: an orbit camera around the Flyer; tour stops glide the camera.
- Headset: teleport on the sand, snap turn; the tour moves you to each stop (xr-shell).
- Visitors: the shared presence and voice (subject `fly`), no special outfit.

## Tour

Stops are curator annotations (`at` in the scan's frame) with an eye position we choose:
the Flyer, the wings and muslin, wing-warping, the elevator, the pilot's hip cradle (eye where
the prone pilot's head was), the engine, the chain drive, the propellers, the rudder and
bellcranks, the launch rail and skids, the anemometer and the numbers of the first flight. Each
has a glowing marker; pointing at one explains it. Card and controls match Apollo 11 (corner ×,
Back and Next).

## The first flight

A "Watch the first flight" action (bar button and last stop): the visitor stands where John T.
Daniels took the famous photograph, and the Flyer runs down the rail, lifts off, flies about
36.6 m (120 ft) in about 12 seconds at a few metres up, propellers turning, and lands on its
skids; then it is set back on the rail. Markers hide during the flight.

## Site wiring

`apps/fly` (Vite, base `/fly/`, Worker `vrtor-fly`); home Worker service binding `FLY` and
subject codes (fly, flyer, wright, wright-flyer, kittyhawk, kitty-hawk); dev script and deploy
order; a catalog card with a rendered image; README.

## Out of scope

Sound, AI features, more aircraft, KTX2 textures (JPEG at 2048 is light enough here).
