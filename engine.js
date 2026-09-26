/*
 * DESRUPTIVO ENGINE
 * Motor de partículas en Canvas 2D, sin librerías.
 * Las palabras se rasterizan en un canvas oculto, se muestrean como puntos
 * y cada partícula viaja a su punto con un resorte amortiguado.
 */
(() => {
  const lab = document.querySelector('.eng-lab');
  if (!lab) return;
  const canvas = lab.querySelector('.eng-canvas');
  const ctx = canvas.getContext('2d');
  const reduced = matchMedia('(prefers-reduced-motion:reduce)').matches;
  const hud = { fps: lab.querySelector('[data-fps]'), count: lab.querySelector('[data-count]'), ms: lab.querySelector('[data-ms]') };
  const typedEl = lab.querySelector('[data-typed]');
  const logEl = lab.querySelector('.eng-log');
  const chips = [...lab.querySelectorAll('.eng-chip')];

  const WORDS = [
    { label: 'INGENIERÍA', wide: 'INGENIERÍA', narrow: 'INGE\nNIERÍA' },
    { label: 'APPS', wide: 'APPS', narrow: 'APPS' },
    { label: 'UX / UI', wide: 'UX / UI', narrow: 'UX/UI' },
    { label: 'AUTOMATIZACIÓN', wide: 'AUTOMATI\nZACIÓN', narrow: 'AUTO\nMATI\nZACIÓN' },
    { label: 'CHATBOTS', wide: 'CHATBOTS', narrow: 'CHAT\nBOTS' },
    { label: 'CRM', wide: 'CRM', narrow: 'CRM' }
  ];
  const COLORS = ['#e8e7df', '#c1171a', '#8fb258'];

  let W = 0, H = 0, dpr = 1, N = 0;
  let x, y, vx, vy, tx, ty, kf, group, dust;
  let current = 0, running = false, visible = false, raf = 0;
  let mouse = { x: -9999, y: -9999, on: false };
  let waves = [];
  let lastInteraction = 0, lastSwitch = 0, typing = false;
  let frames = 0, fpsClock = performance.now(), workTime = 0, drawn = 0;

  function capFor(width) { return width < 700 ? 2200 : width < 1100 ? 3800 : 5600; }

  function sampleWord(text) {
    const off = document.createElement('canvas');
    off.width = W; off.height = H;
    const o = off.getContext('2d', { willReadFrequently: true });
    const lines = text.split('\n');
    o.font = '700 100px Squid, Impact, sans-serif';
    const widest = Math.max(...lines.map(l => o.measureText(l).width));
    const usableH = H * (W < 700 ? 0.6 : 0.56);
    const fs = Math.min(usableH / (lines.length * 0.92), (W * 0.88) / (widest / 100));
    o.font = `700 ${fs}px Squid, Impact, sans-serif`;
    o.textAlign = 'center'; o.textBaseline = 'middle'; o.fillStyle = '#000';
    const lh = fs * 0.92;
    const cy = H * (W < 700 ? 0.4 : 0.43);
    lines.forEach((l, i) => o.fillText(l, W / 2, cy + (i - (lines.length - 1) / 2) * lh));
    const data = o.getImageData(0, 0, W, H).data;
    // Busca el paso de muestreo más fino que no exceda el número de partículas.
    let step = Math.max(2, Math.round(fs / 34)), pts;
    for (;;) {
      pts = [];
      for (let py = 0; py < H; py += step) for (let px = 0; px < W; px += step) {
        if (data[(py * W + px) * 4 + 3] > 140) pts.push(px + (Math.random() - 0.5) * step * 0.6, py + (Math.random() - 0.5) * step * 0.6);
      }
      if (pts.length / 2 <= N || step > 40) break;
      step++;
    }
    for (let i = pts.length / 2 - 1; i > 0; i--) {
      const j = (Math.random() * (i + 1)) | 0;
      [pts[i * 2], pts[j * 2]] = [pts[j * 2], pts[i * 2]];
      [pts[i * 2 + 1], pts[j * 2 + 1]] = [pts[j * 2 + 1], pts[i * 2 + 1]];
    }
    return { pts, step, count: Math.min(N, pts.length / 2) };
  }

  let size = 2;
  function morph(index) {
    const t0 = performance.now();
    const word = WORDS[index];
    const { pts, step, count } = sampleWord(W < 700 ? word.narrow : word.wide);
    size = Math.max(1.5, step * 0.74);
    for (let i = 0; i < N; i++) {
      if (i < count) { tx[i] = pts[i * 2]; ty[i] = pts[i * 2 + 1]; dust[i] = 0; }
      else { tx[i] = Math.random() * W; ty[i] = Math.random() * H; dust[i] = 1; }
    }
    current = index; lastSwitch = performance.now();
    chips.forEach((c, i) => c.setAttribute('aria-pressed', String(i === index)));
    const bar = chips[index].parentElement;
    bar.scrollTo({ left: chips[index].offsetLeft - bar.offsetLeft - 8, behavior: reduced ? 'auto' : 'smooth' });
    if (reduced) { x.set(tx); y.set(ty); draw(0); }
    return { count, ms: performance.now() - t0 };
  }

  function setup() {
    const rect = canvas.getBoundingClientRect();
    W = Math.max(1, Math.round(rect.width)); H = Math.max(1, Math.round(rect.height));
    dpr = Math.min(window.devicePixelRatio || 1, 2);
    canvas.width = W * dpr; canvas.height = H * dpr;
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    const newN = capFor(W);
    if (newN !== N) {
      const old = N ? { x, y } : null;
      N = newN;
      x = new Float32Array(N); y = new Float32Array(N); vx = new Float32Array(N); vy = new Float32Array(N);
      tx = new Float32Array(N); ty = new Float32Array(N); kf = new Float32Array(N);
      group = new Uint8Array(N); dust = new Uint8Array(N);
      for (let i = 0; i < N; i++) {
        const angle = Math.random() * Math.PI * 2, r = Math.max(W, H) * (0.6 + Math.random() * 0.5);
        x[i] = old && i < old.x.length ? old.x[i] : W / 2 + Math.cos(angle) * r;
        y[i] = old && i < old.y.length ? old.y[i] : H / 2 + Math.sin(angle) * r;
        kf[i] = 0.55 + Math.random() * 0.7;
        const roll = Math.random();
        group[i] = roll < 0.8 ? 0 : roll < 0.94 ? 1 : 2;
      }
    }
    hud.count.textContent = N.toLocaleString('es-MX');
    const fact = document.querySelector('[data-count-fact]');
    if (fact) fact.textContent = N.toLocaleString('es-MX');
    morph(current);
  }

  function update(t) {
    const K = 0.042, DAMP = 0.86;
    const R = W < 700 ? 70 : 110, R2 = R * R;
    const mx = mouse.x, my = mouse.y, mon = mouse.on;
    for (let i = 0; i < N; i++) {
      let gx = tx[i], gy = ty[i];
      if (dust[i]) { gx += Math.sin(t * 0.0004 + i) * 26; gy += Math.cos(t * 0.00033 + i * 1.7) * 26; }
      let ax = (gx - x[i]) * K * kf[i], ay = (gy - y[i]) * K * kf[i];
      if (mon) {
        const dx = x[i] - mx, dy = y[i] - my, d2 = dx * dx + dy * dy;
        if (d2 < R2 && d2 > 0.01) { const d = Math.sqrt(d2), f = (1 - d / R) * 6.5; ax += dx / d * f; ay += dy / d * f; }
      }
      for (let w = 0; w < waves.length; w++) {
        const wv = waves[w], dx = x[i] - wv.x, dy = y[i] - wv.y, d = Math.sqrt(dx * dx + dy * dy) || 1;
        const band = Math.abs(d - wv.r);
        if (band < 40) { const f = (1 - band / 40) * wv.power; ax += dx / d * f; ay += dy / d * f; }
      }
      vx[i] = (vx[i] + ax) * DAMP; vy[i] = (vy[i] + ay) * DAMP;
      x[i] += vx[i]; y[i] += vy[i];
    }
    waves = waves.filter(w => { w.r += 14; w.power *= 0.93; return w.power > 0.15 && w.r < Math.max(W, H) * 1.3; });
  }

  function draw(t) {
    ctx.clearRect(0, 0, W, H);
    // Polvo de fondo
    ctx.globalAlpha = 0.28; ctx.fillStyle = COLORS[0];
    for (let i = 0; i < N; i++) if (dust[i]) ctx.fillRect(x[i], y[i], 1.3, 1.3);
    ctx.globalAlpha = 1;
    drawn = 0;
    const half = size / 2;
    for (let g = 0; g < 3; g++) {
      ctx.fillStyle = COLORS[g]; ctx.strokeStyle = COLORS[g]; ctx.lineWidth = Math.max(1, size * 0.6);
      ctx.beginPath();
      for (let i = 0; i < N; i++) {
        if (dust[i] || group[i] !== g) continue;
        ctx.fillRect(x[i] - half, y[i] - half, size, size);
        const sp = vx[i] * vx[i] + vy[i] * vy[i];
        if (sp > 6) { ctx.moveTo(x[i], y[i]); ctx.lineTo(x[i] - vx[i] * 2.2, y[i] - vy[i] * 2.2); }
        drawn++;
      }
      ctx.globalAlpha = 0.55; ctx.stroke(); ctx.globalAlpha = 1;
    }
    // Constelación: une al cursor las partículas cercanas
    if (mouse.on) {
      const L = (W < 700 ? 70 : 110) * 1.5, L2 = L * L;
      ctx.lineWidth = 0.6; ctx.strokeStyle = 'rgba(143,178,88,.35)'; ctx.beginPath();
      let lines = 0;
      for (let i = 0; i < N && lines < 140; i += 3) {
        if (dust[i]) continue;
        const dx = x[i] - mouse.x, dy = y[i] - mouse.y;
        if (dx * dx + dy * dy < L2) { ctx.moveTo(mouse.x, mouse.y); ctx.lineTo(x[i], y[i]); lines++; }
      }
      ctx.stroke();
    }
    // Ondas
    ctx.lineWidth = 1.5;
    waves.forEach(w => { ctx.strokeStyle = `rgba(193,23,26,${Math.min(1, w.power / 6)})`; ctx.beginPath(); ctx.arc(w.x, w.y, w.r, 0, Math.PI * 2); ctx.stroke(); });
    // Mira del cursor con coordenadas
    if (mouse.on) {
      const R = W < 700 ? 70 : 110;
      ctx.strokeStyle = 'rgba(232,231,223,.35)'; ctx.lineWidth = 1;
      ctx.setLineDash([3, 5]); ctx.beginPath(); ctx.arc(mouse.x, mouse.y, R, 0, Math.PI * 2); ctx.stroke(); ctx.setLineDash([]);
      ctx.strokeStyle = '#c1171a'; ctx.beginPath();
      ctx.moveTo(mouse.x - 10, mouse.y); ctx.lineTo(mouse.x + 10, mouse.y); ctx.moveTo(mouse.x, mouse.y - 10); ctx.lineTo(mouse.x, mouse.y + 10); ctx.stroke();
      ctx.fillStyle = 'rgba(232,231,223,.7)'; ctx.font = '10px Mono, monospace';
      ctx.fillText(`X ${Math.round(mouse.x)}  Y ${Math.round(mouse.y)}`, mouse.x + 14, mouse.y - 12);
    }
  }

  function loop(t) {
    if (!running) return;
    const a = performance.now();
    update(t); draw(t);
    workTime += performance.now() - a; frames++;
    if (t - fpsClock > 500) {
      hud.fps.textContent = Math.round(frames * 1000 / (t - fpsClock));
      hud.ms.textContent = (workTime / frames).toFixed(1) + ' ms';
      frames = 0; workTime = 0; fpsClock = t;
    }
    if (!typing && t - lastInteraction > 9000 && t - lastSwitch > 5200) run((current + 1) % WORDS.length);
    raf = requestAnimationFrame(loop);
  }
  function start() { if (running || reduced) return; running = true; fpsClock = performance.now(); frames = 0; raf = requestAnimationFrame(loop); }
  function stop() { running = false; cancelAnimationFrame(raf); }

  function log(html) {
    const li = document.createElement('li'); li.innerHTML = html; logEl.append(li);
    while (logEl.children.length > 3) logEl.firstElementChild.remove();
  }
  function run(index) {
    if (typing) return;
    const cmd = `engine.morph("${WORDS[index].label}")`;
    if (reduced) { const r = morph(index); log(`<span class="ok">✓</span> ${cmd} · ${r.count.toLocaleString('es-MX')} puntos en ${r.ms.toFixed(1)} ms`); return; }
    typing = true; lastSwitch = performance.now();
    let i = 0;
    const tick = () => {
      typedEl.textContent = cmd.slice(0, ++i);
      if (i < cmd.length) { setTimeout(tick, 26); return; }
      const r = morph(index);
      setTimeout(() => {
        typedEl.textContent = '';
        log(`<span class="ok">✓</span> ${cmd} <span class="dim">· ${r.count.toLocaleString('es-MX')} puntos en ${r.ms.toFixed(1)} ms</span>`);
        typing = false;
      }, 380);
    };
    tick();
  }
  function burst(px, py, power = 9) { waves.push({ x: px, y: py, r: 0, power }); lastInteraction = performance.now(); }

  canvas.addEventListener('pointermove', e => { const r = canvas.getBoundingClientRect(); mouse.x = e.clientX - r.left; mouse.y = e.clientY - r.top; mouse.on = true; lastInteraction = performance.now(); });
  canvas.addEventListener('pointerleave', () => { mouse.on = false; });
  canvas.addEventListener('pointerup', e => { if (e.pointerType !== 'mouse') mouse.on = false; });
  canvas.addEventListener('pointerdown', e => { const r = canvas.getBoundingClientRect(); burst(e.clientX - r.left, e.clientY - r.top); });
  chips.forEach((chip, i) => chip.addEventListener('click', () => { lastInteraction = performance.now(); run(i); }));
  lab.querySelector('.eng-burst').addEventListener('click', () => {
    if (reduced) return;
    for (let i = 0; i < N; i++) { const a = Math.random() * Math.PI * 2, f = 14 + Math.random() * 26; vx[i] += Math.cos(a) * f; vy[i] += Math.sin(a) * f; }
    burst(W / 2, H / 2, 12);
  });
  document.addEventListener('keydown', e => {
    if (!visible || e.ctrlKey || e.metaKey || e.altKey || /INPUT|TEXTAREA|SELECT/.test(document.activeElement.tagName)) return;
    const n = Number(e.key);
    if (n >= 1 && n <= WORDS.length) { lastInteraction = performance.now(); run(n - 1); }
  });

  let resizeTimer;
  window.addEventListener('resize', () => { clearTimeout(resizeTimer); resizeTimer = setTimeout(setup, 180); });
  document.addEventListener('visibilitychange', () => { if (document.hidden) stop(); else if (visible) start(); });

  const boot = () => {
    lab.classList.add('is-ready');
    setup();
    log(`<span class="ok">✓</span> engine.init() <span class="dim">· ${N.toLocaleString('es-MX')} partículas · DPR ${dpr}</span>`);
    new IntersectionObserver(entries => entries.forEach(entry => {
      visible = entry.isIntersecting;
      if (visible) start(); else stop();
    }), { threshold: 0.15 }).observe(lab);
    if (reduced) draw(0);
  };
  (document.fonts && document.fonts.load ? document.fonts.load('700 100px Squid') : Promise.resolve()).then(boot, boot);
})();
