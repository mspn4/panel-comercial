# M&A Equipamientos Comerciales — Centro de Control

Sebastian: auditor comercial en M&A Equipamientos Comerciales (Tucumán, Argentina). Ecosistema de herramientas HTML estáticas alojadas en **GitHub Pages**, conectadas a Google Drive y Apps Script como backend.

Repo: `mspn4/panel-comercial` (público, branch `main`).

## Arquitectura

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
├── evolucion-vendedores.html
└── ventas-backup.json           ← backup local de ventas

Google Apps Script (3 scripts separados, deployados por afuera de este repo)
├── LectorAgendas.gs             ← lee Sheets de agendas
├── BackendPanel.gs              ← base de conocimiento + recursos gráficos + layout del panel
└── CloudSync.gs                 ← sync de ventas + backup GitHub (vive en este repo, CloudSync.gs)
```

Todos los `.html` son autocontenidos (CSS y JS inline), salvo Google Fonts y librerías CDN. GitHub Pages tarda ~1-2 min en publicar tras un commit.

## Apps Scripts deployados

### 1. LectorAgendas.gs
- URL exec: `https://script.google.com/a/macros/myacomercial.com/s/AKfycby2t4gMNklu9LfYJQdoUt0QW4NZ0MJ7kqU5dilAE1rZc-LBpPRfkHADvZ_2oty54DZj2g/exec`
- Lee las hojas de cada "Espacio de Trabajo" de sucursal (Google Sheets), devuelve JSON con filas de cada agenda.
- Restringido a dominio `@myacomercial.com` (Workspace) → el navegador necesita esa sesión activa.
- Usado por `control-agendas.html`.

### 2. BackendPanel.gs
- URL exec: `https://script.google.com/macros/s/AKfycby3TXMd0s-HJBjyi_i362KIQq_yD_89-f0brHau1K11kLuyzVC7YjbBnHQJS-JX0DmC/exec`
- Base de Conocimiento (listar/subir/editar docs de Drive), Recursos Gráficos (galería de carpetas/imágenes), layout de tarjetas del panel (orden, colores, ocultos).
- Acceso abierto ("Cualquiera") porque los editores usan cuentas `@gmail.com`, no `@myacomercial.com`.
- IDs de carpetas:
  - `KNOWLEDGE_FOLDER_ID`: `1TYavYXNhLUAWShx60ICIC90UYjYZ4Tr6`
  - `GRAPHICS_FOLDER_ID`: `1-3yFjn4uIJBkJtXhM5ZHshav_6Yj40D4`
  - `PANEL_FOLDER_ID`: `1on5Krm-IYHdI2vbew0tvm2sXxKBVhxip`
  - `EDIT_KEY`: la define Sebastian, no está en el código fuente.
- Usado por `index.html`.

### 3. CloudSync.gs — **ya deployado y activo**
- URL exec configurada en `reporte-comercial.html` → `CLOUD_CONFIG.APPSSCRIPT_URL`.
- Recibe ventas nuevas del dashboard, las guarda en `ventas-live.json` en Drive (fuente compartida).
- `dailyGithubBackup`: dispara backup nocturno a GitHub (23:00), usa Script Properties: `GITHUB_TOKEN`, `GITHUB_REPO`, `GITHUB_BRANCH`, `GITHUB_PATH`.
- El archivo `.gs` vive en este repo (`CloudSync.gs`), pero el deploy real está en Apps Script — cualquier cambio acá hay que pegarlo también en el editor de Apps Script y re-deployar.

## Archivos clave

### index.html (Centro de Control)
- Header compacto con buscador universal + botón lápiz (modo edición).
- Grilla de 3 columnas, responsive.
- Modo edición (clave = `EDIT_KEY` de BackendPanel.gs): drag para reordenar, paleta de colores por tarjeta, ocultar/mostrar, agregar tarjetas custom (link a otro `.html`). Persiste en `layout.json` en Drive.
- Card "Base de Conocimiento": modal con lista/grilla de docs de Drive, drag & drop para subir, visor nativo de Drive (iframe) para Word/PDF, editor inline para `.txt`.
- Card "Recursos Gráficos": galería navegable de carpetas, lightbox con Copiar y Descargar.
- Buscador: filtra tarjetas + cuenta coincidencias en docs/imágenes ya visitados.
- `TOOLS` array en `CONFIG` = lista de herramientas link.

### control-agendas.html (Control de Agendas)
- Lee 10 espacios de trabajo (uno por sucursal), pestañas por persona.
- Detecta gerente por apellido (coincide con la pestaña → gerente; resto → líder).
- 3 vistas: por sucursal (acordeón), gerentes (grilla plana), líderes.
- Modal con grilla semanal al click en tarjeta. Auto-refresh cada 10 min + botón manual.
- Parser robusto: detecta fila de fechas por regex, no depende del texto "Horario".

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
- Ventas históricas (enero–junio 2026, ~31k registros). Carga XLS mensual (XLSX.js), merge sin duplicados.
- Persiste en `localStorage` + sincroniza con la nube (CloudSync.gs).
- Flujo: subís XLS → preview → Confirmar → guarda local + `pushToCloud`.
- Al abrir: carga local + `fetchAndMergeCloud()`.
- El histórico incrustado (`<script type="application/json" id="initial-data-embed">`) ya fue vaciado (commit `2ec573f`) — la fuente de verdad es la nube vía CloudSync. Archivo bajó de ~9MB a ~500KB.
- `CLOUD_CONFIG.APPSSCRIPT_URL` ya tiene la URL de CloudSync.gs cargada.

## Stack técnico
- Frontend: HTML + CSS + JS vanilla (sin frameworks). Fonts: DM Sans + JetBrains Mono (Google Fonts).
- Librerías CDN: XLSX.js (SheetJS), Chart.js, Leaflet.js (mapa de zonas).
- Backend: Google Apps Script (Web App), sin servidor propio.
- Storage: Google Drive (fuente compartida) + `localStorage` (caché local del navegador).
- Hosting: GitHub Pages (estático).
- Design tokens: `--navy #0F1B2D`, `--blue #1456A0`, `--orange #F07A1A`, `--ok #1E9E6A`, `--err #D7484B`.

## Notas importantes
- Repo público → los IDs de carpetas de Drive quedan expuestos en el código fuente. Sebastian es consciente y lo acepta (contexto interno).
- `LectorAgendas.gs` restringido a `@myacomercial.com` — sin esa sesión, `control-agendas.html` no funciona.
- Cambios a `CloudSync.gs` en este repo no se auto-deployan: hay que copiarlos al editor de Apps Script y re-deployar como Web App.
