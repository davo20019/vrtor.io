"""The Cybertruck's parts as a technician takes them off, for the showroom's parts space (apps/cyb disassembly.js).

Each part: its name in Tesla's Service Manual (refs/tesla/servicemanual/removal-graph.json), the model's nodes or
meshes that make it, what it is fixed to ('on': another part, or the body when absent), which way it comes off
(glTF frame: x to the truck's left, y up, z ahead) and the parts that must be off first ('after'). 'after' is the
manual's (the procedure's own "Remove ... See ..." steps), kept to the parts the model has: the manual's others
(the underhood apron, the frunk, trims) are not modelled yet, and once they are they join. Where the model needs
more than the manual names, 'why' says so. assemble.py checks every name against the model and writes the list
into cybertruck.json (disassembly).

v1 (2026-10-12): the parts the model already has as separate pieces, at the manual's level, and inside each front
door the felt pad, closeout panel and window regulator. Deeper parts (the hinges, check straps, latches, seals; the
rear doors' insides; the seats' covers; the dash's panels) come as they're built.
"""

CORNER = {'fl': ('Front', 'LH', 1), 'fr': ('Front', 'RH', -1), 'rl': ('Rear', 'LH', 1), 'rr': ('Rear', 'RH', -1)}
SIDE = {'l': ('LH', 1), 'r': ('RH', -1)}


def part(id, manual, nodes, dir, after=(), on=None, why=None, name=None):
    return {'id': id, 'name': name or manual, 'manual': manual, 'nodes': list(nodes), 'dir': list(dir),
            'after': list(after), 'on': on, 'why': why}


def parts():
    out = []
    # ---- wheels and brakes (3401, 3301)
    for k, (end, side, sx) in CORNER.items():
        out += [
            part(f'wheel_cover_{k}', f'Wheel Cover - {end} - {side}', [f'cover_{k}'], (sx, 0, 0), on=f'wheel_{k}'),
            part(f'wheel_{k}', 'Wheel Assembly', [f'wheel_{k}'], (sx, 0, 0), after=[f'wheel_cover_{k}'],
                 name=f'Wheel and tyre - {end} - {side}'),
            part(f'caliper_{k}', f'Brake Caliper - {end} - {side}', [f'caliper_{k}'], (sx, 0, 0), after=[f'wheel_{k}'],
                 why='the caliper sits behind the rim in the model; the front procedure removes only the wheel cap'),
            part(f'rotor_{k}', f'Brake Rotor - {end} - {side}', [f'brake_disc_{k}'], (sx, 0, 0),
                 after=[f'wheel_{k}', f'caliper_{k}'], why='the caliper straddles the rotor'),
        ]
    # ---- doors (1010, 1020, 1209, 1513): each door carries its parts; taken off whole, they go with it
    for k, (end, side, sx) in CORNER.items():
        d = f'door_{k}'
        if end == 'Front':
            out += [
                part(f'mirror_glass_{k}', f'Exterior Mirror Glass - Flat - Electrochromic Dimming - {side}',
                     [f'{d}_mirrorglass'], (0, 0, -1), on=f'mirror_{k}'),
                part(f'mirror_cap_{k}', f'Skull Cap - Exterior Mirror - {side}', [f'{d}_mirrorcap'], (0, 0, 1),
                     after=[f'mirror_glass_{k}'], on=f'mirror_{k}'),
                part(f'mirror_{k}', f'Exterior Mirror Assembly - Electromechanical - {side}', [f'{d}_mirror'], (sx, 0, 0), on=d),
            ]
        out += [
            part(f'beltline_{k}', f'Beltline Assembly - Door Panel - {end} - {side}', [f'{d}_int_cap', f'{d}_int_ambient'],
                 (-sx, 0.4, 0), on=d),
            part(f'door_trim_{k}', f'Panel - Door Trim - {end} - {side}',
                 [f'{d}_int_trim_white', f'{d}_int_armrest', f'{d}_int_door_lower', f'{d}_int_switch_pod', f'{d}_int_switch',
                  f'{d}_int_grilles', f'open_{k}'], (-sx, 0, 0), after=[f'beltline_{k}'], on=d),
            part(f'door_glass_{k}', f'Moving Glass - Door - {end} - {side}', [f'{d}_glass'], (0, 1, 0),
                 after=[f'door_trim_{k}', f'beltline_{k}'], on=d),
            part(d, f'Door - {end} - {side}', [d], (sx, 0, 0)),
        ]
        if end == 'Front':
            # Under the trim (cad.py front_door_inner): the felt pad, the closeout panel with the woofer and the
            # door's module on it, and the window regulator on the panel's far side.
            out += [
                part(f'nvh_foam_{k}', f'NVH Foam - Door - Front - {side}', [f'{d}_int_nvh_foam'], (-sx, 0, 0),
                     after=[f'door_trim_{k}'], on=d),
                part(f'closeout_{k}', f'Closeout Panel - Front Door - {side}',
                     [f'{d}_int_closeout', f'{d}_int_closeout_speaker', f'{d}_int_closeout_module'], (-sx, 0, 0),
                     after=[f'door_trim_{k}', f'door_glass_{k}', f'nvh_foam_{k}'], on=d, why='the felt pad lies on it'),
                part(f'regulator_{k}', f'Window Regulator - Front Door - {side}', [f'{d}_int_regulator', f'{d}_int_regulator_motor'],
                     (-sx, 0, 0), on=f'closeout_{k}'),
            ]
    # ---- glass and the wiper (1020, 1750)
    out += [
        part('wiper_arm', 'Wiper Arm and Blade Assembly - Windshield', ['wiper_arm'], (0, 1, 0.3)),
        part('windshield', 'Windshield Assembly', ['windshield_glass'], (0, 0.8, 0.6), after=['wiper_arm'],
             why='the wiper lies on the glass'),
        part('roof_glass', 'Fixed Glass Roof Assembly', ['roof_glass'], (0, 1, 0)),
    ]
    for s, (side, sx) in SIDE.items():
        out.append(part(f'quarter_glass_{s}', f'Quarter Glass - Front - {side}', [f'quarter_glass__{s}'], (sx, 0.3, 0)))
    # ---- exterior (1001, 1220, 1740, 1120, 1215)
    out += [
        part('lightbar_front', 'Lightbar - Front', ['light_front'], (0, 0, 1)),
        part('license_plate_front', 'License Plate Assembly - Front', ['front_plate'], (0, 0, 1)),
        part('front_fascia', 'Front Fascia', ['cladding__bumper_f', 'tow_covers', 'front_camera', 'front_camera_lens'], (0, -0.2, 1),
             after=['license_plate_front'], why='the plate is fixed on the fascia'),
        part('front_lower_grille', 'Front Lower Grille', ['intake_grille', 'intake_back'], (0, 0, 1), after=['front_fascia']),
    ]
    for s, (side, sx) in SIDE.items():
        out += [
            part(f'flare_front_{s}', None, [f'cladding__flare_f_{s}'], (sx, 0, 0), name=f'Fender flare - Front - {side}',
                 why='the manual lists the front flare only with the fender (Fender Assembly - Front) and its carriers'),
            part(f'flare_rear_{s}', f'Fender Flare - Fore - Rear - {side}', [f'cladding__flare_r_{s}'], (sx, 0, 0),
                 name=f'Fender flare - Rear - {side}', why='the manual has it in two pieces (Fore, Aft); the model in one'),
            part(f'rocker_{s}', f'Rocker Panel Assembly - {side}', [f'cladding__rocker_{s}'], (sx, -0.3, 0)),
        ]
    out += [
        part('rear_fascia', 'Rear Fascia', ['cladding__bumper_r'], (0, -0.2, -1), after=['flare_rear_l', 'flare_rear_r']),
        part('tailgate', 'Tailgate Assembly', ['tailgate'], (0, 0, -1)),
        part('tonneau', 'Slat System - Tonneau', ['tonneau_cover'], (0, 1, 0)),
        part('bed_lid', 'Lid - Bed Cargo Tub', ['bedlid'], (0, 1, 0)),
        part('outlet_door', 'Door - Outlet - Bed', ['outlet_cover'], (-1, 0, 0)),
    ]
    # ---- cabin (1304, 1305, 1530, 2001, 3205, 2107, 1505, 1519)
    out += [
        part('floor_mats', 'Floor Mat Kit', ['int_mats', 'int_mat_edges'], (0, 1, 0)),
        part('seat_rear', 'Seat Assembly - 2nd Row', ['int_seats_rear', 'int_seat_base__rear', 'int_rear_armrest'], (0, 1, 0)),
    ]
    for s, (side, sx) in SIDE.items():
        out.append(part(f'seat_front_{s}', f'Seat Assembly - 1st Row - {side}',
                        [f'int_seats_front__{s}', f'int_seat_base__{s}', f'int_seat_knobs__{s}', f'int_piping__{s}'], (0.3 * sx, 1, 0)))
    yoke = ['int_yoke', 'int_yoke_face', 'int_yoke_chin', 'int_yoke_pods', 'int_yoke_trim', 'int_yoke_keys',
            'int_yoke_btn_high_beam', 'int_yoke_btn_signal_left', 'int_yoke_btn_signal_right', 'int_yoke_btn_wiper']
    out += [
        part('airbag_driver', 'Airbag - Driver', ['int_yoke_pad'], (0, 0, -1), on='steering_wheel'),
        part('steering_wheel', 'Steering Wheel Pur Heated', yoke, (0, 0, -1), after=['airbag_driver'], name='Steering yoke'),
        part('touchscreen', 'Touchscreen - Center Display Assembly', ['int_screen', 'int_screen_bezel'], (0, 0.3, -1)),
        part('rear_display', 'Touchscreen - Rear Display', ['int_rear_screen'], (0, 0, -1), on='center_console'),
        part('rearview_mirror', 'Rearview Mirror', ['int_rear_mirror', 'int_mirror_glass'], (0, -1, 0)),
        part('center_console', 'Center Console Assembly',
             ['int_console', 'int_console_lid', 'int_console_rim', 'int_chargers', 'int_charger_trim', 'int_usb'], (0, 1, 0)),
    ]
    return out


def resolved(graph):
    """parts(), each with 'procedure': the manual's documented procedure it follows (the manual documents most
    parts on the left only: a right-hand part follows its left-hand twin, mirrored; the rear wheel covers follow
    the front's) and that procedure's page. Raises if a named part has no procedure at all."""
    out = []
    for p in parts():
        m = p['manual']
        if m:
            cand = [m, m.replace(' - RH', ' - LH').replace('- RH -', '- LH -'), m.replace('Wheel Cover - Rear', 'Wheel Cover - Front').replace(' - RH', ' - LH')]
            ref = next((c for c in cand if c in graph), None)
            if not ref:
                raise SystemExit(f'disassembly: {p["id"]}: no procedure for {m!r} in the manual')
            p = {**p, 'procedure': ref, 'page': graph[ref]['procedures'][0]['href'], 'mirrored': ref != m}
        out.append(p)
    return out
