// What the tour says about each part of Perseverance, in tour order.
// `nodes` are node names in NASA's model (assets/space/perseverance.glb); a
// mesh belongs to the part of its nearest listed ancestor.
// Facts are from NASA/JPL's Mars 2020 mission pages.

export const WELCOME = {
  kicker: 'Jezero Crater, Mars',
  title: 'Meet Perseverance',
  body:
    "This is NASA's Perseverance rover at its real size: about 3 meters long and as heavy as a small car. " +
    'It landed here on February 18, 2021, in a crater that held a lake more than 3.5 billion years ago. ' +
    'Its job: look for signs of ancient life.',
  fact: "Mars has 38% of Earth's gravity. You'd weigh about a third of what you do at home.",
};

export const PARTS = [
  {
    id: 'mastcam',
    nodes: ['Mastcam_Z_cams'],
    title: 'Mastcam-Z',
    body:
      "The rover's main eyes: two zoom cameras on top of the mast, set apart like your eyes so they see in 3D. " +
      'They shoot color photos and video and can make out something the size of a golf ball 100 meters away.',
    fact: 'The mast holds them about 2 meters up, the eye height of a very tall person.',
  },
  {
    id: 'supercam',
    nodes: ['head', 'lens'],
    title: 'SuperCam',
    body:
      "The big round eye in the mast's head fires a laser at rocks up to 7 meters away. " +
      'Each zap turns a speck of rock into glowing gas, and the color of that glow tells scientists what the rock is made of.',
    fact: 'SuperCam has a microphone. It recorded its own laser zaps, and some of the first sounds of wind on Mars.',
  },
  {
    id: 'antenna',
    nodes: ['antenna_hg'],
    title: 'High-gain antenna',
    body:
      'This flat hexagon can talk straight to Earth. Most pictures and data go another way, though: by radio to ' +
      'spacecraft orbiting Mars, which relay them home much faster.',
    fact: 'A radio signal takes about 3 to 22 minutes to get from Mars to Earth, so nobody can drive the rover live.',
  },
  {
    id: 'arm',
    nodes: ['arm.003', 'arm.001', 'WATSON'],
    title: 'Robotic arm',
    body:
      'The 2.1-meter arm has five joints, like a shoulder, an elbow and a wrist. At its end, a 45 kg turret carries ' +
      'a drill, two science instruments and a close-up camera called WATSON.',
    fact: "WATSON took the rover's famous selfies, held out at arm's length.",
  },
  {
    id: 'drill',
    nodes: ['corring_drill'],
    title: 'Coring drill',
    body:
      'The drill cuts rock cores about the size of a piece of chalk. Each one is sealed in a tube and stored in the ' +
      "rover's belly, so a future mission could bring them back to Earth.",
    fact: 'Around New Year 2023 the rover left ten sealed tubes on the ground at a spot called Three Forks, as a backup.',
  },
  {
    id: 'pixl',
    nodes: ['PIXL', 'PIXL_cover_01'],
    title: 'PIXL',
    body:
      'An X-ray instrument on the turret. It scans a rock spot by spot, each spot as small as a grain of salt, ' +
      'and maps which chemical elements are where. Some patterns can hint at past life.',
    fact: 'PIXL works up close: the arm holds it a couple of centimeters from the rock.',
  },
  {
    id: 'wheels',
    nodes: ['Wheels_objs', 'suspension'],
    title: 'Wheels and rocker-bogie',
    body:
      'Six aluminum wheels, each about 52 cm across, ride on a rocker-bogie suspension. Its levers tilt to keep all ' +
      'six wheels on the ground over rocks and dips, with no springs at all.',
    fact: 'Top speed is about 150 meters an hour. You drive carefully when the nearest mechanic is millions of kilometers away.',
  },
  {
    id: 'rtg',
    nodes: ['rtg'],
    title: 'Nuclear power source',
    body:
      'The finned box at the back turns heat from decaying plutonium into electricity: about 110 watts at launch, ' +
      'day and night, dust storm or not. It charges two batteries for busy moments.',
    fact: 'The fins shed spare heat, and some of it keeps the rover warm through nights around -80 °C.',
  },
  {
    id: 'names',
    nodes: ['Name_Chips'],
    title: 'Names from Earth',
    body:
      'This small plate holds three fingernail-size chips with 10.9 million names that people sent to NASA. ' +
      'The sunbeams on it link Earth and Mars.',
    fact: "Hidden in the beams is a Morse code message: 'explore as one'.",
  },
];
