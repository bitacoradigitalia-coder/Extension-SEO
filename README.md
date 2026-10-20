# Primera Vista — Auditor SEO y E-E-A-T

Extensión de Chrome Manifest V3 para revisar señales visibles de SEO, E-E-A-T, GEO/AEO y SEO local desde un panel lateral.

## Privacidad

Todo el análisis se ejecuta localmente en el navegador. No hay llamadas externas ni envío de páginas analizadas a servidores. Los ajustes de nombre y web se guardan en `chrome.storage.local`.

## Instalar o actualizar en Chrome

1. Abre `chrome://extensions` y activa **Modo de desarrollador**.
2. Pulsa **Cargar descomprimida** y selecciona la carpeta del repositorio que contiene `manifest.json`.
3. Abre una página web HTTP/HTTPS y pulsa el icono de Primera Vista.

Para actualizar una instalación local, actualiza el repositorio y pulsa **Recargar** en la tarjeta de la extensión.

## Funciones

- Panel con Resumen, SEO, Estructura, E-E-A-T, GEO/AEO, Imágenes, Contacto, Local y Leads.
- Comprobaciones basadas en el HTML visible y accesible de la página; no sustituye una auditoría técnica integral.
- Exportación y copia de informe Markdown.
- Resaltado de elementos y señales detectadas en la página.

## Chrome Web Store

Antes de enviar una versión, revisa que el nombre, descripción, iconos, capturas y ficha coincidan con el producto. Prueba el ZIP limpio en Chrome, confirma que los permisos solicitados sean necesarios y completa las declaraciones de privacidad y uso de datos de la consola de Chrome Web Store. No publiques claves, datos de usuarios ni artefactos de desarrollo en el paquete.

Las capturas de producto deben guardarse en `docs/screenshots/`. Añade aquí capturas reales del panel en Chrome antes del envío; no se incluyen imágenes de demostración como si fueran capturas del producto.

## Historial

Consulta [CHANGELOG.md](CHANGELOG.md).
