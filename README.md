# Primera Vista - Auditor SEO

Extensión de Chrome Manifest V3 para revisar señales visibles de SEO, E-E-A-T, GEO/AEO y SEO local.

## Privacidad y datos

El analisis de la pagina se ejecuta localmente. No consulta `robots.txt` ni `llms.txt` en el servidor; esas señales quedan informativas. El informe no se envia a un servidor. El analisis con IA es opcional y solo se ejecuta al pulsar el boton en la pestana Contenido. En ese momento se envian a Google Gemini el titulo, hasta 12.000 caracteres del contenido principal y la consulta opcional. La clave API se guarda en `chrome.storage.local`. Google indica que puede usar datos del nivel gratuito para mejorar sus productos; el nivel facturado indica que no. Revisa las condiciones antes de enviar contenido sensible.

El permiso `activeTab` limita el acceso al sitio de la pestaña desde la que se invoca la extension. Para el analisis con IA, el acceso a Google AI se solicita solo al iniciar esa revision.

## Instalar o actualizar

1. Abre `chrome://extensions` y activa el modo de desarrollador.
2. Pulsa **Cargar descomprimida** y selecciona la carpeta que contiene `manifest.json`.
3. Abre una página HTTP/HTTPS y pulsa el icono de Primera Vista.

## Funciones

- Diez áreas de revisión: rastreo e indexación, URL, SEO on-page, contenido, Schema.org, rendimiento, móvil y accesibilidad, E-E-A-T, SEO internacional y señales para IA.
- Pestanas de SEO, estructura, E-E-A-T, GEO/AEO, imágenes, contacto, Local, auditoría, revisión opcional con IA y Leads.
- Exportación Markdown, resaltado en la página y puntuaciones que excluyen señales informativas.
- Las comprobaciones del navegador son indicativas: no sustituyen logs, Search Console, Lighthouse ni una validacion completa de Schema.org.

## Preparación para Chrome Web Store

Antes del envío, prueba el ZIP limpio, confirma que cada permiso siga siendo necesario y completa las declaraciones de privacidad y uso de datos en Chrome Web Store. Incluye capturas reales de la extension, revisa nombre, descripcion, iconos y ficha, y no empaquetes claves API ni artefactos de desarrollo.

## Desarrollo

Ejecuta `node --test` para las pruebas del motor y `node --check` sobre los archivos JavaScript antes de empaquetar. Consulta [CHANGELOG.md](CHANGELOG.md).
