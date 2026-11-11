# Changelog

## 1.5.6 - 2026-11-11
- Eliminado el permiso opcional de Gemini, redundante porque el permiso HTTPS general ya lo incluye.
- La revisión con IA conserva la llamada explícita al pulsar el botón; no se ejecuta durante la auditoría normal.

## 1.5.5 - 2026-11-11
- Restaurado el permiso de acceso a páginas HTTP/HTTPS para mantener el análisis automático al cambiar de pestaña.

## 1.5.1 - 2026-11-10
- Conservado el acceso limitado a la pestaña activa; Chrome requiere invocar la extension desde cada pestaña que se quiera analizar.
- La recogida principal vuelve a ser sincrona; robots.txt y llms.txt quedan informativos para evitar bloquear el informe.
- Los errores de inyeccion ahora muestran la causa devuelta por Chrome.

## 1.5.0 - 2026-11-10
- Agrupadas las comprobaciones en diez areas del diagnostico y corregido el calculo para excluir señales informativas.
- Añadidos robots.txt/llms.txt del mismo dominio, sintaxis JSON-LD, URL, favicon, accesibilidad basica y señales WebMCP.
- Añadida una revision editorial opcional con Gemini, iniciada por el usuario y con permiso de red solicitado solo al usarla.
- El informe exportado incluye las diez areas y, si se ejecuto, el resultado de la revision asistida por IA.
- Reducidos los permisos de acceso y documentados los datos enviados a Google al usar la opcion de IA.
- Corregidos saltos de linea y firma en el mensaje sugerido para Leads.

## 1.4.0 — 2026-10-20
- Añadida la pestaña Local con puntuación y comprobaciones de schema, dirección, teléfono, mapas, NAP y reservas.
- Incorporadas comprobaciones de hreflang, contenido mixto y canonical autorreferente; ampliados los detalles de redes y fuentes de autoridad.
- Ajustada la tolerancia de carga diferida de imágenes y el recuento de anclas de sección GEO.
- Añadida firma comercial al informe y al mensaje de contacto, y enlace a Primera Vista en el panel.
- Preparada la localización española para Chrome Web Store y actualizada la versión a 1.4.0.
- Eliminado el listener redundante de instalación del service worker.

## 1.3.0 — 2026-10-14
- Auditoría SEO y E-E-A-T con mejoras de rendimiento local, GEO/AEO, imágenes, contacto, exportación Markdown y resaltado visual.
