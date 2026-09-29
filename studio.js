/* Mesa de trabajo de Diseño gráfico: todas las piezas como artboards en un
   lienzo que se recorre arrastrando, con reglas, zoom y capas por marca. */
(() => {
  'use strict';
  const studio = document.querySelector('#studio');
  const projects = (window.DESRUPTIVO_PROJECTS || []).filter(p => p.category === 'design');
  if (!studio || !projects.length) return;

  const canvas = studio.querySelector('#studio-canvas');
  const world = studio.querySelector('#studio-world');
  const sel = studio.querySelector('#studio-sel');
  const tag = sel.querySelector('.studio-tag');
  const layersList = studio.querySelector('#studio-layers');
  const zoomOut = studio.querySelector('#studio-zoom');
  const hint = studio.querySelector('#studio-hint');
  const rulerX = studio.querySelector('.studio-ruler-x');
  const rulerY = studio.querySelector('.studio-ruler-y');
  const reduced = matchMedia('(prefers-reduced-motion: reduce)').matches;
  const narrow = () => matchMedia('(max-width: 760px)').matches;

  const BASE = 260, GAP = 40, LABEL = 70, CLUSTER_GAP_X = 170, CLUSTER_GAP_Y = 170, PAD = 110;
  const Z_MIN = 0.18, Z_MAX = 1.3;

  const ratio = (w, h) => {
    const r = w / h;
    const known = [[1, '1:1'], [4 / 5, '4:5'], [3 / 4, '3:4'], [9 / 16, '9:16']];
    return known.reduce((a, b) => Math.abs(b[0] - r) < Math.abs(a[0] - r) ? b : a)[1];
  };
  const small = src => src.replace('assets/projects/', 'assets/projects/480/');

  /* ---------- Construcción ---------- */
  const total = projects.reduce((n, p) => n + p.media.length, 0);
  studio.querySelector('#studio-count').textContent = `${total} piezas · ${projects.length} marcas`;
  studio.querySelector('#studio-layer-total').textContent = `${projects.length} marcas`;

  const clusters = projects.map((project, pi) => {
    const el = document.createElement('div');
    el.className = 'studio-cluster';
    el.dataset.id = project.id;
    const label = document.createElement('div');
    label.className = 'studio-cluster-label';
    label.innerHTML = `<span class="studio-cluster-num mono"></span><span class="studio-cluster-name"></span><span class="mono"></span>`;
    label.children[0].textContent = String(pi + 1).padStart(2, '0');
    label.children[1].textContent = project.name;
    label.children[2].textContent = `${project.label.replace('DISEÑO / ', '')} · ${project.media.length} ${project.media.length === 1 ? 'pieza' : 'piezas'}`;
    el.append(label);
    const boards = project.media.map((media, mi) => {
      const w = media.w || 900, h = media.h || 1125;
      const b = document.createElement('button');
      b.type = 'button';
      b.className = 'studio-board';
      b.setAttribute('aria-label', `${project.name}: ${media.alt}. Pieza ${mi + 1} de ${project.media.length}`);
      b.setAttribute('aria-haspopup', 'dialog');
      b.dataset.ratio = ratio(w, h);
      const img = new Image();
      img.dataset.src = small(media.src);
      img.alt = '';
      img.decoding = 'async';
      img.draggable = false;
      img.addEventListener('load', () => img.classList.add('is-loaded'), {once: true});
      b.append(img);
      b.addEventListener('click', () => { if (!suppressClick) window.DESRUPTIVO_OPEN?.(project.id, mi, b); });
      el.append(b);
      return {el: b, w: BASE, h: Math.round(BASE * h / w), project, index: mi};
    });
    world.append(el);
    return {el, label, boards, project, pi, x: 0, y: 0, w: 0, h: 0};
  });

  /* Capas */
  const layerButtons = clusters.map(c => {
    const li = document.createElement('li');
    const b = document.createElement('button');
    b.type = 'button';
    b.className = 'studio-layer';
    b.setAttribute('aria-pressed', 'false');
    b.innerHTML = `<span class="mono studio-layer-num"></span><span></span><span class="mono"></span>`;
    b.children[0].textContent = String(c.pi + 1).padStart(2, '0');
    b.children[1].textContent = c.project.name;
    b.children[2].textContent = String(c.boards.length).padStart(2, '0');
    b.addEventListener('mouseenter', () => highlight(c));
    b.addEventListener('mouseleave', () => highlight(focused));
    b.addEventListener('focus', () => highlight(c));
    b.addEventListener('blur', () => highlight(focused));
    b.addEventListener('click', () => focusCluster(focused === c ? null : c));
    li.append(b);
    layersList.append(li);
    return b;
  });

  /* ---------- Acomodo ---------- */
  let worldW = 0, worldH = 0, mode = '';
  function layoutCluster(c, rowsForced) {
    const n = c.boards.length;
    const cols = rowsForced ? Math.ceil(n / rowsForced) : (n <= 4 ? n : Math.ceil(n / 2));
    let y = LABEL, maxW = 0;
    for (let r = 0; r * cols < n; r++) {
      const row = c.boards.slice(r * cols, r * cols + cols);
      let x = 0;
      const rowH = Math.max(...row.map(b => b.h));
      row.forEach(b => { b.x = x; b.y = y; x += b.w + GAP; });
      maxW = Math.max(maxW, x - GAP);
      y += rowH + GAP;
    }
    c.w = Math.max(maxW, Math.ceil(c.label.scrollWidth) + 12); c.h = y - GAP;
  }
  function layout() {
    mode = narrow() ? 'strip' : 'desk';
    if (mode === 'strip') {
      let x = PAD;
      clusters.forEach(c => { layoutCluster(c, c.boards.length > 2 ? 2 : 1); c.x = x; c.y = PAD / 2; x += c.w + CLUSTER_GAP_X; });
      worldW = x - CLUSTER_GAP_X + PAD;
      worldH = Math.max(...clusters.map(c => c.h)) + PAD;
    } else {
      clusters.forEach(c => layoutCluster(c));
      /* Acomodo tipo "skyline": cada marca va al hueco libre más alto */
      const pack = target => {
        let sky = [{x: PAD, w: target - PAD, y: PAD}];
        clusters.forEach(c => {
          let best = null;
          for (let i = 0; i < sky.length; i++) {
            const x = sky[i].x;
            if (x + c.w > target && x > PAD) continue;
            let y = 0;
            for (const s of sky) if (s.x < x + c.w && s.x + s.w > x) y = Math.max(y, s.y);
            if (!best || y < best.y - 1 || (Math.abs(y - best.y) <= 1 && x < best.x)) best = {x, y};
          }
          if (!best) best = {x: PAD, y: Math.max(...sky.map(s => s.y))};
          c.x = best.x; c.y = best.y;
          const top = best.y + c.h + CLUSTER_GAP_Y, x0 = best.x, x1 = best.x + c.w + CLUSTER_GAP_X;
          const next = [];
          sky.forEach(s => {
            const sEnd = s.x + s.w;
            if (sEnd <= x0 || s.x >= x1) { next.push(s); return; }
            if (s.x < x0) next.push({x: s.x, w: x0 - s.x, y: s.y});
            if (sEnd > x1) next.push({x: x1, w: sEnd - x1, y: s.y});
          });
          next.push({x: x0, w: x1 - x0, y: top});
          sky = next.sort((p, q) => p.x - q.x);
        });
        return {w: Math.max(...clusters.map(c => c.x + c.w)) + PAD, h: Math.max(...clusters.map(c => c.y + c.h)) + PAD};
      };
      /* Busca el ancho de mesa cuya forma se parezca más a la ventana visible */
      const aspect = (vw || 1100) / (vh || 640);
      let best = null;
      for (let t = 1600; t <= 7000; t += 200) {
        const r = pack(t), score = Math.max(r.w / aspect, r.h);
        if (!best || score < best.score - 1) best = {t, score};
      }
      const r = pack(best.t);
      worldW = r.w; worldH = r.h;
    }
    world.style.width = `${worldW}px`;
    world.style.height = `${worldH}px`;
    let order = 0;
    clusters.forEach(c => {
      c.el.style.transform = `translate(${c.x}px, ${c.y}px)`;
      c.el.style.width = `${c.w}px`;
      c.el.style.height = `${c.h}px`;
      c.boards.forEach(b => {
        Object.assign(b.el.style, {left: `${b.x}px`, top: `${b.y}px`, width: `${b.w}px`, height: `${b.h}px`});
        b.el.style.setProperty('--d', `${Math.min(order++, 40) * 22}ms`);
      });
    });
    if (mode === 'strip') canvas.style.height = `${Math.round(worldH * STRIP_Z)}px`;
    else canvas.style.height = '';
  }
  const STRIP_Z = 0.46;

  /* ---------- Cámara ---------- */
  const view = {x: 0, y: 0, z: 1};
  let vw = 0, vh = 0, anim = 0;
  const measure = () => { const r = canvas.getBoundingClientRect(); vw = r.width; vh = r.height; };
  function clamp(v) {
    const m = 60;
    const cw = worldW * v.z, ch = worldH * v.z;
    v.x = cw + 2 * m < vw ? (vw - cw) / 2 : Math.min(m, Math.max(vw - cw - m, v.x));
    v.y = ch + 2 * m < vh ? (vh - ch) / 2 : Math.min(m, Math.max(vh - ch - m, v.y));
    if (mode === 'strip') v.y = (vh - ch) / 2;
    return v;
  }
  function apply() {
    world.style.transform = `translate3d(${view.x}px, ${view.y}px, 0) scale(${view.z})`;
    zoomOut.textContent = `${Math.round(view.z * 100)}%`;
    placeSelection();
    drawRulers();
  }
  function set(v, animate) {
    cancelAnimationFrame(anim);
    const to = clamp({...view, ...v});
    if (!animate || reduced) { Object.assign(view, to); apply(); return; }
    const from = {...view}, start = performance.now(), dur = 620;
    const ease = t => 1 - Math.pow(1 - t, 4);
    const step = now => {
      const t = Math.min(1, (now - start) / dur), k = ease(t);
      view.x = from.x + (to.x - from.x) * k;
      view.y = from.y + (to.y - from.y) * k;
      view.z = from.z + (to.z - from.z) * k;
      apply();
      if (t < 1) anim = requestAnimationFrame(step);
    };
    anim = requestAnimationFrame(step);
  }
  function zoomAt(z, sx, sy, animate) {
    z = Math.min(Z_MAX, Math.max(Z_MIN, z));
    const wx = (sx - view.x) / view.z, wy = (sy - view.y) / view.z;
    set({z, x: sx - wx * z, y: sy - wy * z}, animate);
  }
  function fitRect(x, y, w, h, maxZ, animate) {
    const z = Math.min(maxZ, Math.max(Z_MIN, Math.min((vw - 80) / w, (vh - 80) / h)));
    set({z, x: vw / 2 - (x + w / 2) * z, y: vh / 2 - (y + h / 2) * z}, animate);
  }
  const fitAll = animate => mode === 'strip'
    ? set({z: STRIP_Z, x: 16 - PAD * STRIP_Z}, animate)
    : fitRect(0, 0, worldW, worldH, 1, animate);
  const intro = animate => {
    if (mode === 'strip') return set({z: STRIP_Z, x: 16 - PAD * STRIP_Z}, animate);
    const z = Math.min(0.62, Math.max(0.38, vw / 2150));
    set({z, x: 40 - PAD * z, y: 30 - PAD * z}, animate);
  };

  /* ---------- Capas y foco ---------- */
  let focused = null;
  function highlight(c) {
    world.classList.toggle('is-dimmed', !!c);
    clusters.forEach(k => k.el.classList.toggle('is-lit', k === c));
  }
  function focusCluster(c) {
    focused = c;
    layerButtons.forEach((b, i) => b.setAttribute('aria-pressed', String(clusters[i] === c)));
    highlight(c);
    if (c) fitRect(c.x, c.y, c.w, c.h, mode === 'strip' ? STRIP_Z : 1, true);
    else fitAll(true);
    dismissHint();
  }

  /* ---------- Selección (en pantalla, grosor constante) ---------- */
  let hovered = null;
  function placeSelection() {
    if (!hovered) { sel.classList.remove('is-on'); return; }
    const c = clusters.find(k => k.boards.includes(hovered));
    const x = (c.x + hovered.x) * view.z + view.x, y = (c.y + hovered.y) * view.z + view.y;
    Object.assign(sel.style, {transform: `translate(${x}px, ${y}px)`, width: `${hovered.w * view.z}px`, height: `${hovered.h * view.z}px`});
    tag.textContent = `${hovered.project.name} · ${hovered.el.dataset.ratio}`;
    sel.classList.toggle('tag-up', y + hovered.h * view.z > vh - 44);
    sel.classList.add('is-on');
  }
  const boardOf = el => { for (const c of clusters) for (const b of c.boards) if (b.el === el) return b; return null; };
  world.addEventListener('pointerover', e => {
    if (e.pointerType !== 'mouse' || dragging) return;
    const el = e.target.closest('.studio-board');
    hovered = el ? boardOf(el) : null; placeSelection(); drawRulers();
  });
  world.addEventListener('pointerleave', () => { hovered = null; placeSelection(); drawRulers(); });
  world.addEventListener('focusin', e => {
    const el = e.target.closest('.studio-board');
    if (!el) return;
    hovered = boardOf(el);
    const c = clusters.find(k => k.boards.includes(hovered));
    const x = (c.x + hovered.x) * view.z + view.x, y = (c.y + hovered.y) * view.z + view.y;
    if (x < 20 || y < 20 || x + hovered.w * view.z > vw - 20 || y + hovered.h * view.z > vh - 20) {
      set({x: vw / 2 - (c.x + hovered.x + hovered.w / 2) * view.z, y: vh / 2 - (c.y + hovered.y + hovered.h / 2) * view.z}, true);
    }
    canvas.scrollTop = 0; canvas.scrollLeft = 0;
    placeSelection(); drawRulers();
  });
  world.addEventListener('focusout', () => { hovered = null; placeSelection(); drawRulers(); });

  /* ---------- Arrastre con inercia ---------- */
  let dragging = false, suppressClick = false, start = null, last = null, vel = {x: 0, y: 0}, pid = null;
  canvas.addEventListener('pointerdown', e => {
    if (e.button !== 0) return;
    cancelAnimationFrame(anim);
    start = {x: e.clientX, y: e.clientY, vx: view.x, vy: view.y};
    last = {x: e.clientX, y: e.clientY, t: performance.now()};
    vel = {x: 0, y: 0}; pid = e.pointerId; suppressClick = false;
  });
  canvas.addEventListener('pointermove', e => {
    if (!start || e.pointerId !== pid) return;
    const dx = e.clientX - start.x, dy = e.clientY - start.y;
    if (!dragging && Math.hypot(dx, dy) > 5) {
      dragging = true; suppressClick = true;
      canvas.setPointerCapture(pid); canvas.classList.add('is-grabbing');
      hovered = null; placeSelection(); dismissHint();
    }
    if (!dragging) return;
    const now = performance.now(), dt = Math.max(1, now - last.t);
    vel = {x: (e.clientX - last.x) / dt, y: (e.clientY - last.y) / dt};
    last = {x: e.clientX, y: e.clientY, t: now};
    Object.assign(view, clamp({...view, x: start.vx + dx, y: mode === 'strip' ? view.y : start.vy + dy}));
    apply();
  });
  const endDrag = e => {
    if (!start || (e && e.pointerId !== pid)) return;
    const was = dragging;
    start = null; dragging = false; canvas.classList.remove('is-grabbing');
    if (was && !reduced && performance.now() - last.t < 80) {
      let vx = vel.x * 16, vy = mode === 'strip' ? 0 : vel.y * 16;
      const glide = () => {
        vx *= 0.92; vy *= 0.92;
        Object.assign(view, clamp({...view, x: view.x + vx, y: view.y + vy}));
        apply();
        if (Math.abs(vx) + Math.abs(vy) > 0.4) anim = requestAnimationFrame(glide);
      };
      anim = requestAnimationFrame(glide);
    }
    setTimeout(() => { suppressClick = false; }, 0);
  };
  canvas.addEventListener('pointerup', endDrag);
  canvas.addEventListener('pointercancel', e => { suppressClick = false; endDrag(e); });
  canvas.addEventListener('click', e => { if (suppressClick) { e.stopPropagation(); e.preventDefault(); } }, true);

  /* Rueda: Ctrl/⌘ o pellizco = zoom; desplazamiento horizontal = mover. La rueda vertical sigue bajando la página. */
  canvas.addEventListener('wheel', e => {
    const r = canvas.getBoundingClientRect();
    if ((e.ctrlKey || e.metaKey) && mode !== 'strip') {
      e.preventDefault();
      zoomAt(view.z * Math.exp(-e.deltaY * 0.0022), e.clientX - r.left, e.clientY - r.top, false);
      dismissHint();
    } else if (Math.abs(e.deltaX) > Math.abs(e.deltaY) || e.shiftKey) {
      e.preventDefault();
      const d = e.shiftKey && !e.deltaX ? e.deltaY : e.deltaX;
      set({x: view.x - d});
    }
  }, {passive: false});

  /* Botones de zoom */
  studio.querySelectorAll('[data-zoom]').forEach(b => b.addEventListener('click', () => {
    const steps = [0.18, 0.25, 0.35, 0.5, 0.72, 1, 1.3];
    const dir = Number(b.dataset.zoom);
    const next = dir > 0 ? steps.find(s => s > view.z + 0.01) : [...steps].reverse().find(s => s < view.z - 0.01);
    if (next) zoomAt(next, vw / 2, vh / 2, true);
  }));
  studio.querySelector('[data-fit]').addEventListener('click', () => focusCluster(null));

  function dismissHint() { hint.classList.add('is-gone'); }

  /* ---------- Reglas ---------- */
  function drawRuler(cv, horizontal) {
    const dpr = Math.min(2, window.devicePixelRatio || 1);
    const len = horizontal ? vw : vh, thick = 22;
    if (!len) return;
    const W = horizontal ? len : thick, H = horizontal ? thick : len;
    if (cv.width !== Math.round(W * dpr) || cv.height !== Math.round(H * dpr)) { cv.width = Math.round(W * dpr); cv.height = Math.round(H * dpr); cv.style.width = `${W}px`; cv.style.height = `${H}px`; }
    const g = cv.getContext('2d');
    g.setTransform(dpr, 0, 0, dpr, 0, 0);
    g.clearRect(0, 0, W, H);
    const offset = horizontal ? view.x : view.y;
    if (hovered) {
      const c = clusters.find(k => k.boards.includes(hovered));
      const a = ((horizontal ? c.x + hovered.x : c.y + hovered.y) * view.z) + offset;
      const b = a + (horizontal ? hovered.w : hovered.h) * view.z;
      g.fillStyle = 'rgba(193,23,26,.16)';
      horizontal ? g.fillRect(a, 0, b - a, H) : g.fillRect(0, a, W, b - a);
    }
    const steps = [10, 20, 50, 100, 200, 500];
    const minor = steps.find(s => s * view.z >= 7) || 500, major = minor * 5;
    const first = Math.floor(-offset / view.z / minor) * minor;
    g.fillStyle = 'rgba(39,39,42,.5)';
    g.font = '9px Mono, monospace';
    for (let wv = first; wv * view.z + offset < len; wv += minor) {
      const p = Math.round(wv * view.z + offset) + 0.5;
      const isMajor = wv % major === 0, tick = isMajor ? 10 : 5;
      horizontal ? g.fillRect(p, H - tick, 1, tick) : g.fillRect(W - tick, p, tick, 1);
      if (isMajor) {
        if (horizontal) g.fillText(String(wv), p + 3, 10);
        else { g.save(); g.translate(10, p + 3); g.rotate(-Math.PI / 2); g.fillText(String(wv), -g.measureText(String(wv)).width - 3, 0); g.restore(); }
      }
    }
  }
  let rulerQueued = false;
  function drawRulers() {
    if (rulerQueued) return;
    rulerQueued = true;
    requestAnimationFrame(() => { rulerQueued = false; drawRuler(rulerX, true); drawRuler(rulerY, false); });
  }

  /* ---------- Arranque ---------- */
  measure(); layout(); measure(); fitAll(false);
  const loadImages = () => world.querySelectorAll('img[data-src]').forEach(img => { img.src = img.dataset.src; img.removeAttribute('data-src'); });
  if ('IntersectionObserver' in window) {
    const lio = new IntersectionObserver(es => { if (es.some(x => x.isIntersecting)) { loadImages(); lio.disconnect(); } }, {rootMargin: '900px 0px'});
    lio.observe(studio);
  } else loadImages();
  let entered = false;
  const enter = () => {
    if (entered) return;
    entered = true;
    studio.classList.add('is-live');
    setTimeout(() => intro(true), reduced ? 0 : 900);
  };
  if ('IntersectionObserver' in window) {
    const io = new IntersectionObserver(es => { if (es.some(x => x.isIntersecting)) { enter(); io.disconnect(); } }, {threshold: 0.35});
    io.observe(canvas);
  } else enter();

  /* Las etiquetas se miden con la tipografía final */
  document.fonts?.ready.then(() => { layout(); measure(); entered ? set({}) : fitAll(false); });
  let lastMode = mode;
  new ResizeObserver(() => {
    measure();
    if (narrow() !== (lastMode === 'strip')) { layout(); lastMode = mode; measure(); entered ? intro(false) : fitAll(false); }
    else set({});
  }).observe(canvas);
})();
