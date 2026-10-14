/**
 * LogisticaBackend.gs — Hoja de ruta semanal (logistica-santiago-estero.html)
 * Persiste en Drive la semana cargada por el gerente de la sucursal (lunes + los 7 días:
 * salida, logística, supervisor, ayudante, vehículo, localidades, observaciones), para que
 * se vea igual desde cualquier navegador/PC en vez de quedar solo en localStorage.
 * Mismo patrón que VacacionesBackend.gs/NominaBackend.gs — sin este backend deployado,
 * el HTML sigue funcionando igual pero guarda solo en el navegador que lo usa.
 *
 * ───────────────────────────── SETUP (una sola vez) ─────────────────────────────
 * 1) script.google.com → proyecto nuevo, o archivo nuevo dentro de un proyecto existente
 *    de este mismo ecosistema.
 * 2) Implementar → Nueva implementación → Aplicación web:
 *      Ejecutar como: Yo
 *      Quién tiene acceso: Cualquier usuario de myacomercial.com (mismo criterio que
 *      el resto de los backends de este panel)
 *    Copiar la URL que termina en /exec.
 * 3) Pegar esa URL en CONFIG.APPSSCRIPT_URL, arriba de logistica-santiago-estero.html.
 * 4) CONFIG.EDIT_KEY en el HTML tiene que coincidir con LOG_EDIT_KEY de acá abajo.
 * ──────────────────────────────────────────────────────────────────────────────
 */

var LOG_ROOT_FOLDER_ID = "1TYavYXNhLUAWShx60ICIC90UYjYZ4Tr6"; // misma carpeta base que Vacaciones/Nómina
var LOG_SUBFOLDER_NAME = "Logistica";
var LOG_FILE_NAME = "logistica-sde-estado.json";
var LOG_EDIT_KEY = "MAeditor2026"; // tiene que ser igual a CONFIG.EDIT_KEY en el HTML

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
    if (body.key !== LOG_EDIT_KEY) throw new Error("Clave de edición incorrecta");
    out = guardarEstado_(body);
  } catch (err) {
    out = { error: String(err) };
  }
  return ContentService.createTextOutput(JSON.stringify(out)).setMimeType(ContentService.MimeType.JSON);
}

function getEstadoFile_(crear) {
  var root = DriveApp.getFolderById(LOG_ROOT_FOLDER_ID);
  var it = root.getFoldersByName(LOG_SUBFOLDER_NAME);
  var folder = it.hasNext() ? it.next() : (crear ? root.createFolder(LOG_SUBFOLDER_NAME) : null);
  if (!folder) return null;
  var fit = folder.getFilesByName(LOG_FILE_NAME);
  if (fit.hasNext()) return fit.next();
  if (!crear) return null;
  var vacio = { lunes: null, rows: [], savedAt: null };
  return folder.createFile(LOG_FILE_NAME, JSON.stringify(vacio), MimeType.PLAIN_TEXT);
}

function leerEstado_() {
  var file = getEstadoFile_(false);
  if (!file) return { lunes: null, rows: [] };
  var data = JSON.parse(file.getBlob().getDataAsString() || "{}");
  return {
    lunes: data.lunes || null,
    rows: data.rows || [],
    savedAt: data.savedAt || null,
  };
}

function guardarEstado_(body) {
  var lock = LockService.getScriptLock();
  lock.waitLock(20000);
  try {
    var file = getEstadoFile_(true);
    var payload = {
      lunes: body.lunes || null,
      rows: body.rows || [],
      savedAt: new Date().toISOString(),
    };
    file.setContent(JSON.stringify(payload));
    return { ok: true, savedAt: payload.savedAt };
  } finally {
    lock.releaseLock();
  }
}
