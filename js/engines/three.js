/* 3D engines built on three.js (loaded on demand). */
(function () {
  const { register, clamp } = G;
  const L = ['ArrowLeft'], R = ['ArrowRight'], U = ['ArrowUp'], DN = ['ArrowDown'], SP = ['Space'];

  function baseScene(a, fogNear, fogFar) {
    const T = a.T;
    const scene = new THREE.Scene();
    scene.background = new THREE.Color(T.sky);
    scene.fog = new THREE.Fog(T.fog, fogNear, fogFar);
    const camera = new THREE.PerspectiveCamera(65, a.W / a.H, 0.1, 1200);
    const night = !!T.night || a.p.night;
    scene.add(new THREE.HemisphereLight(0xffffff, T.ground, night ? 0.35 : 0.85));
    const sun = new THREE.DirectionalLight(0xffffff, night ? 0.25 : 0.8);
    sun.position.set(60, 120, 40);
    scene.add(sun);
    return { scene, camera, night };
  }
  const disposeScene = (scene) => scene.traverse((o) => { if (o.geometry) o.geometry.dispose(); if (o.material) [].concat(o.material).forEach((m) => m.dispose()); });

  function makeCar(color, accent) {
    const g = new THREE.Group();
    const mat = new THREE.MeshLambertMaterial({ color });
    const body = new THREE.Mesh(new THREE.BoxGeometry(2.2, 0.7, 4.2), mat);
    body.position.y = 0.7; g.add(body);
    const cab = new THREE.Mesh(new THREE.BoxGeometry(1.8, 0.6, 2), new THREE.MeshLambertMaterial({ color: accent }));
    cab.position.set(0, 1.3, -0.3); g.add(cab);
    const wg = new THREE.CylinderGeometry(0.45, 0.45, 0.4, 12), wm = new THREE.MeshLambertMaterial({ color: 0x111111 });
    [[-1.15, 1.4], [1.15, 1.4], [-1.15, -1.4], [1.15, -1.4]].forEach(([x, z]) => { const w = new THREE.Mesh(wg, wm); w.rotation.z = Math.PI / 2; w.position.set(x, 0.45, z); g.add(w); });
    return g;
  }

  /* ---------- Racing 3D ---------- */
  register('race3d', {
    title: 'Turbo Rally 3D', cat: 'Racing', icon: '🏎️', three: true, W: 960, H: 540,
    controls: 'Up/W accelerate · Down/S brake · Left/Right steer',
    desc: 'Three laps, four cars, one winner. Stay on the asphalt!',
    variant: (r, d) => ({ seed: Math.floor(r() * 1e9), jitter: 0.25 + r() * 0.35, ai: 3 + Math.floor(r() * 3), night: r() < 0.2, laps: 3 }),
    create(a) {
      const T = a.T, rr = G.rng(a.p.seed);
      const { scene, camera, night } = baseScene(a, 60, T.night || a.p.night ? 220 : 420);

      // track
      const N = 14, pts = [];
      for (let i = 0; i < N; i++) {
        const an = (i / N) * Math.PI * 2, rad = 170 * (1 - a.p.jitter / 2 + rr() * a.p.jitter);
        pts.push(new THREE.Vector3(Math.cos(an) * rad * 1.25, 0, Math.sin(an) * rad));
      }
      const curve = new THREE.CatmullRomCurve3(pts, true, 'catmullrom', 0.5);
      const S = 600, samples = curve.getSpacedPoints(S).slice(0, S), HW = 9;
      const tang = samples.map((p, i) => samples[(i + 1) % S].clone().sub(p).normalize());
      const pos = [], idx = [];
      samples.forEach((p, i) => { const n = new THREE.Vector3(-tang[i].z, 0, tang[i].x); const l = p.clone().addScaledVector(n, HW), r = p.clone().addScaledVector(n, -HW); pos.push(l.x, 0.02, l.z, r.x, 0.02, r.z); const j = i * 2, k = ((i + 1) % S) * 2; idx.push(j, k, j + 1, j + 1, k, k + 1); });
      const rg = new THREE.BufferGeometry();
      rg.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3)); rg.setIndex(idx); rg.computeVertexNormals();
      scene.add(new THREE.Mesh(rg, new THREE.MeshLambertMaterial({ color: T.road, side: THREE.DoubleSide })));
      // edge stripes
      const stripeM = [new THREE.MeshBasicMaterial({ color: 0xffffff }), new THREE.MeshBasicMaterial({ color: new THREE.Color(T.a1) })];
      const sg = new THREE.BoxGeometry(1, 0.06, 2.2);
      for (let i = 0; i < S; i += 3) for (const side of [1, -1]) {
        const n = new THREE.Vector3(-tang[i].z, 0, tang[i].x);
        const m = new THREE.Mesh(sg, stripeM[(i / 3) % 2 | 0]);
        m.position.copy(samples[i]).addScaledVector(n, side * (HW + 0.5)); m.position.y = 0.04;
        m.rotation.y = Math.atan2(tang[i].x, tang[i].z); scene.add(m);
      }
      // start line
      const sl = new THREE.Mesh(new THREE.BoxGeometry(HW * 2, 0.05, 1.5), new THREE.MeshBasicMaterial({ color: 0xffffff }));
      sl.position.copy(samples[0]); sl.position.y = 0.05; sl.rotation.y = Math.atan2(tang[0].x, tang[0].z); scene.add(sl);
      // ground
      const ground = new THREE.Mesh(new THREE.PlaneGeometry(2000, 2000), new THREE.MeshLambertMaterial({ color: T.ground }));
      ground.rotation.x = -Math.PI / 2; scene.add(ground);
      // scenery
      const trunkG = new THREE.CylinderGeometry(0.4, 0.5, 3, 6), topG = new THREE.ConeGeometry(2.4, 5, 7);
      const trunkM = new THREE.MeshLambertMaterial({ color: 0x5a3a22 }), topM = new THREE.MeshLambertMaterial({ color: new THREE.Color(T.a3) });
      const nearest = (p, hint, win) => {
        let best = 1e9, bi = hint;
        for (let k = -win; k <= win; k++) { const i = (hint + k + S) % S, s = samples[i], d = (s.x - p.x) ** 2 + (s.z - p.z) ** 2; if (d < best) { best = d; bi = i; } }
        return { i: bi, d: Math.sqrt(best) };
      };
      for (let k = 0; k < 220; k++) {
        const x = (rr() - 0.5) * 700, z = (rr() - 0.5) * 600;
        if (nearest({ x, z }, 0, S / 2).d < HW + 6) continue;
        const t = new THREE.Group(); const tr = new THREE.Mesh(trunkG, trunkM); tr.position.y = 1.5; const tp = new THREE.Mesh(topG, topM); tp.position.y = 5; t.add(tr, tp);
        const s = 0.7 + rr() * 0.8; t.scale.set(s, s, s); t.position.set(x, 0, z); scene.add(t);
      }
      let lights = null;
      if (night) { lights = new THREE.PointLight(0xffffee, 2, 60); scene.add(lights); }

      // cars
      const colors = [0xff3b3b, 0x3bb0ff, 0xffd23b, 0x9b5cff, 0x3bff8a, 0xff8a3b];
      const player = { mesh: makeCar(new THREE.Color(T.a1), 0xffffff), x: 0, z: 0, h: 0, v: 0, idx: 0, lap: 0, prog: 0, done: false };
      const place = (car, off, back) => {
        const i = (S - back * 6) % S, n = new THREE.Vector3(-tang[i].z, 0, tang[i].x);
        const p = samples[i].clone().addScaledVector(n, off);
        car.x = p.x; car.z = p.z; car.h = Math.atan2(tang[i].x, tang[i].z); car.idx = i; car.lap = -1;
      };
      place(player, -4, 1);
      scene.add(player.mesh);
      const ais = [];
      for (let k = 0; k < a.p.ai; k++) {
        const c = { mesh: makeCar(colors[k % colors.length], 0x222222), off: (k % 2 ? 4 : -4) * (0.4 + rr() * 0.6), skill: (0.82 + rr() * 0.12) * (0.88 + a.D * 0.06), lap: -1, done: false, t: 0 };
        const back = 2 + k;
        c.t = (S - back * 6) % S; c.lap = -1; c.mesh.position.copy(samples[Math.floor(c.t)]);
        scene.add(c.mesh); ais.push(c);
      }
      const LAPS = a.p.laps, MAXV = 58;
      let count = 3.2, time = 0, finished = 0, finishPos = 0;
      camera.position.set(player.x, 6, player.z - 12);

      const progressOf = (lap, i) => lap * S + i;
      return {
        update(dt) {
          if (count > 0) { count -= dt; a.hud(count > 0.2 ? 'Get ready… ' + Math.ceil(count - 0.2) : 'GO!'); }
          const racing = count <= 0;
          if (racing && !player.done) time += dt;
          // player physics
          const near = nearest(player, player.idx, 60);
          const off = near.d > HW + 0.5;
          const top = off ? MAXV * 0.42 : MAXV;
          if (racing && !player.done) {
            if (a.down(...U)) player.v += 30 * dt; else player.v -= (off ? 30 : 8) * dt * Math.sign(player.v);
            if (a.down(...DN)) player.v -= 45 * dt;
          } else player.v *= 0.97;
          player.v = clamp(player.v, -12, Math.max(top, Math.min(player.v, top + 20)));
          if (player.v > top) player.v -= 40 * dt;
          const steer = (a.down(...L) ? 1 : 0) - (a.down(...R) ? 1 : 0);
          player.h += steer * dt * 2.2 * clamp(Math.abs(player.v) / 18, 0, 1) * Math.sign(player.v || 1);
          player.x += Math.sin(player.h) * player.v * dt; player.z += Math.cos(player.h) * player.v * dt;
          // lap tracking
          const prev = player.idx; player.idx = near.i;
          if (prev > S * 0.8 && player.idx < S * 0.2) player.lap++;
          else if (prev < S * 0.2 && player.idx > S * 0.8) player.lap--;
          if (!player.done && player.lap >= LAPS) { player.done = true; finished++; finishPos = finished; }
          player.mesh.position.set(player.x, 0, player.z); player.mesh.rotation.y = player.h;
          // AI
          ais.forEach((c) => {
            if (racing) {
              const i0 = Math.floor(c.t) % S;
              const look = tang[i0].angleTo(tang[(i0 + 30) % S]);
              const sp = MAXV * c.skill * (1 - Math.min(0.35, look * 0.5)) * (c.done ? 0.5 : 1);
              const nt = c.t + (sp * dt) / (curve.getLength() / S);
              if (nt >= S) { c.lap++; }
              c.t = nt % S;
              if (!c.done && c.lap >= LAPS) { c.done = true; finished++; }
            }
            const i = Math.floor(c.t) % S, f = c.t - Math.floor(c.t), j = (i + 1) % S;
            const p = samples[i].clone().lerp(samples[j], f), n = new THREE.Vector3(-tang[i].z, 0, tang[i].x);
            p.addScaledVector(n, c.off + Math.sin(c.t / 40) * 1.5);
            // simple bump with player
            const dx = p.x - player.x, dz = p.z - player.z, dd = Math.hypot(dx, dz);
            if (dd < 3) { player.x -= (dx / dd) * (3 - dd) * 0.5; player.z -= (dz / dd) * (3 - dd) * 0.5; player.v *= 0.98; }
            c.mesh.position.copy(p); c.mesh.rotation.y = Math.atan2(tang[i].x, tang[i].z);
          });
          // ranking
          const me = progressOf(player.lap, player.idx);
          const rank = player.done ? finishPos : 1 + ais.filter((c) => c.done || progressOf(c.lap, c.t) > me).length;
          if (racing) a.hud('Lap ' + Math.min(LAPS, Math.max(1, player.lap + 1)) + '/' + LAPS + ' · Pos ' + rank + '/' + (ais.length + 1) + ' · ' + Math.round(Math.abs(player.v) * 3.6) + ' km/h');
          a.score(Math.max(0, player.lap) * 1000 + Math.round((player.idx / S) * 1000) * (player.lap >= 0 ? 1 : 0));
          if (player.done) { a.score((ais.length + 2 - finishPos) * 1000 + Math.max(0, Math.round(3000 - time * 15))); a.over(finishPos === 1 ? '🏆 You win!' : 'Finished P' + finishPos); }
          // camera
          const cx = player.x - Math.sin(player.h) * 12, cz = player.z - Math.cos(player.h) * 12;
          camera.position.x += (cx - camera.position.x) * Math.min(1, dt * 5);
          camera.position.z += (cz - camera.position.z) * Math.min(1, dt * 5);
          camera.position.y = 5.5;
          camera.lookAt(player.x + Math.sin(player.h) * 6, 1.5, player.z + Math.cos(player.h) * 6);
          if (lights) lights.position.set(player.x + Math.sin(player.h) * 10, 4, player.z + Math.cos(player.h) * 10);
        },
        draw() { a.renderer.render(scene, camera); },
        destroy() { disposeScene(scene); },
      };
    },
  });

  /* ---------- Survival 3D ---------- */
  register('survival3d', {
    title: 'Last Stand 3D', cat: 'Survival', icon: '🧟', three: true, W: 960, H: 540,
    controls: 'WASD/Arrows move · Mouse aim · Click/Space shoot (auto-aims without mouse)',
    desc: 'Hold out against endless waves of creatures in a 3D arena.',
    variant: (r, d) => ({ obst: 6 + Math.floor(r() * 18), night: r() < 0.35, fast: 0.85 + r() * 0.35, ammo: r() < 0.3 }),
    create(a) {
      const T = a.T;
      const night = !!T.night || a.p.night;
      const { scene, camera } = baseScene(a, 30, night ? 70 : 160);
      const ARENA = 55;
      const ground = new THREE.Mesh(new THREE.PlaneGeometry(ARENA * 2 + 20, ARENA * 2 + 20, 20, 20), new THREE.MeshLambertMaterial({ color: T.ground }));
      ground.rotation.x = -Math.PI / 2; scene.add(ground);
      const grid = new THREE.GridHelper(ARENA * 2, 22, new THREE.Color(T.a2), new THREE.Color(T.a2));
      grid.material.opacity = 0.15; grid.material.transparent = true; grid.position.y = 0.02; scene.add(grid);
      // walls
      const wallM = new THREE.MeshLambertMaterial({ color: new THREE.Color(T.a3) });
      [[0, -ARENA - 1, ARENA * 2 + 4, 2], [0, ARENA + 1, ARENA * 2 + 4, 2], [-ARENA - 1, 0, 2, ARENA * 2 + 4], [ARENA + 1, 0, 2, ARENA * 2 + 4]].forEach(([x, z, w, d]) => {
        const m = new THREE.Mesh(new THREE.BoxGeometry(w, 3, d), wallM); m.position.set(x, 1.5, z); scene.add(m);
      });
      // obstacles
      const boxes = [], boxM = new THREE.MeshLambertMaterial({ color: new THREE.Color(T.a2).multiplyScalar(0.6) });
      for (let i = 0; i < a.p.obst; i++) {
        const w = 2 + a.rnd() * 5, d = 2 + a.rnd() * 5, x = (a.rnd() - 0.5) * ARENA * 1.7, z = (a.rnd() - 0.5) * ARENA * 1.7;
        if (Math.hypot(x, z) < 10) continue;
        const m = new THREE.Mesh(new THREE.BoxGeometry(w, 2 + a.rnd() * 3, d), boxM);
        m.position.set(x, m.geometry.parameters.height / 2, z); scene.add(m);
        boxes.push({ x0: x - w / 2, x1: x + w / 2, z0: z - d / 2, z1: z + d / 2 });
      }
      const collide = (o, r) => {
        o.x = clamp(o.x, -ARENA + r, ARENA - r); o.z = clamp(o.z, -ARENA + r, ARENA - r);
        for (const b of boxes) {
          const cx = clamp(o.x, b.x0, b.x1), cz = clamp(o.z, b.z0, b.z1), dx = o.x - cx, dz = o.z - cz, d = Math.hypot(dx, dz);
          if (d < r) { if (d > 0.0001) { o.x = cx + (dx / d) * r; o.z = cz + (dz / d) * r; } else o.x = b.x1 + r; }
        }
      };
      const blocked = (x, z) => boxes.some((b) => x > b.x0 && x < b.x1 && z > b.z0 && z < b.z1);
      // player
      const pg = new THREE.Group();
      const pBody = new THREE.Mesh(new THREE.CylinderGeometry(0.7, 0.8, 1.8, 12), new THREE.MeshLambertMaterial({ color: new THREE.Color(T.a1) }));
      pBody.position.y = 0.9; pg.add(pBody);
      const pHead = new THREE.Mesh(new THREE.SphereGeometry(0.55, 12, 10), new THREE.MeshLambertMaterial({ color: 0xffe0c0 }));
      pHead.position.y = 2.2; pg.add(pHead);
      const gun = new THREE.Mesh(new THREE.BoxGeometry(0.25, 0.25, 1.4), new THREE.MeshLambertMaterial({ color: 0x222222 }));
      gun.position.set(0.5, 1.3, 0.7); pg.add(gun);
      scene.add(pg);
      let torch = null;
      if (night) { torch = new THREE.PointLight(0xfff2cc, 2.2, 32); torch.position.y = 4; scene.add(torch); }
      const P = { x: 0, z: 0, hp: 100, aim: 0, cd: 0, ammo: 30, reload: 0 };
      // enemies & bullets
      const eG = new THREE.SphereGeometry(1, 12, 10), eyeG = new THREE.SphereGeometry(0.18, 6, 6), eyeM = new THREE.MeshBasicMaterial({ color: 0xffff66 });
      const eMats = [0x66cc44, 0xcc4444, 0x8844cc].map((c) => new THREE.MeshLambertMaterial({ color: c }));
      const bG = new THREE.SphereGeometry(0.22, 6, 6), bM = new THREE.MeshBasicMaterial({ color: new THREE.Color(T.a2) });
      const hG = new THREE.BoxGeometry(1, 1, 1), hM = new THREE.MeshBasicMaterial({ color: 0xff4477 });
      let enemies = [], bullets = [], packs = [], wave = 0, toSpawn = 0, spawnT = 0, time = 0, kills = 0, breather = 2;
      const startWave = () => { wave++; toSpawn = Math.round((4 + wave * 2) * (0.7 + a.D * 0.3)); breather = 0; };
      const spawnEnemy = () => {
        const kind = wave > 3 && Math.random() < 0.2 ? 2 : wave > 1 && Math.random() < 0.3 ? 1 : 0;
        const size = [1, 0.75, 1.6][kind];
        const m = new THREE.Group(); const b = new THREE.Mesh(eG, eMats[kind]); b.scale.setScalar(size); b.position.y = size; m.add(b);
        [-0.35, 0.35].forEach((x) => { const e = new THREE.Mesh(eyeG, eyeM); e.position.set(x * size, size * 1.3, size * 0.85); m.add(e); });
        let x, z, tries = 0;
        do { const side = Math.floor(Math.random() * 4), t = (Math.random() - 0.5) * 2 * (ARENA - 3); [x, z] = [[t, -ARENA + 3], [t, ARENA - 3], [-ARENA + 3, t], [ARENA - 3, t]][side]; } while ((blocked(x, z) || Math.hypot(x - P.x, z - P.z) < 20) && ++tries < 20);
        const sp = [4.2, 6.5, 2.8][kind] * a.p.fast * (0.8 + a.D * 0.15) * (1 + wave * 0.03);
        const hp = [2, 1, 8][kind] + Math.floor(wave / 4);
        m.position.set(x, 0, z); scene.add(m);
        enemies.push({ m, x, z, r: size, sp, hp, dmg: [12, 8, 25][kind], kind });
      };
      const ray = new THREE.Raycaster(), plane = new THREE.Plane(new THREE.Vector3(0, 1, 0), 0), hitPt = new THREE.Vector3(), ndc = new THREE.Vector2();
      startWave();
      return {
        update(dt) {
          time += dt;
          // move
          let mx = 0, mz = 0;
          if (a.down(...L)) mx -= 1; if (a.down(...R)) mx += 1; if (a.down(...U)) mz -= 1; if (a.down(...DN)) mz += 1;
          const ml = Math.hypot(mx, mz) || 1;
          P.x += (mx / ml) * 11 * dt; P.z += (mz / ml) * 11 * dt;
          collide(P, 0.9);
          // aim
          let target = null;
          if (a.ptr.moved) {
            ndc.set((a.ptr.x / a.W) * 2 - 1, -(a.ptr.y / a.H) * 2 + 1);
            ray.setFromCamera(ndc, camera);
            if (ray.ray.intersectPlane(plane, hitPt)) P.aim = Math.atan2(hitPt.x - P.x, hitPt.z - P.z);
          } else {
            let bd = 1e9;
            enemies.forEach((e) => { const d = Math.hypot(e.x - P.x, e.z - P.z); if (d < bd) { bd = d; target = e; } });
            if (target) P.aim = Math.atan2(target.x - P.x, target.z - P.z);
            else if (mx || mz) P.aim = Math.atan2(mx, mz);
          }
          pg.position.set(P.x, 0, P.z); pg.rotation.y = P.aim;
          // shoot
          P.cd -= dt;
          if (P.reload > 0) { P.reload -= dt; if (P.reload <= 0) P.ammo = 30; }
          const firing = a.down(...SP) || (a.ptr.down && !a.ptr.right);
          if (firing && P.cd <= 0 && P.reload <= 0) {
            P.cd = 0.14;
            const m = new THREE.Mesh(bG, bM); m.position.set(P.x + Math.sin(P.aim) * 1.4, 1.3, P.z + Math.cos(P.aim) * 1.4); scene.add(m);
            bullets.push({ m, vx: Math.sin(P.aim) * 55, vz: Math.cos(P.aim) * 55, life: 1.2 });
            if (a.p.ammo) { P.ammo--; if (P.ammo <= 0) P.reload = 1.6; }
          }
          bullets.forEach((b) => {
            b.m.position.x += b.vx * dt; b.m.position.z += b.vz * dt; b.life -= dt;
            if (blocked(b.m.position.x, b.m.position.z)) b.life = 0;
            for (const e of enemies) if (e.hp > 0 && b.life > 0 && Math.hypot(e.x - b.m.position.x, e.z - b.m.position.z) < e.r + 0.3) { e.hp--; b.life = 0; e.hit = 0.1; }
          });
          bullets = bullets.filter((b) => { if (b.life <= 0) { scene.remove(b.m); return false; } return true; });
          // spawn
          if (toSpawn > 0) { spawnT -= dt; if (spawnT <= 0) { spawnT = Math.max(0.25, 1.4 - wave * 0.08 - a.D * 0.15); spawnEnemy(); toSpawn--; } }
          else if (!enemies.length) { if (breather === 0) { a.add(wave * 50); P.hp = Math.min(100, P.hp + 10); } breather += dt; if (breather > 3) startWave(); }
          // enemies
          enemies.forEach((e) => {
            const dx = P.x - e.x, dz = P.z - e.z, d = Math.hypot(dx, dz) || 1;
            e.x += (dx / d) * e.sp * dt; e.z += (dz / d) * e.sp * dt;
            collide(e, e.r);
            for (const o of enemies) if (o !== e) { const ox = e.x - o.x, oz = e.z - o.z, od = Math.hypot(ox, oz), min = e.r + o.r; if (od < min && od > 0) { e.x += (ox / od) * (min - od) * 0.5; e.z += (oz / od) * (min - od) * 0.5; } }
            if (d < e.r + 0.9) P.hp -= e.dmg * dt * (0.7 + a.D * 0.2);
            e.m.position.set(e.x, Math.abs(Math.sin(time * 8 + e.r * 10)) * 0.3, e.z);
            e.m.rotation.y = Math.atan2(dx, dz);
            e.m.children[0].material = e.hit > 0 ? bM : eMats[e.kind];
            e.hit = (e.hit || 0) - dt;
            if (e.hp <= 0) {
              kills++; a.add([10, 15, 40][e.kind]); scene.remove(e.m);
              if (Math.random() < 0.08) { const m = new THREE.Mesh(hG, hM); m.position.set(e.x, 0.8, e.z); scene.add(m); packs.push({ m, x: e.x, z: e.z }); }
            }
          });
          enemies = enemies.filter((e) => e.hp > 0);
          packs = packs.filter((p) => { p.m.rotation.y += dt * 2; if (Math.hypot(p.x - P.x, p.z - P.z) < 1.8) { P.hp = Math.min(100, P.hp + 25); scene.remove(p.m); return false; } return true; });
          a.add(dt * 2);
          const ammoTxt = a.p.ammo ? ' · Ammo ' + (P.reload > 0 ? 'reloading…' : P.ammo) : '';
          a.hud('HP ' + Math.max(0, Math.ceil(P.hp)) + ' · Wave ' + wave + ' · Kills ' + kills + ammoTxt + (breather > 0 && !enemies.length && !toSpawn ? ' · Next wave…' : ''));
          if (P.hp <= 0) a.over('You were overrun');
          // camera
          camera.position.set(P.x, 26, P.z + 18);
          camera.lookAt(P.x, 0, P.z + 1);
          if (torch) torch.position.set(P.x, 5, P.z);
        },
        draw() { a.renderer.render(scene, camera); },
        destroy() { disposeScene(scene); },
      };
    },
  });
})();
