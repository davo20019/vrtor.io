# Apollo 11 room: sources

## Columbia (the Apollo 11 command module)

3D scans by the Smithsonian Institution, National Air and Space Museum (Smithsonian Digitization
Program Office), released as CC0 through Smithsonian Open Access: https://3d.si.edu

- Interior (hull, couches, panels, graffiti): https://3d.si.edu/object/3d/d8c63e8a-4ebc-11ea-b77f-2e728ce88125
- Exterior (shell, forward compartment): 3d_package d8c6457e-4ebc-11ea-b77f-2e728ce88125

Files are the Smithsonian's own web derivatives, unchanged (`scripts/prepare-apollo.py`
downloads them). Stop positions come from the curators' annotations; the tour text is our own.

## Visitors' spacesuit (`suit.glb`)

Neil Armstrong's Apollo 11 pressure suit (A7-L), 3D scan by the Smithsonian Institution,
National Air and Space Museum (Smithsonian Digitization Program Office):
https://3d.si.edu/object/3d/armstrong-space-suit:d8c63ba6-4ebc-11ea-b77f-2e728ce88125

Unlike Columbia, this scan is **not** marked CC0 in Smithsonian Open Access: it is used under the
Smithsonian's terms for non-commercial, educational use. Keep this room free, or get the
Smithsonian's permission before it is part of anything paid. `scripts/prepare-apollo-suit.py`
removes the helmet, reduces it to 20,000 triangles, bakes its textures into one and darkens the
visor seen through the neck ring.

## The Moon and Earth (`../textures/`)

NASA, public domain.

- Moon colour and elevation: NASA Scientific Visualization Studio, CGI Moon Kit
  (LRO LROC WAC colour mosaic, LOLA elevation), https://svs.gsfc.nasa.gov/4720
- Earth: NASA Earth Observatory, Blue Marble Next Generation (July 2004) and Blue Marble clouds,
  https://science.nasa.gov/earth/earth-observatory/blue-marble-next-generation/

`scripts/prepare-apollo.py` builds the textures from these.
