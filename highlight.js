// Se inyecta en la pestaña activa. Dibuja las marcas en una capa aparte (Shadow DOM):
// no toca el HTML ni el CSS de la web, y se elimina por completo con «Quitar resaltado».
// Tiene que ser autocontenida: no puede usar nada definido fuera de esta función.
function highlightPage(spec, cfg) {
  const KEY = '__auditorSeoHighlight';
  if (window[KEY]) {
    try { window[KEY].destroy(); } catch (e) { /* ignorar */ }
    window[KEY] = null;
  }
  if (spec.kind === 'clear') return { count: 0, visible: 0, hidden: 0 };

  const P = cfg.patterns;
  const qsa = (s, r = document) => Array.from(r.querySelectorAll(s));
  const clean = (t) => (t || '').replace(/\s+/g, ' ').trim();
  const root = document.querySelector('main') || document.querySelector('article') || document.body;
  const MAX = 200;
  const targets = [];
  const ranges = [];
  const add = (el, label, tone) => {
    if (el && targets.length < MAX) targets.push({ el, label: label || '', tone: tone || 'info' });
  };
  const tone = spec.tone || 'info';

  const anchors = () => qsa('a[href]').map((a) => {
    const href = a.getAttribute('href') || '';
    let u = null;
    try { u = new URL(href, location.href); } catch (e) { /* ignorar */ }
    const img = a.querySelector('img[alt]');
    const text = clean(a.textContent) || clean(a.getAttribute('aria-label')) || (img ? clean(img.alt) : '');
    return { a, u, href, text, blob: (clean(a.textContent) + ' ' + href).toLowerCase() };
  });
  const isWeb = (l) => l.u && /^https?:$/.test(l.u.protocol);

  // ---- Qué hay que marcar
  switch (spec.kind) {
    case 'headings':
      qsa('h1,h2,h3,h4,h5,h6').forEach((h, i) => {
        const level = Number(h.tagName[1]);
        if (spec.levels && spec.levels.indexOf(level) < 0) return;
        if (spec.index != null && spec.index !== i) return;
        add(h, 'H' + level, (spec.flagged || []).indexOf(i) >= 0 ? 'issue' : 'info');
      });
      break;
    case 'images-no-alt':
      qsa('img:not([alt])').forEach((i) => add(i, 'Sin alt', 'issue'));
      break;
    case 'images-no-lazy':
      qsa('img').filter((i) => (i.getAttribute('loading') || '').toLowerCase() !== 'lazy').forEach((i) => add(i, 'Sin lazy', 'issue'));
      break;
    case 'images-no-dim':
      qsa('img').filter((i) => !i.hasAttribute('width') || !i.hasAttribute('height')).forEach((i) => add(i, 'Sin width/height', 'issue'));
      break;
    case 'media':
      qsa('img', root)
        .filter((i) => (i.offsetWidth || i.naturalWidth || Number(i.getAttribute('width')) || 0) >= 120)
        .forEach((i) => add(i, 'Imagen'));
      qsa('video,iframe[src*="youtube"],iframe[src*="vimeo"]').forEach((v) => add(v, 'Vídeo'));
      break;
    case 'author':
      add(document.querySelector(cfg.authorSelector), 'Autor');
      break;
    case 'address':
      add(document.querySelector('address'), 'Dirección');
      break;
    case 'dates':
      qsa('time[datetime]').forEach((t) => add(t, 'Fecha'));
      break;
    case 'content':
      if (root !== document.body) add(root, 'Contenido principal');
      break;
    case 'links': {
      const social = new RegExp(P.social, 'i');
      const generic = new RegExp(P.genericAnchor, 'i');
      const test = (name, l) => new RegExp(P[name]).test(l.blob);
      anchors().forEach((l) => {
        let ok = false;
        switch (spec.which) {
          case 'internal': ok = isWeb(l) && l.u.hostname === location.hostname; break;
          case 'badAnchors': ok = isWeb(l) && (!l.text || generic.test(l.text)); break;
          case 'social': ok = isWeb(l) && l.u.hostname !== location.hostname && social.test(l.u.hostname); break;
          case 'citations': ok = isWeb(l) && root.contains(l.a) && l.u.hostname !== location.hostname && !social.test(l.u.hostname); break;
          case 'contact': ok = /^(tel|mailto):/i.test(l.href) || test('contact', l); break;
          case 'legal': ok = test('privacy', l) || test('terms', l) || test('cookies', l); break;
          case 'about': ok = test('about', l); break;
        }
        if (ok) add(l.a, spec.tag || '', tone);
      });
      break;
    }
    case 'text': {
      const re = new RegExp(P[spec.pattern], 'gi');
      const walker = document.createTreeWalker(document.body, NodeFilter.SHOW_TEXT, {
        acceptNode: (n) => {
          const p = n.parentElement;
          if (!p || /^(SCRIPT|STYLE|NOSCRIPT|TEMPLATE|TEXTAREA)$/.test(p.tagName)) return NodeFilter.FILTER_REJECT;
          return n.nodeValue.trim() ? NodeFilter.FILTER_ACCEPT : NodeFilter.FILTER_REJECT;
        }
      });
      let node;
      while ((node = walker.nextNode()) && ranges.length < 400) {
        re.lastIndex = 0;
        let m;
        while ((m = re.exec(node.nodeValue)) && ranges.length < 400) {
          if (!m[0]) { re.lastIndex++; continue; }
          const r = document.createRange();
          r.setStart(node, m.index);
          r.setEnd(node, m.index + m[0].length);
          ranges.push(r);
        }
      }
      break;
    }
    default: break; // 'banner': solo se muestra el cuadro informativo
  }

  // ---- Capa de marcas (Shadow DOM)
  const host = document.createElement('div');
  host.setAttribute('data-auditor-seo', '');
  host.style.cssText = 'all:initial;position:absolute;top:0;left:0;width:0;height:0;overflow:visible;z-index:2147483647;pointer-events:none;';
  const shadow = host.attachShadow({ mode: 'open' });
  const style = document.createElement('style');
  style.textContent =
    '.box{position:absolute;box-sizing:border-box;border:3px solid #155EEF;border-radius:4px;background:rgba(21,94,239,.14);box-shadow:0 0 0 2px #fff;pointer-events:none}' +
    '.box.issue{border-color:#071A2B;border-style:dashed;background:rgba(245,242,234,.55)}' +
    '.tag{position:absolute;left:-3px;top:-28px;padding:2px 7px;border-radius:4px 4px 4px 0;background:#155EEF;color:#fff;font:700 12px/18px system-ui,-apple-system,"Segoe UI",sans-serif;white-space:nowrap}' +
    '.issue .tag{background:#071A2B;color:#F5F2EA}' +
    '.tag.in{top:-3px;border-radius:0 0 4px 0}' +
    '.bar{position:fixed;top:16px;right:16px;max-width:340px;box-sizing:border-box;padding:12px 14px;border-radius:10px;background:#071A2B;color:#F5F2EA;font:13px/1.45 system-ui,-apple-system,"Segoe UI",sans-serif;box-shadow:0 10px 30px rgba(7,26,43,.35);pointer-events:auto}' +
    '.bar strong{display:block;color:#fff;font-size:13px;margin-bottom:2px}' +
    '.bar p{margin:2px 0;overflow-wrap:anywhere}' +
    '.bar button{margin-top:10px;padding:6px 10px;border:0;border-radius:6px;background:#155EEF;color:#fff;font:600 12px system-ui,-apple-system,"Segoe UI",sans-serif;cursor:pointer}';
  const layer = document.createElement('div');
  shadow.appendChild(style);
  shadow.appendChild(layer);

  const useApi = ranges.length > 0 && window.CSS && CSS.highlights && typeof Highlight !== 'undefined';
  let pageStyle = null;
  if (useApi) {
    pageStyle = document.createElement('style');
    pageStyle.textContent = '::highlight(auditor-seo){background-color:rgba(21,94,239,.28);color:inherit;text-decoration:underline 2px solid #155EEF;text-decoration-skip-ink:none}';
    document.documentElement.appendChild(pageStyle);
    CSS.highlights.set('auditor-seo', new Highlight(...ranges));
  }

  const box = (left, top, width, height, label, cls) => {
    const b = document.createElement('div');
    b.className = 'box ' + cls;
    b.style.cssText = 'left:' + (left - 4) + 'px;top:' + (top - 4) + 'px;width:' + (width + 8) + 'px;height:' + (height + 8) + 'px';
    if (label) {
      const t = document.createElement('span');
      t.className = 'tag' + (top < 32 ? ' in' : '');
      t.textContent = label;
      b.appendChild(t);
    }
    layer.appendChild(b);
  };

  let visibleBoxes = 0;
  const place = () => {
    layer.textContent = '';
    visibleBoxes = 0;
    const sx = window.scrollX, sy = window.scrollY;
    targets.forEach((t) => {
      const r = t.el.getBoundingClientRect();
      if (r.width <= 0 || r.height <= 0) return;
      visibleBoxes++;
      box(r.left + sx, r.top + sy, r.width, r.height, t.label, t.tone);
    });
    if (!useApi) {
      ranges.forEach((rg) => {
        Array.from(rg.getClientRects ? rg.getClientRects() : []).forEach((r) => {
          if (r.width > 0 && r.height > 0) box(r.left + sx, r.top + sy, r.width, r.height, '', 'info');
        });
      });
    }
  };
  document.documentElement.appendChild(host);
  place();

  let visibleText = 0;
  ranges.forEach((rg) => {
    try { if (rg.getClientRects().length > 0) visibleText++; } catch (e) { visibleText++; }
  });
  const count = targets.length + ranges.length;
  const visible = visibleBoxes + visibleText;

  // ---- Cuadro informativo
  const bar = document.createElement('div');
  bar.className = 'bar';
  const addText = (tag, text) => { const el = document.createElement(tag); el.textContent = text; bar.appendChild(el); };
  addText('strong', spec.label || 'Auditor SEO');
  if (spec.lines && spec.lines.length) {
    spec.lines.forEach((l) => addText('p', l));
    if (spec.note) addText('p', spec.note);
  } else if (count === 0) {
    addText('p', spec.missing || 'No se ha encontrado nada que resaltar.');
  } else if (visible === 0) {
    addText('p', 'Está en el código de la página, pero no se ve (está oculto).');
  } else {
    addText('p', visible + ' ' + (spec.noun || 'elementos') + ' resaltados.');
    if (count > visible) addText('p', (count - visible) + ' más están ocultos en la página.');
  }
  const close = document.createElement('button');
  close.type = 'button';
  close.textContent = 'Quitar resaltado';
  close.addEventListener('click', () => { if (window[KEY]) window[KEY].destroy(); window[KEY] = null; });
  bar.appendChild(close);
  shadow.appendChild(bar);

  // ---- Mantener las marcas en su sitio si cambia el tamaño de la página
  let raf = 0;
  const onLayout = () => { cancelAnimationFrame(raf); raf = requestAnimationFrame(place); };
  window.addEventListener('resize', onLayout);
  window.addEventListener('scroll', onLayout, true);
  let ro = null;
  if (typeof ResizeObserver !== 'undefined') {
    ro = new ResizeObserver(onLayout);
    ro.observe(document.documentElement);
  }

  window[KEY] = {
    destroy() {
      window.removeEventListener('resize', onLayout);
      window.removeEventListener('scroll', onLayout, true);
      if (ro) ro.disconnect();
      cancelAnimationFrame(raf);
      host.remove();
      if (pageStyle) pageStyle.remove();
      if (useApi) CSS.highlights.delete('auditor-seo');
    }
  };

  // ---- Llevar la vista hasta lo marcado
  if (spec.scroll !== false && !(spec.lines && spec.lines.length)) {
    const first = targets.find((t) => { const r = t.el.getBoundingClientRect(); return r.width > 0 && r.height > 0; });
    const scrollEl = first ? first.el : (ranges[0] ? ranges[0].startContainer.parentElement : null);
    if (scrollEl && scrollEl.scrollIntoView) scrollEl.scrollIntoView({ behavior: window.matchMedia('(prefers-reduced-motion: reduce)').matches ? 'auto' : 'smooth', block: 'center', inline: 'nearest' });
  }

  return { count, visible, hidden: count - visible };
}
