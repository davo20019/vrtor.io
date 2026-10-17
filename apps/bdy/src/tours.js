// Guided tours: a few stops each, every stop showing some parts, choosing one and saying what it does. Parts are
// named exactly as in models/body.json; a stop whose parts aren't found is left out (and logged), never shown empty.
// The facts are the plain, settled ones of any anatomy textbook.
//
// A stop: { title, text, layer?, only?: [names], pick: name, out?: [names] (lifted out of the way, as by hand) }.
export const TOURS = [
  {
    id: 'heart',
    title: 'The heart',
    blurb: 'A pump of four chambers and four valves, and the arteries that feed it.',
    stops: [
      {
        title: 'A muscular pump',
        text: 'The heart is a hollow muscle about the size of a fist, behind the breastbone and tilted to the left. It beats around 100,000 times a day.',
        layer: 'organs', only: ['Heart'], pick: 'Heart',
      },
      {
        title: 'The right side: to the lungs',
        text: 'Blood that has given up its oxygen comes back through the superior and inferior venae cavae into the right atrium. The right ventricle pumps it through the pulmonary trunk to the lungs.',
        only: ['Heart', 'Superior vena cava', 'Inferior vena cava', 'Pulmonary trunk'], pick: 'Right side of heart',
      },
      {
        title: 'The left side: to the body',
        text: 'Oxygen-rich blood from the lungs fills the left atrium, and the left ventricle pumps it into the aorta and on to the whole body. Its wall is the thickest in the heart.',
        only: ['Heart', 'Aorta'], pick: 'Left side of heart',
      },
      {
        title: 'One-way valves',
        text: 'With the walls lifted away, the valves show. Between each atrium and its ventricle: the tricuspid on the right, with three leaflets, and the mitral on the left, with two. They let blood through one way only.',
        only: ['Heart'], out: ['Wall of ventricle', 'Wall of left atrium', 'Wall of right atrium'], pick: 'Tricuspid valve',
      },
      {
        title: 'The aortic and pulmonary valves',
        text: 'At the exits, three cusps each: the aortic valve into the aorta, the pulmonary valve into the pulmonary trunk. They close as the ventricles relax, making the second sound of a heartbeat; the first is the tricuspid and mitral valves closing.',
        only: ['Heart'], out: ['Wall of ventricle', 'Wall of left atrium', 'Wall of right atrium'], pick: 'Aortic valve',
      },
      {
        title: 'The heart feeds itself first',
        text: 'The right and left coronary arteries leave the aorta just above the aortic valve and wrap around the heart. A blocked coronary artery starves part of the heart muscle: a heart attack.',
        only: ['Heart', 'Aorta'], pick: 'Left coronary artery',
      },
    ],
  },
  {
    id: 'breathing',
    title: 'How you breathe',
    blurb: 'From the windpipe down to the lungs, and the muscles that move the air.',
    stops: [
      {
        title: 'The airway',
        text: 'Air passes the larynx, your voice box, and goes down the trachea: a tube held open by C-shaped rings of cartilage, open at the back where it meets the oesophagus.',
        layer: 'organs', only: ['Lungs and airway'], pick: 'Trachea',
      },
      {
        title: 'Two main bronchi',
        text: 'The trachea divides into a main bronchus for each lung. The right one is wider, shorter and steeper, which is why inhaled objects more often end up in the right lung.',
        only: ['Lungs and airway'], pick: 'Right main bronchus proper',
      },
      {
        title: 'Three lobes and two',
        text: 'The right lung has three lobes, the left only two: the left one leaves room for the heart. Inside, the airways branch about 23 times and end in hundreds of millions of air sacs, the alveoli, where oxygen passes into the blood.',
        only: ['Lungs and airway', 'Heart'], pick: 'Right lung',
      },
      {
        title: 'The diaphragm',
        text: 'Breathing in is mostly the diaphragm: this dome of muscle under the lungs flattens as it contracts, the chest grows, and air flows in. At rest, breathing out is passive: the diaphragm relaxes and the lungs recoil.',
        layer: 'muscles', only: ['Diaphragm', 'Lungs and airway'], pick: 'Diaphragm',
      },
      {
        title: 'The muscles between the ribs',
        text: 'The external intercostal muscles lift the ribs to help breathe in; the internal ones pull them down when you breathe out hard, as when you blow or cough.',
        layer: 'skeleton', only: ['Intercostal muscle', 'Skeleton'], pick: 'Intercostal muscle',
      },
    ],
  },
  {
    id: 'knee',
    title: 'The knee',
    blurb: 'The body’s largest joint: bones, menisci, the ligaments that hold it, the muscles that move it.',
    stops: [
      {
        title: 'Three bones',
        text: 'The knee is the body’s largest joint. The femur rests on the tibia, and the patella, the kneecap, glides in front. The fibula, beside the tibia, is not part of the joint.',
        layer: 'skeleton', only: ['Left femur', 'Left tibia', 'Left fibula', 'Left patella'], pick: 'Left femur',
      },
      {
        title: 'The menisci',
        text: 'Two C-shaped pads of cartilage deepen the tibia’s flat top and spread the load. The medial meniscus is fixed to the capsule and the inner ligament, so it can’t move out of the way and tears more often.',
        only: ['Left femur', 'Left tibia', 'Left fibula', 'Left medial meniscus', 'Left lateral meniscus'], out: ['Left femur'], pick: 'Left medial meniscus',
      },
      {
        title: 'The cruciate ligaments',
        text: 'Inside the joint two ligaments cross. The anterior cruciate stops the tibia sliding forward under the femur, the posterior cruciate stops it sliding back. The anterior one is often torn in sport, by a twist or a bad landing.',
        only: ['Left femur', 'Left tibia', 'Left fibula', 'Left anterior cruciate ligament', 'Left posterior cruciate ligament'], pick: 'Left anterior cruciate ligament',
      },
      {
        title: 'The collateral ligaments',
        text: 'One on each side keeps the knee from bending sideways: the tibial collateral ligament on the inside, the fibular collateral ligament on the outside.',
        only: ['Left femur', 'Left tibia', 'Left fibula', 'Left tibial collateral ligament', 'Left fibular collateral ligament'], pick: 'Left tibial collateral ligament',
      },
      {
        title: 'The quadriceps',
        text: 'Four muscles at the front of the thigh straighten the knee: the rectus femoris and the three vasti. Their tendon wraps the patella, which acts as a pulley, and goes on to the tibia as the patellar ligament.',
        layer: 'muscles', only: ['Left rectus femoris', 'Left vastus lateralis', 'Left vastus medialis', 'Left vastus intermedius', 'Left femur', 'Left tibia', 'Left patella'], pick: 'Left rectus femoris',
      },
    ],
  },
  {
    id: 'cranial',
    title: 'The cranial nerves',
    blurb: 'Twelve pairs of nerves straight from the brain: smell, sight, the eyes, the face, the heart and the gut.',
    stops: [
      {
        title: 'Twelve pairs',
        text: 'Most nerves leave the spinal cord; these twelve pairs leave the brain itself, numbered I to XII from front to back.',
        layer: 'organs', only: ['Brain', 'Cranial nerves'], pick: 'Cranial nerves',
      },
      {
        title: 'II: sight',
        text: 'The optic nerve carries what each eye sees to the brain. Behind the eyes the two meet at the optic chiasm, where the fibres from each eye’s inner half cross to the other side.',
        only: ['Brain', 'Cranial nerves', 'Eyes and ears'], pick: 'Left optic nerve',
      },
      {
        title: 'III, IV and VI: moving the eye',
        text: 'Three nerves move the eye. The oculomotor (III) works most of its muscles and lifts the eyelid; the trochlear (IV) and the abducens (VI) each work just one muscle.',
        only: ['Brain', 'Cranial nerves', 'Eyes and ears'], pick: 'Left oculomotor nerve (III)',
      },
      {
        title: 'V: feeling in the face, and chewing',
        text: 'The trigeminal nerve, the largest cranial nerve, carries touch and pain from the face, the teeth and the inside of the mouth and nose, and works the chewing muscles.',
        only: ['Brain', 'Cranial nerves'], pick: 'Left trigeminal nerve (V)',
      },
      {
        title: 'VII: the face’s expressions',
        text: 'The facial nerve works every muscle of facial expression, and carries taste from the front two thirds of the tongue. When it fails on one side, that side of the face droops: Bell’s palsy.',
        only: ['Brain', 'Cranial nerves'], pick: 'Left facial nerve (VII)',
      },
      {
        title: 'X: the wanderer',
        text: 'The vagus nerve goes furthest: down the neck to the heart, the lungs and most of the gut. It slows the heart and keeps digestion going.',
        only: ['Brain', 'Cranial nerves', 'Heart'], pick: 'Left vagus nerve (X)',
      },
      {
        title: 'XII: the tongue',
        text: 'The hypoglossal nerve moves the tongue, for speaking and swallowing. The last of the twelve.',
        only: ['Brain', 'Cranial nerves'], pick: 'Left hypoglossal nerve (XII)',
      },
    ],
  },
];

/**
 * The quiz's parts: what to ask by (its plain name), which parts count as it (either side), the layer it shows in, and
 * its kind, so wrong choices for "What is this?" come from the same kind (a bone is confused with other bones).
 */
export const QUIZ = [
  ...['femur', 'tibia', 'fibula', 'patella', 'humerus', 'radius', 'ulna', 'clavicle', 'scapula', 'hip bone', 'talus', 'calcaneus']
    .map((n) => ({ name: n, parts: [`Left ${n}`, `Right ${n}`], layer: 'skeleton', kind: 'bone' })),
  { name: 'sternum', parts: ['Sternum'], layer: 'skeleton', kind: 'bone' },
  { name: 'sacrum', parts: ['Sacrum'], layer: 'skeleton', kind: 'bone' },
  { name: 'mandible', parts: ['Mandible'], layer: 'skeleton', kind: 'bone' },
  ...['biceps brachii', 'triceps brachii', 'deltoid', 'pectoralis major', 'trapezius', 'sternocleidomastoid', 'gluteus maximus',
    'sartorius', 'gastrocnemius', 'tibialis anterior', 'masseter', 'temporalis', 'frontalis', 'rectus femoris']
    .map((n) => ({ name: n, parts: [`Left ${n}`, `Right ${n}`], layer: 'muscles', kind: 'muscle' })),
  ...['heart', 'liver', 'stomach', 'spleen', 'pancreas', 'gallbladder', 'trachea', 'esophagus', 'appendix', 'transverse colon']
    .map((n) => ({ name: n, parts: [n[0].toUpperCase() + n.slice(1)], layer: 'organs', kind: 'organ' })),
  { name: 'kidney', parts: ['Left kidney', 'Right kidney'], layer: 'organs', kind: 'organ' },
  { name: 'lung', parts: ['Left lung', 'Right lung'], layer: 'organs', kind: 'organ' },
  { name: 'urinary bladder', parts: ['Urinary bladder'], layer: 'organs', kind: 'organ' },
  { name: 'thyroid gland', parts: ['Thyroid gland'], layer: 'organs', kind: 'organ' },
  { name: 'cerebellum', parts: ['Cerebellum'], layer: 'organs', kind: 'organ' },
];
