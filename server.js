const express = require("express");
const cors = require("cors");
const path = require("path");
const fs = require("fs");
const crypto = require("crypto");
require("dotenv").config();

// Giữ process không thoát khi có lỗi chưa bắt (để server không tự tắt, nhảy về prompt)
process.on("uncaughtException", (err) => {
  console.error("[uncaughtException] Server vẫn chạy. Lỗi:", err?.message || err);
});
process.on("unhandledRejection", (reason, promise) => {
  console.error("[unhandledRejection] Server vẫn chạy. Lỗi:", reason);
});

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

- CRITICAL — Language: If the user's message is in English, reply in English and offer to switch (with QUICKREPLY: Yes, use English | No, keep Vietnamese). If the user writes in Vietnamese, reply in Vietnamese. Never reply in a different language than the user just used.
- You are warm, respectful, and practical. You never judge the user.
- You focus on helping the user live "A Life Well Lived": clarity, reflection, gentle action, and long-term wellbeing.
- Prefer concise, summarized answers. Only give long lists or details when the user explicitly asks for more.
- Reply in plain text only: do not use markdown (no ** for bold, no * for lists or emphasis, no #). Use line breaks and spacing only.
- You must follow the latest rules provided by Dat in the Joy rules document on Google Drive.
If the information is not covered there, you may use your general knowledge, but always stay aligned with the spirit of that document.
`;

// Lớp cố vấn Ultimate Consultant (additional layer) — áp dụng khi tư vấn có chiều sâu
const ULTIMATE_CONSULTANT_LAYER = `
DIGITAL JOY ULTIMATE CONSULTANT (additional layer)

1. ĐỊNH VỊ NHÂN VẬT (IDENTITY)
- Tên: Joy.
- Vai trò: Chuyên gia cố vấn độc lập về Công nghệ lối sống (Lifestyle Tech) và Huấn luyện Kinh doanh (Business Coaching).
- Tính cách: Giữ ấm áp, tôn trọng; không bao giờ thúc ép khi nói về business & health; giúp người dùng tự muốn ra quyết định tìm hiểu thêm.
- Nhiệm vụ: Chuyển hóa thắc mắc/nhu cầu của người dùng thành giải pháp thực thi được và điều hướng họ đến đúng điểm chạm tiếp theo (Partner/Upline).

2. QUY TRÌNH PHẢN HỒI (4 BƯỚC)
Áp dụng 4 bước này khi bạn đang tư vấn có chiều sâu (business, sức khỏe, lộ trình). Với trao đổi ngắn (cảm ơn, chào, câu hỏi đơn giản), trả lời tự nhiên, ngắn gọn, không bắt buộc đủ 4 bước.

Bước 1 – Appraise (Ghi nhận): Bắt đầu bằng việc đánh giá cao câu hỏi hoặc tư duy của người dùng.
Bước 2 – Story Trigger (Khơi gợi): Đặt câu hỏi mở để tìm hiểu lý do đằng sau sự quan tâm đó.
Bước 3 – Diagnose (Phân loại): Khi chưa biết người dùng là [Người mới tìm hiểu] / [Thành viên đang hoạt động] / [Leader/Upline], hãy đưa ra các lựa chọn đó và dùng format QUICKREPLY (xem mục 6) để hiển thị nút bấm cho user chọn nhanh.
Bước 4 – Advise & Bridge (Giải pháp & Kết nối): Cung cấp thông tin súc tích từ thư viện, đưa ra gợi ý hành động tiếp theo theo hướng dễ hiểu; có thể ví dụ để họ dễ cảm nhận và cảm thấy bắt đầu từ nhu cầu của họ.

3. KHÍA CẠNH KINH DOANH (BUSINESS COACHING)
- Tư duy: Kinh doanh là công cụ để đạt được tiêu chuẩn sống mong muốn.
- Kỹ thuật S7: Sử dụng câu hỏi khai vấn, ví dụ: "Bạn có thực sự hài lòng 100% với cuộc sống/thu nhập hiện tại?"; "Nếu có một điều muốn thay đổi trong 6 tháng tới, đó sẽ là gì?"
- Nguyên tắc: Tập trung giải quyết khát khao (pain points in positive desires). Khi nói về hoa hồng/thu nhập: giải thích dựa trên giá trị tạo ra cho họ trong tương lai, logic và bền vững.
- Kế hoạch hoa hồng / commission: Không chỉ liệt kê Share / Build / Lead. Với mỗi điểm, làm rõ TẠI SAO nó hay hoặc độc đáo — ví dụ: Share: tại sao việc earn trực tiếp từ sharing lại có giá trị (gắn với giá trị mang lại cho khách, recognition tức thì); Lead: tại sao cấu trúc 5% đến 6 thế hệ tạo đòn bẩy và thu nhập bền vững, logic đằng sau. Mục tiêu: user cảm nhận góc nhìn sâu, không chỉ thông tin có thể tự search.
- Điều hướng: Prospect → gợi ý nhắn tin cho Partner (người đã mời họ) để tư vấn lộ trình tìm hiểu kĩ trước khi bắt đầu. Distributor → gợi ý xem tài liệu nâng cao trong Library và thảo luận chiến lược cùng Upline.

4. KHÍA CẠNH SỨC KHỎE & LÀN DA (HEALTH & SKIN TECH)
- Nguyên tắc an toàn: Tuyệt đối không đưa ra lời khuyên y tế. Không dùng từ: điều trị, chữa bệnh, kê đơn.
- Định vị: Nu Skin là HealthTech và SkinTech (công nghệ lối sống). Sản phẩm hỗ trợ cơ thể từ gốc rễ với công nghệ trẻ hóa độc quyền, giúp tối ưu hóa các chức năng tự nhiên để người dùng sống khỏe mạnh và tự tin hơn.
- Highlight công nghệ độc quyền: Khi giới thiệu giải pháp (sản phẩm, thiết bị), Joy luôn nhấn mạnh yếu tố độc quyền / công nghệ độc quyền (từ thư viện) và giải thích rõ TẠI SAO yếu tố đó mang lại benefits — ví dụ: cơ chế làm sạch sâu của công nghệ X (tại sao nó hiệu quả hơn cách thông thường), rồi mới tóm lợi ích. Không chỉ liệt kê lợi ích; phải làm rõ "tại sao thiết bị/giải pháp này có thể tự hào mang lại những lợi ích đó" (cơ chế, điểm độc quyền).
- Nhắc tên giải pháp/sản phẩm: Khi giới thiệu một giải pháp, luôn nhắc rõ tên cụ thể từ thư viện nếu có. Tránh nói chung chung "thiết bị này", "sản phẩm làm sạch" — ưu tiên gọi đúng tên để user dễ tìm hiểu và trao đổi với Partner.
- Giải thích "tại sao" trước lợi ích: Ưu tiên giải thích ngắn gọn cơ chế / tại sao công nghệ đó giúp được user, sau đó mới tóm tắt lợi ích. Không chỉ liệt kê benefits; giúp user hiểu "vì sao" (đặc biệt nhờ yếu tố độc quyền) thì họ mới cảm nhận giá trị.
- Điều hướng: Gợi ý người dùng thảo luận với Partner để được tư vấn bộ giải pháp cá nhân hóa theo thói quen hàng ngày.

5. NGÔN NGỮ (LANGUAGE) — BẮT BUỘC
- Ngôn ngữ mặc định: Joy mặc định dùng tiếng Việt. Khi user chưa chọn ngôn ngữ khác, trả lời bằng tiếng Việt.
- QUAN TRỌNG — Khi user vừa nhắn bằng TIẾNG ANH (hoặc ngôn ngữ khác tiếng Việt): Ngay lập tức (1) trả lời BẰNG ĐÚNG NGÔN NGỮ ĐÓ (tiếng Anh nếu user viết tiếng Anh), (2) trong cùng tin nhắn hỏi xác nhận: "Would you like me to use English from now on?" (nếu user dùng English) và (3) BẮT BUỘC kết thúc bằng: QUICKREPLY: Yes, use English | No, keep Vietnamese. Không trả lời bằng tiếng Việt khi user vừa viết tiếng Anh — luôn đáp lại bằng tiếng Anh và đưa nút chọn ngôn ngữ.
- Sau khi user chọn "Yes, use English": Từ đó trở đi Joy trả lời bằng tiếng Anh cho đến khi user đổi ý hoặc dùng tiếng Việt lại.
- Khi user sau này lại dùng ngôn ngữ khác (vd. đang English mà chuyển sang Việt): Joy nhận ra, hỏi xác nhận bằng ngôn ngữ đó và dùng QUICKREPLY: Tiếng Việt | English (hoặc tương ứng).

6. CHỈ DẪN KỸ THUẬT
- Chiều sâu, không chỉ dài: Mỗi ý nên "spark the highlight" — tập trung vào điều độc đáo, TẠI SAO nó hay hoặc khác biệt, không chỉ liệt kê. Người đến với Joy thường tìm thông tin sâu, góc nhìn mới, không chỉ nội dung có thể tự search. Ưu tiên giải thích / so sánh (cùng độ dài) hơn liệt kê thuần túy; mục tiêu là guest muốn tương tác tiếp, không chỉ nhận thông tin chung chung.
- Độ dài: Trả lời đủ ý, rõ ràng, không quá vắn tắt. Ưu tiên 4–8 câu cho ý chính khi tư vấn (business, sức khỏe, lộ trình); khi trích từ Library hoặc giải thích cơ chế thì trình bày đủ thông tin để user hiểu và cảm nhận giá trị. Chỉ rút gọn với trao đổi đơn giản (cảm ơn, chào). Tránh trả lời chung chung — luôn gắn với nhu cầu hoặc câu hỏi cụ thể của user.
- Sử dụng Library: Khi trích từ thư viện, không chỉ tóm tắt một câu mà trình bày lại sao cho dễ hiểu, nhấn mạnh góc độ độc đáo hoặc "tại sao", có ví dụ hoặc so sánh nếu phù hợp, đủ hấp dẫn để user muốn tìm hiểu thêm.
- Kết nối Partner: Luôn nhắc người dùng rằng có "Partner" sẵn sàng hỗ trợ chi tiết hơn. Quan trọng: khi bạn đưa ra 2+ lựa chọn cho user (vd. "would you like A, B, or C?"), đừng để câu nhắc Partner làm câu cuối — đặt nhắc Partner TRƯỚC câu hỏi có lựa chọn, rồi hỏi và kết thúc bằng QUICKREPLY. Ví dụ đúng: "[Nội dung.] Your Partner can also offer personalized recommendations. Would you like to explore daily vitality, improved focus, or recovery? QUICKREPLY: Daily vitality | Improved focus | Recovery after activity". Sai: kết thúc bằng "Your Partner can also provide..." khi đã hỏi có lựa chọn — khi đó user không thấy nút.
- Quick-reply (bắt buộc khi có lựa chọn): Mỗi khi bạn đưa ra 2 hoặc 3–4 phương án để user chọn, kết thúc tin nhắn bằng đúng một dòng: QUICKREPLY: Nhãn1 | Nhãn2 | Nhãn3. Quy trình tạo nhãn nút — không ngắt từ từ câu, mà: (1) tóm tắt mỗi lựa chọn thành **chủ đề** (topic); (2) từ chủ đề tạo **một cụm từ ngắn** rõ ràng cho nút (chỉ cần đủ ý, không dài). Ví dụ: "explore daily vitality" → chủ đề năng lượng hàng ngày → nhãn nút: "Sống khoẻ mỗi ngày". "apply to a specific case" → nhãn nút: "Ví dụ cụ thể". Xác nhận ngôn ngữ giữ nguyên: QUICKREPLY: Yes, use English | No, keep Vietnamese. Nút phải xuất hiện mỗi khi có 2+ lựa chọn.
`;

const app = express();
const PORT = process.env.PORT || 3000;

app.use(cors({ origin: true, credentials: true }));
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

// Trang chính: layout 3 cột (Prysm trái, chat giữa, collage+quote phải) — desktop có 2 panel, mobile chỉ chat
app.get("/", (req, res) => {
  res.sendFile(path.join(__dirname, "public", "design-preview-desktop.html"));
});
// Trang chỉ khung chat (iframe trong layout desktop hoặc truy cập trực tiếp)
app.get("/chat", (req, res) => {
  res.sendFile(path.join(__dirname, "public", "index.html"));
});

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
    (rulesText || "[No rules could be loaded from Google Docs.]") +
    "\n\n---\n" +
    ULTIMATE_CONSULTANT_LAYER;

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
  let chatHistory = recentHistory
    .map((turn) => {
      if (!turn || typeof turn !== "object") return null;
      const { role, text } = turn;
      if (role !== "user" && role !== "model") return null;
      if (!text || typeof text !== "string") return null;
      return { role, parts: [{ text }] };
    })
    .filter(Boolean);
  // Gemini yêu cầu tin đầu tiên trong history phải là 'user', không được là 'model'
  while (chatHistory.length > 0 && chatHistory[0].role === "model") {
    chatHistory = chatHistory.slice(1);
  }

  const chat = model.startChat({ history: chatHistory });
  let result;
  try {
    result = await chat.sendMessage(message);
  } catch (sendErr) {
    console.error("[Joy] Gemini sendMessage error:", sendErr?.message || sendErr);
    if (sendErr?.message) throw sendErr;
    throw new Error("Gemini API lỗi khi gửi tin: " + String(sendErr));
  }
  const response = result?.response;
  if (!response) {
    console.warn("[Joy] Gemini response rỗng, result:", typeof result, Object.keys(result || {}));
    return "Xin lỗi, Joy hiện không trả lời được (response rỗng).";
  }
  try {
    const text = await Promise.resolve(response.text());
    if (text && typeof text === "string" && text.trim()) return text.trim();
  } catch (textErr) {
    console.error("[Joy] response.text() error (có thể bị chặn nội dung):", textErr?.message || textErr);
    const blockReason =
      response?.promptFeedback?.blockReason || response?.candidates?.[0]?.finishReason || "";
    throw new Error(
      "Gemini không trả về nội dung." + (blockReason ? " Lý do: " + blockReason : " Có thể bị chặn bởi safety.")
    );
  }
  return "Xin lỗi, Joy hiện không trả lời được.";
}

/** Rút gọn nhãn nút: vài từ, đúng trọng tâm, không cắt giữa chữ. */
function shortButtonLabel(str, maxLen = 22, isAfter = false) {
  if (!str || typeof str !== "string") return "";
  const s = str.trim();
  if (isAfter && /câu hỏi nào khác về\s+(.+)/i.test(s)) {
    const topic = s.replace(/^.*câu hỏi nào khác về\s+/i, "").trim();
    const shortTopic = topic.split(/\s+/).slice(0, 3).join(" ").substring(0, 14);
    return shortTopic ? "Câu hỏi khác về " + shortTopic : "Câu hỏi khác";
  }
  if (isAfter && /(?:other questions? about|questions? about)\s+(.+)/i.test(s)) {
    const topic = s.replace(/^.*(?:other questions? about|questions? about)\s+/i, "").trim();
    const shortTopic = topic.split(/\s+/).slice(0, 3).join(" ").substring(0, 14);
    return shortTopic ? "Other: " + shortTopic : "Other questions";
  }
  if (s.length <= maxLen) return s;
  const cut = s.substring(0, maxLen + 1);
  const lastSpace = cut.lastIndexOf(" ");
  return (lastSpace > 0 ? cut.substring(0, lastSpace) : cut.substring(0, maxLen)).trim();
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

    let reply = await generateJoyReply({ message, history, sessionSummary });
    let buttons = null;
    // Parse QUICKREPLY: linh hoạt (bất kỳ vị trí, không phân biệt hoa thường)
    const quickMatch = reply && reply.match(/QUICKREPLY:\s*([^\n]+)/i);
    if (quickMatch) {
      buttons = quickMatch[1].split("|").map((s) => s.trim()).filter(Boolean);
      reply = reply.replace(/\s*QUICKREPLY:\s*[^\n]+/gi, "").replace(/\n{2,}/g, "\n").trim();
    } else {
      // Fallback 1: "Ví dụ như A, B, hay C?" hoặc "For example, A, B, or C?"
      const víDụMatch = reply && reply.match(/(?:Ví dụ như|ví dụ như|For example,?|e\.g\.?)\s*([^.?]+)[.?]/i);
      if (víDụMatch) {
        const part = víDụMatch[1].trim();
        const raw = part.split(/\s*,\s*|\s+(?:hay|or)\s+/i).map((s) => s.trim()).filter((s) => s.length > 0);
        if (raw.length >= 2 && raw.length <= 5) buttons = raw.map((s) => shortButtonLabel(s, 22));
      }
      // Fallback 2: chỉ tách nút khi CÂU CUỐI CÙNG (câu chứa "?") có dạng "X hay Y?" — câu chỉ hỏi "có muốn không" thì không tạo nút
      if (!buttons && reply && /\?/.test(reply)) {
        const lastQ = reply.lastIndexOf("?");
        const beforeQ = reply.substring(0, lastQ);
        const sentenceStart = Math.max(
          beforeQ.lastIndexOf(". ") >= 0 ? beforeQ.lastIndexOf(". ") + 2 : 0,
          beforeQ.lastIndexOf("\n") >= 0 ? beforeQ.lastIndexOf("\n") + 1 : 0
        );
        const lastSentence = reply.substring(sentenceStart, lastQ + 1).trim();
        const hasTwoOptionsInSentence = /\s+(hay|hoặc|or)\s+/i.test(lastSentence);
        if (hasTwoOptionsInSentence) {
          const hayLast = lastSentence.lastIndexOf(" hay ");
          const orLast = lastSentence.lastIndexOf(" or ");
          const hoặcLast = lastSentence.lastIndexOf(" hoặc ");
          const idx =
            hoặcLast !== -1 ? hoặcLast : orLast !== -1 ? orLast : hayLast !== -1 ? hayLast : -1;
          const sep = idx === hoặcLast ? " hoặc " : idx === orLast ? " or " : " hay ";
          let before = lastSentence.substring(0, idx).trim();
          let after = lastSentence.substring(idx + sep.length).replace(/\s*(không\s*ạ?|ạ)\s*\??\s*$/i, "").trim();
          before = before.includes(",") ? before.split(",").pop() : before;
          before = before.trim();
          after = after.trim();
          const looksLikeTwoOptions =
            /(chia sẻ|muốn|tiếp tục|share|want|bạn có|câu hỏi|questions?)/i.test(before) ||
            /(không\s*ạ?|câu hỏi|bạn có|questions?)/i.test(after);
          if (looksLikeTwoOptions && before.length >= 3 && after.length >= 3) {
            const label1 = shortButtonLabel(before, 22);
            const label2 = shortButtonLabel(after, 22, true);
            if (label1.length >= 2 && label2.length >= 2) buttons = [label1, label2];
          }
        }
      }
    }
    const userInfo =
      user_name || user_contact
        ? { user_name: typeof user_name === "string" ? user_name.trim() : null, user_contact: typeof user_contact === "string" ? user_contact.trim() : null }
        : null;
    await saveChatMessages(sessionId, message, reply, userInfo);
    return res.json({ reply, session_id: sessionId, buttons: buttons || undefined });
  } catch (err) {
    console.error("Error in /api/chat:", err?.message || err);
    const msg = err?.message || String(err);
    let userMsg =
      "Internal server error. Check the server terminal logs. You can also open /api/models to confirm model availability.";
    if (/GEMINI_API_KEY is missing/i.test(msg)) {
      userMsg = "Thiếu GEMINI_API_KEY. Thêm key vào file .env trong thư mục project.";
    } else if (/No available Gemini model|model.*not found|ListModels failed/i.test(msg)) {
      userMsg = "Joy chưa kết nối được model. Kiểm tra GEMINI_API_KEY trong .env và mở /api/models để xem model khả dụng.";
    } else if (/API key|401|403|429|quota|invalid|fetch/i.test(msg)) {
      userMsg = "Lỗi kết nối Gemini (API key hoặc giới hạn). Kiểm tra GEMINI_API_KEY trong .env.";
    } else if (msg && msg.length < 200) {
      userMsg = msg;
    } else if (msg) {
      userMsg = "Lỗi: " + msg.substring(0, 180) + (msg.length > 180 ? "…" : "");
    }
    return res.status(500).json({ error: userMsg, detail: msg });
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

// Kiểm tra contact (email/SĐT) đã từng chat chưa — dùng để hiện "Chào lại bạn" và dedup 1 người
function normalizeContact(contact) {
  if (typeof contact !== "string") return "";
  return contact.trim().toLowerCase();
}
app.get("/api/check-contact", async (req, res) => {
  const contact = normalizeContact(req.query.contact || "");
  if (!contact) {
    return res.json({ found: false, count: 0 });
  }
  const supabase = getSupabase();
  if (!supabase) {
    return res.json({ found: false, count: 0 });
  }
  try {
    const { data: rows, error } = await supabase
      .from(CHAT_SESSIONS_TABLE)
      .select("session_id")
      .not("user_contact", "is", null);
    if (error) {
      return res.json({ found: false, count: 0 });
    }
    const count = (rows || []).filter(
      (r) => normalizeContact(r.user_contact || "") === contact
    ).length;
    return res.json({ found: count > 0, count });
  } catch (e) {
    return res.json({ found: false, count: 0 });
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
async function getAdminSessionsData(searchTerm) {
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
      const { data: sessionRows, error: sessionErr } = await supabase
        .from(CHAT_SESSIONS_TABLE)
        .select("session_id, user_name, user_contact")
        .in("session_id", sessionIds);
      if (sessionErr) {
        console.warn("[Admin] Không lấy được thông tin session (bảng chat_sessions?):", sessionErr.message);
      } else {
        for (const s of sessionRows || []) {
          sessionInfoMap.set(s.session_id, { user_name: s.user_name, user_contact: s.user_contact });
        }
      }
    } catch (e) {
      console.warn("[Admin] Lỗi khi query chat_sessions:", e?.message || e);
    }
  }
  const contactToCount = new Map();
  for (const info of sessionInfoMap.values()) {
    const c = normalizeContact(info.user_contact || "");
    if (c) contactToCount.set(c, (contactToCount.get(c) || 0) + 1);
  }
  let sessions = Array.from(bySession.entries())
    .map(([sid, messages]) => {
      const info = sessionInfoMap.get(sid) || {};
      const who = [info.user_name, info.user_contact].filter(Boolean).join(" · ") || "Chưa đặt tên";
      const last = messages.length ? messages[messages.length - 1] : null;
      const lastAt = last?.created_at || "";
      const contactNorm = normalizeContact(info.user_contact || "");
      const same_contact_count = contactNorm ? contactToCount.get(contactNorm) || 1 : 1;
      return {
        session_id: sid,
        user_name: info.user_name,
        user_contact: info.user_contact,
        label: who,
        message_count: messages.length,
        last_at: lastAt,
        same_person_sessions: same_contact_count,
        messages: messages.map((m) => ({
          role: m.role,
          content: m.content,
          created_at: m.created_at,
        })),
      };
    })
    .sort((a, b) => new Date(b.last_at || 0) - new Date(a.last_at || 0));
  if (searchTerm && typeof searchTerm === "string" && searchTerm.trim()) {
    const term = searchTerm.trim().toLowerCase();
    sessions = sessions.filter(
      (s) =>
        (s.user_name && s.user_name.toLowerCase().includes(term)) ||
        (s.user_contact && s.user_contact.toLowerCase().includes(term)) ||
        (s.label && s.label.toLowerCase().includes(term))
    );
  }
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

// --- Admin đăng nhập bằng cookie (sau khi nhập mật khẩu ở /admin/login) ---
const ADMIN_COOKIE_NAME = "joy_admin";
const ADMIN_COOKIE_MAX_AGE_DAYS = 7;

function getCookie(req, name) {
  const raw = req.headers.cookie;
  if (!raw) return null;
  const m = raw.match(new RegExp("\\b" + name + "=([^;]+)"));
  return m ? decodeURIComponent(m[1].trim()) : null;
}

function createAdminToken() {
  const exp = Date.now() + ADMIN_COOKIE_MAX_AGE_DAYS * 24 * 60 * 60 * 1000;
  const payload = exp.toString(36);
  const sig = crypto.createHmac("sha256", ADMIN_SECRET || "joy").update(payload).digest("hex").slice(0, 32);
  return payload + "." + sig;
}

function verifyAdminToken(token) {
  if (!token || !ADMIN_SECRET) return false;
  const i = token.indexOf(".");
  if (i === -1) return false;
  const payload = token.slice(0, i);
  const sig = token.slice(i + 1);
  const exp = parseInt(payload, 36);
  if (Number.isNaN(exp) || exp < Date.now()) return false;
  const expected = crypto.createHmac("sha256", ADMIN_SECRET).update(payload).digest("hex").slice(0, 32);
  return sig === expected;
}

function isAdminAuthenticated(req) {
  const token = getCookie(req, ADMIN_COOKIE_NAME);
  if (verifyAdminToken(token)) return true;
  const key = (req.query.key || "").trim();
  return key === ADMIN_SECRET;
}

function checkAdminKey(req) {
  if (!ADMIN_SECRET) return { ok: false, status: 500, message: "ADMIN_SECRET chưa cấu hình trong .env" };
  if (isAdminAuthenticated(req)) return { ok: true };
  return { ok: false, status: 401, message: "Unauthorized" };
}

function setAdminCookie(res, token) {
  const maxAge = ADMIN_COOKIE_MAX_AGE_DAYS * 24 * 60 * 60;
  const secure = process.env.NODE_ENV === "production";
  let v = ADMIN_COOKIE_NAME + "=" + encodeURIComponent(token) + "; Path=/; HttpOnly; SameSite=Lax; Max-Age=" + maxAge;
  if (secure) v += "; Secure";
  res.setHeader("Set-Cookie", v);
}

function clearAdminCookie(res) {
  res.setHeader("Set-Cookie", ADMIN_COOKIE_NAME + "=; Path=/; HttpOnly; Max-Age=0");
}

app.get("/api/admin/sessions", async (req, res) => {
  const auth = checkAdminKey(req);
  if (!auth.ok) {
    return res.status(auth.status).json({ error: auth.message });
  }
  try {
    const search = (req.query.search || req.query.contact || "").trim();
    const data = await getAdminSessionsData(search || null);
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

// --- Admin: đăng nhập (trang + API) ---
app.get("/admin/login", (req, res) => {
  if (isAdminAuthenticated(req)) {
    return res.redirect("/admin");
  }
  res.sendFile(path.join(__dirname, "public", "admin-login.html"));
});

app.post("/admin/login", (req, res) => {
  if (!ADMIN_SECRET) {
    return res.status(500).send("ADMIN_SECRET chưa cấu hình.");
  }
  const password = (req.body && req.body.password) || "";
  if (password.trim() !== ADMIN_SECRET) {
    return res.redirect(302, "/admin/login?error=1");
  }
  const token = createAdminToken();
  setAdminCookie(res, token);
  res.redirect(302, "/admin");
});

app.get("/admin/logout", (req, res) => {
  clearAdminCookie(res);
  res.redirect(302, "/admin/login");
});

// --- Admin: trang quản trị (yêu cầu đăng nhập hoặc key trong URL) ---
app.get("/admin", (req, res) => {
  if (!ADMIN_SECRET) {
    return res.status(500).send(
      "<!DOCTYPE html><html><head><meta charset='utf-8'><title>Admin</title></head><body><p>ADMIN_SECRET chưa được cấu hình trong file .env.</p></body></html>"
    );
  }
  if (!isAdminAuthenticated(req)) {
    return res.redirect(302, "/admin/login");
  }
  // Nếu vào bằng ?key=... thì set cookie để lần sau không cần key
  const key = (req.query.key || "").trim();
  if (key === ADMIN_SECRET) {
    setAdminCookie(res, createAdminToken());
    return res.redirect(302, "/admin");
  }
  res.sendFile(path.join(__dirname, "public", "admin.html"));
});

// Khởi động server — giữ biến server để process không thoát
const server = app.listen(PORT, () => {
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

server.on("error", (err) => {
  console.error("Server listen error:", err.message);
});

// Giữ process luôn chạy (tránh một số môi trường tự thoát)
server.ref && server.ref();

