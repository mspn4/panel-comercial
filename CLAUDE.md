# Panel Comercial — CLAUDE.md

> **Instrucción para Claude (aplica siempre en este repo):** este archivo es la fuente de estado vivo del proyecto. Cada vez que termines trabajo en algún archivo del repo (cambio funcional, fix, feature nueva, deploy pendiente que se resolvió, etc.), actualizá VOS MISMO la sección correspondiente en "Estado actual por archivo" (qué se hizo, qué queda pendiente) antes de cerrar el tema — sin que el usuario tenga que pedirlo. Si el cambio no encaja en ninguna sección existente, creá una. Mantené cada sección corta (3-6 líneas). No dupliques acá el detalle de arquitectura/URLs/IDs que ya está en `handoff.md` — solo linkealo.

## Qué es esto

Sebastian es auditor comercial en M&A Equipamientos Comerciales (Tucumán, Argentina). Repo público en GitHub Pages con dashboards HTML autocontenidos + backend en Google Apps Script. Detalle completo de arquitectura, URLs de deploy, IDs de Drive y config de sucursales: ver `handoff.md`.

## Estado actual por archivo

### reporte-comercial.html
- Dashboard de producción por zona. Ventas históricas ene-jun 2026 (~31k registros), carga XLS, merge sin duplicados.
- **Pendiente:** eliminar bloque `<script type="application/json" id="initial-data-embed">` (~9MB incrustado) y reemplazar por JSON mínimo vacío (estructura en `handoff.md`), para que la fuente de verdad pase a ser la nube vía `CloudSync.gs`.
- Verificar que sigan intactos: `CLOUD_CONFIG.APPSSCRIPT_URL`, `fetchAndMergeCloud()`, `pushToCloud()`, llamada a `pushToCloud` en `confirmUpload`.
- Pestaña IA depende de `AIProxy.gs` (pendiente de deploy) + `AI_CONFIG.APPSSCRIPT_URL` (vacío hasta deployar).

### control-agendas.html
- Lee 10 espacios de trabajo (Sheets por sucursal) vía `LectorAgendas.gs` (ya deployado, restringido a @myacomercial.com).
- Parser de fechas por regex `dd/mm`, robusto. Si aparece fecha rara, es dato mal cargado en el Sheet, no bug del parser.
- `gerente` en `CONFIG.SUCURSALES` acepta string o array de apellidos candidatos (ej. La Rioja: `["Rios","Nieto"]`) — evita falsos "líder" cuando no se sabe exacto cómo está escrito el apellido en la pestaña, o cambió la persona.
- Label "Semana X" ahora sale de la misma hoja que da los días mostrados (`ref`), no de la primera hoja con la palabra "semana" que se encontraba (podía ser de otra sucursal).
- Backup semanal (sábados) de los 10 Sheets vía `AgendaBackup.gs` — pendiente de deploy, ver abajo.

### index.html
- Centro de Control / portal. Modo edición con `EDIT_KEY` (BackendPanel.gs): reordenar tarjetas, colores, ocultar, agregar custom. Persiste en `layout.json` (Drive).
- Cards especiales: "Base de Conocimiento" (docs Drive) y "Recursos Gráficos" (galería imágenes).
- Sin pendientes conocidos al momento de este handoff.

### nomina-produccion.html
- Dashboard de headcount de producción por sucursal/categoría (NO es una ficha de legajos completa). Plano base actualizado (2026-07-24) con los 424 empleados del xlsx `listado empleados.xlsx` provisto por el usuario → 223 clasificados como producción.
- **Clasificación reescrita:** ahora usa `classifyEmployee(tarea, tipodven)` — prioriza la columna `tipodven` del xlsx (viene pre-clasificada de origen y separa producción/no-producción sin ambigüedad, validado 1:1 contra los datos reales); si el archivo cargado no trae esa columna (formato viejo de 7 columnas), cae a `TAREA_ALIAS` por texto de `tarea` como antes.
- **Categoría nueva:** "Líder Redes" (`tipodven=LIDER POR REDES` / `tarea=LIDER REDES`, 2 personas), agregada en `CAT_ORDER`/`CAT_COLOR`/`CAT_SHORT`/`TAREA_ALIAS` + var CSS `--c-liderredes`.
- Carga de xlsx (botón "Cargar plano") reconoce automáticamente `tipodven` si está en los headers (`COLS_OPT`), sin romper compatibilidad con planos viejos que no la tengan.
- **Pendiente:** reflejar en la app la info de la hoja de Drive `1gijnFhygEnvKz7pYp81cJCIgWAa5hIGrRGl_1zyxrfk` — bloqueado hasta que el usuario comparta acceso con `sebastianpereznieva@gmail.com` (la cuenta de Drive conectada no tenía permiso).

### cotizador-comparativo-v3.html / planes-vigentes-tarjetas.html / circuito-ventas-entes-publicos-caso2-mercaderia-remitida.html / proyeccion-gerentes-dashboard.html / informe-showroom-sucursales.html / evolucion-vendedores.html
- Sin trabajo reciente registrado. Actualizar esta sección (o separarla) la primera vez que se toque alguno.

## Apps Script — pendientes de deploy

- `AIProxy.gs` — pendiente. Ver pasos en `handoff.md`.
- `AgendaBackup.gs` — pendiente. Puede ir como archivo nuevo dentro del proyecto de `LectorAgendas.gs` (variables con prefijo `AGENDA_BACKUP_` a propósito, para no chocar con nada de ese script) o en proyecto aparte. Ver pasos en `handoff.md`.

## Notas rápidas

- IDs de Drive expuestos en código a propósito (repo público, aceptado por el usuario).
- GitHub Pages tarda ~1-2 min en publicar tras commit.
