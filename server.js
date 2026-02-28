const express = require("express");
const cors = require("cors");
const path = require("path");
const fs = require("fs");
const crypto = require("crypto");
require("dotenv").config();

const { GoogleGenerativeAI } = require("@google/generative-ai");
const { google } = require("googleapis");
const { createClient } = require("@supabase/supabase-js");

const SUPABASE_URL = (process.env.SUPABASE_URL || "").trim();
const SUPABASE_SERVICE_ROLE_KEY = (process.env.SUPABASE_SERVICE_ROLE_KEY || "").trim();
const ADMIN_SECRET = (process.env.ADMIN_SECRET || "").trim();
const CHAT_MESSAGES_TABLE = "chat_messages";
const CHAT_SESSIONS_TABLE = "chat_sessions";

function getSupabase() {
  if (!SUPABASE_URL || !SUPABASE_SERVICE_ROLE_KEY) return null;
  return createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY);
}

async function saveChatMessages(sessionId, userMessage, modelReply, userInfo = null) {
  const supabase = getSupabase();
  if (!supabase) {
    console.error("[Joy] Supabase KHÔNG được cấu hình. Kiểm tra SUPABASE_URL và SUPABASE_SERVICE_ROLE_KEY trong .env");
    return;
  }
  try {
    const { error } = await supabase.from(CHAT_MESSAGES_TABLE).insert([
      { session_id: sessionId, role: "user", content: userMessage },
      { session_id: sessionId, role: "model", content: modelReply },
    ]);
    if (error) {
      console.error("[Joy] Lỗi lưu Supabase:", error.message, error.details || "");
      return;
    }
    console.log("[Joy] Đã lưu 2 tin (user + Joy) cho session:", sessionId.slice(0, 8) + "...");
    if (userInfo && (userInfo.user_name || userInfo.user_contact)) {
      const { error: sessionError } = await supabase.from(CHAT_SESSIONS_TABLE).upsert(
        {
          session_id: sessionId,
          user_name: userInfo.user_name || null,
          user_contact: userInfo.user_contact || null,
          last_seen: new Date().toISOString(),
        },
        { onConflict: "session_id" }
      );
      if (sessionError) {
        console.error("[Joy] Lỗi lưu tên/SĐT vào chat_sessions:", sessionError.message, "- Bạn đã tạo bảng chat_sessions trong Supabase chưa? Xem SUPABASE_SETUP.md");
      }
    }
  } catch (e) {
    console.error("Supabase save chat exception:", e?.message);
  }
}

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
      let raw = GOOGLE_APPLICATION_CREDENTIALS_JSON.trim();
      try {
        key = JSON.parse(raw);
      } catch (e1) {
        try {
          const decoded = Buffer.from(raw, "base64").toString("utf8");
          if (decoded.startsWith("{")) {
            key = JSON.parse(decoded);
          } else {
            throw e1;
          }
        } catch (e2) {
          throw e1;
        }
      }
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

// Số cặp user+model tối đa gửi cho Gemini (tránh vượt giới hạn token)
const MAX_HISTORY_TURNS = 25;

// --- Joy response generation (shared by website + WhatsApp) ---
async function generateJoyReply({ message, history = [], sessionSummary = null }) {
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

  if (sessionSummary && sessionSummary.trim()) {
    systemInstruction +=
      "\n\n---\nTÓM TẮT CUỘC HỘI THOẠI TRƯỚC ĐÓ (dùng làm ngữ cảnh):\n" +
      sessionSummary.trim();
  }
  systemInstruction +=
    "\n\n---\nNếu chỉ nhận phần cuối cuộc hội thoại, hãy trả lời dựa trên ngữ cảnh đó và tóm tắt nếu có.";

  const model = genAI.getGenerativeModel({
    model: modelName,
    systemInstruction,
  });

  const maxMessages = MAX_HISTORY_TURNS * 2;
  const recentHistory = Array.isArray(history) ? history.slice(-maxMessages) : [];
  const chatHistory = recentHistory
    .map((turn) => {
      if (!turn || typeof turn !== "object") return null;
      const { role, text } = turn;
      if (role !== "user" && role !== "model") return null;
      if (!text || typeof text !== "string") return null;
      return { role, parts: [{ text }] };
    })
    .filter(Boolean);

  const chat = model.startChat({ history: chatHistory });
  const result = await chat.sendMessage(message);
  return (
    (result && result.response && result.response.text()) ||
    "Xin lỗi, Joy hiện không trả lời được."
  );
}

app.post("/api/chat", async (req, res) => {
  try {
    const { message, history = [], session_id: clientSessionId, user_name, user_contact } = req.body || {};

    if (!message || typeof message !== "string") {
      return res
        .status(400)
        .json({ error: "Missing 'message' string in body." });
    }

    const sessionId =
      clientSessionId && typeof clientSessionId === "string"
        ? clientSessionId.trim()
        : crypto.randomUUID();

    console.log("[Joy] Nhận tin nhắn, session:", sessionId.slice(0, 8) + "...");

    let sessionSummary = null;
    if (history.length > MAX_HISTORY_TURNS * 2) {
      try {
        const supabase = getSupabase();
        if (supabase) {
          const { data: row } = await supabase
            .from(CHAT_SESSIONS_TABLE)
            .select("conversation_summary")
            .eq("session_id", sessionId)
            .single();
          if (row?.conversation_summary) sessionSummary = row.conversation_summary;
        }
      } catch (_) {}
    }

    const reply = await generateJoyReply({ message, history, sessionSummary });
    const userInfo =
      user_name || user_contact
        ? { user_name: typeof user_name === "string" ? user_name.trim() : null, user_contact: typeof user_contact === "string" ? user_contact.trim() : null }
        : null;
    await saveChatMessages(sessionId, message, reply, userInfo);
    return res.json({ reply, session_id: sessionId });
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

// Lấy lịch sử hội thoại theo session_id (để restore khi refresh trang)
app.get("/api/history", async (req, res) => {
  const sessionId = (req.query.session_id || "").trim();
  if (!sessionId) {
    return res.json({ messages: [] });
  }
  const supabase = getSupabase();
  if (!supabase) {
    return res.json({ messages: [] });
  }
  try {
    const { data: rows, error } = await supabase
      .from(CHAT_MESSAGES_TABLE)
      .select("role, content")
      .eq("session_id", sessionId)
      .order("created_at", { ascending: true });
    if (error) {
      console.warn("API history error:", error.message);
      return res.json({ messages: [] });
    }
    const messages = (rows || []).map((r) => ({ role: r.role, text: r.content || "" }));
    return res.json({ messages });
  } catch (e) {
    console.warn("API history:", e?.message);
    return res.json({ messages: [] });
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

// Kiểm tra nhanh Supabase + bảng chat_messages (để debug khi admin trống)
app.get("/api/debug-supabase", async (req, res) => {
  const supabase = getSupabase();
  if (!supabase) {
    return res.json({
      ok: false,
      error: "Supabase chưa cấu hình (thiếu SUPABASE_URL hoặc SUPABASE_SERVICE_ROLE_KEY trong .env)",
    });
  }
  try {
    const { count, error } = await supabase.from(CHAT_MESSAGES_TABLE).select("*", { count: "exact", head: true });
    if (error) {
      return res.json({
        ok: false,
        error: error.message,
        hint: "Có thể bảng 'chat_messages' chưa được tạo trong Supabase. Xem SUPABASE_SETUP.md",
      });
    }
    return res.json({ ok: true, messageCount: count ?? 0 });
  } catch (e) {
    return res.json({ ok: false, error: String(e?.message || e) });
  }
});

// --- Admin: API trả JSON danh sách phiên + tin nhắn (dùng cho trang admin) ---
async function getAdminSessionsData() {
  const supabase = getSupabase();
  if (!supabase) return { error: "Supabase not configured" };
  const { data: rows, error } = await supabase
    .from(CHAT_MESSAGES_TABLE)
    .select("id, session_id, role, content, created_at")
    .order("created_at", { ascending: true });
  if (error) return { error: error.message };
  const bySession = new Map();
  for (const r of rows || []) {
    const sid = r.session_id || "unknown";
    if (!bySession.has(sid)) bySession.set(sid, []);
    bySession.get(sid).push(r);
  }
  const sessionIds = [...bySession.keys()];
  let sessionInfoMap = new Map();
  if (sessionIds.length > 0) {
    try {
      const { data: sessionRows } = await supabase
        .from(CHAT_SESSIONS_TABLE)
        .select("session_id, user_name, user_contact")
        .in("session_id", sessionIds);
      for (const s of sessionRows || []) {
        sessionInfoMap.set(s.session_id, { user_name: s.user_name, user_contact: s.user_contact });
      }
    } catch (_) {}
  }
  const sessions = Array.from(bySession.entries())
    .map(([sid, messages]) => {
      const info = sessionInfoMap.get(sid) || {};
      const who = [info.user_name, info.user_contact].filter(Boolean).join(" · ") || "Chưa đặt tên";
      const last = messages.length ? messages[messages.length - 1] : null;
      const lastAt = last?.created_at || "";
      return {
        session_id: sid,
        user_name: info.user_name,
        user_contact: info.user_contact,
        label: who,
        message_count: messages.length,
        last_at: lastAt,
        messages: messages.map((m) => ({
          role: m.role,
          content: m.content,
          created_at: m.created_at,
        })),
      };
    })
    .sort((a, b) => new Date(b.last_at || 0) - new Date(a.last_at || 0));
  return { sessions };
}

// Tạo/cập nhật tóm tắt cuộc hội thoại (để Joy "nhớ" lâu dài khi hội thoại quá dài)
async function generateAndSaveSessionSummary(sessionId) {
  const supabase = getSupabase();
  if (!supabase) return { error: "Supabase not configured" };
  const { data: rows, error } = await supabase
    .from(CHAT_MESSAGES_TABLE)
    .select("role, content, created_at")
    .eq("session_id", sessionId)
    .order("created_at", { ascending: true });
  if (error || !rows || rows.length < 4) return { error: error?.message || "Ít tin nhắn" };
  const modelName = await getModelName();
  if (!modelName) return { error: "No Gemini model" };
  const convText = rows
    .map((m) => `${m.role === "user" ? "User" : "Joy"}: ${(m.content || "").slice(0, 500)}`)
    .join("\n");
  const model = genAI.getGenerativeModel({ model: modelName });
  const prompt = `Tóm tắt ngắn gọn (2-4 câu, tiếng Việt) nội dung cuộc hội thoại sau, nêu ý chính người dùng quan tâm và các thông tin đã trao đổi:\n\n${convText.slice(-8000)}`;
  try {
    const result = await model.generateContent(prompt);
    const summary = result?.response?.text?.()?.trim() || "";
    if (!summary) return { error: "Không tạo được tóm tắt" };
    const { data: updated } = await supabase
      .from(CHAT_SESSIONS_TABLE)
      .update({ conversation_summary: summary, last_seen: new Date().toISOString() })
      .eq("session_id", sessionId)
      .select();
    if (updated && updated.length > 0) return { summary };
    await supabase.from(CHAT_SESSIONS_TABLE).insert({
      session_id: sessionId,
      conversation_summary: summary,
      last_seen: new Date().toISOString(),
    });
    return { summary };
  } catch (e) {
    return { error: String(e?.message || e) };
  }
}

function checkAdminKey(req) {
  const key = (req.query.key || "").trim();
  if (!ADMIN_SECRET) return { ok: false, status: 500, message: "ADMIN_SECRET chưa cấu hình trong .env" };
  if (key !== ADMIN_SECRET) return { ok: false, status: 401, message: "Unauthorized" };
  return { ok: true };
}

app.get("/api/admin/sessions", async (req, res) => {
  const auth = checkAdminKey(req);
  if (!auth.ok) {
    return res.status(auth.status).json({ error: auth.message });
  }
  try {
    const data = await getAdminSessionsData();
    if (data.error) return res.status(500).json({ error: data.error });
    return res.json(data);
  } catch (e) {
    console.error("Admin API error:", e);
    return res.status(500).json({ error: String(e?.message || e) });
  }
});

// Tạo tóm tắt cho một phiên (gọi thủ công hoặc cron) → Joy dùng tóm tắt này khi hội thoại dài
app.post("/api/admin/summarize-session", async (req, res) => {
  const auth = checkAdminKey(req);
  if (!auth.ok) {
    return res.status(auth.status).json({ error: auth.message });
  }
  const sessionId = (req.query.session_id || req.body?.session_id || "").trim();
  if (!sessionId) {
    return res.status(400).json({ error: "Thiếu session_id" });
  }
  try {
    const result = await generateAndSaveSessionSummary(sessionId);
    if (result.error) return res.status(400).json({ error: result.error });
    return res.json({ ok: true, summary: result.summary });
  } catch (e) {
    console.error("Summarize error:", e);
    return res.status(500).json({ error: String(e?.message || e) });
  }
});

// --- Admin: trang HTML (sidebar trái + nội dung phải) ---
app.get("/admin", async (req, res) => {
  const auth = checkAdminKey(req);
  if (!auth.ok) {
    if (auth.status === 500) {
      return res.status(500).send(
        "<!DOCTYPE html><html><head><meta charset='utf-8'><title>Admin</title></head><body><p>ADMIN_SECRET chưa được cấu hình trong file .env.</p></body></html>"
      );
    }
    const baseUrl = `${req.protocol}://${req.get("host") || "localhost:" + PORT}`;
    return res.status(401).send(
      "<!DOCTYPE html><html><head><meta charset='utf-8'><title>Admin</title></head><body><p><strong>Unauthorized.</strong> Dùng URL: <a href='" +
        baseUrl +
        "/admin?key=joy_admin_2024'>" +
        baseUrl +
        "/admin?key=joy_admin_2024</a></p></body></html>"
    );
  }
  res.sendFile(path.join(__dirname, "public", "admin.html"));
});

// Serve main page for root path
app.get("/", (req, res) => {
  res.sendFile(path.join(__dirname, "public", "index.html"));
});

// Khởi động server ngay, preload chạy nền → không phải đợi mỗi lần restart
app.listen(PORT, () => {
  console.log(`Joy server is running on http://localhost:${PORT}`);
  console.log("Preloading rules + knowledge + model in background...");
  Promise.all([
    getJoyRulesText().catch((e) => {
      console.warn("Rules preload:", e?.message || e);
    }),
    getJoyKnowledgeText().catch((e) => {
      console.warn("Knowledge preload:", e?.message || e);
    }),
    getModelName().catch((e) => {
      console.warn("Model preload:", e?.message || e);
    }),
  ]).then(
    () => console.log("Preload done. First message may be fast."),
    (e) => console.warn("Preload warning:", e?.message || e)
  );
});

