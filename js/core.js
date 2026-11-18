/* Game runtime: engine registry, input, loop, HUD, game-over flow. */
(function () {
  const G = (window.G = { engines: {} });

  G.register = (id, def) => (G.engines[id] = Object.assign({ id, W: 800, H: 600 }, def));

  G.rng = function (seed) {
    let a = seed >>> 0;
    return function () {
      a = (a + 0x6d2b79f5) | 0;
      let t = Math.imul(a ^ (a >>> 15), 1 | a);
      t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
      return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
    };
  };
  G.hash = (s) => {
    let h = 2166136261;
    for (let i = 0; i < s.length; i++) h = Math.imul(h ^ s.charCodeAt(i), 16777619);
    return h >>> 0;
  };
  G.clamp = (v, a, b) => (v < a ? a : v > b ? b : v);

  const store = {
    get(k, d) { try { const v = localStorage.getItem(k); return v == null ? d : JSON.parse(v); } catch (e) { return d; } },
    set(k, v) { try { localStorage.setItem(k, JSON.stringify(v)); } catch (e) {} },
  };
  G.store = store;

  let threePromise = null;
  G.loadThree = () => {
    if (window.THREE) return Promise.resolve();
    if (!threePromise)
      threePromise = new Promise((res, rej) => {
        const s = document.createElement('script');
        s.src = 'js/vendor/three.min.js';
        s.onload = res;
        s.onerror = () => { threePromise = null; rej(new Error('Could not load the 3D engine. Check your connection.')); };
        document.head.appendChild(s);
      });
    return threePromise;
  };

  const BLOCK = new Set(['ArrowUp', 'ArrowDown', 'ArrowLeft', 'ArrowRight', 'Space']);
  const ALIAS = { KeyW: 'ArrowUp', KeyS: 'ArrowDown', KeyA: 'ArrowLeft', KeyD: 'ArrowRight' };

  function el(tag, cls, html) {
    const e = document.createElement(tag);
    if (cls) e.className = cls;
    if (html != null) e.innerHTML = html;
    return e;
  }

  /* Start a catalog game inside root. Returns { stop, restart }. */
  G.run = async function (root, game) {
    const eng = G.engines[game.engine];
    const W = eng.W, H = eng.H;
    root.innerHTML = '';
    const stage = el('div', 'stage');
    root.appendChild(stage);
    const loading = el('div', 'stage-msg', 'Loading…');
    stage.appendChild(loading);

    let renderer = null, canvas, ctx = null;
    if (eng.three) {
      try { await G.loadThree(); } catch (e) { loading.textContent = e.message; return { stop() {}, restart() {} }; }
      renderer = new THREE.WebGLRenderer({ antialias: true });
      renderer.setPixelRatio(Math.min(2, window.devicePixelRatio || 1));
      canvas = renderer.domElement;
    } else {
      canvas = document.createElement('canvas');
      const dpr = Math.min(2, window.devicePixelRatio || 1);
      canvas.width = W * dpr; canvas.height = H * dpr;
      ctx = canvas.getContext('2d');
      ctx.scale(dpr, dpr);
    }
    loading.remove();
    canvas.className = 'game-canvas';
    canvas.tabIndex = 0;
    stage.appendChild(canvas);

    const hudL = el('div', 'hud hud-l'), hudR = el('div', 'hud hud-r');
    stage.appendChild(hudL); stage.appendChild(hudR);
    if (eng.noHud) hudL.style.display = hudR.style.display = 'none';
    const overlay = el('div', 'go hidden');
    stage.appendChild(overlay);

    function fit() {
      const r = root.getBoundingClientRect();
      const s = Math.max(0.1, Math.min(r.width / W, r.height / H));
      const w = Math.floor(W * s), h = Math.floor(H * s);
      if (renderer) renderer.setSize(w, h);
      canvas.style.width = w + 'px'; canvas.style.height = h + 'px';
      stage.style.width = w + 'px'; stage.style.height = h + 'px';
    }
    fit();
    const ro = new ResizeObserver(fit);
    ro.observe(root);

    const keys = new Set(), pressed = new Set();
    const ptr = { x: W / 2, y: H / 2, down: false, clicked: false, right: false, moved: false };
    const kd = (e) => {
      const c = ALIAS[e.code] || e.code;
      if (BLOCK.has(c)) e.preventDefault();
      if (e.code === 'KeyP' || e.code === 'Escape') { if (!isOver) paused = !paused; showPause(); return; }
      if (!keys.has(c)) pressed.add(c);
      keys.add(c);
      if (isOver && (c === 'Enter' || c === 'KeyR')) restart();
    };
    const ku = (e) => keys.delete(ALIAS[e.code] || e.code);
    const toLocal = (e) => {
      const r = canvas.getBoundingClientRect();
      ptr.x = ((e.clientX - r.left) / r.width) * W;
      ptr.y = ((e.clientY - r.top) / r.height) * H;
    };
    const pd = (e) => { toLocal(e); ptr.down = true; ptr.clicked = true; ptr.right = e.button === 2; canvas.focus(); };
    const pm = (e) => { toLocal(e); if (e.pointerType === 'mouse') ptr.moved = true; };
    const pu = () => (ptr.down = false);
    const cm = (e) => e.preventDefault();
    window.addEventListener('keydown', kd);
    window.addEventListener('keyup', ku);
    canvas.addEventListener('pointerdown', pd);
    canvas.addEventListener('pointermove', pm);
    window.addEventListener('pointerup', pu);
    canvas.addEventListener('contextmenu', cm);
    const blur = () => keys.clear();
    window.addEventListener('blur', blur);

    // touch pad
    if (window.matchMedia && matchMedia('(pointer: coarse)').matches && !eng.noPad) {
      const pad = el('div', 'pad');
      const btn = (code, label, cls) => {
        const b = el('button', 'pad-b ' + cls, label);
        const on = (e) => { e.preventDefault(); if (!keys.has(code)) pressed.add(code); keys.add(code); };
        const off = (e) => { e.preventDefault(); keys.delete(code); };
        b.addEventListener('pointerdown', on);
        b.addEventListener('pointerup', off);
        b.addEventListener('pointerleave', off);
        b.addEventListener('pointercancel', off);
        return b;
      };
      pad.appendChild(btn('ArrowUp', '▲', 'u'));
      pad.appendChild(btn('ArrowLeft', '◀', 'l'));
      pad.appendChild(btn('ArrowRight', '▶', 'r'));
      pad.appendChild(btn('ArrowDown', '▼', 'd'));
      pad.appendChild(btn('Space', '●', 'a'));
      root.appendChild(pad);
    }

    const bestKey = 'best:' + game.id;
    let best = store.get(bestKey, 0);
    let score = 0, isOver = false, paused = false, inst = null, raf = 0, last = 0, extra = '';

    function renderHud() {
      hudL.textContent = 'Score ' + Math.floor(score) + (extra ? '  ·  ' + extra : '');
      hudR.textContent = 'Best ' + Math.floor(Math.max(best, score));
    }
    function showPause() {
      if (isOver) return;
      if (paused) { overlay.className = 'go'; overlay.innerHTML = '<h3>Paused</h3><p>Press P or Esc to resume</p>'; }
      else overlay.className = 'go hidden';
    }

    const api = {
      W, H, ctx, keys, pressed, ptr, renderer, canvas,
      p: game.params, T: game.theme, D: game.diff, rnd: G.rng(game.seed),
      down: (...c) => c.some((k) => keys.has(k)),
      hit: (...c) => c.some((k) => pressed.has(k)),
      score: (n) => { score = n; renderHud(); },
      add: (n) => { score += n; renderHud(); },
      get value() { return score; },
      hud: (s) => { extra = s; renderHud(); },
      over: (msg) => {
        if (isOver) return;
        isOver = true;
        const nb = score > best;
        if (nb) { best = Math.floor(score); store.set(bestKey, best); }
        overlay.className = 'go';
        overlay.innerHTML =
          '<h3>' + (msg || 'Game over') + '</h3><p class="big">' + Math.floor(score) + '</p><p>' +
          (nb ? 'New best!' : 'Best ' + best) + '</p><button class="btn primary" data-r>Play again</button><p class="hint">Enter or R to restart</p>';
        overlay.querySelector('[data-r]').onclick = restart;
        renderHud();
      },
    };

    function start() {
      if (inst && inst.destroy) inst.destroy();
      score = 0; extra = ''; isOver = false; paused = false;
      overlay.className = 'go hidden';
      api.rnd = G.rng(game.seed);
      keys.clear(); pressed.clear();
      inst = eng.create(api);
      renderHud();
    }
    function restart() { start(); canvas.focus(); }

    function frame(t) {
      raf = requestAnimationFrame(frame);
      const dt = Math.min(0.05, (t - (last || t)) / 1000);
      last = t;
      if (!paused && !isOver) {
        try { inst.update(dt); } catch (e) { console.error(e); api.over('Oops — error'); }
      }
      try { inst.draw(); } catch (e) { console.error(e); }
      pressed.clear();
      ptr.clicked = false;
    }

    start();
    raf = requestAnimationFrame(frame);
    canvas.focus();

    return {
      restart,
      stop() {
        cancelAnimationFrame(raf);
        ro.disconnect();
        window.removeEventListener('keydown', kd);
        window.removeEventListener('keyup', ku);
        window.removeEventListener('pointerup', pu);
        window.removeEventListener('blur', blur);
        if (inst && inst.destroy) inst.destroy();
        if (renderer) { renderer.dispose(); if (renderer.forceContextLoss) renderer.forceContextLoss(); }
        root.innerHTML = '';
      },
    };
  };

  /* 2D drawing helpers shared by engines. */
  G.draw = {
    rect(c, x, y, w, h, col) { c.fillStyle = col; c.fillRect(x, y, w, h); },
    rr(c, x, y, w, h, r, col) {
      c.fillStyle = col; c.beginPath();
      if (c.roundRect) c.roundRect(x, y, w, h, r); else c.rect(x, y, w, h);
      c.fill();
    },
    circle(c, x, y, r, col) { c.fillStyle = col; c.beginPath(); c.arc(x, y, r, 0, Math.PI * 2); c.fill(); },
    text(c, s, x, y, col, size, align) {
      c.fillStyle = col; c.font = '600 ' + (size || 20) + 'px system-ui, sans-serif';
      c.textAlign = align || 'center'; c.textBaseline = 'middle'; c.fillText(s, x, y);
    },
    bg(a) { a.ctx.fillStyle = a.T.bg; a.ctx.fillRect(0, 0, a.W, a.H); },
  };
})();
