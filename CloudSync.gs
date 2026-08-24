/**
 * CloudSync.gs — Reporte Comercial M&A
 * Guarda las ventas y las reservas cargadas en archivos de Drive (fuente
 * compartida, en vivo) y, una vez al día, deja un respaldo versionado en
 * GitHub con ambas cosas juntas (mismo archivo, ventas-backup.json).
 *
 * ───────────────────────────── SETUP (una sola vez) ─────────────────────────────
 * 1) Creá una carpeta en tu Drive para esto (o reusá una existente) y copiá su ID
 *    (lo que va entre /folders/ y el final de la URL). Pegalo en DATA_FOLDER_ID.
 *
 * 2) Pegá este código en script.google.com → Nuevo proyecto → guardá.
 *
 * 3) (Recomendado) Para arrancar con tu histórico completo en vez de en cero:
 *    - Subí tu último backup JSON exportado a esa misma carpeta de Drive, con el
 *      nombre "seed.json" (tal cual, sin cambiarle nada).
 *    - En el editor de Apps Script, ejecutá UNA VEZ la función `seedFromDrive`
 *      (Ejecutar → seedFromDrive). Revisa el log para confirmar cuántas ventas
 *      importó. Después podés borrar seed.json de Drive si querés.
 *
 * 4) Implementar → Nueva implementación → Aplicación web.
 *    Ejecutar como: Yo. Acceso: Cualquiera (o "Cualquiera de M&A" si todos los
 *    que cargan datos tienen cuenta @myacomercial.com).
 *    Copiá la URL que termina en /exec y pegala en CLOUD_CONFIG.APPSSCRIPT_URL
 *    dentro de reporte-comercial.html.
 *
 * 5) (Opcional pero recomendado) Backup diario a GitHub a las 23:00:
 *    a) Generá un Personal Access Token en GitHub con permiso "repo" (Settings →
 *       Developer settings → Personal access tokens → Fine-grained, con acceso
 *       de escritura solo a tu repo del panel).
 *    b) En Apps Script: Configuración del proyecto (ícono de tuerca) → Propiedades
 *       del script → agregá: GITHUB_TOKEN (tu token), GITHUB_REPO (ej:
 *       "tu-usuario/panel-comercial"), GITHUB_PATH (ej: "ventas-backup.json").
 *    c) En el editor, pestaña Activadores (reloj) → + Agregar activador →
 *       función: dailyGithubBackup → tipo: Basado en tiempo → Temporizador diario
 *       → de 23:00 a 24:00. Guardar.
 *    Cada noche vas a tener un commit en tu repo con la foto completa de ese
 *    momento — útil como historial y como respaldo si algo falla en Drive.
 * ──────────────────────────────────────────────────────────────────────────────
 */

var DATA_FOLDER_ID = "1wBMtyS11uYC2ZcoeJrneCZcmUKOdkz-w";
var LIVE_FILE_NAME = "ventas-live.json";
var RESERVAS_LIVE_FILE_NAME = "reservas-live.json";

/* ═══════════════════════════ Router ═══════════════════════════ */
function doGet(e) {
  try {
    var action = e.parameter.action;
    if (action === "ventas_get") return json({ ventas: leerVentas() });
    if (action === "reservas_get") return json({ reservas: leerReservas() });
    return json({ error: "Acción desconocida: " + action });
  } catch (err) {
    return json({ error: String(err) });
  }
}

function doPost(e) {
  try {
    var body = JSON.parse(e.postData.contents);
    if (body.action === "ventas_add") return json(agregarVentas(body.ventas || []));
    if (body.action === "reservas_set") return json(reemplazarReservas(body.reservas || []));
    return json({ error: "Acción desconocida: " + body.action });
  } catch (err) {
    return json({ error: String(err) });
  }
}

function json(obj) {
  return ContentService.createTextOutput(JSON.stringify(obj)).setMimeType(ContentService.MimeType.JSON);
}

/* ═══════════════════════════ Almacenamiento (Drive) ═══════════════════════════ */
function getDataFolder() {
  return DriveApp.getFolderById(DATA_FOLDER_ID);
}

function findLiveFile() {
  var it = getDataFolder().getFilesByName(LIVE_FILE_NAME);
  return it.hasNext() ? it.next() : null;
}

function findReservasFile() {
  var it = getDataFolder().getFilesByName(RESERVAS_LIVE_FILE_NAME);
  return it.hasNext() ? it.next() : null;
}

function leerVentas() {
  var f = findLiveFile();
  if (!f) return [];
  try {
    var data = JSON.parse(f.getBlob().getDataAsString());
    return data.ventas || [];
  } catch (e) {
    return [];
  }
}

function guardarVentas(ventas) {
  var folder = getDataFolder();
  var content = JSON.stringify({ ventas: ventas, actualizado: new Date().toISOString() });
  var f = findLiveFile();
  if (f) f.setContent(content);
  else folder.createFile(LIVE_FILE_NAME, content, MimeType.PLAIN_TEXT);
}

/**
 * Agrega ventas nuevas al histórico compartido, evitando duplicados por id.
 * Usa un LockService para que dos cargas simultáneas (dos personas subiendo
 * un Excel al mismo tiempo) no se pisen entre sí.
 */
function agregarVentas(nuevas) {
  var lock = LockService.getScriptLock();
  lock.waitLock(20000);
  try {
    var actuales = leerVentas();
    var idsExistentes = {};
    actuales.forEach(function (v) { idsExistentes[v.id] = true; });
    var agregadas = 0;
    nuevas.forEach(function (v) {
      if (!idsExistentes[v.id]) {
        actuales.push(v);
        idsExistentes[v.id] = true;
        agregadas++;
      }
    });
    if (agregadas > 0) guardarVentas(actuales);
    return { ok: true, agregadas: agregadas, total: actuales.length };
  } finally {
    lock.releaseLock();
  }
}

/* ═══════════════════════════ Reservas ═══════════════════════════ */
// A diferencia de ventas (histórico acumulativo), las reservas se reemplazan
// enteras cada vez que alguien carga un excel nuevo en reporte-comercial.html
// — no tiene sentido "agregar", la foto vieja queda obsoleta.
function leerReservas() {
  var f = findReservasFile();
  if (!f) return [];
  try {
    var data = JSON.parse(f.getBlob().getDataAsString());
    return data.reservas || [];
  } catch (e) {
    return [];
  }
}

function guardarReservas(reservas) {
  var folder = getDataFolder();
  var content = JSON.stringify({ reservas: reservas, actualizado: new Date().toISOString() });
  var f = findReservasFile();
  if (f) f.setContent(content);
  else folder.createFile(RESERVAS_LIVE_FILE_NAME, content, MimeType.PLAIN_TEXT);
}

function reemplazarReservas(reservas) {
  var lock = LockService.getScriptLock();
  lock.waitLock(20000);
  try {
    guardarReservas(reservas);
    return { ok: true, total: reservas.length };
  } finally {
    lock.releaseLock();
  }
}

/**
 * Carga inicial desde un backup ya exportado (seed.json en la misma carpeta).
 * Ejecutar UNA SOLA VEZ a mano desde el editor (no se llama desde el dashboard).
 */
function seedFromDrive() {
  var it = getDataFolder().getFilesByName("seed.json");
  if (!it.hasNext()) {
    Logger.log("No encontré seed.json en la carpeta. Subilo primero.");
    return;
  }
  var data = JSON.parse(it.next().getBlob().getDataAsString());
  var ventas = data.ventas || [];
  guardarVentas(ventas);
  Logger.log("Importadas " + ventas.length + " ventas desde seed.json.");
}

/* ═══════════════════════════ Backup diario a GitHub ═══════════════════════════ */
function dailyGithubBackup() {
  var props = PropertiesService.getScriptProperties();
  var token = props.getProperty("GITHUB_TOKEN");
  var repo = props.getProperty("GITHUB_REPO");
  var path = props.getProperty("GITHUB_PATH") || "ventas-backup.json";
  var branch = props.getProperty("GITHUB_BRANCH") || "main";
  if (!token || !repo) {
    Logger.log("Backup a GitHub no configurado (faltan GITHUB_TOKEN / GITHUB_REPO en Propiedades del script). Salteando.");
    return;
  }

  var ventas = leerVentas();
  var reservas = leerReservas();
  var content = JSON.stringify({ ventas: ventas, reservas: reservas, exportado: new Date().toISOString() }, null, 0);
  var contentB64 = Utilities.base64Encode(content, Utilities.Charset.UTF_8);

  var apiUrl = "https://api.github.com/repos/" + repo + "/contents/" + path;
  var headers = {
    Authorization: "Bearer " + token,
    Accept: "application/vnd.github+json",
  };

  // 1) Buscar el sha actual del archivo (si existe) — el API de GitHub lo exige para actualizar.
  var sha = null;
  try {
    var getResp = UrlFetchApp.fetch(apiUrl + "?ref=" + branch, { headers: headers, muteHttpExceptions: true });
    if (getResp.getResponseCode() === 200) {
      sha = JSON.parse(getResp.getContentText()).sha;
    }
  } catch (e) { /* archivo no existe todavía, sha queda null */ }

  // 2) Crear o actualizar el archivo.
  var payload = {
    message: "Backup automático de ventas — " + new Date().toISOString().slice(0, 16).replace("T", " "),
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
    Logger.log("Backup a GitHub OK — " + ventas.length + " ventas, " + reservas.length + " líneas de reservas.");
  } else {
    Logger.log("Error en backup a GitHub: " + putResp.getResponseCode() + " " + putResp.getContentText());
  }
}
