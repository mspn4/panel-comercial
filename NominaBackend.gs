/**
 * NominaBackend.gs — Reporte Comercial M&A
 * Persiste en Drive la nómina de producción de nomina-produccion.html: cada vez que se
 * importa un .xlsx nuevo, o se edita una persona en vivo (sucursal, categoría, nombre,
 * baja/reactivación), el frontend guarda acá el estado completo — así cualquier
 * dispositivo que abra el panel ve siempre la última versión, sin depender de RAW_DEFAULT
 * (que queda solo como semilla inicial para cuando este backend todavía no está conectado).
 *
 * ───────────────────────────── SETUP (una sola vez) ─────────────────────────────
 * 1) script.google.com → proyecto nuevo, o archivo nuevo dentro de un proyecto existente
 *    de este mismo ecosistema (prefijo NOMINA_ para no chocar con nada).
 * 2) Implementar → Nueva implementación → Aplicación web:
 *      Ejecutar como: Yo
 *      Quién tiene acceso: Cualquier usuario de myacomercial.com (mismo criterio que
 *      el resto de los backends de este panel)
 *    Copiar la URL que termina en /exec.
 * 3) Pegar esa URL en CONFIG.APPSSCRIPT_URL, arriba de nomina-produccion.html.
 * 4) CONFIG.EDIT_KEY en el HTML tiene que coincidir con NOMINA_EDIT_KEY de acá abajo.
 * ──────────────────────────────────────────────────────────────────────────────
 */

var NOMINA_ROOT_FOLDER_ID = "1TYavYXNhLUAWShx60ICIC90UYjYZ4Tr6"; // misma carpeta base que Base de Conocimiento / Backups Agendas
var NOMINA_SUBFOLDER_NAME = "Nomina Produccion";
var NOMINA_FILE_NAME = "nomina-roster.json";
var NOMINA_EDIT_KEY = "MAeditor2026"; // tiene que ser igual a CONFIG.EDIT_KEY en el HTML

function doGet(e) {
  var accion = (e.parameter.accion || "leer");
  var out;
  try {
    if (accion === "leer") out = leerRoster_();
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
    if (body.key !== NOMINA_EDIT_KEY) throw new Error("Clave de edición incorrecta");
    if (!Array.isArray(body.recs)) throw new Error("Falta 'recs' (array)");
    out = guardarRoster_(body.recs, body.fileLabel || "");
  } catch (err) {
    out = { error: String(err) };
  }
  return ContentService.createTextOutput(JSON.stringify(out)).setMimeType(ContentService.MimeType.JSON);
}

function getRosterFile_(crear) {
  var root = DriveApp.getFolderById(NOMINA_ROOT_FOLDER_ID);
  var it = root.getFoldersByName(NOMINA_SUBFOLDER_NAME);
  var folder = it.hasNext() ? it.next() : (crear ? root.createFolder(NOMINA_SUBFOLDER_NAME) : null);
  if (!folder) return null;
  var fit = folder.getFilesByName(NOMINA_FILE_NAME);
  if (fit.hasNext()) return fit.next();
  if (!crear) return null;
  return folder.createFile(NOMINA_FILE_NAME, JSON.stringify({ recs: [], fileLabel: "", savedAt: null }), MimeType.PLAIN_TEXT);
}

function leerRoster_() {
  var file = getRosterFile_(false);
  if (!file) return { recs: null };
  var data = JSON.parse(file.getBlob().getDataAsString() || "{}");
  return { recs: data.recs || null, fileLabel: data.fileLabel || "", savedAt: data.savedAt || null };
}

function guardarRoster_(recs, fileLabel) {
  var file = getRosterFile_(true);
  var payload = { recs: recs, fileLabel: fileLabel, savedAt: new Date().toISOString() };
  file.setContent(JSON.stringify(payload));
  return { ok: true, savedAt: payload.savedAt, count: recs.length };
}
