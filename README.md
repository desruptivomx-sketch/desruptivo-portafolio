# Desruptivo — Portafolio

Portafolio independiente de la web institucional de Desruptivo. Portada compacta con tres accesos y páginas de Marketing, Ingeniería y Multimedia. Diseño adaptable, galerías ampliadas y reproductor de video nativo.

## Contenido

- `index.html`: portada compacta, carrusel animado de disciplinas (Marketing, Multimedia, Ingeniería) y contacto.
- `marketing.html`: servicios de Campañas publicitarias (con galería de piezas), Activaciones y Consultoría comercial, cada uno con su espacio para proyectos.
- `ingenieria.html`: laboratorio interactivo (`engine.js`, motor de partículas en Canvas 2D sin librerías) y servicios de Desarrollo de apps, Diseño UX y UI, Automatización, Chatbots y CRM, con ejemplos ilustrativos y espacios para proyectos.
- `multimedia.html`: servicios de Video (con los cinco videos), Motion graphics, Diseño gráfico, Branding (con el caso propio Desruptivo) y Naming, cada uno con su espacio para proyectos.
- `styles.css`: diseño, fuentes, colores y comportamiento en móviles.
- `projects.js`: catálogo de 13 proyectos (8 de diseño y 5 audiovisuales).
- `app.js`: filtros, galería, menú y navegación por teclado.
- `assets/`: fuentes, marca, piezas y videos originales, alojados en este repositorio.

## Ver localmente

Abre `index.html` en un navegador, o ejecuta `python3 -m http.server 4173` y visita `http://localhost:4173`.

No requiere instalación de dependencias ni compilación.

## GitHub Pages

En Settings → Pages, selecciona **Deploy from a branch**, rama **main**, carpeta **/(root)**. Dirección prevista: https://desruptivomx-sketch.github.io/desruptivo-portafolio/.

Si cambias de dominio o nombre del repositorio, actualiza las direcciones absolutas de canonical y Open Graph en `index.html`.

## Agregar proyectos

1. Copia las imágenes a `assets/projects/` o los videos y sus portadas a `assets/videos/`.
2. Agrega un objeto a `window.DESRUPTIVO_PROJECTS` en `projects.js`. Usa `category: 'design'` o `category: 'video'` y una lista `media` con las piezas.
3. Los contadores se recalculan automáticamente. Cada galería presenta seis proyectos al inicio y permite cargar más. La portada solamente muestra los cuatro accesos a las disciplinas.

## Origen de los materiales

Recursos recuperados con autorización del titular desde [desruptivo-web](https://github.com/desruptivomx-sketch/desruptivo-web), revisión `768d95fb26dc25a86660639ca1dc3f5d1c596b98`. El repositorio institucional no se modifica.

Se reutilizan las familias Squid Boy, New Black, Monoglyphic y Casual Human; logotipo, mascota y estrella; las imágenes de proyectos y los cinco videos existentes. Los materiales conservan sus derechos originales y no se relicencian. Los nombres, servicios, ubicación y contactos provienen de esa web. Los textos de las piezas describen el material disponible y no atribuyen resultados comerciales.

## Accesibilidad y rendimiento

- Navegación por teclado, salto al contenido y foco visible.
- Diálogo nativo con cierre mediante Escape y devolución del foco.
- Menú móvil con estado accesible; filtros con `aria-pressed`.
- Imágenes con texto alternativo, carga diferida y espacios reservados.
- Videos bajo demanda, sin reproducción automática ni descarga previa en la galería.
- Preferencia de movimiento reducido respetada.
- Fuentes y medios locales; sin rastreadores ni servicios externos para cargar la página.
- Los videos se conservan como fueron proporcionados. No se han creado transcripciones ni subtítulos adicionales.
