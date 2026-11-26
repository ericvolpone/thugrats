/**
 * Hand-shaped arenas, one per map (keyed by map.layout). Each gets a World `w`
 * with drawing + collision helpers (see world.js) and a seeded rng.
 *
 * Coordinates: arena spans -half..half on x and z (half = 80). The player
 * spawns at (0, 0); titan altars and boss pads come from data/maps.js and are
 * kept clear automatically (w.clear).
 */
export const LAYOUTS = {
  // ── Little Italy: a piazza with a fountain, rowhouse alleys, a market street ──
  little_italy(w, rnd) {
    const H = w.half;
    // main road (north) + market street (south)
    w.road(-H - 30, -32, H + 30, -24, 'x');
    w.patch(-H, 26, H, 40, '#7a6a5a', 0.015); // market street flagstones
    // piazza
    w.disc(0, 0, 17, '#9a8a76', 0.02);
    w.disc(0, 0, 12.5, '#a89882', 0.025);
    w.prop('fountain', 0, 0);
    for (let i = 0; i < 8; i++) {
      const a = (i / 8) * Math.PI * 2 + 0.2;
      w.prop('cafe', Math.sin(a) * 9.5, Math.cos(a) * 9.5, 0, ['#c8281e', '#2f6b3a', '#f2f2f2'][i % 3]);
    }
    // string lights over the piazza and the market
    for (let i = 0; i < 4; i++) {
      const a = (i / 4) * Math.PI;
      w.deco('lights', Math.sin(a) * 17, Math.cos(a) * 17, -Math.sin(a) * 17, -Math.cos(a) * 17, 6.5);
    }
    for (let x = -60; x < 60; x += 15) w.deco('lights', x, 26, x + 15, 40, 6);
    // north: church + rowhouse clusters between the road and the edge
    w.building(0, -56, 16, 18, 11, '#cdb89a');
    w.building(0, -45, 5, 5, 20, '#cdb89a'); // bell tower
    w.rowhouses(-26, -54, 18, 14);
    w.rowhouses(26, -54, 18, 14);
    // middle: two rows each side with a narrow alley between them
    w.rowhouses(-63, -4, 10, 26);
    w.rowhouses(-43, -2, 8, 20);
    w.rowhouses(43, -2, 8, 20);
    w.rowhouses(63, -4, 10, 26);
    // south: market stalls + two blocks
    for (let x = -36; x <= 36; x += 8) if (Math.abs(x) > 6) w.prop('stall', x, 31, 0, ['#2f8a3a', '#c8281e', '#f2c037', '#2c6bb8'][Math.floor(rnd() * 4)]);
    w.rowhouses(-46, 56, 20, 14);
    w.rowhouses(46, 56, 20, 14);
    w.rowhouses(-63, 38, 10, 14);
    w.rowhouses(63, 38, 10, 14);
    // curbside parking along the main road (cars are jumpable cover)
    for (let x = -70; x <= 70; x += 9) {
      if (rnd() < 0.55) w.prop('car', x, -37.5, Math.PI / 2, ['#8a1c1c', '#1c3a8a', '#d9d4c3', '#2a2a2a', '#3a6b3a'][Math.floor(rnd() * 5)]);
      if (rnd() < 0.55) w.prop('car', x + 4, -18.5, -Math.PI / 2, ['#8a1c1c', '#1c3a8a', '#d9d4c3', '#2a2a2a', '#7ec8b8'][Math.floor(rnd() * 5)]);
    }
    // alley clutter between the rowhouse rows
    for (const x of [-53, 53]) for (let z = -14; z <= 10; z += 6) if (rnd() < 0.6) w.prop(rnd() < 0.5 ? 'dumpster' : 'crate', x, z, Math.PI / 2);
    for (const x of [-53, 53]) for (let z = -14; z <= 10; z += 8) w.deco('lights', x - 5, z, x + 5, z + 3, 7);
    // perimeter + street furniture
    w.perimeter(10);
    w.scatter(['vespa', 'vespa', 'planter', 'planter', 'trashcan', 'hydrant', 'lamp', 'bench', 'dumpster'], 110);
  },

  // ── The Docks: warehouses, a container maze, cranes on the quay, piers into the bay ──
  the_docks(w, rnd) {
    const H = w.half;
    const QUAY = 46;
    // water to the south, two piers sticking out into it
    w.water(-H - 30, QUAY, -42, H + 30);
    w.water(-28, QUAY, 16, H + 30);
    w.water(32, QUAY, H + 30, H + 30);
    w.pier(-42, QUAY, -28, 76);
    w.pier(16, QUAY, 32, 80);
    w.patch(-H, QUAY - 6, H, QUAY, '#6a6f78', 0.02); // quay apron
    w.deco('ship', 54, 66, Math.PI / 2);
    for (let x = -76; x <= 76; x += 9) if (!(x > -43 && x < -27) && !(x > 15 && x < 33)) w.prop('bollard', x, QUAY - 0.8);
    w.crane(-8, QUAY - 4);
    w.crane(46, QUAY - 4);
    // north: warehouses with loading gaps
    for (const [x, ww] of [[-62, 24], [-30, 20], [4, 22], [36, 20], [66, 18]]) w.building(x, -68, ww, 14, 8 + rnd() * 3, ['#5c6f7e', '#7a6a58', '#4f5d6b', '#6b5444'][Math.floor(rnd() * 4)]);
    // west: container yard — columns of containers with corridors, some stacked
    const cols = ['#b8452c', '#2c6bb8', '#3a8a4a', '#c8a020', '#8a3a8a'];
    for (let cx = -70; cx <= -24; cx += 7.5) {
      for (let cz = -34; cz <= 26; cz += 12) {
        if (rnd() < 0.28) continue;
        const stacked = rnd() < 0.35;
        w.prop('container', cx, cz, 0, cols[Math.floor(rnd() * cols.length)], stacked);
      }
    }
    // east: fuel tanks, a fish market and a lot of pallets and forklifts
    w.deco('tank', 46, -30, 5, 9, '#d8d8d0');
    w.deco('tank', 66, -30, 4, 8, '#c8d8e0');
    w.deco('tank', 66, -14, 3.5, 7, '#d8d0c0');
    for (let x = 30; x <= 62; x += 6) w.prop('stall', x, 14, Math.PI, ['#2c6bb8', '#f2f2f2', '#2f8a3a'][Math.floor(rnd() * 3)]);
    w.patch(26, 8, 68, 20, '#5a6670', 0.015);
    for (let i = 0; i < 7; i++) w.prop('forklift', 26 + rnd() * 44, -8 + rnd() * 40, Math.floor(rnd() * 4) * Math.PI / 2);
    for (let x = 30; x <= 62; x += 3) for (const z of [26, 30]) if (rnd() < 0.6) w.prop(rnd() < 0.5 ? 'crate' : 'barrel', x, z);
    for (let i = 0; i < 4; i++) w.deco('fence', 30 + i * 9, -44, 0, 8);
    // a few containers dropped near the quay
    for (const [x, z, r] of [[-14, 22, 0], [8, 28, Math.PI / 2], [-4, -32, Math.PI / 2]]) w.prop('container', x, z, r, ['#b8452c', '#2c6bb8', '#3a8a4a'][Math.floor(rnd() * 3)]);
    w.perimeter(12, { skipSouth: true, palette: ['#5c6f7e', '#7a6a58', '#4f5d6b', '#6b5444'] });
    w.scatter(['crate', 'crate', 'barrel', 'barrel', 'lamp', 'container'], 60, { maxZ: QUAY - 3 });
  },

  // ── Chinatown: a lantern avenue under two gates, a night market, a temple garden, tight shophouse alleys ──
  chinatown(w, rnd) {
    const H = w.half;
    w.road(-8, -H - 30, 8, H + 30, 'z');
    w.road(-H - 30, 16, H + 30, 26, 'x');
    w.deco('gate', 0, 44, 0, 18);
    w.deco('gate', 0, -42, 0, 18);
    for (let z = -66; z <= 66; z += 14) if (Math.abs(z - 21) > 7) w.deco('lanterns', -10, z, 10, z + 2, 7.5);
    // night market: stalls along the cross street, lanterns zig-zagging overhead
    for (let x = -70; x <= 70; x += 7) {
      if (Math.abs(x) < 13) continue;
      w.prop('stall', x, 12.5, Math.PI, ['#c8281e', '#f2c037', '#2f7a4a', '#e8e2d0'][Math.floor(rnd() * 4)]);
      w.prop('stall', x + 3, 29.5, 0, ['#c8281e', '#f2c037', '#2f7a4a', '#e8e2d0'][Math.floor(rnd() * 4)]);
      if (Math.round(x / 7) % 2 === 0) w.deco('lanterns', x, 14, x + 7, 28, 7);
    }
    // west: temple garden with a pagoda, a koi pond, bonsai and mahjong tables
    w.patch(-74, -40, -16, 6, '#5a6a4a', 0.015);
    w.deco('pagoda', -52, -24, 14);
    w.pond(-32, -10, 7);
    for (let i = 0; i < 10; i++) w.prop('bonsai', -70 + i * 6, -38 + (i % 2) * 2);
    for (const [x, z] of [[-60, -4], [-50, 2], [-62, -12], [-44, -4]]) w.prop('mahjong', x, z);
    w.patch(-22, -36, -18, 4, '#8a8078', 0.016); // stone path
    // east: shophouses packed tight, with narrow alleys between
    w.rowhouses(30, -58, 18, 12);
    w.rowhouses(58, -58, 16, 12);
    w.rowhouses(44, -14, 12, 16);
    w.rowhouses(66, -14, 8, 16);
    for (let z = -28; z <= 2; z += 6) if (rnd() < 0.7) w.prop(rnd() < 0.5 ? 'crate' : 'barrel', 55, z);
    for (let z = -26; z <= 0; z += 7) w.deco('lanterns', 50, z, 60, z + 2, 5.5);
    // south: shophouses and a mahjong courtyard
    w.rowhouses(-34, 56, 22, 12);
    w.rowhouses(34, 56, 22, 12);
    w.patch(18, 34, 50, 44, '#6a5a52', 0.016);
    for (const [x, z] of [[24, 38], [32, 40], [40, 38], [46, 41]]) w.prop('mahjong', x, z);
    w.rowhouses(-44, 40, 18, 8);
    w.building(24, -2, 8, 10, 7, '#8a2a22', '#ffb070'); // dim sum hall
    w.deco('lanterns', 20, 4, 28, 4, 7.5);
    // north
    w.rowhouses(-34, -62, 20, 12);
    w.rowhouses(36, -36, 16, 8);
    w.perimeter(12, { palette: ['#8a2a22', '#6a3a2a', '#3a4a3a', '#5a2a2a'] });
    w.scatter(['crate', 'barrel', 'trashcan', 'lamp', 'bonsai', 'vespa', 'dumpster'], 70);
  },

  // ── Coney Island: amusement park up top, the boardwalk, the beach and a pier ──
  coney_island(w, rnd) {
    const H = w.half;
    const SHORE = 64;
    // sea + pier
    w.water(-H - 30, SHORE, -5, H + 30);
    w.water(5, SHORE, H + 30, H + 30);
    w.pier(-5, SHORE, 5, H + 4);
    // beach
    w.patch(-H, 30, H, SHORE, '#d8c08a', 0.015);
    for (let i = 0; i < 26; i++) {
      const x = -70 + rnd() * 140, z = 36 + rnd() * 24;
      w.prop('umbrella', x, z, rnd() * 6, ['#2c6bb8', '#e0281e', '#f2c037', '#2f8a3a', '#ff4fd8'][Math.floor(rnd() * 5)]);
    }
    for (const x of [-48, -24, 24, 48]) w.building(x, 46, 4, 4, 4.5, '#f4f1ea'); // lifeguard huts
    // the boardwalk: planks, booths along the north edge, lamps
    for (let z = 18; z < 28; z += 1.25) w.patch(-H, z, H, z + 1.15, Math.floor(z / 1.25) % 2 ? '#9a7450' : '#8a6644', 0.02, false);
    w.mm.push({ x0: -H, z0: 18, x1: H, z1: 28, color: '#9a7450' });
    for (let x = -72; x <= 72; x += 9) {
      if (Math.abs(x) < 8) continue;
      w.prop(rnd() < 0.6 ? 'booth' : 'stall', x, 13.5, Math.PI, ['#e0281e', '#2c6bb8', '#f2c037', '#2f8a3a', '#ff4fd8'][Math.floor(rnd() * 5)]);
    }
    for (let x = -76; x <= 76; x += 12) { w.prop('lamp', x, 28.6); w.prop('bench', x + 6, 28.8); }
    // amusement park
    w.patch(-H, -50, H, 10, '#5a5a56', 0.012);
    w.deco('ferris', -42, -12, Math.PI / 2, 11);
    w.prop('carousel', 30, -2);
    // bumper cars: a fenced rink full of jumpable cars
    w.patch(-9, -36, 9, -24, '#3a3a5a', 0.016);
    w.deco('fence', 0, -36, 0, 18);
    w.deco('fence', -9, -30, Math.PI / 2, 12);
    w.deco('fence', 9, -30, Math.PI / 2, 12);
    for (const [x, z, r] of [[-5, -32, 0.4], [3, -28, 2], [5, -33, 1.2]]) w.prop('car', x, z, r, ['#e0281e', '#2c6bb8', '#f2c037'][Math.floor(rnd() * 3)]);
    w.building(62, -4, 4, 4, 24, '#e0281e', '#ffe0a0'); // drop tower
    w.building(-62, 2, 10, 8, 6, '#5a2a6a', '#c08aff'); // haunted house
    w.deco('coaster', -70, -40, 70, -40, 5);
    w.deco('coaster', 70, -40, 70, -24, 5.5);
    w.deco('coaster', -70, -40, -70, -24, 5.5);
    w.deco('lights', -60, 4, 60, 4, 7);
    for (const [x, z] of [[-14, -26], [14, -26], [-14, 2], [14, 2]]) w.prop('stall', x, z, 0, ['#e0281e', '#f2c037'][Math.floor(rnd() * 2)]);
    // north: arcades and a funhouse
    w.building(-22, -62, 18, 12, 8, '#c84a3a', '#ffe0a0');
    w.building(22, -62, 18, 12, 9, '#3a7aa8', '#ff8af0');
    w.casino(0, -68, 12, 8, 10, '#e8c050', '#ff4fd8');
    w.perimeter(12, { skipSouth: true, palette: ['#e0e0d0', '#c84a3a', '#3a7aa8', '#e8c050'] });
    w.scatter(['trashcan', 'bench', 'booth', 'lamp', 'planter'], 40, { maxZ: 12 });
  },

  // ── Casino Row: the Strip, giant casinos, a fountain show, a parking lot ──
  casino_row(w, rnd) {
    const H = w.half;
    // the Strip runs north-south through the middle
    w.road(-11, -H - 30, 11, H + 30, 'z', '#241c2c', '#ff4fd8');
    for (let z = -72; z <= 72; z += 12) if (Math.abs(z) > 10) w.prop('palm', 0, z);
    // west: casino, fountain show, open-air casino floor
    w.casino(-54, -54, 28, 22, 18, '#3b1d4a', '#ff4fd8');
    w.disc(-46, -6, 11.5, '#c8b8d8', 0.02);
    w.pool(-46, -6, 9.5);
    w.patch(-68, 28, -26, 54, '#6a1020', 0.02); // red carpet
    for (let x = -64; x <= -32; x += 4) for (const z of [32, 40]) w.prop('slot', x, z);
    for (const x of [-60, -48, -36]) w.prop('roulette', x, 49);
    w.deco('neon', -18, -20, Math.PI / 2, '#58c4ff', 7, 3.5, 7);
    w.deco('neon', -18, 40, Math.PI / 2, '#ff4fd8', 7, 3.5, 7);
    // east: casino, parking lot, chapel, giant dice
    w.casino(54, -56, 26, 20, 16, '#1d2e4a', '#58c4ff');
    w.patch(28, -14, 72, 24, '#2a2a30', 0.02);
    for (let x = 31; x <= 70; x += 3.5) { w.patch(x - 0.08, -12, x + 0.08, -4, '#e8e8e8', 0.03); w.patch(x - 0.08, 14, x + 0.08, 22, '#e8e8e8', 0.03); }
    for (let x = 33; x <= 68; x += 3.5) {
      if (rnd() < 0.7) w.prop('car', x, -8, 0, ['#8a1c1c', '#1c3a8a', '#d9d4c3', '#2a2a2a', '#ff4fd8', '#f2c037'][Math.floor(rnd() * 6)]);
      if (rnd() < 0.7) w.prop('car', x, 18, Math.PI, ['#8a1c1c', '#1c3a8a', '#d9d4c3', '#2a2a2a', '#58c4ff'][Math.floor(rnd() * 5)]);
    }
    w.building(62, 52, 12, 12, 8, '#f2e8f0'); // wedding chapel
    w.building(62, 44, 3, 3, 14, '#f2e8f0');
    w.prop('dice', 38, 50, 0.4);
    w.prop('dice', 43, 55, 1.1);
    w.deco('neon', 18, 0, -Math.PI / 2, '#f2c037', 8, 4, 8);
    // pawn shops and a motel to break up the corners
    w.building(-26, -64, 12, 10, 9, '#4a1d2e', '#ffd23f');
    w.building(30, 66, 16, 10, 7, '#2a2a2a', '#58c4ff');
    w.building(-66, 6, 10, 14, 10, '#1d2e4a', '#ff8af0');
    // valet line of limos and taxis in front of the casinos
    for (let z = -64; z <= -46; z += 5.5) { w.prop('car', -18, z, 0, '#111116'); w.prop('car', 18, z, Math.PI, '#f2c037'); }
    // planters and benches along the Strip sidewalks
    for (let z = -70; z <= 70; z += 10) {
      if (Math.abs(z) < 12) continue;
      w.prop(rnd() < 0.5 ? 'planter' : 'bench', -14.5, z, Math.PI / 2);
      w.prop(rnd() < 0.5 ? 'planter' : 'bench', 14.5, z + 5, -Math.PI / 2);
    }
    // neon arches over the Strip
    for (const z of [-36, 36]) w.deco('lights', -12, z, 12, z, 9);
    w.perimeter(12, { palette: ['#3b1d4a', '#1d2e4a', '#4a1d2e', '#2a2a2a'] });
    w.scatter(['bench', 'trashcan', 'lamp', 'palm', 'car', 'planter'], 50);
  },
};
