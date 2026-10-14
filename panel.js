const $ = (s, r = document) => r.querySelector(s);
const esc = (s) => String(s == null ? '' : s).replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));

let report = null;
let current = 'resumen';
let settings = { name: '', web: '' };
let dirty = { email: false, short: false };
let specs = [];          // resaltados disponibles en la vista actual
let activeId = null;     // resaltado que está puesto ahora en la web
let runId = 0;
let reportTabId = null;
let highlightQueue = Promise.resolve();
let inspectTimer;

const NOTE_HEAD = 'Este dato está en el código de la página (head), así que lo muestro aquí en vez de subrayarlo.';

function buildImageReview(data) {
  const images = data.images || {};
  const total = Number(images.total) || 0;
  const withoutAlt = Number(images.noAlt) || 0;
  const lazy = Number(images.lazy) || 0;
  const missingDimensions = Number(images.missingDimensions) || 0;
  const score = total ? Math.max(0, 100 - withoutAlt * 18 - Math.max(0, total - lazy) * 2 - missingDimensions * 2) : 100;
  const issues = [];
  if (!total) issues.push(['Sin imágenes', 'No se encontraron imágenes en esta página.']);
  else {
    if (withoutAlt) issues.push(['Falta texto alternativo', withoutAlt + (withoutAlt === 1 ? ' imagen no tiene atributo alt. Las decorativas deben llevar alt vacío.' : ' imágenes no tienen atributo alt. Las decorativas deben llevar alt vacío.')]);
    if (lazy < total) issues.push(['Carga diferida parcial', (total - lazy) + ' imágenes no declaran loading="lazy"; prioriza las imágenes visibles y carga de forma diferida las que quedan más abajo.']);
    if (missingDimensions) issues.push(['Dimensiones no declaradas', missingDimensions + (missingDimensions === 1 ? ' imagen no declara width y height.' : ' imágenes no declaran width y height, lo que puede causar saltos de diseño.')]);
    if (!issues.length) issues.push(['Marcado de imágenes completo', 'Todas declaran alt y carga diferida; no se detectan dimensiones ausentes.']);
  }
  return { score: Math.min(100, Math.round(score)), total, withoutAlt, lazy, missingDimensions, issues };
}

function buildContactReview(data) {
  const found = data.found || { emails: [], phones: [], whatsapp: '' };
  const contact = data.contact || {};
  const forms = data.forms || { total: 0, contact: 0, ctas: 0 };
  const methods = [];
  if (found.emails && found.emails.length) methods.push('Email');
  if (found.phones && found.phones.length) methods.push('Teléfono');
  if (found.whatsapp) methods.push('WhatsApp');
  if (contact.page) methods.push('Página de contacto');
  const issues = [];
  if (!methods.length) issues.push(['Sin contacto detectado', 'No se encontró email, teléfono, WhatsApp ni enlace a una página de contacto.']);
  if (!forms.total) issues.push(['Sin formulario', 'No se detectaron formularios HTML; puede existir un formulario incrustado que esta revisión no pueda leer.']);
  else if (!forms.contact) issues.push(['Formulario sin señales de contacto', 'Hay formularios, pero sus etiquetas no indican claramente que sean de contacto o captación.']);
  if (!forms.ctas) issues.push(['Llamada a la acción no detectada', 'No se reconocieron botones o enlaces con textos habituales de contacto, reserva o solicitud.']);
  if (methods.length && forms.contact && forms.ctas) issues.push(['Vías de contacto detectadas', 'Hay vías de contacto, formularios relacionados y llamadas a la acción reconocibles.']);
  const score = Math.min(100, methods.length * 20 + (forms.total ? 15 : 0) + (forms.contact ? 25 : 0) + (forms.ctas ? 20 : 0));
  return { score, methods, forms, issues };
}


const ICONS = {
  pass: '<svg class="ic" viewBox="0 0 16 16" aria-hidden="true"><circle cx="8" cy="8" r="7" fill="#155EEF"/><path d="M4.6 8.3l2.2 2.2 4.4-4.6" fill="none" stroke="#fff" stroke-width="1.6" stroke-linecap="round" stroke-linejoin="round"/></svg><span class="sr">Correcto: </span>',
  warn: '<svg class="ic" viewBox="0 0 16 16" aria-hidden="true"><path d="M8 1.8l6.6 12H1.4z" fill="#F5F2EA" stroke="#071A2B" stroke-width="1.5" stroke-linejoin="round"/><path d="M8 6.2v3.6" stroke="#071A2B" stroke-width="1.6" stroke-linecap="round"/><circle cx="8" cy="11.7" r="0.9" fill="#071A2B"/></svg><span class="sr">Mejorable: </span>',
  fail: '<svg class="ic" viewBox="0 0 16 16" aria-hidden="true"><rect x="1.5" y="1.5" width="13" height="13" rx="3" fill="#071A2B"/><path d="M5.5 5.5l5 5M10.5 5.5l-5 5" stroke="#fff" stroke-width="1.6" stroke-linecap="round"/></svg><span class="sr">Falla: </span>',
  info: '<svg class="ic" viewBox="0 0 16 16" aria-hidden="true"><circle cx="8" cy="8" r="6.3" fill="none" stroke="#071A2B" stroke-width="1.6"/><circle cx="8" cy="8" r="1.4" fill="#071A2B"/></svg><span class="sr">Informativo: </span>'
};

/* ---------- Ajustes (tu nombre y tu web) ---------- */
async function loadSettings() {
  try {
    const stored = await chrome.storage.local.get('settings');
    if (stored.settings) settings = { ...settings, ...stored.settings };
  } catch (e) { /* sin almacenamiento: se usan los valores vacíos */ }
}
function saveSettings() {
  try { chrome.storage.local.set({ settings }); } catch (e) { /* ignorar */ }
}

/* ---------- Pestaña activa y análisis ---------- */
async function activeTab() {
  const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
  return tab || null;
}

async function clearPage(tab) {
  try {
    await chrome.scripting.executeScript({ target: { tabId: tab.id }, func: highlightPage, args: [{ kind: 'clear' }, PAGE_CONFIG] });
  } catch (e) { /* la pestaña no admite scripts */ }
}

async function run() {
  const mine = ++runId;
  report = null;
  reportTabId = null;
  clearTimeout(inspectTimer);
  dirty = { email: false, short: false };
  setActive(null);
  $('#copy').disabled = true;
  if ($('#downloadMd')) $('#downloadMd').disabled = true;
  $('#status').textContent = '';
  $('#host').textContent = 'Analizando…';
  $('#pageTitle').textContent = '';
  $('#view').innerHTML = '<div class="state" role="status"><strong>Analizando la página</strong><p>Un momento…</p></div>';

  const tab = await activeTab();
  if (mine !== runId) return;
  if (!tab || !/^https?:/.test(tab.url || '')) {
    $('#host').textContent = 'Página no analizable';
    showError('Esta página no se puede analizar', 'Abre una web normal (http o https). Chrome no permite analizar sus páginas internas ni la tienda de extensiones.');
    return;
  }
  $('#host').textContent = new URL(tab.url).hostname;
  $('#pageTitle').textContent = tab.title || '';
  try {
    await clearPage(tab);
    const [{ result }] = await chrome.scripting.executeScript({ target: { tabId: tab.id }, func: collectPage, args: [PAGE_CONFIG] });
    if (mine !== runId) return;
    report = buildReport(result);
    reportTabId = tab.id;
    $('#copy').disabled = false;
    if ($('#downloadMd')) $('#downloadMd').disabled = false;
    render();
  } catch (e) {
    if (mine !== runId) return;
    showError('No se pudo leer la página', 'Recarga la pestaña y vuelve a intentarlo. También comprueba que la extensión tenga permiso de acceso a este sitio.');
  }
}

function showError(title, text) {
  $('#view').innerHTML = '<div class="state"><strong>' + esc(title) + '</strong><p>' + esc(text) + '</p></div>';
}

/* ---------- Resaltar en la web ---------- */
function pin(spec) {
  specs.push(spec);
  return 'data-spec="' + (specs.length - 1) + '" data-spec-id="' + esc(spec.id) + '"' + (spec.id === activeId ? ' ' : '');
}

function setActive(id) {
  activeId = id;
  document.querySelectorAll('[data-spec-id]').forEach((el) => el.classList.toggle('is-active', !!id && el.dataset.specId === id));
  $('#clearHl').hidden = !id;
}

// Qué se resalta para cada comprobación. Devuelve null si no hay nada que señalar en la página.
function specFor(c, r) {
  const d = r.data;
  const key = c.area + ':' + c.id;
  const banner = (label, lines) => ({ id: key, kind: 'banner', label, lines, note: NOTE_HEAD });
  const links = (label, which, noun, missing, extra) => ({ id: key, kind: 'links', which, label, noun, missing, ...(extra || {}) });
  const text = (label, pattern, missing) => ({ id: key, kind: 'text', pattern, label, noun: 'coincidencias', missing });
  const flagged = d.headings.map((h, i) => (h.flag ? i : -1)).filter((i) => i >= 0);
  const og = (k, name) => name + ': ' + (d.og[k] ? d.og[k].slice(0, 90) : 'falta');

  switch (key) {
    case 'SEO:title': return banner('Título de la página', ['«' + (d.title || 'sin título') + '»', d.title.length + ' caracteres (orientación: 30–60; no es un límite obligatorio)']);
    case 'SEO:description': return banner('Meta descripción', [d.description ? '«' + d.description + '»' : 'No hay meta descripción', d.description.length + ' caracteres (orientación: 120–160; no es un límite obligatorio)']);
    case 'SEO:canonical': return banner('URL canónica', [d.canonical || 'No hay etiqueta canonical']);
    case 'SEO:lang': return banner('Idioma declarado', [d.lang ? 'lang="' + d.lang + '"' : 'Falta el atributo lang']);
    case 'SEO:viewport': return banner('Adaptación a móvil', [d.viewport ? 'Tiene meta viewport' : 'Falta la meta viewport']);
    case 'SEO:indexable': return banner('Indexación', ['robots: ' + (d.robots || 'sin etiqueta robots (se puede indexar)')]);
    case 'SEO:https': case 'E-E-A-T:https': return banner('Conexión segura', ['Protocolo: ' + d.protocol]);
    case 'SEO:social': return banner('Vista previa al compartir', [og('title', 'og:title'), og('description', 'og:description'), og('image', 'og:image')]);
    case 'SEO:schema': case 'E-E-A-T:org-schema': return banner('Datos estructurados', [d.schema.types.length ? d.schema.types.join(', ') : 'No hay JSON-LD']);
    case 'SEO:url': return banner('URL de la página', [d.url]);
    case 'SEO:h1': return { id: key, kind: 'headings', levels: [1], label: 'Encabezado H1', noun: 'H1', missing: 'La página no tiene ningún H1.' };
    case 'SEO:hierarchy': return { id: key, kind: 'headings', flagged, label: 'Jerarquía de encabezados', noun: 'encabezados', missing: 'La página no tiene encabezados.' };
    case 'SEO:alt': return { id: key, kind: 'images-no-alt', label: 'Imágenes sin texto alternativo', noun: 'imágenes', missing: 'Todas las imágenes tienen atributo alt.' };
    case 'SEO:img-lazy': return { id: key, kind: 'images-no-lazy', label: 'Imágenes sin carga diferida', noun: 'imágenes', missing: 'Todas las imágenes tienen loading="lazy".' };
    case 'SEO:img-dim': return { id: key, kind: 'images-no-dim', label: 'Imágenes sin width o height', noun: 'imágenes', missing: 'Todas las imágenes declaran dimensiones.' };
    case 'SEO:perf': return banner('Rendimiento del servidor y scripts', [
      (d.performance && d.performance.ttfb ? 'TTFB: ' + d.performance.ttfb + ' ms' : 'Respuesta del servidor'),
      (d.performance && d.performance.renderBlockingScripts ? d.performance.renderBlockingScripts + ' scripts bloqueantes en <head>' : 'Sin scripts bloqueantes en el <head>')
    ]);
    case 'SEO:length': case 'E-E-A-T:depth': return { id: key, kind: 'content', label: 'Contenido principal', noun: 'zona', missing: 'La página no tiene <main> ni <article>: el contenido es todo el <body>.' };
    case 'SEO:internal': return links('Enlaces internos', 'internal', 'enlaces', 'No hay enlaces internos.');
    case 'SEO:anchors': return links('Enlaces con texto vacío o genérico', 'badAnchors', 'enlaces', 'Todos los enlaces tienen texto descriptivo.', { tag: 'Sin texto claro', tone: 'issue' });
    case 'E-E-A-T:first-person': return text('Primera persona', 'firstPerson', 'No hay expresiones en primera persona.');
    case 'E-E-A-T:cases': return text('Casos y resultados', 'cases', 'No se mencionan casos, resultados ni trabajos.');
    case 'E-E-A-T:credentials': return text('Credenciales y experiencia', 'credentials', 'No aparecen titulación, certificaciones ni años de experiencia.');
    case 'E-E-A-T:press': return text('Premios, prensa y certificaciones', 'awards', 'No aparecen premios, prensa ni certificaciones.');
    case 'E-E-A-T:reviews': return text('Reseñas y testimonios', 'reviews', 'No se detectan reseñas ni testimonios.');
    case 'E-E-A-T:media': return { id: key, kind: 'media', label: 'Imágenes y vídeo del contenido', noun: 'elementos', missing: 'No hay imágenes ni vídeos en el contenido.' };
    case 'E-E-A-T:author': return { id: key, kind: 'author', label: 'Autor', noun: 'elemento', missing: 'No se ve el autor en la página.' };
    case 'E-E-A-T:sources': return links('Fuentes externas citadas', 'citations', 'enlaces', 'El contenido no enlaza a ninguna fuente externa.');
    case 'E-E-A-T:social': return links('Perfiles en redes', 'social', 'enlaces', 'No hay enlaces a redes sociales.', { tag: 'Red social' });
    case 'E-E-A-T:contact': return links('Formas de contacto', 'contact', 'enlaces', 'No hay teléfono, email ni página de contacto.', { tag: 'Contacto' });
    case 'E-E-A-T:address': return { id: key, kind: 'address', label: 'Dirección', noun: 'elemento', missing: 'No hay ninguna etiqueta de dirección en la página.' };
    case 'E-E-A-T:legal': return links('Páginas legales', 'legal', 'enlaces', 'No hay enlaces a privacidad, aviso legal ni cookies.', { tag: 'Legal' });
    case 'E-E-A-T:about': return links('Sobre nosotros o equipo', 'about', 'enlaces', 'No hay enlace a «sobre nosotros» ni equipo.', { tag: 'Quiénes somos' });
    case 'E-E-A-T:dates': return { id: key, kind: 'dates', label: 'Fechas', noun: 'fechas', missing: 'No se ve ninguna fecha en la página.' };
    default: return null;
  }
}

function doHighlight(spec, scroll = true) {
  const expectedTab = reportTabId;
  const generation = runId;
  highlightQueue = highlightQueue.catch(() => {}).then(async () => {
    if (!expectedTab || generation !== runId) return;
    const tab = await activeTab();
    if (!tab || tab.id !== expectedTab || generation !== runId) return;
    try {
      const [{ result }] = await chrome.scripting.executeScript({target:{tabId:expectedTab}, func:highlightPage, args:[{...spec, scroll}, PAGE_CONFIG]});
      if (generation !== runId) return;
      setActive(spec.id);
      say(spec.lines ? 'Dato no visible: mostrado en la web' : !result.count ? spec.missing || 'No hay nada que resaltar' : result.visible + ' elementos localizados', 4500);
    } catch (e) { say('No se pudo resaltar. Recarga y analiza de nuevo.', 4500); }
  });
  return highlightQueue;
}

async function clearHighlight() {
  clearTimeout(inspectTimer);
  await highlightQueue.catch(() => {});
  const tab = await activeTab();
  if (tab) await clearPage(tab);
  setActive(null);
  say('Resaltado quitado');
}

/* ---------- Piezas de interfaz ---------- */
function scoreCard(name, sub, score) {
  const v = verdictOf(score);
  return '<div class="score"><p class="score-name">' + esc(name) + '</p>' +
    '<p class="score-num"><strong>' + score + '</strong><span>/100</span></p>' +
    '<div class="bar" role="img" aria-label="' + score + ' de 100"><i style="width:' + score + '%"></i></div>' +
    '<p class="score-verdict">' + v.label + '</p><p class="score-sub">' + esc(sub) + '</p></div>';
}

function checkList(list, showArea) {
  return '<ul class="checks">' + list.map((c) => {
    const spec = specFor(c, report);
    const label = spec
      ? '<button type="button" class="check-hit">' + esc(c.label) + '</button><span class="pin">Ver en la web</span>'
      : esc(c.label);
    return '<li class="check ' + c.status + (spec && spec.id === activeId ? ' is-active' : '') + '" ' + (spec ? pin(spec) : '') + '>' + ICONS[c.status] + '<div>' +
      '<p class="check-label">' + label + (showArea ? '<span class="area">' + esc(c.area) + '</span>' : '') + '</p>' +
      '<p class="check-detail">' + esc(c.detail) + '</p>' +
      (c.status === 'warn' || c.status === 'fail' ? '<p class="check-tip"><strong>Qué mejorar</strong>' + esc(c.tip) + '</p>' : '') +
      '</div></li>';
  }).join('') + '</ul>';
}

/* ---------- Vistas ---------- */
const VIEWS = {
  resumen(r) {
    const fixes = topFixes(r);
    return '<div class="scores">' +
      scoreCard('SEO técnico', 'Título, descripción, encabezados, enlaces…', r.seo.score) +
      scoreCard('E-E-A-T', 'Señales visibles de confianza', r.eeat.score) + '</div>' +
      '<h2 class="section-title">Qué arreglar primero</h2>' +
      (fixes.length ? checkList(fixes, true) : '<p class="note">No hay fallos importantes. Buen trabajo.</p>') +
      '<p class="note">Pulsa cualquier punto para verlo resaltado en la web. Google no publica una puntuación de E-E-A-T: esta mide lo que se ve en la página, y los enlaces de otras webs o las menciones externas no se pueden comprobar desde aquí.</p>';
  },

  seo(r) {
    const d = r.data;
    const t = d.title || '';
    const desc = d.description || '';
    const shownTitle = t.length > 60 ? t.slice(0, 60).trim() + '…' : t;
    const shownDesc = desc.length > 160 ? desc.slice(0, 160).trim() + '…' : desc;
    let crumb = d.host;
    try { crumb += d.path && d.path !== '/' ? ' › ' + d.path.split('/').filter(Boolean).slice(0, 3).join(' › ') : ''; } catch (e) { /* ignorar */ }
    return '<h2 class="section-title">Así se vería en Google</h2>' +
      '<div class="serp"><p class="serp-url">' + esc(crumb) + '</p>' +
      '<p class="serp-title">' + (shownTitle ? esc(shownTitle) : '<span class="serp-empty">Sin título</span>') + '</p>' +
      '<p class="serp-desc">' + (shownDesc ? esc(shownDesc) : '<span class="serp-empty">Sin meta descripción: Google elegirá un fragmento del texto.</span>') + '</p></div>' +
      '<h2 class="section-title">Comprobaciones (' + r.seo.score + '/100)</h2>' + checkList(r.seo.checks);
  },

  eeat(r) {
    return '<p class="note" style="margin-top:0">E-E-A-T significa experiencia, pericia, autoridad y confianza. Son las señales que se pueden ver en la propia página; pulsa una para ver dónde está.</p>' +
      r.eeat.pillars.map((p) =>
        '<section class="pillar"><div class="pillar-head"><h2 class="pillar-name">' + esc(p.name) + '<small>' + esc(p.en) + '</small></h2>' +
        '<span class="pillar-score">' + p.score + '/100</span></div>' +
        '<div class="bar" role="img" aria-label="' + p.score + ' de 100"><i style="width:' + p.score + '%"></i></div>' +
        checkList(p.checks) + '</section>').join('');
  },


  imagenes(r) {
    const review = buildImageReview(r.data);
    return '<h2 class="section-title">Revisión de imágenes</h2>' +
      '<div class="scores">' + scoreCard('Preparación', 'Marcado y carga de imágenes', review.score) + scoreCard('Texto alternativo', review.total + ' imágenes · ' + review.withoutAlt + ' sin alt', Math.max(0, 100 - review.withoutAlt * 25)) + '</div>' +
      '<dl class="facts image-facts"><dt>Imágenes</dt><dd>' + review.total + '</dd><dt>Carga diferida</dt><dd>' + review.lazy + ' de ' + review.total + '</dd><dt>Sin dimensiones</dt><dd>' + review.missingDimensions + '</dd><dt>Alt vacío</dt><dd>' + (r.data.images.emptyAlt || 0) + ' (puede ser decorativo)</dd></dl>' +
      '<ul class="review-list">' + review.issues.map((item) => '<li class="review-item"><strong>' + esc(item[0]) + '</strong><p>' + esc(item[1]) + '</p></li>').join('') + '</ul>' +
      '<p class="note">La revisión evalúa atributos del HTML; no descarga imágenes ni estima su peso real.</p>';
  },

  contacto(r) {
    const review = buildContactReview(r.data);
    return '<h2 class="section-title">Contacto y formularios</h2>' +
      '<div class="scores">' + scoreCard('Contacto', 'Vías detectadas', review.score) + scoreCard('Formularios', review.forms.total + ' detectados', review.forms.total ? 100 : 0) + '</div>' +
      '<dl class="facts image-facts"><dt>Formularios</dt><dd>' + review.forms.total + '</dd><dt>De contacto</dt><dd>' + review.forms.contact + '</dd><dt>CTA reconocibles</dt><dd>' + review.forms.ctas + '</dd><dt>Vías visibles</dt><dd>' + esc(review.methods.join(', ') || 'Ninguna detectada') + '</dd></dl>' +
      '<ul class="review-list">' + review.issues.map((item) => '<li class="review-item"><strong>' + esc(item[0]) + '</strong><p>' + esc(item[1]) + '</p></li>').join('') + '</ul>' +
      '<p class="note">Esta comprobación detecta señales visibles; no envía formularios ni verifica que el destino funcione.</p>';
  },

  geo(r) {
    const g = r.geo;
    const samples = g.answers.slice(0, 8).map(a => '<li><strong>' + esc(a.question) + '</strong><p>' + esc(a.answer) + '</p></li>').join('');
    return '<p class="note" style="margin-top:0"><strong>GEO</strong>: revisión para buscadores generativos. <strong>AEO</strong>: revisión del contenido para responder preguntas. Son señales observables en esta página, sin puntuación de visibilidad ni garantía de citas en IA.</p>' +
      '<h2 class="section-title">GEO · Acceso, contexto y fuentes</h2>' + checkList(g.geo) +
      '<h2 class="section-title">AEO · Preguntas y respuestas</h2>' + checkList(g.aeo) +
      (samples ? '<h2 class="section-title">Preguntas y texto próximo detectado</h2><ul class="note">' + samples + '</ul>' : '<p class="note">No se detectan preguntas con texto próximo. La revisión manual sigue siendo necesaria.</p>') +
      '<p class="note">No se consultan respuestas de ChatGPT, Gemini ni otros motores. Tampoco se comprueban menciones externas o el acceso de sus robots. No hacen falta un schema especial para IA ni preguntas frecuentes en todas las páginas.</p>';
  },

  estructura(r) {
    const d = r.data;
    const flagged = d.headings.map((h, i) => (h.flag ? i : -1)).filter((i) => i >= 0);
    const cnt = (l) => d.headings.filter((h) => h.level === l).length;
    const chip = (text, spec) => '<button type="button" class="chip' + (spec.id === activeId ? ' is-active' : '') + '" ' + pin(spec) + '>' + text + '</button>';
    const chips = '<div class="chips">' +
      [1, 2, 3, 4, 5, 6].map((l) => chip('H' + l + ': ' + cnt(l), { id: 'lvl:' + l, kind: 'headings', levels: [l], flagged, label: 'Encabezados H' + l, noun: 'H' + l, missing: 'No hay encabezados H' + l + ' en la página.' })).join('') +
      chip('Todos: ' + d.headings.length, { id: 'lvl:all', kind: 'headings', flagged, label: 'Todos los encabezados', noun: 'encabezados', missing: 'La página no tiene encabezados.' }) + '</div>';
    const outline = d.headings.length
      ? '<ul class="outline">' + d.headings.map((h, i) => {
        const spec = { id: 'h:' + i, kind: 'headings', index: i, flagged: h.flag ? [i] : [], label: 'Encabezado H' + h.level, noun: 'encabezado', missing: 'No se encuentra este encabezado.' };
        return '<li class="l' + h.level + (h.flag ? ' flagged' : '') + (spec.id === activeId ? ' is-active' : '') + '" style="margin-left:' + (h.level - 1) * 14 + 'px" ' + pin(spec) + '>' +
          '<span class="tag">H' + h.level + '</span><button type="button" class="outline-btn"><span class="outline-text">' + (h.text ? esc(h.text) : '<em>(vacío)</em>') + '</span>' +
          (h.flag ? '<span class="outline-flag">' + esc(h.flag) + '</span>' : '') + '</button></li>';
      }).join('') + '</ul>'
      : '<p class="note">La página no tiene encabezados.</p>';
    const fact = (k, v) => '<dt>' + k + '</dt><dd>' + esc(v) + '</dd>';
    return '<h2 class="section-title">Encabezados</h2>' + chips + outline +
      '<p class="note">Pulsa un encabezado para verlo en la web.</p>' +
      '<h2 class="section-title">Datos de la página</h2><dl class="facts">' +
      fact('Palabras', d.words) +
      fact('Imágenes', d.images.total + ' (' + d.images.noAlt + ' sin alt)') +
      fact('Enlaces', d.links.internal + ' internos · ' + d.links.external + ' externos') +
      fact('Datos estructurados', d.schema.types.length ? d.schema.types.join(', ') : 'Ninguno') +
      fact('Idioma', d.lang || 'No declarado') +
      fact('Canonical', d.canonical || 'No declarada') +
      fact('Robots', d.robots || 'Sin indicaciones') + '</dl>';
  },

  leads(r) {
    const d = r.data;
    const lead = buildLead(r, settings);
    const f = d.found;
    const wa = whatsappNumber(f);
    const foundParts = [];
    if (f.emails.length) foundParts.push('Email: ' + f.emails.join(', '));
    if (f.phones.length) foundParts.push('Teléfono: ' + f.phones.join(', '));
    if (f.whatsapp) foundParts.push('WhatsApp: ' + f.whatsapp);

    const form = '<h2 class="section-title">Tus datos</h2>' +
      '<label class="field"><span>Tu nombre o marca</span><input id="setName" type="text" autocomplete="off" placeholder="Ej. Ana López" value="' + esc(settings.name) + '"></label>' +
      '<label class="field"><span>Tu web</span><input id="setWeb" type="text" autocomplete="off" inputmode="url" placeholder="https://tuweb.com" value="' + esc(settings.web) + '"></label>' +
      '<p class="note" style="margin-top:0">Se guardan en tu navegador y se añaden a los mensajes.</p>';

    const contact = '<h2 class="section-title">Contacto encontrado en ' + esc(d.host) + '</h2>' +
      '<p class="found">' + (foundParts.length ? foundParts.map(esc).join('<br>') : 'No se ha encontrado email ni teléfono. Usa su formulario de contacto o sus redes.') + '</p>';

    if (!lead) {
      return form + contact + '<div class="state"><strong>Esta web no tiene fallos importantes</strong><p>Probablemente no necesite tu oferta. Prueba con otra.</p></div>';
    }

    return form + contact +
      '<h2 class="section-title">Mensaje por email (' + lead.count + (lead.count === 1 ? ' mejora detectada)' : ' mejoras detectadas)') + '</h2>' +
      '<input id="leadSubject" class="msg-subject" type="text" aria-label="Asunto" value="' + esc(lead.subject) + '">' +
      '<textarea id="leadEmail" class="msg-body" rows="13" aria-label="Mensaje de email">' + esc(lead.email) + '</textarea>' +
      '<div class="actions"><button class="ghost" type="button" data-act="copy-email">Copiar</button>' +
      (f.emails.length ? '<button class="ghost" type="button" data-act="open-mail">Abrir en tu correo</button>' : '') + '</div>' +
      '<h2 class="section-title">Mensaje corto (WhatsApp o mensaje directo)</h2>' +
      '<textarea id="leadShort" class="msg-body" rows="6" aria-label="Mensaje corto">' + esc(lead.short) + '</textarea>' +
      '<div class="actions"><button class="ghost" type="button" data-act="copy-short">Copiar</button>' +
      (wa ? '<button class="ghost" type="button" data-act="open-wa">Abrir WhatsApp</button>' : '') + '</div>' +
      '<p class="warning"><strong>Antes de enviar:</strong> comprueba cada punto en su web (pulsa «Ver en la web» en las otras pestañas), porque el análisis es automático y puede equivocarse. Además, en España el email comercial sin consentimiento previo tiene restricciones legales (LSSI). WhatsApp, llamada, formulario de contacto o mensaje directo suelen ser alternativas más seguras; no soy abogado, consúltalo si tienes dudas.</p>';
  }
};

/* ---------- Pintado y eventos ---------- */
function render() {
  clearTimeout(inspectTimer);
  document.querySelectorAll('.tabs [role="tab"]').forEach((b) => {
    const on = b.dataset.tab === current;
    b.setAttribute('aria-selected', String(on));
    b.tabIndex = on ? 0 : -1;
  });
  if (!report) return;
  const view = $('#view');
  specs = [];
  view.setAttribute('aria-labelledby', 'tab-' + current);
  view.innerHTML = VIEWS[current](report);
  view.scrollTop = 0;
  if (current === 'leads') wireLeads();
}

function say(text, ms) {
  const el = $('#status');
  el.textContent = text;
  clearTimeout(say.t);
  say.t = setTimeout(() => { el.textContent = ''; }, ms || 2200);
}

async function copyText(text, msg) {
  try { await navigator.clipboard.writeText(text); say(msg); } catch (e) { say('No se pudo copiar'); }
}

function refreshLeadText() {
  const lead = buildLead(report, settings);
  if (!lead) return;
  if (!dirty.email && $('#leadEmail')) { $('#leadEmail').value = lead.email; $('#leadSubject').value = lead.subject; }
  if (!dirty.short && $('#leadShort')) $('#leadShort').value = lead.short;
}

function wireLeads() {
  $('#setName').addEventListener('input', (e) => { settings.name = e.target.value; saveSettings(); refreshLeadText(); });
  $('#setWeb').addEventListener('input', (e) => { settings.web = e.target.value; saveSettings(); refreshLeadText(); });
  const email = $('#leadEmail'), short = $('#leadShort');
  if (email) email.addEventListener('input', () => { dirty.email = true; });
  if (short) short.addEventListener('input', () => { dirty.short = true; });

  $('#view').querySelectorAll('[data-act]').forEach((b) => b.addEventListener('click', () => {
    const act = b.dataset.act;
    const d = report.data;
    if (act === 'copy-email') copyText($('#leadSubject').value + '\n\n' + email.value, 'Email copiado');
    if (act === 'copy-short') copyText(short.value, 'Mensaje copiado');
    if (act === 'open-mail') {
      chrome.tabs.create({ url: 'mailto:' + d.found.emails[0] + '?subject=' + encodeURIComponent($('#leadSubject').value) + '&body=' + encodeURIComponent(email.value) });
    }
    if (act === 'open-wa') {
      chrome.tabs.create({ url: 'https://wa.me/' + whatsappNumber(d.found) + '?text=' + encodeURIComponent(short.value) });
    }
  }));
}

// Pulsar un punto del informe (fila, encabezado o contador) lo resalta en la web.
$('#view').addEventListener('click', (e) => {
  const el = e.target.closest('[data-spec]');
  clearTimeout(inspectTimer);
  if (el && specs[Number(el.dataset.spec)]) doHighlight(specs[Number(el.dataset.spec)]);
});


// Vista previa al pasar el cursor o usar el teclado; no mueve la página.
function previewItem(e) {
  const el = e.target.closest('[data-spec]');
  if (!el || (e.relatedTarget && el.contains(e.relatedTarget))) return;
  clearTimeout(inspectTimer);
  const spec = specs[Number(el.dataset.spec)];
  const generation = runId;
  if (spec && spec.id !== activeId) inspectTimer = setTimeout(() => {
    if (generation === runId && el.isConnected) doHighlight(spec, false);
  }, 220);
}
$('#view').addEventListener('mouseover', previewItem);
$('#view').addEventListener('focusin', previewItem);
$('#view').addEventListener('mouseout', e => {
  const el = e.target.closest('[data-spec]');
  if (el && (!e.relatedTarget || !el.contains(e.relatedTarget))) clearTimeout(inspectTimer);
});

document.querySelectorAll('.tabs [role="tab"]').forEach((b) => {
  b.addEventListener('click', () => { current = b.dataset.tab; render(); });
  b.addEventListener('keydown', (e) => {
    const tabs = Array.from(document.querySelectorAll('.tabs [role="tab"]'));
    const i = tabs.indexOf(b);
    let n = -1;
    if (e.key === 'ArrowRight') n = (i + 1) % tabs.length;
    if (e.key === 'ArrowLeft') n = (i - 1 + tabs.length) % tabs.length;
    if (n >= 0) { e.preventDefault(); current = tabs[n].dataset.tab; render(); tabs[n].focus(); }
  });
});
$('#rerun').addEventListener('click', run);
$('#clearHl').addEventListener('click', clearHighlight);
$('#copy').addEventListener('click', () => { if (report) copyText(toMarkdown(report), 'Informe copiado'); });
if ($('#downloadMd')) {
  $('#downloadMd').addEventListener('click', () => {
    if (!report) return;
    const md = toMarkdown(report);
    const blob = new Blob([md], { type: 'text/markdown;charset=utf-8' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = 'auditoria-seo-' + (report.data.host || 'informe') + '.md';
    a.click();
    URL.revokeObjectURL(url);
    say('Informe descargado');
  });
}

// El panel se queda abierto: se vuelve a analizar al cambiar de pestaña o cargar otra página.
let refreshTimer;
const scheduleRun = () => { clearTimeout(refreshTimer); refreshTimer = setTimeout(run, 500); };
chrome.tabs.onActivated.addListener(scheduleRun);
chrome.tabs.onUpdated.addListener((id, info, tab) => { if (tab.active && info.status === 'complete') scheduleRun(); });

loadSettings().then(run);
