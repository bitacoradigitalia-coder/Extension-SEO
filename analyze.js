// Reconstruido: el ZIP recibido no incluía el motor de análisis.
// Las puntuaciones son orientativas y no reproducen una métrica de Google.
function scoreChecks(items) { const assessed = items.filter(c => c.status !== 'info'); return assessed.length ? Math.round(100 * assessed.filter(c => c.status === 'pass').length / assessed.length) : null; }
function buildReport(d) {
  let previous = 0;
  d.headings.forEach(h => {
    h.flag = !h.text ? 'Encabezado vacío' : previous && h.level > previous + 1 ? 'Salto de nivel' : '';
    previous = h.level;
  });
  const check = (area, id, label, ok, detail, tip, uncertain = false, fallback = 'warn') => ({area, id, label, status: ok ? 'pass' : uncertain ? fallback : 'fail', detail, tip});
  const seo = (id, label, ok, detail, tip, uncertain) => check('SEO', id, label, ok, detail, tip, uncertain);
  const h1 = d.headings.filter(h => h.level === 1).length;
  const lengthGuide = (value, min, max) => {
    const n = value.length;
    const state = !n ? 'No se ha encontrado.' : n < min ? 'Por debajo del rango orientativo.' : n > max ? 'Por encima del rango orientativo; podría recortarse al mostrarse.' : 'Dentro del rango orientativo.';
    return n + ' caracteres · Orientación: ' + min + '–' + max + '. ' + state + ' No es un límite obligatorio: la visualización depende del ancho del texto y del dispositivo.';
  };
  const checks = [
    seo('title', 'Título SEO', !!d.title, lengthGuide(d.title, 30, 60), 'Añade un título descriptivo y específico. Como orientación, usa 30–60 caracteres sin sacrificar claridad.'),
    seo('description', 'Meta descripción', !!d.description, lengthGuide(d.description, 120, 160), 'Resume la propuesta de esta página. Como orientación, usa 120–160 caracteres sin rellenar texto.', true),
    seo('canonical', 'URL canónica', !!d.canonical, d.canonical || 'No declarada.', 'Revisa si necesita una URL canónica.', true),
    seo('canonical-self', 'Canonical apunta a esta página', !d.canonical || d.canonicalMatches, d.canonical ? (d.canonicalMatches ? 'La canonical apunta a esta página.' : 'Canonical declarada: ' + d.canonical) : 'No hay canonical declarada.', 'Comprueba si la canónica declarada es la correcta.', true),
    {area:'SEO', id:'hreflang', label:'Versiones por idioma', status:d.hreflang > 0 ? 'pass' : 'info', detail:d.hreflang > 0 ? d.hreflang + ' alternates hreflang detectados.' : 'No se detectan hreflang. No se puede determinar si la web ofrece otras versiones lingüísticas.', tip:'Declara alternates hreflang si la web tiene versiones en varios idiomas.'},
    seo('lang', 'Idioma', !!d.lang, d.lang || 'No declarado.', 'Declara el idioma del documento.'),
    seo('viewport', 'Adaptación a móvil', d.viewport, d.viewport ? 'Meta viewport presente; no verifica el diseño móvil.' : 'Meta viewport ausente.', 'Añade una meta viewport.'),
    seo('indexable', 'Indexación declarada', !d.noindex, d.noindex ? 'Meta robots contiene noindex.' : 'No se detecta noindex en las metas; robots.txt y cabeceras no comprobados.', 'Comprueba si la exclusión es intencionada.', true),
    seo('https', 'Conexión HTTPS', d.protocol === 'https:', d.protocol, 'Activa el certificado SSL del dominio y redirige las URLs HTTP a HTTPS.'),
    seo('social', 'Vista previa al compartir', !!(d.og.title && d.og.description && d.og.image), 'og:title ' + (d.og.title ? '\u2713' : '\u2717') + ' \u00b7 og:description ' + (d.og.description ? '\u2713' : '\u2717') + ' \u00b7 og:image ' + (d.og.image ? '\u2713' : '\u2717') + (d.twitter.card ? ' \u00b7 twitter:card: ' + d.twitter.card : ''), 'Completa las etiquetas Open Graph y Twitter Cards si las necesitas.', true),
    seo('mixed-content', 'Recursos con contenido mixto', d.mixed === 0, d.mixed + ' recursos cargados por HTTP en página HTTPS.', 'Sirve todos los recursos por HTTPS.'),
    seo('schema', 'Datos estructurados', d.schema.types.length > 0 && !d.schema.invalid, d.schema.types.join(', ') || 'No se detecta JSON-LD.', 'Revisa los datos estructurados apropiados para el negocio.', true),
    seo('h1', 'Encabezado H1', h1 === 1, h1 + ' H1 encontrados; varios H1 no implican por sí solos una penalización.', 'Revisa el encabezado principal y la organización del contenido.', true),
    seo('hierarchy', 'Jerarquía H1–H6', d.headings.length > 0 && !d.headings.some(h => h.flag), d.headings.length + ' encabezados.', 'Revisa encabezados vacíos y saltos de nivel.', true),
    seo('alt', 'Texto alternativo de imágenes', d.images.noAlt === 0, d.images.noAlt + ' imágenes sin atributo alt. Un alt vacío puede ser correcto en imágenes decorativas.', 'Describe las imágenes informativas y usa alt vacío en las decorativas.'),
    seo('img-lazy', 'Carga diferida de imágenes', d.images.total <= 2 || d.images.lazy >= d.images.total - 3, d.images.lazy + ' de ' + d.images.total + ' con carga diferida.', 'Añade loading="lazy" a las imágenes secundarias bajo el primer pantallazo.', true),
    seo('img-dim', 'Dimensiones de imágenes', d.images.missingDimensions === 0, d.images.missingDimensions === 0 ? 'Todas declaran dimensiones explícitas.' : d.images.missingDimensions + ' de ' + d.images.total + ' imágenes sin width/height.', 'Declara width y height en las etiquetas img para evitar saltos de diseño (CLS).', true),
    seo('perf', 'Respuesta del servidor y scripts', !d.performance || !d.performance.ttfb || d.performance.ttfb < 800, (d.performance && d.performance.ttfb ? d.performance.ttfb + ' ms TTFB.' : 'Medición local.') + (d.performance && d.performance.renderBlockingScripts > 0 ? ' ' + d.performance.renderBlockingScripts + ' scripts bloqueantes en <head>.' : ''), 'Difiere scripts con defer, async o type="module" y optimiza el tiempo de respuesta.', true),
    seo('length', 'Contenido principal', d.words > 0, d.words + ' palabras. No existe un mínimo universal para posicionar.', 'Comprueba si responde a la intención de búsqueda.', true),
    seo('internal', 'Enlaces internos', d.links.internal > 0, d.links.internal + ' enlaces internos.', 'Conecta las páginas relacionadas.', true),
    seo('anchors', 'Texto de enlaces', d.links.emptyAnchors + d.links.genericAnchors === 0, (d.links.emptyAnchors + d.links.genericAnchors) + ' enlaces con texto vacío o genérico.', 'Usa textos que expliquen el destino.', true) ,
    check('SEO', 'robots-txt', 'Directivas de robots.txt', !!d.robotsTxt && !d.robotsTxt.blocked, d.robotsTxt ? (d.robotsTxt.blocked ? 'robots.txt podría bloquear esta ruta para ' + d.robotsTxt.agents.join(', ') + '.' : 'No se detecta una regla de bloqueo aplicable.') : 'No se pudo leer robots.txt desde el navegador.', 'Comprueba las reglas y el comportamiento del servidor.', true, d.robotsTxt ? 'warn' : 'info'),
    seo('url', 'Estructura de URL', d.path.length <= 100 && !/[A-Z_]/.test(d.path), d.path.length + ' caracteres de ruta; ' + d.path.split('/').filter(Boolean).length + ' niveles.' + (d.hasQuery ? ' Incluye parámetros.' : ''), 'Usa rutas legibles y estables; los parámetros no son un fallo por sí solos.', true),
    seo('schema-json', 'Sintaxis de JSON-LD', d.schema.invalid === 0, d.schema.invalid ? d.schema.invalid + ' bloques JSON-LD no se pueden interpretar.' : d.schema.types.length ? 'JSON interpretable; no se validan sus propiedades contra Schema.org.' : 'No se detecta JSON-LD; no todas las páginas lo necesitan.', 'Corrige la sintaxis y confirma que los datos coinciden con el contenido.', true),
    seo('favicon', 'Icono del sitio', d.favicon, d.favicon ? 'Se detecta un icono declarado.' : 'No se detecta link rel=icon.', 'Declara un icono adecuado para el sitio.', true),
    seo('a11y-names', 'Nombres accesibles en controles', d.accessibility && d.accessibility.unnamedControls === 0, d.accessibility ? d.accessibility.unnamedControls + ' controles sin nombre accesible evidente; comprobación parcial.' : 'No disponible.', 'Añade etiquetas o nombres accesibles a botones y campos.', true),
    check('SEO', 'llms-txt', 'Archivo llms.txt', !!d.llmsTxt, d.llmsTxt ? 'Se encontro llms.txt en la raiz.' : 'No se encontro llms.txt; es una convencion emergente, no un requisito de indexacion.', 'Anadelo solo si mantienes una version util y actualizada para lectores automatizados.', true, 'info'),
    check('SEO', 'webmcp', 'Senales WebMCP', !!d.webmcp, d.webmcp ? 'Se detectan marcadores WebMCP.' : 'No se detectan marcadores; su ausencia no afecta al SEO clasico.', 'Expone acciones estructuradas solo si el sitio ofrece flujos interactivos.', true, 'info')
  ];
  const recommendations = {
    'first-person': 'Si describes un servicio propio, explica cómo lo realizáis con detalles verificables. Añadir «nosotros» por sí solo no mejora la calidad.',
    cases: 'Añade un caso real: situación inicial, trabajo realizado y resultado comprobable. Usa imágenes propias con permiso y evita inventar resultados.',
    media: 'Incluye fotos propias del equipo, instalaciones o proceso cuando ayuden a entender el servicio. Añade textos alternativos descriptivos.',
    credentials: 'Presenta al profesional responsable, su especialidad y credenciales comprobables. Para una clínica, muestra el número de colegiado si corresponde.',
    author: 'En artículos o contenidos especializados, identifica al autor y enlaza su perfil profesional. Si ya figura en metadatos, comprueba que también sea visible.',
    depth: 'Responde a las dudas de la persona que visita esta página: qué ofreces, a quién, cómo funciona y cuál es el siguiente paso. No rellenes texto para sumar palabras.',
    press: 'Si existen premios, acreditaciones o menciones de prensa, muestra cuáles son y enlaza la fuente original. Si no existen, este punto puede no aplicar.',
    sources: 'Enlaza fuentes originales junto a afirmaciones técnicas o datos que lo necesiten. En una página comercial sin esas afirmaciones, puede no aplicar.',
    social: 'Si el negocio tiene perfiles activos, enlázalos con nombres claros. Comprueba que pertenezcan al negocio; no crees perfiles solo para superar el chequeo.',
    reviews: 'Muestra testimonios auténticos con su fuente y fecha cuando sea posible. Enlaza las reseñas originales; no inventes opiniones ni valoraciones.',
    contact: 'Haz visible un teléfono con enlace tel:, un email con mailto: o una página de contacto accesible. Comprueba que funcionan.',
    address: 'Si atiendes presencialmente, muestra la dirección completa, coherente con la ficha de Google. Puedes usar <address> y datos estructurados del negocio.',
    legal: 'Comprueba que existan enlaces accesibles a privacidad y aviso legal con los datos del titular. Su presencia no verifica el contenido ni el cumplimiento legal.',
    about: 'Añade un enlace a una página de equipo o sobre el negocio, con responsables, fotos propias y trayectoria comprobable.',
    dates: 'En artículos que dependen de información actual, muestra publicación y actualización con <time datetime="AAAA-MM-DD">. No inventes fechas recientes; en otras páginas puede no aplicar.',
    'org-schema': 'Añade JSON-LD apropiado (por ejemplo Organization o LocalBusiness), coherente con los datos visibles, y valídalo. No añadas valoraciones inventadas.',
    https: 'Activa el certificado SSL del dominio, redirige HTTP a HTTPS y revisa los recursos que se cargan con HTTP.'
  };
  const ee = (id, label, ok, detail) => check('E-E-A-T', id, label, ok, detail, recommendations[id], true);
  const pillars = [
    {name:'Experiencia', en:'Experience', checks:[
      ee('first-person','Primera persona',d.firstPerson > 0,d.firstPerson + ' coincidencias; no prueban experiencia real.'),
      ee('cases','Casos y resultados',d.caseHits > 0,d.caseHits + ' menciones detectadas.'),
      ee('media','Imágenes y vídeo',d.contentImages + d.videos > 0,(d.contentImages + d.videos) + ' elementos; no se verifica su autenticidad.')]},
    {name:'Pericia', en:'Expertise', checks:[
      ee('credentials','Credenciales y experiencia',d.credentialHits > 0,d.credentialHits + ' menciones; no se verifican credenciales.'),
      ee('author','Autor',!!(d.author || d.schema.hasAuthor),d.author || (d.schema.hasAuthor ? 'Autor en JSON-LD.' : 'No detectado.')),
      ee('depth','Contenido',d.words > 0,d.words + ' palabras; profundidad pendiente de revisión humana.')]},
    {name:'Autoridad', en:'Authoritativeness', checks:[
      ee('press','Premios y prensa',d.awardHits > 0,d.awardHits + ' menciones detectadas.'),
      ee('sources','Fuentes externas',d.citations > 0,d.citations + ' enlaces externos, de los cuales ' + d.authCitations + ' a dominios de autoridad (.gov/.edu, entre otros); enlazar no garantiza autoridad.'),
      ee('social','Perfiles sociales',d.social.length > 0,d.social.join(', ') || 'No detectados.')]},
    {name:'Confianza', en:'Trust', checks:[
      ee('reviews','Reseñas y testimonios',d.reviewHits > 0 || d.schema.hasReview,d.reviewHits + ' menciones; autenticidad no verificada.'),
      ee('contact','Formas de contacto',!!(d.contact.tel || d.contact.mail || d.contact.page),'Teléfono, email o enlace de contacto.'),
      ee('address','Dirección',d.contact.address,'Puede proceder de texto, address o JSON-LD.'),
      ee('legal','Páginas legales',d.legal.privacy && d.legal.terms,'Se buscan enlaces de privacidad y aviso legal.'),
      ee('about','Sobre nosotros o equipo',d.aboutLink,'Se buscan enlaces sobre el negocio o equipo.'),
      ee('dates','Fechas',d.published || d.modified,'Pueden estar visibles o solo en metadatos.'),
      ee('org-schema','Datos estructurados',d.schema.types.length > 0,d.schema.types.join(', ') || 'No detectados.'),
      ee('https','Conexión segura',d.protocol === 'https:',d.protocol)]}
  ];
  const score = scoreChecks;
  pillars.forEach(p => p.score = score(p.checks));
  const eeChecks = pillars.flatMap(p => p.checks);
  const local = [
    check('LOCAL', 'business-schema', d.local.businessSchema, d.local.businessSchema ? 'Se detecta un tipo de negocio u organización en JSON-LD.' : 'No se detectan tipos de negocio local en JSON-LD.', 'Añade datos estructurados solo si describen información visible y real.', true),
    check('LOCAL', 'address', d.local.hasAddress, d.local.hasAddress ? 'Se detecta dirección en la página o en JSON-LD.' : 'No se detecta dirección.', 'Si atiendes presencialmente, muestra una dirección actual y coherente con tu ficha.', true),
    check('LOCAL', 'phone', d.local.hasPhone, d.local.hasPhone ? d.contact.tel + ' enlaces telefónicos.' : 'No se detecta enlace telefónico.', 'Muestra un teléfono de contacto y comprueba que el enlace tel: funciona.', true),
    check('LOCAL', 'map', d.local.mapEmbed || d.local.gbpLink, d.local.mapEmbed ? 'Se detecta un mapa embebido.' : d.local.gbpLink ? 'Se detecta un enlace a Google Maps o ficha de Google.' : 'No se detecta mapa ni enlace a Google Maps.', 'Añade un mapa o enlace a la ficha solo si ayuda a encontrar el negocio.', true),
    check('LOCAL', 'nap', d.local.napVisible, d.local.napVisible ? 'Se detectan dirección y teléfono visibles; su coherencia entre plataformas no se verifica.' : 'No se detectan juntos dirección y teléfono visibles.', 'Mantén nombre, dirección y teléfono coherentes; esta extensión solo comprueba señales de esta página.', true),
    check('LOCAL', 'booking', d.local.reservaLink, d.local.reservaLink ? 'Se detecta un enlace o botón de reserva, cita o agenda.' : 'No se detecta un acceso a reservas o citas.', 'Si el negocio trabaja con citas, facilita un enlace de reserva que funcione.', true)
  ];
  const geo = buildGeoReport(d);
  const groups = [
    ['Rastreo e indexación', ['indexable','robots-txt']], ['URL', ['url','canonical','canonical-self']],
    ['SEO on-page', ['title','description','h1','hierarchy','lang','social','favicon']], ['Contenido', ['length','anchors']],
    ['Schema.org', ['schema','schema-json']], ['Rendimiento', ['perf','mixed-content','img-lazy','img-dim']],
    ['Móvil y accesibilidad', ['viewport','a11y-names']], ['E-E-A-T', []],
    ['SEO internacional', ['lang','hreflang']], ['SEO para IA', ['llms-txt','webmcp']]
  ].map(([name, ids]) => {
    const items = name === 'E-E-A-T' ? eeChecks : checks.filter(c => ids.includes(c.id));
    return {name, checks:items, score:score(items)};
  });
  const auditChecks = [...checks, ...eeChecks, ...local, ...geo.geo, ...geo.aeo];
  return {data:d, geo, areas:groups, seo:{score:score(checks), checks}, eeat:{score:score(eeChecks), checks:eeChecks, pillars}, local:{score:score(local), checks:local}, auditChecks};
}
function verdictOf(score) { return {label:score >= 80 ? 'Muchas señales presentes' : score >= 50 ? 'Revisión recomendada' : 'Pocas señales detectadas'}; }
function topFixes(r) { return [...r.seo.checks, ...r.eeat.checks, ...r.local.checks].filter(c => c.status === 'warn' || c.status === 'fail').slice(0, 6); }
function toMarkdown(r) {
  const lines = list => list.map(c => '- [' + c.status + '] ' + c.label + ': ' + c.detail + (c.tip && (c.status === 'warn' || c.status === 'fail') ? '\n  Qu\u00e9 revisar: ' + c.tip : '')).join('\n');
  const all = r.auditChecks || [...r.seo.checks, ...r.eeat.checks, ...r.local.checks];
  const areaText = (r.areas || []).map(a => '## ' + a.name + ' - ' + (a.score == null ? 'N/D' : a.score + '/100') + '\n' + a.checks.map(c => '- [' + c.status + '] ' + (c.label || 'Se\u00f1al') + (c.detail ? ': ' + c.detail : '')).join('\n')).join('\n\n');
  const detailText = all.map(c => '- [' + c.status + '] ' + c.area + ' - ' + c.label + ': ' + c.detail + (c.tip && (c.status === 'warn' || c.status === 'fail') ? '\n  Qu\u00e9 revisar: ' + c.tip : '')).join('\n');
  const aiText = typeof aiReview !== 'undefined' && aiReview ? '\n\n## Revisi\u00f3n asistida por IA (no verificada)\n' + aiReview.map(x => '- **' + x.title + ':** ' + x.finding + ' Qu\u00e9 revisar: ' + x.action).join('\n') : '';
  return '# Primera Vista - Auditor\u00eda orientativa\n\n' + r.data.url + '\n\nSEO: ' + r.seo.score + '/100\nSe\u00f1ales E-E-A-T: ' + r.eeat.score + '/100 (no es una puntuaci\u00f3n de Google)\nLocal: ' + r.local.score + '/100\n\n' + areaText + '\n\n## Comprobaciones detalladas\n' + detailText + '\n\n## GEO/AEO - Se\u00f1ales observables\n\nSin puntuaci\u00f3n de visibilidad ni garant\u00eda de citas en IA.\n\n### GEO\n' + lines(r.geo.geo) + '\n\n### AEO\n' + lines(r.geo.aeo) + '\n\nEl an\u00e1lisis local no verifica cabeceras, indexaci\u00f3n real ni acceso de rastreadores.' + aiText + '\n\nInforme generado con Primera Vista \u00b7 Auditor SEO \u2014 https://primeravista.es';
}
function buildLead(r, settings) {
  const fixes = r.seo.checks.filter(c => c.status === 'fail').slice(0, 3);
  if (!fixes.length) return null;
  const issues = fixes.map(c => '- ' + c.label + ': ' + c.detail).join('\n');
  const signature = '\n\n\u2014 ' + (settings.name || 'Primera Vista') + ' \u00b7 ' + (settings.web || 'https://primeravista.es');
  const text = 'Hola, soy ' + (settings.name || 'Primera Vista') + '. Revisando vuestra web encontr\u00e9 unos puntos que convendr\u00eda comprobar:\n\n' + issues + '\n\n\u00bfQui\u00e9n lleva la web para coment\u00e1rselo?' + signature;
  return {count:fixes.length, subject:'Una consulta sobre vuestra web', email:text, short:text};
}
function whatsappNumber(found) { return (found.whatsapp || '').replace(/\D/g, ''); }

if (typeof module !== 'undefined') module.exports = {buildReport, toMarkdown, buildLead, topFixes, scoreChecks};
