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
 *
 * ───────────────────── Backup a GitHub (opcional, mismo patrón que CloudSync.gs) ─────────────────────
 * Deja la nómina como un archivo estático (nomina-backup.json) en el repo — así control-vacaciones.html
 * (o cualquier otro .html del panel) la puede leer con un simple fetch, sin pasar por este backend.
 * 5) Generá un Personal Access Token en GitHub con permiso "repo" (Settings → Developer settings →
 *    Personal access tokens → Fine-grained, con acceso de escritura solo a tu repo del panel).
 * 6) En este proyecto de Apps Script: Configuración (ícono de tuerca) → Propiedades del script → agregá:
 *    GITHUB_TOKEN (tu token), GITHUB_REPO (ej: "tu-usuario/panel-comercial"),
 *    GITHUB_PATH (ej: "nomina-backup.json", es el default si no lo seteás).
 * 7) Botón "☁️ Backup a GitHub" en nomina-produccion.html llama a ?accion=backup_now — no hace falta
 *    trigger de tiempo, es a pedido (el roster no cambia tan seguido como las ventas).
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
    else if (accion === "backup_now") out = backupToGithub_();
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

/* ═══════════════════════════ Backup a GitHub (a pedido) ═══════════════════════════
   Mismo patrón que backupToGithub() de CloudSync.gs — deja la nómina actual como un
   archivo estático en el repo (nomina-backup.json por default) para que cualquier
   otro .html del panel la pueda leer con un simple fetch, sin pasar por este backend. */
function backupToGithub_() {
  var props = PropertiesService.getScriptProperties();
  var token = props.getProperty("GITHUB_TOKEN");
  var repo = props.getProperty("GITHUB_REPO");
  var path = props.getProperty("GITHUB_PATH") || "nomina-backup.json";
  var branch = props.getProperty("GITHUB_BRANCH") || "main";
  if (!token || !repo) {
    return { ok: false, error: "Backup a GitHub no configurado (faltan GITHUB_TOKEN / GITHUB_REPO en Propiedades del script)." };
  }

  var data = leerRoster_();
  var recs = data.recs || [];
  var exportado = new Date().toISOString();
  var content = JSON.stringify({ recs: recs, fileLabel: data.fileLabel || "", exportado: exportado }, null, 0);
  var contentB64 = Utilities.base64Encode(content, Utilities.Charset.UTF_8);

  var apiUrl = "https://api.github.com/repos/" + repo + "/contents/" + path;
  var headers = { Authorization: "Bearer " + token, Accept: "application/vnd.github+json" };

  var sha = null;
  try {
    var getResp = UrlFetchApp.fetch(apiUrl + "?ref=" + branch, { headers: headers, muteHttpExceptions: true });
    if (getResp.getResponseCode() === 200) sha = JSON.parse(getResp.getContentText()).sha;
  } catch (e) { /* archivo no existe todavía, sha queda null */ }

  var payload = {
    message: "Backup de nómina — " + exportado.slice(0, 16).replace("T", " "),
    content: contentB64,
    branch: branch,
  };
  if (sha) payload.sha = sha;

  var putResp = UrlFetchApp.fetch(apiUrl, {
    method: "put",
    headers: headers,
    contentType: "application/json",
    payload: JSON.stringify(payload),
    muteHttpExceptions: true,
  });

  if (putResp.getResponseCode() >= 200 && putResp.getResponseCode() < 300) {
    return { ok: true, count: recs.length, exportado: exportado };
  }
  return { ok: false, error: putResp.getResponseCode() + " " + putResp.getContentText() };
}
