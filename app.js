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
    if (grid.dataset.collection === 'design') return project.category === 'design';
    if (grid.dataset.collection === 'marketing') return project.category === 'video' || ['mcdonalds','boro','citron'].includes(project.id);
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
