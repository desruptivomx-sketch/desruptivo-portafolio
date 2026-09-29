/* Fotografía: "cuarto oscuro". Cada foto se revela al entrar en pantalla y,
   al pasar el cursor, muestra el visor de la cámara con sus datos reales
   de exposición. Filtros por serie y visor en grande. */
(() => {
  'use strict';
  const box = document.querySelector('#photo');
  const series = (window.DESRUPTIVO_PROJECTS || []).filter(p => p.category === 'photo');
  if (!box || !series.length) return;

  const grid = box.querySelector('#ph-grid');
  const filters = box.querySelector('#ph-filters');
  const reduced = matchMedia('(prefers-reduced-motion: reduce)').matches;
  const pad2 = n => String(n).padStart(2, '0');
  const small = src => src.replace(/(\d+\.jpg)$/, 'sm/$1');

  const photos = [];
  series.forEach(s => s.media.forEach((m, i) => photos.push({s, m, i})));
  box.querySelector('#ph-total').textContent = `${photos.length} fotos · ${series.length} series`;

  /* Revelado al entrar en pantalla */
  const io = 'IntersectionObserver' in window && !reduced
    ? new IntersectionObserver(es => es.forEach(e => {
        if (!e.isIntersecting) return;
        const fig = e.target;
        const img = fig.querySelector('img');
        const go = () => fig.classList.add('is-developed');
        img.complete ? setTimeout(go, 120) : img.addEventListener('load', () => setTimeout(go, 120), {once: true});
        io.unobserve(fig);
      }), {threshold: 0.25})
    : null;

  function figure({s, m, i}, n) {
    const fig = document.createElement('figure');
    fig.className = 'ph-item';
    if (io) fig.classList.add('is-latent');
    fig.style.setProperty('--ar', `${m.w} / ${m.h}`);
    const hasExif = Boolean(m.f);
    const readout = hasExif ? `${m.f} · ${m.s} · ISO ${m.iso} · ${m.mm}mm` : (m.note || 'Fotografía');
    fig.innerHTML = `
      <button type="button" class="ph-frame" aria-haspopup="dialog">
        <img alt="" decoding="async" loading="lazy">
        <span class="ph-vf" aria-hidden="true"><i class="ph-c ph-tl"></i><i class="ph-c ph-tr"></i><i class="ph-c ph-bl"></i><i class="ph-c ph-br"></i><i class="ph-af"></i><span class="ph-read mono"></span></span>
      </button>
      <figcaption><span class="mono ph-num"></span><span class="ph-title"></span><span class="mono ph-serie"></span></figcaption>
      <p class="mono ph-exif"></p>`;
    const btn = fig.querySelector('button');
    btn.setAttribute('aria-label', `${m.title}, ${s.name}. ${m.alt}. Ver en grande`);
    const img = fig.querySelector('img');
    img.width = m.w; img.height = m.h;
    img.srcset = `${small(m.src)} 720w, ${m.src} ${m.w}w`;
    img.sizes = '(max-width: 760px) 46vw, (max-width: 1100px) 45vw, 30vw';
    img.src = small(m.src);
    fig.querySelector('.ph-read').textContent = readout;
    fig.querySelector('.ph-num').textContent = pad2(n + 1);
    fig.querySelector('.ph-title').textContent = m.title;
    fig.querySelector('.ph-serie').textContent = s.name;
    const exif = fig.querySelector('.ph-exif');
    exif.innerHTML = '<span class="ph-gear"></span><span></span>';
    exif.children[0].textContent = hasExif ? `${m.cam} · ${m.lens} · ` : '';
    exif.children[1].textContent = readout;
    btn.addEventListener('click', () => window.DESRUPTIVO_OPEN?.(s.id, i, btn));
    return fig;
  }

  let active = 'all';
  function render() {
    const list = active === 'all' ? photos : photos.filter(p => p.s.id === active);
    grid.classList.add('is-swapping');
    const build = () => {
      grid.replaceChildren(...list.map(figure));
      if (io) grid.querySelectorAll('.ph-item').forEach(f => io.observe(f));
      requestAnimationFrame(() => grid.classList.remove('is-swapping'));
    };
    grid.childElementCount && !reduced ? setTimeout(build, 200) : build();
    chips.forEach(c => c.setAttribute('aria-pressed', String(c.dataset.id === active)));
  }

  const chip = (id, label, count) => {
    const b = document.createElement('button');
    b.type = 'button';
    b.className = 'ph-chip mono';
    b.dataset.id = id;
    b.innerHTML = '<span></span><b></b>';
    b.children[0].textContent = label;
    b.children[1].textContent = pad2(count);
    b.addEventListener('click', () => { if (active !== id) { active = id; render(); } });
    filters.append(b);
    return b;
  };
  const chips = [chip('all', 'Todas', photos.length), ...series.map(s => chip(s.id, s.name, s.media.length))];
  render();
})();
