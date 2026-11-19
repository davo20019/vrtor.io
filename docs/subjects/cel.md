# The cell (`vrtor.io/cel/`)

An animal cell and a plant cell side by side, 150,000 times life size and to scale (1 µm = 15 cm): the
animal cell a 20 µm sphere (3 m), the plant cell a 40 x 25 x 25 µm leaf cell (6 m). `vrtor.io/cell`,
`/cells`, `/plant-cell`, `/animal-cell` and `/celula` redirect here. Everything is drawn in code, no model
files: `src/geo.js` (superellipsoid shells cut open, flattened sacs, tubes, caps on the cut faces) and
`src/cells.js` (where every organelle goes; seeded, so every visitor sees the same cell). Membranes are
drawn about 20x thicker and ribosomes 3x bigger than true, and there are fewer mitochondria and
ribosomes than a real cell has; the welcome card and each cell's card say so.

- **Parts** (`src/parts.js`): every part is a node with its own transform: take it out alone or with what it
  belongs to (a crista, its mitochondrion, all mitochondria). Membranes, fills and whole-cell networks stay
  put (`FIXED` in main.js). Mitochondria, chloroplasts and the plant's nucleus open (top half off) when taken
  out, held or looked inside; the animal cell's nucleus is cut with the cell.
- **Text** (`src/content.js`): for each part what it is and does, a "city" comparison, its real size, a
  fact, and its Spanish name; read aloud with the browser's speech. Search takes English or Spanish.
- **Close-ups** (`src/zoom.js`): DNA (60 million x), a ribosome making a protein and a patch of membrane
  (10 million x), offered on the cards of the parts they belong to.
- **Learn** (`src/tours.js`): four tours (the animal cell, the plant cell, making a protein, energy), an
  animal-or-plant comparison, and a 10-question quiz (find it, name it, which cells have it).
- **Headset**: grip takes the part under your hand (trigger while holding takes what it belongs to), the
  trigger points at anything to read about it, the tool strip under the card moves you into either cell.
  Not yet checked on a headset: frame rate (about 500k triangles with both cells, ~220 draws) and grab reach.

The catalog card (`apps/home/public/assets/cards/cell.jpg`) is a render of the page itself.
