// Se inyecta en la pestaña activa con chrome.scripting.executeScript.
// Tiene que ser autocontenida: no puede usar nada definido fuera de esta función.
function collectPage(cfg) {
  const P = cfg.patterns;
  const qs = (s, r = document) => r.querySelector(s);
  const qsa = (s, r = document) => Array.from(r.querySelectorAll(s));
  const clean = (t) => (t || '').replace(/\s+/g, ' ').trim();
  const metaName = (n) => {
    const e = qs('meta[name="' + n + '" i]');
    return e ? clean(e.getAttribute('content')) : '';
  };
  const metaProp = (p) => {
    const e = qs('meta[property="' + p + '" i]');
    return e ? clean(e.getAttribute('content')) : '';
  };
  const loc = location;
  const root = qs('main') || qs('article') || document.body;

  // --- Encabezados
  const headings = qsa('h1,h2,h3,h4,h5,h6').map((h) => ({
    level: Number(h.tagName[1]),
    text: clean(h.textContent).slice(0, 140)
  }));

  // --- Texto
  const clone = root.cloneNode(true);
  clone.querySelectorAll('script,style,noscript,template,svg').forEach((n) => n.remove());
  const mainText = clean(clone.textContent);
  const words = mainText ? mainText.split(' ').length : 0;
  const fullText = clean(document.body.innerText || document.body.textContent).toLowerCase();

  // --- Datos estructurados (JSON-LD)
  const types = new Set();
  const entities = new Set();
  const keys = new Set();
  let ldInvalid = 0;
  const walk = (o) => {
    if (Array.isArray(o)) { o.forEach(walk); return; }
    if (o && typeof o === 'object') {
      if (o.name && [].concat(o['@type'] || []).some(t => /Organization|Business|Person|Store|Service|Dentist|Clinic/i.test(String(t)))) entities.add(clean(String(o.name)));
      if (o['@type']) [].concat(o['@type']).forEach((t) => types.add(String(t)));
      Object.keys(o).forEach((k) => { keys.add(k); walk(o[k]); });
    }
  };
  qsa('script[type="application/ld+json"]').forEach((s) => {
    try { walk(JSON.parse(s.textContent)); } catch (e) { ldInvalid++; }
  });

  // --- Autor y fechas
  let author = metaName('author');
  if (!author) {
    const a = qs(cfg.authorSelector);
    if (a) author = clean(a.textContent).slice(0, 80);
  }
  const timeEl = qs('time[datetime]');
  const published = metaProp('article:published_time') || metaName('date') ||
    (timeEl ? timeEl.getAttribute('datetime') : '') || (keys.has('datePublished') ? 'schema' : '');
  const modified = metaProp('article:modified_time') || (keys.has('dateModified') ? 'schema' : '') ||
    (/(actualizado|última actualización|ultima actualizacion|updated on|last updated)/.test(fullText) ? 'texto' : '');

  // --- Enlaces
  const socialRe = new RegExp(P.social, 'i');
  const authRe = new RegExp(P.authHost, 'i');
  const genericRe = new RegExp(P.genericAnchor, 'i');
  let internal = 0, external = 0, nofollow = 0, emptyAnchors = 0, genericAnchors = 0;
  const social = new Set();
  qsa('a[href]').forEach((a) => {
    let u;
    try { u = new URL(a.getAttribute('href'), loc.href); } catch (e) { return; }
    if (!/^https?:$/.test(u.protocol)) return;
    const img = a.querySelector('img[alt]');
    const t = clean(a.textContent) || clean(a.getAttribute('aria-label')) || (img ? clean(img.alt) : '');
    if (!t) emptyAnchors++; else if (genericRe.test(t)) genericAnchors++;
    if (u.hostname === loc.hostname) internal++;
    else {
      external++;
      if (/\b(nofollow|sponsored|ugc)\b/.test(a.rel)) nofollow++;
      if (socialRe.test(u.hostname)) social.add(u.hostname.replace(/^www\./, ''));
    }
  });
  let citations = 0, authCitations = 0;
  qsa('a[href]', root).forEach((a) => {
    let u;
    try { u = new URL(a.getAttribute('href'), loc.href); } catch (e) { return; }
    if (!/^https?:$/.test(u.protocol) || u.hostname === loc.hostname || socialRe.test(u.hostname)) return;
    citations++;
    if (authRe.test(u.hostname)) authCitations++;
  });
  const linkBlob = qsa('a[href]').map((a) => (clean(a.textContent) + ' ' + (a.getAttribute('href') || '')).toLowerCase());
  const has = (re) => linkBlob.some((s) => re.test(s));

  // --- Imágenes y vídeo
  const imgs = qsa('img');
  const lazy = imgs.filter((i) => (i.getAttribute('loading') || '').toLowerCase() === 'lazy').length;
  const missingDimensions = imgs.filter((i) => !i.hasAttribute('width') || !i.hasAttribute('height')).length;
  const contentImages = qsa('img', root).filter((i) => (i.offsetWidth || i.naturalWidth || Number(i.getAttribute('width')) || 0) >= 120).length;

  // --- Formularios y llamadas a la acción (CTAs)
  const formsList = qsa('form');
  const contactForms = formsList.filter((f) => /contacto|contact|consulta|mensaje|enviar|quote|presupuesto|lead/i.test(
    (f.getAttribute('id') || '') + ' ' + (f.getAttribute('class') || '') + ' ' + (f.getAttribute('action') || '') + ' ' + (f.innerText || '')
  )).length;
  const ctas = qsa('button, a[role="button"], input[type="submit"], a.btn, a[class*="button" i], a[class*="btn" i]').filter((el) => {
    const text = clean(el.textContent || el.value);
    return /contact|reserv|pedir|solicit|comprar|empezar|presupuesto|escr[ií]benos|ll[aá]manos|agenda|demo|cotiz|hablar/i.test(text);
  }).length;

  // --- Rendimiento local (Navigation Timing)
  let perf = { ttfb: 0, domReady: 0, loadTime: 0, renderBlockingScripts: 0 };
  try {
    const navEntries = performance.getEntriesByType('navigation');
    if (navEntries && navEntries.length) {
      const nav = navEntries[0];
      perf.ttfb = Math.max(0, Math.round(nav.responseStart - nav.requestStart) || 0);
      perf.domReady = Math.max(0, Math.round(nav.domContentLoadedEventEnd - nav.startTime) || 0);
      perf.loadTime = Math.max(0, Math.round(nav.loadEventEnd - nav.startTime) || 0);
    } else if (performance.timing) {
      const t = performance.timing;
      perf.ttfb = Math.max(0, t.responseStart - t.requestStart);
      perf.domReady = Math.max(0, t.domContentLoadedEventEnd - t.navigationStart);
      perf.loadTime = Math.max(0, t.loadEventEnd - t.navigationStart);
    }
    perf.renderBlockingScripts = qsa('head script:not([async]):not([defer]):not([type="module"])').length;
  } catch (e) {}

  // --- Estructura semántica / Tabla de contenidos (GEO)
  const hasToc = !!qs('nav[class*="toc" i], [id*="toc" i], [class*="table-of-contents" i], nav[aria-label*="índice" i], nav[aria-label*="content" i]');
  const sectionAnchors = qsa('a[href^="#"]:not([href="#"]):not([href="#top"]):not([href=""])').length;

  // --- Canonical, robots, contenido mixto
  const can = qs('link[rel="canonical" i]');
  const robots = (metaName('robots') + ' ' + metaName('googlebot')).toLowerCase();
  const norm = (u) => u.replace(/#.*$/, '').replace(/\/$/, '');
  const mixed = loc.protocol === 'https:'
    ? qsa('img[src^="http:"],script[src^="http:"],iframe[src^="http:"],link[rel="stylesheet"][href^="http:"]').length : 0;

  const count = (src) => (fullText.match(new RegExp(src, 'g')) || []).length;

  // --- Datos de contacto de la web analizada (para captar el lead)
  const emails = new Set();
  qsa('a[href^="mailto:" i]').forEach((a) => {
    const m = a.getAttribute('href').replace(/^mailto:/i, '').split('?')[0].trim().toLowerCase();
    if (/^[^@\s]+@[^@\s]+\.[a-z]{2,}$/.test(m)) emails.add(m);
  });
  (fullText.match(/[a-z0-9._%+-]+@[a-z0-9-]+(\.[a-z0-9-]+)*\.[a-z]{2,}/g) || []).forEach((m) => {
    if (!/\.(png|jpe?g|webp|gif|svg|avif)$/.test(m) && !/^(example|email|tu)@/.test(m)) emails.add(m);
  });
  const phones = new Set();
  qsa('a[href^="tel:" i]').forEach((a) => {
    const p = a.getAttribute('href').replace(/^tel:/i, '').replace(/[^\d+]/g, '');
    if (p.replace(/\D/g, '').length >= 9) phones.add(p);
  });
  let whatsapp = '';
  qsa('a[href*="wa.me"],a[href*="api.whatsapp.com"],a[href*="web.whatsapp.com"]').forEach((a) => {
    if (whatsapp) return;
    const href = a.getAttribute('href') || '';
    const m = href.match(/wa\.me\/(\+?\d+)/) || href.match(/phone=(\+?\d+)/);
    if (m) whatsapp = m[1];
  });

  // Preguntas del contenido: descarta nodos ocultos y conserva desplegables cerrados.
  const eligible = (node) => !node.closest('[hidden],[aria-hidden="true"]') && getComputedStyle(node).display !== 'none' && getComputedStyle(node).visibility !== 'hidden';
  const questionNodes = qsa('h1,h2,h3,h4,h5,h6,summary', root).filter(node => eligible(node) && /[?？]/.test(clean(node.textContent)));
  const questions = [], answers = [];
  questionNodes.forEach(node => {
    const question = clean(node.textContent);
    if (!question || questions.includes(question)) return;
    questions.push(question);
    let answer = '';
    if (node.tagName === 'SUMMARY' && node.parentElement.tagName === 'DETAILS') {
      const body = node.parentElement.cloneNode(true);
      body.querySelectorAll('summary,script,style,noscript,[hidden],[aria-hidden="true"]').forEach(n => n.remove());
      answer = clean(body.textContent);
    } else {
      let next = node.nextElementSibling;
      const pieces = [];
      while (next && !/^H[1-6]$/.test(next.tagName) && pieces.length < 3) {
        if (eligible(next) && !/^(SCRIPT|STYLE|NOSCRIPT)$/.test(next.tagName)) pieces.push(clean(next.textContent));
        next = next.nextElementSibling;
      }
      answer = pieces.filter(Boolean).join(' ');
    }
    if (answer) answers.push({question: question.slice(0, 200), answer: answer.slice(0, 500)});
  });

  return {
    geo: {questions, answers, entities: Array.from(entities), lists: qsa("ul,ol", root).filter(eligible).length, tables: qsa("table", root).filter(eligible).length},
    url: loc.href,
    host: loc.hostname,
    path: loc.pathname,
    hasQuery: !!loc.search,
    protocol: loc.protocol,
    title: clean(document.title),
    description: metaName('description'),
    canonical: can ? can.href : '',
    canonicalMatches: can ? norm(can.href) === norm(loc.href) : false,
    noindex: /noindex/.test(robots),
    robots: robots.trim(),
    lang: document.documentElement.lang || '',
    viewport: !!qs('meta[name="viewport" i]'),
    hreflang: qsa('link[rel="alternate"][hreflang]').length,
    og: {
      title: metaProp('og:title'),
      description: metaProp('og:description'),
      image: metaProp('og:image'),
      siteName: metaProp('og:site_name'),
      type: metaProp('og:type')
    },
    twitter: {
      card: metaName('twitter:card'),
      title: metaName('twitter:title'),
      description: metaName('twitter:description'),
      image: metaName('twitter:image')
    },
    headings,
    words,
    images: {
      total: imgs.length,
      noAlt: imgs.filter((i) => !i.hasAttribute('alt')).length,
      emptyAlt: imgs.filter((i) => i.getAttribute('alt') === '').length,
      lazy,
      missingDimensions
    },
    forms: {
      total: formsList.length,
      contact: contactForms,
      ctas
    },
    performance: perf,
    toc: {
      hasToc,
      sectionAnchors
    },
    contentImages,
    videos: qsa('video,iframe[src*="youtube"],iframe[src*="vimeo"]').length,
    links: { internal, external, nofollow, emptyAnchors, genericAnchors },
    schema: { types: Array.from(types), invalid: ldInvalid, hasAuthor: keys.has('author'), hasSameAs: keys.has('sameAs'), hasAddress: keys.has('address'), hasReview: keys.has('review') || keys.has('aggregateRating') },
    author,
    published: !!published,
    modified: !!modified,
    social: Array.from(social),
    citations,
    authCitations,
    legal: {
      privacy: has(new RegExp(P.privacy)),
      terms: has(new RegExp(P.terms)),
      cookies: has(new RegExp(P.cookies))
    },
    contact: {
      tel: qsa('a[href^="tel:" i]').length,
      mail: qsa('a[href^="mailto:" i]').length,
      page: has(new RegExp(P.contact)),
      address: !!qs('address') || keys.has('address') || /\b(calle|c\/|avenida|avda\.?|carrer|paseo|passeig|plaza|street|avenue)\s+[^\n\d]{2,40}?,?\s*(n[ºo°.]?\s*)?\d{1,4}\b/.test(fullText)
    },
    found: { emails: Array.from(emails).slice(0, 3), phones: Array.from(phones).slice(0, 3), whatsapp },
    aboutLink: has(new RegExp(P.about)),
    mixed,
    firstPerson: count(P.firstPerson),
    caseHits: count(P.cases),
    credentialHits: count(P.credentials),
    awardHits: count(P.awards),
    reviewHits: count(P.reviews)
  };
}
