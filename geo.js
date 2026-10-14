// Señales locales observables. No predicen citas ni posiciones en motores de IA.
function buildGeoReport(d = {}) {
  const geo = [], aeo = [];
  const evidence = d.geo || {};
  const schema = d.schema || {types: [], invalid: 0};
  const add = (list, id, label, status, detail, tip = '') => list.push({id, label, status, detail, tip, area: 'GEO/AEO', weight: 0});
  add(geo, 'indexable', 'Directivas de indexación en HTML', d.noindex ? 'fail' : 'info',
    d.noindex ? 'Se detecta noindex en meta robots.' : 'No se detecta noindex en HTML. No se han consultado robots.txt, cabeceras HTTP ni el índice del buscador.',
    'Revisa si esta página debe ser pública antes de cambiar noindex.');
  const restricted = /\bnosnippet\b|\bmax-snippet\s*:\s*0\b/i.test(d.robots || '');
  add(geo, 'snippets', 'Restricciones de fragmentos', restricted ? 'warn' : 'info',
    restricted ? 'Se detecta nosnippet o max-snippet:0 en HTML.' : 'No se detecta una prohibición global de fragmentos en meta robots; puede haber otras restricciones.',
    'Comprueba si estas restricciones son intencionadas.');
  add(geo, 'content', 'Texto principal disponible', d.words > 0 ? 'pass' : 'warn',
    (d.words || 0) + ' palabras detectadas en el contenido principal. No se evalúan exactitud, utilidad ni comprensión por una IA.',
    'Comprueba que la información importante esté disponible como texto legible.');
  const entities = evidence.entities || [];
  add(geo, 'entities', 'Entidades nombradas en JSON-LD', 'info',
    entities.length ? entities.slice(0, 5).join(', ') : 'No se detectan nombres de organizaciones, negocios o personas en JSON-LD.',
    '');
  add(geo, 'json', 'Sintaxis de JSON-LD', schema.invalid ? 'fail' : 'info',
    schema.invalid ? schema.invalid + ' bloques de JSON-LD no se pueden interpretar.' : (schema.types || []).length ? 'JSON interpretable. Tipos: ' + schema.types.join(', ') + '. No valida las propiedades de Schema.org.' : 'No se detecta JSON-LD. No es un requisito específico para aparecer en respuestas de IA.',
    'Corrige la sintaxis y valida el marcado. Los datos deben coincidir con el contenido.');
  add(geo, 'sources', 'Enlaces externos en el contenido', 'info',
    (d.citations || 0) + ' enlaces externos no sociales. Revisa si son fuentes pertinentes: su presencia no acredita fiabilidad.');
  add(geo, 'dates', 'Fecha declarada', 'info', d.published || d.modified ? 'Se detecta una fecha de publicación o actualización; revisa si corresponde al contenido.' : 'No se detectan fechas. Pueden ser útiles en contenidos que cambian con el tiempo.');
  const toc = d.toc || {};
  add(geo, 'toc', 'Estructura con anclas o índice de contenidos', (toc.hasToc || toc.sectionAnchors >= 2) ? 'pass' : 'info',
    (toc.hasToc || toc.sectionAnchors >= 2) ? 'Se detecta navegación por secciones (' + (toc.sectionAnchors || 0) + ' enlaces a secciones internas). Facilita el enlace directo por IAs.' : 'No se detecta tabla de contenidos ni anclas de sección. Son útiles en contenidos extensos.',
    'Añade un índice con anclas internas en artículos o páginas largas para facilitar citas precisas.');
  const questions = evidence.questions || [], answers = evidence.answers || [];
  add(aeo, 'questions', 'Preguntas en encabezados o desplegables', 'info',
    questions.length + ' preguntas detectadas. Es una ayuda para revisar dudas del usuario, no una condición de posicionamiento.');
  add(aeo, 'answers', 'Texto asociado a las preguntas', 'info',
    answers.length + ' preguntas con texto próximo. La detección no comprueba si ese texto responde correctamente.');
  add(aeo, 'format', 'Listas y tablas', 'info',
    (evidence.lists || 0) + ' listas y ' + (evidence.tables || 0) + ' tablas en el contenido. Úsalas cuando ayuden a explicar datos o pasos.');
  return {geo, aeo, questions, answers};
}
if (typeof module !== 'undefined') module.exports = {buildGeoReport};
