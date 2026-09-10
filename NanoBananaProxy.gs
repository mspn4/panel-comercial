/**
 * NanoBananaProxy.gs — Reporte Comercial M&A
 * Backend para generador-placas-ia.html: lista imágenes de una carpeta de
 * Drive (productos) y hace de proxy hacia la API de Gemini ("Nano Banana",
 * modelo gemini-2.5-flash-image) para generar placas/imágenes de producto.
 * El repo es público y el sitio es estático (GitHub Pages), así que la API
 * key de Gemini no puede vivir en el HTML: este script la guarda en
 * Propiedades del Script (server-side) y hace de intermediario, mismo
 * patrón que AIProxy.gs.
 *
 * ───────────────────────────── SETUP (una sola vez) ─────────────────────────────
 * 1) Creá (o reusá) una carpeta en tu Drive con las fotos de producto y
 *    copiá su ID (lo que va entre /folders/ y el final de la URL). Pegalo
 *    en PRODUCTOS_FOLDER_ID más abajo.
 *
 * 2) Pegá este código en script.google.com → Nuevo proyecto → guardá.
 *
 * 3) Configuración del proyecto (ícono de tuerca) → Propiedades del script →
 *    agregá:
 *      - GEMINI_API_KEY   (de aistudio.google.com/apikey)
 *      - IA_ACCESS_KEY    (clave inventada por vos — la que vas a compartir
 *                          para que puedan usar el generador)
 *      - GEMINI_MODEL     (opcional, default "gemini-2.5-flash-image")
 *
 * 4) Implementar → Nueva implementación → Aplicación web.
 *    Ejecutar como: Yo. Acceso: Cualquiera (o "Cualquiera de M&A").
 *    Copiá la URL que termina en /exec y pegala en CONFIG.APPSSCRIPT_URL
 *    dentro de generador-placas-ia.html.
 *
 * 5) Compartí la IA_ACCESS_KEY solo con quien deba generar imágenes: cada
 *    generación gasta crédito pago de la API de Gemini.
 *
 * 6) Si ya tenías este script deployado antes de que existieran los presets
 *    (acciones presets_listar/presets_guardar): no hace falta nada nuevo en
 *    Drive, se crea solo un archivo "nanobanana-presets.json" en la misma
 *    carpeta la primera vez que alguien guarda un preset. Sí hay que
 *    redeployar: Implementar → Gestionar implementaciones → ✎ en la activa →
 *    Versión: Nueva versión → Implementar (la URL /exec no cambia).
 * ──────────────────────────────────────────────────────────────────────────────
 */

var PRODUCTOS_FOLDER_ID = "1dryEkxf7ioBo4hgdS00Xb-s9bK1DXJMX";
var PRESETS_FILE_NAME = "nanobanana-presets.json";

/* ═══════════════════════════ Router ═══════════════════════════ */
function doGet(e) {
  try {
    var action = e.parameter.action;
    if (action === "listar") return json(listarProductos());
    if (action === "presets_listar") return json({ ok: true, presets: leerPresets() });
    return json({ ok: false, error: "Acción desconocida: " + action });
  } catch (err) {
    return json({ ok: false, error: String(err) });
  }
}

function doPost(e) {
  try {
    var body = JSON.parse(e.postData.contents);
    if (body.action === "generar") return json(generarImagen(body));
    if (body.action === "presets_guardar") return json(guardarPresets(body));
    return json({ ok: false, error: "Acción desconocida: " + body.action });
  } catch (err) {
    return json({ ok: false, error: String(err) });
  }
}

function json(obj) {
  return ContentService.createTextOutput(JSON.stringify(obj)).setMimeType(ContentService.MimeType.JSON);
}

function checkKey(key) {
  var accessKey = PropertiesService.getScriptProperties().getProperty("IA_ACCESS_KEY");
  return accessKey && key === accessKey;
}

/* ═══════════════════════════ Listado de productos (Drive) ═══════════════════════════ */
// Devuelve id/nombre/miniatura (base64, vía getThumbnail — liviano) de cada
// imagen de la carpeta configurada. La miniatura alcanza para elegir en la
// grilla del HTML; la imagen completa se lee de nuevo al generar.
function listarProductos() {
  if (!PRODUCTOS_FOLDER_ID || PRODUCTOS_FOLDER_ID.indexOf("PEGAR_ID") === 0) {
    return { ok: false, error: "Falta configurar PRODUCTOS_FOLDER_ID en NanoBananaProxy.gs." };
  }
  var folder = DriveApp.getFolderById(PRODUCTOS_FOLDER_ID);
  var it = folder.getFiles();
  var out = [];
  while (it.hasNext()) {
    var f = it.next();
    var mime = f.getMimeType();
    if (mime.indexOf("image/") !== 0) continue;
    var thumbB64 = null;
    try {
      var thumb = f.getThumbnail();
      if (thumb) thumbB64 = "data:" + thumb.getContentType() + ";base64," + Utilities.base64Encode(thumb.getBytes());
    } catch (e) { /* sin miniatura disponible, se lista igual */ }
    out.push({ id: f.getId(), nombre: f.getName(), mimeType: mime, thumb: thumbB64 });
  }
  return { ok: true, productos: out };
}

/* ═══════════════════════════ Presets de prompts (Drive) ═══════════════════════════ */
// Un solo archivo con la lista completa de presets guardados (prompt base +
// fondo/vista/formato/variantes/campos de placa, por pestaña). El cliente
// manda siempre el array completo al guardar — mismo criterio que las
// reservas en CloudSync.gs, no hace falta un endpoint de borrado aparte.
function findPresetsFile() {
  var it = DriveApp.getFolderById(PRODUCTOS_FOLDER_ID).getFilesByName(PRESETS_FILE_NAME);
  return it.hasNext() ? it.next() : null;
}

function leerPresets() {
  var f = findPresetsFile();
  if (!f) return [];
  try {
    var data = JSON.parse(f.getBlob().getDataAsString());
    return data.presets || [];
  } catch (e) {
    return [];
  }
}

function guardarPresets(body) {
  if (!checkKey(body.key)) return { ok: false, error: "Clave inválida." };
  var presets = Array.isArray(body.presets) ? body.presets : [];
  var content = JSON.stringify({ presets: presets, actualizado: new Date().toISOString() });
  var f = findPresetsFile();
  if (f) f.setContent(content);
  else DriveApp.getFolderById(PRODUCTOS_FOLDER_ID).createFile(PRESETS_FILE_NAME, content, MimeType.PLAIN_TEXT);
  return { ok: true, total: presets.length };
}

/* ═══════════════════════════ Generación (Gemini / Nano Banana) ═══════════════════════════ */
// body: { key, prompt, aspectRatio, fileId? , imagenB64?, mimeType? }
// La imagen de referencia viene de Drive (fileId, ya subida a la carpeta de
// productos) o del navegador directo (imagenB64, subida suelta sin pasar por
// Drive) — se usa la que venga.
function generarImagen(body) {
  if (!checkKey(body.key)) return { ok: false, error: "Clave inválida." };

  var prompt = (body.prompt || "").trim();
  if (!prompt) return { ok: false, error: "Prompt vacío." };

  var imagenB64, mimeType;
  if (body.fileId) {
    var blob = DriveApp.getFileById(body.fileId).getBlob();
    mimeType = blob.getContentType();
    imagenB64 = Utilities.base64Encode(blob.getBytes());
  } else if (body.imagenB64) {
    imagenB64 = body.imagenB64;
    mimeType = body.mimeType || "image/jpeg";
  } else {
    return { ok: false, error: "Falta la imagen del producto (fileId o imagenB64)." };
  }

  var props = PropertiesService.getScriptProperties();
  var apiKey = props.getProperty("GEMINI_API_KEY");
  if (!apiKey) return { ok: false, error: "Falta GEMINI_API_KEY en Propiedades del script." };
  var model = props.getProperty("GEMINI_MODEL") || "gemini-2.5-flash-image";

  var parts = [
    { text: prompt },
    { inlineData: { mimeType: mimeType, data: imagenB64 } }
  ];
  // Logo de la empresa como segunda imagen de referencia (opcional, lo manda
  // el HTML en base64 leyendo assets/logo.png — no hace falta subirlo a Drive).
  if (body.logoB64) {
    parts.push({ inlineData: { mimeType: body.logoMime || "image/png", data: body.logoB64 } });
  }

  var payload = {
    contents: [{ parts: parts }],
    generationConfig: {
      responseModalities: ["IMAGE"],
      imageConfig: { aspectRatio: body.aspectRatio || "1:1" }
    }
  };

  var url = "https://generativelanguage.googleapis.com/v1beta/models/" + model + ":generateContent?key=" + apiKey;
  var resp = UrlFetchApp.fetch(url, {
    method: "post",
    contentType: "application/json",
    payload: JSON.stringify(payload),
    muteHttpExceptions: true,
  });

  var code = resp.getResponseCode();
  var data;
  try { data = JSON.parse(resp.getContentText()); } catch (e) { data = null; }

  if (code < 200 || code >= 300 || !data) {
    return { ok: false, error: "Gemini " + code + ": " + resp.getContentText().slice(0, 500) };
  }
  if (data.promptFeedback && data.promptFeedback.blockReason) {
    return { ok: false, error: "Bloqueado por Gemini: " + data.promptFeedback.blockReason };
  }

  var outParts = (data.candidates && data.candidates[0] && data.candidates[0].content && data.candidates[0].content.parts) || [];
  for (var i = 0; i < outParts.length; i++) {
    if (outParts[i].inlineData) {
      return { ok: true, imagenB64: outParts[i].inlineData.data, mimeType: outParts[i].inlineData.mimeType || "image/png" };
    }
  }
  return { ok: false, error: "Gemini no devolvió ninguna imagen (revisá el prompt o probá de nuevo)." };
}
