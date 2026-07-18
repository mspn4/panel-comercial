# M&A Equipamientos Comerciales — Centro de Control · Handoff para Claude Code

## Contexto general

Sebastian es auditor comercial en M&A Equipamientos Comerciales (Tucumán, Argentina). Construimos un ecosistema de herramientas HTML estáticas alojadas en **GitHub Pages**, conectadas a Google Drive y Apps Script como backend.

---

## Arquitectura general

```
GitHub Pages (repo público)
├── index.html                   ← Centro de Control (portal/índice)
├── reporte-comercial.html       ← Dashboard de producción por zona
├── control-agendas.html         ← Agendas de gerentes y líderes
├── cotizador-comparativo-v3.html
├── planes-vigentes-tarjetas.html
├── nomina-produccion.html
├── circuito-ventas-entes-publicos-caso2-mercaderia-remitida.html
├── proyeccion-gerentes-dashboard.html
├── informe-showroom-sucursales.html
└── evolucion-vendedores.html

Google Apps Script (2 scripts separados)
├── LectorAgendas.gs             ← Lee Sheets de agendas (ya deployado)
├── BackendPanel.gs              ← Base de conocimiento + Recursos Gráficos + layout (ya deployado)
└── CloudSync.gs                 ← Sync de ventas + backup GitHub (PENDIENTE de deploy)
```

---

## Apps Scripts deployados

### 1. LectorAgendas.gs
- **URL exec:** `https://script.google.com/a/macros/myacomercial.com/s/AKfycby2t4gMNklu9LfYJQdoUt0QW4NZ0MJ7kqU5dilAE1rZc-LBpPRfkHADvZ_2oty54DZj2g/exec`
- **Función:** Lee las hojas de cada "Espacio de Trabajo" de sucursal (Google Sheets) y devuelve JSON con las filas de cada agenda.
- **Restricción:** dominio @myacomercial.com (Workspace).
- **Usado por:** `control-agendas.html`

### 2. BackendPanel.gs
- **URL exec:** `https://script.google.com/macros/s/AKfycby3TXMd0s-HJBjyi_i362KIQq_yD_89-f0brHau1K11kLuyzVC7YjbBnHQJS-JX0DmC/exec`
- **Función:** Base de Conocimiento (listar/subir/editar docs de Drive), Recursos Gráficos (galería de carpetas/imágenes), layout de tarjetas del panel (orden, colores, ocultos).
- **IDs de carpetas ya configurados:**
  - `KNOWLEDGE_FOLDER_ID`: `1TYavYXNhLUAWShx60ICIC90UYjYZ4Tr6`
  - `GRAPHICS_FOLDER_ID`: `1-3yFjn4uIJBkJtXhM5ZHshav_6Yj40D4`
  - `PANEL_FOLDER_ID`: `1on5Krm-IYHdI2vbew0tvm2sXxKBVhxip`
  - `EDIT_KEY`: Sebastian debe definirlo (clave propia, no está en el código fuente).
- **Usado por:** `index.html`

### 3. CloudSync.gs ← **PENDIENTE DE DEPLOY**
- **Función:** Recibe ventas nuevas del dashboard, las guarda en `ventas-live.json` en Drive (fuente compartida), y tiene una función `dailyGithubBackup` para disparar a las 23:00.
- **Pendiente del usuario:**
  1. Crear carpeta en Drive, pegar su ID en `DATA_FOLDER_ID`.
  2. Subir el último backup JSON como `seed.json` en esa carpeta.
  3. Ejecutar `seedFromDrive()` una vez a mano desde el editor.
  4. Deploy como Web App (Ejecutar como: Yo, Acceso: Cualquiera).
  5. Copiar la URL `/exec` y pegarla en `CLOUD_CONFIG.APPSSCRIPT_URL` dentro de `reporte-comercial.html`.
  6. (Opcional) Configurar backup nocturno a GitHub: token en Script Properties (`GITHUB_TOKEN`, `GITHUB_REPO`, `GITHUB_BRANCH`, `GITHUB_PATH`), agregar disparador diario sobre `dailyGithubBackup` a las 23:00.

---

## Archivos clave

### index.html (Centro de Control)
- Header compacto con buscador universal y botón lápiz (modo edición).
- Grilla de 3 columnas, responsive.
- **Modo edición** (requiere clave = `EDIT_KEY` del BackendPanel.gs):
  - Drag para reordenar tarjetas.
  - Paleta de colores de acento por tarjeta.
  - Ocultar/mostrar tarjetas (ojo).
  - Agregar tarjetas custom (link a otro `.html`).
  - Todo persiste en `layout.json` en Drive (via BackendPanel.gs).
- **Card "Base de Conocimiento":** Modal con lista/grilla de docs de Drive, drag & drop para subir archivos, visor nativo de Drive (iframe) para Word/PDF, editor inline para .txt.
- **Card "Recursos Gráficos":** Galería navegable de carpetas, lightbox con Copiar y Descargar.
- **Buscador:** filtra tarjetas + avisa cuántas coincidencias hay en docs/imágenes ya visitados.
- `TOOLS` array en CONFIG = lista de herramientas link.

### control-agendas.html (Control de Agendas)
- Lee 10 espacios de trabajo (uno por sucursal), cada uno con pestañas por persona.
- Detecta gerente por apellido (vs. líderes = resto de pestañas).
- 3 vistas: Por sucursal (acordeón), Gerentes (grilla plana), Líderes.
- Acordeón desplegable por sucursal, buscador, semáforo de actualización.
- Modal con grilla semanal al hacer click en una tarjeta.
- Parser robusto de agenda: detecta fila de fechas por expresión regular (no depende de "Horario").
- Auto-refresh cada 10 min + botón manual.
- **Sucursales configuradas:**

| Sucursal | Gerente | ID del Spreadsheet |
|---|---|---|
| Jujuy | Arjona | `1uEQFhrVYgU_pEIQwcYo7YNkwIULCBlSj-p7ED_-Of5E` |
| Salta | Gomez | `1FvqJ_-WRzo964DB_iD5bZbzuFFLf-mT8FVsTKJWWq7Q` |
| Catamarca | Ludueña | `1CD5wnnnF05HzcLBZidaaOJIV8uUkCRhrWpTYGfsmGAM` |
| Norte Centro (Metán) | Guipponi | `1Jf00dhHO0YXeyppkaoiCVhOWuyxXTh0pYHpR_O2yklE` |
| Tucumán Capital | Roig | `1DTkJ0jk_XFXx1o2j34lnws_Eqk6xCAXerBn10qkDemY` |
| Tucumán Interior (Concepción) | Yamil | `1m2UAqC7sXm54UeTWSGrPPRPEZrQ3ojUlH3pMdX_iRqs` |
| Santiago del Estero | Depetris | `1lagOoU5U0hpRl0KmgpcVJJa-_6iRsjHvR7ueZYdGpxQ` |
| Norte Interior (Orán) | Fontana | `1URImDoHMpH8efT1q0I2_-JhcA1A4n6pdtqINCiI8jzI` |
| Córdoba | Rodriguez | `1-IbUhBpupGj4m0Ne_sXHTRTYit01ccSVclSjKwFbTmI` |
| La Rioja | Nieto | `10ukyFt2hdxcb-VgWdqN-_7-y37YIBfBrel0rtq08wd8` |

### reporte-comercial.html (Dashboard de Producción)
- Dashboard complejo con ventas históricas (enero–junio 2026, ~31k registros).
- Carga datos desde XLS mensual (XLSX.js), merge inteligente sin duplicados.
- Persiste en `localStorage` + ahora también sincroniza con la nube (CloudSync.gs).
- Flujo de carga: subís XLS → preview → Confirmar → guarda local + push a Drive.
- Al abrir: carga local + `fetchAndMergeCloud()` para sincronizar novedades.
- **Estado actual:** el archivo tiene datos históricos incrustados en un `<script type="application/json" id="initial-data-embed">`. **TAREA PENDIENTE: eliminar ese bloque y reemplazar por un array vacío**, para que la fuente de verdad sea exclusivamente la nube (CloudSync).
- `CLOUD_CONFIG.APPSSCRIPT_URL` debe completarse una vez deployado CloudSync.gs.

---

## Tarea inmediata para Claude Code

### 1. Limpiar `reporte-comercial.html` del histórico incrustado

El archivo tiene un bloque `<script type="application/json" id="initial-data-embed">` con ~31k registros de ventas incrustados como JSON. Hay que:

1. Encontrar ese bloque: `<script type="application/json" id="initial-data-embed">…</script>`
2. Reemplazar el contenido JSON por el mínimo estructural válido (ventas vacías pero con todas las claves que `INITIAL_DATA` necesita para no romper nada al arrancar sin localStorage):

```json
{
  "version": "1.1",
  "maestras": { "vendedores": [], "zonas": [], "cobradores": [] },
  "ventas": [],
  "meses_cargados": {},
  "matriz_condiciones": {},
  "reservas": [],
  "vendedoresMaster": [],
  "equiposComerciales": [],
  "equiposRedes": [],
  "objetivos": {},
  "sucursalAlias": {},
  "objetivosCobrador": {},
  "zonaPolygons": {}
}
```

3. Verificar que el HTML siga siendo sintácticamente válido y que `INITIAL_DATA` se siga cargando desde `document.getElementById('initial-data-embed').textContent`.
4. El archivo resultante debe ser mucho más liviano (~500KB vs ~9MB actual).

### 2. Verificar que las funciones de sync estén intactas

Confirmar que `reporte-comercial.html` contiene:
- `const CLOUD_CONFIG = { APPSSCRIPT_URL: "" }` (con URL vacía por ahora).
- Función `fetchAndMergeCloud()`.
- Función `pushToCloud(nuevasVentas)`.
- Llamada a `pushToCloud(pendingUpload.newRows)` dentro del handler de `confirmUpload`.
- Llamada a `fetchAndMergeCloud()` al final del script (después del `render()`).

---

## Stack técnico

- **Frontend:** HTML + CSS + JS vanilla (sin frameworks). Fonts: DM Sans + JetBrains Mono (Google Fonts).
- **Librerías externas (CDN):** XLSX.js (SheetJS), Chart.js, Leaflet.js (mapa de zonas).
- **Backend:** Google Apps Script (Web App) — sin servidor propio.
- **Storage:** Google Drive (fuente compartida) + localStorage del navegador (caché local).
- **Hosting:** GitHub Pages (estático, repo público).
- **Design tokens:** `--navy #0F1B2D`, `--blue #1456A0`, `--orange #F07A1A`, `--ok #1E9E6A`, `--err #D7484B`.

---

## Notas importantes

- Los archivos `.html` son autocontenidos (CSS y JS inline), excepto Google Fonts y librerías CDN.
- GitHub Pages tarda ~1-2 min en publicar tras un commit.
- El repo es público → los IDs de carpetas de Drive quedan expuestos en el código fuente. Sebastian es consciente de esto y lo acepta dado el contexto interno.
- `BackendPanel.gs` usa acceso abierto (Cualquiera) porque los editores tienen cuentas @gmail.com, no @myacomercial.com.
- `LectorAgendas.gs` está restringido a @myacomercial.com — el navegador debe tener esa sesión activa para que `control-agendas.html` funcione.
- La detección de gerente en `control-agendas.html` es por apellido: si el nombre de la pestaña contiene el apellido configurado → gerente; el resto → líder.
