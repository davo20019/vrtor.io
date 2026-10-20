# The learner's names for every part and group: its plain name without side or numbering ("masseter" for "Superficial
# part of left masseter"'s muscle, "femur" for "Left femur"), and from Terminologia Anatomica 2 (Z-Anatomy's TA2.csv,
# CC BY-SA 4.0) its Latin name and its name in Spanish, French, Portuguese and Italian where TA2 has the same term.
# Writes out/names.json: {base: {la, es, fr, pt, it, ta}} and prints how many parts are covered.
import csv, json, os, re

HERE = os.path.dirname(os.path.abspath(__file__))
N = json.load(open(os.path.join(HERE, 'out', 'tree.json')))['nodes']


def base(name):
    """'Superficial part of left masseter' -> 'superficial part of masseter'; 'Left femur, 2 of 3' -> 'femur'."""
    n = re.sub(r', (\d+ of \d+|main part)$', '', name)
    n = re.sub(r'\b(left|right)\s+', '', n, flags=re.I)
    return re.sub(r'\s+', ' ', n).strip().lower()


def sided(name):
    """'Left gastric artery, 2 of 3' -> 'left gastric artery': the name without its numbering, side kept."""
    return re.sub(r'\s+', ' ', re.sub(r', (\d+ of \d+|main part)$', '', name)).strip().lower()


def main():
    ta = {}
    with open(os.path.join(HERE, 'raw', 'zanatomy', 'TA2.csv'), encoding='utf-8-sig', errors='ignore') as f:
        for line in f:
            row = line.strip().strip('"').split(';')
            if len(row) < 7 or not row[0].isdigit():
                continue
            en = row[1].strip().lower()
            rec = {'ta': row[0], 'la': row[2].strip(), 'fr': row[3].strip(), 'es': row[4].strip(), 'pt': row[5].strip(), 'it': row[6].strip()}
            ta.setdefault(en, rec)


    def variants(b):
        """Ways TA2 may write the same term: with or without 'muscle'/'bone', the singular, without a roman numeral."""
        vs = [b, re.sub(r'\s*\([ivx]+\)$', '', b), b + ' muscle', re.sub(r' muscle$', '', b), b + ' bone', re.sub(r' bone$', '', b),
              re.sub(r'^set of ', '', b), re.sub(r'disk', 'disc', b)]
        if b.endswith('s'):
            vs.append(b[:-1])
        m = re.match(r'^(.*) of (.*)$', b)
        return list(dict.fromkeys(v for v in vs if v))


    # TA2.csv's own mistakes, as Terminologia Anatomica writes them: a term given another's Latin (the arm's nerve the
    # thigh's, the foot's capsules the shoulder's), typos, words missing.
    LA = {
        'superior lateral brachial cutaneous nerve': 'Nervus cutaneus brachii lateralis superior',
        'articular capsules of metatarsophalangeal joints': 'Capsulae articulares articulationum metatarsophalangearum',
        'superior mesenteric artery': 'Arteria mesenterica superior', 'musculophrenic artery': 'Arteria musculophrenica',
        'pituitary gland': 'Glandula pituitaria', 'great pancreatic artery': 'Arteria pancreatica magna', 'muscles of head': 'Musculi capitis',
        'lateral crico-arytenoid': 'Musculus cricoarytenoideus lateralis', 'flexor digitorum superficialis': 'Musculus flexor digitorum superficialis',
        'medial head of triceps brachii': 'Caput mediale musculi tricipitis brachii',
        'articular capsule of acromioclavicular joint': 'Capsula articularis articulationis acromioclavicularis',
        'articular capsule of superior tibiofibular joint': 'Capsula articularis articulationis tibiofibularis',
        'dorsal carpal branch of radial artery': 'Ramus carpalis dorsalis arteriae radialis',
        'inferior pancreaticoduodenal artery': 'Arteria pancreaticoduodenalis inferior',
        'subcutaneous bursa of medial malleolus': 'Bursa subcutanea malleoli medialis',
        'anterior root of posterior femoral cutaneous nerve': 'Radix anterior nervi cutanei femoris posterioris',
        'middle cardiac vein': 'Vena cardiaca media', 'ascending branch of left colic artery': 'Ramus ascendens arteriae colicae sinistrae',
        'left lower limb': 'Membrum inferius sinistrum', 'right lower limb': 'Membrum inferius dextrum',
        'left renal artery': 'Arteria renalis sinistra', 'right renal artery': 'Arteria renalis dextra', 'posterior cruciate ligament': 'Ligamentum cruciatum posterius', 'mouth': 'Os',
    }
    # and the arm's nerve's French and Spanish are the thigh's too
    NOT = {'superior lateral brachial cutaneous nerve': ('fr', 'es')}

    def latin(b, la):
        la = LA.get(b, la)
        la = la.replace('é', 'e')        # French accents in Latin ("Nodi aortici latérales")
        # two forms run together ("Arteria chorioidea anterior arteria choroidea anterior"): the first
        return re.split(r'\s(?=(?:arteria|vena|nervus|musculus|ligamentum|nodi|ramus|rami)\b)', la)[0]

    names = {}
    hit = 0
    bases = {base(n['name']) for n in N}
    for b in sorted(bases):
        rec = next((ta[v] for v in variants(b) if v in ta), None)
        if rec:
            rec = {**rec, 'la': latin(b, rec['la'])}
            for f in NOT.get(b, ()):
                rec.pop(f, None)
            names[b] = rec
            hit += 1
    # A side that is part of the name: the left and right gastric arteries are two vessels, not a pair, and TA2 has
    # each by its full name ("Arteria gastrica sinistra"). The app looks up the full name first.
    for full in sorted({sided(n['name']) for n in N if re.search(r'\b(left|right)\b', n['name'], re.I)}):
        if full in ta:
            rec = ta[full]
            names[full] = {**rec, 'la': latin(full, rec['la'])}
    leaves = [n for n in N if 'el' in n]
    covered = sum(1 for n in leaves if base(n['name']) in names)
    print(f'[names] {len(bases)} distinct names, {hit} in TA2; parts covered {covered} of {len(leaves)}')
    json.dump(names, open(os.path.join(HERE, 'out', 'names.json'), 'w'), ensure_ascii=False, indent=0)
    for b in ['masseter', 'femur', 'heart', 'tricuspid valve', 'vagus nerve (x)', 'anterior cruciate ligament', 'liver', 'trapezius']:
        print('  ', b, '->', names.get(b))


if __name__ == '__main__':
    main()
