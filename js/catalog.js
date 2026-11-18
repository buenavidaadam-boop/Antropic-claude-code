/* Builds the game catalog: every engine × theme × difficulty, each with its own seeded tweaks. */
(function () {
  const THEMES = [
    { id: 'neon', name: 'Neon', bg: '#0b0b1e', fg: '#e8e8ff', a1: '#ff2bd6', a2: '#22e6ff', a3: '#b6ff3b', sky: 0x140b33, ground: 0x1d1245, fog: 0x140b33, road: 0x2d2558, night: true },
    { id: 'lava', name: 'Lava', bg: '#1a0703', fg: '#ffe6d5', a1: '#ff5a1f', a2: '#ffc21f', a3: '#ff3d3d', sky: 0x5a1c08, ground: 0x2b0d05, fog: 0x5a1c08, road: 0x3d3330 },
    { id: 'arctic', name: 'Arctic', bg: '#0c1e2b', fg: '#eef8ff', a1: '#7fd6ff', a2: '#ffffff', a3: '#4aa3ff', sky: 0xbfe3f5, ground: 0xe8f4fa, fog: 0xd6ecf5, road: 0x6b7c88 },
    { id: 'jungle', name: 'Jungle', bg: '#0b1f10', fg: '#eaffea', a1: '#3ddc5a', a2: '#ffd23f', a3: '#ff8a3f', sky: 0x8fd0a0, ground: 0x2f6b2a, fog: 0x9fd4a8, road: 0x5a4a3a },
    { id: 'desert', name: 'Desert', bg: '#2a1d0e', fg: '#fff4e0', a1: '#ffb347', a2: '#e0703a', a3: '#5ec8d8', sky: 0xf3c98b, ground: 0xd9a95e, fog: 0xf0d0a0, road: 0x6e5a44 },
    { id: 'ocean', name: 'Ocean', bg: '#04172b', fg: '#e0f4ff', a1: '#00c2ff', a2: '#00ffb3', a3: '#ff6f91', sky: 0x5fb7e8, ground: 0x1f6f8b, fog: 0x7cc4e8, road: 0x37505e },
    { id: 'candy', name: 'Candy', bg: '#2b0f24', fg: '#fff0fa', a1: '#ff7ac6', a2: '#7af0ff', a3: '#fff27a', sky: 0xffc6e5, ground: 0xf7a8d0, fog: 0xffd6ec, road: 0x9a5c86 },
    { id: 'midnight', name: 'Midnight', bg: '#05060d', fg: '#c9d1ff', a1: '#6b7cff', a2: '#a0a8ff', a3: '#ffcf5a', sky: 0x05060d, ground: 0x14182a, fog: 0x05060d, road: 0x262b42, night: true },
    { id: 'retro', name: 'Retro', bg: '#1d1b14', fg: '#f2e8c9', a1: '#e8b54a', a2: '#d1603d', a3: '#6fa8a0', sky: 0xd8c7a0, ground: 0x8a7b52, fog: 0xd8c7a0, road: 0x4a443a },
    { id: 'toxic', name: 'Toxic', bg: '#0d1405', fg: '#efffd0', a1: '#a6ff00', a2: '#ffe600', a3: '#ff00a2', sky: 0x2c3a10, ground: 0x3a4a12, fog: 0x3a4a14, road: 0x2a2e22 },
    { id: 'sunset', name: 'Sunset', bg: '#22102b', fg: '#ffeede', a1: '#ff8a5c', a2: '#ffcf6b', a3: '#c86bff', sky: 0xff9a76, ground: 0x6b3a5a, fog: 0xffa585, road: 0x3e2a3e },
    { id: 'galaxy', name: 'Galaxy', bg: '#070214', fg: '#efe6ff', a1: '#9d5cff', a2: '#5cf2ff', a3: '#ff5cae', sky: 0x0a0420, ground: 0x1b0f3a, fog: 0x0a0420, road: 0x2c2050, night: true },
  ];
  const DIFF = [
    { d: 1, name: 'Easy', tag: 'Rookie' },
    { d: 2, name: 'Normal', tag: '' },
    { d: 3, name: 'Hard', tag: 'Extreme' },
  ];
  /* Flavour words so titles read naturally per engine. */
  const FLAVOR = {
    race3d: ['Grand Prix', 'Rally', 'Circuit', 'Speedway'], survival3d: ['Siege', 'Outbreak', 'Last Stand', 'Holdout'],
    snake: ['Snake', 'Serpent', 'Slither'], breakout: ['Brick Smash', 'Breaker'], shooter: ['Star Blaster', 'Invaders', 'Strike'],
    runner: ['Dash', 'Runner', 'Sprint'], glide: ['Glider', 'Flap', 'Wings'], drift: ['Rock Drift', 'Asteroid Belt'],
    pong: ['Paddle Duel', 'Rally Ball'], dodge: ['Meteor Dodge', 'Sky Fall'], merge: ['Merge', 'Number Fusion'],
    mines: ['Mine Sweep', 'Minefield'], stack: ['Tower Stack', 'Skyscraper'], memory: ['Memory Match', 'Card Flip'],
    blocks: ['Block Drop', 'Line Clear'], maze: ['Maze Escape', 'Labyrinth'],
  };

  const games = [];
  const SUNNY = { id: 'sunny', name: 'Sunny', bg: '#0f2a3d', fg: '#ffffff', a1: '#ff3355', a2: '#7ccf6a', a3: '#9ad6ff' };
  Object.values(G.engines).forEach((eng) => {
    if (eng.entries) {
      eng.entries().forEach((e) => {
        const id = eng.id + '-' + e.key, df = DIFF[e.diff - 1];
        games.push({
          id, engine: eng.id, theme: SUNNY, diff: df.d, diffName: df.name, seed: G.hash(id), title: e.title,
          cat: eng.cat, icon: e.icon || eng.icon, desc: e.desc || eng.desc, controls: eng.controls, is3d: !!eng.three,
          params: e.params || {}, featured: true,
        });
      });
      return;
    }
    THEMES.forEach((th, ti) => {
      DIFF.forEach((df) => {
        const id = eng.id + '-' + th.id + '-' + df.d;
        const seed = G.hash(id);
        const r = G.rng(seed);
        const fl = FLAVOR[eng.id] || [eng.title];
        const base = th.name + ' ' + fl[(ti + df.d) % fl.length];
        games.push({
          id, engine: eng.id, theme: th, diff: df.d, diffName: df.name, seed,
          title: df.tag ? base + ' ' + df.tag : base,
          cat: eng.cat, icon: eng.icon, desc: eng.desc, controls: eng.controls, is3d: !!eng.three,
          params: eng.variant ? eng.variant(r, df.d) : {},
        });
      });
    });
  });
  G.catalog = games;
  G.themes = THEMES;
})();
