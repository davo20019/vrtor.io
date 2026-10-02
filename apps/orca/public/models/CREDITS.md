# Orca: sources

## The skeletons (`orca.glb`, `dolphin.glb`)

Both are 3D scans by the Natural History Museum of the University of Pisa (Museo di Storia
Naturale dell'Università di Pisa, Calci, Italy), published on Wikimedia Commons under
[CC BY-SA 4.0](https://creativecommons.org/licenses/by-sa/4.0/):

- Killer whale, *Orcinus orca*, adult male, inventory C 301. Scanned by Gaia Caneve and Marco
  Merella, edited by Marco Merella; uploaded by Simone Farina (SimoneFarina77):
  https://commons.wikimedia.org/wiki/File:Orcinus_orca_3d_scan_Natural_History_Museum_University_of_Pisa_C_301.stl
- Common bottlenose dolphin, *Tursiops truncatus*, inventory C 281, uploaded by Patrizia17:
  https://commons.wikimedia.org/wiki/File:Tursiops_truncatus_3d_scan_Natural_History_Museum_University_of_Pisa_C_281.stl

What we changed (`scripts/prepare-orca.py`): turned and placed each skeleton, scaled it to
metres, reduced it from about 2.5 million triangles to 220,000 (orca) and 60,000 (dolphin), and
colored the bone with baked ambient occlusion. The dolphin scan is in millimetres. The orca scan
has no stated unit, so we scaled it so its skull is about 1 m long and 0.6 m wide, typical of
adult males; the skeleton comes out about 6.3 m long. These glb files are adaptations of the
scans and are shared under the same license, CC BY-SA 4.0.

`orca-shape.json` holds slices of the orca skeleton's outline, measured from the same scan.

## The orca's body

Drawn in code (`src/body.js`) around the skeleton's outline: an illustration of the animal, not
a scan.

## The recording (`../audio/glacier-bay-orcas.mp3`)

Killer whale calls recorded by the U.S. National Park Service on a hydrophone near the mouth of
Glacier Bay, Alaska, most likely Southern Alaskan resident killer whales. Public domain (work of
the U.S. federal government):
https://commons.wikimedia.org/wiki/File:Killer_whale_residents_broadband.ogg. Converted to MP3,
filtered below 120 Hz, levelled, and faded in and out.

## Everything else

The gallery, the rods and the platforms are drawn in code (`src/world.js`).
