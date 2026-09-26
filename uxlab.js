/*
 * UX LAB
 * Comparador wireframe/interfaz, proceso con progreso por scroll
 * y microinteracciones. Sin librerías.
 */
(() => {
  const reduced = matchMedia('(prefers-reduced-motion:reduce)').matches;

  /* ---------- 1. Comparador wireframe → interfaz ---------- */
  const compare = document.querySelector('.ux-compare');
  if (compare) {
    const orders = [
      ['Mariana López', '$1,240', 'Entregado', 'ok'],
      ['Taller Kin', '$3,870', 'En camino', 'go'],
      ['Café Ixi', '$620', 'Preparando', 'wait'],
      ['Jorge Canul', '$2,150', 'Entregado', 'ok']
    ];
    const bars = [42, 58, 50, 74, 66, 88, 80];
    const mock = `
      <div class="m">
        <div class="m-top"><span class="m-logo">D</span><span class="m-nav"><i class="on">Pedidos</i><i>Clientes</i><i>Reportes</i></span><span class="m-user"></span></div>
        <div class="m-body">
          <div class="m-kpis">
            <div class="m-kpi m-kpi-main"><small>Ventas de hoy</small><b>$42,300</b><em>▲ 12% vs. ayer</em></div>
            <div class="m-kpi"><small>Pedidos</small><b>128</b><em>▲ 8</em></div>
            <div class="m-kpi"><small>Por entregar</small><b>14</b><em class="warn">3 con retraso</em></div>
          </div>
          <div class="m-chart"><small>Ventas de la semana</small><div class="m-bars">${bars.map((h, i) => `<span style="--h:${h}%;--i:${i}"></span>`).join('')}</div></div>
          <div class="m-list"><small>Últimos pedidos</small>${orders.map(o => `<div class="m-row"><span class="m-av"></span><span class="m-name">${o[0]}</span><span class="m-amt">${o[1]}</span><span class="m-pill m-${o[3]}">${o[2]}</span></div>`).join('')}</div>
          <button class="m-cta" tabindex="-1">+ Nuevo pedido</button>
        </div>
      </div>`;
    compare.querySelector('.ux-wire').innerHTML = mock;
    compare.querySelector('.ux-ui').innerHTML = mock;
    // Cada etiqueta vive en su capa para que se intercambien bajo el divisor.
    compare.querySelector('.ux-notes').append(compare.querySelector('.ux-tag-l'));
    compare.querySelector('.ux-ui').append(compare.querySelector('.ux-tag-r'));
    const fit = () => {
      const w = compare.clientWidth;
      compare.style.setProperty('--cw', (w / 100) + 'px');
      compare.classList.toggle('lay-phone', w <= 380);
      compare.classList.toggle('lay-tablet', w > 380 && w <= 640);
    };
    fit();
    if ('ResizeObserver' in window) new ResizeObserver(fit).observe(compare);
    else window.addEventListener('resize', fit);
    const range = compare.querySelector('.ux-range');
    const set = v => { compare.style.setProperty('--pos', v + '%'); compare.classList.toggle('show-notes', v > 18); };
    range.addEventListener('input', () => { compare.dataset.touched = '1'; set(range.value); });
    set(50);
    // Barrido de pista la primera vez que se ve, para mostrar que se puede arrastrar.
    if (!reduced && 'IntersectionObserver' in window) {
      const io = new IntersectionObserver(entries => {
        if (!entries[0].isIntersecting) return;
        io.disconnect();
        const frames = [[0, 50], [700, 82], [1500, 22], [2300, 50]];
        const t0 = performance.now();
        const step = now => {
          if (compare.dataset.touched) return;
          const t = now - t0;
          let k = 0; while (k < frames.length - 2 && t > frames[k + 1][0]) k++;
          const [ta, va] = frames[k], [tb, vb] = frames[k + 1];
          const u = Math.min(1, Math.max(0, (t - ta) / (tb - ta)));
          const e = u < 0.5 ? 2 * u * u : 1 - Math.pow(-2 * u + 2, 2) / 2;
          const v = va + (vb - va) * e;
          range.value = v; set(v);
          if (t < frames[frames.length - 1][0]) requestAnimationFrame(step);
          else compare.classList.add('bars-in');
        };
        setTimeout(() => { compare.classList.add('bars-in'); requestAnimationFrame(step); }, 400);
      }, { threshold: 0.5 });
      io.observe(compare);
    } else compare.classList.add('bars-in');
  }

  /* ---------- 4. Estudio en vivo: temas, dispositivos, cursores y demo ---------- */
  const studio = document.querySelector('.ux-studio');
  if (studio) {
    const canvas = studio.querySelector('.ux-canvas');
    const screen = studio.querySelector('.ux-compare');
    const THEMES = ['desruptivo', 'oceano', 'uva', 'menta', 'sol'];
    const DEVICES = { desktop: [1440, 900], tablet: [834, 1112], phone: [390, 844] };
    const DEVICE_ORDER = ['desktop', 'tablet', 'phone'];
    const swatches = [...studio.querySelectorAll('.ux-swatch')];
    const deviceBtns = [...studio.querySelectorAll('.ux-devices button')];
    const mode = studio.querySelector('.ux-mode');
    const radius = studio.querySelector('.ux-radius');
    const radiusVal = studio.querySelector('[data-radius-val]');
    const dims = studio.querySelector('[data-dims]');
    const autoLabel = studio.querySelector('[data-auto-label]');
    let lastUser = -Infinity, visible = false, tick = 0, timer = 0;

    const setTheme = id => { studio.dataset.theme = id; swatches.forEach(s => s.setAttribute('aria-pressed', String(s.dataset.theme === id))); };
    const setDark = on => { studio.classList.toggle('is-dark', on); mode.setAttribute('aria-checked', String(on)); };
    const setRadius = v => { studio.style.setProperty('--r', v); radius.value = v; radiusVal.textContent = v; };
    const setDevice = d => {
      studio.dataset.device = d; dims.textContent = DEVICES[d].join(' × ');
      deviceBtns.forEach(b => b.setAttribute('aria-pressed', String(b.dataset.device === d)));
      hideSelections(); retarget(950);
    };
    const manual = () => performance.now() - lastUser < 12000;
    const touch = () => { lastUser = performance.now(); studio.classList.add('is-manual'); autoLabel.textContent = 'TÚ TIENES EL CONTROL'; };

    swatches.forEach(s => s.addEventListener('click', () => { touch(); setTheme(s.dataset.theme); }));
    deviceBtns.forEach(b => b.addEventListener('click', () => { touch(); setDevice(b.dataset.device); }));
    mode.addEventListener('click', () => { touch(); setDark(mode.getAttribute('aria-checked') !== 'true'); });
    radius.addEventListener('input', () => { touch(); setRadius(radius.value); });
    screen.querySelector('.ux-range').addEventListener('input', touch);

    // Cursores UX y UI: seleccionan elementos reales y muestran su medida al tamaño del dispositivo
    const TARGETS = {
      ux: ['.m-kpi-main', '.m-cta', '.m-list', '.m-row:nth-of-type(2) .m-pill'],
      ui: ['.m-logo', '.m-chart', '.m-kpis .m-kpi:nth-child(2)', '.m-bars span:last-child']
    };
    const cursors = { ux: studio.querySelector('.ux-cursor[data-who="ux"]'), ui: studio.querySelector('.ux-cursor[data-who="ui"]') };
    const sels = { ux: studio.querySelector('.ux-sel[data-for="ux"]'), ui: studio.querySelector('.ux-sel[data-for="ui"]') };
    const idx = { ux: 0, ui: 0 };
    let retargetTimer = 0;
    function retarget(delay) {
      clearTimeout(retargetTimer);
      retargetTimer = setTimeout(() => { if (!visible) return; moveCursor('ux'); setTimeout(() => moveCursor('ui'), 450); }, delay);
    }
    function hideSelections() { Object.values(sels).forEach(s => s.classList.remove('is-on')); }
    function moveCursor(who) {
      const list = TARGETS[who].map(q => studio.querySelector('.ux-ui ' + q)).filter(el => el && el.offsetWidth > 0);
      if (!list.length) return;
      const el = list[idx[who]++ % list.length];
      const cr = canvas.getBoundingClientRect(), r = el.getBoundingClientRect();
      const x = r.left - cr.left, y = r.top - cr.top;
      const cursor = cursors[who], sel = sels[who];
      cursor.style.setProperty('--x', `${x + r.width * 0.72}px`);
      cursor.style.setProperty('--y', `${y + r.height * 0.62}px`);
      sel.classList.remove('is-on');
      setTimeout(() => {
        const cr = canvas.getBoundingClientRect(), r = el.getBoundingClientRect();
        const x = r.left - cr.left, y = r.top - cr.top;
        if (!r.width) return;
        const scale = DEVICES[studio.dataset.device][0] / screen.clientWidth;
        const first = !sel.dataset.placed;
        if (first) sel.style.transition = 'none';
        sel.style.setProperty('--sx', `${x}px`); sel.style.setProperty('--sy', `${y}px`);
        sel.style.width = `${r.width}px`; sel.style.height = `${r.height}px`;
        if (first) { void sel.offsetWidth; sel.style.transition = ''; sel.dataset.placed = '1'; }
        sel.querySelector('em').textContent = `${Math.round(r.width * scale)} × ${Math.round(r.height * scale)}`;
        sel.classList.add('is-on');
      }, 1050);
    }

    // Demo automática: se detiene cuando la persona toma el control
    function step() {
      if (!visible || document.hidden) return;
      if (manual()) return;
      studio.classList.remove('is-manual'); autoLabel.textContent = reduced ? 'DEMO DE COLOR' : 'DEMO AUTOMÁTICA';
      tick++;
      if (reduced) { if (tick % 2 === 0) setTheme(THEMES[(THEMES.indexOf(studio.dataset.theme) + 1) % THEMES.length]); if (tick % 5 === 0) setDark(!studio.classList.contains('is-dark')); return; }
      moveCursor(tick % 2 ? 'ux' : 'ui');
      if (tick % 3 === 0) setTheme(THEMES[(THEMES.indexOf(studio.dataset.theme) + 1) % THEMES.length]);
      if (tick % 5 === 0) setDevice(DEVICE_ORDER[(DEVICE_ORDER.indexOf(studio.dataset.device) + 1) % 3]);
      if (tick % 7 === 0) setDark(!studio.classList.contains('is-dark'));
      if (tick % 4 === 0) setRadius([0, 6, 12, 20, 28][(tick / 4) % 5]);
    }
    if (reduced) autoLabel.textContent = 'DEMO DE COLOR';
    const startDemo = () => {
      clearInterval(timer);
      if (!reduced) setTimeout(() => { moveCursor('ux'); setTimeout(() => moveCursor('ui'), 900); }, 1200);
      timer = setInterval(step, 2600);
    };
    if ('IntersectionObserver' in window) {
      new IntersectionObserver(entries => entries.forEach(entry => {
        visible = entry.isIntersecting;
        if (visible) startDemo(); else clearInterval(timer);
      }), { threshold: 0.2 }).observe(studio);
    } else { visible = true; startDemo(); }
    if (!reduced) window.addEventListener('resize', () => { hideSelections(); retarget(400); });
    dims.textContent = DEVICES.desktop.join(' × ');
  }

  /* ---------- 5. Inclinación 3D en tarjetas de microinteracción ---------- */
  if (!reduced && matchMedia('(hover:hover)').matches) {
    document.querySelectorAll('.ux-tile').forEach(tile => {
      tile.addEventListener('pointermove', e => {
        const r = tile.getBoundingClientRect();
        tile.style.setProperty('--tilt-y', `${((e.clientX - r.left) / r.width - 0.5) * 8}deg`);
        tile.style.setProperty('--tilt-x', `${(0.5 - (e.clientY - r.top) / r.height) * 8}deg`);
      });
      tile.addEventListener('pointerleave', () => { tile.style.removeProperty('--tilt-x'); tile.style.removeProperty('--tilt-y'); });
    });
  }

  /* ---------- 2. Proceso con progreso ligado al scroll ---------- */
  const steps = document.querySelector('.ux-steps');
  if (steps) {
    const items = [...steps.querySelectorAll('.svc-step')];
    const fill = steps.querySelector('.ux-steps-fill');
    let ticking = false;
    const update = () => {
      ticking = false;
      const r = steps.getBoundingClientRect(), mark = window.innerHeight * 0.6;
      const p = Math.max(0, Math.min(1, (mark - r.top) / r.height));
      fill.style.transform = `scaleY(${p})`;
      items.forEach(li => { const b = li.getBoundingClientRect(); li.classList.toggle('is-on', b.top + b.height * 0.35 < mark); });
    };
    const onScroll = () => { if (!ticking) { ticking = true; requestAnimationFrame(update); } };
    window.addEventListener('scroll', onScroll, { passive: true });
    window.addEventListener('resize', onScroll);
    update();
  }

  /* ---------- 3. Microinteracciones ---------- */
  // Magnetismo
  document.querySelectorAll('[data-demo="magnet"]').forEach(tile => {
    const btn = tile.querySelector('.ux-magnet');
    const stage = tile.querySelector('.ux-stage');
    if (reduced) return;
    stage.addEventListener('pointermove', e => {
      const r = btn.getBoundingClientRect();
      const dx = e.clientX - (r.left + r.width / 2), dy = e.clientY - (r.top + r.height / 2);
      btn.style.transform = `translate(${dx * 0.35}px, ${dy * 0.35}px)`;
      btn.style.setProperty('--mx', `${((e.clientX - r.left) / r.width) * 100}%`);
      btn.style.setProperty('--my', `${((e.clientY - r.top) / r.height) * 100}%`);
    });
    stage.addEventListener('pointerleave', () => { btn.style.transform = ''; });
    btn.addEventListener('click', () => { btn.classList.remove('is-pop'); void btn.offsetWidth; btn.classList.add('is-pop'); btn.textContent = btn.textContent === 'Tócame' ? '¡Así!' : 'Tócame'; });
  });

  // Interruptor
  document.querySelectorAll('[data-demo="toggle"]').forEach(tile => {
    const sw = tile.querySelector('.ux-switch'), label = tile.querySelector('.ux-switch-label');
    sw.addEventListener('click', () => {
      const on = sw.getAttribute('aria-checked') !== 'true';
      sw.setAttribute('aria-checked', String(on));
      tile.classList.toggle('is-dark', on);
      label.textContent = on ? 'MODO OSCURO' : 'MODO CLARO';
    });
  });

  // Me gusta con explosión
  document.querySelectorAll('[data-demo="like"]').forEach(tile => {
    const btn = tile.querySelector('.ux-like'), count = tile.querySelector('.ux-like-count b');
    let n = 127;
    btn.addEventListener('click', () => {
      const on = btn.getAttribute('aria-pressed') !== 'true';
      btn.setAttribute('aria-pressed', String(on));
      n += on ? 1 : -1;
      count.classList.remove('roll'); void count.offsetWidth; count.classList.add('roll');
      count.textContent = n;
      if (!on || reduced) return;
      const stage = tile.querySelector('.ux-stage');
      for (let i = 0; i < 12; i++) {
        const s = document.createElement('i');
        s.className = 'ux-burst';
        const a = (i / 12) * Math.PI * 2, d = 38 + Math.random() * 18;
        s.style.setProperty('--x', `${Math.cos(a) * d}px`);
        s.style.setProperty('--y', `${Math.sin(a) * d}px`);
        s.style.background = ['#c1171a', '#8fb258', '#27272a'][i % 3];
        const br = btn.getBoundingClientRect(), sr = stage.getBoundingClientRect();
        s.style.left = `${br.left - sr.left + br.width / 2}px`; s.style.top = `${br.top - sr.top + br.height / 2}px`;
        stage.append(s);
        setTimeout(() => s.remove(), 700);
      }
    });
  });

  // Botón con estados
  document.querySelectorAll('[data-demo="submit"]').forEach(tile => {
    const btn = tile.querySelector('.ux-submit'), status = tile.querySelector('.ux-status');
    btn.addEventListener('click', () => {
      if (btn.dataset.state) return;
      btn.dataset.state = 'loading'; status.textContent = 'Enviando pedido';
      setTimeout(() => { btn.dataset.state = 'done'; status.textContent = 'Pedido enviado'; }, reduced ? 300 : 1500);
      setTimeout(() => { delete btn.dataset.state; status.textContent = ''; }, reduced ? 1500 : 3600);
    });
  });
})();
