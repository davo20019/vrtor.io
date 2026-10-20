# What each part is, in a sentence or two: the lead of its Wikipedia article (CC BY-SA 4.0, credited with a link on
# every card). For every distinct name (names.json's bases, plus the ones TA2 lacks), the first anatomy article found
# among "<name> (anatomy)", "<name>", "<name> muscle", "<name> bone", "<name> nerve"; a page counts only if it is a
# standard article whose text is about anatomy, so "Atlas" is the vertebra, not the titan.
# Writes out/wiki.json: {base: {title, url, text}}; cached in raw/wiki-cache.json so reruns don't refetch.
import json, os, re, time, urllib.parse, urllib.request
from concurrent.futures import ThreadPoolExecutor

HERE = os.path.dirname(os.path.abspath(__file__))
N = json.load(open(os.path.join(HERE, 'out', 'tree.json')))['nodes']
NAMES = json.load(open(os.path.join(HERE, 'out', 'names.json')))
CACHE_PATH = os.path.join(HERE, 'raw', 'wiki-cache.json')
cache = json.load(open(CACHE_PATH)) if os.path.exists(CACHE_PATH) else {}
UA = 'vrtor.io anatomy atlas builder (https://vrtor.io)'
ANATOMY = re.compile(r'\b(anatom|muscle|bone|nerve|arter|vein|venous|organ|ligament|tendon|cartilage|joint|gland|tissue|brain|'
                     r'lobe|vertebra|skull|cranial|spinal|lymph|duct|valve|ventricle|atrium|cortex|gyrus|sulcus|vessel|fascia|'
                     r'membrane|tract|bursa|human body|thorax|abdom|pelvi|limb|skeleton)', re.I)
from learn_names import base, sided  # noqa: E402  (same normalisation)
# Names with an article under another title, or none where the plain name would find the wrong one.
ALIAS = {'lateral ligament of ankle': 'Lateral collateral ligament of ankle joint', 'deltoid ligament': 'Deltoid ligament',
         'ulnar collateral ligament': 'Ulnar collateral ligament of elbow joint', 'celiac trunk and its branches': 'Celiac artery',
         'popliteal vein and its tributaries': 'Popliteal vein', 'half of cerebral arterial circle': 'Circle of Willis',
         'colliculi': 'Tectum', 'hepatic duct and its tributaries': 'Common hepatic duct', 'linea alba': 'Linea alba (abdomen)', 'nucleus pulposus': 'Nucleus pulposus'}
ALIAS_RE = [(r'^nucleus pulposus\b', 'Nucleus pulposus'), (r'^intervertebral dis[ck]\b', 'Intervertebral disc'),
            (r'tendon sheath|sheaths? of tendons?|synovial sheath', 'Tendon sheath')]


def summary(title):
    if title in cache:
        return cache[title]
    url = 'https://en.wikipedia.org/api/rest_v1/page/summary/' + urllib.parse.quote(title.replace(' ', '_'))
    for attempt in range(3):
        try:
            with urllib.request.urlopen(urllib.request.Request(url, headers={'User-Agent': UA}), timeout=20) as r:
                d = json.load(r)
            out = {'type': d.get('type'), 'title': d.get('title'), 'url': d.get('content_urls', {}).get('desktop', {}).get('page'),
                   'text': d.get('extract', '')}
            break
        except urllib.error.HTTPError as e:
            out = {'type': 'missing'} if e.code == 404 else None
            if out:
                break
            time.sleep(1 + attempt)
        except Exception:
            time.sleep(1 + attempt)
            out = None
    if out is not None:
        cache[title] = out
    return out or {'type': 'error'}


def titles(b):
    """Candidate article titles for a name: TA2's English form first when it differs."""
    t = re.sub(r'\s*\(([ivx]+)\)$', '', b).strip()
    t = re.sub(r'^set of ', '', t)
    t = t[:1].upper() + t[1:]
    cands = [f'{t} (anatomy)', t]
    if not re.search(r'muscle|bone|nerve|artery|vein|ligament', t, re.I):
        cands += [f'{t} muscle', f'{t} bone', f'{t} nerve']
    return cands


def find(b):
    alias = ALIAS.get(b) or next((t for rx, t in ALIAS_RE if re.search(rx, b)), None)
    for t in ([alias] if alias else []) + titles(b):
        s = summary(t)
        if s.get('type') == 'standard' and s.get('text') and ANATOMY.search(s['text']):
            return {'title': s['title'], 'url': s['url'], 'text': s['text']}
    return None


bases = sorted({base(n['name']) for n in N})
# Last resort for a part with no article of its own or above it: what kind of thing it is.
KINDS = {'node': 'Lymph node', 'artery': 'Artery', 'vein': 'Vein', 'nerve': 'Nerve', 'muscle': 'Skeletal muscle', 'ligament': 'Ligament',
         'bone': 'Bone', 'cartilage': 'Hyaline cartilage', 'fascia': 'Fascia', 'bursa': 'Synovial bursa', 'capsule': 'Joint capsule',
         'bronchus': 'Bronchus', 'lung': 'Lung', 'valve': 'Heart valve', 'brain': 'Cerebral cortex', 'whitematter': 'White matter',
         'gut': 'Gastrointestinal tract', 'liver': 'Liver', 'tooth': 'Tooth', 'gland': 'Gland'}
with ThreadPoolExecutor(4) as ex:
    found = dict(zip(bases, ex.map(find, bases)))
# A side that is part of the name ("Left gastric artery", "Right lymphatic duct"): an article titled so, side and all.
def find_sided(full):
    t = full[:1].upper() + full[1:]
    s_ = summary(t)
    side = re.search(r'\b(left|right)\b', full).group(1)
    if s_.get('type') == 'standard' and s_.get('text') and ANATOMY.search(s_['text']) and side in (s_.get('title') or '').lower():
        return {'title': s_['title'], 'url': s_['url'], 'text': s_['text']}
    return None


fulls = sorted({sided(n['name']) for n in N if re.match(r'^(left|right) ', n['name'], re.I)})
with ThreadPoolExecutor(4) as ex:
    found.update({f: w for f, w in zip(fulls, ex.map(find_sided, fulls)) if w})
for tissue, title in KINDS.items():
    s_ = summary(title)
    if s_.get('type') == 'standard':
        found['#' + tissue] = {'title': s_['title'], 'url': s_['url'], 'text': s_['text']}
json.dump(cache, open(CACHE_PATH, 'w'))
wiki = {b: f for b, f in found.items() if f}
json.dump(wiki, open(os.path.join(HERE, 'out', 'wiki.json'), 'w'), ensure_ascii=False, indent=0)
leaves = [n for n in N if 'el' in n]
print(f'[wiki] {len(wiki)} of {len(bases)} names have an article; parts with their own: '
      f'{sum(1 for n in leaves if base(n["name"]) in wiki)} of {len(leaves)}')
