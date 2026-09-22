/**
 * VacacionesBackend.gs — Control de Vacaciones M&A
 * Persiste en Drive el estado completo de control-vacaciones.html: nómina (sucursal/fuerza
 * de venta), períodos de vacaciones, feriados, reglas de solape y el historial de cambios.
 * Mismo patrón que NominaBackend.gs — sin este backend deployado, el HTML sigue funcionando
 * igual pero guarda solo en localStorage del navegador que lo usa.
 *
 * ───────────────────────────── SETUP (una sola vez) ─────────────────────────────
 * 1) script.google.com → proyecto nuevo, o archivo nuevo dentro de un proyecto existente
 *    de este mismo ecosistema (prefijo VAC_ para no chocar con nada).
 * 2) Implementar → Nueva implementación → Aplicación web:
 *      Ejecutar como: Yo
 *      Quién tiene acceso: Cualquier usuario de myacomercial.com (mismo criterio que
 *      el resto de los backends de este panel)
 *    Copiar la URL que termina en /exec.
 * 3) Pegar esa URL en CONFIG.APPSSCRIPT_URL, arriba de control-vacaciones.html.
 * 4) CONFIG.EDIT_KEY en el HTML tiene que coincidir con VAC_EDIT_KEY de acá abajo.
 * ──────────────────────────────────────────────────────────────────────────────
 */

var VAC_ROOT_FOLDER_ID = "1TYavYXNhLUAWShx60ICIC90UYjYZ4Tr6"; // misma carpeta base que Base de Conocimiento / Nomina Produccion
var VAC_SUBFOLDER_NAME = "Vacaciones";
var VAC_FILE_NAME = "vacaciones-estado.json";
var VAC_EDIT_KEY = "MAeditor2026"; // tiene que ser igual a CONFIG.EDIT_KEY en el HTML

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
    if (body.key !== VAC_EDIT_KEY) throw new Error("Clave de edición incorrecta");
    out = guardarEstado_(body);
  } catch (err) {
    out = { error: String(err) };
  }
  return ContentService.createTextOutput(JSON.stringify(out)).setMimeType(ContentService.MimeType.JSON);
}

function getEstadoFile_(crear) {
  var root = DriveApp.getFolderById(VAC_ROOT_FOLDER_ID);
  var it = root.getFoldersByName(VAC_SUBFOLDER_NAME);
  var folder = it.hasNext() ? it.next() : (crear ? root.createFolder(VAC_SUBFOLDER_NAME) : null);
  if (!folder) return null;
  var fit = folder.getFilesByName(VAC_FILE_NAME);
  if (fit.hasNext()) return fit.next();
  if (!crear) return null;
  var vacio = { roster: [], periodos: [], feriados: [], reglas: { defaultMax: 1, maxPorFuerza: {}, excluyentes: [] }, log: [], savedAt: null };
  return folder.createFile(VAC_FILE_NAME, JSON.stringify(vacio), MimeType.PLAIN_TEXT);
}

function leerEstado_() {
  var file = getEstadoFile_(false);
  if (!file) return { roster: null };
  var data = JSON.parse(file.getBlob().getDataAsString() || "{}");
  return {
    roster: data.roster || null,
    periodos: data.periodos || [],
    feriados: data.feriados || [],
    reglas: data.reglas || { defaultMax: 1, maxPorFuerza: {}, excluyentes: [] },
    log: data.log || [],
    savedAt: data.savedAt || null,
  };
}

function guardarEstado_(body) {
  var file = getEstadoFile_(true);
  var payload = {
    roster: body.roster || [],
    periodos: body.periodos || [],
    feriados: body.feriados || [],
    reglas: body.reglas || { defaultMax: 1, maxPorFuerza: {}, excluyentes: [] },
    log: (body.log || []).slice(0, 1000), // tope razonable, evita que el archivo crezca sin límite
    savedAt: new Date().toISOString(),
  };
  file.setContent(JSON.stringify(payload));
  return { ok: true, savedAt: payload.savedAt, count: payload.periodos.length };
}
