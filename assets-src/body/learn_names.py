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


    names = {}
    hit = 0
    bases = {base(n['name']) for n in N}
    for b in sorted(bases):
        rec = next((ta[v] for v in variants(b) if v in ta), None)
        if rec:
            names[b] = rec
            hit += 1
    leaves = [n for n in N if 'el' in n]
    covered = sum(1 for n in leaves if base(n['name']) in names)
    print(f'[names] {len(bases)} distinct names, {hit} in TA2; parts covered {covered} of {len(leaves)}')
    json.dump(names, open(os.path.join(HERE, 'out', 'names.json'), 'w'), ensure_ascii=False, indent=0)
    for b in ['masseter', 'femur', 'heart', 'tricuspid valve', 'vagus nerve (x)', 'anterior cruciate ligament', 'liver', 'trapezius']:
        print('  ', b, '->', names.get(b))


if __name__ == '__main__':
    main()
