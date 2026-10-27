// What the card says about each part. Keys: a part's id (walls, valves), its group, or (coronary vessels) the
// branch it belongs to. Numbers are this model's or the literature's (assets-src/heart/refs/literature.md).

export const ABOUT = {
  lv: {
    text: 'The strongest chamber. It pumps oxygen-rich blood through the aortic valve into the aorta and on to the whole body, against about 120 mmHg. Its wall is about 9 mm thick, three times the right ventricle\'s.',
    fact: 'In this heart it holds 127 mL when full and squeezes out 82 mL, two thirds of it, every beat.',
  },
  rv: {
    text: 'Pumps blood that has come back from the body through the pulmonary valve to the lungs, where it picks up oxygen. The lungs need far less pressure (about 25 mmHg), so its wall is thin, about 4 mm, and it wraps round the left ventricle like a crescent.',
    fact: 'It squeezes like a bellows: its free wall moves towards the septum, and its base is pulled 24 mm towards the apex.',
  },
  la: {
    text: 'Receives oxygen-rich blood from the lungs through four pulmonary veins and passes it through the mitral valve to the left ventricle. While the ventricle squeezes it fills like a reservoir; at the end of filling it contracts and tops the ventricle up.',
    fact: 'Its ear-shaped appendage, on the left, is where clots can form when the atria beat irregularly (atrial fibrillation).',
  },
  ra: {
    text: 'Receives blood from the body through the superior and inferior venae cavae, and from the heart\'s own veins through the coronary sinus, and passes it through the tricuspid valve to the right ventricle. The heartbeat starts in its wall, at the sinoatrial node.',
    fact: 'Before birth, blood crossed from here to the left atrium through the foramen ovale; its scar is the fossa ovalis.',
  },
  aorta: {
    text: 'The start of the aorta, the body\'s main artery. Behind each cusp of the aortic valve its wall bulges into a sinus; the two coronary arteries leave from the left and right sinuses, so the heart feeds itself first.',
    fact: 'The aortic root moves about 12 mm towards the apex with every beat.',
  },
  pa: {
    text: 'Carries blood from the right ventricle to the lungs. It splits into the left and right pulmonary arteries just beyond this short stretch.',
    fact: 'It is the only artery in an adult that carries oxygen-poor blood.',
  },
  mv: {
    text: 'Two leaflets between the left atrium and ventricle. The broad anterior leaflet hangs between the inflow and the outflow to the aorta; the posterior one is narrow and long, in three scallops. Shut, they meet along a curved line and overlap by several millimetres.',
    fact: 'The anterior leaflet is about 27 mm long and the posterior about 16 mm (Henry 2022, men).',
  },
  tv: {
    text: 'Three leaflets (anterior, posterior and septal) between the right atrium and ventricle. Like the mitral valve, it is held shut against the ventricle\'s pressure by chordae from papillary muscles.',
    fact: 'Its ring is the heart\'s largest: 116 mm round in this heart, exactly the published mean for men.',
  },
  av: {
    text: 'Three half-moon (semilunar) cusps at the root of the aorta: left coronary, right coronary and non-coronary, named for the arteries that leave the sinuses behind them. Shut, their edges meet in a three-pointed star; they need no chordae.',
    fact: 'Each cusp\'s free edge is about 34 mm long, 1.3 times the width of the aorta, so they can meet in the middle.',
  },
  pv: {
    text: 'Three semilunar cusps at the root of the pulmonary trunk, like the aortic valve\'s but thinner, under lower pressure.',
    fact: 'It opens a moment before the aortic valve and shuts a moment after it, which splits the second heart sound when you breathe in.',
  },
  lv_papillary: {
    text: 'Two fingers of muscle that rise from the left ventricle\'s wall. They tighten as the ventricle squeezes, keeping their chordae taut so the mitral leaflets can\'t blow back into the atrium.',
    fact: 'Each sends chordae to both leaflets: the anterolateral one to the halves near it, the posteromedial one to the rest.',
  },
  rv_papillary: {
    text: 'The right ventricle\'s papillary muscles: a large anterior one, a posterior one, and a small septal one near the outflow tract. Their chordae hold the tricuspid leaflets.',
    fact: 'The anterior muscle also receives the moderator band, which carries the right bundle branch of the conduction system across the cavity.',
  },
  mv_chordae: {
    text: 'Fine cords (chordae tendineae) from the papillary muscles to the leaflets: marginal ones to the free edge, rough-zone ones a little behind it, and two thick struts to the anterior leaflet. Taut when the valve is shut, slack when it opens.',
    fact: 'About 22 marginal chordae reach each leaflet; most fan out into 3 to 6 branches (Gunnal 2015). Marginal ones are about 0.6 mm thick, struts 1.3 mm.',
  },
  tv_chordae: {
    text: 'The tricuspid valve\'s chordae tendineae, from the right ventricle\'s papillary muscles to the three leaflets.',
    fact: 'Some of the septal leaflet\'s chordae come straight from the septum, with no papillary muscle.',
  },
  coronary_arteries: {
    text: 'The heart\'s own blood supply, running over its surface in the fat. The left coronary artery splits into the anterior descending branch, down the front between the ventricles, and the circumflex, round the left side; the right coronary artery runs round the right side to the back.',
    fact: 'They fill mostly while the heart relaxes: when it squeezes, the muscle presses its own vessels shut.',
  },
  coronary_veins: {
    text: 'The heart\'s veins collect blood from its muscle into the coronary sinus, which runs in the groove at the back between the left atrium and ventricle and opens into the right atrium.',
    fact: 'The great cardiac vein runs beside the anterior descending artery, then round the left side to become the coronary sinus.',
  },
  great_arteries: {
    text: 'The aorta rises from the left ventricle, arches over the pulmonary arteries and the left main bronchus, and runs down beside the spine. From its arch leave the brachiocephalic trunk, the left common carotid and the left subclavian arteries, to the head and arms. The pulmonary trunk divides under the arch into the left and right pulmonary arteries, one to each lung.',
    fact: 'Paths from BodyParts3D, widths matched to this heart\'s CT where they leave it.',
  },
  great_veins: {
    text: 'Blood comes back to the right atrium through the superior vena cava (from the head and arms, formed by the two brachiocephalic veins) and the inferior vena cava (from the rest of the body, through the diaphragm). Four pulmonary veins, two from each lung, bring oxygen-rich blood to the left atrium.',
    fact: 'The veins have no valves where they enter the atria: when the atria contract, a little blood is pushed back up them.',
  },
  lv_trabeculae: {
    text: 'Columns and ridges of muscle (trabeculae carneae, "fleshy beams") lining the lower two thirds of the left ventricle. The upper septum, where blood leaves for the aorta, is smooth.',
    fact: 'The left ventricle\'s trabeculae are fine; the right ventricle\'s are coarse, one of the ways to tell them apart.',
  },
  rv_trabeculae: {
    text: 'The right ventricle\'s coarse trabeculae carneae, a meshwork of muscle over most of its inside. Only its outflow tract, below the pulmonary valve, is smooth.',
    fact: 'Heavy trabeculation is one of the features that identify a chamber as a right ventricle, even when the heart is malformed.',
  },
  moderator_band: {
    text: 'A band of muscle (the septomarginal trabecula) across the right ventricle, from the septum to the base of the anterior papillary muscle. It carries the right bundle branch of the conduction system across the cavity, so the anterior papillary muscle is activated early and tightens before the valve feels the pressure.',
    fact: 'In 100 hearts it was 16 mm long on average and 4.5 mm thick, and present in 92 of them (Loukas 2010). This one is 20 mm.',
  },
  crista_terminalis: {
    text: 'A ridge of muscle down the inside of the right atrium, from the superior to the inferior vena cava. It separates the smooth part of the atrium (which comes from the embryo\'s sinus venosus) from the rough part with its pectinate muscles. The sinoatrial node lies just outside its top.',
    fact: 'It is about 6 mm thick at its head, thinning to 4 mm at its tail (Sanchez-Quintana 2005).',
  },
  pectinate_muscles: {
    text: 'Parallel ridges of muscle that branch from the crista terminalis like the teeth of a comb (pecten), over the right atrium\'s wall and inside both atrial appendages. The wall between them is thin.',
    fact: 'In the left atrium they are found only inside the appendage; the rest of its wall is smooth.',
  },
  fossa_ovalis: {
    text: 'A thin, oval hollow on the wall between the atria, with a raised rim, the limbus. Before birth this was the foramen ovale, the opening that let blood bypass the lungs; it closes in the first days of life.',
    fact: 'In about one adult in four it never seals completely (a patent foramen ovale), usually without any harm.',
  },
  conduction: {
    text: 'The heartbeat starts in the sinoatrial node, at the top of the right atrium, and spreads over both atria (to the left one fastest along Bachmann\'s bundle). The only way through to the ventricles is the atrioventricular node, which holds it back about a tenth of a second, then the bundle of His, the left and right bundle branches down the septum, and the Purkinje fibres that spread it over the inside of the ventricles in a few hundredths of a second.',
    fact: 'Show the electricity to watch the wave: in this heart the atria take 105 ms to activate (the P wave) and the ventricles 95 ms (the QRS).',
  },
};

export const GROUP_NAME = {
  lv_trabeculae: 'Trabeculae carneae', rv_trabeculae: 'Trabeculae carneae', moderator_band: 'Moderator band',
  crista_terminalis: 'Crista terminalis', pectinate_muscles: 'Pectinate muscles', fossa_ovalis: 'Fossa ovalis',
  conduction: 'Conduction system',
  great_arteries: 'Great arteries', great_veins: 'Great veins',
  walls: 'Walls', mv: 'Mitral valve', tv: 'Tricuspid valve', av: 'Aortic valve', pv: 'Pulmonary valve',
  lv_papillary: 'Papillary muscles of the left ventricle', rv_papillary: 'Papillary muscles of the right ventricle',
  mv_chordae: 'Chordae of the mitral valve', tv_chordae: 'Chordae of the tricuspid valve',
  coronary_arteries: 'Coronary arteries', coronary_veins: 'Cardiac veins',
};

export const SOURCES = 'Shape: average of 19 adults\' CT (Rodero et al. 2021, CC BY 4.0). Coronary vessels: BodyParts3D (DBCLS, CC BY 4.0). Valves, papillary muscles, chordae and the beat built to published measurements.';
