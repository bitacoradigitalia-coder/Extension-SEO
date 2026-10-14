# Primera Vista · Auditor SEO y E-E-A-T · 1.3.0

## Instalar o actualizar en Chrome
1. Abre `chrome://extensions` y activa **«Modo de desarrollador»** (esquina superior derecha).
2. Si ya la tenías instalada cargada desde una carpeta local:
   - Haz clic en el botón de **Recargar (icono 🔄)** de la tarjeta de la extensión.
   - *Nota:* Si la tienes cargada desde otra carpeta distinta a este repositorio, pulsa «Cargar descomprimida» y selecciona esta carpeta `extension-seo` (o copia estos archivos a tu carpeta instalada).
3. Si la instalas por primera vez:
   - Pulsa **«Cargar descomprimida»** y selecciona la carpeta del repositorio que contiene `manifest.json`.
4. Abre cualquier página web (HTTP/HTTPS) y haz clic en el icono de Primera Vista en la barra o menú de extensiones para abrir el panel lateral.

## ¿Se actualiza Chrome automáticamente al hacer push en GitHub?
**No de forma automática directa desde GitHub.**
Las extensiones cargadas en «Modo desarrollador» (descomprimidas) se leen directamente desde la carpeta física en tu ordenador.
- Al clonar o actualizar los archivos en tu disco local, solo debes entrar en `chrome://extensions` y hacer clic en el botón **Recargar (🔄)**.
- Una vez recargada, los cambios entran en vigor de inmediato.

## Novedades y mejoras en versión 1.3.0
- **Corrección crítica en pestaña Imágenes**: Ahora se auditan de forma veraz los atributos `loading="lazy"` y las dimensiones explícitas (`width`/`height`) para prevención de saltos de diseño (*CLS*).
- **Corrección crítica en pestaña Contacto**: Detección real de formularios HTML, formularios con campos de contacto y botones de llamada a la acción (*CTAs*).
- **Rendimiento local (Zero-Requests)**: Medición de *TTFB* (Time to First Byte) y scripts bloqueantes en el `<head>` mediante la API estándar `Navigation Timing` sin llamadas a servicios externos.
- **Iconos oficiales integrados**: Añadidos iconos en 16px, 32px, 48px y 128px al manifiesto y barra de extensiones.
- **GEO / AEO avanzado**: Detección de tablas de contenidos (*TOC*) y anclas internas por sección para facilitar citación en motores generativos de IA.
- **Exportación mejorada**: Botón «Descargar .md» en el pie del panel para guardar el informe como archivo local sin depender únicamente del portapapeles.

## Uso
- Pasa el cursor por una comprobación o enfoca su botón con el teclado para localizar los elementos sin desplazar la web.
- Pulsa una fila, un encabezado o un contador H1–H6 para resaltar y desplazarte hasta el primer elemento visible.
- «Quitar resaltado» elimina las marcas. La marca permanece al retirar el cursor para poder inspeccionarla en la web.
- Cada punto mejorable incluye «Qué mejorar». Al copiar o descargar el informe se copian también estas recomendaciones.
- Pestañas: **Resumen, SEO, Estructura, E-E-A-T, GEO/AEO, Imágenes, Contacto y Leads**.
- Al cambiar de pestaña o recargar la página activa se reanaliza automáticamente.

## Privacidad y límites
- El análisis se procesa de forma 100% local en tu navegador.
- Los datos de tu marca o perfil se guardan únicamente en `chrome.storage.local`.
- No envía datos a servidores externos.

