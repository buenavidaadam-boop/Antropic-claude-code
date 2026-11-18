/* Low-poly time-trial racer with block tracks, ghosts and a track editor. */
(function () {
  const LEN = 20, HW = 8, RC = 20, HS = 4, KH = 4, GROUND = -0.6, SLAB = 0.6;
  const MAX = 40, ACC = 26, BRAKE = 45, BOOST = 60, GRAV = 30;
  const HALF = Math.PI / 2;

  const PIECES = {
    S: { name: 'Straight', icon: '⬆' }, L: { name: 'Left turn', icon: '↰' }, R: { name: 'Right turn', icon: '↱' },
    U: { name: 'Ramp up', icon: '◢' }, D: { name: 'Ramp down', icon: '◣' }, K: { name: 'Kicker', icon: '⤴' },
    G: { name: 'Gap', icon: '␣' }, B: { name: 'Boost', icon: '⏩' }, C: { name: 'Checkpoint', icon: '⛳' },
  };

  const TRACKS = [
    { key: 'warmup', name: 'Warm Up', diff: 1, code: 'SSSRSSCSSLSSSRSBSSLSS' },
    { key: 'hills', name: 'Rolling Hills', diff: 1, code: 'SSUSSRSUSCSLSDSSRSDSS' },
    { key: 'airtime', name: 'Air Time', diff: 2, code: 'SSBSKGSSRSSCSBKGSSLSS' },
    { key: 'zigzag', name: 'Zig Zag', diff: 2, code: 'SRSLSRSLSCSRSLSRSLSS' },
    { key: 'spiral', name: 'Sky Spiral', diff: 2, code: 'SUSRSUSRSUSRSUSCSSDSLSDSSDSLSDSS' },
    { key: 'chicane', name: 'Chicane Chaos', diff: 3, code: 'SBSRLRLSCSLRLRSBSS' },
    { key: 'longjump', name: 'The Long Jump', diff: 3, code: 'SSBBSKGGSSCSRSSBKGSSS' },
    { key: 'pass', name: 'Mountain Pass', diff: 3, code: 'SUUSRSUSLSCSSRSDDSBKGSSSLSDSS' },
  ];

  /* ---- track layout (pure math, no THREE) ---- */
  function clean(code) { return String(code || '').toUpperCase().replace(/[^SLRUDBCKG]/g, '').slice(0, 300); }
  function layout(code) {
    const seq = 'S' + clean(code) + 'F';
    let x = 0, z = 0, y = 0, h = 0;
    const pieces = [];
    for (const ch of seq) {
      let t = ch;
      if (t === 'D' && y <= 0) t = 'S';
      const p = { t, x, y, z, h, i: pieces.length };
      const sh = Math.sin(h), chh = Math.cos(h);
      if (t === 'L' || t === 'R') {
        const s = t === 'L' ? 1 : -1;
        p.s = s; p.y1 = y;
        x += sh * RC + chh * RC * s; z += chh * RC - sh * RC * s;
        h = Math.round((h + s * HALF) / HALF) * HALF;
      } else {
        const rise = t === 'U' ? HS : t === 'D' ? -HS : 0;
        p.y1 = y + rise;
        x += sh * LEN; z += chh * LEN; y += rise;
      }
      x = Math.round(x * 1e4) / 1e4; z = Math.round(z * 1e4) / 1e4;
      pieces.push(p);
    }
    return { pieces, end: { x, y, z, h } };
  }
  function heightAt(p, X, Z) {
    const dx = X - p.x, dz = Z - p.z, sh = Math.sin(p.h), ch = Math.cos(p.h);
    const u = dx * sh + dz * ch, v = dx * ch - dz * sh;
    if (p.t === 'L' || p.t === 'R') {
      const vv = v * p.s;
      if (u < 0 || vv > RC) return null;
      const d = Math.hypot(u, vv - RC);
      if (Math.abs(d - RC) > HW) return null;
      return { y: p.y, u: Math.atan2(u, RC - vv) * RC };
    }
    if (p.t === 'G' || u < 0 || u > LEN || Math.abs(v) > HW) return null;
    return { y: p.t === 'K' ? p.y + (KH * u) / LEN : p.y + ((p.y1 - p.y) * u) / LEN, u };
  }
  function samples(p) {
    if (p.t === 'L' || p.t === 'R') {
      const out = [];
      for (let k = 0; k <= 12; k++) {
        const a = (k / 12) * HALF;
        out.push({ u: RC * Math.sin(a), v: p.s * (RC - RC * Math.cos(a)), y: p.y, nu: -p.s * Math.sin(a), nv: Math.cos(a) });
      }
      return out;
    }
    const y1 = p.t === 'K' ? p.y + KH : p.y1;
    return [{ u: 0, v: 0, y: p.y, nu: 0, nv: 1 }, { u: LEN, v: 0, y: y1, nu: 0, nv: 1 }];
  }
  function poseAt(p, u) {
    const sh = Math.sin(p.h), ch = Math.cos(p.h);
    return { x: p.x + sh * u, y: p.y, z: p.z + ch * u, h: p.h };
  }
  G.trials = { layout, heightAt, TRACKS };

  const fmt = (t) => { const m = Math.floor(t / 60), s = t - m * 60; return m + ':' + (s < 10 ? '0' : '') + s.toFixed(3); };

  G.register('trials3d', {
    title: 'Poly Rally', cat: 'Racing', icon: '🏁', three: true, noHud: true, W: 960, H: 540,
    controls: 'Up/W gas · Down/S brake · Left/Right steer · Space drift · Enter respawn at checkpoint · R restart · M mute',
    desc: 'Low-poly time trials: ramps, jumps, boost pads and checkpoints. Beat your ghost!',
    entries: () =>
      TRACKS.map((t, i) => ({ key: t.key, title: 'Poly Rally: ' + t.name, diff: t.diff, params: { track: i } })).concat([
        { key: 'editor', title: 'Poly Rally: Track Builder', diff: 2, params: { editor: true }, icon: '🛠️', desc: 'Build your own track piece by piece, then race it.' },
      ]),
    create(a) {
      const stage = a.canvas.parentElement;
      const renderer = a.renderer;
      renderer.shadowMap.enabled = true;
      renderer.shadowMap.type = THREE.PCFSoftShadowMap;

      const scene = new THREE.Scene();
      scene.background = new THREE.Color(0x9ad6ff);
      scene.fog = new THREE.Fog(0x9ad6ff, 150, 520);
      const camera = new THREE.PerspectiveCamera(70, a.W / a.H, 0.1, 1500);
      scene.add(new THREE.HemisphereLight(0xffffff, 0x5a8a4a, 0.75));
      const sun = new THREE.DirectionalLight(0xffffff, 0.8);
      sun.castShadow = true;
      sun.shadow.mapSize.set(2048, 2048);
      Object.assign(sun.shadow.camera, { left: -60, right: 60, top: 60, bottom: -60, near: 1, far: 300 });
      scene.add(sun, sun.target);

      const ground = new THREE.Mesh(new THREE.PlaneGeometry(4000, 4000), new THREE.MeshLambertMaterial({ color: 0x7ccf6a }));
      ground.rotation.x = -Math.PI / 2; ground.position.y = GROUND; ground.receiveShadow = true;
      scene.add(ground);

      const M = (c, extra) => new THREE.MeshLambertMaterial(Object.assign({ color: c, flatShading: true }, extra));
      const mats = {
        road: M(0x4b5160), road2: M(0x555b6b), under: M(0x8a8f9c), curbA: M(0xff4d5a), curbB: M(0xffffff),
        pillar: M(0xb7bcc8), boost: new THREE.MeshBasicMaterial({ color: 0xff9a1f }), cp: M(0xffd23f), start: M(0x3ddc84),
        fin: M(0x222222), finW: M(0xffffff), tree: M(0x3f9e4d), tree2: M(0x2f7f3c), trunk: M(0x7a5232), rock: M(0x9aa0aa),
      };

      /* ---- geometry helpers ---- */
      function slab(p, ss, off, hw, top, bot, flatBottom) {
        const P = [];
        const pt = (s, side, yy, flat) => { const o = off + side * hw; return [s.v + s.nv * o, flat ? yy : s.y - p.y + yy, s.u + s.nu * o]; };
        const quad = (A, B, C, D) => P.push(...A, ...B, ...C, ...A, ...C, ...D);
        for (let i = 0; i < ss.length - 1; i++) {
          const s0 = ss[i], s1 = ss[i + 1];
          const L0t = pt(s0, 1, top), R0t = pt(s0, -1, top), L1t = pt(s1, 1, top), R1t = pt(s1, -1, top);
          const L0b = pt(s0, 1, bot, flatBottom), R0b = pt(s0, -1, bot, flatBottom), L1b = pt(s1, 1, bot, flatBottom), R1b = pt(s1, -1, bot, flatBottom);
          quad(R0t, R1t, L1t, L0t); quad(L0b, L1b, R1b, R0b); quad(L0t, L1t, L1b, L0b); quad(R0b, R1b, R1t, R0t);
          if (i === 0) quad(L0t, L0b, R0b, R0t);
          if (i === ss.length - 2) quad(R1t, R1b, L1b, L1t);
        }
        const g = new THREE.BufferGeometry();
        g.setAttribute('position', new THREE.Float32BufferAttribute(P, 3));
        g.computeVertexNormals();
        return g;
      }
      const box = (w, h, d, mat, x, y, z) => { const m = new THREE.Mesh(new THREE.BoxGeometry(w, h, d), mat); m.position.set(x, y, z); m.castShadow = m.receiveShadow = true; return m; };

      function gate(g, u, mat, matB) {
        const y = 0;
        g.add(box(0.8, 6, 0.8, mat, HW + 0.6, y + 3, u), box(0.8, 6, 0.8, mat, -HW - 0.6, y + 3, u));
        if (matB) for (let k = 0; k < 8; k++) g.add(box((2 * HW + 2) / 8, 1.2, 0.8, k % 2 ? mat : matB, -HW - 1 + (k + 0.5) * ((2 * HW + 2) / 8), y + 6.4, u));
        else g.add(box(2 * HW + 2, 1.2, 0.8, mat, 0, y + 6.4, u));
      }

      let track = null;
      function buildTrack(code) {
        if (track) { scene.remove(track.group); track.group.traverse((o) => o.geometry && o.geometry.dispose()); }
        const L = layout(code), group = new THREE.Group();
        let minX = 1e9, maxX = -1e9, minZ = 1e9, maxZ = -1e9;
        L.pieces.forEach((p, idx) => {
          const g = new THREE.Group();
          g.position.set(p.x, p.y, p.z); g.rotation.y = p.h;
          minX = Math.min(minX, p.x); maxX = Math.max(maxX, p.x); minZ = Math.min(minZ, p.z); maxZ = Math.max(maxZ, p.z);
          if (p.t !== 'G') {
            const ss = samples(p);
            const road = new THREE.Mesh(slab(p, ss, 0, HW, 0, -SLAB, p.t === 'K'), idx % 2 ? mats.road : mats.road2);
            road.receiveShadow = true; road.castShadow = true; g.add(road);
            const cm = idx % 2 ? mats.curbA : mats.curbB;
            [1, -1].forEach((side) => { const c = new THREE.Mesh(slab(p, ss, side * (HW - 0.5), 0.5, 0.18, 0), cm); c.receiveShadow = true; g.add(c); });
            if (p.y > 0.1 || p.t === 'K') {
              const mid = ss[Math.floor(ss.length / 2)];
              const ph = p.y - SLAB - GROUND;
              if (ph > 0.2) g.add(box(2.2, ph, 2.2, mats.pillar, mid.v, -SLAB - ph / 2, mid.u));
              if (ss.length === 2 && ph > 0.2) g.add(box(2.2, ph, 2.2, mats.pillar, 0, -SLAB - ph / 2, LEN - 2), box(2.2, ph, 2.2, mats.pillar, 0, -SLAB - ph / 2, 2));
            }
          }
          if (p.t === 'B') {
            const sh = new THREE.Shape(); sh.moveTo(-4, 0); sh.lineTo(0, 3); sh.lineTo(4, 0); sh.lineTo(4, -1.6); sh.lineTo(0, 1.4); sh.lineTo(-4, -1.6);
            const ag = new THREE.ShapeGeometry(sh);
            for (let k = 0; k < 3; k++) { const m = new THREE.Mesh(ag, mats.boost); m.rotation.x = -Math.PI / 2; m.position.set(0, 0.04, 4 + k * 6); g.add(m); }
          }
          if (p.t === 'C') gate(g, LEN / 2, mats.cp);
          if (p.t === 'F') gate(g, LEN / 2, mats.fin, mats.finW);
          if (idx === 0) gate(g, 3, mats.start);
          group.add(g);
        });
        scene.add(group);
        track = { code: clean(code), L, pieces: L.pieces, group, cps: L.pieces.filter((p) => p.t === 'C').length, bounds: { minX, maxX, minZ, maxZ } };
        return track;
      }

      /* scenery (built once per instance, around the first track) */
      let scenery = null;
      function buildScenery() {
        if (scenery) { scene.remove(scenery); scenery.traverse((o) => o.geometry && o.geometry.dispose()); }
        scenery = new THREE.Group();
        const rr = G.rng(G.hash(track.code) || 7), b = track.bounds;
        const coneG = new THREE.ConeGeometry(2.6, 6, 6), trunkG = new THREE.CylinderGeometry(0.5, 0.6, 2, 5), rockG = new THREE.DodecahedronGeometry(1.6, 0);
        const near = (x, z) => track.pieces.some((p) => Math.hypot(p.x - x, p.z - z) < 34);
        for (let k = 0; k < 260; k++) {
          const x = b.minX - 120 + rr() * (b.maxX - b.minX + 240), z = b.minZ - 120 + rr() * (b.maxZ - b.minZ + 240);
          if (near(x, z)) continue;
          if (rr() < 0.75) {
            const t = new THREE.Group(), s = 0.7 + rr() * 0.9;
            const tr = new THREE.Mesh(trunkG, mats.trunk); tr.position.y = 1;
            const c = new THREE.Mesh(coneG, rr() < 0.5 ? mats.tree : mats.tree2); c.position.y = 4.5; c.castShadow = true;
            t.add(tr, c); t.scale.setScalar(s); t.position.set(x, GROUND, z); scenery.add(t);
          } else {
            const r = new THREE.Mesh(rockG, mats.rock); r.position.set(x, GROUND + 0.6, z); r.rotation.set(rr() * 3, rr() * 3, 0); r.scale.setScalar(0.6 + rr() * 1.4); r.castShadow = true; scenery.add(r);
          }
        }
        scene.add(scenery);
      }

      /* ---- car ---- */
      function makeCar(color, ghost) {
        const extra = ghost ? { transparent: true, opacity: 0.35, depthWrite: false } : {};
        const body = M(color, extra), dark = M(0x23262e, extra), glass = M(0x9fe3ff, extra);
        const g = new THREE.Group(), inner = new THREE.Group(); g.add(inner);
        const parts = [
          [2.1, 0.55, 4.2, body, 0, 0.75, 0], [1.7, 0.55, 1.9, glass, 0, 1.3, -0.35], [1.75, 0.12, 1.95, body, 0, 1.62, -0.35],
          [2.2, 0.15, 0.7, body, 0, 1.45, -1.95], [0.15, 0.5, 0.2, dark, 0.7, 1.15, -1.95], [0.15, 0.5, 0.2, dark, -0.7, 1.15, -1.95],
          [2.1, 0.3, 0.3, dark, 0, 0.6, 2.1],
        ];
        parts.forEach(([w, h, d, m, x, y, z]) => { const mesh = new THREE.Mesh(new THREE.BoxGeometry(w, h, d), m); mesh.position.set(x, y, z); mesh.castShadow = !ghost; inner.add(mesh); });
        const wg = new THREE.CylinderGeometry(0.48, 0.48, 0.45, 8), wheels = [];
        [[1.1, 1.35], [-1.1, 1.35], [1.1, -1.35], [-1.1, -1.35]].forEach(([x, z]) => {
          const w = new THREE.Group(); w.position.set(x, 0.48, z);
          const m = new THREE.Mesh(wg, dark); m.rotation.z = Math.PI / 2; m.castShadow = !ghost; w.add(m); inner.add(w); wheels.push(w);
        });
        g.userData = { inner, wheels };
        return g;
      }
      const carMesh = makeCar(0xff3355, false), ghostMesh = makeCar(0x55ccff, true);
      scene.add(carMesh, ghostMesh);
      const cursor = new THREE.Mesh(new THREE.ConeGeometry(3, 6, 4), new THREE.MeshBasicMaterial({ color: 0xffd23f, transparent: true, opacity: 0.8 }));
      cursor.rotation.x = Math.PI / 2; const cursorG = new THREE.Group(); cursorG.add(cursor); scene.add(cursorG);

      /* ---- UI ---- */
      const ui = document.createElement('div'); ui.className = 'tr-ui'; stage.appendChild(ui);
      ui.innerHTML = `
        <div class="tr-top"><div class="tr-time">0:00.000</div><div class="tr-sub"></div></div>
        <div class="tr-btns"><button data-a="cp" title="Respawn at checkpoint (Enter)">⟲</button><button data-a="restart" title="Restart (R)">↻</button><button data-a="mute" title="Mute (M)">🔊</button></div>
        <div class="tr-speed"><b>0</b> km/h</div>
        <div class="tr-msg"></div>
        <div class="tr-res hidden"></div>
        <div class="tr-ed hidden">
          <div class="tr-ed-top"><span class="tr-ed-title">🛠️ Track Builder</span><span class="tr-ed-info"></span>
            <button data-a="undo">⌫ Undo</button><button data-a="clear">Clear</button><button data-a="copy">Copy code</button><button data-a="paste">Load code</button><button data-a="test" class="tr-go">▶ Test drive</button></div>
          <div class="tr-ed-pieces">${Object.entries(PIECES).map(([k, v]) => `<button data-p="${k}"><span>${v.icon}</span>${v.name}</button>`).join('')}</div>
        </div>`;
      const $ = (s) => ui.querySelector(s);
      const timeEl = $('.tr-time'), subEl = $('.tr-sub'), spdEl = $('.tr-speed b'), msgEl = $('.tr-msg'), resEl = $('.tr-res'), edEl = $('.tr-ed');

      /* ---- audio ---- */
      let ac = null, eng = null, muted = G.store.get('trials:mute', false);
      $('[data-a="mute"]').textContent = muted ? '🔇' : '🔊';
      function audio() {
        if (ac || muted) return;
        try {
          ac = new (window.AudioContext || window.webkitAudioContext)();
          const o = ac.createOscillator(), f = ac.createBiquadFilter(), g = ac.createGain();
          o.type = 'sawtooth'; f.type = 'lowpass'; f.frequency.value = 700; g.gain.value = 0.03;
          o.connect(f); f.connect(g); g.connect(ac.destination); o.start();
          eng = { o, g };
        } catch (e) { ac = null; }
      }
      function blip(freq, len, vol) {
        if (!ac || muted) return;
        const o = ac.createOscillator(), g = ac.createGain();
        o.type = 'triangle'; o.frequency.value = freq; g.gain.setValueAtTime(vol || 0.12, ac.currentTime); g.gain.exponentialRampToValueAtTime(0.001, ac.currentTime + (len || 0.25));
        o.connect(g); g.connect(ac.destination); o.start(); o.stop(ac.currentTime + (len || 0.25));
      }

      /* ---- state ---- */
      const isEditor = !!a.p.editor;
      const trackIdx = a.p.track || 0;
      let mode = isEditor ? 'edit' : 'drive';
      let edCode = isEditor ? G.store.get('trials:custom', 'SSRSSUSKGSLSCSSRSDSS') : '';
      const car = { x: 0, y: 0, z: 0, h: 0, vx: 0, vz: 0, vy: 0, ground: true, surf: null, pitch: 0, wheel: 0 };
      let started = false, finished = false, time = 0, cpDone = new Set(), respawn = null, rec = [], recT = 0, ghost = null, best = null, camH = 0, flash = 0;
      let edYaw = 0.8, edZoom = 1;

      const keyOf = () => 'trials:' + G.hash(track.code);
      function surfaceAt(X, Z, maxY) {
        let bestS = null;
        for (const p of track.pieces) {
          if (Math.abs(X - p.x) > 46 || Math.abs(Z - p.z) > 46) continue;
          const r = heightAt(p, X, Z);
          if (r && r.y <= maxY && (!bestS || r.y > bestS.y)) bestS = { y: r.y, u: r.u, p };
        }
        if (!bestS && GROUND <= maxY) bestS = { y: GROUND, u: 0, p: null };
        return bestS;
      }
      function wallAt(X, Z, y) {
        for (const p of track.pieces) {
          if (Math.abs(X - p.x) > 46 || Math.abs(Z - p.z) > 46) continue;
          const r = heightAt(p, X, Z);
          if (r && r.y > y + 0.8 && r.y - SLAB < y + 1.4) return true;
        }
        return false;
      }
      function place(pose) {
        Object.assign(car, { x: pose.x, y: pose.y, z: pose.z, h: pose.h, vx: 0, vz: 0, vy: 0, ground: true, surf: null });
        camH = pose.h;
      }
      function reset() {
        started = false; finished = false; time = 0; cpDone = new Set(); rec = []; recT = 0;
        respawn = poseAt(track.pieces[0], 6);
        place(respawn);
        best = G.store.get(keyOf() + ':best', null);
        ghost = G.store.get(keyOf() + ':ghost', null);
        ghostMesh.visible = false;
        resEl.classList.add('hidden');
        timeEl.textContent = fmt(0);
        msgEl.textContent = 'Press ↑ to start';
        updateSub();
        const cam = { x: car.x - Math.sin(car.h) * 10, z: car.z - Math.cos(car.h) * 10 };
        camera.position.set(cam.x, car.y + 4.5, cam.z);
      }
      function updateSub() {
        subEl.textContent = (track.cps ? 'Checkpoints ' + cpDone.size + '/' + track.cps + ' · ' : '') + (best ? 'Best ' + fmt(best) : 'No best yet');
      }
      function setMode(m) {
        mode = m;
        edEl.classList.toggle('hidden', m !== 'edit');
        ['.tr-top', '.tr-btns', '.tr-speed', '.tr-msg'].forEach((s) => $(s).classList.toggle('hidden', m === 'edit'));
        cursorG.visible = m === 'edit';
        if (m === 'edit') { resEl.classList.add('hidden'); buildTrack(edCode); if (scenery) scenery.visible = false; scene.fog.far = 3000; carMesh.visible = ghostMesh.visible = false; edInfo(); }
        else { buildTrack(isEditor ? edCode : TRACKS[trackIdx].code); buildScenery(); scene.fog.far = 520; carMesh.visible = true; reset(); }
      }
      function edInfo() {
        $('.tr-ed-info').textContent = edCode.length + ' pieces · code: ' + (edCode.length > 24 ? edCode.slice(0, 24) + '…' : edCode || '(empty)');
        const e = track.L.end;
        cursorG.position.set(e.x, e.y + 4, e.z); cursorG.rotation.y = e.h;
      }
      function edSet(code) { edCode = clean(code); G.store.set('trials:custom', edCode); buildTrack(edCode); edInfo(); }

      function finish() {
        finished = true;
        blip(660, 0.15); setTimeout(() => blip(990, 0.4), 140);
        const nb = !best || time < best;
        if (nb) { best = time; G.store.set(keyOf() + ':best', time); G.store.set(keyOf() + ':ghost', rec); }
        const next = !isEditor && trackIdx < TRACKS.length - 1 ? TRACKS[trackIdx + 1] : null;
        resEl.innerHTML = `<h3>${nb ? '🏆 New record!' : 'Finished'}</h3><div class="tr-big">${fmt(time)}</div><p>Best ${fmt(best)}</p>
          <div class="tr-row"><button data-a="restart" class="tr-go">↻ Retry (R)</button>${next ? `<button data-a="next">Next: ${next.name} →</button>` : ''}${isEditor ? '<button data-a="edit">✎ Edit track</button>' : ''}</div>`;
        resEl.classList.remove('hidden');
        a.score(Math.max(0, Math.round(100000 / Math.max(1, time))));
        updateSub();
      }

      ui.addEventListener('click', (e) => {
        const b = e.target.closest('button'); if (!b) return;
        const act = b.dataset.a, pc = b.dataset.p;
        if (pc) return edSet(edCode + pc);
        if (act === 'cp') doRespawn();
        else if (act === 'restart') reset();
        else if (act === 'mute') toggleMute();
        else if (act === 'next') location.hash = 'play/trials3d-' + TRACKS[trackIdx + 1].key;
        else if (act === 'edit') setMode('edit');
        else if (act === 'test') { if (edCode.length) setMode('drive'); }
        else if (act === 'undo') edSet(edCode.slice(0, -1));
        else if (act === 'clear') { if (confirm('Clear the whole track?')) edSet(''); }
        else if (act === 'copy') { try { navigator.clipboard.writeText(edCode); b.textContent = 'Copied!'; setTimeout(() => (b.textContent = 'Copy code'), 1200); } catch (err) { prompt('Track code:', edCode); } }
        else if (act === 'paste') { const c = prompt('Paste a track code (letters S L R U D K G B C):', ''); if (c) edSet(c); }
        a.canvas.focus();
      });
      function toggleMute() {
        muted = !muted; G.store.set('trials:mute', muted);
        $('[data-a="mute"]').textContent = muted ? '🔇' : '🔊';
        if (muted && ac) { ac.close(); ac = null; eng = null; }
      }
      function doRespawn() {
        if (!started || finished) return;
        place(respawn);
      }

      setMode(mode);
      G.trials.dbg = { car, get track() { return track; }, get time() { return time; }, get finished() { return finished; }, get cps() { return cpDone.size; } };

      /* ---- loop ---- */
      return {
        update(dt) {
          if (a.hit('KeyM')) toggleMute();
          if (mode === 'edit') {
            if (a.down('ArrowLeft')) edYaw -= dt * 1.5;
            if (a.down('ArrowRight')) edYaw += dt * 1.5;
            if (a.down('ArrowUp')) edZoom = Math.max(0.3, edZoom - dt);
            if (a.down('ArrowDown')) edZoom = Math.min(3, edZoom + dt);
            if (a.hit('Backspace')) edSet(edCode.slice(0, -1));
            const b = track.bounds, cx = (b.minX + b.maxX) / 2, cz = (b.minZ + b.maxZ) / 2;
            const size = Math.max(60, (b.maxX - b.minX) * 0.75, (b.maxZ - b.minZ) * 0.75) * edZoom;
            camera.position.set(cx + Math.sin(edYaw) * size, size * 0.9, cz + Math.cos(edYaw) * size);
            camera.lookAt(cx, 0, cz);
            sun.position.set(cx + 60, 140, cz + 40); sun.target.position.set(cx, 0, cz);
            Object.assign(sun.shadow.camera, { left: -size, right: size, top: size, bottom: -size, far: 600 }); sun.shadow.camera.updateProjectionMatrix();
            cursor.rotation.z += dt * 2;
            return;
          }
          if (a.hit('KeyR')) return reset();
          if (a.hit('Enter')) doRespawn();
          if (a.hit('KeyE') && isEditor) return setMode('edit');
          const thr = a.down('ArrowUp'), brk = a.down('ArrowDown'), hb = a.down('Space');
          const st = (a.down('ArrowLeft') ? 1 : 0) - (a.down('ArrowRight') ? 1 : 0);
          if (!started && !finished && (thr || brk)) { started = true; msgEl.textContent = ''; audio(); if (ghost && ghost.length) ghostMesh.visible = true; }
          const live = started && !finished;
          if (live) time += dt;

          const sh = Math.sin(car.h), ch = Math.cos(car.h);
          let fwd = car.vx * sh + car.vz * ch;
          const off = car.ground && car.surf && !car.surf.p;
          if (car.ground) {
            const max = off ? 12 : MAX;
            if (live && thr && fwd < max) { car.vx += sh * ACC * dt; car.vz += ch * ACC * dt; }
            if (live && brk) {
              if (fwd > 1) { car.vx -= sh * BRAKE * dt; car.vz -= ch * BRAKE * dt; }
              else if (fwd > -12) { car.vx -= sh * ACC * 0.6 * dt; car.vz -= ch * ACC * 0.6 * dt; }
            }
            if (car.surf && car.surf.p && car.surf.p.t === 'B' && fwd < BOOST) {
              const k = Math.min(BOOST - fwd, 120 * dt); car.vx += sh * k; car.vz += ch * k;
              if (!car.boostSnd) { blip(330, 0.3, 0.08); car.boostSnd = true; }
            } else car.boostSnd = false;
            fwd = car.vx * sh + car.vz * ch;
            const lx = car.vx - sh * fwd, lz = car.vz - ch * fwd;
            const grip = hb ? 1.6 : off ? 4 : 9, k = Math.min(1, grip * dt);
            car.vx -= lx * k; car.vz -= lz * k;
            const drag = (thr ? 0.04 : 0.3) + (off ? 1.4 : 0) + (fwd > MAX + 0.5 ? 0.45 : 0) + (finished ? 1.5 : 0);
            car.vx *= Math.max(0, 1 - drag * dt); car.vz *= Math.max(0, 1 - drag * dt);
            const sp = Math.hypot(car.vx, car.vz);
            let turn = st * (2.4 - 0.9 * Math.min(1, sp / MAX)) * Math.min(1, Math.abs(fwd) / 6) * (fwd < -0.5 ? -1 : 1);
            if (hb) turn *= 1.4;
            if (live || finished) car.h += turn * dt;
          } else if (live) car.h += st * 1.2 * dt;

          // horizontal move with wall bounce
          const nx = car.x + car.vx * dt, nz = car.z + car.vz * dt;
          if (wallAt(nx, nz, car.y)) { car.vx *= -0.3; car.vz *= -0.3; }
          else { car.x = nx; car.z = nz; }
          // vertical
          if (car.ground) {
            const s = surfaceAt(car.x, car.z, car.y + 0.8);
            if (s && s.y >= car.y - 0.8) { car.vy = G.clamp((s.y - car.y) / Math.max(dt, 1e-3), -30, 14); car.y = s.y; car.surf = s; }
            else car.ground = false;
          }
          if (!car.ground) {
            car.vy -= GRAV * dt; car.y += car.vy * dt;
            const s = surfaceAt(car.x, car.z, car.y + 0.8 + Math.max(0, -car.vy * dt));
            if (s && car.y <= s.y && car.vy <= 0) {
              car.y = s.y; car.ground = true; car.vy = 0; car.surf = s;
            }
          }
          // checkpoints & finish
          const sp2 = car.ground && car.surf && car.surf.p;
          if (live && sp2) {
            if (sp2.t === 'C' && car.surf.u >= LEN / 2 && !cpDone.has(sp2.i)) {
              cpDone.add(sp2.i); respawn = poseAt(sp2, LEN / 2); blip(880, 0.2); flash = 1;
              msgEl.textContent = 'Checkpoint ' + fmt(time); setTimeout(() => { if (msgEl.textContent.startsWith('Checkpoint')) msgEl.textContent = ''; }, 1400);
              updateSub();
            }
            if (sp2.t === 'F' && car.surf.u >= LEN / 2) {
              if (cpDone.size >= track.cps) finish();
              else if (!msgEl.textContent) msgEl.textContent = 'Missed a checkpoint! Press Enter';
            }
          }
          // ghost record / playback
          if (live) {
            recT += dt;
            if (recT >= 1 / 30) { recT = 0; rec.push([+time.toFixed(3), +car.x.toFixed(2), +car.y.toFixed(2), +car.z.toFixed(2), +car.h.toFixed(3)]); }
          }
          if (ghost && ghost.length && started) {
            let i = 0; while (i < ghost.length - 1 && ghost[i + 1][0] < time) i++;
            const g0 = ghost[i], g1 = ghost[Math.min(i + 1, ghost.length - 1)], f = g1[0] > g0[0] ? G.clamp((time - g0[0]) / (g1[0] - g0[0]), 0, 1) : 0;
            ghostMesh.position.set(g0[1] + (g1[1] - g0[1]) * f, g0[2] + (g1[2] - g0[2]) * f, g0[3] + (g1[3] - g0[3]) * f);
            ghostMesh.rotation.y = g0[4] + (g1[4] - g0[4]) * f;
          }
          // visuals
          const sp = Math.hypot(car.vx, car.vz);
          let pitch = 0;
          if (car.ground) {
            const f1 = surfaceAt(car.x + sh * 1.6, car.z + ch * 1.6, car.y + 1.2), b1 = surfaceAt(car.x - sh * 1.6, car.z - ch * 1.6, car.y + 1.2);
            if (f1 && b1) pitch = Math.atan2(f1.y - b1.y, 3.2);
          } else pitch = G.clamp(car.vy * 0.02, -0.5, 0.4);
          car.pitch += (pitch - car.pitch) * Math.min(1, dt * 12);
          carMesh.position.set(car.x, car.y, car.z); carMesh.rotation.y = car.h;
          carMesh.userData.inner.rotation.x = -car.pitch;
          car.wheel += fwd * dt / 0.48;
          carMesh.userData.wheels.forEach((w, i) => { w.children[0].rotation.x = car.wheel; if (i < 2) w.rotation.y = st * 0.4; });
          spdEl.textContent = Math.round(sp * 3.6);
          if (live) timeEl.textContent = fmt(time);
          timeEl.classList.toggle('boost', fwd > MAX + 1);
          // camera
          const velH = sp > 4 ? Math.atan2(car.vx, car.vz) : car.h;
          let dh = velH - camH; while (dh > Math.PI) dh -= 2 * Math.PI; while (dh < -Math.PI) dh += 2 * Math.PI;
          camH += dh * Math.min(1, dt * 4);
          const tx = car.x - Math.sin(camH) * 10, tz = car.z - Math.cos(camH) * 10, ty = car.y + 4.2;
          const kk = Math.min(1, dt * 7);
          camera.position.x += (tx - camera.position.x) * kk; camera.position.z += (tz - camera.position.z) * kk; camera.position.y += (ty - camera.position.y) * kk;
          camera.lookAt(car.x + Math.sin(camH) * 5, car.y + 1.3, car.z + Math.cos(camH) * 5);
          const fov = 68 + Math.min(18, sp * 0.3);
          if (Math.abs(camera.fov - fov) > 0.1) { camera.fov += (fov - camera.fov) * Math.min(1, dt * 3); camera.updateProjectionMatrix(); }
          sun.position.set(car.x + 40, car.y + 90, car.z + 30); sun.target.position.set(car.x, car.y, car.z);
          if (eng && ac) { eng.o.frequency.setTargetAtTime(45 + Math.abs(fwd) * 3.2 + (thr ? 18 : 0), ac.currentTime, 0.05); eng.g.gain.setTargetAtTime(finished ? 0 : 0.03, ac.currentTime, 0.1); }
          flash = Math.max(0, flash - dt * 2);
        },
        draw() { renderer.render(scene, camera); },
        destroy() {
          if (ac) { try { ac.close(); } catch (e) {} }
          ui.remove();
          scene.traverse((o) => { if (o.geometry) o.geometry.dispose(); });
          Object.values(mats).forEach((m) => m.dispose());
        },
      };
    },
  });
})();
