/**
 * AIProxy.gs — Reporte Comercial M&A
 * Proxy hacia Claude (Anthropic) y ChatGPT (OpenAI) para la pestaña "IA" de
 * reporte-comercial.html. El repo es público y el sitio es estático (GitHub
 * Pages), así que las API keys no pueden vivir en el HTML: este script las
 * guarda en Propiedades del Script (server-side) y hace de intermediario.
 *
 * ───────────────────────────── SETUP (una sola vez) ─────────────────────────────
 * 1) Pegá este código en script.google.com → Nuevo proyecto → guardá.
 *
 * 2) Configuración del proyecto (ícono de tuerca) → Propiedades del script →
 *    agregá las que uses:
 *      - ANTHROPIC_API_KEY   (de console.anthropic.com, si vas a usar Claude)
 *      - OPENAI_API_KEY      (de platform.openai.com, si vas a usar ChatGPT)
 *      - IA_ACCESS_KEY       (clave inventada por vos — la que vas a compartir
 *                             para que puedan entrar a la pestaña IA)
 *      - ANTHROPIC_MODEL     (opcional, default "claude-sonnet-5")
 *      - OPENAI_MODEL        (opcional, default "gpt-4.1")
 *
 * 3) Implementar → Nueva implementación → Aplicación web.
 *    Ejecutar como: Yo. Acceso: Cualquiera.
 *    Copiá la URL que termina en /exec y pegala en AI_CONFIG.APPSSCRIPT_URL
 *    dentro de reporte-comercial.html.
 *
 * 4) Compartí la IA_ACCESS_KEY solo con quien deba usar la pestaña IA: cada
 *    consulta gasta crédito de la API paga.
 * ──────────────────────────────────────────────────────────────────────────────
 */

var KNOWLEDGE_FOLDER_ID = "1TYavYXNhLUAWShx60ICIC90UYjYZ4Tr6";
var MAX_KB_CHARS = 60000;

var SYSTEM_PROMPT_BASE =
  "Sos un analista comercial de M&A Equipamientos Comerciales. Respondé en español, " +
  "de forma concisa y basada estrictamente en los datos que se te dan a continuación " +
  "(resumen agregado de ventas del reporte y Base de Conocimiento interna). " +
  "Si algo no está en los datos, decilo explícitamente en vez de inventar. " +
  "Los montos ya vienen en pesos argentinos.";

/* ═══════════════════════════ Router ═══════════════════════════ */
function doPost(e) {
  try {
    var body = JSON.parse(e.postData.contents);
    if (body.action === "chat") return json(handleChat(body));
    return json({ ok: false, error: "Acción desconocida: " + body.action });
  } catch (err) {
    return json({ ok: false, error: String(err) });
  }
}

function json(obj) {
  return ContentService.createTextOutput(JSON.stringify(obj)).setMimeType(ContentService.MimeType.JSON);
}

/* ═══════════════════════════ Chat ═══════════════════════════ */
function handleChat(body) {
  var props = PropertiesService.getScriptProperties();
  var accessKey = props.getProperty("IA_ACCESS_KEY");
  if (!accessKey || body.key !== accessKey) {
    return { ok: false, error: "Clave inválida." };
  }

  var provider = body.provider === "openai" ? "openai" : "anthropic";
  var messages = Array.isArray(body.messages) ? body.messages : [];
  if (!messages.length) return { ok: false, error: "Sin mensajes." };

  var systemPrompt = SYSTEM_PROMPT_BASE +
    "\n\n=== DATOS DE VENTAS (resumen agregado, respeta filtros activos del dashboard) ===\n" +
    (body.dataContext || "(sin datos)") +
    "\n\n=== BASE DE CONOCIMIENTO ===\n" +
    readKnowledgeBase();

  try {
    var reply = provider === "openai"
      ? callOpenAI(props, systemPrompt, messages)
      : callAnthropic(props, systemPrompt, messages);
    return { ok: true, reply: reply };
  } catch (err) {
    return { ok: false, error: String(err) };
  }
}

function callAnthropic(props, systemPrompt, messages) {
  var apiKey = props.getProperty("ANTHROPIC_API_KEY");
  if (!apiKey) throw new Error("Falta ANTHROPIC_API_KEY en Propiedades del script.");
  var model = props.getProperty("ANTHROPIC_MODEL") || "claude-sonnet-5";

  var resp = UrlFetchApp.fetch("https://api.anthropic.com/v1/messages", {
    method: "post",
    contentType: "application/json",
    headers: { "x-api-key": apiKey, "anthropic-version": "2023-06-01" },
    payload: JSON.stringify({
      model: model,
      max_tokens: 1500,
      system: systemPrompt,
      messages: messages.map(function (m) { return { role: m.role, content: m.content }; }),
    }),
    muteHttpExceptions: true,
  });

  var data = JSON.parse(resp.getContentText());
  if (resp.getResponseCode() !== 200) {
    throw new Error("Anthropic " + resp.getResponseCode() + ": " + (data.error ? data.error.message : resp.getContentText()));
  }
  return (data.content && data.content[0] && data.content[0].text) || "(respuesta vacía)";
}

function callOpenAI(props, systemPrompt, messages) {
  var apiKey = props.getProperty("OPENAI_API_KEY");
  if (!apiKey) throw new Error("Falta OPENAI_API_KEY en Propiedades del script.");
  var model = props.getProperty("OPENAI_MODEL") || "gpt-4.1";

  var resp = UrlFetchApp.fetch("https://api.openai.com/v1/chat/completions", {
    method: "post",
    contentType: "application/json",
    headers: { Authorization: "Bearer " + apiKey },
    payload: JSON.stringify({
      model: model,
      messages: [{ role: "system", content: systemPrompt }].concat(
        messages.map(function (m) { return { role: m.role, content: m.content }; })
      ),
    }),
    muteHttpExceptions: true,
  });

  var data = JSON.parse(resp.getContentText());
  if (resp.getResponseCode() !== 200) {
    throw new Error("OpenAI " + resp.getResponseCode() + ": " + (data.error ? data.error.message : resp.getContentText()));
  }
  return (data.choices && data.choices[0] && data.choices[0].message.content) || "(respuesta vacía)";
}

/**
 * Las notas de "Gerente Regional" (index.html) se guardan como .txt pero pueden
 * traer HTML con imágenes pegadas en base64 (editor rico con <div data-ger-rich="1">).
 * Antes de mandarlas como contexto a la IA, saca las imágenes (pesan mucho en tokens
 * y no aportan nada a un LLM de texto) y el resto de las etiquetas HTML, dejando
 * texto plano legible. Las notas viejas (texto plano de verdad, sin ese wrapper)
 * pasan sin tocar.
 */
function limpiarNotaRica_(raw) {
  if (!raw || raw.indexOf("data-ger-rich") === -1) return raw;
  var s = raw.replace(/<img[^>]*>/gi, "[imagen adjunta]");
  s = s.replace(/<br\s*\/?>/gi, "\n").replace(/<\/(p|div)>/gi, "\n");
  s = s.replace(/<[^>]+>/g, "");
  s = s.replace(/&nbsp;/gi, " ").replace(/&amp;/gi, "&").replace(/&lt;/gi, "<")
       .replace(/&gt;/gi, ">").replace(/&quot;/gi, '"').replace(/&#39;/gi, "'");
  return s.replace(/\n{3,}/g, "\n\n").trim();
}

/* ═══════════════════════════ Base de Conocimiento (Drive) ═══════════════════════════ */
/**
 * Lee los documentos de la carpeta de Base de Conocimiento y concatena su texto.
 * Soporta Google Docs nativos y archivos de texto plano (.txt). Otros formatos
 * (Word/PDF subidos tal cual) se listan por nombre pero sin extraer su contenido
 * — Apps Script no puede leer texto de esos formatos sin el servicio avanzado de
 * Drive + OCR. Si hace falta, convertir esos archivos a Google Doc al subirlos.
 */
function readKnowledgeBase() {
  var out = [];
  var total = 0;
  try {
    var files = DriveApp.getFolderById(KNOWLEDGE_FOLDER_ID).getFiles();
    while (files.hasNext() && total < MAX_KB_CHARS) {
      var f = files.next();
      var name = f.getName();
      var mime = f.getMimeType();
      var text = null;
      try {
        if (mime === MimeType.GOOGLE_DOCS) {
          text = DocumentApp.openById(f.getId()).getBody().getText();
        } else if (mime === MimeType.PLAIN_TEXT) {
          text = limpiarNotaRica_(f.getBlob().getDataAsString());
        }
      } catch (inner) {
        text = null;
      }
      if (text) {
        var chunk = "--- " + name + " ---\n" + text.slice(0, MAX_KB_CHARS - total) + "\n";
        out.push(chunk);
        total += chunk.length;
      } else {
        out.push("--- " + name + " (formato no legible por la IA todavía) ---\n");
      }
    }
  } catch (err) {
    return "(no se pudo leer la Base de Conocimiento: " + err + ")";
  }
  return out.length ? out.join("\n") : "(vacía)";
}
