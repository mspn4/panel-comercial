/**
 * AgendaBackup.gs — Reporte Comercial M&A
 * Guarda una copia completa de cada espacio de trabajo de Agendas (los mismos
 * Google Sheets que lee LectorAgendas.gs) todas las semanas, para tener
 * historial. Se dispara sola con un trigger semanal (sábados, cierre de semana).
 *
 * ───────────────────────────── SETUP (una sola vez) ─────────────────────────────
 * 1) Pegá este código en script.google.com → Nuevo proyecto → guardá.
 *    (Puede ser el mismo proyecto de LectorAgendas.gs o uno nuevo, da igual.)
 *
 * 2) Revisá la lista SUCURSALES de abajo — son los mismos IDs que ya están en
 *    CONFIG.SUCURSALES dentro de control-agendas.html. Si agregás o sacás una
 *    sucursal ahí, actualizala acá también.
 *
 * 3) Activadores (ícono de reloj, menú izquierdo) → + Agregar activador:
 *      Función: backupAgendasSemanal
 *      Fuente del evento: Basado en tiempo
 *      Tipo: Disparador semanal de temporizador
 *      Día: sábado · Hora: la que prefieras (ej. 20:00-21:00, cierre de semana)
 *    Guardar. Con eso alcanza, no hace falta desplegar como Web App.
 *
 * 4) (Opcional) Para probarlo ya mismo sin esperar al sábado: en el editor,
 *    ejecutá manualmente la función `backupAgendasSemanal` una vez.
 * ──────────────────────────────────────────────────────────────────────────────
 */

var BACKUP_ROOT_FOLDER_ID = "1TYavYXNhLUAWShx60ICIC90UYjYZ4Tr6"; // misma carpeta base que la Base de Conocimiento
var BACKUP_SUBFOLDER_NAME = "Backups Agendas"; // subcarpeta propia, no se mezcla con los docs de la Base de Conocimiento

var SUCURSALES = [
  { sucursal: "Jujuy", id: "1uEQFhrVYgU_pEIQwcYo7YNkwIULCBlSj-p7ED_-Of5E" },
  { sucursal: "Salta", id: "1FvqJ_-WRzo964DB_iD5bZbzuFFLf-mT8FVsTKJWWq7Q" },
  { sucursal: "Catamarca", id: "1CD5wnnnF05HzcLBZidaaOJIV8uUkCRhrWpTYGfsmGAM" },
  { sucursal: "Norte Centro (Metán)", id: "1Jf00dhHO0YXeyppkaoiCVhOWuyxXTh0pYHpR_O2yklE" },
  { sucursal: "Tucumán Capital", id: "1DTkJ0jk_XFXx1o2j34lnws_Eqk6xCAXerBn10qkDemY" },
  { sucursal: "Tucumán Interior (Concepción)", id: "1m2UAqC7sXm54UeTWSGrPPRPEZrQ3ojUlH3pMdX_iRqs" },
  { sucursal: "Santiago del Estero", id: "1lagOoU5U0hpRl0KmgpcVJJa-_6iRsjHvR7ueZYdGpxQ" },
  { sucursal: "Norte Interior (Orán)", id: "1URImDoHMpH8efT1q0I2_-JhcA1A4n6pdtqINCiI8jzI" },
  { sucursal: "Córdoba", id: "1-IbUhBpupGj4m0Ne_sXHTRTYit01ccSVclSjKwFbTmI" },
  { sucursal: "La Rioja", id: "10ukyFt2hdxcb-VgWdqN-_7-y37YIBfBrel0rtq08wd8" },
];

/* ═══════════════════════════ Backup semanal ═══════════════════════════ */
function backupAgendasSemanal() {
  var weekFolder = getOrCreateWeekFolder_();
  var ok = 0, fallidos = [];

  SUCURSALES.forEach(function (s) {
    try {
      var original = DriveApp.getFileById(s.id);
      var nombre = s.sucursal + " — " + Utilities.formatDate(new Date(), "GMT-3", "yyyy-MM-dd");
      original.makeCopy(nombre, weekFolder);
      ok++;
    } catch (err) {
      fallidos.push(s.sucursal + ": " + err);
    }
  });

  Logger.log("Backup de agendas — copiadas: " + ok + "/" + SUCURSALES.length +
    (fallidos.length ? " | fallaron: " + fallidos.join(" · ") : ""));
}

function getOrCreateWeekFolder_() {
  var root = DriveApp.getFolderById(BACKUP_ROOT_FOLDER_ID);
  var backupsRoot = getOrCreateSubfolder_(root, BACKUP_SUBFOLDER_NAME);
  var weekName = "Semana " + Utilities.formatDate(sabadoDeEstaSemana_(), "GMT-3", "yyyy-MM-dd");
  return getOrCreateSubfolder_(backupsRoot, weekName);
}

function getOrCreateSubfolder_(parent, name) {
  var it = parent.getFoldersByName(name);
  return it.hasNext() ? it.next() : parent.createFolder(name);
}

// Sábado de la semana actual (si hoy ya pasó el sábado, es el de esta semana igual;
// el trigger corre justamente los sábados, así que en la práctica es "hoy").
function sabadoDeEstaSemana_() {
  var d = new Date();
  var dow = d.getDay(); // 0=domingo … 6=sábado
  var diff = 6 - dow;
  var sab = new Date(d);
  sab.setDate(d.getDate() + diff);
  return sab;
}
