/* Site UI: catalog grid, search/filters, favourites, recents, player view. */
(function () {
  const $ = (s) => document.querySelector(s);
  const games = G.catalog;
  const byId = Object.fromEntries(games.map((g) => [g.id, g]));
  const S = G.store;
  let favs = new Set(S.get('favs', []));
  let recent = S.get('recent', []);
  let cat = 'All', running = null, current = null;

  $('#count').textContent = games.length;
  G.themes.forEach((t) => $('#theme').insertAdjacentHTML('beforeend', `<option value="${t.id}">${t.name}</option>`));

  const cats = ['All', '3D', ...Array.from(new Set(games.map((g) => g.cat))).sort(), '★ Favourites', 'Recent'];
  $('#chips').innerHTML = cats.map((c) => `<button class="chip${c === cat ? ' on' : ''}" data-c="${c}">${c}</button>`).join('');
  $('#chips').addEventListener('click', (e) => {
    const b = e.target.closest('[data-c]'); if (!b) return;
    cat = b.dataset.c;
    document.querySelectorAll('.chip').forEach((x) => x.classList.toggle('on', x === b));
    render();
  });

  const hex = (n) => '#' + n.toString(16).padStart(6, '0');
  const esc = (s) => String(s).replace(/[&<>"]/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]));
  function card(g) {
    const t = g.theme, best = S.get('best:' + g.id, 0);
    return `<button class="card" data-id="${g.id}" style="--a:${t.a1};--b:${t.a2};--bg:${t.bg}">
      <div class="thumb"><span class="ic">${g.icon}</span>${g.is3d ? '<span class="tag3d">3D</span>' : ''}${favs.has(g.id) ? '<span class="fv">★</span>' : ''}</div>
      <div class="meta"><strong>${esc(g.title)}</strong><span>${g.cat} · <i class="d${g.diff}">${g.diffName}</i>${best ? ' · 🏅 ' + best : ''}</span></div>
    </button>`;
  }

  function list() {
    const q = $('#q').value.trim().toLowerCase(), d = $('#diff').value, th = $('#theme').value, sort = $('#sort').value;
    let out = games;
    if (cat === '3D') out = out.filter((g) => g.is3d);
    else if (cat === '★ Favourites') out = out.filter((g) => favs.has(g.id));
    else if (cat === 'Recent') out = recent.map((id) => byId[id]).filter(Boolean);
    else if (cat !== 'All') out = out.filter((g) => g.cat === cat);
    if (d) out = out.filter((g) => g.diff == d);
    if (th) out = out.filter((g) => g.theme.id === th);
    if (q) { const words = q.split(/\s+/); out = out.filter((g) => { const h = (g.title + ' ' + g.cat + ' ' + g.desc + ' ' + g.engine + (g.is3d ? ' 3d' : '')).toLowerCase(); return words.every((w) => h.includes(w)); }); }
    if (sort === 'az') out = out.slice().sort((a, b) => a.title.localeCompare(b.title));
    else if (sort === 'best') out = out.slice().sort((a, b) => S.get('best:' + b.id, 0) - S.get('best:' + a.id, 0));
    else if (cat !== 'Recent') out = out.slice().sort((a, b) => (b.featured | 0) - (a.featured | 0) || b.is3d - a.is3d);
    return out;
  }

  function render() {
    const out = list();
    $('#grid').innerHTML = out.map(card).join('');
    $('#results').textContent = out.length + ' game' + (out.length === 1 ? '' : 's');
    $('#empty').classList.toggle('hidden', out.length > 0);
  }
  ['#q', '#diff', '#theme', '#sort'].forEach((s) => $(s).addEventListener('input', render));

  // featured: one of each engine on the hero
  const featured = Object.keys(G.engines).map((e) => games.find((g) => g.engine === e && g.diff === 2 && g.theme.id === ['neon', 'jungle', 'sunset', 'ocean'][e.length % 4]) || games.find((g) => g.engine === e));
  const poly = games.filter((g) => g.featured);
  $('#featured').innerHTML = [poly[0], poly[2], poly[poly.length - 1]].concat(featured.filter((g) => g.is3d && !g.featured), featured.filter((g) => !g.is3d).slice(0, 1)).map(card).join('');

  document.addEventListener('click', (e) => {
    const c = e.target.closest('.card');
    if (c) location.hash = 'play/' + c.dataset.id;
  });
  $('[data-home]').addEventListener('click', (e) => { e.preventDefault(); location.hash = ''; });
  $('#back').onclick = () => (location.hash = '');
  $('#random').onclick = () => (location.hash = 'play/' + games[Math.floor(Math.random() * games.length)].id);
  $('#restart').onclick = () => running && running.restart();
  $('#full').onclick = () => { const p = $('#player'); document.fullscreenElement ? document.exitFullscreen() : p.requestFullscreen && p.requestFullscreen(); };
  $('#fav').onclick = () => {
    if (!current) return;
    favs.has(current.id) ? favs.delete(current.id) : favs.add(current.id);
    S.set('favs', [...favs]); $('#fav').textContent = favs.has(current.id) ? '★' : '☆';
  };

  async function route() {
    const m = location.hash.match(/^#play\/(.+)$/);
    if (running) { running.stop(); running = null; }
    const pad = document.querySelector('.pad'); if (pad) pad.remove();
    if (!m || !byId[m[1]]) {
      current = null;
      $('#player').classList.add('hidden'); $('#home').classList.remove('hidden');
      document.title = 'Game Stash Arcade';
      render();
      return;
    }
    const g = (current = byId[m[1]]);
    recent = [g.id, ...recent.filter((x) => x !== g.id)].slice(0, 30); S.set('recent', recent);
    $('#home').classList.add('hidden'); $('#player').classList.remove('hidden');
    $('#ptitle').textContent = g.title;
    $('#pmeta').textContent = g.cat + ' · ' + g.diffName + (g.is3d ? ' · 3D' : '');
    $('#pcontrols').textContent = g.desc + '  Controls: ' + g.controls + '.';
    $('#fav').textContent = favs.has(g.id) ? '★' : '☆';
    $('#player').style.setProperty('--bg', g.theme.bg);
    document.title = g.title + ' — Game Stash Arcade';
    window.scrollTo(0, 0);
    const token = (route.token = (route.token || 0) + 1);
    const r = await G.run($('#pwrap'), g);
    if (token !== route.token || current !== g) r.stop(); else running = r;
  }
  window.addEventListener('hashchange', route);
  route();
})();
