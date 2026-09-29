/* Diseño gráfico: una pila de pruebas impresas. Se arrastra (mouse o dedo)
   la de arriba para lanzarla y aparece la siguiente; al hacer clic o tocarla
   se abre en el visor. Misma experiencia en computadora y celular. */
(() => {
  'use strict';
  const deck = document.querySelector('#deck');
  const projects = (window.DESRUPTIVO_PROJECTS || []).filter(p => p.category === 'design');
  if (!deck || !projects.length) return;

  const $ = s => document.querySelector(s);
  const stage = $('#deck-stage'), list = $('#deck-list'), ticksBox = $('#deck-ticks');
  const hint = $('#deck-hint'), openBtn = $('#deck-open');
  const brandNum = deck.querySelector('.deck-brand-num'), brandName = deck.querySelector('.deck-brand-name');
  const brandCat = deck.querySelector('.deck-brand-cat'), desc = deck.querySelector('.deck-desc');
  const reduced = matchMedia('(prefers-reduced-motion: reduce)').matches;
  const narrow = () => matchMedia('(max-width: 760px)').matches;
  const pad2 = n => String(n).padStart(2, '0');

  const pieces = [];
  projects.forEach((project, pi) => project.media.forEach((media, mi) => pieces.push({project, pi, media, mi})));
  const N = pieces.length;
  const firstOf = projects.map(p => pieces.findIndex(x => x.project === p));
  $('#deck-total').textContent = `${N} piezas · ${projects.length} marcas`;
  $('#deck-brands').textContent = `${projects.length} marcas`;

  /* Pruebas que asoman debajo de la de arriba */
  const STACK = [{x: 0, y: 0, r: 0, s: 1}, {x: 18, y: 18, r: 4.2, s: 0.955}, {x: -20, y: 32, r: -5, s: 0.91}];
  const cards = new Map();
  let index = 0, box = {w: 360, h: 480}, visible = new Set(), live = false;
  const mod = i => ((i % N) + N) % N;

  function sizeFor(p) {
    const ratio = (p.media.w || 900) / (p.media.h || 1125);
    const w = Math.min(box.w, box.h * ratio);
    return {w: Math.round(w), h: Math.round(w / ratio)};
  }
  function place(el, p, pos) {
    const {w, h} = sizeFor(p);
    el.style.width = `${w}px`;
    el.style.height = `${h}px`;
    el.style.transform = `translate(-50%, -50%) translate(${pos.x}px, ${pos.y}px) rotate(${pos.r}deg) scale(${pos.s})`;
  }
  function card(i) {
    if (cards.has(i)) return cards.get(i);
    const p = pieces[i];
    const el = document.createElement('button');
    el.type = 'button';
    el.className = 'deck-card';
    el.hidden = true;
    el.setAttribute('aria-label', `${p.project.name}: ${p.media.alt}. Ver en grande`);
    el.setAttribute('aria-haspopup', 'dialog');
    const img = new Image();
    img.alt = ''; img.decoding = 'async'; img.draggable = false;
    img.addEventListener('load', () => img.classList.add('is-loaded'), {once: true});
    img.src = p.media.src;
    el.append(img);
    el.addEventListener('click', () => { if (!moved) openCurrent(el); });
    stage.append(el);
    cards.set(i, el);
    return el;
  }
  const retire = el => { el.classList.remove('is-top'); el.tabIndex = -1; el.setAttribute('aria-hidden', 'true'); };
  const openCurrent = trigger => { const p = pieces[index]; window.DESRUPTIVO_OPEN?.(p.project.id, p.mi, trigger || cards.get(index)); };

  /* flyFrom: -1 entra desde la izquierda, 1 desde la derecha */
  function render(flyFrom) {
    const next = new Set();
    STACK.forEach((pos, k) => {
      const i = mod(index + k);
      next.add(i);
      const el = card(i);
      const wasHidden = el.hidden;
      el.hidden = false;
      el.classList.remove('is-fading', 'is-leaving');
      el.style.zIndex = String(10 - k);
      el.tabIndex = k === 0 ? 0 : -1;
      el.setAttribute('aria-hidden', String(k !== 0));
      el.classList.toggle('is-top', k === 0);
      if ((k === 0 && flyFrom) || (wasHidden && k > 0)) {
        el.classList.add('no-anim');
        if (k === 0) place(el, pieces[i], {x: flyFrom * (box.w + 180), y: -30, r: flyFrom * 16, s: 1});
        else { place(el, pieces[i], STACK[STACK.length - 1]); el.style.opacity = '0'; }
        el.offsetWidth; // fija el punto de partida antes de animar
        el.classList.remove('no-anim');
        el.style.opacity = '';
      }
      place(el, pieces[i], pos);
    });
    visible.forEach(i => {
      if (next.has(i)) return;
      const el = cards.get(i);
      if (!el) return;
      retire(el);
      if (el.classList.contains('is-leaving')) return;
      el.classList.add('is-fading');
      setTimeout(() => { if (!visible.has(i)) el.hidden = true; }, reduced ? 0 : 400);
    });
    visible = next;
    const pre = pieces[mod(index + STACK.length)];
    if (pre) new Image().src = pre.media.src;
    updateMeta();
  }

  let lastBrand = -1;
  function updateMeta() {
    const p = pieces[index];
    brandNum.textContent = pad2(p.pi + 1);
    brandName.textContent = p.project.name;
    brandCat.textContent = `${p.project.label.replace('DISEÑO / ', '')} · PIEZA ${p.mi + 1} DE ${p.project.media.length}`;
    desc.textContent = p.project.description;
    $('#deck-counter').textContent = `${pad2(index + 1)} / ${N}`;
    $('#deck-piece').textContent = `${pad2(index + 1)} / ${N}`;
    ticks.forEach((t, i) => t.classList.toggle('is-on', i === index));
    chips.forEach((c, i) => c.setAttribute('aria-pressed', String(i === p.pi)));
    if (p.pi !== lastBrand) {
      lastBrand = p.pi;
      const c = chips[p.pi], ul = list;
      if (narrow()) ul.scrollTo({left: c.parentElement.offsetLeft - 12, behavior: reduced ? 'auto' : 'smooth'});
      else if (c.offsetTop < ul.scrollTop || c.offsetTop + c.offsetHeight > ul.scrollTop + ul.clientHeight) ul.scrollTo({top: c.parentElement.offsetTop - 20, behavior: reduced ? 'auto' : 'smooth'});
    }
  }

  /* Lanzar la de arriba hacia un lado (dir -1 izquierda, 1 derecha) y pasar a la siguiente */
  function toss(side = -1) {
    const i = index, el = cards.get(i);
    if (el) {
      retire(el);
      el.classList.add('is-leaving');
      el.style.zIndex = '20';
      place(el, pieces[i], {x: side * (box.w + 220), y: -50, r: side * 24, s: 1});
      setTimeout(() => { el.classList.remove('is-leaving'); if (!visible.has(i)) el.hidden = true; }, reduced ? 0 : 520);
    }
    index = mod(index + 1);
    visible.delete(i);
    render();
    dismissHint();
  }
  function back() { index = mod(index - 1); render(-1); dismissHint(); }
  function jump(i) {
    if (i === index) return;
    const forward = i > index;
    index = i;
    render(forward ? 1 : -1);
    dismissHint();
  }

  /* Arrastre: mouse, pluma o dedo */
  let start = null, moved = false, lastX = 0, lastT = 0, vx = 0;
  stage.addEventListener('pointerdown', e => {
    if (e.button !== 0) return;
    const el = e.target.closest('.deck-card.is-top');
    if (!el) return;
    start = {x: e.clientX, y: e.clientY, el, id: e.pointerId};
    moved = false; lastX = e.clientX; lastT = performance.now(); vx = 0;
  });
  stage.addEventListener('pointermove', e => {
    if (!start || e.pointerId !== start.id) return;
    const dx = e.clientX - start.x, dy = e.clientY - start.y;
    if (!moved && Math.abs(dx) > 8 && Math.abs(dx) > Math.abs(dy)) {
      moved = true;
      try { start.el.setPointerCapture(start.id); } catch (_) {}
      start.el.classList.add('is-dragging');
    }
    if (!moved) return;
    const now = performance.now();
    vx = (e.clientX - lastX) / Math.max(1, now - lastT);
    lastX = e.clientX; lastT = now;
    place(start.el, pieces[index], {x: dx, y: e.pointerType === 'mouse' ? dy * 0.5 : Math.abs(dx) * 0.05, r: dx / 15, s: 1.02});
  });
  const release = e => {
    if (!start || (e && e.pointerId !== start.id)) return;
    const el = start.el, dx = lastX - start.x, recent = performance.now() - lastT < 90;
    el.classList.remove('is-dragging');
    start = null;
    if (!moved) return;
    if (dx < -80 || (recent && vx < -0.45)) toss(-1);
    else if (dx > 80 || (recent && vx > 0.45)) toss(1);
    else place(el, pieces[index], STACK[0]);
    setTimeout(() => { moved = false; }, 0);
  };
  stage.addEventListener('pointerup', release);
  stage.addEventListener('pointercancel', () => {
    if (start) { start.el.classList.remove('is-dragging'); place(start.el, pieces[index], STACK[0]); }
    start = null; moved = false;
  });
  stage.addEventListener('click', e => { if (moved) { e.preventDefault(); e.stopPropagation(); } }, true);

  deck.querySelector('[data-deck="1"]').addEventListener('click', () => toss(-1));
  deck.querySelector('[data-deck="-1"]').addEventListener('click', back);
  openBtn.addEventListener('click', () => openCurrent(openBtn));
  deck.addEventListener('keydown', e => {
    if (e.target.closest('.deck-index')) return;
    if (e.key === 'ArrowRight') { e.preventDefault(); toss(-1); if (e.target.classList.contains('deck-card')) cards.get(index)?.focus({preventScroll: true}); }
    if (e.key === 'ArrowLeft') { e.preventDefault(); back(); if (e.target.classList.contains('deck-card')) cards.get(index)?.focus({preventScroll: true}); }
  });
  function dismissHint() { hint.classList.add('is-gone'); }

  /* Índice de marcas y marcas de avance */
  const chips = projects.map((p, pi) => {
    const li = document.createElement('li');
    const b = document.createElement('button');
    b.type = 'button';
    b.className = 'deck-chip';
    b.innerHTML = '<span class="mono"></span><span></span><span class="mono"></span>';
    b.children[0].textContent = pad2(pi + 1);
    b.children[1].textContent = p.name;
    b.children[2].textContent = pad2(p.media.length);
    b.addEventListener('click', () => jump(firstOf[pi]));
    li.append(b);
    list.append(li);
    return b;
  });
  const ticks = pieces.map((p, i) => {
    const t = document.createElement('i');
    if (i && pieces[i - 1].project !== p.project) t.className = 'is-new';
    ticksBox.append(t);
    return t;
  });

  /* Tamaño de la pila según el espacio disponible */
  function measure() {
    if (narrow()) {
      const w = deck.clientWidth || 360;
      box = {w: Math.min(330, Math.round(w * 0.76)), h: Math.min(450, Math.round(window.innerHeight * 0.52))};
      deck.style.setProperty('--stage-h', `${box.h + 80}px`);
    } else {
      const w = stage.clientWidth || 600, h = stage.clientHeight || 560;
      box = {w: Math.min(460, Math.round(w * 0.62)), h: Math.round(Math.max(320, h - 110))};
    }
  }

  /* Entrada: las pruebas caen sobre la mesa al llegar a la sección */
  function enter() {
    if (live) return;
    live = true;
    if (reduced) return;
    [2, 1, 0].forEach((k, n) => {
      const i = mod(index + k), el = cards.get(i);
      if (!el) return;
      el.classList.add('no-anim');
      place(el, pieces[i], {...STACK[k], y: STACK[k].y - 160, r: STACK[k].r * 4 + (k ? 0 : -8)});
      el.style.opacity = '0';
      el.offsetWidth;
      el.classList.remove('no-anim');
      setTimeout(() => { el.style.opacity = ''; place(el, pieces[i], STACK[k]); }, 120 + n * 160);
    });
  }

  measure();
  render();
  if ('IntersectionObserver' in window && !reduced) {
    STACK.forEach((_, k) => { const el = cards.get(mod(index + k)); if (el) el.style.opacity = '0'; });
    const io = new IntersectionObserver(es => { if (es.some(x => x.isIntersecting)) { enter(); io.disconnect(); } }, {threshold: 0.35});
    io.observe(stage);
  } else live = true;
  let rt = 0;
  new ResizeObserver(() => { cancelAnimationFrame(rt); rt = requestAnimationFrame(() => { measure(); visible.forEach(i => { const k = [0, 1, 2].find(k => mod(index + k) === i); if (k !== undefined) place(cards.get(i), pieces[i], STACK[k]); }); }); }).observe(deck);
})();
