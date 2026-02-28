const express = require("express");
const cors = require("cors");
const path = require("path");
const fs = require("fs");
require("dotenv").config();

const { GoogleGenerativeAI } = require("@google/generative-ai");
const { google } = require("googleapis");

const JOY_RULE_DOC_ID = process.env.JOY_RULE_DOC_ID || "";
// Optional: comma-separated Google Doc IDs (used if Drive folder not set)
const JOY_KNOWLEDGE_DOC_IDS = (process.env.JOY_KNOWLEDGE_DOC_IDS || "")
  .split(",")
  .map((id) => id.trim())
  .filter(Boolean);
// Optional: read ALL Google Docs inside this folder (and subfolders) via Drive API
const JOY_DRIVE_FOLDER_ID = (process.env.JOY_DRIVE_FOLDER_ID || "").trim();
const GOOGLE_APPLICATION_CREDENTIALS = (process.env.GOOGLE_APPLICATION_CREDENTIALS || "").trim();
// Optional: full JSON key as string (for deploy without uploading file, e.g. Render/Railway)
const GOOGLE_APPLICATION_CREDENTIALS_JSON = process.env.GOOGLE_APPLICATION_CREDENTIALS_JSON || "";

const BASE_SYSTEM_PROMPT = `
You are Joy, the AI guide of the project "A Life Well Lived".

- Use the same language as the user. If they write in Vietnamese, reply in Vietnamese; in English, reply in English; in any other language, reply in that language.
- You are warm, respectful, and practical. You never judge the user.
- You focus on helping the user live "A Life Well Lived": clarity, reflection, gentle action, and long-term wellbeing.
- Prefer concise, summarized answers. Only give long lists or details when the user explicitly asks for more.
- Reply in plain text only: do not use markdown (no ** for bold, no * for lists or emphasis, no #). Use line breaks and spacing only.
- You must follow the latest rules provided by Dat in the Joy rules document on Google Drive.
If the information is not covered there, you may use your general knowledge, but always stay aligned with the spirit of that document.
`;

const app = express();
const PORT = process.env.PORT || 3000;

app.use(cors());
app.use(express.json());
app.use(express.static(path.join(__dirname, "public")));

if (!process.env.GEMINI_API_KEY) {
  console.warn(
    "Warning: GEMINI_API_KEY is not set. Set it in a .env file before starting the server."
  );
}

const genAI = new GoogleGenerativeAI(process.env.GEMINI_API_KEY || "");

let cachedModelName = null;

// WhatsApp Cloud API env
const WA_VERIFY_TOKEN = process.env.WHATSAPP_VERIFY_TOKEN || "";
const WA_ACCESS_TOKEN = process.env.WHATSAPP_ACCESS_TOKEN || "";
const WA_PHONE_NUMBER_ID = process.env.WHATSAPP_PHONE_NUMBER_ID || "";

async function listAvailableModels() {
  const key = process.env.GEMINI_API_KEY;
  if (!key) throw new Error("GEMINI_API_KEY is missing");

  const url = `https://generativelanguage.googleapis.com/v1beta/models?key=${encodeURIComponent(
    key
  )}`;
  const resp = await fetch(url);
  if (!resp.ok) {
    const text = await resp.text().catch(() => "");
    throw new Error(`ListModels failed: ${resp.status} ${resp.statusText} ${text}`);
  }
  const data = await resp.json();
  return data?.models || [];
}

function normalizeModelName(name) {
  if (!name || typeof name !== "string") return null;
  return name.startsWith("models/") ? name.slice("models/".length) : name;
}

async function pickDefaultModelName() {
  // 1) Allow user override in .env
  const fromEnv = process.env.GEMINI_MODEL;
  if (fromEnv && typeof fromEnv === "string" && fromEnv.trim()) {
    return normalizeModelName(fromEnv.trim());
  }

  // 2) Auto-pick from available models for this API key
  const models = await listAvailableModels();
  const canGenerate = models.filter((m) =>
    Array.isArray(m?.supportedGenerationMethods)
      ? m.supportedGenerationMethods.includes("generateContent")
      : true
  );

  // Prefer a fast "flash" model if present
  const preferred =
    canGenerate.find((m) => /flash/i.test(m?.name || "")) ||
    canGenerate.find((m) => /gemini/i.test(m?.name || "")) ||
    canGenerate[0];

  return normalizeModelName(preferred?.name) || null;
}

async function getModelName() {
  if (cachedModelName) return cachedModelName;
  cachedModelName = await pickDefaultModelName();
  return cachedModelName;
}

// --- Joy rules loading from Google Docs ---

let cachedRulesText = "";
let cachedRulesFetchedAt = 0;
const RULES_TTL_MS = 15 * 60 * 1000; // 15 minutes (fewer reloads from Drive)

async function fetchRulesFromGoogleDoc() {
  if (!JOY_RULE_DOC_ID) {
    return "";
  }

  const url = `https://docs.google.com/document/d/${JOY_RULE_DOC_ID}/export?format=txt`;
  const resp = await fetch(url);
  if (!resp.ok) {
    const text = await resp.text().catch(() => "");
    throw new Error(
      `Failed to load Joy rules from Google Doc: ${resp.status} ${resp.statusText} ${text}`
    );
  }
  return await resp.text();
}

async function getJoyRulesText() {
  const now = Date.now();
  if (cachedRulesText && now - cachedRulesFetchedAt < RULES_TTL_MS) {
    return cachedRulesText;
  }
  const text = await fetchRulesFromGoogleDoc();
  cachedRulesText = text || "";
  cachedRulesFetchedAt = now;
  return cachedRulesText;
}

// --- Knowledge docs from Drive (extra Google Docs Joy can read) ---
let cachedKnowledgeText = "";
let cachedKnowledgeFetchedAt = 0;
let cachedKnowledgeMeta = null; // { source: 'folder'|'ids', docCount, folderId? }
const KNOWLEDGE_TTL_MS = 15 * 60 * 1000; // 15 min (fewer Drive API calls)
const MAX_KNOWLEDGE_CHARS = 120000; // ~30k tokens; keep context reasonable
const MAX_DOC_CHARS = 50000; // max chars per doc when from folder (so we don't blow context)

async function fetchOneDocAsText(docId) {
  const url = `https://docs.google.com/document/d/${docId}/export?format=txt`;
  const resp = await fetch(url);
  if (!resp.ok) return null;
  return await resp.text();
}

// --- Google Drive API: list Docs, Sheets, PDF, Excel in folder (recursive) and export as text ---
const MIME_FOLDER = "application/vnd.google-apps.folder";
const MIME_DOC = "application/vnd.google-apps.document";
const MIME_SHEET = "application/vnd.google-apps.spreadsheet";
const MIME_PDF = "application/pdf";
const MIME_XLSX = "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet";

function getDriveClient() {
  let key;
  if (GOOGLE_APPLICATION_CREDENTIALS_JSON && GOOGLE_APPLICATION_CREDENTIALS_JSON.trim()) {
    try {
      key = JSON.parse(GOOGLE_APPLICATION_CREDENTIALS_JSON.trim());
    } catch (e) {
      console.warn("GOOGLE_APPLICATION_CREDENTIALS_JSON invalid:", e?.message);
      return null;
    }
  } else if (GOOGLE_APPLICATION_CREDENTIALS) {
    const keyPath = path.isAbsolute(GOOGLE_APPLICATION_CREDENTIALS)
      ? GOOGLE_APPLICATION_CREDENTIALS
      : path.join(__dirname, GOOGLE_APPLICATION_CREDENTIALS);
    if (!fs.existsSync(keyPath)) return null;
    key = JSON.parse(fs.readFileSync(keyPath, "utf8"));
  } else {
    return null;
  }
  const auth = new google.auth.GoogleAuth({
    credentials: key,
    scopes: ["https://www.googleapis.com/auth/drive.readonly"],
  });
  return google.drive({ version: "v3", auth });
}

const DRIVE_READABLE_TYPES = [MIME_DOC, MIME_SHEET, MIME_PDF, MIME_XLSX];

async function listDocIdsInFolderRecursive(drive, folderId, folderPath = "") {
  const list = [];
  let pageToken = null;
  do {
    const res = await drive.files.list({
      q: `'${folderId}' in parents and trashed = false`,
      fields: "nextPageToken, files(id, name, mimeType)",
      pageSize: 100,
      pageToken,
    });
    const files = res.data.files || [];
    for (const f of files) {
      const name = f.name || "(no name)";
      const currentPath = folderPath ? `${folderPath}/${name}` : name;
      if (f.mimeType === MIME_FOLDER) {
        const sub = await listDocIdsInFolderRecursive(drive, f.id, currentPath);
        list.push(...sub);
      } else if (DRIVE_READABLE_TYPES.includes(f.mimeType)) {
        list.push({ id: f.id, name, path: currentPath, mimeType: f.mimeType });
      }
    }
    pageToken = res.data.nextPageToken || null;
  } while (pageToken);
  return list;
}

async function exportDocAsText(drive, fileId) {
  const res = await drive.files.export(
    { fileId, mimeType: "text/plain" },
    { responseType: "arraybuffer" }
  );
  const buf = Buffer.from(res.data);
  return buf.toString("utf8");
}

async function exportSheetAsText(drive, fileId) {
  const res = await drive.files.export(
    { fileId, mimeType: "text/csv" },
    { responseType: "arraybuffer" }
  );
  const buf = Buffer.from(res.data);
  return buf.toString("utf8");
}

async function getFileContent(drive, fileId) {
  const res = await drive.files.get(
    { fileId, alt: "media" },
    { responseType: "arraybuffer" }
  );
  return Buffer.from(res.data);
}

async function getPdfAsText(drive, fileId) {
  const pdfParse = require("pdf-parse");
  const buffer = await getFileContent(drive, fileId);
  const data = await pdfParse(buffer);
  return data?.text || "";
}

async function getXlsxAsText(drive, fileId) {
  const XLSX = require("xlsx");
  const buffer = await getFileContent(drive, fileId);
  const wb = XLSX.read(buffer, { type: "buffer" });
  const parts = [];
  for (const sheetName of wb.SheetNames) {
    const sheet = wb.Sheets[sheetName];
    const text = XLSX.utils.sheet_to_csv(sheet);
    if (text) parts.push(`[Sheet: ${sheetName}]\n${text}`);
  }
  return parts.join("\n\n");
}

async function getFileContentAsText(drive, file) {
  const { id, mimeType, path } = file;
  if (mimeType === MIME_DOC) return exportDocAsText(drive, id);
  if (mimeType === MIME_SHEET) return exportSheetAsText(drive, id);
  if (mimeType === MIME_PDF) return getPdfAsText(drive, id);
  if (mimeType === MIME_XLSX) return getXlsxAsText(drive, id);
  return null;
}

async function getJoyKnowledgeFromDriveFolder() {
  const drive = getDriveClient();
  if (!drive || !JOY_DRIVE_FOLDER_ID) return "";

  const docs = await listDocIdsInFolderRecursive(drive, JOY_DRIVE_FOLDER_ID);
  const parts = [];
  let totalChars = 0;

  for (const file of docs) {
    if (totalChars >= MAX_KNOWLEDGE_CHARS) break;
    try {
      const text = await getFileContentAsText(drive, file);
      if (!text) continue;
      const snippet =
        text.length > MAX_DOC_CHARS
          ? text.slice(0, MAX_DOC_CHARS) + "\n[... truncated ...]"
          : text;
      parts.push(`[${file.path}]\n${snippet}`);
      totalChars += snippet.length + 50;
    } catch (e) {
      console.warn("Drive read failed for", file.path, e?.message);
    }
  }

  cachedKnowledgeMeta = {
    source: "folder",
    folderId: JOY_DRIVE_FOLDER_ID,
    docCount: docs.length,
    loadedCount: parts.length,
  };
  return parts.join("\n\n---\n\n");
}

async function getJoyKnowledgeFromDocIds() {
  const parts = [];
  for (const id of JOY_KNOWLEDGE_DOC_IDS) {
    try {
      const text = await fetchOneDocAsText(id);
      if (text) parts.push(`[Doc ID: ${id}]\n${text}`);
    } catch (e) {
      console.warn("Could not load knowledge doc:", id, e?.message);
    }
  }
  cachedKnowledgeMeta = { source: "ids", docCount: JOY_KNOWLEDGE_DOC_IDS.length };
  return parts.join("\n\n---\n\n");
}

async function getJoyKnowledgeText() {
  const now = Date.now();
  if (cachedKnowledgeText && now - cachedKnowledgeFetchedAt < KNOWLEDGE_TTL_MS) {
    return cachedKnowledgeText;
  }

  let full = "";
  if (JOY_DRIVE_FOLDER_ID && getDriveClient()) {
    full = await getJoyKnowledgeFromDriveFolder();
  }
  if (!full && JOY_KNOWLEDGE_DOC_IDS.length > 0) {
    full = await getJoyKnowledgeFromDocIds();
  }

  if (full.length > MAX_KNOWLEDGE_CHARS) {
    full = full.slice(0, MAX_KNOWLEDGE_CHARS) + "\n\n[... truncated for length ...]";
  }
  cachedKnowledgeText = full;
  cachedKnowledgeFetchedAt = now;
  return cachedKnowledgeText;
}

// --- Joy response generation (shared by website + WhatsApp) ---
async function generateJoyReply({ message, history = [] }) {
  const modelName = await getModelName();
  if (!modelName) {
    throw new Error(
      "No available Gemini model found for this API key. Open /api/models to see what's available."
    );
  }

  let rulesText = "";
  try {
    rulesText = await getJoyRulesText();
  } catch (rulesErr) {
    console.error("Error loading Joy rules:", rulesErr);
  }

  let knowledgeText = "";
  try {
    knowledgeText = await getJoyKnowledgeText();
  } catch (knowledgeErr) {
    console.error("Error loading Joy knowledge docs:", knowledgeErr);
  }

  let systemInstruction =
    BASE_SYSTEM_PROMPT +
    "\n\n---\nLATEST JOY RULES FROM GOOGLE DOC (plain text):\n" +
    (rulesText || "[No rules could be loaded from Google Docs.]");

  if (knowledgeText) {
    systemInstruction +=
      "\n\n---\nKNOWLEDGE FROM GOOGLE DRIVE (use this to answer questions):\n" +
      knowledgeText;
  }

  const model = genAI.getGenerativeModel({
    model: modelName,
    systemInstruction,
  });

  const chatHistory = Array.isArray(history)
    ? history
        .map((turn) => {
          if (!turn || typeof turn !== "object") return null;
          const { role, text } = turn;
          if (role !== "user" && role !== "model") return null;
          if (!text || typeof text !== "string") return null;
          return { role, parts: [{ text }] };
        })
        .filter(Boolean)
    : [];

  const chat = model.startChat({ history: chatHistory });
  const result = await chat.sendMessage(message);
  return (
    (result && result.response && result.response.text()) ||
    "Xin lỗi, Joy hiện không trả lời được."
  );
}

app.post("/api/chat", async (req, res) => {
  try {
    const { message, history = [] } = req.body || {};

    if (!message || typeof message !== "string") {
      return res
        .status(400)
        .json({ error: "Missing 'message' string in body." });
    }

    const reply = await generateJoyReply({ message, history });
    return res.json({ reply });
  } catch (err) {
    console.error("Error in /api/chat:", err);
    return res.status(500).json({
      error:
        "Internal server error. Check the server terminal logs. You can also open /api/models to confirm model availability.",
    });
  }
});

// --- WhatsApp Cloud API webhook ---

// In-memory chat history per WhatsApp user (wa_id)
const waHistoryByUser = new Map();
const WA_HISTORY_MAX_TURNS = 10; // last N messages (user+model turns)

function pushHistory(waId, role, text) {
  const arr = waHistoryByUser.get(waId) || [];
  arr.push({ role, text });
  // keep only last turns
  if (arr.length > WA_HISTORY_MAX_TURNS * 2) {
    arr.splice(0, arr.length - WA_HISTORY_MAX_TURNS * 2);
  }
  waHistoryByUser.set(waId, arr);
  return arr;
}

async function sendWhatsAppText({ to, body }) {
  if (!WA_ACCESS_TOKEN || !WA_PHONE_NUMBER_ID) {
    throw new Error(
      "Missing WHATSAPP_ACCESS_TOKEN or WHATSAPP_PHONE_NUMBER_ID in .env"
    );
  }

  const url = `https://graph.facebook.com/v20.0/${WA_PHONE_NUMBER_ID}/messages`;
  const resp = await fetch(url, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${WA_ACCESS_TOKEN}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      messaging_product: "whatsapp",
      to,
      type: "text",
      text: { body },
    }),
  });

  if (!resp.ok) {
    const text = await resp.text().catch(() => "");
    throw new Error(
      `WhatsApp send failed: ${resp.status} ${resp.statusText} ${text}`
    );
  }
  return await resp.json().catch(() => ({}));
}

// Webhook verification (Meta calls this when you set webhook)
app.get("/webhook", (req, res) => {
  const mode = req.query["hub.mode"];
  const token = req.query["hub.verify_token"];
  const challenge = req.query["hub.challenge"];

  if (mode === "subscribe" && token && token === WA_VERIFY_TOKEN) {
    return res.status(200).send(challenge);
  }
  return res.sendStatus(403);
});

// Webhook receiver (Meta sends WhatsApp messages here)
app.post("/webhook", async (req, res) => {
  try {
    const body = req.body;

    // Always acknowledge quickly so Meta doesn't retry
    res.sendStatus(200);

    const entry = body?.entry?.[0];
    const change = entry?.changes?.[0];
    const value = change?.value;
    const messages = value?.messages;

    if (!Array.isArray(messages) || messages.length === 0) return;

    const msg = messages[0];
    const waId = msg?.from;
    const msgType = msg?.type;
    const text = msgType === "text" ? msg?.text?.body : "";

    if (!waId || !text) return;

    const history = pushHistory(waId, "user", text);

    const reply = await generateJoyReply({ message: text, history });

    pushHistory(waId, "model", reply);
    await sendWhatsAppText({ to: waId, body: reply });
  } catch (err) {
    console.error("Error in WhatsApp webhook:", err);
    // response already sent; just log
  }
});

// Debug endpoint: show current Joy rules (for verification)
app.get("/api/rules", async (req, res) => {
  try {
    const text = await getJoyRulesText();
    res.json({
      hasDocId: Boolean(JOY_RULE_DOC_ID),
      length: text.length,
      preview: text.slice(0, 2000),
    });
  } catch (e) {
    res.status(500).json({ error: String(e?.message || e) });
  }
});

// Which Drive docs Joy uses as knowledge (and short preview)
app.get("/api/knowledge", async (req, res) => {
  try {
    const text = await getJoyKnowledgeText();
    res.json({
      folderId: JOY_DRIVE_FOLDER_ID || null,
      docIds: JOY_KNOWLEDGE_DOC_IDS,
      meta: cachedKnowledgeMeta,
      totalLength: text.length,
      preview: text.slice(0, 3000),
    });
  } catch (e) {
    res.status(500).json({ error: String(e?.message || e) });
  }
});

// Debug endpoint: list models available for your API key (no key shown)
app.get("/api/models", async (req, res) => {
  try {
    const models = await listAvailableModels();
    const simplified = models.map((m) => ({
      name: normalizeModelName(m?.name),
      displayName: m?.displayName,
      supportedGenerationMethods: m?.supportedGenerationMethods,
      inputTokenLimit: m?.inputTokenLimit,
      outputTokenLimit: m?.outputTokenLimit,
    }));
    res.json({
      pickedModel: cachedModelName,
      models: simplified,
    });
  } catch (e) {
    res.status(500).json({ error: String(e?.message || e) });
  }
});

app.get("/health", (req, res) => {
  res.json({ ok: true });
});

// Serve main page for root path
app.get("/", (req, res) => {
  res.sendFile(path.join(__dirname, "public", "index.html"));
});

(async function start() {
  console.log("Preloading rules + knowledge + model (first message will be fast)...");
  try {
    await Promise.all([
      getJoyRulesText().catch((e) => {
        console.warn("Rules preload:", e?.message || e);
      }),
      getJoyKnowledgeText().catch((e) => {
        console.warn("Knowledge preload:", e?.message || e);
      }),
      getModelName().catch((e) => {
        console.warn("Model preload:", e?.message || e);
      }),
    ]);
    console.log("Preload done.");
  } catch (e) {
    console.warn("Preload warning:", e?.message || e);
  }
  app.listen(PORT, () => {
    console.log(`Joy server is running on http://localhost:${PORT}`);
  });
})();

