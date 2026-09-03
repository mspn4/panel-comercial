/**
 * AgendaHistorial.gs — Reporte Comercial M&A
 * Lee los backups semanales que genera AgendaBackup.gs (carpeta "Backups Agendas")
 * para que control-agendas.html pueda mostrar semanas anteriores sin salir del panel.
 *
 * No modifica LectorAgendas.gs ni AgendaBackup.gs — es un Web App aparte, mismo
 * patrón que ya usa control-agendas.html con dos backends distintos
 * (APPSSCRIPT_URL / BACKEND_URL). Así no se toca código ya deployado y en uso.
 *
 * ───────────────────────────── SETUP (una sola vez) ─────────────────────────────
 * 1) script.google.com → proyecto nuevo, o archivo nuevo (Archivos → "+" → Script)
 *    dentro del mismo proyecto de AgendaBackup.gs. Prefijo AGENDA_HIST_ en todo
 *    para no chocar con nada que ya exista ahí.
 *
 * 2) Implementar → Nueva implementación → tipo "Aplicación web":
 *      Ejecutar como: Yo
 *      Quién tiene acceso: Cualquier usuario de myacomercial.com (mismo criterio
 *      que LectorAgendas.gs — son los mismos Sheets, misma restricción de dominio)
 *    Guardar y copiar la URL que termina en /exec.
 *
 * 3) Pegar esa URL en CONFIG.HISTORIAL_URL, arriba de control-agendas.html.
 *
 * 4) No hace falta esperar al sábado para probarlo: alcanza con que exista al
 *    menos una carpeta "Semana YYYY-MM-DD" dentro de "Backups Agendas" (la crea
 *    backupAgendasSemanal() de AgendaBackup.gs, se puede ejecutar a mano una vez).
 * ──────────────────────────────────────────────────────────────────────────────
 */

var AGENDA_HIST_ROOT_FOLDER_ID = "1TYavYXNhLUAWShx60ICIC90UYjYZ4Tr6"; // misma carpeta que AgendaBackup.gs
var AGENDA_HIST_SUBFOLDER_NAME = "Backups Agendas";

// Misma lista de sucursales que AGENDA_BACKUP_SUCURSALES en AgendaBackup.gs y que
// CONFIG.SUCURSALES en control-agendas.html — si se agrega/saca una sucursal ahí,
// actualizar acá también.
var AGENDA_HIST_SUCURSALES = [
  { sucursal: "Jujuy" },
  { sucursal: "Salta" },
  { sucursal: "Catamarca" },
  { sucursal: "Norte Centro (Metán)" },
  { sucursal: "Tucumán Capital" },
  { sucursal: "Tucumán Interior (Concepción)" },
  { sucursal: "Santiago del Estero" },
  { sucursal: "Norte Interior (Orán)" },
  { sucursal: "Córdoba" },
  { sucursal: "La Rioja" },
];

function doGet(e) {
  var accion = (e.parameter.accion || "semanas");
  var out;
  try {
    if (accion === "semanas") out = listarSemanas_();
    else if (accion === "leer") out = leerSemana_(e.parameter.semana);
    else out = { error: "Acción desconocida: " + accion };
  } catch (err) {
    out = { error: String(err) };
  }
  return ContentService.createTextOutput(JSON.stringify(out)).setMimeType(ContentService.MimeType.JSON);
}

function getBackupsRoot_() {
  var root = DriveApp.getFolderById(AGENDA_HIST_ROOT_FOLDER_ID);
  var it = root.getFoldersByName(AGENDA_HIST_SUBFOLDER_NAME);
  return it.hasNext() ? it.next() : null;
}

// Devuelve { semanas: ["2026-08-30","2026-08-23",...] } — fecha del sábado de
// cierre de cada backup encontrado, más reciente primero. Lista vacía (no error)
// si todavía no corrió ningún backup — así el selector del frontend se oculta solo.
function listarSemanas_() {
  var backupsRoot = getBackupsRoot_();
  if (!backupsRoot) return { semanas: [] };
  var semanas = [];
  var it = backupsRoot.getFolders();
  while (it.hasNext()) {
    var m = it.next().getName().match(/^Semana (\d{4}-\d{2}-\d{2})$/);
    if (m) semanas.push(m[1]);
  }
  semanas.sort();
  semanas.reverse();
  return { semanas: semanas };
}

// Devuelve { semana, sucursales:[{sucursal, archivo, modificado, hojas:[{nombre,rows}]}
// | {sucursal, error}] } — mismo shape que devuelve LectorAgendas.gs por sucursal,
// para que control-agendas.html reuse el mismo parseAgenda() sin cambios.
function leerSemana_(semana) {
  if (!semana) throw new Error("Falta el parámetro semana");
  var backupsRoot = getBackupsRoot_();
  if (!backupsRoot) throw new Error("Todavía no hay ningún backup guardado");
  var it = backupsRoot.getFoldersByName("Semana " + semana);
  if (!it.hasNext()) throw new Error("No hay backup para la semana " + semana);
  var weekFolder = it.next();

  var sucursales = AGENDA_HIST_SUCURSALES.map(function (s) {
    var archivo = buscarArchivoSucursal_(weekFolder, s.sucursal);
    if (!archivo) return { sucursal: s.sucursal, error: "No se encontró el backup de esta sucursal en esa semana" };
    try {
      var ss = SpreadsheetApp.openById(archivo.getId());
      var hojas = ss.getSheets().map(function (sh) {
        // getDisplayValues() (no getValues()) — el parser del frontend lee texto
        // formateado tipo "02/09"/"09:00", no objetos Date crudos.
        return { nombre: sh.getName(), rows: sh.getDataRange().getDisplayValues() };
      });
      return { sucursal: s.sucursal, archivo: archivo.getName(), modificado: archivo.getLastUpdated().toISOString(), hojas: hojas };
    } catch (err) {
      return { sucursal: s.sucursal, error: String(err) };
    }
  });

  return { semana: semana, sucursales: sucursales };
}

// AgendaBackup.gs nombra cada copia "<Sucursal> — <yyyy-MM-dd>" (em dash con
// espacios a los dos lados) — se busca por ese prefijo dentro de la carpeta de
// la semana, sin depender de la fecha exacta del sufijo.
function buscarArchivoSucursal_(folder, nombreSucursal) {
  var prefijo = nombreSucursal + " — ";
  var it = folder.getFiles();
  while (it.hasNext()) {
    var f = it.next();
    if (f.getName().indexOf(prefijo) === 0) return f;
  }
  return null;
}
