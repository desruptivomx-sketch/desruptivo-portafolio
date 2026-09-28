/*
 * SALA DE PROYECCIÓN
 * Carrusel 3D de reels verticales, luz ambiental tomada del video,
 * línea de tiempo tipo editor y reproductor completo con sonido.
 */
(() => {
  const root = document.querySelector('.reel');
  if (!root) return;
  const stage = root.querySelector('.reel-stage');
  const cards = [...root.querySelectorAll('.reel-card')];
  const clips = [...root.querySelectorAll('.reel-clip')];
  const ambient = root.querySelector('.reel-ambient');
  const actx = ambient.getContext('2d', { willReadFrequently: false });
  const $ = s => root.querySelector(s);
  const reduced = matchMedia('(prefers-reduced-motion:reduce)').matches;
  const net = navigator.connection || {};
  const light = net.saveData || /(^|-)2g|3g/.test(net.effectiveType || '');
  const N = cards.length;
  let active = -1, visible = false, raf = 0, lastUser = 0, video = null, dragX = null;

  const fmt = s => { s = Math.max(0, Math.round(s)); return `${String(Math.floor(s / 60)).padStart(2, '0')}:${String(s % 60).padStart(2, '0')}`; };
  const fmtShort = s => { s = Math.round(s); return `${Math.floor(s / 60)}:${String(s % 60).padStart(2, '0')}`; };

  // Un solo <video> que se mueve a la tarjeta activa: solo se descarga una vista previa a la vez.
  video = document.createElement('video');
  video.className = 'reel-video';
  video.muted = true; video.playsInline = true; video.setAttribute('playsinline', ''); video.preload = 'none';
  video.setAttribute('aria-hidden', 'true');
  const overlay = document.createElement('span');
  overlay.className = 'reel-overlay';
  overlay.innerHTML = '<span class="reel-live mono"><i></i>REPRODUCIENDO</span><span class="reel-hint mono">TOCA PARA VER CON SONIDO</span><span class="reel-bar"><i></i></span>';

  function titleLetters(el, text) {
    el.innerHTML = '';
    el.setAttribute('aria-label', text);
    let n = 0;
    text.split(' ').forEach((word, w) => {
      if (w) el.append(' ');
      const span = document.createElement('span');
      span.className = 'reel-word'; span.setAttribute('aria-hidden', 'true');
      [...word].forEach(ch => { const c = document.createElement('span'); c.className = 'reel-ch'; c.textContent = ch; c.style.setProperty('--i', n++); span.append(c); });
      el.append(span);
    });
  }

  function layout() {
    cards.forEach((card, i) => {
      let d = i - active;
      if (d > N / 2) d -= N; if (d < -N / 2) d += N;
      card.style.setProperty('--d', d);
      card.style.setProperty('--ad', Math.abs(d));
      card.classList.toggle('is-active', d === 0);
      card.tabIndex = Math.abs(d) <= 1 ? 0 : -1;
      card.setAttribute('aria-current', d === 0 ? 'true' : 'false');
      card.style.zIndex = String(10 - Math.abs(d));
    });
    clips.forEach((c, i) => c.setAttribute('aria-pressed', String(i === active)));
  }

  function go(index, user) {
    index = (index + N) % N;
    if (user) lastUser = performance.now();
    if (index === active) return;
    active = index;
    const card = cards[active], d = card.dataset;
    layout();
    titleLetters($('[data-reel-title]'), d.title);
    $('[data-reel-label]').textContent = d.label;
    $('[data-reel-count]').textContent = `${String(active + 1).padStart(2, '0')} / ${String(N).padStart(2, '0')}`;
    $('[data-reel-desc]').textContent = d.desc;
    $('[data-reel-spec]').textContent = `720 × 1280 · VERTICAL 9:16 · ${fmtShort(+d.dur)}`;
    const info = root.querySelector('.reel-info');
    info.classList.remove('is-swap'); void info.offsetWidth; info.classList.add('is-swap');
    // Mueve el video y su capa a la tarjeta activa
    video.pause();
    card.append(video, overlay);
    video.poster = d.poster;
    // La luz ambiental arranca con los colores de la portada mientras llega el video
    const cover = card.querySelector('img');
    if (cover.complete) drawAmbient(cover); else cover.addEventListener('load', () => drawAmbient(cover), { once: true });
    if (!light && !reduced) { video.src = d.preview; video.currentTime = 0; if (visible) video.play().catch(() => {}); }
    else video.removeAttribute('src');
    const track = clips[active].parentElement, clip = clips[active];
    track.scrollTo({ left: clip.offsetLeft - track.clientWidth / 2 + clip.clientWidth / 2, behavior: reduced ? 'auto' : 'smooth' });
  }

  /* Luz ambiental: el video, reducido a 36 × 20 px y desenfocado, pinta el fondo */
  let lastDraw = 0;
  function drawAmbient(src) {
    // Mezcla suave con el cuadro anterior para que el color cambie como luz, no como parpadeo
    try { actx.globalAlpha = src.tagName === 'VIDEO' ? 0.35 : 1; actx.drawImage(src, 0, 0, ambient.width, ambient.height); actx.globalAlpha = 1; } catch (e) { /* aún sin datos */ }
  }
  function frame(now) {
    raf = requestAnimationFrame(frame);
    if (!visible) return;
    if (now - lastDraw > 90 && video.readyState >= 2) { drawAmbient(video); lastDraw = now; }
    const d = cards[active].dataset, start = +d.start, dur = +d.dur;
    const t = video.readyState >= 1 && !isNaN(video.duration) ? start + video.currentTime : start;
    const p = Math.min(1, t / dur);
    clips[active].style.setProperty('--p', p);
    overlay.style.setProperty('--vp', video.duration ? video.currentTime / video.duration : 0);
    $('[data-reel-tc]').textContent = `${fmt(t)} / ${fmtShort(dur)}`;
  }

  video.addEventListener('ended', () => { if (performance.now() - lastUser > 8000) go(active + 1); else { video.currentTime = 0; video.play().catch(() => {}); } });
  video.addEventListener('loadeddata', () => drawAmbient(video));

  cards.forEach((card, i) => card.addEventListener('click', () => {
    if (dragMoved) return;
    if (i === active) openPlayer(); else go(i, true);
  }));
  clips.forEach((clip, i) => clip.addEventListener('click', () => go(i, true)));
  root.querySelectorAll('.reel-arrow').forEach(b => b.addEventListener('click', () => go(active + Number(b.dataset.dir), true)));
  root.querySelector('.reel-watch').addEventListener('click', () => openPlayer());
  stage.addEventListener('keydown', e => {
    if (e.key === 'ArrowRight') { e.preventDefault(); go(active + 1, true); cards[active].focus({ preventScroll: true }); }
    if (e.key === 'ArrowLeft') { e.preventDefault(); go(active - 1, true); cards[active].focus({ preventScroll: true }); }
  });

  // Arrastre / deslizamiento
  let dragMoved = false;
  const flow = root.querySelector('.reel-flow');
  flow.addEventListener('pointerdown', e => { dragX = e.clientX; dragMoved = false; });
  flow.addEventListener('pointermove', e => {
    if (dragX === null) return;
    const dx = e.clientX - dragX;
    if (Math.abs(dx) > 50) { go(active + (dx < 0 ? 1 : -1), true); dragX = e.clientX; dragMoved = true; }
  });
  const endDrag = () => { dragX = null; setTimeout(() => { dragMoved = false; }, 0); };
  flow.addEventListener('pointerup', endDrag); flow.addEventListener('pointercancel', endDrag); flow.addEventListener('pointerleave', endDrag);

  /* Reproductor completo con sonido */
  const dialog = root.querySelector('.reel-player');
  const full = dialog.querySelector('video');
  function openPlayer() {
    const d = cards[active].dataset;
    video.pause();
    full.poster = d.poster; full.src = d.full;
    dialog.querySelector('.reel-player-title').textContent = `${d.title} · ${d.label}`;
    if (dialog.showModal) dialog.showModal(); else dialog.setAttribute('open', '');
    full.play().catch(() => {});
    lastUser = performance.now();
  }
  function closePlayer() {
    full.pause(); full.removeAttribute('src'); full.load();
    if (dialog.open && dialog.close) dialog.close(); else dialog.removeAttribute('open');
    if (visible && !light && !reduced) video.play().catch(() => {});
  }
  dialog.querySelector('.reel-close').addEventListener('click', closePlayer);
  dialog.addEventListener('click', e => { if (e.target === dialog) closePlayer(); });
  dialog.addEventListener('cancel', e => { e.preventDefault(); closePlayer(); });

  /* Solo trabaja cuando la sala está en pantalla */
  const io = new IntersectionObserver(entries => entries.forEach(entry => {
    visible = entry.isIntersecting;
    if (visible) { if (video.src && !dialog.open) video.play().catch(() => {}); }
    else video.pause();
  }), { threshold: 0.25 });
  io.observe(stage);
  document.addEventListener('visibilitychange', () => { if (document.hidden) video.pause(); else if (visible && video.src && !dialog.open) video.play().catch(() => {}); });

  root.classList.add('is-ready');
  go(0);
  requestAnimationFrame(frame);
})();
