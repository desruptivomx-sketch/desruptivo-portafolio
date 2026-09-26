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
