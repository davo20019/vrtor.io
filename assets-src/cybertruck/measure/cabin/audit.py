"""The built cabin against Tesla's published interior dimensions (Owner's Manual, refs/tesla/manual-dimensions.html),
measured on the parts the build writes (parts/*.stl, mm, x left, y up, z = ZF - s) by SAE J1100's definitions.

Run: .venv/bin/python measure/cabin/audit.py   (after cad.py)
"""
import json, math, sys
from pathlib import Path
import numpy as np
import trimesh

HERE = Path(__file__).resolve().parents[2]
sys.path.insert(0, str(HERE))
import cad  # noqa: E402

PUBLISHED = {  # mm, front / rear
    'head_front': 1058.8, 'head_rear': 991.9, 'leg_front': 1043.6, 'leg_rear': 1038.8,
    'shoulder_front': 1608.0, 'shoulder_rear': 1576.4, 'hip_front': 1453.3, 'hip_rear': 1453.5,
}
ZF = cad.ZF
SKIP = ('glass', 'tyre', 'rim', 'lugs', 'brake', 'caliper', 'wiper', 'tonneau', 'slat', 'cover', 'bed_', 'gate_', 'lid_')

def load(only=None):
    ms = []
    for f in sorted((HERE / 'parts').glob('*.stl')):
        if f.stem.startswith(SKIP) or 'mirrorglass' in f.stem or (only and not f.stem.startswith(only)):
            continue
        ms.append(trimesh.load(f, force='mesh'))
    return trimesh.util.concatenate(ms)

def P(x, h, s):
    return np.array([x, h, ZF - s], float)

def ray(mesh, o, d):
    d = np.asarray(d, float) / np.linalg.norm(d)
    loc, _, _ = mesh.ray.intersects_location([o], [d])
    if not len(loc):
        return math.inf
    t = (loc - o) @ d
    t = t[t > 1.0]
    return float(t.min()) if len(t) else math.inf

def width(mesh, h, s, x0=0.0):
    """Cross-car distance between the first surfaces left and right of (x0, h, s)."""
    o = P(x0, h, s)
    return ray(mesh, o, (1, 0, 0)) + ray(mesh, o, (-1, 0, 0))

def head_room(mesh, x, h, s):
    """H61/H63: H-point to the headliner along a line 8 deg behind vertical, plus 102."""
    a = math.radians(8)
    return ray(mesh, P(x, h, s), (0, math.cos(a), -math.sin(a))) + 102.0

def main():
    mesh = load()
    c = cad.CAB
    p = cad.P
    sF, hF = c['h_front']
    sR, hR = c['h_rear'][0], cad.rear_h_point(p)
    xF, xR = c['seat_x'], 445.0
    out = {}
    out['head_front'] = head_room(mesh, xF, hF, sF)
    out['head_rear'] = head_room(mesh, xR, hR, sR)
    # W3 shoulder room: least width from 254 above the H-point up to the beltline, at the H-point's s.
    def shoulder(h0, s):
        belt = cad.belt_h(p, s)
        hs = np.arange(h0 + 254, belt + 1, 10)
        return min(width(mesh, h, s) for h in hs) if len(hs) else math.nan, belt
    out['shoulder_front'], beltF = shoulder(hF, sF)
    out['shoulder_rear'], beltR = shoulder(hR, sR)
    # W5 hip room: least width between the door trims within 76 of the H-point's height and s, from each
    # outboard seat's H-point outward (the seats and console between them are not in it).
    trim = load(only=('door_', 'body', 'int_pillar_trim'))
    def hip(x0, h0, s):
        return min(2 * x0 + ray(trim, P(x0, h, ss), (1, 0, 0)) + ray(trim, P(-x0, h, ss), (-1, 0, 0))
                   for h in np.arange(h0 - 76, h0 + 77, 8) for ss in np.arange(s - 76, s + 77, 38))
    out['hip_front'] = hip(xF, hF, sF)
    out['hip_rear'] = hip(xR, hR, sR)
    # L34 / L51 leg room: ankle pivot to H-point, plus 254. SAE J1100 isn't public: the ankle is taken 95 above
    # the heel's point on the mat (floor + 22). Front: the heel on the mat against the accelerator's hinge block
    # (its rear face, 20 behind its centre; the heel's contact 20 further back).
    mat = c['floor'] + 22
    ankle_h = mat + 95
    ahp = c['pedal_s'] + 110 * math.sin(math.radians(40)) - 6 + 20 + 20
    out['leg_front'] = math.hypot(sF - ahp, hF - ankle_h) + 254
    # Rear: the foot slides forward under the front seat until it meets something. A shoe 290 long: the heel's
    # back 40 behind the ankle, the toe 250 ahead; 75 tall over the toe, 130 at the ankle. Rays forward from
    # behind the front seat find the first thing in the way at each height, across the outboard foot (w 445 +-50).
    def first_hit(x, h):
        d = ray(mesh, P(x, h, 2700), (0, 0, 1))
        return 2700 - d if d < math.inf else -math.inf
    toe = max(first_hit(x, h) for x in (395, 445, 495) for h in (mat + 8, mat + 40, mat + 75))
    ank = max(first_hit(x, h) for x in (395, 445, 495) for h in (mat + 100, mat + 130))
    a = max(toe + 250, ank + 40)
    out['leg_rear'] = math.hypot(sR - a, hR - ankle_h) + 254
    print(f'heel point front s {ahp:.0f}; rear ankle reaches s {a:.0f} (toes stopped at {toe:.0f}, ankle at {ank:.0f})')
    rows = []
    for k, v in PUBLISHED.items():
        m = out.get(k)
        rows.append((k, v, m, None if m is None else m - v))
    print('| What | Published | Model | Off |\n|---|---|---|---|')
    for k, v, m, d in rows:
        print(f'| {k} | {v:,.1f} | {"-" if m is None else f"{m:,.1f}"} | {"-" if d is None else f"{d:+.1f}"} |')
    print(f'\nfront H-point (s {sF:.0f}, h {hF:.0f}, w {xF:.0f}); rear (s {sR:.0f}, h {hR:.0f}, w {xR:.0f}); belt at front H {beltF:.0f}, rear {beltR:.0f}')
    # Other sizes a seated visitor feels.
    ex, eh, es = cad.seat_eyes(p)['driver']
    print(f"driver eye h {eh:.0f}: ceiling straight above {eh + ray(mesh, P(xF, eh, ZF - es), (0, 1, 0)):.0f}, "
          f"eye to ceiling {ray(mesh, P(xF, eh, ZF - es), (0, 1, 0)):.0f}, to the door glass/trim beside {ray(mesh, P(xF, eh, ZF - es), (1, 0, 0)):.0f}")
    print(f"floor under the front H-point {hF - ray(mesh, P(xF, hF, sF), (0, -1, 0)):.0f} (H30 seat height {ray(mesh, P(xF, hF, sF), (0, -1, 0)) - 0:.0f} to the first surface below)")
    for s in (1900, 2200, 2600, 3100):
        print(f"ceiling over the outboard seats at s {s}: {1300 + ray(mesh, P(xF, 1300, s), (0, 1, 0)):.0f}")
    json.dump(out, open(HERE / 'measure/cabin/audit.json', 'w'), indent=1)

if __name__ == '__main__':
    main()
