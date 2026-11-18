/* Arcade / action engines (2D canvas). */
(function () {
  const { register, clamp } = G;
  const D_ = G.draw;
  const L = ['ArrowLeft'], R = ['ArrowRight'], U = ['ArrowUp'], DN = ['ArrowDown'], SP = ['Space'];

  /* ---------- Snake ---------- */
  register('snake', {
    title: 'Snake', cat: 'Arcade', icon: '🐍', controls: 'Arrows / WASD to steer',
    desc: 'Eat, grow, and never bite your own tail.',
    variant: (r, d) => ({ speed: 0.8 + r() * 0.4, obst: Math.floor(r() * (d * 5)), wrap: r() < 0.5 }),
    create(a) {
      const C = 40, cols = 20, rows = 15, c = a.ctx, T = a.T;
      let body = [{ x: 5, y: 7 }, { x: 4, y: 7 }, { x: 3, y: 7 }], dir = { x: 1, y: 0 }, nd = dir, t = 0;
      const step = (0.15 - a.D * 0.025) / a.p.speed;
      const obst = [];
      const occupied = (x, y) => body.some((b) => b.x === x && b.y === y) || obst.some((o) => o.x === x && o.y === y);
      for (let i = 0; i < a.p.obst; i++) {
        const x = 2 + Math.floor(a.rnd() * (cols - 4)), y = 1 + Math.floor(a.rnd() * (rows - 2));
        if (y !== 7) obst.push({ x, y });
      }
      let food;
      const place = () => { do food = { x: Math.floor(Math.random() * cols), y: Math.floor(Math.random() * rows) }; while (occupied(food.x, food.y)); };
      place();
      return {
        update(dt) {
          if (a.hit(...U) && dir.y === 0) nd = { x: 0, y: -1 };
          else if (a.hit(...DN) && dir.y === 0) nd = { x: 0, y: 1 };
          else if (a.hit(...L) && dir.x === 0) nd = { x: -1, y: 0 };
          else if (a.hit(...R) && dir.x === 0) nd = { x: 1, y: 0 };
          t += dt;
          if (t < step) return;
          t -= step; dir = nd;
          let h = { x: body[0].x + dir.x, y: body[0].y + dir.y };
          if (a.p.wrap) { h.x = (h.x + cols) % cols; h.y = (h.y + rows) % rows; }
          else if (h.x < 0 || h.y < 0 || h.x >= cols || h.y >= rows) return a.over();
          if (occupied(h.x, h.y) && !(h.x === body[body.length - 1].x && h.y === body[body.length - 1].y)) return a.over();
          body.unshift(h);
          if (h.x === food.x && h.y === food.y) { a.add(10 * a.D); place(); } else body.pop();
        },
        draw() {
          D_.bg(a);
          c.strokeStyle = a.p.wrap ? 'transparent' : T.a2; c.lineWidth = 3; c.strokeRect(1.5, 1.5, a.W - 3, a.H - 3);
          obst.forEach((o) => D_.rr(c, o.x * C + 2, o.y * C + 2, C - 4, C - 4, 6, T.a3));
          D_.circle(c, food.x * C + C / 2, food.y * C + C / 2, C / 2.6, T.a1);
          body.forEach((b, i) => D_.rr(c, b.x * C + 3, b.y * C + 3, C - 6, C - 6, 10, i ? T.a2 : T.fg));
        },
      };
    },
  });

  /* ---------- Breakout ---------- */
  register('breakout', {
    title: 'Brick Smash', cat: 'Arcade', icon: '🧱', controls: 'Mouse / arrows to move paddle',
    desc: 'Bounce the ball and clear every brick.',
    variant: (r, d) => ({ rows: 4 + Math.floor(r() * 3) + d, speed: 0.9 + r() * 0.3, pw: 1 - r() * 0.2 }),
    create(a) {
      const c = a.ctx, T = a.T, W = a.W, H = a.H;
      const pw = (140 - a.D * 18) * a.p.pw;
      let px = W / 2, lives = 3, level = 1, bricks = [], ball, stuck = true;
      const cols = 10, bw = W / cols;
      const build = () => {
        bricks = [];
        for (let y = 0; y < a.p.rows; y++) for (let x = 0; x < cols; x++) bricks.push({ x: x * bw, y: 60 + y * 26, hp: y < level - 1 ? 2 : 1, alive: true });
      };
      const reset = () => { const s = (300 + a.D * 60) * a.p.speed * (1 + (level - 1) * 0.08); ball = { x: px, y: H - 60, vx: s * 0.6, vy: -s * 0.8, s }; stuck = true; };
      build(); reset();
      const cols3 = [T.a1, T.a2, T.a3];
      return {
        update(dt) {
          if (a.down(...L)) px -= 600 * dt;
          if (a.down(...R)) px += 600 * dt;
          if (a.ptr.moved) px = a.ptr.x;
          px = clamp(px, pw / 2, W - pw / 2);
          a.hud('Lives ' + lives + ' · Lvl ' + level);
          if (stuck) { ball.x = px; ball.y = H - 52; if (a.hit(...SP, ...U) || a.ptr.clicked) stuck = false; return; }
          ball.x += ball.vx * dt; ball.y += ball.vy * dt;
          if (ball.x < 8 || ball.x > W - 8) { ball.vx *= -1; ball.x = clamp(ball.x, 8, W - 8); }
          if (ball.y < 8) { ball.vy = Math.abs(ball.vy); }
          if (ball.vy > 0 && ball.y > H - 48 && ball.y < H - 30 && Math.abs(ball.x - px) < pw / 2 + 8) {
            const k = (ball.x - px) / (pw / 2);
            const ang = k * 1.05;
            ball.vx = Math.sin(ang) * ball.s; ball.vy = -Math.cos(ang) * ball.s;
          }
          if (ball.y > H + 20) { lives--; if (lives <= 0) return a.over(); reset(); }
          for (const b of bricks) {
            if (!b.alive) continue;
            if (ball.x > b.x && ball.x < b.x + bw && ball.y > b.y - 8 && ball.y < b.y + 30) {
              b.hp--; if (b.hp <= 0) { b.alive = false; a.add(10 * a.D); }
              const fromSide = ball.y > b.y && ball.y < b.y + 22;
              if (fromSide) ball.vx *= -1; else ball.vy *= -1;
              break;
            }
          }
          if (bricks.every((b) => !b.alive)) { level++; a.add(100); build(); reset(); }
        },
        draw() {
          D_.bg(a);
          bricks.forEach((b, i) => b.alive && D_.rr(c, b.x + 3, b.y, bw - 6, 22, 5, b.hp > 1 ? T.fg : cols3[Math.floor(b.y / 26) % 3]));
          D_.rr(c, px - pw / 2, H - 40, pw, 14, 7, T.fg);
          D_.circle(c, ball.x, ball.y, 8, T.a2);
          if (stuck) D_.text(c, 'Click or Space to launch', W / 2, H / 2, T.fg, 22);
        },
      };
    },
  });

  /* ---------- Space shooter ---------- */
  register('shooter', {
    title: 'Star Blaster', cat: 'Action', icon: '🚀', controls: 'Arrows / mouse to move — auto fire',
    desc: 'Pilot your fighter through endless alien waves.',
    variant: (r, d) => ({ spawn: 0.7 + r() * 0.6, shoot: r() < 0.3 + d * 0.2, spread: r() < 0.4 }),
    create(a) {
      const c = a.ctx, T = a.T, W = a.W, H = a.H;
      const p = { x: W / 2, y: H - 60, hp: 3, cd: 0, inv: 0 };
      let bullets = [], foes = [], eb = [], t = 0, spawnT = 0, stars = [];
      for (let i = 0; i < 80; i++) stars.push({ x: Math.random() * W, y: Math.random() * H, s: 30 + Math.random() * 120 });
      return {
        update(dt) {
          t += dt;
          const sp = 380;
          if (a.down(...L)) p.x -= sp * dt;
          if (a.down(...R)) p.x += sp * dt;
          if (a.down(...U)) p.y -= sp * dt;
          if (a.down(...DN)) p.y += sp * dt;
          if (a.ptr.moved || a.ptr.down) { p.x += (a.ptr.x - p.x) * Math.min(1, dt * 10); p.y += (a.ptr.y - p.y) * Math.min(1, dt * 10); }
          p.x = clamp(p.x, 20, W - 20); p.y = clamp(p.y, 40, H - 20);
          p.cd -= dt; p.inv -= dt;
          if (p.cd <= 0) {
            p.cd = 0.18;
            bullets.push({ x: p.x, y: p.y - 20, vx: 0 });
            if (a.p.spread) { bullets.push({ x: p.x, y: p.y - 20, vx: -120 }); bullets.push({ x: p.x, y: p.y - 20, vx: 120 }); }
          }
          spawnT -= dt;
          if (spawnT <= 0) {
            spawnT = (1.2 / a.p.spawn) / (1 + a.D * 0.3) / (1 + t / 60);
            const hp = 1 + Math.floor(Math.random() * (a.D + t / 40));
            foes.push({ x: 30 + Math.random() * (W - 60), y: -30, hp, max: hp, ph: Math.random() * 6, v: 60 + Math.random() * 40 + a.D * 20, cd: 1 + Math.random() * 2 });
          }
          bullets.forEach((b) => { b.y -= 640 * dt; b.x += b.vx * dt; });
          bullets = bullets.filter((b) => b.y > -10);
          foes.forEach((f) => {
            f.y += f.v * dt; f.x += Math.sin(t * 2 + f.ph) * 60 * dt; f.cd -= dt;
            if (a.p.shoot && f.cd <= 0 && f.y > 0) { f.cd = 2.5 - a.D * 0.4; const ang = Math.atan2(p.y - f.y, p.x - f.x); eb.push({ x: f.x, y: f.y, vx: Math.cos(ang) * 220, vy: Math.sin(ang) * 220 }); }
            for (const b of bullets) if (!b.dead && Math.abs(b.x - f.x) < 22 && Math.abs(b.y - f.y) < 22) { b.dead = true; f.hp--; }
          });
          bullets = bullets.filter((b) => !b.dead);
          foes.forEach((f) => { if (f.hp <= 0) { f.dead = true; a.add(10 * f.max); } });
          const hurt = () => { if (p.inv > 0) return; p.hp--; p.inv = 1.5; if (p.hp <= 0) a.over(); };
          foes.forEach((f) => { if (!f.dead && Math.hypot(f.x - p.x, f.y - p.y) < 34) { f.dead = true; hurt(); } if (f.y > H + 40) { f.dead = true; } });
          foes = foes.filter((f) => !f.dead);
          eb.forEach((b) => { b.x += b.vx * dt; b.y += b.vy * dt; if (Math.hypot(b.x - p.x, b.y - p.y) < 16) { b.dead = true; hurt(); } });
          eb = eb.filter((b) => !b.dead && b.y < H + 10 && b.y > -10 && b.x > -10 && b.x < W + 10);
          stars.forEach((s) => { s.y += s.s * dt; if (s.y > H) { s.y = 0; s.x = Math.random() * W; } });
          a.hud('HP ' + '♥'.repeat(Math.max(0, p.hp)));
        },
        draw() {
          D_.bg(a);
          stars.forEach((s) => D_.rect(c, s.x, s.y, 2, 2, T.fg + '66'));
          bullets.forEach((b) => D_.rect(c, b.x - 2, b.y - 8, 4, 14, T.a2));
          eb.forEach((b) => D_.circle(c, b.x, b.y, 5, T.a3));
          foes.forEach((f) => {
            c.fillStyle = T.a1; c.beginPath(); c.moveTo(f.x, f.y + 18); c.lineTo(f.x - 20, f.y - 14); c.lineTo(f.x + 20, f.y - 14); c.fill();
            D_.rect(c, f.x - 16, f.y - 22, 32 * (f.hp / f.max), 3, T.fg);
          });
          if (p.inv <= 0 || Math.floor(p.inv * 10) % 2) {
            c.fillStyle = T.fg; c.beginPath(); c.moveTo(p.x, p.y - 22); c.lineTo(p.x - 18, p.y + 16); c.lineTo(p.x + 18, p.y + 16); c.fill();
            D_.circle(c, p.x, p.y + 4, 5, T.a2);
          }
        },
      };
    },
  });

  /* ---------- Endless runner ---------- */
  register('runner', {
    title: 'Dash Runner', cat: 'Action', icon: '🏃', controls: 'Space / Up / tap to jump · Down to duck (some levels allow double-jump)',
    desc: 'Sprint, jump and duck past obstacles for as long as you can.',
    variant: (r, d) => ({ speed: 0.9 + r() * 0.3, dbl: r() < 0.5, birds: r() < 0.3 + d * 0.15 }),
    create(a) {
      const c = a.ctx, T = a.T, W = a.W, H = a.H, GY = H - 110;
      const p = { x: 140, y: GY, vy: 0, jumps: 0, duck: false };
      let obs = [], speed = (320 + a.D * 50) * a.p.speed, gap = 1, dist = 0, hills = [];
      for (let i = 0; i < 8; i++) hills.push({ x: i * 140, h: 40 + Math.random() * 80 });
      return {
        update(dt) {
          speed += dt * 6;
          dist += speed * dt;
          a.score(dist / 10);
          const jump = a.hit(...SP, ...U) || a.ptr.clicked;
          const maxJ = a.p.dbl ? 2 : 1;
          if (jump && p.jumps < maxJ) { p.vy = -720; p.jumps++; }
          p.duck = a.down(...DN) && p.jumps === 0;
          p.vy += 2100 * dt; p.y += p.vy * dt;
          if (p.y >= GY) { p.y = GY; p.vy = 0; p.jumps = 0; }
          gap -= dt;
          if (gap <= 0) {
            gap = (0.9 + Math.random() * 1.1) * (420 / speed) * (1.4 - a.D * 0.12);
            if (a.p.birds && Math.random() < 0.3) obs.push({ x: W + 20, y: GY - 22 - Math.random() * 10, w: 40, h: 24, bird: true });
            else { const h = 30 + Math.random() * 40; obs.push({ x: W + 20, y: GY - h + 40, w: 22 + Math.random() * 30, h }); }
          }
          obs.forEach((o) => (o.x -= speed * dt));
          obs = obs.filter((o) => o.x > -80);
          hills.forEach((h) => { h.x -= speed * 0.2 * dt; if (h.x < -140) h.x += 8 * 140; });
          const ph = p.duck ? 26 : 50;
          const px0 = p.x - 16, py0 = p.y + 40 - ph;
          for (const o of obs) if (px0 < o.x + o.w && px0 + 32 > o.x && py0 < o.y + o.h && py0 + ph > o.y) return a.over();
        },
        draw() {
          D_.bg(a);
          hills.forEach((h) => { c.fillStyle = T.a3 + '33'; c.beginPath(); c.arc(h.x, GY + 40, h.h, Math.PI, 0); c.fill(); });
          D_.rect(c, 0, GY + 40, W, 4, T.fg);
          D_.rect(c, 0, GY + 44, W, H, T.a3 + '22');
          obs.forEach((o) => D_.rr(c, o.x, o.y, o.w, o.h, 4, o.bird ? T.a2 : T.a1));
          const ph = p.duck ? 26 : 50;
          D_.rr(c, p.x - 16, p.y + 40 - ph, 32, ph, 8, T.fg);
          D_.circle(c, p.x + 6, p.y + 50 - ph, 4, T.bg);
        },
      };
    },
  });

  /* ---------- Glide (tap to flap) ---------- */
  register('glide', {
    title: 'Glider', cat: 'Arcade', icon: '🐦', controls: 'Space / tap to flap',
    desc: 'Flap through the gaps — one touch and it is over.',
    variant: (r, d) => ({ gap: 1 - r() * 0.15, grav: 0.9 + r() * 0.25, move: r() < d * 0.25 }),
    create(a) {
      const c = a.ctx, T = a.T, W = a.W, H = a.H;
      const b = { y: H / 2, vy: 0 };
      let pipes = [], t = 1, started = false, time = 0;
      const gap = (210 - a.D * 22) * a.p.gap, speed = 200 + a.D * 25;
      return {
        update(dt) {
          time += dt;
          const flap = a.hit(...SP, ...U) || a.ptr.clicked;
          if (!started) { if (flap) started = true; else { b.y = H / 2 + Math.sin(time * 4) * 10; return; } }
          if (flap) b.vy = -360;
          b.vy += 1250 * a.p.grav * dt; b.y += b.vy * dt;
          t -= dt;
          if (t <= 0) { t = 1.45; pipes.push({ x: W + 40, gy: 120 + Math.random() * (H - 240), ph: Math.random() * 6, scored: false }); }
          pipes.forEach((p) => { p.x -= speed * dt; if (a.p.move) p.gy += Math.sin(time * 2 + p.ph) * 40 * dt; });
          pipes = pipes.filter((p) => p.x > -80);
          if (b.y > H - 10 || b.y < 0) return a.over();
          for (const p of pipes) {
            if (Math.abs(p.x - 200) < 50 && (b.y - 16 < p.gy - gap / 2 || b.y + 16 > p.gy + gap / 2)) return a.over();
            if (!p.scored && p.x < 200) { p.scored = true; a.add(1); }
          }
        },
        draw() {
          D_.bg(a);
          pipes.forEach((p) => {
            D_.rr(c, p.x - 35, -10, 70, p.gy - gap / 2 + 10, 8, T.a3);
            D_.rr(c, p.x - 35, p.gy + gap / 2, 70, H, 8, T.a3);
          });
          D_.circle(c, 200, b.y, 18, T.a1);
          D_.circle(c, 207, b.y - 5, 5, T.fg);
          c.fillStyle = T.a2; c.beginPath(); c.moveTo(216, b.y); c.lineTo(230, b.y + 4); c.lineTo(216, b.y + 8); c.fill();
          if (!started) D_.text(c, 'Tap or Space to start', W / 2, H / 2 + 80, T.fg, 24);
        },
      };
    },
  });

  /* ---------- Asteroid drift ---------- */
  register('drift', {
    title: 'Rock Drift', cat: 'Action', icon: '☄️', controls: 'Left/Right rotate · Up thrust · Space fire',
    desc: 'Blast drifting space rocks into dust.',
    variant: (r, d) => ({ rocks: 3 + Math.floor(r() * 2) + d, thrust: 0.85 + r() * 0.3 }),
    create(a) {
      const c = a.ctx, T = a.T, W = a.W, H = a.H;
      const s = { x: W / 2, y: H / 2, vx: 0, vy: 0, a: -Math.PI / 2, cd: 0, inv: 2 };
      let rocks = [], shots = [], lives = 3, wave = 0;
      const mk = (x, y, r) => { const an = Math.random() * 6.28, v = (40 + Math.random() * 60) * (1 + a.D * 0.15) * (60 / r) ** 0.4; const pts = []; for (let i = 0; i < 10; i++) pts.push(0.75 + Math.random() * 0.35); return { x, y, r, vx: Math.cos(an) * v, vy: Math.sin(an) * v, pts, rot: Math.random() }; };
      const next = () => { wave++; for (let i = 0; i < a.p.rocks + wave - 1; i++) { const side = Math.random() < 0.5; rocks.push(mk(side ? 0 : Math.random() * W, side ? Math.random() * H : 0, 55)); } };
      next();
      const wrap = (o) => { o.x = (o.x + W) % W; o.y = (o.y + H) % H; };
      return {
        update(dt) {
          if (a.down(...L)) s.a -= 4.2 * dt;
          if (a.down(...R)) s.a += 4.2 * dt;
          if (a.down(...U)) { s.vx += Math.cos(s.a) * 320 * a.p.thrust * dt; s.vy += Math.sin(s.a) * 320 * a.p.thrust * dt; }
          s.vx *= 0.992; s.vy *= 0.992;
          s.x += s.vx * dt; s.y += s.vy * dt; wrap(s);
          s.cd -= dt; s.inv -= dt;
          if (a.down(...SP) && s.cd <= 0) { s.cd = 0.22; shots.push({ x: s.x + Math.cos(s.a) * 18, y: s.y + Math.sin(s.a) * 18, vx: Math.cos(s.a) * 560 + s.vx, vy: Math.sin(s.a) * 560 + s.vy, life: 1 }); }
          shots.forEach((b) => { b.x += b.vx * dt; b.y += b.vy * dt; b.life -= dt; wrap(b); });
          const born = [];
          rocks.forEach((r) => {
            r.x += r.vx * dt; r.y += r.vy * dt; r.rot += dt * 0.5; wrap(r);
            for (const b of shots) if (b.life > 0 && Math.hypot(b.x - r.x, b.y - r.y) < r.r) {
              b.life = 0; r.dead = true; a.add(Math.round(1500 / r.r));
              if (r.r > 20) { born.push(mk(r.x, r.y, r.r / 2)); born.push(mk(r.x, r.y, r.r / 2)); }
              break;
            }
            if (!r.dead && s.inv <= 0 && Math.hypot(s.x - r.x, s.y - r.y) < r.r + 10) {
              lives--; s.inv = 2.5; s.x = W / 2; s.y = H / 2; s.vx = s.vy = 0;
              if (lives <= 0) a.over();
            }
          });
          rocks = rocks.filter((r) => !r.dead).concat(born);
          shots = shots.filter((b) => b.life > 0);
          if (!rocks.length) next();
          a.hud('Lives ' + lives + ' · Wave ' + wave);
        },
        draw() {
          D_.bg(a);
          c.lineWidth = 2;
          rocks.forEach((r) => {
            c.strokeStyle = T.a3; c.beginPath();
            r.pts.forEach((k, i) => { const an = r.rot + (i / r.pts.length) * 6.28; const x = r.x + Math.cos(an) * r.r * k, y = r.y + Math.sin(an) * r.r * k; i ? c.lineTo(x, y) : c.moveTo(x, y); });
            c.closePath(); c.stroke();
          });
          shots.forEach((b) => D_.circle(c, b.x, b.y, 3, T.a2));
          if (s.inv <= 0 || Math.floor(s.inv * 10) % 2) {
            c.save(); c.translate(s.x, s.y); c.rotate(s.a);
            c.strokeStyle = T.fg; c.beginPath(); c.moveTo(18, 0); c.lineTo(-12, -11); c.lineTo(-6, 0); c.lineTo(-12, 11); c.closePath(); c.stroke();
            if (a.down(...U)) { c.strokeStyle = T.a1; c.beginPath(); c.moveTo(-8, -5); c.lineTo(-20 - Math.random() * 8, 0); c.lineTo(-8, 5); c.stroke(); }
            c.restore();
          }
        },
      };
    },
  });

  /* ---------- Pong ---------- */
  register('pong', {
    title: 'Paddle Duel', cat: 'Sports', icon: '🏓', controls: 'Up/Down or mouse',
    desc: 'Out-rally the computer. Five misses and you are out.',
    variant: (r, d) => ({ ai: 0.75 + r() * 0.2 + d * 0.07, speed: 0.9 + r() * 0.3 }),
    create(a) {
      const c = a.ctx, T = a.T, W = a.W, H = a.H, PH = 100;
      let py = H / 2, ay = H / 2, ball, lives = 5;
      const serve = (dir) => { const s = (360 + a.D * 50) * a.p.speed; const an = (Math.random() - 0.5) * 0.8; ball = { x: W / 2, y: H / 2, vx: Math.cos(an) * s * dir, vy: Math.sin(an) * s, s, wait: 0.8 }; };
      serve(1);
      return {
        update(dt) {
          if (a.down(...U)) py -= 520 * dt;
          if (a.down(...DN)) py += 520 * dt;
          if (a.ptr.moved) py = a.ptr.y;
          py = clamp(py, PH / 2, H - PH / 2);
          const aiSp = 380 * a.p.ai;
          const target = ball.vx > 0 ? ball.y : H / 2;
          ay += clamp(target - ay, -aiSp * dt, aiSp * dt);
          ay = clamp(ay, PH / 2, H - PH / 2);
          if (ball.wait > 0) { ball.wait -= dt; return; }
          ball.x += ball.vx * dt; ball.y += ball.vy * dt;
          if (ball.y < 10 || ball.y > H - 10) { ball.vy *= -1; ball.y = clamp(ball.y, 10, H - 10); }
          const hitP = (x, y, dir) => {
            const k = (ball.y - y) / (PH / 2);
            ball.s *= 1.04;
            ball.vx = Math.cos(k * 0.9) * ball.s * dir; ball.vy = Math.sin(k * 0.9) * ball.s;
          };
          if (ball.vx < 0 && ball.x < 50 && ball.x > 26 && Math.abs(ball.y - py) < PH / 2 + 10) { hitP(40, py, 1); a.add(1); }
          if (ball.vx > 0 && ball.x > W - 50 && ball.x < W - 26 && Math.abs(ball.y - ay) < PH / 2 + 10) hitP(W - 40, ay, -1);
          if (ball.x < -20) { lives--; if (lives <= 0) return a.over(); serve(1); }
          if (ball.x > W + 20) { a.add(5); serve(-1); }
          a.hud('Lives ' + lives);
        },
        draw() {
          D_.bg(a);
          for (let y = 10; y < H; y += 30) D_.rect(c, W / 2 - 2, y, 4, 16, T.fg + '44');
          D_.rr(c, 26, py - PH / 2, 14, PH, 7, T.a2);
          D_.rr(c, W - 40, ay - PH / 2, 14, PH, 7, T.a1);
          D_.circle(c, ball.x, ball.y, 9, T.fg);
        },
      };
    },
  });

  /* ---------- Dodge ---------- */
  register('dodge', {
    title: 'Meteor Dodge', cat: 'Arcade', icon: '🌠', controls: 'Left/Right or mouse — grab stars',
    desc: 'Dodge the falling hazards and snag bonus stars.',
    variant: (r, d) => ({ rate: 0.8 + r() * 0.5, size: 0.8 + r() * 0.5 }),
    create(a) {
      const c = a.ctx, T = a.T, W = a.W, H = a.H;
      let x = W / 2, items = [], t = 0, spawn = 0;
      return {
        update(dt) {
          t += dt; a.add(dt * 10);
          if (a.down(...L)) x -= 460 * dt;
          if (a.down(...R)) x += 460 * dt;
          if (a.ptr.moved || a.ptr.down) x += (a.ptr.x - x) * Math.min(1, dt * 12);
          x = clamp(x, 20, W - 20);
          spawn -= dt;
          if (spawn <= 0) {
            spawn = (0.55 / a.p.rate) / (1 + a.D * 0.25) / (1 + t / 45);
            const star = Math.random() < 0.12;
            items.push({ x: Math.random() * W, y: -30, r: star ? 12 : (10 + Math.random() * 18) * a.p.size, v: 180 + Math.random() * 120 + t * 4 + a.D * 30, star });
          }
          for (const it of items) {
            it.y += it.v * dt;
            if (Math.hypot(it.x - x, it.y - (H - 40)) < it.r + 16) {
              if (it.star) { it.dead = true; a.add(50); } else return a.over();
            }
          }
          items = items.filter((i) => !i.dead && i.y < H + 40);
        },
        draw() {
          D_.bg(a);
          items.forEach((i) => {
            if (i.star) D_.text(c, '★', i.x, i.y, T.a2, 30);
            else D_.circle(c, i.x, i.y, i.r, T.a1);
          });
          D_.rr(c, x - 18, H - 58, 36, 36, 10, T.fg);
        },
      };
    },
  });
})();
