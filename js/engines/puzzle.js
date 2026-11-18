/* Puzzle / skill engines (2D canvas). */
(function () {
  const { register, clamp } = G;
  const D_ = G.draw;
  const L = ['ArrowLeft'], R = ['ArrowRight'], U = ['ArrowUp'], DN = ['ArrowDown'], SP = ['Space'];

  /* ---------- Merge tiles ---------- */
  register('merge', {
    title: 'Merge Tiles', cat: 'Puzzle', icon: '🔢', controls: 'Arrows / WASD to slide',
    desc: 'Slide and merge matching numbers to build the biggest tile.',
    variant: (r, d) => ({ size: d === 1 ? 5 : d === 2 ? 4 : r() < 0.5 ? 4 : 3, four: 0.1 + r() * 0.15 }),
    create(a) {
      const c = a.ctx, T = a.T, W = a.W, H = a.H, N = a.p.size;
      let g = Array.from({ length: N }, () => Array(N).fill(0));
      const spawn = () => {
        const e = [];
        g.forEach((row, y) => row.forEach((v, x) => !v && e.push([x, y])));
        if (!e.length) return;
        const [x, y] = e[Math.floor(Math.random() * e.length)];
        g[y][x] = Math.random() < a.p.four ? 4 : 2;
      };
      spawn(); spawn();
      const slideRow = (row) => {
        const v = row.filter((x) => x), out = [];
        for (let i = 0; i < v.length; i++) {
          if (v[i] === v[i + 1]) { out.push(v[i] * 2); a.add(v[i] * 2); i++; } else out.push(v[i]);
        }
        while (out.length < N) out.push(0);
        return out;
      };
      const move = (dx, dy) => {
        const before = JSON.stringify(g);
        for (let i = 0; i < N; i++) {
          let line = [];
          for (let j = 0; j < N; j++) {
            const x = dx ? (dx < 0 ? j : N - 1 - j) : i, y = dy ? (dy < 0 ? j : N - 1 - j) : i;
            line.push(g[y][x]);
          }
          line = slideRow(line);
          for (let j = 0; j < N; j++) {
            const x = dx ? (dx < 0 ? j : N - 1 - j) : i, y = dy ? (dy < 0 ? j : N - 1 - j) : i;
            g[y][x] = line[j];
          }
        }
        if (JSON.stringify(g) !== before) spawn();
        const canMove = g.some((row, y) => row.some((v, x) => !v || v === (row[x + 1]) || (g[y + 1] && v === g[y + 1][x])));
        if (!canMove) a.over('No moves left');
      };
      let sx = null, sy = null;
      return {
        update() {
          if (a.hit(...L)) move(-1, 0); else if (a.hit(...R)) move(1, 0); else if (a.hit(...U)) move(0, -1); else if (a.hit(...DN)) move(0, 1);
          if (a.ptr.clicked) { sx = a.ptr.x; sy = a.ptr.y; }
          if (sx != null && !a.ptr.down) {
            const dx = a.ptr.x - sx, dy = a.ptr.y - sy;
            if (Math.max(Math.abs(dx), Math.abs(dy)) > 40) Math.abs(dx) > Math.abs(dy) ? move(Math.sign(dx), 0) : move(0, Math.sign(dy));
            sx = null;
          }
        },
        draw() {
          D_.bg(a);
          const S = 520, cs = S / N, ox = (W - S) / 2, oy = (H - S) / 2;
          D_.rr(c, ox - 8, oy - 8, S + 16, S + 16, 14, T.fg + '22');
          g.forEach((row, y) => row.forEach((v, x) => {
            const lv = v ? Math.log2(v) : 0;
            const col = !v ? T.fg + '14' : [T.a2, T.a1, T.a3][lv % 3];
            D_.rr(c, ox + x * cs + 6, oy + y * cs + 6, cs - 12, cs - 12, 10, col);
            if (v) { c.globalAlpha = Math.min(1, 0.55 + lv * 0.05); D_.text(c, String(v), ox + x * cs + cs / 2, oy + y * cs + cs / 2, T.bg, Math.min(52, cs * 0.42 - String(v).length * 3)); c.globalAlpha = 1; }
          }));
        },
      };
    },
  });

  /* ---------- Mines ---------- */
  register('mines', {
    title: 'Mine Sweep', cat: 'Puzzle', icon: '💣', noPad: true,
    controls: 'Click to dig · right-click (or toggle with Space / F) to flag',
    desc: 'Use the number clues to uncover every safe square.',
    variant: (r, d) => ({ cols: [10, 14, 16][d - 1], rows: [8, 10, 12][d - 1], dens: 0.11 + d * 0.03 + r() * 0.02 }),
    create(a) {
      const c = a.ctx, T = a.T, W = a.W, H = a.H;
      const C = a.p.cols, Rw = a.p.rows, M = Math.round(C * Rw * a.p.dens);
      const cs = Math.min((W - 40) / C, (H - 60) / Rw), ox = (W - cs * C) / 2, oy = (H - cs * Rw) / 2 + 10;
      let cells, first = true, flagMode = false, boards = 0, dead = false;
      const fresh = () => { cells = []; for (let y = 0; y < Rw; y++) for (let x = 0; x < C; x++) cells.push({ x, y, m: false, o: false, f: false, n: 0 }); first = true; };
      const at = (x, y) => (x >= 0 && y >= 0 && x < C && y < Rw ? cells[y * C + x] : null);
      const nb = (cl) => { const o = []; for (let dy = -1; dy <= 1; dy++) for (let dx = -1; dx <= 1; dx++) if (dx || dy) { const n = at(cl.x + dx, cl.y + dy); if (n) o.push(n); } return o; };
      const lay = (sx, sy) => {
        let k = 0;
        while (k < M) { const cl = cells[Math.floor(Math.random() * cells.length)]; if (!cl.m && (Math.abs(cl.x - sx) > 1 || Math.abs(cl.y - sy) > 1)) { cl.m = true; k++; } }
        cells.forEach((cl) => (cl.n = nb(cl).filter((n) => n.m).length));
      };
      const open = (cl) => {
        const st = [cl];
        while (st.length) { const q = st.pop(); if (q.o || q.f) continue; q.o = true; if (!q.m && q.n === 0) nb(q).forEach((n) => !n.o && st.push(n)); }
      };
      fresh();
      return {
        update() {
          if (a.hit('Space', 'KeyF')) flagMode = !flagMode;
          a.hud((flagMode ? '🚩 Flag mode' : '⛏ Dig mode') + ' · Mines ' + (M - cells.filter((q) => q.f).length));
          if (!a.ptr.clicked) return;
          const x = Math.floor((a.ptr.x - ox) / cs), y = Math.floor((a.ptr.y - oy) / cs), cl = at(x, y);
          if (!cl || cl.o) return;
          if (a.ptr.right || flagMode) { cl.f = !cl.f; return; }
          if (cl.f) return;
          if (first) { lay(x, y); first = false; }
          if (cl.m) { cells.forEach((q) => q.m && (q.o = true)); dead = true; return a.over('Boom!'); }
          open(cl);
          a.score(boards * 1000 + cells.filter((q) => q.o).length * 5);
          if (cells.every((q) => q.m || q.o)) { boards++; a.score(boards * 1000); fresh(); }
        },
        draw() {
          D_.bg(a);
          const cols = ['', T.a2, T.a3, T.a1, T.fg, T.a1, T.a2, T.a3, T.fg];
          cells.forEach((q) => {
            const x = ox + q.x * cs, y = oy + q.y * cs;
            D_.rr(c, x + 1.5, y + 1.5, cs - 3, cs - 3, 4, q.o ? (q.m ? T.a1 : T.fg + '18') : T.fg + '55');
            if (q.o && q.m) D_.text(c, '✹', x + cs / 2, y + cs / 2, T.bg, cs * 0.6);
            else if (q.o && q.n) D_.text(c, String(q.n), x + cs / 2, y + cs / 2, cols[q.n], cs * 0.55);
            else if (q.f) D_.text(c, '⚑', x + cs / 2, y + cs / 2, T.a1, cs * 0.6);
          });
        },
      };
    },
  });

  /* ---------- Stack tower ---------- */
  register('stack', {
    title: 'Tower Stack', cat: 'Skill', icon: '🏗️', controls: 'Space / click to drop the block',
    desc: 'Time each drop perfectly to build the tallest tower.',
    variant: (r, d) => ({ speed: 0.85 + r() * 0.35, accel: 0.02 + r() * 0.02 }),
    create(a) {
      const c = a.ctx, T = a.T, W = a.W, H = a.H, BH = 34;
      let tower = [{ x: W / 2 - 130, w: 260 }], cur, dir = 1, cam = 0, falling = [];
      const spawn = () => { const top = tower[tower.length - 1]; cur = { x: dir > 0 ? -top.w : W, w: top.w }; };
      spawn();
      const sp = () => (220 + a.D * 60) * a.p.speed * (1 + tower.length * a.p.accel);
      return {
        update(dt) {
          cur.x += dir * sp() * dt;
          if (cur.x > W) dir = -1; if (cur.x + cur.w < 0) dir = 1;
          if (a.hit(...SP) || a.ptr.clicked) {
            const top = tower[tower.length - 1];
            const l = Math.max(cur.x, top.x), r = Math.min(cur.x + cur.w, top.x + top.w);
            if (r - l <= 2) { falling.push({ ...cur, y: tower.length, vy: 0 }); return a.over('Missed!'); }
            const perfect = Math.abs(cur.x - top.x) < 6;
            const nx = perfect ? top.x : l, nw = perfect ? top.w : r - l;
            if (!perfect) falling.push({ x: cur.x < top.x ? cur.x : r, w: cur.w - nw, y: tower.length, vy: 0 });
            tower.push({ x: nx, w: nw });
            a.add(perfect ? 3 : 1);
            dir = Math.random() < 0.5 ? 1 : -1;
            spawn();
          }
          cam += (Math.max(0, tower.length - 8) * BH - cam) * Math.min(1, dt * 5);
          falling.forEach((f) => { f.vy += 20 * dt; f.y -= f.vy * dt; });
          falling = falling.filter((f) => f.y > -20);
        },
        draw() {
          D_.bg(a);
          const Y = (i) => H - 40 - (i + 1) * BH + cam;
          const col = (i) => [T.a1, T.a2, T.a3][i % 3];
          tower.forEach((b, i) => D_.rect(c, b.x, Y(i), b.w, BH - 2, col(i)));
          falling.forEach((f) => D_.rect(c, f.x, Y(f.y), f.w, BH - 2, T.fg + '66'));
          D_.rect(c, cur.x, Y(tower.length), cur.w, BH - 2, col(tower.length));
          if (tower.length === 1) D_.text(c, 'Space or click to drop', W / 2, 120, T.fg, 24);
        },
      };
    },
  });

  /* ---------- Memory match ---------- */
  register('memory', {
    title: 'Memory Match', cat: 'Puzzle', icon: '🃏', noPad: true, controls: 'Click cards to flip',
    desc: 'Find every matching pair before the clock runs out.',
    variant: (r, d) => ({ pairs: [6, 8, 12][d - 1], time: 50 + Math.floor(r() * 30) - d * 5 }),
    create(a) {
      const c = a.ctx, T = a.T, W = a.W, H = a.H;
      const ICONS = '🍎🍌🍇🍉🍒🍋🥝🍑🍍🥥🌶️🥕🌽🍄🌸🌻⭐🌙⚡🔥💎🎈🎲🎵'.match(/\p{Extended_Pictographic}️?/gu);
      let cards, open = [], wait = 0, time = a.p.time, round = 0;
      const deal = () => {
        round++;
        const n = a.p.pairs, pick = ICONS.slice().sort(() => Math.random() - 0.5).slice(0, n);
        cards = pick.concat(pick).sort(() => Math.random() - 0.5).map((s) => ({ s, up: false, done: false }));
      };
      deal();
      const cols = Math.ceil(Math.sqrt(a.p.pairs * 2 * 1.4)), rows = Math.ceil((a.p.pairs * 2) / cols);
      const cw = Math.min(110, (W - 40) / cols), ch = Math.min(110, (H - 60) / rows), ox = (W - cw * cols) / 2, oy = (H - ch * rows) / 2 + 10;
      return {
        update(dt) {
          time -= dt;
          a.hud('Time ' + Math.max(0, Math.ceil(time)) + 's · Round ' + round);
          if (time <= 0) return a.over("Time's up");
          if (wait > 0) { wait -= dt; if (wait <= 0) { open.forEach((k) => (k.up = false)); open = []; } return; }
          if (!a.ptr.clicked) return;
          const x = Math.floor((a.ptr.x - ox) / cw), y = Math.floor((a.ptr.y - oy) / ch);
          if (x < 0 || x >= cols || y < 0) return;
          const k = cards[y * cols + x];
          if (!k || k.up || k.done) return;
          k.up = true; open.push(k);
          if (open.length === 2) {
            if (open[0].s === open[1].s) { open.forEach((q) => (q.done = true)); open = []; a.add(10); if (cards.every((q) => q.done)) { a.add(Math.ceil(time)); time += 20; deal(); } }
            else wait = 0.7;
          }
        },
        draw() {
          D_.bg(a);
          cards.forEach((k, i) => {
            const x = ox + (i % cols) * cw, y = oy + Math.floor(i / cols) * ch;
            D_.rr(c, x + 5, y + 5, cw - 10, ch - 10, 12, k.done ? T.fg + '22' : k.up ? T.fg : T.a1);
            if (k.up || k.done) D_.text(c, k.s, x + cw / 2, y + ch / 2 + 2, '#000', Math.min(cw, ch) * 0.45);
            else D_.text(c, '?', x + cw / 2, y + ch / 2, T.bg, 30);
          });
        },
      };
    },
  });

  /* ---------- Falling blocks ---------- */
  register('blocks', {
    title: 'Block Drop', cat: 'Puzzle', icon: '🟦', controls: 'Left/Right move · Up rotate · Down soft drop · Space hard drop',
    desc: 'Rotate falling pieces and clear full lines.',
    variant: (r, d) => ({ speed: 0.85 + r() * 0.3 + d * 0.2, cols: r() < 0.25 ? 8 : 10 }),
    create(a) {
      const c = a.ctx, T = a.T, W = a.W, H = a.H, CW = a.p.cols, RW = 20, cs = 27;
      const ox = (W - CW * cs) / 2, oy = (H - RW * cs) / 2;
      const SH = [[[1, 1, 1, 1]], [[1, 1], [1, 1]], [[0, 1, 0], [1, 1, 1]], [[1, 0, 0], [1, 1, 1]], [[0, 0, 1], [1, 1, 1]], [[1, 1, 0], [0, 1, 1]], [[0, 1, 1], [1, 1, 0]]];
      const COL = [T.a2, T.a1, T.a3, T.fg, T.a2, T.a1, T.a3];
      const grid = Array.from({ length: RW }, () => Array(CW).fill(-1));
      let piece, t = 0, lines = 0, nextI = Math.floor(Math.random() * 7);
      const rot = (m) => m[0].map((_, i) => m.map((r) => r[i]).reverse());
      const fits = (m, px, py) => m.every((r, y) => r.every((v, x) => !v || (px + x >= 0 && px + x < CW && py + y < RW && (py + y < 0 || grid[py + y][px + x] < 0))));
      const newPiece = () => { const i = nextI; nextI = Math.floor(Math.random() * 7); piece = { m: SH[i], i, x: Math.floor((CW - SH[i][0].length) / 2), y: -1 }; if (!fits(piece.m, piece.x, piece.y)) a.over(); };
      const lock = () => {
        piece.m.forEach((r, y) => r.forEach((v, x) => { if (v && piece.y + y >= 0) grid[piece.y + y][piece.x + x] = piece.i; }));
        if (piece.y < 0) return a.over();
        let cleared = 0;
        for (let y = RW - 1; y >= 0; y--) if (grid[y].every((v) => v >= 0)) { grid.splice(y, 1); grid.unshift(Array(CW).fill(-1)); cleared++; y++; }
        lines += cleared;
        a.add([0, 100, 300, 500, 800][cleared] * a.D);
        newPiece();
      };
      newPiece();
      let repeat = 0;
      return {
        update(dt) {
          const lvl = 1 + Math.floor(lines / 10);
          a.hud('Lines ' + lines + ' · Lvl ' + lvl);
          const mv = (dx) => fits(piece.m, piece.x + dx, piece.y) && (piece.x += dx);
          if (a.hit(...L)) { mv(-1); repeat = -0.18; } else if (a.hit(...R)) { mv(1); repeat = -0.18; }
          else if (a.down(...L) || a.down(...R)) { repeat += dt; if (repeat > 0.05) { repeat = 0; mv(a.down(...L) ? -1 : 1); } }
          if (a.hit(...U)) { const m = rot(piece.m); for (const k of [0, -1, 1, -2, 2]) if (fits(m, piece.x + k, piece.y)) { piece.m = m; piece.x += k; break; } }
          if (a.hit(...SP)) { while (fits(piece.m, piece.x, piece.y + 1)) { piece.y++; a.add(2); } lock(); return; }
          const step = Math.max(0.06, 0.8 / a.p.speed / (1 + (lvl - 1) * 0.25));
          t += a.down(...DN) ? dt * 12 : dt;
          if (t >= step) { t = 0; if (fits(piece.m, piece.x, piece.y + 1)) piece.y++; else lock(); }
        },
        draw() {
          D_.bg(a);
          D_.rect(c, ox - 4, oy - 4, CW * cs + 8, RW * cs + 8, T.fg + '22');
          D_.rect(c, ox, oy, CW * cs, RW * cs, T.bg);
          grid.forEach((r, y) => r.forEach((v, x) => v >= 0 && D_.rr(c, ox + x * cs + 1, oy + y * cs + 1, cs - 2, cs - 2, 4, COL[v])));
          let gy = piece.y; while (fits(piece.m, piece.x, gy + 1)) gy++;
          piece.m.forEach((r, y) => r.forEach((v, x) => {
            if (!v) return;
            if (gy + y >= 0) D_.rr(c, ox + (piece.x + x) * cs + 1, oy + (gy + y) * cs + 1, cs - 2, cs - 2, 4, COL[piece.i] + '33');
            if (piece.y + y >= 0) D_.rr(c, ox + (piece.x + x) * cs + 1, oy + (piece.y + y) * cs + 1, cs - 2, cs - 2, 4, COL[piece.i]);
          }));
          const nx = ox + CW * cs + 40;
          D_.text(c, 'Next', nx + 40, oy + 20, T.fg, 18);
          SH[nextI].forEach((r, y) => r.forEach((v, x) => v && D_.rr(c, nx + x * 22, oy + 50 + y * 22, 20, 20, 4, COL[nextI])));
        },
      };
    },
  });

  /* ---------- Maze ---------- */
  register('maze', {
    title: 'Maze Escape', cat: 'Puzzle', icon: '🌀', controls: 'Arrows / WASD to move',
    desc: 'Race the clock to the exit of ever-growing mazes.',
    variant: (r, d) => ({ base: 6 + d * 2 + Math.floor(r() * 3), time: 40 - d * 5 + Math.floor(r() * 10) }),
    create(a) {
      const c = a.ctx, T = a.T, W = a.W, H = a.H;
      let n, walls, pos, time = a.p.time, level = 0, rep = 0;
      const build = () => {
        level++;
        n = Math.min(30, a.p.base + level - 1);
        const m = Math.round(n * 0.75);
        walls = { n, m, cells: Array.from({ length: n * m }, () => ({ r: true, b: true, v: false })) };
        const id = (x, y) => y * n + x, st = [[0, 0]];
        walls.cells[0].v = true;
        while (st.length) {
          const [x, y] = st[st.length - 1];
          const opts = [[1, 0], [-1, 0], [0, 1], [0, -1]].map(([dx, dy]) => [x + dx, y + dy, dx, dy]).filter(([nx, ny]) => nx >= 0 && ny >= 0 && nx < n && ny < m && !walls.cells[id(nx, ny)].v);
          if (!opts.length) { st.pop(); continue; }
          const [nx, ny, dx, dy] = opts[Math.floor(Math.random() * opts.length)];
          if (dx === 1) walls.cells[id(x, y)].r = false; if (dx === -1) walls.cells[id(nx, ny)].r = false;
          if (dy === 1) walls.cells[id(x, y)].b = false; if (dy === -1) walls.cells[id(nx, ny)].b = false;
          walls.cells[id(nx, ny)].v = true; st.push([nx, ny]);
        }
        pos = { x: 0, y: 0 };
      };
      build();
      const can = (dx, dy) => {
        const { n, m, cells } = walls, x = pos.x, y = pos.y, nx = x + dx, ny = y + dy;
        if (nx < 0 || ny < 0 || nx >= n || ny >= m) return false;
        if (dx === 1) return !cells[y * n + x].r; if (dx === -1) return !cells[ny * n + nx].r;
        if (dy === 1) return !cells[y * n + x].b; return !cells[ny * n + nx].b;
      };
      return {
        update(dt) {
          time -= dt;
          a.hud('Time ' + Math.max(0, Math.ceil(time)) + 's · Maze ' + level);
          if (time <= 0) return a.over("Time's up");
          const dirs = [[...L, -1, 0], [...R, 1, 0], [...U, 0, -1], [...DN, 0, 1]];
          let moved = false;
          for (const [k, dx, dy] of dirs) if (a.hit(k)) { if (can(dx, dy)) { pos.x += dx; pos.y += dy; } rep = -0.2; moved = true; }
          if (!moved) {
            rep += dt;
            if (rep > 0.07) for (const [k, dx, dy] of dirs) if (a.down(k)) { rep = 0; if (can(dx, dy)) { pos.x += dx; pos.y += dy; } break; }
          }
          if (pos.x === walls.n - 1 && pos.y === walls.m - 1) { a.add(100 + Math.ceil(time) * 2); time += 15 + level * 2; build(); }
        },
        draw() {
          D_.bg(a);
          const { n, m, cells } = walls, cs = Math.min((W - 40) / n, (H - 50) / m), ox = (W - cs * n) / 2, oy = (H - cs * m) / 2 + 10;
          D_.rect(c, ox + (n - 1) * cs + 3, oy + (m - 1) * cs + 3, cs - 6, cs - 6, T.a3);
          D_.circle(c, ox + pos.x * cs + cs / 2, oy + pos.y * cs + cs / 2, cs * 0.32, T.a1);
          c.strokeStyle = T.fg; c.lineWidth = Math.max(2, cs / 10); c.lineCap = 'round'; c.beginPath();
          c.moveTo(ox, oy); c.lineTo(ox + n * cs, oy); c.moveTo(ox, oy); c.lineTo(ox, oy + m * cs);
          cells.forEach((q, i) => {
            const x = ox + (i % n) * cs, y = oy + Math.floor(i / n) * cs;
            if (q.r) { c.moveTo(x + cs, y); c.lineTo(x + cs, y + cs); }
            if (q.b) { c.moveTo(x, y + cs); c.lineTo(x + cs, y + cs); }
          });
          c.stroke();
        },
      };
    },
  });
})();
