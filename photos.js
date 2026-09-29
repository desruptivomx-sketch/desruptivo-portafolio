/* Fotografía: panal de burbujas al estilo del Apple Watch. Las fotos se
   acomodan en espiral hexagonal; la del centro crece (efecto lupa) y queda
   "enfocada" en el visor, mostrando su exposición real. Se arrastra en
   cualquier dirección con mouse o dedo; toca para enfocar, otra vez para abrir. */
(() => {
  'use strict';
  const box = document.querySelector('#photo');
  const series = (window.DESRUPTIVO_PROJECTS || []).filter(p => p.category === 'photo');
  if (!box || !series.length) return;

  const stage = box.querySelector('#ph-stage');
  const layer = box.querySelector('#ph-bubbles');
  const filters = box.querySelector('#ph-filters');
  const hint = box.querySelector('#ph-hint');
  const $ = id => box.querySelector(id);
  const reduced = matchMedia('(prefers-reduced-motion: reduce)').matches;
  const pad2 = n => String(n).padStart(2, '0');
  const small = src => src.replace(/(\d+\.jpg)$/, 'sm/$1');

  const photos = [];
  series.forEach(s => s.media.forEach((m, i) => photos.push({s, m, i, n: photos.length})));
  $('#ph-total').textContent = `${photos.length} fotos · ${series.length} series`;

  /* Espiral hexagonal (coordenadas axiales) desde el centro */
  function spiral(count) {
    const out = [[0, 0]];
    const dirs = [[1, 0], [1, -1], [0, -1], [-1, 0], [-1, 1], [0, 1]];
    for (let k = 1; out.length < count; k++) {
      let q = -k, r = k; // arranca abajo a la izquierda
      for (let d = 0; d < 6; d++) for (let j = 0; j < k; j++) {
        if (out.length >= count) break;
        out.push([q, r]);
        q += dirs[d][0]; r += dirs[d][1];
      }
    }
    return out;
  }

  let items = [], D = 140, W = 0, H = 0, bounds = {x0: 0, x1: 0, y0: 0, y1: 0};
  const view = {x: 0, y: 0};
  let focused = null, raf = 0, anim = 0;

  function measure() {
    W = stage.clientWidth; H = stage.clientHeight;
    D = Math.round(Math.max(78, Math.min(150, Math.min(W, H) * 0.27)));
    stage.style.setProperty('--D', `${D}px`);
  }

  function build(list) {
    layer.replaceChildren();
    const pos = spiral(list.length);
    const gap = 1.08;
    items = list.map((p, k) => {
      const [q, r] = pos[k];
      const b = document.createElement('button');
      b.type = 'button';
      b.className = 'ph-bubble';
      b.setAttribute('aria-label', `${p.m.title}, ${p.s.name}`);
      b.setAttribute('aria-haspopup', 'dialog');
      const img = new Image();
      img.alt = ''; img.decoding = 'async'; img.draggable = false;
      img.src = small(p.m.src);
      img.addEventListener('load', () => img.classList.add('is-loaded'), {once: true});
      b.append(img);
      b.style.setProperty('--d', `${Math.min(k, 24) * 28}ms`);
      layer.append(b);
      const it = {p, el: b, wx: D * gap * (q + r / 2), wy: D * gap * (r * Math.sqrt(3) / 2)};
      b.addEventListener('click', () => { if (!moved) tap(it); });
      b.addEventListener('focus', () => { if (!pointerDown) center(it, true); });
      return it;
    });
    const xs = items.map(i => i.wx), ys = items.map(i => i.wy);
    bounds = {x0: Math.min(...xs), x1: Math.max(...xs), y0: Math.min(...ys), y1: Math.max(...ys)};
    view.x = 0; view.y = 0; focused = null;
    layout();
  }

  /* Efecto lupa: tamaño y opacidad según la distancia al centro */
  function layout() {
    const cx = W / 2, cy = H / 2, R = Math.max(W, H) * 0.5;
    let best = null, bestD = Infinity;
    items.forEach(it => {
      const x = cx + it.wx - view.x, y = cy + it.wy - view.y;
      const dx = x - cx, dy = y - cy, d = Math.hypot(dx, dy);
      const t = Math.min(1, d / R);
      let s = 1 - 0.68 * Math.pow(t, 1.35);
      s += 0.22 * Math.max(0, 1 - d / (D * 0.9));   // el del centro crece
      s = Math.max(0.26, s);
      const pull = 0.12 * t;                          // las orillas se juntan hacia dentro
      const px = x - dx * pull, py = y - dy * pull;
      it.el.style.transform = `translate3d(${(px - D / 2).toFixed(1)}px, ${(py - D / 2).toFixed(1)}px, 0) scale(${s.toFixed(3)})`;
      it.el.style.opacity = String(Math.max(0.18, Math.min(1, 1.25 - t)).toFixed(2));
      it.el.style.zIndex = String(Math.round(s * 100));
      if (d < bestD) { bestD = d; best = it; }
    });
    if (best !== focused) setFocus(best);
  }

  function setFocus(it) {
    if (focused) focused.el.classList.remove('is-focused');
    focused = it;
    if (!it) return;
    it.el.classList.add('is-focused');
    const {p} = it, m = p.m;
    $('#ph-num').textContent = pad2(p.n + 1);
    $('#ph-title').textContent = m.title;
    $('#ph-serie').textContent = p.s.name;
    $('#ph-read').textContent = m.f ? `${m.cam} · ${m.lens} · ${m.f} · ${m.s} · ISO ${m.iso} · ${m.mm}mm` : (m.note || 'Fotografía');
  }

  const clampView = v => ({
    x: Math.min(bounds.x1, Math.max(bounds.x0, v.x)),
    y: Math.min(bounds.y1, Math.max(bounds.y0, v.y))
  });
  function schedule() { cancelAnimationFrame(raf); raf = requestAnimationFrame(layout); }

  function animateTo(to, dur = 520) {
    cancelAnimationFrame(anim);
    to = clampView(to);
    if (reduced) { Object.assign(view, to); layout(); return; }
    const from = {...view}, t0 = performance.now();
    const ease = t => 1 - Math.pow(1 - t, 3);
    const step = now => {
      const t = Math.min(1, (now - t0) / dur), k = ease(t);
      view.x = from.x + (to.x - from.x) * k;
      view.y = from.y + (to.y - from.y) * k;
      layout();
      if (t < 1) anim = requestAnimationFrame(step);
    };
    anim = requestAnimationFrame(step);
  }
  const center = (it, smooth) => smooth ? animateTo({x: it.wx, y: it.wy}) : (Object.assign(view, {x: it.wx, y: it.wy}), layout());
  const open = it => window.DESRUPTIVO_OPEN?.(it.p.s.id, it.p.i, it.el);
  function tap(it) {
    dismissHint();
    const d = Math.hypot(it.wx - view.x, it.wy - view.y);
    if (it === focused && d < D * 0.35) open(it); else center(it, true);
  }
  $('#ph-open').addEventListener('click', e => { if (focused) window.DESRUPTIVO_OPEN?.(focused.p.s.id, focused.p.i, e.currentTarget); });

  /* Arrastre libre con inercia (mouse y dedo) */
  let start = null, moved = false, pointerDown = false, last = null, vel = {x: 0, y: 0};
  stage.addEventListener('pointerdown', e => {
    if (e.button !== 0) return;
    cancelAnimationFrame(anim);
    pointerDown = true; moved = false;
    start = {x: e.clientX, y: e.clientY, vx: view.x, vy: view.y, id: e.pointerId};
    last = {x: e.clientX, y: e.clientY, t: performance.now()}; vel = {x: 0, y: 0};
  });
  stage.addEventListener('pointermove', e => {
    if (!start || e.pointerId !== start.id) return;
    const dx = e.clientX - start.x, dy = e.clientY - start.y;
    if (!moved && Math.hypot(dx, dy) > 6) {
      moved = true;
      try { stage.setPointerCapture(start.id); } catch (_) {}
      stage.classList.add('is-grabbing');
      dismissHint();
    }
    if (!moved) return;
    const now = performance.now(), dt = Math.max(1, now - last.t);
    vel = {x: (e.clientX - last.x) / dt, y: (e.clientY - last.y) / dt};
    last = {x: e.clientX, y: e.clientY, t: now};
    /* Resistencia elástica al pasar el borde */
    const raw = {x: start.vx - dx, y: start.vy - dy}, c = clampView(raw);
    view.x = c.x + (raw.x - c.x) * 0.3;
    view.y = c.y + (raw.y - c.y) * 0.3;
    schedule();
  });
  function release(e) {
    if (!start || (e && e.pointerId !== start.id)) return;
    start = null; pointerDown = false;
    stage.classList.remove('is-grabbing');
    if (!moved) return;
    const recent = performance.now() - last.t < 80;
    let vx = recent ? -vel.x * 16 : 0, vy = recent ? -vel.y * 16 : 0;
    if (reduced || (!vx && !vy)) snap();
    else {
      const glide = () => {
        vx *= 0.92; vy *= 0.92;
        const c = clampView({x: view.x + vx, y: view.y + vy});
        if (c.x !== view.x + vx) vx *= 0.5;
        if (c.y !== view.y + vy) vy *= 0.5;
        view.x = c.x; view.y = c.y;
        layout();
        if (Math.abs(vx) + Math.abs(vy) > 0.5) anim = requestAnimationFrame(glide); else snap();
      };
      anim = requestAnimationFrame(glide);
    }
    setTimeout(() => { moved = false; }, 0);
  }
  /* Al soltar, la foto más cercana se acomoda en el visor */
  const snap = () => { if (focused) animateTo({x: focused.wx, y: focused.wy}, 380); };
  stage.addEventListener('pointerup', release);
  stage.addEventListener('pointercancel', release);
  stage.addEventListener('click', e => { if (moved) { e.preventDefault(); e.stopPropagation(); } }, true);

  /* Teclado: flechas mueven el enfoque al vecino en esa dirección */
  stage.addEventListener('keydown', e => {
    const dir = {ArrowRight: [1, 0], ArrowLeft: [-1, 0], ArrowDown: [0, 1], ArrowUp: [0, -1]}[e.key];
    if (e.key === 'Enter' && focused && e.target === stage) { e.preventDefault(); open(focused); return; }
    if (!dir || !focused) return;
    e.preventDefault();
    let best = null, bestScore = Infinity;
    items.forEach(it => {
      if (it === focused) return;
      const dx = it.wx - focused.wx, dy = it.wy - focused.wy;
      const along = dx * dir[0] + dy * dir[1];
      if (along <= 1) return;
      const score = along + Math.abs(dx * dir[1] - dy * dir[0]) * 2;
      if (score < bestScore) { bestScore = score; best = it; }
    });
    if (best) { center(best, true); best.el.focus({preventScroll: true}); }
  });
  function dismissHint() { hint.classList.add('is-gone'); }

  /* Filtros por serie */
  let active = 'all';
  const chip = (id, label, count) => {
    const b = document.createElement('button');
    b.type = 'button';
    b.className = 'ph-chip mono';
    b.innerHTML = '<span></span><b></b>';
    b.children[0].textContent = label;
    b.children[1].textContent = pad2(count);
    b.addEventListener('click', () => {
      if (active === id) return;
      active = id;
      chips.forEach(([cid, c]) => c.setAttribute('aria-pressed', String(cid === id)));
      stage.classList.add('is-swapping');
      setTimeout(() => {
        build(id === 'all' ? photos : photos.filter(p => p.s.id === id));
        requestAnimationFrame(() => stage.classList.remove('is-swapping'));
      }, reduced ? 0 : 220);
    });
    filters.append(b);
    return [id, b];
  };
  const chips = [chip('all', 'Todas', photos.length), ...series.map(s => chip(s.id, s.name, s.media.length))];
  chips[0][1].setAttribute('aria-pressed', 'true');
  chips.slice(1).forEach(([, c]) => c.setAttribute('aria-pressed', 'false'));

  /* Arranque: las burbujas florecen desde el centro al llegar a la sección */
  measure();
  build(photos);
  stage.tabIndex = 0;
  if ('IntersectionObserver' in window && !reduced) {
    const io = new IntersectionObserver(es => {
      if (es.some(x => x.isIntersecting)) { stage.classList.add('is-live'); io.disconnect(); }
    }, {threshold: 0.3});
    io.observe(stage);
  } else stage.classList.add('is-live');

  let lastD = D;
  new ResizeObserver(() => {
    measure();
    if (D !== lastD) { lastD = D; const f = focused && focused.p; build(items.map(i => i.p)); if (f) { const it = items.find(i => i.p === f); if (it) center(it, false); } }
    else layout();
  }).observe(stage);
})();
