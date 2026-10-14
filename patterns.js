// Patrones compartidos: el análisis (collect.js) y el resaltado (highlight.js) usan exactamente los mismos,
// así lo que se cuenta en el informe es lo mismo que se subraya en la web.
const TEXT_PATTERNS = {
  firstPerson: /\b(yo|mi|mis|nosotros|nuestro|nuestra|nuestros|nuestras|hemos|my|we|our|i've|we've)\b/g,
  cases: /(caso(s)? de [eé]xito|caso real|casos reales|antes y despu[eé]s|case stud(y|ies)|before and after|resultados|portfolio|portafolio|proyectos realizados|trabajos realizados|nuestros trabajos|galer[ií]a)/g,
  credentials: /(licenciad[oa]|graduad[oa]|m[aá]ster|master|doctor|dra?\.|ingenier[oa]|certificad[oa]|colegiad[oa]|a[ñn]os de experiencia|years of experience|certified|especialista|experto|experta|expert|fundador|fundadora|founder)/g,
  awards: /(premio|premios|galard[oó]n|prensa|aparecemos en|hemos aparecido|as seen (on|in)|featured (in|on)|award|certificaci[oó]n|socio|partner|clientes que conf[ií]an|nos han elegido|colaboradores|miembro de)/g,
  reviews: /(testimonios?|rese[ñn]as?|opiniones|valoraciones|reviews?|testimonials?|clientes dicen|lo que dicen)/g,
  // Enlaces: se comparan contra «texto + href» en minúsculas
  privacy: /privacidad|privacy|protecci[oó]n de datos|rgpd|gdpr/,
  terms: /aviso legal|t[eé]rminos|terms|condiciones|legal notice|imprint|impressum/,
  cookies: /cookies/,
  contact: /contacto|contact|cont[aá]ctanos|contactar/,
  about: /sobre (nosotros|m[ií])|qui[eé]nes somos|qui[eé]n soy|about|nuestro equipo|equipo|team|nosotros/,
  // Dominios
  social: /(facebook\.com|instagram\.com|linkedin\.com|twitter\.com|^x\.com|youtube\.com|tiktok\.com|pinterest\.com|threads\.net|wa\.me|whatsapp\.com)/i,
  authHost: /(\.|^)(gov|edu)(\.[a-z]{2})?$|(\.|^)(gob\.es|gouv\.fr|europa\.eu|who\.int|wikipedia\.org|ac\.uk)$/i,
  genericAnchor: /^(clic aquí|haz clic aquí|click here|aquí|here|leer más|leer mas|read more|más|ver más|saber más|más info|más información)$/i
};

// Se pasa tal cual a las funciones que se inyectan en la página (solo admite datos simples).
const PAGE_CONFIG = {
  authorSelector: '[rel~="author"],[itemprop="author"],.author,.byline,[class*="author" i],[class*="byline" i]',
  patterns: Object.fromEntries(Object.entries(TEXT_PATTERNS).map(([k, v]) => [k, v.source]))
};
