/* Branding: manuales de marca. Al elegir una marca la sección toma sus
   colores; las láminas se hojean (dedo, trackpad, mouse o teclado) y la
   paleta real se puede probar sobre la mesa y copiar. */
(() => {
  'use strict';
  const lab = document.querySelector('#brandlab');
  const brands = (window.DESRUPTIVO_PROJECTS || []).filter(p => p.category === 'branding');
  if (!lab || !brands.length) return;

  const $ = s => lab.querySelector(s);
  const pagesBox = $('#bl-pages'), thumbsBox = $('#bl-thumbs'), list = $('#bl-list');
  const palBox = $('#bl-palette'), fontsBox = $('#bl-fonts'), toast = $('#bl-toast');
  const reduced = matchMedia('(prefers-reduced-motion: reduce)').matches;
  const narrow = () => matchMedia('(max-width: 760px)').matches;
  const pad2 = n => String(n).padStart(2, '0');
  const small = src => src.replace(/(\d+\.jpg)$/, 'sm/$1');

  const total = brands.reduce((n, b) => n + b.media.length, 0);
  $('#bl-total').textContent = `${brands.length} marcas · ${total} láminas`;
  $('#bl-brands').textContent = `${brands.length} marcas`;

  /* Color: luminancia para elegir fondo claro y texto legible */
  const rgb = hex => [1, 3, 5].map(i => parseInt(hex.slice(i, i + 2), 16));
  const lum = hex => { const [r, g, b] = rgb(hex).map(v => { v /= 255; return v <= .03928 ? v / 12.92 : Math.pow((v + .055) / 1.055, 2.4); }); return .2126 * r + .7152 * g + .0722 * b; };
  const inkOn = hex => lum(hex) > .36 ? '#27272a' : '#f4f2ea';
  function theme(b) {
    const byLight = [...b.palette].sort((x, y) => lum(y.hex) - lum(x.hex));
    const bg = byLight[0].hex;
    const accent = b.palette.find(p => lum(p.hex) < .5 && lum(p.hex) > .015)?.hex || b.palette[0].hex;
    return {bg, accent, onAccent: inkOn(accent)};
  }

  let current = 0, page = 0;

  /* Índice */
  const chips = brands.map((b, i) => {
    const li = document.createElement('li');
    const btn = document.createElement('button');
    btn.type = 'button';
    btn.className = 'deck-chip';
    btn.innerHTML = '<span class="mono"></span><span></span><span class="mono"></span>';
    btn.children[0].textContent = pad2(i + 1);
    btn.children[1].textContent = b.name;
    btn.children[2].textContent = pad2(b.media.length);
    btn.addEventListener('click', () => show(i));
    li.append(btn);
    list.append(li);
    return btn;
  });

  /* Mostrar una marca */
  function show(i, first) {
    current = i;
    const b = brands[i], t = theme(b);
    lab.style.setProperty('--bl-bg', t.bg);
    lab.style.setProperty('--bl-accent', t.accent);
    lab.style.setProperty('--bl-on-accent', t.onAccent);
    chips.forEach((c, k) => c.setAttribute('aria-pressed', String(k === i)));
    if (!first) {
      const li = chips[i].parentElement;
      if (narrow()) list.scrollTo({left: li.offsetLeft - 12, behavior: reduced ? 'auto' : 'smooth'});
    }
    $('#bl-num').textContent = pad2(i + 1);
    $('#bl-name').textContent = b.name;
    $('#bl-cat').textContent = `${b.label.replace('BRANDING / ', '')} · ${b.media.length} LÁMINAS`;
    $('#bl-desc').textContent = b.description;

    /* Láminas */
    pagesBox.classList.add('is-swapping');
    const build = () => {
      pagesBox.replaceChildren(...b.media.map((m, k) => {
        const fig = document.createElement('figure');
        fig.className = 'bl-page';
        const btn = document.createElement('button');
        btn.type = 'button';
        btn.tabIndex = -1;
        btn.setAttribute('aria-label', `${m.alt}. Ver en grande`);
        const img = new Image();
        img.alt = '';
        img.decoding = 'async';
        img.draggable = false;
        if (k > 1) img.loading = 'lazy';
        img.srcset = `${small(m.src)} 640w, ${m.src} 1400w`;
        img.sizes = '(max-width: 760px) 92vw, 60vw';
        img.src = m.src;
        img.width = m.w; img.height = m.h;
        img.addEventListener('load', () => img.classList.add('is-loaded'), {once: true});
        btn.append(img);
        btn.addEventListener('click', () => { if (!dragMoved) window.DESRUPTIVO_OPEN?.(b.id, k, btn); });
        fig.append(btn);
        return fig;
      }));
      thumbsBox.replaceChildren(...b.media.map((m, k) => {
        const tb = document.createElement('button');
        tb.type = 'button';
        tb.className = 'bl-thumb';
        tb.setAttribute('aria-label', `Lámina ${k + 1}: ${m.alt}`);
        const img = new Image();
        img.alt = ''; img.loading = 'lazy'; img.decoding = 'async'; img.src = small(m.src);
        tb.append(img);
        tb.addEventListener('click', () => goTo(k));
        return tb;
      }));
      pagesBox.scrollLeft = 0;
      page = 0;
      syncPage();
      requestAnimationFrame(() => pagesBox.classList.remove('is-swapping'));
    };
    if (first || reduced) build(); else setTimeout(build, 220);

    /* Paleta y tipografía */
    palBox.replaceChildren(...b.palette.map((p, k) => {
      const li = document.createElement('li');
      li.style.setProperty('--i', k);
      const btn = document.createElement('button');
      btn.type = 'button';
      btn.className = 'bl-chip';
      btn.setAttribute('aria-label', `${p.name}, ${p.hex}. Copiar código`);
      btn.innerHTML = '<i aria-hidden="true"></i><span class="mono"></span><span></span>';
      btn.querySelector('i').style.background = p.hex;
      btn.children[1].textContent = p.hex.toUpperCase();
      btn.children[2].textContent = p.name;
      btn.addEventListener('mouseenter', () => lab.style.setProperty('--bl-bg', p.hex));
      btn.addEventListener('focus', () => lab.style.setProperty('--bl-bg', p.hex));
      const back = () => lab.style.setProperty('--bl-bg', theme(brands[current]).bg);
      btn.addEventListener('mouseleave', back);
      btn.addEventListener('blur', back);
      btn.addEventListener('click', () => copy(p.hex.toUpperCase(), p.name));
      li.append(btn);
      return li;
    }));
    fontsBox.replaceChildren(...b.fonts.map(f => {
      const li = document.createElement('li');
      li.innerHTML = '<span></span><span class="mono"></span>';
      li.children[0].textContent = f.name;
      li.children[1].textContent = f.role;
      return li;
    }));
    palBox.classList.remove('is-in'); void palBox.offsetWidth; palBox.classList.add('is-in');
  }

  /* Copiar color */
  let toastTimer = 0;
  async function copy(hex, name) {
    let ok = false;
    try { await navigator.clipboard.writeText(hex); ok = true; } catch (_) {}
    toast.textContent = ok ? `${hex} copiado · ${name}` : `${name}: ${hex}`;
    toast.classList.add('is-on');
    clearTimeout(toastTimer);
    toastTimer = setTimeout(() => toast.classList.remove('is-on'), 1800);
  }

  /* Láminas: posición y navegación */
  const count = () => brands[current].media.length;
  function syncPage() {
    const w = pagesBox.clientWidth || 1;
    const p = Math.max(0, Math.min(count() - 1, Math.round(pagesBox.scrollLeft / w)));
    page = p;
    $('#bl-counter').textContent = `${pad2(p + 1)} / ${pad2(count())}`;
    thumbsBox.querySelectorAll('.bl-thumb').forEach((t, k) => {
      const on = k === p;
      t.classList.toggle('is-on', on);
      t.setAttribute('aria-current', on ? 'true' : 'false');
      if (on) {
        const l = t.offsetLeft - thumbsBox.clientWidth / 2 + t.clientWidth / 2;
        thumbsBox.scrollTo({left: l, behavior: reduced ? 'auto' : 'smooth'});
      }
    });
  }
  function goTo(p) {
    p = (p + count()) % count();
    pagesBox.scrollTo({left: p * pagesBox.clientWidth, behavior: reduced ? 'auto' : 'smooth'});
  }
  let scrollRaf = 0;
  pagesBox.addEventListener('scroll', () => { cancelAnimationFrame(scrollRaf); scrollRaf = requestAnimationFrame(syncPage); }, {passive: true});
  lab.querySelectorAll('[data-bl]').forEach(b => b.addEventListener('click', () => goTo(page + Number(b.dataset.bl))));
  pagesBox.addEventListener('keydown', e => {
    if (e.key === 'ArrowRight') { e.preventDefault(); goTo(page + 1); }
    if (e.key === 'ArrowLeft') { e.preventDefault(); goTo(page - 1); }
    if (e.key === 'Enter') { e.preventDefault(); window.DESRUPTIVO_OPEN?.(brands[current].id, page, pagesBox); }
  });
  $('#bl-open').addEventListener('click', e => window.DESRUPTIVO_OPEN?.(brands[current].id, page, e.currentTarget));

  /* Mouse: arrastrar para hojear (el dedo y el trackpad usan el scroll nativo) */
  let drag = null, dragMoved = false;
  pagesBox.addEventListener('pointerdown', e => {
    if (e.pointerType !== 'mouse' || e.button !== 0) return;
    drag = {x: e.clientX, left: pagesBox.scrollLeft, id: e.pointerId};
    dragMoved = false;
  });
  pagesBox.addEventListener('pointermove', e => {
    if (!drag || e.pointerId !== drag.id) return;
    const dx = e.clientX - drag.x;
    if (!dragMoved && Math.abs(dx) > 6) {
      dragMoved = true;
      pagesBox.setPointerCapture(drag.id);
      pagesBox.classList.add('is-dragging');
    }
    if (dragMoved) pagesBox.scrollLeft = drag.left - dx;
  });
  const endDrag = e => {
    if (!drag || (e && e.pointerId !== drag.id)) return;
    const dx = e ? e.clientX - drag.x : 0, start = Math.round(drag.left / pagesBox.clientWidth);
    drag = null;
    if (!dragMoved) return;
    pagesBox.classList.remove('is-dragging');
    goTo(Math.abs(dx) > 60 ? start + (dx < 0 ? 1 : -1) : start);
    setTimeout(() => { dragMoved = false; }, 0);
  };
  pagesBox.addEventListener('pointerup', endDrag);
  pagesBox.addEventListener('pointercancel', () => { drag = null; dragMoved = false; pagesBox.classList.remove('is-dragging'); });
  pagesBox.addEventListener('click', e => { if (dragMoved) { e.preventDefault(); e.stopPropagation(); } }, true);

  new ResizeObserver(() => { pagesBox.scrollLeft = page * pagesBox.clientWidth; }).observe(pagesBox);
  show(0, true);
})();
