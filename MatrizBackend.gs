/**
 * MatrizBackend.gs — Matriz de Trabajo Comercial (matriz-trabajo-comercial.html)
 * Persiste en Drive el seguimiento de KPI/plan de acción por persona (historial
 * acumulativo: cada actualización se guarda como una entrada nueva, no se pisa
 * nada), las listas editables de los selectores (Sucursal/KPI/Tipo KPI/Plan de
 * acción/Estado/Plazo/Responsables) y el log de auditoría — mismo patrón que
 * VacacionesBackend.gs/LogisticaBackend.gs. Sin este backend deployado, el HTML
 * sigue funcionando igual pero guarda solo en el navegador que lo usa.
 *
 * La nómina (legajo/nombre/tarea/sucursal) NO se guarda acá — se sincroniza en
 * vivo desde NominaBackend.gs (el mismo backend que ya usa nomina-produccion.html
 * y control-vacaciones.html), para no tener que subir el mismo Excel dos veces.
 * Este backend solo tiene el fallback manual de Excel cuando NominaBackend no
 * está disponible (se guarda como "rosterManual", ver guardarRosterManual_).
 *
 * ───────────────────────────── SETUP (una sola vez) ─────────────────────────────
 * 1) script.google.com → proyecto nuevo, o archivo nuevo dentro de un proyecto
 *    existente de este mismo ecosistema (prefijo MTZ_ para no chocar con nada).
 * 2) Implementar → Nueva implementación → Aplicación web:
 *      Ejecutar como: Yo
 *      Quién tiene acceso: Cualquier usuario de myacomercial.com (mismo criterio
 *      que el resto de los backends de este panel)
 *    Copiar la URL que termina en /exec.
 * 3) Pegar esa URL en CONFIG.APPSSCRIPT_URL, arriba de matriz-trabajo-comercial.html.
 * 4) CONFIG.EDIT_KEY en el HTML tiene que coincidir con MTZ_EDIT_KEY de acá abajo
 *    (esto NO es el usuario/contraseña de "Modo edición" — ese es un gate aparte,
 *    cosmético, en el propio HTML. Esta clave es la que protege la escritura a
 *    este backend).
 * ──────────────────────────────────────────────────────────────────────────────
 */

var MTZ_ROOT_FOLDER_ID = "1TYavYXNhLUAWShx60ICIC90UYjYZ4Tr6"; // misma carpeta base que Vacaciones/Nómina/Logística
var MTZ_SUBFOLDER_NAME = "Matriz Comercial";
var MTZ_FILE_NAME = "matriz-comercial-estado.json";
var MTZ_EDIT_KEY = "MAeditor2026"; // tiene que ser igual a CONFIG.EDIT_KEY en el HTML

function doGet(e) {
  var accion = (e.parameter.accion || "leer");
  var out;
  try {
    if (accion === "leer") out = leerEstado_();
    else out = { error: "Acción desconocida: " + accion };
  } catch (err) {
    out = { error: String(err) };
  }
  return ContentService.createTextOutput(JSON.stringify(out)).setMimeType(ContentService.MimeType.JSON);
}

function doPost(e) {
  var out;
  try {
    var body = JSON.parse(e.postData.contents || "{}");
    if (body.key !== MTZ_EDIT_KEY) throw new Error("Clave de edición incorrecta");
    out = guardarEstado_(body);
  } catch (err) {
    out = { error: String(err) };
  }
  return ContentService.createTextOutput(JSON.stringify(out)).setMimeType(ContentService.MimeType.JSON);
}

function getEstadoFile_(crear) {
  var root = DriveApp.getFolderById(MTZ_ROOT_FOLDER_ID);
  var it = root.getFoldersByName(MTZ_SUBFOLDER_NAME);
  var folder = it.hasNext() ? it.next() : (crear ? root.createFolder(MTZ_SUBFOLDER_NAME) : null);
  if (!folder) return null;
  var fit = folder.getFilesByName(MTZ_FILE_NAME);
  if (fit.hasNext()) return fit.next();
  if (!crear) return null;
  var vacio = { entradas: [], observaciones: {}, listas: {}, rosterManual: [], log: [], savedAt: null };
  return folder.createFile(MTZ_FILE_NAME, JSON.stringify(vacio), MimeType.PLAIN_TEXT);
}

function leerEstado_() {
  var file = getEstadoFile_(false);
  if (!file) return { entradas: [], observaciones: {}, listas: {}, rosterManual: [], log: [] };
  var data = JSON.parse(file.getBlob().getDataAsString() || "{}");
  return {
    entradas: data.entradas || [],
    observaciones: data.observaciones || {},
    listas: data.listas || {},
    rosterManual: data.rosterManual || [],
    log: data.log || [],
    savedAt: data.savedAt || null,
  };
}

function guardarEstado_(body) {
  var lock = LockService.getScriptLock();
  lock.waitLock(20000);
  try {
    var file = getEstadoFile_(true);
    var payload = {
      entradas: body.entradas || [],
      observaciones: body.observaciones || {},
      listas: body.listas || {},
      rosterManual: body.rosterManual || [],
      log: body.log || [],
      savedAt: new Date().toISOString(),
    };
    file.setContent(JSON.stringify(payload));
    return { ok: true, savedAt: payload.savedAt, count: payload.entradas.length };
  } finally {
    lock.releaseLock();
  }
}
