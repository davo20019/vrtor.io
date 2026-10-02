# Orca (vrtor.io/orca): design

## Intent

A new free subject in Nature: the real skeleton of an adult male killer whale, at full size in a
bright museum gallery. Visitors walk around it, take a tour of how a whale is built (teeth, the
nose on top of the head, echolocation, hearing through the jaw, the neck, the hand in the
flipper, the folding chest, the backbone, the boneless fin and flukes), compare it with a
bottlenose dolphin, put the orca's skin back on (see-through, then solid) and listen to real
orca calls.

## Sources and licenses

- Orca skeleton: University of Pisa Natural History Museum, *Orcinus orca* C 301, binary STL on
  Wikimedia Commons, CC BY-SA 4.0, uploaded by the museum's head of vertebrate zoology (Simone
  Farina). 2.49M triangles, no color, no stated unit.
- Dolphin skeleton: same museum, *Tursiops truncatus* C 281, Commons, CC BY-SA 4.0, millimetres.
- Calls: U.S. National Park Service hydrophone at Glacier Bay, Alaska, public domain.
- ShareAlike: our glb adaptations are CC BY-SA 4.0 too (CREDITS.md says so); the code is not a
  derivative of the scans.

## Scale

The orca scan's unit is unknown. Scaled so the skull is about 1.0 m long and 0.6 m wide (adult
male); the skeleton comes out 6.25 m, the animal close to 7 m with flukes, inside the 6 to 8 m
range for males. The other Pisa scans use different units (the dolphin and beaked whale are in
mm, the narwhal is not), so no factor is shared.

## Asset pipeline

`scripts/prepare-orca.py` (Blender, headless): download from Commons, weld, orient (snout +Z,
dorsal up, lowest bone y = 0), scale, decimate (orca 220k, dolphin 60k triangles), bake ambient
occlusion into vertex colors over an ivory bone color, Draco glb. It also writes
`orca-shape.json`, 64 slices of the orca skeleton's outline.

## The body

`src/body.js` lofts a body along the outline (hulls over the top and bottom, flesh margins, a
midline that follows the slightly bent mount), narrows it at the tail stock, and adds the parts
with no bone: a 1.5 m dorsal fin, 1.8 m flukes, and paddle flippers over the hand bones. The
pattern (white chin, belly and flank lobe, eye patch, grey saddle) is painted into a texture on
the unrolled body. It fades in see-through (42%) then solid; when solid the skeleton is hidden.

## Site wiring

`apps/orca` (Vite, base `/orca/`, Worker `vrtor-orca`); home service binding `ORCA`; subject
codes orca, orcas, killer-whale, killerwhale, whale, whales; presence codes may now be three or
four letters; dev script and deploy order; catalog card; README.

## Out of scope

The Osaka humpback (needs a Sketchfab login to download), more cetaceans from the Pisa set,
swimming animation.
