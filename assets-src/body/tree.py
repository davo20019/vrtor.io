# The body's parts as one tree, from BodyParts3D 4.0 (raw/, see SOURCES.md).
#
# Every leaf is one of BodyParts3D's 2,234 element meshes (raw/objisa/*.obj, one OBJ per FJ file id, mm, Z up).
# Above them, the anatomy's own groups: BodyParts3D defines its compound organs as sets of elements, in two trees,
# PART-OF (the heart is its walls, valves and chambers) and IS-A (the left gastrocnemius is a gastrocnemius). The
# tree is the laminar family of those sets: each group either holds another whole or shares nothing with it, so
# taking hold of a group takes everything in it, and nothing else. The groups that don't fit (a class spread
# across the body, like "head of muscle organ") are left out. Under the body come the systems; every element
# belongs to exactly one, by what it is (its IS-A ancestry and name).
#
# Writes out/tree.json: { nodes: [{ id, name, parent, system, tissue?, kids, el? }], systems: [...] }.
import collections, json, os, re

HERE = os.path.dirname(os.path.abspath(__file__))
RAW = os.path.join(HERE, 'raw')
OBJ = os.path.join(RAW, 'objisa', 'isa_BP3D_4.0_obj_99')
# What BodyParts3D lacks, from Z-Anatomy (zexport.py): the face's and the jaw's muscles, the lungs' lobes, glands.
ZEXTRA = os.path.join(RAW, 'zextra')
SOURCES = [(OBJ, 'bp'), (ZEXTRA, 'za')]


def table(name):
    with open(os.path.join(RAW, name), encoding='utf-8') as f:
        rows = [l.rstrip('\n').split('\t') for l in f]
    return rows[1:]


# ---- elements: one OBJ each
elements = {}
for src_dir, src in SOURCES:
    for fn in sorted(os.listdir(src_dir)) if os.path.isdir(src_dir) else []:
        if not fn.endswith('.obj'):
            continue
        e = {'id': fn[:-4], 'name': None, 'fma': None, 'lo': None, 'hi': None, 'src': src}
        with open(os.path.join(src_dir, fn), encoding='utf-8', errors='ignore') as f:
            for line in f:
                if not line.startswith('#'):
                    break
                if line.startswith('# English name'):
                    e['name'] = line.split(':', 1)[1].strip()
                elif line.startswith('# Kind'):
                    e['kind'] = line.split(':', 1)[1].strip()
                elif line.startswith('# Group'):
                    e['zgroup'] = line.split(':', 1)[1].strip()
                elif line.startswith('# Concept ID'):
                    e['fma'] = line.split(':', 1)[1].strip()
                elif line.startswith('# Bounds(mm)'):
                    nums = [float(x) for x in re.findall(r'-?\d+(?:\.\d+)?', line.split(':', 1)[1])]
                    e['lo'], e['hi'] = nums[:3], nums[3:6]
        elements[e['id']] = e

# ---- corrections to BodyParts3D, each checked against where the part actually lies (audit.py; right is -x):
FIXES = {
    # named for the other side: each lies in the other hand / beside the other side of the spine
    'FJ1469': 'Right flexor pollicis brevis', 'FJ1469M': 'Left flexor pollicis brevis',
    'FJ3589': 'Left ascending lumbar vein', 'FJ3493': 'Right ascending lumbar vein',
    # "Right fibular vein": in the left thigh (x +64..+91 mm, 540..718 mm up), the mirror image of the right
    # thigh's "Set of perforating veins" (FJ2192)
    'FJ2190': 'Set of perforating veins',
}
for el, name in FIXES.items():
    elements[el]['name'] = name
    elements[el]['fixed'] = True
# Mislabelled copies, dropped: both "superior epigastric vein" meshes are copies of the superficial epigastric veins
# (same surface within 0.3 mm, 805..933 mm up at the groin), while the superior epigastric vessels run 1,008..1,175 mm
# up beside the rectus. BodyParts3D has no mesh of the real ones.
DROP = {'FJ3615', 'FJ3530'}
for el in DROP:
    del elements[el]

# ---- concepts: sets of elements, and the IS-A ancestry of each concept
sets = {'partof': collections.defaultdict(set), 'isa': collections.defaultdict(set)}
cname = {}
for tree in ('partof', 'isa'):
    for c, n, el in table(f'{tree}_element_parts.txt'):
        if el in elements:
            sets[tree][c].add(el)
            cname[c] = n
isa_up = collections.defaultdict(set)
for p, pn, c, cn in table('isa_inclusion_relation_list.txt'):
    isa_up[c].add(p)
    cname.setdefault(p, pn)
    cname.setdefault(c, cn)
partof_up = collections.defaultdict(set)
for p, pn, c, cn in table('partof_inclusion_relation_list.txt'):
    partof_up[c].add(p)
    cname.setdefault(p, pn)
    cname.setdefault(c, cn)


def ancestors(c, up):
    seen, todo = set(), [c]
    while todo:
        x = todo.pop()
        for p in up.get(x, ()):
            if p not in seen:
                seen.add(p)
                todo.append(p)
    return seen


holders = collections.defaultdict(set)   # element -> every concept made partly of it, in either tree
for tree in ('partof', 'isa'):
    for c, els in sets[tree].items():
        for el in els:
            holders[el].add(c)
GENERIC = {'anatomical entity', 'physical anatomical entity', 'material anatomical entity', 'anatomical structure',
           'anatomical set', 'cardinal organ part', 'organ region', 'organ segment', 'organ zone', 'organ', 'human body', 'body proper'}


def lineage(e):
    """Every name an element is known by: its own, and every concept it is part of."""
    return {e['name'].lower()} | {cname[c].lower() for c in holders[e['id']]}


# A few elements have no name of their own (17): they take the most specific concept they're part of.
for e in elements.values():
    if not e['name']:
        named = [c for c in holders[e['id']] if cname[c] not in GENERIC]
        c = min(named, key=lambda c: (len(sets['isa'].get(c) or sets['partof'].get(c)), cname[c]))
        e['name'] = cname[c][:1].upper() + cname[c][1:]


# The same mesh stored twice or more under different names (the hyoid bone, the cricoid cartilage, the celiac trunk
# three times...): one is kept, so they don't flicker against each other. Kept: the plainest name.
def verts(e):
    path = os.path.join(OBJ if e['src'] == 'bp' else ZEXTRA, e['id'] + '.obj')
    import numpy as np
    return np.array([[float(x) for x in l.split()[1:4]] for l in open(path, errors='ignore') if l.startswith('v ')])


def shape_key(e):
    """Same box to about 2 mm: the candidates, confirmed point by point below."""
    v = verts(e)
    return tuple(np.round(np.concatenate([v.min(0), v.max(0)]) / 2).astype(int)) if len(v) else e['id']


def nearest(va, vb):
    return np.concatenate([np.sqrt(((va[i:i + 400, None, :] - vb[None, :, :]) ** 2).sum(-1)).min(1) for i in range(0, len(va), 400)])


def same_shape(a, b):
    """The same surface: within 0.1 mm everywhere (a copy), or within half a millimetre on the whole both ways (the
    same muscle modelled twice, as the pelvic floor's are)."""
    va, vb = verts(a), verts(b)
    if len(va) == len(vb) and nearest(va, vb).max() <= 0.1:
        return True
    da, db = nearest(va, vb), nearest(vb, va)
    return np.median(da) < 0.6 and np.median(db) < 0.6 and np.percentile(da, 90) < 1.6 and np.percentile(db, 90) < 1.6


import numpy as np
by_key = collections.defaultdict(list)
for e in elements.values():
    by_key[shape_key(e)].append(e)
groups = []
for cands in by_key.values():
    while len(cands) > 1:
        first, rest = cands[0], cands[1:]
        same = [first] + [c for c in rest if same_shape(first, c)]
        if len(same) > 1:
            groups.append(same)
        cands = [c for c in rest if c not in same]
dropped = []
for group in groups:
    keep = min(group, key=lambda e: (e['name'].lower().startswith('set of'), 'part of' in e['name'].lower(), len(e['name']), e['id']))
    for e in group:
        if e is not keep:
            dropped.append((e['id'], e['name'], keep['name']))
            del elements[e['id']]
        else:
            # a dropped twin may have been in groups this one isn't: it stands for them all
            e['twins'] = [x['id'] for x in group if x is not keep]
twin_of = {t: e['id'] for e in elements.values() for t in e.get('twins', ())}

for tree in ('partof', 'isa'):
    for c in sets[tree]:
        sets[tree][c] = {twin_of.get(x, x) for x in sets[tree][c] if twin_of.get(x, x) in elements}
holders = collections.defaultdict(set)
for tree in ('partof', 'isa'):
    for c, els in sets[tree].items():
        for el in els:
            holders[el].add(c)

# ---- systems, by what each element is. Order matters: the first rule an element matches wins.
SYSTEMS = [
    ('skin', 'Skin and hair', [r'\bskin\b', r'integument', r'\bhair\b', r'eyebrow', r'eyelash', r'\bnail\b']),
    ('senses', 'Eyes and ears', [r'eyeball', r'\blens\b', r'vitreous', r'cornea', r'sclera', r'^(left |right )?choroid$', r'\bretina\b', r'\biris\b',
                                 r'ciliary body', r'anterior chamber', r'posterior chamber', r'tarsal plate', r'external ear',
                                 r'\bauricle', r'ossicle', r'cochlea', r'labyrinth', r'tympanic', r'suspensory ligament of .*lens', r'lacrimal']),
    ('heart', 'Heart and vessels', [r'\bheart\b', r'cardiac', r'coronary', r'\bartery\b', r'arterial', r'\bvein\b', r'(?<!hepato)venous',
                                     r'vena cava', r'\baorta', r'atrium', r'ventricle of heart', r'tricuspid', r'mitral', r'papillary muscle',
                                     r'pulmonary trunk', r'\barteria\b', r'arteries', r'veins', r'vasculature', r'cardiovascular', r'vascular', r'\bsinus of', r'valve']),
    ('nerves', 'Brain and nerves', [r'nerv', r'\bbrain', r'cerebr', r'cerebell', r'gyrus', r'lobule', r'\bpons\b', r'medulla oblongata',
                                    r'midbrain', r'thalam', r'hippocamp', r'amygdala', r'(lateral|third|fourth) ventricle', r'spinal cord', r'ganglion', r'neuraxis',
                                    r'corpus callosum', r'fornix', r'commissure', r'colliculus', r'choroid plexus', r'gray matter', r'grey matter',
                                    r'white matter', r'basal nuclei', r'putamen', r'caudate nucleus', r'globus pallidus', r'insula', r'tuber cinereum',
                                    r'mammillary', r'pineal', r'interpeduncular', r'lamina terminalis', r'interventricular foramen', r'cistern']),
    ('lungs', 'Lungs and airway', [r'respiratory', r'bronch', r'trachea', r'\blung', r'larynx', r'laryngeal', r'epiglott', r'cricoid',
                                   r'thyroid cartilage', r'arytenoid', r'conus elasticus', r'corniculate', r'cuneiform cartilage', r'vocal ligament', r'cricothyroid',
                                   r'thyro-epiglottic', r'hyo-epiglottic', r'nasal cavity', r'pleura']),
    ('gut', 'Digestive system', [r'alimentary', r'digestive', r'stomach', r'intestin', r'duoden', r'jejun', r'ileum', r'\bcolon', r'caecum', r'cecum',
                                 r'rectum', r'\banal\b', r'\banus', r'oesophag', r'esophag', r'\bliver\b', r'hepat', r'biliary', r'gallbladder',
                                 r'pancrea', r'tongue', r'\btooth', r'teeth', r'salivary', r'parotid', r'submandibular gland', r'sublingual gland',
                                 r'pharyn', r'hepatovenous', r'\blip\b', r'mesocolon', r'taenia', r'appendix', r'peritone', r'omentum', r'\bpalate\b', r'palato', r'glossus', r'uvula', r'spleen', r'splenic']),
    ('urinary', 'Kidneys and bladder', [r'urinary', r'kidney', r'renal', r'ureter', r'bladder', r'urethra']),
    ('repro', 'Reproductive organs', [r'genital', r'deferent duct', r'penis', r'testis', r'scrot', r'prostat', r'seminal', r'ductus deferens', r'epididym', r'spermatic']),
    ('glands', 'Glands', [r'endocrine', r'thyroid gland', r'parathyroid', r'suprarenal gland', r'adrenal', r'pituitary', r'hypophysis', r'thymus']),
    ('muscles', 'Muscles', [r'muscle', r'\bhead of .*(biceps|triceps|gastrocnemius|quadriceps|flexor|extensor|pronator)', r'deltoid', r'pectoralis',
                            r'trapezius', r'latissimus', r'gluteus', r'rectus', r'oblique', r'sphincter', r'diaphragm', r'tendon', r'aponeuros',
                            r'longus colli', r'intertransversari', r'lumbrical', r'interosseous', r'abductor', r'adductor', r'flexor', r'extensor',
                            r'levator', r'depressor', r'constrictor', r'serratus', r'rhomboid', r'subclavius', r'transversus', r'scalene',
                            r'masseter', r'temporalis', r'pterygoid', r'sartorius', r'gracilis', r'soleus', r'plantaris', r'popliteus',
                            r'tensor', r'piriformis', r'gemellus', r'obturator', r'iliacus', r'psoas', r'quadratus', r'multifidus', r'rotatores',
                            r'semispinalis', r'spinalis', r'longissimus', r'iliocostalis', r'splenius', r'platysma', r'orbicularis', r'zygomaticus',
                            r'buccinator', r'mentalis', r'risorius', r'procerus', r'nasalis', r'frontalis', r'occipitalis', r'stylohyoid', r'digastric',
                            r'mylohyoid', r'geniohyoid', r'sternohyoid', r'omohyoid', r'thyrohyoid', r'sternothyroid', r'sternocleidomastoid', r'supinator',
                            r'brachialis', r'brachioradialis', r'anconeus', r'coracobrachialis', r'teres', r'supraspinatus', r'infraspinatus',
                            r'subscapularis', r'palmaris', r'opponens', r'pectineus', r'vastus', r'tibialis', r'fibularis', r'peroneus', r'hallucis',
                            r'digitorum', r'pollicis', r'digiti minimi', r'intercostal', r'subcostal', r'cremaster', r'fascia', r'retinaculum',
                            r'interossei', r'interspinales', r'tendinous ring', r'raphe', r'linea alba', r'musculature',
                            r'corrugator', r'temporoparietalis', r'epicranial']),
    # Z-Anatomy's additions placed by zplace.py carry their kind; these two systems are only theirs.
    ('lymph', 'Lymph nodes', [r'\bnodes?\b', r'tonsil', r'lymph']),
    ('fascia', 'Fascia and bursae', [r'fascia', r'bursa', r'tendon sheath', r'retinacul']),
    ('skeleton', 'Skeleton', [r'bone', r'skelet', r'vertebra', r'\brib\b', r'costal cartilage', r'sternum', r'manubrium', r'xiphoid', r'sacrum', r'coccyx',
                              r'skull', r'cranium', r'mandible', r'maxilla', r'clavicle', r'scapula', r'humerus', r'radius', r'ulna', r'carpal', r'scaphoid',
                              r'lunate', r'triquetr', r'pisiform', r'trapezi', r'capitate', r'hamate', r'metacarp', r'phalan', r'femur', r'patella',
                              r'tibia', r'fibula', r'talus', r'calcaneus', r'navicular', r'cuboid', r'cuneiform', r'metatars', r'hip bone', r'pelvi',
                              r'vomer', r'ethmoid', r'sphenoid', r'temporal bone', r'occipital bone', r'parietal bone', r'frontal bone', r'zygomatic bone',
                              r'nasal bone', r'lacrimal bone', r'palatine bone', r'hyoid', r'cartilage', r'ligament', r'joint', r'meniscus', r'disc',
                              r'interosseous membrane', r'symphysis', r'septal nasal']),
]
SYSTEM_RE = [(k, label, [re.compile(p) for p in pats]) for k, label, pats in SYSTEMS]


def system_of_name(name):
    n = name.lower()
    for k, label, pats in SYSTEM_RE:
        if any(p.search(n) for p in pats):
            return k
    return None


KIND_SYSTEM = {'joint': 'skeleton', 'nerve': 'nerves', 'lymph': 'lymph', 'fascia': 'fascia'}


def system_of(e):
    if e.get('kind') in KIND_SYSTEM:
        return KIND_SYSTEM[e['kind']]
    # Its own name first (the "Septal papillary muscle of right ventricle" is the heart's), then what it is.
    own = e['name'].lower()
    for k, label, pats in SYSTEM_RE:
        if any(p.search(own) for p in pats):
            return k
    names = lineage(e)
    for k, label, pats in SYSTEM_RE:
        if any(p.search(n) for p in pats for n in names):
            return k
    return None


# ---- tissue: what each element looks like (out/materials in build.py)
TISSUES = [
    ('hair', [r'\bhair\b', r'eyebrow', r'eyelash']),
    ('skin', [r'\bskin\b', r'external ear', r'auricle', r'\blip\b']),
    ('lens', [r'\blens\b', r'vitreous', r'cornea', r'anterior chamber', r'posterior chamber', r'suspensory ligament']),
    ('sclera', [r'sclera', r'eyeball']),
    ('eyedark', [r'^(left |right )?choroid$', r'\bretina\b', r'\biris\b', r'ciliary']),
    ('tooth', [r'\btooth', r'teeth', r'enamel', r'dentine']),
    ('cartilage', [r'cartilage', r'meniscus', r'intervertebral dis[ck]', r'epiglott', r'tarsal plate', r'septal nasal']),
    ('ligament', [r'ligament', r'iliotibial', r'tendinous', r'raphe', r'linea alba', r'conus elasticus', r'tendon', r'aponeuros', r'fascia', r'retinaculum', r'interosseous membrane', r'membrane', r'chordae']),
    ('bone', [r'bone', r'vertebra', r'\brib\b', r'sternum', r'sacrum', r'coccyx', r'skull', r'mandible', r'maxilla', r'clavicle', r'scapula',
              r'humerus', r'radius', r'ulna', r'carpal', r'scaphoid', r'lunate', r'triquetr', r'pisiform', r'trapezi', r'capitate', r'hamate',
              r'metacarp', r'phalan', r'femur', r'patella', r'tibia', r'fibula', r'talus', r'calcaneus', r'navicular', r'cuboid', r'cuneiform',
              r'metatars', r'vomer', r'ethmoid', r'sphenoid', r'hyoid', r'xiphoid', r'manubrium']),
    ('valve', [r'leaflet', r'cusp', r'valve']),
    ('blood', [r'^cavity of (left|right) (atrium|ventricle)']),
    ('heart', [r'\bheart\b', r'atrium', r'ventricle of heart', r'wall of', r'papillary muscle', r'myocard', r'interventricular septum', r'interatrial']),
    ('vein', [r'\bveins?\b', r'venous', r'vena cava', r'\bsinus\b']),
    ('artery', [r'artery', r'\barteria\b', r'arteries', r'arterial', r'aorta', r'pulmonary trunk', r'\barteria\b', r'arteries']),
    ('nerve', [r'nerv', r'ganglion', r'spinal cord', r'chiasm', r'\btract\b']),
    ('whitematter', [r'white matter', r'corpus callosum', r'fornix', r'commissure', r'internal capsule', r'brachium', r'peduncle', r'lamina terminalis']),
    ('ventricle', [r'ventricle', r'interventricular foramen', r'aqueduct', r'cistern', r'interpeduncular fossa']),
    ('brain', [r'brain', r'cerebr', r'cerebell', r'gyrus', r'lobule', r'pons', r'medulla oblongata', r'midbrain', r'thalam', r'hippocamp', r'amygdala',
               r'colliculus', r'putamen', r'caudate', r'pallidus', r'insula', r'tuber cinereum', r'mammillary', r'pineal', r'choroid plexus', r'nucleus',
               r'gray matter', r'grey matter', r'cuneus', r'precuneus', r'pole', r'operculum', r'uncus', r'claustrum', r'hypothalam']),
    ('bronchus', [r'bronch', r'trachea', r'larynx', r'laryngeal', r'cricoid', r'arytenoid']),
    ('lung', [r'\blung', r'pleura', r'lobe of (right|left) lung']),
    ('liver', [r'liver', r'hepat', r'caudate lobe', r'quadrate lobe']),
    ('bile', [r'biliary', r'bile', r'gallbladder', r'cystic duct']),
    ('spleen', [r'spleen']),
    ('kidney', [r'kidney', r'renal (cortex|medulla|pelvis|pyramid)']),
    ('pancreas', [r'pancrea']),
    ('gland', [r'gland', r'thymus', r'pituitary', r'hypophysis', r'suprarenal', r'adrenal']),
    ('tongue', [r'tongue']),
    ('stomach', [r'stomach', r'gastric', r'oesophag', r'esophag', r'pharyn']),
    ('gut', [r'intestin', r'duoden', r'jejun', r'ileum', r'colon', r'caecum', r'cecum', r'rectum', r'appendix', r'anal canal', r'taenia', r'mesocolon',
             r'omentum', r'peritone', r'mesentery']),
    ('bladder', [r'bladder', r'ureter', r'urethra']),
    ('repro', [r'deferent duct', r'penis', r'testis', r'scrot', r'prostat', r'seminal', r'ductus deferens', r'epididym', r'spermatic', r'glans', r'corpus (cavernosum|spongiosum)']),
    ('capsule', [r'capsule', r'synovial']),
    ('node', [r'\bnodes?\b', r'tonsil', r'lymph']),
    ('bursa', [r'bursa', r'tendon sheath', r'sheath of', r'sheaths']),
    ('fascia', [r'fascia', r'retinacul', r'septum', r'aponeuros', r'dura', r'fibrous sheath']),
    ('muscle', [r'muscle', r'sphincter', r'diaphragm', r'uvula', r'constrictor', r'pharyngeus', r'glossus']),
]
TISSUE_RE = [(k, [re.compile(p) for p in pats]) for k, pats in TISSUES]
DEFAULT_TISSUE = {'lymph': 'node', 'fascia': 'fascia', 'skin': 'skin', 'senses': 'sclera', 'heart': 'artery', 'nerves': 'brain', 'lungs': 'bronchus', 'gut': 'gut',
                  'urinary': 'bladder', 'repro': 'repro', 'glands': 'gland', 'muscles': 'muscle', 'skeleton': 'bone'}


# Which tissues each system can hold, so a vessel named for a bone ("ulnar artery") stays a vessel and the
# trapezius stays a muscle, not the trapezium.
SYSTEM_TISSUES = {
    'skin': ['hair', 'skin'],
    'senses': ['lens', 'sclera', 'eyedark', 'cartilage', 'skin', 'nerve', 'gland', 'bone', 'muscle'],
    'heart': ['blood', 'valve', 'heart', 'vein', 'artery'],
    'nerves': ['fascia', 'nerve', 'whitematter', 'ventricle', 'brain'],
    'lungs': ['cartilage', 'ligament', 'lung', 'bronchus', 'muscle'],
    'gut': ['tooth', 'liver', 'bile', 'spleen', 'pancreas', 'gland', 'tongue', 'muscle', 'stomach', 'skin', 'ligament', 'bone', 'gut'],
    'urinary': ['kidney', 'gland', 'bladder'],
    'repro': ['repro'],
    'glands': ['gland'],
    'muscles': ['ligament', 'muscle'],
    'skeleton': ['tooth', 'capsule', 'cartilage', 'ligament', 'bone'],
    'lymph': ['node'],
    'fascia': ['bursa', 'fascia'],
}


def tissue_of(e, system):
    own = e['name'].lower()
    if e.get('kind') == 'joint':
        if re.search(r'capsule|synovial', own):
            return 'capsule'
        return 'cartilage' if re.search(r'menisc|labrum|disc|cartilage', own) else 'ligament'
    if e.get('kind') == 'nerve':
        return 'fascia' if re.search(r'dura|arachnoid|pia|filum', own) else 'nerve'
    allowed = SYSTEM_TISSUES[system]
    for k, pats in TISSUE_RE:
        if k in allowed and any(p.search(own) for p in pats):
            return k
    # The systems that are mostly one tissue: anything in them that isn't named for another.
    return DEFAULT_TISSUE[system]


unassigned = []
for e in elements.values():
    e['system'] = system_of(e)
    if not e['system']:
        unassigned.append(e['name'])
        continue
    e['tissue'] = tissue_of(e, e['system'])
    e['x'] = (e['lo'][0] + e['hi'][0]) / 2

# ---- groups: every concept's set of elements, kept to one system, split left from right where the concept is both
SIDE = re.compile(r'^(left|right)\b|\b(of|to) (left|right)\b|\b(left|right) (side|half)\b', re.I)


def side_of(name):
    n = name.lower()
    if re.search(r'\bleft\b', n):
        return 'left'
    if re.search(r'\bright\b', n):
        return 'right'
    return None


def extent(els):
    lo = [min(elements[e]['lo'][i] for e in els) for i in range(3)]
    hi = [max(elements[e]['hi'][i] for e in els) for i in range(3)]
    return max(hi[i] - lo[i] for i in range(3))


OF_SYSTEM = {'skin': 'skin', 'senses': 'sense organs', 'heart': 'vessels', 'nerves': 'nerves', 'lungs': 'airways', 'gut': 'digestive organs',
             'urinary': 'urinary organs', 'repro': 'reproductive organs', 'glands': 'glands', 'muscles': 'muscles', 'skeleton': 'bones'}
cands = []   # (elements frozenset, name, source rank)
for rank, tree in enumerate(('partof', 'isa')):
    for c, els in sets[tree].items():
        els = {e for e in els if elements[e]['system']}
        if len(els) < 2:
            continue
        by_sys = collections.defaultdict(set)
        for e in els:
            by_sys[elements[e]['system']].add(e)
        name = cname[c]
        for s, group in by_sys.items():
            if len(group) < 2:
                continue
            # A thing split across systems: its vessels, its bones ("Vessels of upper lobe of right lung").
            own = system_of_name(cname[c])
            if tree == 'partof' and len(by_sys) > 1 and (s != own if own else len(group) < max(len(g) for g in by_sys.values())):
                name = f'{OF_SYSTEM[s]} of {cname[c]}'
            else:
                name = cname[c]
            if side_of(name):
                cands.append((frozenset(group), name, rank, cname[c]))
                continue
            sides = collections.defaultdict(set)
            for e in group:
                sides[side_of(elements[e]['name']) or 'mid'].add(e)
            if sides.get('left') and sides.get('right'):
                for sd in ('left', 'right'):
                    g = sides[sd] | (set() if sides.get('mid') is None else set())
                    if len(g) >= 2:
                        cands.append((frozenset(g), f'{sd} {name}', rank + 0.5, cname[c]))
                # the whole of both sides, too, only from PART-OF (the larynx, the brain): an IS-A class across
                # both sides is two things, not one
                if tree == 'partof':
                    cands.append((frozenset(group), name, rank, cname[c]))
            else:
                cands.append((frozenset(group), name, rank, cname[c]))

# A muscle in parts ("Clavicular part of left deltoid", "Long head of left biceps brachii") is one muscle:
# its parts make a group named for it ("Left deltoid").
PARTS_OF = re.compile(r'^(?:.+?) (?:head|part|belly|portion) of ((?:left|right) )?(.+)$', re.I)
muscle_parts = collections.defaultdict(set)
for e in elements.values():
    if e['system'] != 'muscles':
        continue
    m = PARTS_OF.match(e['name'])
    if m:
        muscle_parts[((m.group(1) or '').lower() + m.group(2).lower()).strip()].add(e['id'])
for mname, els in muscle_parts.items():
    if len(els) >= 2:
        cands.append((frozenset(els), mname, 0.25, mname))

# Organs BodyParts3D has no single concept for, made from what's in them.
CRANIAL = re.compile(r'\((?:[ivx]+)\)|trigeminal|vagus|facial nerve|oculomotor|olfactory|abducens|trochlear|glossopharyngeal|'
                     r'hypoglossal|accessory nerve|ophthalmic|maxillary nerve|mandibular nerve|lingual nerve|alveolar|chorda tympani')
def is_cranial(e):
    """A cranial nerve or a branch of one: by its name, or the nerve Z-Anatomy files it under (the vagus's branches)."""
    return bool(CRANIAL.search(e['name'].lower()) or CRANIAL.search(e.get('zgroup', '').lower()))


SKULL = re.compile(r'neurocranium|maxilla|zygomatic bone|palatine bone|mandible|sphenoid bone|nasal bone|vomer|ethmoid|frontal bone|'
                   r'occipital bone|parietal bone|temporal bone|nasal concha|nasal cartilage|alar cartilage|septal nasal')
FACIAL = re.compile(r'buccinator|corrugator|depressor (anguli oris|labii|septi)|epicranial|frontalis|levator (anguli oris|labii)|mentalis|'
                    r'nasalis|occipitalis|orbicularis|procerus|risorius|temporoparietalis|zygomaticus')
CHEWING = re.compile(r'masseter|temporalis$|pterygoid')
LARYNX = re.compile(r'arytenoid|cricoid|crico-|thyroid cartilage|epiglott|vocal|conus elasticus|thyro-|corniculate|aryepiglottic')
SYNTH = [
    ('nerves', 'brain', lambda e: e['tissue'] in ('brain', 'whitematter', 'ventricle')),
    ('nerves', 'left cerebral hemisphere', lambda e: e['tissue'] in ('brain', 'whitematter') and side_of(e['name']) == 'left'),
    ('nerves', 'right cerebral hemisphere', lambda e: e['tissue'] in ('brain', 'whitematter') and side_of(e['name']) == 'right'),
    ('nerves', 'cranial nerves', lambda e: e['tissue'] == 'nerve' and (e['src'] == 'bp' or is_cranial(e))),
    ('nerves', 'peripheral nerves', lambda e: e.get('kind') == 'nerve' and e['tissue'] == 'nerve' and not is_cranial(e)),
    ('lungs', 'larynx', lambda e: LARYNX.search(e['name'].lower())),
    ('skeleton', 'skull', lambda e: SKULL.search(e['name'].lower())),
    # The face's muscles (Z-Anatomy's; BodyParts3D has none) and the jaw's.
    ('muscles', 'muscles of facial expression', lambda e: FACIAL.search(e['name'].lower())),
    ('muscles', 'muscles of mastication', lambda e: CHEWING.search(e['name'].lower())),
    ('lungs', 'airway', lambda e: e['tissue'] in ('bronchus',) or 'trachea' in e['name'].lower() or 'bronch' in e['name'].lower()),
    ('heart', 'arteries', lambda e: e['tissue'] == 'artery' and 'coronary' not in e['name'].lower()),
    ('heart', 'veins', lambda e: e['tissue'] == 'vein' and 'cardiac' not in e['name'].lower() and 'coronary' not in e['name'].lower()),
]
# Z-Anatomy's own grouping of what zplace.py added ("Knee joint", "Sciatic nerve", "Superior trunk of brachial plexus").
zg = collections.defaultdict(set)
for e in elements.values():
    if e.get('zgroup') and e['system']:
        zg[(e['system'], e['zgroup'])].add(e['id'])
for (system, gname), els in zg.items():
    sides = collections.defaultdict(set)
    for x in els:
        sides[side_of(elements[x]['name']) or 'mid'].add(x)
    if sides.get('left') and sides.get('right'):
        # a joint or a nerve of both sides is two: "Left elbow joint", "Right elbow joint"
        for sd in ('left', 'right'):
            if len(sides[sd]) >= 2 or (len(sides[sd]) == 1 and len(els) > 2):
                cands.append((frozenset(sides[sd]), f'{sd} {gname[0].lower()}{gname[1:]}', 0.15, gname))
    elif len(els) >= 2:
        cands.append((frozenset(els), gname, 0.15, gname))

for system, gname, pred in SYNTH:
    els = {e['id'] for e in elements.values() if e['system'] == system and pred(e)}
    if len(els) >= 2:
        cands.append((frozenset(els), gname, 0.1, gname))

# One name per set: PART-OF's over IS-A's, then the shortest.
best = {}
for els, name, rank, orig in cands:
    k = els
    if k not in best or (rank, len(name)) < (best[k][1], len(best[k][0])):
        best[k] = (name, rank, orig)

# A group must be a thing, not a class. PART-OF's are things, except the catch-alls. An IS-A class is kept
# when every part in it says so in its own name (all of "head of gastrocnemius"'s words are in "Medial head of
# right gastrocnemius"), or when it's a body region's muscles, bones, vessels or nerves ("muscle of free lower
# limb"). Either way it must hang together: no wider than this, or it's spread across the body.
MAX_EXTENT_MM = 750
STOP = {'of', 'the', 'and', 'left', 'right', 'to', 'set'}
REGIONAL = re.compile(r'^(left |right )?(muscle|bone|artery|vein|nerve|tributary|branch)s? of ')
CATCHALL = re.compile(r'\b(anatomical|entity|organ|organs|set|structure|region|segment|subdivision|zone|component|cluster|'
                      r'system|human body|body proper|neuraxis|tree|cavitated|part|portion|layer|wall)\b$|^(left |right )?(organ|anatomical)')
BODY_REGION = re.compile(r'part of head|head proper|^face$|mediastinum|^back of|abdomen|chest|^thorax|^neck|^posterior chest|'
                         r'^(anterior|posterior|lateral|medial) (part|region|side) of|subcortex|^respiratory tract$')
GENERIC_GROUPS = {'nerve', 'nerves', 'joints', 'ligaments', 'artery', 'vein', 'muscle', 'bone', 'organ', 'human body', 'body proper', 'trunk', 'head', 'neck', 'thorax', 'abdomen', 'pelvis', 'back',
                  'vasculature of body', 'integument', 'musculoskeletal system', 'deep fascial system'}


def words(n):
    return {w for w in re.findall(r'[a-z]+', n.lower()) if w not in STOP}


groups = []
for els, (name, rank, orig) in best.items():
    base = re.sub(r'^(left|right) ', '', orig.lower())
    if base in GENERIC_GROUPS or CATCHALL.search(base) and not REGIONAL.search(base):
        continue
    # Regions of the trunk and head cut across organs (the "frontal part of head" holds half a brain): the organs win.
    if rank < 1 and BODY_REGION.search(base):
        continue
    if rank >= 1:
        if extent(els) > MAX_EXTENT_MM:
            continue
        w = words(name)
        if not REGIONAL.search(base) and not all(w <= words(elements[e]['name']) for e in els):
            continue
    groups.append((els, name, rank))

# Laminar: PART-OF first, smallest first, then IS-A; a group that overlaps one already taken without holding it
# whole (or being held whole) is left out.
groups.sort(key=lambda g: (g[2] >= 1, len(g[0])))
taken = []
for els, name, rank in groups:
    ok = True
    for t, _, _ in taken:
        inter = els & t
        if inter and inter != els and inter != t:
            ok = False
            break
    if ok:
        taken.append((els, name, rank))

# ---- the tree
nodes = []
def add(name, parent, system, **kw):
    n = {'id': len(nodes), 'name': name, 'parent': parent, 'system': system, 'kids': [], **kw}
    nodes.append(n)
    if parent is not None:
        nodes[parent]['kids'].append(n['id'])
    return n['id']


PLURAL = {'muscle': 'muscles', 'bone': 'bones', 'artery': 'arteries', 'vein': 'veins', 'nerve': 'nerves', 'tooth': 'teeth',
          'interosseous': 'interossei', 'lumbrical': 'lumbricals', 'branch': 'branches', 'tributary': 'tributaries'}


def nice(name):
    """Groups read as what they hold: "Left muscle of forearm" -> "Muscles of left forearm", "Left tooth" -> "Left teeth"."""
    n = name
    m = re.match(r'^(left|right) (\w+) of (.+)$', n)
    if m and m.group(2) in PLURAL:
        n = f'{PLURAL[m.group(2)]} of {m.group(1)} {m.group(3)}'
    m = re.match(r'^(left |right )?(\w+)( of .+)?$', n)
    if m and m.group(2) in PLURAL and not n.startswith(PLURAL[m.group(2)]):
        n = f'{m.group(1) or ""}{PLURAL[m.group(2)]}{m.group(3) or ""}'
    return n[:1].upper() + n[1:]


root = add('Human body', None, None)
sys_node = {}
for k, label, _ in SYSTEMS:
    if any(e['system'] == k for e in elements.values()):
        sys_node[k] = add(label, root, k)

# Each group's parent is the smallest taken group holding it whole, in its system; else the system.
taken.sort(key=lambda g: -len(g[0]))
gid = {}
for els, name, rank in taken:
    s = elements[next(iter(els))]['system']
    parent = sys_node[s]
    for other, oname, _ in reversed([t for t in taken if len(t[0]) > len(els)]):
        if els < other and other in gid:
            parent = gid[other]
            break
    gid[els] = add(nice(name), parent, s, group=True)

# A part no group names (most come from IS-A only) goes where the anatomy says it belongs, when it's clear
# from its name: the heart's wall into the heart, the deep brain into the brain, the larynx's small cartilages
# and muscles into the larynx. The rest stay directly under their system.
ADOPT = [
    (r'^wall of ventricle$', 'Heart'),
    (r'thalamus|putamen|caudate nucleus|globus pallidus|insula$|amygdala|corpus callosum|fornix|geniculate body|optic tract|'
     r'stria medullaris|septum of telencephalon|commissure|tentorium|central canal|brachium of', 'Brain'),
    (r'arytenoid|cricothyroid|crico-arytenoid|vocal|conus elasticus|corniculate|thyro-epiglottic|thyrohyoid', 'Larynx'),
    (r'eyeball|retina|corona ciliaris|lacrimal', '{side} eye'),
    # A lobe's tissue (Z-Anatomy's) goes in with that lobe's airways (BodyParts3D's): taking the lobe takes both.
    (r'^tissue of upper lobe of left lung', 'Upper lobe of left lung'),
    (r'^tissue of lower lobe of left lung', 'Lower lobe of left lung'),
    (r'^tissue of upper lobe of right lung', 'Upper lobe of right lung'),
    (r'^tissue of middle lobe of right lung', 'Middle lobe of lung'),
    (r'^tissue of lower lobe of right lung', 'Lower lobe of right lung'),
    (r'^spleen$', None),
]
ADOPT_RE = [(re.compile(p), g) for p, g in ADOPT]
group_by_name = {}
for els, gname, _ in taken:
    group_by_name.setdefault(nice(gname), gid[els])
adopted = []
for e in sorted(elements.values(), key=lambda e: e['name']):
    if not e['system']:
        continue
    holders = [g for g in gid if e['id'] in g]
    if holders:
        parent = gid[min(holders, key=len)]
    else:
        parent = sys_node[e['system']]
        for rx, target in ADOPT_RE:
            if rx.search(e['name'].lower()):
                if target and '{side}' in target:
                    sd = side_of(e['name']) or ('right' if 'right' in e['name'].lower() else None)
                    target = target.replace('{side}', sd.capitalize()) if sd else None
                if target and target in group_by_name and nodes[group_by_name[target]]['system'] == e['system']:
                    parent = group_by_name[target]
                    adopted.append((e['name'], target))
                break
    add(nice(e['name']), parent, e['system'], el=e['id'], tissue=e['tissue'])

# A group with one thing in it is that thing; a group named exactly like its only... (collapse single-child chains)
def collapse():
    changed = True
    while changed:
        changed = False
        for n in nodes:
            if n.get('group') and not n.get('gone') and len(n['kids']) == 1:
                kid = nodes[n['kids'][0]]
                p = nodes[n['parent']]
                p['kids'][p['kids'].index(n['id'])] = kid['id']
                kid['parent'] = p['id']
                n['gone'] = True
                n['kids'] = []
                changed = True
collapse()

# Renumber without the collapsed ones, children by name.
alive = [n for n in nodes if not n.get('gone')]
new = {n['id']: i for i, n in enumerate(alive)}
out = []
for n in alive:
    m = {'id': new[n['id']], 'name': n['name'], 'parent': None if n['parent'] is None else new[n['parent']]}
    if n['system']:
        m['system'] = n['system']
    if 'el' in n:
        m['el'] = n['el']
        m['tissue'] = n['tissue']
        if elements[n['el']]['src'] != 'bp':
            m['src'] = elements[n['el']]['src']
    m['kids'] = sorted((new[k] for k in n['kids']), key=lambda k: alive[k]['name'])
    out.append(m)
# Parts that share a name with each other or with their group ("Set of perforating veins" in "Set of perforating
# veins") are told apart by number: "Set of perforating veins, 2 of 5".
for m in out:
    names = collections.Counter(out[k]['name'] for k in m['kids'])
    seen = collections.Counter()
    for k in m['kids']:
        nm = out[k]['name']
        if names[nm] > 1 or nm == m['name']:
            seen[nm] += 1
            out[k]['name'] = f'{nm}, {seen[nm]} of {names[nm]}' if names[nm] > 1 else f'{nm}, main part'

os.makedirs(os.path.join(HERE, 'out'), exist_ok=True)
with open(os.path.join(HERE, 'out', 'tree.json'), 'w') as f:
    json.dump({'source': 'BodyParts3D 4.0, (c) The Database Center for Life Science, CC BY 4.0',
               'systems': [{'id': k, 'name': label, 'node': new[sys_node[k]]} for k, label, _ in SYSTEMS if k in sys_node],
               'nodes': out}, f, separators=(',', ':'))

# ---- report
counts = collections.Counter(e['system'] for e in elements.values())
tissues = collections.Counter(e.get('tissue') for e in elements.values())
depth = {}
for n in out:
    d, p = 0, n['parent']
    while p is not None:
        d, p = d + 1, out[p]['parent']
    depth[n['id']] = d
print('elements', len(elements), 'unassigned', len(unassigned))
print('systems', dict(counts))
print('tissues', dict(tissues))
print('nodes', len(out), 'groups', sum(1 for n in out if 'el' not in n), 'max depth', max(depth.values()))
print('adopted', len(adopted)); print('fixed', len(FIXES), 'dropped twins', len(dropped)); [print('   drop', d) for d in dropped]
if unassigned:
    print('UNASSIGNED', sorted(set(unassigned))[:200])
