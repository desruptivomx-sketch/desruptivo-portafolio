/*
 * DESRUPTIVO BREAKOUT
 * Videojuego en Canvas 2D programado desde cero, sin librerías.
 * Cada ladrillo es un problema de negocio. Tu barra lo resuelve.
 */
(() => {
  const frame = document.querySelector('.bk-frame');
  if (!frame) return;
  const canvas = frame.querySelector('.bk-canvas');
  const ctx = canvas.getContext('2d');
  const $ = s => frame.querySelector(s);
  const reduced = matchMedia('(prefers-reduced-motion:reduce)').matches;

  const C = { bg: '#161618', paper: '#e8e7df', ink: '#27272a', red: '#c1171a', green: '#8fb258', grid: 'rgba(143,178,88,.07)' };
  const LABELS = ['Excel eterno', 'Leads perdidos', 'Sitio lento', 'Sin CRM', 'Doble captura', 'Copiar y pegar', 'Cero reportes', 'Sin respuesta', 'App caída', 'Papeleo', 'Pendientes', 'Bug', 'Spam', 'Caos', 'Todo a mano', 'Chats sin leer'];
  const LEVELS = {
    wide: [
      ['11111111', '11111111', '11111111', '11111111'],
      ['...22...', '..1111..', '.111111.', '11222211', '11111111'],
      ['2.2.2.2.', '.1.1.1.1', '21212121', '11111111', '2......2', '11111111']
    ],
    tall: [
      ['11111', '11111', '11111', '11111', '11111'],
      ['..2..', '.111.', '12221', '11111', '11111', '.1.1.'],
      ['2.2.2', '.1.1.', '21212', '11111', '2...2', '11111']
    ]
  };
  const POWERS = [
    { id: 'ia', label: 'IA', color: C.green, text: 'Multibola' },
    { id: 'api', label: 'API', color: C.paper, text: 'Barra ancha' },
    { id: 'deploy', label: 'DEPLOY', color: C.red, text: '+1 vida' }
  ];

  let W, H, tall, scale = 1, dpr = 1;
  let state = 'menu', level = 0, score = 0, lives = 3, best = 0, combo = 0;
  let paddle, balls, bricks, drops, sparks, floats, shake = 0, wideUntil = 0;
  let keys = { left: false, right: false }, pointerX = null, last = 0, raf = 0, visible = false;
  let muted = false, audio = null;

  try { best = Number(localStorage.getItem('desruptivo-breakout-best')) || 0; } catch (e) { best = 0; }

  /* ---------- Sonido (Web Audio, sin archivos) ---------- */
  function beep(freq, dur = 0.06, type = 'square', vol = 0.05) {
    if (muted) return;
    try {
      audio = audio || new (window.AudioContext || window.webkitAudioContext)();
      const o = audio.createOscillator(), g = audio.createGain();
      o.type = type; o.frequency.value = freq;
      g.gain.setValueAtTime(vol, audio.currentTime);
      g.gain.exponentialRampToValueAtTime(0.0001, audio.currentTime + dur);
      o.connect(g).connect(audio.destination); o.start(); o.stop(audio.currentTime + dur);
    } catch (e) { /* sin audio */ }
  }

  /* ---------- Tamaño y escala ---------- */
  function measure() {
    const rect = frame.querySelector('.bk-stage').getBoundingClientRect();
    const nowTall = rect.width < 640;
    if (nowTall !== tall) {
      tall = nowTall; W = tall ? 540 : 960; H = tall ? 760 : 600;
      frame.classList.toggle('is-tall', tall);
      if (paddle) { buildLevel(); resetServe(); }
    }
    const r2 = frame.querySelector('.bk-stage').getBoundingClientRect();
    scale = r2.width / W; dpr = Math.min(window.devicePixelRatio || 1, 2);
    canvas.width = Math.round(r2.width * dpr); canvas.height = Math.round(r2.width * (H / W) * dpr);
    ctx.setTransform(scale * dpr, 0, 0, scale * dpr, 0, 0);
    if (state !== 'play') draw();
  }

  /* ---------- Nivel ---------- */
  function buildLevel() {
    const map = LEVELS[tall ? 'tall' : 'wide'][level];
    const cols = map[0].length, margin = tall ? 22 : 40, gap = tall ? 7 : 8;
    const bw = (W - margin * 2 - gap * (cols - 1)) / cols, bh = tall ? 44 : 34, top = tall ? 86 : 74;
    const pool = [...LABELS].sort(() => Math.random() - 0.5);
    let n = 0;
    bricks = [];
    map.forEach((row, r) => [...row].forEach((ch, c) => {
      if (ch === '.') return;
      const armored = ch === '2';
      bricks.push({
        x: margin + c * (bw + gap), y: top + r * (bh + gap), w: bw, h: bh,
        hp: armored ? 2 : 1, armored,
        label: armored ? (tall ? 'Legacy' : 'Sistema legacy') : pool[n++ % pool.length],
        tone: armored ? 'ink' : ['red', 'paper', 'green', 'paper'][r % 4]
      });
    }));
  }
  function newPaddle() { const w = tall ? 118 : 150; return { x: W / 2 - w / 2, y: H - (tall ? 54 : 44), w, baseW: w, h: 16 }; }
  function speed() { return (tall ? 6.6 : 7.4) + level * 0.7; }
  function resetServe() {
    balls = [{ x: paddle.x + paddle.w / 2, y: paddle.y - 10, vx: 0, vy: 0, r: 8, stuck: true, trail: [] }];
    drops = []; combo = 0;
  }
  function newGame() {
    level = 0; score = 0; lives = 3; wideUntil = 0;
    paddle = newPaddle(); buildLevel(); resetServe(); sparks = []; floats = [];
    setState('serve');
  }

  /* ---------- Estados y pantallas ---------- */
  function setState(s) {
    state = s;
    frame.dataset.state = s;
    frame.querySelectorAll('[data-score-final]').forEach(el => el.textContent = score.toLocaleString('es-MX'));
    frame.querySelectorAll('[data-best-final]').forEach(el => el.textContent = best.toLocaleString('es-MX'));
    if (s === 'play' || s === 'serve') { cancelAnimationFrame(raf); last = performance.now(); raf = requestAnimationFrame(loop); }
    else draw();
    if (s === 'serve') canvas.focus({ preventScroll: true });
  }
  function launch() {
    if (state === 'serve') {
      balls.forEach(b => { if (b.stuck) { b.stuck = false; const a = (-60 - Math.random() * 60) * Math.PI / 180; b.vx = Math.cos(a) * speed(); b.vy = Math.sin(a) * speed(); } });
      beep(520, 0.08, 'triangle');
      setState('play');
    }
  }
  function pause() { if (state === 'play' || state === 'serve') { frame.dataset.resume = state; setState('paused'); } }
  function resume() { if (state === 'paused') setState(frame.dataset.resume || 'play'); }
  function saveBest() { if (score > best) { best = score; try { localStorage.setItem('desruptivo-breakout-best', String(best)); } catch (e) { /* sin almacenamiento */ } } }

  /* ---------- Efectos ---------- */
  function burst(x, y, color, n = 16) {
    if (reduced) return;
    for (let i = 0; i < n; i++) { const a = Math.random() * Math.PI * 2, s = 1.5 + Math.random() * 5; sparks.push({ x, y, vx: Math.cos(a) * s, vy: Math.sin(a) * s - 1.5, life: 1, size: 2 + Math.random() * 4, color }); }
  }
  function floatText(x, y, text, color = C.paper) { floats.push({ x, y, text, color, life: 1 }); }
  const toneColor = t => ({ red: C.red, paper: C.paper, green: C.green, ink: C.ink })[t];

  /* ---------- Física ---------- */
  function hitBrick(b, br) {
    // Resuelve la colisión círculo-rectángulo por el eje de menor penetración.
    const cx = Math.max(br.x, Math.min(b.x, br.x + br.w)), cy = Math.max(br.y, Math.min(b.y, br.y + br.h));
    const dx = b.x - cx, dy = b.y - cy;
    if (dx * dx + dy * dy > b.r * b.r) return false;
    const ox = Math.min(b.x + b.r - br.x, br.x + br.w - (b.x - b.r));
    const oy = Math.min(b.y + b.r - br.y, br.y + br.h - (b.y - b.r));
    if (ox < oy) { b.vx = b.x < br.x + br.w / 2 ? -Math.abs(b.vx) : Math.abs(b.vx); }
    else { b.vy = b.y < br.y + br.h / 2 ? -Math.abs(b.vy) : Math.abs(b.vy); }
    br.hp--;
    if (br.hp > 0) { beep(180, 0.07, 'sawtooth', 0.04); burst(b.x, b.y, C.red, 6); shake = 3; score += 5; return true; }
    combo++;
    const pts = (br.armored ? 25 : 10) * Math.min(combo, 8);
    score += pts;
    floatText(br.x + br.w / 2, br.y + br.h / 2, combo > 1 ? `+${pts} ×${Math.min(combo, 8)}` : `+${pts}`, combo > 2 ? C.green : C.paper);
    burst(br.x + br.w / 2, br.y + br.h / 2, toneColor(br.tone === 'ink' ? 'red' : br.tone), br.armored ? 26 : 16);
    shake = br.armored ? 7 : 4;
    beep(440 + Math.min(combo, 8) * 70, 0.06);
    bricks.splice(bricks.indexOf(br), 1);
    if (Math.random() < 0.17) { const p = POWERS[(Math.random() * POWERS.length) | 0]; drops.push({ ...p, x: br.x + br.w / 2, y: br.y + br.h / 2, vy: 2.4 }); }
    const sp = Math.hypot(b.vx, b.vy), target = Math.min(sp * 1.012, speed() * 1.45);
    b.vx *= target / sp; b.vy *= target / sp;
    return true;
  }

  function update(dt, now) {
    // Barra
    const pSpeed = 13 * dt;
    if (keys.left) paddle.x -= pSpeed;
    if (keys.right) paddle.x += pSpeed;
    if (pointerX !== null) paddle.x += (pointerX - paddle.w / 2 - paddle.x) * Math.min(1, 0.45 * dt);
    const targetW = now < wideUntil ? paddle.baseW * 1.6 : paddle.baseW;
    const center = paddle.x + paddle.w / 2;
    paddle.w += (targetW - paddle.w) * Math.min(1, 0.2 * dt); paddle.x = center - paddle.w / 2;
    paddle.x = Math.max(8, Math.min(W - paddle.w - 8, paddle.x));

    // Pelotas en subpasos para que no atraviesen ladrillos
    for (const b of balls) {
      if (b.stuck) { b.x = paddle.x + paddle.w / 2; b.y = paddle.y - b.r - 2; continue; }
      const steps = Math.ceil(Math.hypot(b.vx, b.vy) * dt / 4);
      for (let s = 0; s < steps; s++) {
        b.x += b.vx * dt / steps; b.y += b.vy * dt / steps;
        if (b.x < b.r) { b.x = b.r; b.vx = Math.abs(b.vx); beep(300, 0.03, 'triangle', 0.03); }
        if (b.x > W - b.r) { b.x = W - b.r; b.vx = -Math.abs(b.vx); beep(300, 0.03, 'triangle', 0.03); }
        if (b.y < b.r + 44) { b.y = b.r + 44; b.vy = Math.abs(b.vy); beep(300, 0.03, 'triangle', 0.03); }
        if (b.vy > 0 && b.y + b.r >= paddle.y && b.y - b.r <= paddle.y + paddle.h && b.x >= paddle.x - b.r && b.x <= paddle.x + paddle.w + b.r) {
          const hit = ((b.x - paddle.x) / paddle.w) * 2 - 1;
          const angle = (-90 + Math.max(-1, Math.min(1, hit)) * 62) * Math.PI / 180;
          const sp = Math.max(Math.hypot(b.vx, b.vy), speed());
          b.vx = Math.cos(angle) * sp; b.vy = Math.sin(angle) * sp; b.y = paddle.y - b.r;
          combo = 0; beep(260, 0.05, 'triangle'); burst(b.x, paddle.y, C.paper, 5);
        }
        for (let i = bricks.length - 1; i >= 0; i--) if (hitBrick(b, bricks[i])) break;
      }
      b.trail.push({ x: b.x, y: b.y }); if (b.trail.length > 12) b.trail.shift();
      if (b.y - b.r > H) b.dead = true;
    }
    balls = balls.filter(b => !b.dead);
    if (!balls.length) {
      lives--; shake = 12; beep(120, 0.35, 'sawtooth', 0.06); floatText(W / 2, H / 2, lives > 0 ? 'SE CAYÓ EL SERVIDOR' : 'GAME OVER', C.red);
      if (lives <= 0) { saveBest(); setState('over'); return; }
      wideUntil = 0; resetServe(); setState('serve'); return;
    }

    // Power-ups
    for (const d of drops) {
      d.y += d.vy * dt;
      if (d.y > paddle.y - 8 && d.y < paddle.y + paddle.h + 8 && d.x > paddle.x - 20 && d.x < paddle.x + paddle.w + 20) {
        d.taken = true; beep(880, 0.12, 'triangle', 0.05); floatText(d.x, paddle.y - 26, d.text, d.color);
        if (d.id === 'ia') { const src = balls[0]; for (let k = 0; k < 2; k++) { const a = (-120 + k * 60) * Math.PI / 180, sp = Math.hypot(src.vx, src.vy) || speed(); balls.push({ x: src.x, y: src.y, vx: Math.cos(a) * sp, vy: Math.sin(a) * sp, r: 8, stuck: false, trail: [] }); } }
        if (d.id === 'api') wideUntil = now + 12000;
        if (d.id === 'deploy') lives = Math.min(lives + 1, 5);
      }
    }
    drops = drops.filter(d => !d.taken && d.y < H + 30);

    // Partículas y textos
    for (const p of sparks) { p.x += p.vx * dt; p.y += p.vy * dt; p.vy += 0.18 * dt; p.life -= 0.022 * dt; }
    sparks = sparks.filter(p => p.life > 0);
    for (const f of floats) { f.y -= 0.8 * dt; f.life -= 0.016 * dt; }
    floats = floats.filter(f => f.life > 0);
    shake *= 0.85;

    if (!bricks.length) {
      saveBest();
      if (level < LEVELS.wide.length - 1) {
        setState('clear');
        setTimeout(() => { if (state !== 'clear') return; level++; buildLevel(); resetServe(); setState('serve'); }, 1700);
      } else setState('win');
    }
  }

  /* ---------- Dibujo ---------- */
  function roundRect(x, y, w, h, r) { ctx.beginPath(); ctx.moveTo(x + r, y); ctx.arcTo(x + w, y, x + w, y + h, r); ctx.arcTo(x + w, y + h, x, y + h, r); ctx.arcTo(x, y + h, x, y, r); ctx.arcTo(x, y, x + w, y, r); ctx.closePath(); }
  function fitText(text, max, size) { let s = size; ctx.font = `500 ${s}px NewBlack, Arial, sans-serif`; while (ctx.measureText(text).width > max && s > 8) { s--; ctx.font = `500 ${s}px NewBlack, Arial, sans-serif`; } }

  function drawLabel(br) {
    const base = tall ? 17 : 13, max = br.w - 10;
    ctx.font = `500 ${base}px NewBlack, Arial, sans-serif`;
    const words = br.label.split(' ');
    if (ctx.measureText(br.label).width <= max || words.length < 2) {
      fitText(br.label, max, base); ctx.fillText(br.label, br.x + br.w / 2, br.y + br.h / 2 + 1); return;
    }
    const mid = Math.ceil(words.length / 2), l1 = words.slice(0, mid).join(' '), l2 = words.slice(mid).join(' ');
    const longest = ctx.measureText(l1).width > ctx.measureText(l2).width ? l1 : l2;
    fitText(longest, max, tall ? 15 : 12);
    const lh = parseFloat(ctx.font.match(/(\d+(?:\.\d+)?)px/)[1]) * 1.05;
    ctx.fillText(l1, br.x + br.w / 2, br.y + br.h / 2 - lh / 2 + 1);
    ctx.fillText(l2, br.x + br.w / 2, br.y + br.h / 2 + lh / 2 + 1);
  }

  function draw() {
    if (!paddle) { paddle = newPaddle(); buildLevel(); resetServe(); sparks = []; floats = []; }
    ctx.save();
    ctx.fillStyle = C.bg; ctx.fillRect(0, 0, W, H);
    if (shake > 0.5 && !reduced) ctx.translate((Math.random() - 0.5) * shake, (Math.random() - 0.5) * shake);
    ctx.strokeStyle = C.grid; ctx.lineWidth = 1; ctx.beginPath();
    for (let gx = 0; gx <= W; gx += 40) { ctx.moveTo(gx, 0); ctx.lineTo(gx, H); }
    for (let gy = 0; gy <= H; gy += 40) { ctx.moveTo(0, gy); ctx.lineTo(W, gy); }
    ctx.stroke();

    // Barra superior de marcador
    ctx.fillStyle = 'rgba(232,231,223,.06)'; ctx.fillRect(0, 0, W, 44);
    ctx.strokeStyle = 'rgba(232,231,223,.15)'; ctx.beginPath(); ctx.moveTo(0, 44); ctx.lineTo(W, 44); ctx.stroke();
    ctx.font = '12px Mono, monospace'; ctx.textBaseline = 'middle';
    ctx.fillStyle = 'rgba(232,231,223,.6)'; ctx.textAlign = 'left';
    ctx.fillText(`NIVEL ${level + 1}/3`, 16, 22);
    ctx.textAlign = 'center'; ctx.fillStyle = C.paper; ctx.font = '700 22px Squid, Impact, sans-serif';
    ctx.fillText(score.toLocaleString('es-MX'), W / 2, 23);
    ctx.textAlign = 'right'; ctx.font = '12px Mono, monospace'; ctx.fillStyle = 'rgba(232,231,223,.6)';
    ctx.fillText(`RÉCORD ${best.toLocaleString('es-MX')}`, W - 16 - lives * 18 - 12, 22);
    for (let i = 0; i < lives; i++) { ctx.fillStyle = C.red; ctx.fillRect(W - 16 - (i + 1) * 18 + 4, 16, 12, 12); }

    // Ladrillos
    ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
    for (const br of bricks) {
      const damaged = br.armored && br.hp === 1;
      const fill = damaged ? C.red : toneColor(br.tone);
      roundRect(br.x, br.y, br.w, br.h, 6); ctx.fillStyle = fill; ctx.fill();
      if (br.armored) {
        ctx.lineWidth = 2; ctx.strokeStyle = damaged ? C.paper : C.red; ctx.stroke();
        if (damaged) { ctx.beginPath(); ctx.moveTo(br.x + br.w * 0.3, br.y); ctx.lineTo(br.x + br.w * 0.45, br.y + br.h * 0.5); ctx.lineTo(br.x + br.w * 0.38, br.y + br.h); ctx.moveTo(br.x + br.w * 0.45, br.y + br.h * 0.5); ctx.lineTo(br.x + br.w * 0.62, br.y + br.h * 0.35); ctx.strokeStyle = 'rgba(39,39,42,.55)'; ctx.lineWidth = 1.5; ctx.stroke(); }
      }
      ctx.fillStyle = br.tone === 'red' || br.armored ? C.paper : C.ink;
      drawLabel(br);
    }

    // Power-ups
    for (const d of drops) {
      ctx.font = '11px Mono, monospace';
      const w = ctx.measureText(d.label).width + 22;
      roundRect(d.x - w / 2, d.y - 11, w, 22, 11); ctx.fillStyle = d.color; ctx.fill();
      ctx.fillStyle = d.color === C.red ? C.paper : C.ink; ctx.fillText(d.label, d.x, d.y + 1);
    }

    // Barra del jugador
    const wide = paddle.w > paddle.baseW + 4;
    roundRect(paddle.x, paddle.y, paddle.w, paddle.h, 8); ctx.fillStyle = wide ? C.green : C.paper; ctx.fill();
    ctx.fillStyle = C.ink; ctx.font = '700 10px Mono, monospace'; ctx.fillText('DESRUPTIVO', paddle.x + paddle.w / 2, paddle.y + paddle.h / 2 + 1);

    // Pelotas con estela
    for (const b of balls) {
      b.trail.forEach((p, i) => { ctx.globalAlpha = (i / b.trail.length) * 0.35; ctx.fillStyle = C.red; ctx.beginPath(); ctx.arc(p.x, p.y, b.r * (i / b.trail.length), 0, Math.PI * 2); ctx.fill(); });
      ctx.globalAlpha = 1; ctx.fillStyle = C.red; ctx.beginPath(); ctx.arc(b.x, b.y, b.r, 0, Math.PI * 2); ctx.fill();
      ctx.fillStyle = 'rgba(255,255,255,.55)'; ctx.beginPath(); ctx.arc(b.x - 2.5, b.y - 2.5, 2.5, 0, Math.PI * 2); ctx.fill();
    }

    for (const p of sparks) { ctx.globalAlpha = Math.max(0, p.life); ctx.fillStyle = p.color; ctx.fillRect(p.x, p.y, p.size, p.size); }
    ctx.globalAlpha = 1;
    for (const f of floats) { ctx.globalAlpha = Math.max(0, f.life); ctx.fillStyle = f.color; ctx.font = '700 18px Squid, Impact, sans-serif'; ctx.fillText(f.text, f.x, f.y); }
    ctx.globalAlpha = 1;

    if (state === 'serve') {
      ctx.fillStyle = 'rgba(232,231,223,.75)'; ctx.font = '12px Mono, monospace';
      ctx.fillText(tall ? 'TOCA PARA LANZAR' : 'CLIC O ESPACIO PARA LANZAR', W / 2, paddle.y - 46);
    }
    ctx.restore();
  }

  function loop(now) {
    if (state !== 'play' && state !== 'serve') return;
    const dt = Math.min(2.5, (now - last) / 16.667); last = now;
    update(dt, now); draw();
    if (state === 'play' || state === 'serve') raf = requestAnimationFrame(loop);
  }

  /* ---------- Controles ---------- */
  const toLogical = e => { const r = canvas.getBoundingClientRect(); return (e.clientX - r.left) / scale; };
  canvas.addEventListener('pointermove', e => { if (state === 'play' || state === 'serve') pointerX = toLogical(e); });
  canvas.addEventListener('pointerdown', e => { pointerX = toLogical(e); if (state === 'serve') launch(); });
  canvas.addEventListener('pointerleave', e => { if (e.pointerType === 'mouse') pointerX = null; });
  document.addEventListener('keydown', e => {
    if (!visible || state === 'menu' || /INPUT|TEXTAREA|SELECT/.test(document.activeElement.tagName)) return;
    const k = e.key;
    if (k === 'ArrowLeft' || k === 'a' || k === 'A') { keys.left = true; pointerX = null; if (state === 'play' || state === 'serve') e.preventDefault(); }
    if (k === 'ArrowRight' || k === 'd' || k === 'D') { keys.right = true; pointerX = null; if (state === 'play' || state === 'serve') e.preventDefault(); }
    if (k === ' ' && (state === 'serve' || state === 'play')) { e.preventDefault(); launch(); }
    if (k === 'p' || k === 'P' || k === 'Escape') { if (state === 'paused') resume(); else pause(); }
  });
  document.addEventListener('keyup', e => {
    if (e.key === 'ArrowLeft' || e.key === 'a' || e.key === 'A') keys.left = false;
    if (e.key === 'ArrowRight' || e.key === 'd' || e.key === 'D') keys.right = false;
  });
  frame.querySelectorAll('[data-action]').forEach(btn => btn.addEventListener('click', () => {
    const a = btn.dataset.action;
    if (a === 'start' || a === 'restart') newGame();
    if (a === 'resume') resume();
    if (a === 'pause') { if (state === 'paused') resume(); else pause(); }
    if (a === 'mute') { muted = !muted; btn.setAttribute('aria-pressed', String(muted)); btn.textContent = muted ? 'Sonido: no' : 'Sonido: sí'; }
  }));

  new IntersectionObserver(entries => entries.forEach(entry => {
    visible = entry.isIntersecting;
    if (!visible) pause();
  }), { threshold: 0.2 }).observe(frame);
  document.addEventListener('visibilitychange', () => { if (document.hidden) pause(); });
  let rt; window.addEventListener('resize', () => { clearTimeout(rt); rt = setTimeout(measure, 150); });

  const boot = () => { measure(); setState('menu'); };
  (document.fonts && document.fonts.ready ? document.fonts.ready : Promise.resolve()).then(boot, boot);
})();
