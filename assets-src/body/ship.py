# Copies the built body into the app (apps/bdy/public/models): the GLBs and body.json, which is tree.json with the
# list of files to load and their sizes (for the loading bar). Run after tree.py and build.py.
#   body-<system>.glb  BodyParts3D's parts of that system (CC BY 4.0)
#   body-za.glb        Z-Anatomy's additions, whatever their system (CC BY-SA 4.0)
import json, os, shutil

HERE = os.path.dirname(os.path.abspath(__file__))
OUT = os.path.join(HERE, 'out')
DEST = os.path.join(HERE, '..', '..', 'apps', 'bdy', 'public', 'models')
os.makedirs(DEST, exist_ok=True)
tree = json.load(open(os.path.join(OUT, 'tree.json')))
files = [s['id'] for s in tree['systems']] + (['za'] if any(n.get('src') == 'za' for n in tree['nodes']) else [])
sizes = {}
for f in files:
    src = os.path.join(OUT, f'body-{f}.glb')
    if not os.path.exists(src):
        continue
    shutil.copy(src, DEST)
    sizes[f] = os.path.getsize(src)
tree['files'] = list(sizes)
tree['sizes'] = sizes
json.dump(tree, open(os.path.join(DEST, 'body.json'), 'w'), separators=(',', ':'))

# What learners read on a part's card (learn_names.py, learn_wiki.py): names from TA2, the lead of each Wikipedia
# article, cut to its first few sentences.
names_p, wiki_p = os.path.join(OUT, 'names.json'), os.path.join(OUT, 'wiki.json')
if os.path.exists(names_p) and os.path.exists(wiki_p):
    import re
    wiki = {}
    # Wikipedia sends many names to an article titled otherwise (247 of 951, read through by hand). The same thing
    # (a plural, "the", "set of", or a true synonym below) is shown as the part's own text; any other article is
    # introduced by its title ("From the article on the rib cage: ..."), so a card never says a general article is
    # about that very part; and the wrong ones below, or a vein sent to an artery's article, are left out.
    SYNONYM = {'buccinator', 'calcaneal tendon', 'deferent duct', 'cerebral arterial circle', 'suspensory ligament of lens',
               'conus elasticus', 'flexor accessorius', 'crural fascia', 'deep brachial artery', 'distal radio-ulnar joint',
               'glenohumeral joint', 'pineal body', 'plantar aponeurosis', 'tentorium cerebelli', 'thyroid gland', 'urinary bladder',
               'vertebral column', 'tibial collateral ligament', 'lateral antebrachial cutaneous nerve', 'medial antebrachial cutaneous nerve',
               'posterior antebrachial cutaneous nerve', 'medial brachial cutaneous nerve', 'lateral femoral cutaneous nerve',
               'posterior femoral cutaneous nerve', 'anterior root of spinal nerve', 'posterior root of spinal nerve', 'obturator externus',
               'obturator internus', 'external oblique', 'superior subscapular nerve', 'inferior subscapular nerve', 'nerve to mylohyoid',
               'nerve to piriformis', 'sural communicating branch of common fibular nerve', 'celiac trunk', 'costocervical artery',
               'thyrocervical artery', 'hepatic portal vein', 'diaphragm', 'lens', 'eyeball', 'teeth', 'bifurcate ligament',
               'great pancreatic artery', 'inferior transverse scapular ligament', 'lateral geniculate body', 'medial geniculate body',
               'lateral ventricle', 'biceps brachii', 'triceps brachii', 'knee joint', 'hip joint', 'elbow joint', 'muscles of facial expression',
               'muscles of eye', 'muscles of hand', 'free upper limb', 'lower limb', 'ilio-inguinal nerve', 'muscles', 'intervertebral disk',
               'arteria princeps pollicis', 'arteria radialis indicis', 'ulnar collateral ligament of wrist joint', 'superior trunk of brachial plexus',
               'ganglia of sympathetic trunk', 'peripheral nerves', 'reproductive organs', 'inferior extensor retinaculum of ankle'}
    WRONG = {'popliteofibular ligament', 'tibiofibular syndesmosis', 'deltoid fascia', 'muscles of foot', 'muscles of neck',
             'inferior pancreatic artery', 'musculophrenic artery', 'thalamoperforating artery', 'lateral intermuscular septum of arm',
             'medial intermuscular septum of arm', 'transverse intermuscular septum of leg'}
    STOP = {'of', 'the', 'muscle', 'muscles', 'bone', 'nerve', 'anatomy', 'part', 'left', 'right', 'human', 'and', 'to', 'in', 'set', 'a'}
    stems = lambda t: {x[:5] for x in re.findall(r'[a-z]+', re.sub(r'\((anatomy|[ivx]+)\)', '', t.lower())) if x not in STOP}
    for k, w in json.load(open(wiki_p)).items():
        if k.startswith('#'):
            wiki[k] = {'title': w['title'], 'url': w['url'], 'text': w['text']}
            continue
        if k in WRONG or re.search(r'\bveins?\b', k) and re.search(r'\barter', w['title'], re.I):
            continue
        sentences = re.findall(r'[^.!?]+[.!?]+(?:\s|$)', w['text']) or [w['text']]
        text = ''
        for x in sentences:
            if text and len(text) + len(x) > 600:
                break
            text += x
        same = k in SYNONYM or stems(k) == stems(w['title'])
        wiki[k] = {'title': w['title'], 'url': w['url'], 'text': text.strip(), **({} if same else {'about': True})}
    names = {k: {f: v[f] for f in ('la', 'es', 'fr', 'pt', 'it') if v.get(f)} for k, v in json.load(open(names_p)).items()}
    json.dump({'names': names, 'wiki': wiki}, open(os.path.join(DEST, 'learn.json'), 'w'), ensure_ascii=False, separators=(',', ':'))
    print('learn.json:', len(names), 'names,', len(wiki), 'descriptions,', round(os.path.getsize(os.path.join(DEST, 'learn.json')) / 1e3), 'kB')
print('shipped', len(sizes), 'files,', round(sum(sizes.values()) / 1e6, 1), 'MB')
