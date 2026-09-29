(() => {
  'use strict';
  document.documentElement.classList.add('js');

  // Aparición al hacer scroll (progressive enhancement: sin JS, .reveal
  // nunca se oculta porque el CSS solo aplica opacity:0 bajo .js)
  const reveals = document.querySelectorAll('.reveal');
  if (reveals.length) {
    if ('IntersectionObserver' in window) {
      const io = new IntersectionObserver(entries => {
        entries.forEach(entry => {
          if (entry.isIntersecting) { entry.target.classList.add('in'); io.unobserve(entry.target); }
        });
      }, { threshold: 0.15, rootMargin: '0px 0px -40px 0px' });
      reveals.forEach(el => io.observe(el));
    } else {
      reveals.forEach(el => el.classList.add('in'));
    }
  }

  // Tarjetas de proyecto: inclinación 3D siguiendo el mouse (delegado en el
  // contenedor para que siga funcionando cuando el grid se re-renderiza)
  if (matchMedia('(pointer:fine)').matches && !matchMedia('(prefers-reduced-motion:reduce)').matches) {
    let tilted = null;
    const resetTilt = el => { el.style.transform = ''; };
    document.querySelectorAll('.project-grid').forEach(pgrid => {
      pgrid.addEventListener('mousemove', event => {
        const card = event.target.closest('.project-image');
        if (!card || !pgrid.contains(card)) { if (tilted) { resetTilt(tilted); tilted = null; } return; }
        if (tilted && tilted !== card) resetTilt(tilted);
        tilted = card;
        const rect = card.getBoundingClientRect();
        const x = event.clientX - rect.left, y = event.clientY - rect.top;
        const rotateY = ((x - rect.width / 2) / (rect.width / 2)) * 6;
        const rotateX = -((y - rect.height / 2) / (rect.height / 2)) * 6;
        card.style.transform = `rotateX(${rotateX.toFixed(2)}deg) rotateY(${rotateY.toFixed(2)}deg)`;
      });
      pgrid.addEventListener('mouseleave', () => { if (tilted) { resetTilt(tilted); tilted = null; } });
    });
  }

  const finePointer = matchMedia('(pointer:fine)').matches;
  const reducedMotion = matchMedia('(prefers-reduced-motion:reduce)').matches;

  // Texto que se "descifra": recorre los nodos de texto de un elemento
  // (respeta <br>/<span> intactos) y va revelando cada carácter desde
  // glifos al azar, de izquierda a derecha.
  function scrambleReveal(el, duration = 900) {
    const glyphs = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789';
    const nodes = [];
    (function walk(node) {
      node.childNodes.forEach(child => {
        if (child.nodeType === Node.TEXT_NODE && child.nodeValue.trim() !== '') {
          nodes.push({ node: child, original: child.nodeValue, offset: 0, locks: [] });
        } else if (child.nodeType === Node.ELEMENT_NODE) {
          walk(child);
        }
      });
    })(el);
    if (!nodes.length) return;
    let total = 0;
    nodes.forEach(n => { n.offset = total; total += n.original.length; });
    nodes.forEach(n => {
      for (let i = 0; i < n.original.length; i++) {
        const globalIndex = n.offset + i;
        n.locks.push((globalIndex / total) * duration * 0.6 + Math.random() * duration * 0.4);
      }
    });
    const start = performance.now();
    function frame(now) {
      const elapsed = now - start;
      let done = true;
      nodes.forEach(n => {
        let out = '';
        for (let i = 0; i < n.original.length; i++) {
          const ch = n.original[i];
          if (ch === ' ') { out += ch; continue; }
          if (elapsed >= n.locks[i]) { out += ch; }
          else { out += glyphs[(Math.random() * glyphs.length) | 0]; done = false; }
        }
        n.node.nodeValue = out;
      });
      if (!done) requestAnimationFrame(frame);
    }
    requestAnimationFrame(frame);
  }
  const scrambleEls = document.querySelectorAll('.scramble');
  if (scrambleEls.length) {
    if (reducedMotion || !('IntersectionObserver' in window)) {
      // sin animación: el texto ya está completo en el HTML, no hace falta tocarlo
    } else {
      const sio = new IntersectionObserver(entries => {
        entries.forEach(entry => {
          if (entry.isIntersecting) { scrambleReveal(entry.target); sio.unobserve(entry.target); }
        });
      }, { threshold: 0.4 });
      scrambleEls.forEach(el => sio.observe(el));
    }
  }

  // Cursor propio: un pequeño anillo que acompaña al cursor real (no lo
  // reemplaza) y crece sobre elementos interactivos.
  if (finePointer && !reducedMotion) {
    const glow = document.createElement('div');
    glow.className = 'cursor-glow';
    glow.setAttribute('aria-hidden', 'true');
    document.body.appendChild(glow);
    let targetX = innerWidth / 2, targetY = innerHeight / 2, currentX = targetX, currentY = targetY, cursorPlaced = false;
    addEventListener('mousemove', event => {
      targetX = event.clientX; targetY = event.clientY;
      if (!cursorPlaced) { currentX = targetX; currentY = targetY; glow.style.opacity = '1'; cursorPlaced = true; }
    }, { passive: true });
    document.addEventListener('mouseover', event => {
      if (event.target.closest('a,button,.filter')) glow.classList.add('is-active');
    });
    document.addEventListener('mouseout', event => {
      if (event.target.closest('a,button,.filter')) glow.classList.remove('is-active');
    });
    (function loop() {
      currentX += (targetX - currentX) * 0.18;
      currentY += (targetY - currentY) * 0.18;
      glow.style.transform = `translate(${currentX}px, ${currentY}px)`;
      requestAnimationFrame(loop);
    })();
  }

  // Botón del hero: tirón magnético hacia el cursor
  if (finePointer && !reducedMotion) {
    document.querySelectorAll('.round-link').forEach(btn => {
      btn.addEventListener('mousemove', event => {
        const rect = btn.getBoundingClientRect();
        const x = event.clientX - rect.left - rect.width / 2;
        const y = event.clientY - rect.top - rect.height / 2;
        btn.style.transform = `translate(${x * 0.35}px, ${y * 0.35 + 4}px)`;
      });
      btn.addEventListener('mouseleave', () => { btn.style.transform = ''; });
    });
  }


  // Carrusel de disciplinas: letras que caen, texto que se escribe,
  // celular que entra girando y salida con desenfoque.
  const carousel = document.querySelector('.dc');
  if (carousel) {
    const slides = [...carousel.querySelectorAll('.dc-slide')];
    const tabs = [...carousel.querySelectorAll('.dc-tab')];
    const DURATION = 7000;
    let current = -1, typing = null, started = false, visible = false, hovering = false;
    carousel.style.setProperty('--dc-time', DURATION + 'ms');

    slides.forEach(slide => {
      const title = slide.querySelector('.dc-title');
      title.setAttribute('aria-label', title.textContent.replace(/\s+/g, ' ').trim());
      let n = 0;
      [...title.childNodes].forEach(node => {
        if (node.nodeType !== Node.TEXT_NODE) return;
        const frag = document.createDocumentFragment();
        node.nodeValue.split(/(\s+)/).forEach(part => {
          if (!part) return;
          if (/^\s+$/.test(part)) { frag.append(' '); return; }
          const word = document.createElement('span');
          word.className = 'dc-word'; word.setAttribute('aria-hidden', 'true');
          [...part].forEach(ch => {
            const s = document.createElement('span');
            s.className = 'dc-ch'; s.textContent = ch;
            s.style.setProperty('--i', n++);
            s.style.setProperty('--r', ((Math.random() * 50) - 25).toFixed(1) + 'deg');
            word.append(s);
          });
          frag.append(word);
        });
        node.replaceWith(frag);
      });
      slide.style.setProperty('--dc-letters', n);
      slide.querySelectorAll('.dc-collage img').forEach((img, k) => img.style.setProperty('--k', k));
      const sub = slide.querySelector('.dc-sub');
      sub.dataset.full = sub.textContent;
    });

    function typeSub(sub) {
      clearInterval(typing);
      const full = sub.dataset.full;
      if (reducedMotion) { sub.textContent = full; return; }
      let i = 0;
      const render = () => { sub.innerHTML = ''; const a = document.createElement('span'); a.textContent = full.slice(0, i); const b = document.createElement('span'); b.className = 'dc-ghost'; b.textContent = full.slice(i); sub.append(a, b); };
      render();
      setTimeout(() => { typing = setInterval(() => { i += 2; render(); if (i >= full.length) clearInterval(typing); }, 22); }, 650);
    }
    function setVideo(slide, play) {
      const video = slide.querySelector('.dc-video');
      if (!video) return;
      const net = navigator.connection || {};
      const lightMode = net.saveData || /(^|-)2g|3g/.test(net.effectiveType || '');
      if (play && !reducedMotion && !lightMode) { if (!video.src) video.src = video.dataset.src; video.play().catch(() => {}); }
      else video.pause();
    }
    function restartBar() {
      carousel.classList.remove('is-auto');
      void carousel.offsetWidth;
      if (!reducedMotion) carousel.classList.add('is-auto');
    }
    function go(index, dir) {
      index = (index + slides.length) % slides.length;
      if (index === current) return;
      const back = dir < 0;
      const prev = slides[current];
      if (prev) {
        prev.classList.remove('is-active');
        prev.classList.toggle('is-back', back);
        prev.classList.add('is-leaving');
        setVideo(prev, false);
        setTimeout(() => prev.classList.remove('is-leaving'), 600);
      }
      const next = slides[index];
      next.classList.remove('is-leaving');
      next.classList.toggle('is-back', back);
      void next.offsetWidth;
      next.classList.add('is-active');
      typeSub(next.querySelector('.dc-sub'));
      setVideo(next, true);
      tabs.forEach((tab, t) => { const on = t === index; tab.setAttribute('aria-selected', String(on)); tab.tabIndex = on ? 0 : -1; });
      const tabsEl = tabs[index].parentElement;
      tabsEl.scrollTo({ left: tabs[index].offsetLeft - tabsEl.offsetLeft - 10, behavior: reducedMotion ? 'auto' : 'smooth' });
      current = index;
      restartBar();
    }
    function updatePause() { carousel.classList.toggle('is-paused', hovering || !visible || document.hidden); }

    carousel.addEventListener('animationend', event => {
      if (event.animationName === 'dcFill') go(current + 1, 1);
    });
    tabs.forEach((tab, t) => {
      tab.addEventListener('click', () => go(t, t < current ? -1 : 1));
      tab.addEventListener('keydown', event => {
        const d = event.key === 'ArrowRight' ? 1 : event.key === 'ArrowLeft' ? -1 : 0;
        if (!d) return;
        event.preventDefault(); go(current + d, d); tabs[current].focus();
      });
    });
    carousel.querySelectorAll('.dc-arrow').forEach(btn => btn.addEventListener('click', () => { const d = Number(btn.dataset.dir); go(current + d, d); }));
    carousel.addEventListener('mouseenter', () => { hovering = true; updatePause(); });
    carousel.addEventListener('mouseleave', () => { hovering = false; updatePause(); });
    carousel.addEventListener('focusin', () => { hovering = true; updatePause(); });
    carousel.addEventListener('focusout', event => { if (!carousel.contains(event.relatedTarget)) { hovering = false; updatePause(); } });
    document.addEventListener('visibilitychange', updatePause);
    let touchX = null;
    carousel.addEventListener('touchstart', event => { touchX = event.touches[0].clientX; }, { passive: true });
    carousel.addEventListener('touchend', event => {
      if (touchX === null) return;
      const dx = event.changedTouches[0].clientX - touchX; touchX = null;
      if (Math.abs(dx) > 45) { const d = dx < 0 ? 1 : -1; go(current + d, d); }
    }, { passive: true });

    if ('IntersectionObserver' in window) {
      new IntersectionObserver(entries => {
        entries.forEach(entry => {
          visible = entry.isIntersecting;
          if (visible && !started) { started = true; go(0, 1); }
          if (current >= 0) setVideo(slides[current], visible);
          updatePause();
        });
      }, { threshold: 0.35 }).observe(carousel);
    } else { visible = true; go(0, 1); }
  }

  const menuToggle = document.querySelector('.menu-toggle');
  const nav = document.querySelector('#main-nav');
  function closeMenu() { nav.classList.remove('is-open'); menuToggle.setAttribute('aria-expanded','false'); }
  menuToggle.addEventListener('click', () => {
    const open = nav.classList.toggle('is-open');
    menuToggle.setAttribute('aria-expanded', String(open));
  });
  nav.querySelectorAll('a').forEach(link => link.addEventListener('click', closeMenu));
  document.addEventListener('keydown', event => { if (event.key === 'Escape' && nav.classList.contains('is-open')) {closeMenu();menuToggle.focus();} });
  document.addEventListener('click', event => { if (!event.target.closest('.site-header')) closeMenu(); });
  document.querySelector('#year').textContent = new Date().getFullYear();
  const grid = document.querySelector('#project-grid');
  if (!grid) return;
  const allProjects = window.DESRUPTIVO_PROJECTS || [];
  const projects = allProjects.filter(project => {
    if (grid.dataset.collection === 'marketing') return project.category === 'design';
    if (grid.dataset.collection === 'multimedia') return project.category === 'video';
    if (grid.dataset.collection === 'diseno') return project.category === 'design';
    return true;
  });
  const filters = [...document.querySelectorAll('.filter')];
  const moreButton = document.querySelector('#load-more');
  const count = document.querySelector('#project-count');
  const dialog = document.querySelector('#project-dialog');
  const mediaContainer = document.querySelector('#dialog-media');
  let activeFilter = 'all', shown = 6, currentProject, currentMedia = 0, opener;

  function renderProjects() {
    const matching = projects.filter(project => activeFilter === 'all' || project.category === activeFilter);
    grid.replaceChildren();
    matching.slice(0, shown).forEach((project, cardPosition) => {
      const article = document.createElement('article');
      article.className = 'project-card card-in';
      article.style.setProperty('--i', String(cardPosition % 6));
      const button = document.createElement('button');
      button.className = 'project-button';
      button.setAttribute('aria-label', `Ver proyecto: ${project.name}`);
      button.setAttribute('aria-haspopup', 'dialog');
      const frame = document.createElement('div');
      frame.className = `project-image ${project.tone}`;
      const img = new Image();
      img.src = project.cover;
      if (project.cover.startsWith('assets/projects/')) {
        img.srcset = `${project.cover.replace('assets/projects/', 'assets/projects/480/')} 480w, ${project.cover} 900w`;
        img.sizes = '(max-width:760px) 50vw, 30vw';
      }
      img.decoding = 'async';
      img.alt = project.media[0].alt;
      img.loading = 'lazy';
      img.decoding = 'async';
      frame.append(img);
      const index = document.createElement('span');
      index.className = 'project-index';
      index.textContent = String(projects.indexOf(project) + 1).padStart(2, '0');
      index.setAttribute('aria-hidden', 'true');
      const arrow = document.createElement('span');
      arrow.className = 'project-open';
      arrow.textContent = '↗';
      arrow.setAttribute('aria-hidden', 'true');
      frame.append(index, arrow);
      if (project.category === 'video') {
        const badge = document.createElement('span');
        badge.className = 'video-badge';
        badge.textContent = '▶ VER VIDEO';
        frame.append(badge);
      }
      const meta = document.createElement('div');
      meta.className = 'project-meta';
      const name = document.createElement('h3');
      name.textContent = project.name;
      const category = document.createElement('span');
      category.className = 'mono';
      category.textContent = project.label;
      meta.append(name, category);
      button.append(frame, meta);
      button.addEventListener('click', () => openProject(project, button));
      article.append(button);
      grid.append(article);
    });
    count.textContent = `${Math.min(shown, matching.length)} DE ${matching.length} PROYECTOS`;
    moreButton.hidden = shown >= matching.length;
    filters.forEach(button => {
      const active = button.dataset.filter === activeFilter;
      button.classList.toggle('is-active', active);
      button.setAttribute('aria-pressed', String(active));
      button.querySelector('span').textContent = projects.filter(project => button.dataset.filter === 'all' || project.category === button.dataset.filter).length;
    });
  }
  filters.forEach(button => button.addEventListener('click', () => {
    activeFilter = button.dataset.filter;
    shown = 6;
    renderProjects();
  }));
  moreButton.addEventListener('click', () => {
    const firstNewIndex = shown;
    shown += 6;
    renderProjects();
    grid.children[firstNewIndex]?.querySelector('button').focus({preventScroll:true});
  });

  function clearMedia() {
    const video = mediaContainer.querySelector('video');
    if (video) { video.pause(); video.removeAttribute('src'); video.load(); }
    mediaContainer.replaceChildren();
  }
  function renderMedia() {
    clearMedia();
    const media = currentProject.media[currentMedia];
    const element = document.createElement(media.type === 'video' ? 'video' : 'img');
    if (media.type === 'video') {
      element.controls = true;
      element.playsInline = true;
      element.preload = 'metadata';
      element.poster = media.poster;
      element.setAttribute('aria-label', media.alt);
      element.append(document.createTextNode('Tu navegador no puede reproducir este video. Usa el enlace para abrir la pieza original.'));
    } else { element.alt = media.alt; }
    element.src = media.src;
    element.addEventListener('error', () => {
      const message = document.createElement('p');
      message.textContent = 'No se pudo cargar esta pieza. Puedes abrirla con el enlace a la pieza original.';
      mediaContainer.replaceChildren(message);
    }, {once:true});
    mediaContainer.append(element);
    document.querySelector('#media-counter').textContent = `${currentMedia + 1} / ${currentProject.media.length}`;
    document.querySelector('#media-navigation').hidden = currentProject.media.length < 2;
    document.querySelector('#original-media').href = media.src;
  }
  function openProject(project, trigger) {
    currentProject = project;
    currentMedia = 0;
    opener = trigger;
    document.querySelector('#dialog-title').textContent = project.name;
    document.querySelector('#dialog-description').textContent = project.description;
    document.querySelector('#dialog-category').textContent = project.label;
    renderMedia();
    dialog.showModal();
    document.body.classList.add('modal-open');
    dialog.scrollTop = 0;
    dialog.querySelector('.dialog-close').focus({preventScroll:true});
  }
  const changeMedia = direction => {
    currentMedia = (currentMedia + direction + currentProject.media.length) % currentProject.media.length;
    renderMedia();
  };
  document.querySelector('#previous-media').addEventListener('click', () => changeMedia(-1));
  document.querySelector('#next-media').addEventListener('click', () => changeMedia(1));
  dialog.querySelector('.dialog-close').addEventListener('click', () => dialog.close());
  dialog.addEventListener('click', event => {
    if (event.target !== dialog) return;
    const rect = dialog.getBoundingClientRect();
    if (event.clientX < rect.left || event.clientX > rect.right || event.clientY < rect.top || event.clientY > rect.bottom) dialog.close();
  });
  dialog.addEventListener('close', () => {
    clearMedia();
    document.body.classList.remove('modal-open');
    opener?.focus({preventScroll:true});
  });
  dialog.addEventListener('keydown', event => {
    if (event.target.tagName === 'VIDEO' || currentProject.media.length < 2) return;
    if (event.key === 'ArrowRight') {event.preventDefault();changeMedia(1);}
    if (event.key === 'ArrowLeft') {event.preventDefault();changeMedia(-1);}
  });
  renderProjects();
})();
