/*
 * ASISTENTE DESRUPTIVO
 * Chatbot con base de conocimiento propia que corre completo en el navegador.
 * Detecta la intención del mensaje (palabras clave + tolerancia a errores de dedo),
 * recuerda el contexto de la conversación y pasa a WhatsApp con un resumen.
 */
(() => {
  const root = document.querySelector('.bot-live');
  if (!root) return;
  const log = root.querySelector('.bot-log');
  const form = root.querySelector('.bot-form');
  const input = root.querySelector('.bot-input');
  const chipsBox = root.querySelector('.bot-chips');
  const handoff = root.querySelector('.bot-handoff');
  const reduced = matchMedia('(prefers-reduced-motion:reduce)').matches;

  const WA = '529999064262';
  const memory = { name: '', topics: new Set(), last: null, turns: 0, misses: 0 };

  /* ---------- Base de conocimiento ---------- */
  const KB = [
    { id: 'saludo', topic: null, keys: ['hola', 'buenas', 'buenos dias', 'buenas tardes', 'buenas noches', 'que tal', 'hey', 'saludos', 'que onda'],
      answer: () => `¡Hola${memory.name ? ' ' + memory.name : ''}! ¿En qué te ayudo? Puedo contarte sobre nuestros servicios, cómo trabajamos o conectarte con el equipo.`,
      chips: ['¿Qué servicios tienen?', '¿Cómo trabajan?', 'Quiero cotizar'] },
    { id: 'servicios', topic: null, keys: ['servicios', 'que hacen', 'a que se dedican', 'que ofrecen', 'que hacen ustedes', 'disciplinas', 'agencia'],
      answer: 'Somos una agencia creativa integral en Mérida con tres áreas:\n\n• Marketing: campañas publicitarias, activaciones y consultoría comercial.\n• Multimedia: video, motion graphics, diseño gráfico, branding y naming.\n• Ingeniería: desarrollo de apps, diseño UX y UI, automatización, chatbots y CRM.\n\n¿Cuál te interesa?',
      chips: ['Marketing', 'Multimedia', 'Ingeniería'] },
    { id: 'marketing', topic: 'Marketing', keys: ['marketing', 'mercadotecnia', 'publicidad', 'redes sociales', 'pauta', 'anuncios', 'ads', 'meta ads', 'facebook', 'instagram', 'tiktok', 'google ads'],
      answer: 'En marketing hacemos tres cosas:\n\n• Campañas publicitarias: concepto, piezas y pauta en Meta, Google y TikTok, con medición de resultados.\n• Activaciones: eventos, punto de venta, sampling, stands y cobertura en foto y video.\n• Consultoría comercial: diagnóstico de cómo vende tu negocio y un plan para vender más.\n\nCada peso de pauta tiene que conectar con algo medible.',
      chips: ['Campañas', 'Activaciones', 'Consultoría comercial'] },
    { id: 'campanas', topic: 'Campañas publicitarias', keys: ['campana', 'campanas', 'campaña', 'lanzamiento', 'temporada', 'promocion'],
      answer: 'Una campaña con nosotros incluye la idea creativa, las piezas (redes, impresos, exteriores), la pauta en Meta, Google o TikTok y un reporte de resultados. Trabajamos lanzamientos, temporadas y promociones.',
      chips: ['¿Cuánto cuesta?', '¿Cuánto tardan?', 'Hablar con alguien'] },
    { id: 'activaciones', topic: 'Activaciones', keys: ['activacion', 'activaciones', 'evento', 'eventos', 'stand', 'sampling', 'degustacion', 'btl', 'punto de venta', 'pop'],
      answer: 'Las activaciones ponen a tu marca frente a la gente: eventos y lanzamientos, activaciones en punto de venta, sampling y degustaciones, stands y material POP. Además las cubrimos en foto y video para llevarlas a redes.',
      chips: ['Video', '¿Cuánto cuesta?', 'Hablar con alguien'] },
    { id: 'consultoria', topic: 'Consultoría comercial', keys: ['consultoria', 'consultor', 'ventas', 'vender mas', 'estrategia comercial', 'precios', 'embudo', 'capacitacion'],
      answer: 'La consultoría comercial va en tres pasos:\n\n1. Diagnóstico: revisamos oferta, precios, canales, equipo y números.\n2. Plan comercial: a quién venderle, con qué mensaje y por qué canal.\n3. Acompañamiento: implementamos contigo, capacitamos al equipo y ajustamos con resultados.',
      chips: ['CRM', 'Automatización', 'Hablar con alguien'] },
    { id: 'multimedia', topic: 'Multimedia', keys: ['multimedia', 'audiovisual', 'produccion'],
      answer: 'En multimedia hacemos video, motion graphics, diseño gráfico, branding y naming. Del guion a la edición final, y de la idea del nombre al manual de marca.',
      chips: ['Video', 'Branding', 'Naming'] },
    { id: 'video', topic: 'Video', keys: ['video', 'videos', 'grabacion', 'grabar', 'reel', 'reels', 'comercial', 'edicion', 'recorrido', 'dron', 'fotografia', 'fotos'],
      answer: 'Hacemos comerciales y videos promocionales, reels y contenido vertical, recorridos inmobiliarios y de sucursal, con guion, grabación, edición, color y sonido. Llevamos más de 60 horas de grabación.',
      chips: ['Motion graphics', '¿Cuánto tardan?', 'Ver videos'] },
    { id: 'motion', topic: 'Motion graphics', keys: ['motion', 'animacion', 'animar', 'animado', 'explainer', 'logo animado'],
      answer: 'En motion graphics animamos logotipos, gráficos para redes, videos explicativos, tipografía cinética, intros, cortinillas y subtítulos.',
      chips: ['Video', 'Branding', 'Hablar con alguien'] },
    { id: 'diseno', topic: 'Diseño gráfico', keys: ['diseno grafico', 'diseno', 'disenar', 'grafico', 'post', 'posts', 'flyer', 'empaque', 'etiqueta', 'senaletica', 'presentacion', 'editorial'],
      answer: 'Diseñamos piezas para redes, editorial e impresos, empaque y etiquetas, señalética y rótulos, y presentaciones corporativas. Piezas que se entienden a la primera y se reconocen de lejos.',
      chips: ['Branding', 'Campañas', 'Hablar con alguien'] },
    { id: 'branding', topic: 'Branding', keys: ['branding', 'marca', 'identidad', 'logo', 'logotipo', 'manual de marca', 'imagen corporativa', 'rebranding'],
      answer: 'En branding construimos la estrategia y posicionamiento, la identidad visual y el logotipo, la paleta, las tipografías, la voz de la marca y el manual. Identidades que no piden permiso y que aguantan en el rótulo, el story y el empaque.',
      chips: ['Naming', '¿Cuánto tardan?', 'Hablar con alguien'] },
    { id: 'naming', topic: 'Naming', keys: ['naming', 'nombre', 'nombre de marca', 'eslogan', 'slogan', 'tagline', 'impi', 'registro'],
      answer: 'Para naming exploramos opciones de nombre, revisamos disponibilidad de dominio y redes, hacemos una búsqueda fonética previa ante el IMPI y proponemos eslogan. Te presentamos cada propuesta con argumentos.',
      chips: ['Branding', 'Hablar con alguien'] },
    { id: 'ingenieria', topic: 'Ingeniería', keys: ['ingenieria', 'tecnologia', 'software', 'programacion', 'programar', 'desarrollo', 'sistema', 'digital'],
      answer: 'En ingeniería desarrollamos apps y sitios, diseñamos experiencias UX y UI, automatizamos procesos, creamos chatbots como este e implementamos CRM. Código sólido y rendimiento real.',
      chips: ['Apps', 'Automatización', 'CRM'] },
    { id: 'apps', topic: 'Desarrollo de apps', keys: ['app', 'apps', 'aplicacion', 'aplicaciones', 'movil', 'ios', 'android', 'pagina web', 'sitio web', 'web', 'landing', 'tienda en linea', 'ecommerce', 'e-commerce', 'shopify'],
      answer: 'Desarrollamos apps móviles para iOS y Android, aplicaciones web a la medida, sitios y landing pages, y tiendas en línea. También les damos mantenimiento y soporte.',
      chips: ['Diseño UX y UI', '¿Cuánto tardan?', 'Hablar con alguien'] },
    { id: 'uxui', topic: 'Diseño UX y UI', keys: ['ux', 'ui', 'ux ui', 'experiencia de usuario', 'interfaz', 'interfaces', 'usabilidad', 'wireframe', 'prototipo', 'figma'],
      answer: 'En UX y UI investigamos a tus usuarios, ordenamos la información en wireframes, diseñamos la interfaz, prototipamos y probamos con personas reales antes de programar. El Breakout de más arriba es un ejemplo: se entiende sin instrucciones.',
      chips: ['Apps', 'Hablar con alguien'] },
    { id: 'automatizacion', topic: 'Automatización', keys: ['automatizar', 'automatizacion', 'automatico', 'zapier', 'make', 'n8n', 'integracion', 'integraciones', 'api', 'excel', 'reportes', 'flujo', 'flujos'],
      answer: 'Automatizamos lo repetitivo: flujos entre formularios, correo y hojas de cálculo, ventas, cobranza y seguimiento, reportes automáticos e integraciones con APIs. Usamos herramientas como Zapier, Make y n8n.',
      chips: ['CRM', 'Chatbots', 'Hablar con alguien'] },
    { id: 'chatbots', topic: 'Chatbots', keys: ['chatbot', 'chatbots', 'bot', 'bots', 'whatsapp business', 'asistente', 'inteligencia artificial', 'ia', 'ai', 'messenger', 'respuestas automaticas'],
      answer: 'Hacemos chatbots para WhatsApp, Messenger e Instagram, asistentes con inteligencia artificial, agenda de citas y respuestas automáticas, con paso a un asesor humano cuando hace falta. Este chat es una muestra pequeña: para tu negocio lo conectamos a IA, a tu WhatsApp y a tu CRM.',
      chips: ['¿Tú eres una IA?', 'CRM', 'Hablar con alguien'] },
    { id: 'crm', topic: 'CRM', keys: ['crm', 'clientes', 'prospectos', 'leads', 'seguimiento', 'hubspot', 'salesforce', 'pipeline', 'embudo de ventas'],
      answer: 'Implementamos y configuramos tu CRM, armamos el embudo de ventas por etapas, migramos tus contactos, lo integramos con WhatsApp, correo y redes, y capacitamos a tu equipo. Así sabes quién está por comprar y nadie se queda sin seguimiento.',
      chips: ['Automatización', 'Consultoría comercial', 'Hablar con alguien'] },
    { id: 'precio', topic: null, keys: ['precio', 'precios', 'costo', 'costos', 'cuesta', 'cuanto cuesta', 'cuanto cobran', 'cotizar', 'cotizacion', 'presupuesto', 'tarifa', 'caro', 'barato', 'inversion'],
      answer: () => `Cada proyecto se cotiza a la medida${memory.last && memory.last.topic ? ', y ' + memory.last.topic.toLowerCase() + ' no es la excepción' : ''}. Así funciona:\n\n1. Llamada de arranque gratis, de unos 30 minutos.\n2. Propuesta por escrito en 2 a 3 días: qué entra, qué no, cuánto tarda y cuánto cuesta. Sin partidas vagas.\n\nSi nos compartes un rango de presupuesto, te proponemos el alcance correcto.`,
      chips: ['Quiero cotizar', '¿Cómo trabajan?'] },
    { id: 'tiempo', topic: null, keys: ['cuanto tardan', 'tiempo', 'tiempos', 'cuando', 'plazo', 'entrega', 'rapido', 'urgente', 'dias', 'semanas'],
      answer: 'Depende del alcance, y lo dejamos por escrito en la propuesta antes de empezar. Lo que sí es fijo: la llamada de arranque dura unos 30 minutos y la propuesta te llega en 2 a 3 días. Si algo cambia en el camino, se vuelve a cotizar y lo sabes antes.',
      chips: ['¿Cómo trabajan?', 'Quiero cotizar'] },
    { id: 'proceso', topic: null, keys: ['como trabajan', 'proceso', 'metodologia', 'pasos', 'como funciona', 'como empiezo', 'empezar', 'arrancar'],
      answer: 'Trabajamos en cinco pasos:\n\n1. Llamada de arranque (30 min, gratis).\n2. Propuesta y alcance (2 a 3 días).\n3. Dirección creativa: definimos la idea que sostiene todo.\n4. Producción: diseño, código, cámara y edición con el mismo equipo.\n5. Entrega y medición: archivos abiertos y números.\n\nPara arrancar ayuda que haya una persona que decida, un objetivo claro y lo que ya tengas (logos, fotos, accesos).',
      chips: ['Quiero cotizar', 'Contacto'] },
    { id: 'contacto', topic: null, keys: ['contacto', 'contactar', 'telefono', 'numero', 'celular', 'whatsapp', 'correo', 'email', 'mail', 'llamar', 'escribir', 'instagram', 'redes'],
      answer: 'Aquí nos encuentras:\n\n• WhatsApp: +52 999 906 4262\n• Correo: desruptivo@outlook.com\n• Instagram: @desruptivo_mx\n\nSi quieres, te paso directo a WhatsApp con un resumen de lo que platicamos.',
      chips: ['Hablar con alguien'], handoff: true },
    { id: 'ubicacion', topic: null, keys: ['donde estan', 'ubicacion', 'direccion', 'oficina', 'merida', 'yucatan', 'ciudad', 'donde'],
      answer: 'Estamos en Mérida, Yucatán. Trabajamos con negocios locales y con marcas globales que necesitan que su comunicación aterrice en el sureste.',
      chips: ['¿Con quién han trabajado?', 'Contacto'] },
    { id: 'clientes', topic: null, keys: ['clientes', 'con quien han trabajado', 'marcas', 'portafolio', 'experiencia', 'casos', 'trabajos', 'referencias', 'mcdonalds'],
      answer: 'Hemos trabajado con más de 30 marcas, entre ellas McDonald’s México, Grupo Gia, Archipiélago, Levels Dermatology, Picking Express, Boro, Bajel, Cósmicos Pet Bakery, Industrias Carrera y A Lavar. Puedes ver piezas en las secciones de Marketing y Multimedia.',
      chips: ['Ver videos', '¿Qué servicios tienen?'] },
    { id: 'nosotros', topic: null, keys: ['quienes son', 'quien es desruptivo', 'desruptivo', 'nosotros', 'equipo', 'anos', 'trayectoria', 'filosofia', 'valores'],
      answer: 'Desruptivo es una agencia creativa integral con 3 años de trayectoria. Nuestra idea: no hay una sola manera de hacer las cosas. Un solo equipo lleva marketing, multimedia e ingeniería con la misma dirección creativa, sin traducir el brief tres veces. No hacemos marcas seguras: hacemos marcas que se notan.',
      chips: ['¿Qué servicios tienen?', '¿Cómo trabajan?'] },
    { id: 'horario', topic: null, keys: ['horario', 'horarios', 'abren', 'atienden', '24/7', 'fin de semana', 'sabado', 'domingo'],
      answer: 'Tenemos atención 24/7 por WhatsApp. Si escribes fuera de horario de oficina, te respondemos en cuanto el equipo lo vea.',
      chips: ['Contacto'] },
    { id: 'humano', topic: null, keys: ['hablar con alguien', 'humano', 'persona', 'asesor', 'agente', 'ejecutivo', 'quiero cotizar', 'contratar', 'me interesa', 'agendar', 'cita', 'llamada'],
      answer: () => `¡Va! Te conecto con el equipo por WhatsApp${memory.topics.size ? ' con un resumen de lo que te interesa (' + [...memory.topics].join(', ') + ')' : ''}. Toca el botón verde de abajo y el mensaje ya va escrito.`,
      chips: [], handoff: true },
    { id: 'bot', topic: null, keys: ['eres una ia', 'eres ia', 'eres un bot', 'eres real', 'eres humano', 'chatgpt', 'robot', 'como funcionas', 'tu eres'],
      answer: 'Soy un asistente con una base de conocimiento de Desruptivo y corro completo en tu navegador: detecto de qué me hablas, recuerdo el contexto y, cuando lo necesitas, te paso con una persona. Para tu negocio podemos conectarlo a inteligencia artificial, a tu WhatsApp y a tu CRM.',
      chips: ['Chatbots', 'Hablar con alguien'] },
    { id: 'juego', topic: null, keys: ['juego', 'breakout', 'jugar', 'record', 'ladrillos'],
      answer: 'El Breakout de más arriba lo diseñamos y programamos desde cero: física, sonido y niveles, sin librerías. Es nuestra forma de mostrar UX y UI en acción. ¿Ya superaste el nivel 3?',
      chips: ['Diseño UX y UI', 'Apps'] },
    { id: 'gracias', topic: null, keys: ['gracias', 'muchas gracias', 'mil gracias', 'excelente', 'perfecto', 'genial', 'buenisimo', 'chido', 'va', 'ok', 'vale'],
      answer: () => `¡Con gusto${memory.name ? ', ' + memory.name : ''}! ¿Algo más en lo que te ayude?`,
      chips: ['Hablar con alguien', '¿Qué servicios tienen?'] },
    { id: 'adios', topic: null, keys: ['adios', 'bye', 'hasta luego', 'nos vemos', 'chao', 'eso es todo'],
      answer: 'Gracias por escribir. Cuando quieras romper el molde, aquí estamos. ✳',
      chips: [] },
    { id: 'pago', topic: null, keys: ['pago', 'pagos', 'formas de pago', 'tarjeta', 'transferencia', 'factura', 'facturan', 'anticipo', 'meses'],
      answer: 'Los detalles de pago y facturación los ve directamente el equipo contigo al armar la propuesta. ¿Te conecto con ellos?',
      chips: ['Hablar con alguien'] }
  ];

  const ALIASES = { 'Ver videos': 'video', 'Campañas': 'campanas', 'Apps': 'apps', 'Contacto': 'contacto' };

  /* ---------- Motor de intención ---------- */
  const norm = s => s.toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g, '').replace(/[^a-z0-9ñ/\s]/g, ' ').replace(/\s+/g, ' ').trim();
  function lev(a, b) {
    if (Math.abs(a.length - b.length) > 1) return 2;
    const m = a.length, n = b.length, d = Array.from({ length: m + 1 }, (_, i) => [i]);
    for (let j = 1; j <= n; j++) d[0][j] = j;
    for (let i = 1; i <= m; i++) for (let j = 1; j <= n; j++) d[i][j] = Math.min(d[i - 1][j] + 1, d[i][j - 1] + 1, d[i - 1][j - 1] + (a[i - 1] === b[j - 1] ? 0 : 1));
    return d[m][n];
  }
  KB.forEach(item => { item.nkeys = item.keys.map(norm); });

  function classify(text) {
    const t = norm(text), words = t.split(' ');
    let best = null, bestScore = 0;
    for (const item of KB) {
      let score = 0;
      for (const k of item.nkeys) {
        if (k.includes(' ')) { if (t.includes(k)) score += 2 + k.split(' ').length; }
        else if (words.includes(k)) score += k.length > 3 ? 2 : 1.2;
        else if (k.length >= 5 && words.some(w => w.length >= 4 && lev(w, k) <= 1)) score += 1.4;
      }
      if (score > bestScore) { bestScore = score; best = item; }
    }
    return bestScore >= 1.2 ? best : null;
  }

  /* ---------- Interfaz ---------- */
  function addMessage(who, text) {
    const li = document.createElement('li');
    li.className = `bot-msg bot-${who}`;
    li.textContent = text;
    log.append(li);
    // Las respuestas largas se muestran desde su inicio.
    log.scrollTop = who === 'out' ? Math.max(0, li.offsetTop - log.offsetTop - 12) : log.scrollHeight;
    return li;
  }
  function setChips(list) {
    chipsBox.innerHTML = '';
    list.forEach(label => {
      const b = document.createElement('button');
      b.type = 'button'; b.className = 'bot-chip'; b.textContent = label;
      b.addEventListener('click', () => send(label));
      chipsBox.append(b);
    });
  }
  function updateHandoff(show) {
    const lines = ['Hola Desruptivo, vengo del asistente del portafolio.'];
    if (memory.name) lines.push(`Soy ${memory.name}.`);
    if (memory.topics.size) lines.push(`Me interesa: ${[...memory.topics].join(', ')}.`);
    lines.push('¿Podemos platicar?');
    handoff.href = `https://wa.me/${WA}?text=${encodeURIComponent(lines.join(' '))}`;
    if (show) handoff.hidden = false;
  }
  let busy = false;
  function reply(text, chips, showHandoff) {
    const typing = document.createElement('li');
    typing.className = 'bot-msg bot-out bot-typing';
    typing.setAttribute('aria-label', 'El asistente está escribiendo');
    typing.innerHTML = '<span></span><span></span><span></span>';
    log.append(typing); log.scrollTop = log.scrollHeight;
    const delay = reduced ? 0 : Math.min(1400, 450 + text.length * 6);
    busy = true;
    setTimeout(() => {
      typing.remove();
      addMessage('out', text);
      setChips(chips || []);
      updateHandoff(showHandoff);
      busy = false;
    }, delay);
  }

  function respond(raw) {
    memory.turns++;
    const nameMatch = raw.match(/\b(?:me llamo|mi nombre es|soy)\s+([a-záéíóúñ]{2,20})/i);
    if (nameMatch && !/^(de|un|una|el|la|del|muy|dueno|dueño|duena|dueña|gerente|nuevo|nueva|cliente|parte|yo|tu)$/i.test(nameMatch[1])) {
      memory.name = nameMatch[1][0].toUpperCase() + nameMatch[1].slice(1).toLowerCase();
      const rest = raw.replace(nameMatch[0], '').trim();
      if (!classify(rest)) return reply(`¡Mucho gusto, ${memory.name}! ¿Qué te gustaría saber de Desruptivo?`, ['¿Qué servicios tienen?', 'Quiero cotizar']);
    }
    const bare = raw.trim().replace(/[.!]+$/, '');
    if (memory.turns === 1 && !memory.name && /^[a-záéíóúñ]{2,20}$/i.test(bare) && !classify(bare)) {
      memory.name = bare[0].toUpperCase() + bare.slice(1).toLowerCase();
      return reply(`¡Mucho gusto, ${memory.name}! ¿Qué te gustaría saber de Desruptivo?`, ['¿Qué servicios tienen?', '¿Cuánto cuesta?', '¿Cómo trabajan?']);
    }
    const item = (ALIASES[raw] && KB.find(k => k.id === ALIASES[raw])) || classify(raw);
    if (!item) {
      memory.misses++;
      const text = memory.misses > 1
        ? 'Esa no me la sé, y prefiero no inventarte nada. Mejor te paso con el equipo por WhatsApp para que te respondan en persona.'
        : 'Mmm, no estoy seguro de haberte entendido. Puedo contarte de nuestros servicios, precios, tiempos, cómo trabajamos o conectarte con alguien del equipo.';
      return reply(text, ['¿Qué servicios tienen?', '¿Cuánto cuesta?', 'Hablar con alguien'], memory.misses > 1);
    }
    memory.misses = 0;
    if (item.topic) memory.topics.add(item.topic);
    const text = typeof item.answer === 'function' ? item.answer() : item.answer;
    if (item.topic || !memory.last) memory.last = item;
    reply(text, item.chips, item.handoff || memory.topics.size >= 2);
  }

  function send(text) {
    text = text.trim();
    if (!text || busy) return;
    addMessage('in', text);
    input.value = '';
    setChips([]);
    respond(text);
  }

  form.addEventListener('submit', e => { e.preventDefault(); send(input.value); });
  updateHandoff(false);
  setChips(['¿Qué servicios tienen?', '¿Cuánto cuesta?', '¿Tú eres una IA?']);
})();
