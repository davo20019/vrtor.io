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
        e = end
        lower = (f'Closure Assist Mechanisms and Hinges - Hinges - Front Door Hinge - Lower - {side}' if e == 'Front'
                 else f'Closure Assist Mechanisms and Hinges - Hinges - Rear Door - Lower Hinge - {side}')
        rear = e == 'Rear'
        out += [
            # Along the door's top: the waist belt seals each side of the glass's slot, under the beltline.
            part(f'seal_waist_outer_{k}', f'Waist Belt Seal - Outer - {e} Door - {side}', [f'{d}_int_seal_waist_outer'], (0, 1, 0),
                 after=[f'beltline_{k}', f'seal_waist_inner_{k}'] if rear else [], on=d),
            part(f'seal_waist_inner_{k}', f'Waist Belt Seal - Inner - {e} Door - {side}', [f'{d}_int_seal_waist_inner'], (0, 1, 0),
                 after=[f'beltline_{k}'], on=d),
            part(f'beltline_{k}', f'Beltline Assembly - Door Panel - {e} - {side}', [f'{d}_int_cap', f'{d}_int_ambient'],
                 (-sx, 0.4, 0), on=d),
            part(f'door_trim_{k}', f'Panel - Door Trim - {e} - {side}',
                 [f'{d}_int_trim_white', f'{d}_int_armrest', f'{d}_int_door_lower', f'{d}_int_switch_pod', f'{d}_int_switch',
                  f'{d}_int_grilles', f'open_{k}'], (-sx, 0, 0), after=[f'beltline_{k}'], on=d),
            # Under the trim (cad.py door_inside): the felt pad, the closeout panel with the door's module on it (and on
            # a front door the woofer), the window regulator on its far side.
            part(f'nvh_foam_{k}', f'NVH Foam - Door - {e} - {side}', [f'{d}_int_nvh_foam'], (-sx, 0, 0),
                 after=[f'door_trim_{k}'], on=d),
            part(f'door_glass_{k}', f'Moving Glass - Door - {e} - {side}', [f'{d}_glass'], (0, 1, 0),
                 after=[f'door_trim_{k}', f'beltline_{k}'] + ([f'seal_waist_inner_{k}'] if rear else []), on=d),
            part(f'closeout_{k}', f'Closeout Panel - {e} Door - {side}',
                 [f'{d}_int_closeout', f'{d}_int_closeout_module'] + ([] if rear else [f'{d}_int_closeout_speaker']), (-sx, 0, 0),
                 after=[f'door_trim_{k}', f'door_glass_{k}', f'nvh_foam_{k}'] + ([f'seal_waist_inner_{k}', f'seal_waist_outer_{k}'] if rear else []),
                 on=d, why='the felt pad lies on it'),
            part(f'regulator_{k}', f'Window Regulator - {e} Door - {side}', [f'{d}_int_regulator', f'{d}_int_regulator_motor'],
                 (-sx, 0, 0), on=f'closeout_{k}'),
            # In the cavity (cad.py door_hardware): the check strap, the door presenter, the latch at the rear edge, the
            # stud plates the hinges bolt to, and on a front door the glass run seal up the glass's front edge.
            part(f'check_strap_{k}', 'Check Strap, Rear' if rear else f'Check Strap - Front Door - {side}', [f'{d}_int_check_strap'],
                 (-sx, 0, 0), after=[f'closeout_{k}'] + ([] if rear else [f'seal_glass_run_{k}']), on=d,
                 why='in the model it lies in the cavity behind the closeout panel' if rear else None),
            part(f'presenter_{k}', f'Door Presenter - {e} Door - {side}', [f'{d}_int_presenter'], (-sx, 0, 0),
                 after=[f'closeout_{k}'] + ([f'door_glass_{k}'] if rear else []), on=d,
                 why='in the model it lies in the cavity behind the closeout panel' if rear else None),
            part(f'latch_{k}', f'Door Latch - {e} - {side}', [f'{d}_int_latch'], (-sx, 0, 0),
                 after=[f'closeout_{k}'] + ([f'door_glass_{k}'] if rear else []), on=d,
                 why='in the model it lies in the cavity behind the closeout panel' if rear else None),
            part(f'stud_plate_upper_{k}', f'Stud Plate - Hinge - Upper - Door - {e} - {side}', [f'{d}_int_stud_plate_upper'], (-sx, 0, 0),
                 after=[f'regulator_{k}'], on=d),
            part(f'stud_plate_lower_{k}', f'Stud Plate - Hinge - Lower - Door - {e} - {side}', [f'{d}_int_stud_plate_lower'], (-sx, 0, 0),
                 after=[f'regulator_{k}'], on=d),
            part(f'seal_secondary_{k}', f'Secondary Seal - {e} Door - {side}', [f'{d}_int_seal_secondary'], (-sx, 0, 0), on=d),
            part(d, f'Door - {e} - {side}', [d], (sx, 0, 0)),
            # On the body: the hinges (the door hangs on them: it comes off first), the primary seal round the opening,
            # and on the rear door's pillar its striker.
            part(f'hinge_upper_{k}', f'Hinge - Upper - {e} Door - {side}', [f'hw_hinge_upper__{k}'], (sx, 0, 0), after=[d],
                 why='the door hangs on it'),
            part(f'hinge_lower_{k}', lower, [f'hw_hinge_lower__{k}'], (sx, 0, 0), after=[d], name=f'Hinge - Lower - {e} Door - {side}',
                 why='the door hangs on it'),
            part(f'seal_primary_{k}', f'Primary Seal - Door - {e} - {side}', [f'hw_seal_primary__{k}'], (sx, 0, 0), after=[d],
                 why='the shut door covers it'),
        ]
        if rear:
            out.append(part(f'striker_{k}', f'Door Striker - Rear - {side}', [f'hw_striker__{k}'], (0, 0, 1), after=[d],
                            why='the shut door covers it'))
        else:
            out.append(part(f'seal_glass_run_{k}', f'Glass Run Seal - Front Door - A-Pillar - {side}', [f'{d}_int_seal_run'],
                            (0, 1, 0), after=[f'closeout_{k}'], on=d))
    # ---- glass and the wiper (1020, 1750)
    out += [
        part('wiper_arm', 'Wiper Arm and Blade Assembly - Windshield', ['wiper_arm'], (0, 1, 0.3)),
        part('windshield', 'Windshield Assembly', ['windshield_glass'], (0, 0.8, 0.6), after=['wiper_arm'],
             why='the wiper lies on the glass'),
        part('roof_glass', 'Fixed Glass Roof Assembly', ['roof_glass'], (0, 1, 0)),
    ]
    for s, (side, sx) in SIDE.items():
        out.append(part(f'quarter_panel_{s}', f'Quarter Panel Assembly - {side} - Instrument Panel',
                        [f'int_quarter_white__{s}', f'int_quarter_lower__{s}'], (0, 0, -1)))
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
    ]
    # ---- the seats (1301, 1304, 1305, 1307, 1308; cad.py front_seat, rear_bench). Out of the truck a seat is taken
    # apart on the bench: the side shields, then the back (frame, foam, trim) and the cushion (frame, foam).
    for s, (side, sx) in SIDE.items():
        st = f'seat_front_{s}'
        out += [
            part(st, f'Seat Assembly - 1st Row - {side}', [f'int_seat_riser__{s}'], (0.3 * sx, 1, 0)),
            part(f'shield_out_{s}', f'Side Shield - Outboard - 1st Row Seat - {side}', [f'int_seat_shield_out__{s}', f'int_seat_buttons__{s}'],
                 (sx, 0, 0), on=st),
            part(f'shield_in_{s}', f'Side Shield - Inboard - 1st Row Seat - {side}', [f'int_seat_shield_in__{s}'], (-sx, 0, 0),
                 after=[st], on=st),
            part(f'seatback_{s}', f'Seatback Assembly - 1st Row Seat - {side}', [f'int_seat_back_frame__{s}'], (0, 1, 0),
                 after=[st, f'shield_out_{s}', f'shield_in_{s}'], on=st),
            part(f'back_trim_{s}', f'Trim - Seat Back - 1st Row - {side}', [f'int_seat_back_trim__{s}', f'int_seat_piping__{s}'], (0, 1, 0),
                 after=[st, f'shield_out_{s}', f'shield_in_{s}'], on=f'seatback_{s}'),
            part(f'back_foam_{s}', f'Foam - Seat Back - 1st Row Seat - {side} (with Ventilation)', [f'int_seat_back_foam__{s}'], (0, 1, 0),
                 after=[f'back_trim_{s}'], on=f'seatback_{s}'),
            part(f'cushion_frame_{s}', f'Frame - Seat Cushion - 1st Row Seat - {side}', [f'int_seat_cushion_frame__{s}'], (0, 1, 0),
                 after=[st, f'shield_out_{s}', f'cushion_foam_{s}'], on=st, why='the cushion foam lies on it'),
            part(f'cushion_foam_{s}', f'Foam - Seat Cushion - 1st Row Seat - {side} (with Ventilation)', [f'int_seat_cushion_foam__{s}'],
                 (0, 1, 0), after=[st, f'shield_out_{s}', f'shield_in_{s}'], on=f'cushion_frame_{s}'),
        ]
    out += [
        part('seat_rear', 'Seat Assembly - 2nd Row', ['int_seat_base__rear'], (0, 1, 0)),
        part('back_rear_c', None, ['int_rear_back__c'], (0, 1, 0), on='seat_rear', name='Seat back - Centre - 2nd Row',
             why='the manual names the left and right backs; the model has the centre place on its own'),
        part('headrest_rear_c', 'Headrest - Center - 2nd Row Seat', ['int_rear_headrest__c'], (0, 1, 0), on='back_rear_c'),
        part('armrest_rear', 'Armrest - 2nd Row Seat', ['int_rear_armrest'], (0, 1, 0), on='seat_rear'),
        part('cushion_rear_c', None, ['int_rear_cushion__c'], (0, 1, 0), on='seat_rear', after=['armrest_rear'],
             name='Cushion - Centre - 2nd Row', why='the armrest folds down onto it; the manual names the left and right cushions'),
    ]
    for s, (side, sx) in SIDE.items():
        out += [
            part(f'back_rear_{s}', f'Seat Back Assembly - 2nd Row Seat - {side}', [f'int_rear_back__{s}'], (0, 1, 0),
                 after=[f'bolster_out_rear_{s}', f'bolster_in_rear_{s}'], on='seat_rear'),
            part(f'bolster_out_rear_{s}', f'Bolster - Outboard - {side} - 2nd Row Seat Back', [f'int_rear_bolster_out__{s}'], (sx, 0, 0),
                 on='seat_rear'),
            part(f'bolster_in_rear_{s}', f'Bolster - Inboard - {side} - 2nd Row Seat Back', [f'int_rear_bolster_in__{s}'], (-sx, 0, 0),
                 on='seat_rear'),
            part(f'insert_rear_{s}', 'Trim - Back Rest Insert - 2nd Row Seat', [f'int_rear_insert__{s}'], (0, 0.3, 1),
                 after=[f'back_rear_{s}'], on=f'back_rear_{s}', name=f'Trim - Back Rest Insert - 2nd Row Seat - {side}'),
            part(f'cushion_rear_{s}', f'Cushion Assembly - 2nd Row Seat - {side}', [f'int_rear_cushion__{s}'], (0, 1, 0), on='seat_rear'),
        ]
    yoke = ['int_yoke', 'int_yoke_face', 'int_yoke_chin', 'int_yoke_pods', 'int_yoke_trim', 'int_yoke_keys',
            'int_yoke_btn_high_beam', 'int_yoke_btn_signal_left', 'int_yoke_btn_signal_right', 'int_yoke_btn_wiper']
    out += [
        part('airbag_driver', 'Airbag - Driver', ['int_yoke_pad'], (0, 0, -1), on='steering_wheel'),
        part('steering_wheel', 'Steering Wheel Pur Heated', yoke, (0, 0, -1), after=['airbag_driver'], name='Steering yoke'),
        part('touchscreen', 'Touchscreen - Center Display Assembly', ['int_screen', 'int_screen_bezel'], (0, 0.3, -1),
             after=['service_panel']),
        # ---- the dash (1405, 2001, 3205; cad.py interior)
        part('service_panel', 'Service Panel - Center Shroud - Instrument Panel', ['int_service_panel'], (0, 0, -1)),
        part('display_shroud', 'Display Shroud - Instrument Panel', ['int_screen_stand'], (0, 0, -1), after=['touchscreen'],
             why='the screen is mounted on it'),
        part('mid_panel', 'Mid Panel Assembly - Instrument Panel', ['int_dash_white', 'int_ambient'], (0, 0, -1)),
        part('gap_hider', 'Gap Hider - Instrument Panel', ['int_gap_hider'], (0, 0, -1), after=['mid_panel', 'lower_panel']),
        part('lower_panel', 'Lower Assembly - Instrument Panel', ['int_dash_lower'], (0, -0.3, -1), after=['mid_panel']),
        part('glovebox', 'Glovebox Assembly', ['int_glovebox'], (0, 0, -1), after=['lower_panel']),
        part('footwell_cover', 'Cover - Footwell', ['int_footwell_cover'], (0, -1, 0)),
        part('airbag_knee_l', 'Airbag - Knee - Driver', ['int_airbag_knee__l'], (0, 0, -1), after=['lower_panel']),
        part('airbag_knee_r', 'Airbag - Knee - Front Passenger', ['int_airbag_knee__r'], (0, 0, -1), after=['lower_panel']),
        part('airbag_passenger', 'Airbag - Front Passenger', ['int_airbag_passenger'], (0, -1, 0), after=['lower_panel', 'glovebox'],
             why='under the top pad, it is reached from below once the lower panel and glovebox are out'),
        part('top_pad', 'Top Pad Assembly - Instrument Panel', ['int_dash_top', 'int_dash_face', 'int_dash_vent'], (0, 1, -0.5),
             after=['airbag_passenger']),
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
