# Kế hoạch: AI-Empowered Milestone Nurturing

## 1. Mục tiêu

- Mỗi khi user nhắn tin → thông tin user + nội dung hội thoại được lưu (đã có qua Supabase).
- Có **một nơi tóm tắt** (CRM / admin) xem tình hình từng user và **bước tiếp theo nên làm**.
- AI **tự quyết** bước tiếp theo (nudge sau 2 ngày, gửi thêm lợi ích sản phẩm, v.v.) — **không** dựa vào email template + set ngày giờ cố định.

---

## 1b. Phiên bản tiết kiệm (event-driven) — **Ưu tiên**

Để **không tốn nền tảng** (không chạy AI quét toàn bộ mỗi ngày):

| Sự kiện | Hành động |
|--------|------------|
| **User tương tác lần đầu** (có session + messages mới) | Gọi AI **một lần** cho user đó: tạo **summary** + **kế hoạch lần tương tác tiếp theo** (vd: nudge sau 2 ngày, nội dung đề xuất). Ghi vào `nurturing_summary`. |
| **Trong thời gian chờ, user tương tác thêm** | Gọi AI **cập nhật** summary + **cập nhật** kế hoạch nudge (replan). Ghi đè/upsert `nurturing_summary`. |
| **User không tương tác thêm** | **Không** gọi AI, **không** cập nhật summary. |
| **Job hàng ngày (vd 8h)** | Lấy danh sách **task đến hạn hôm nay** (`suggested_nudge_at = today`). **Với từng profile đó**: gọi AI **một lần** để dựa trên task + tình hình profile + **file hướng dẫn cách viết email** soạn **conversion email** (có thể rất dài, tháo gỡ tư duy), rồi **tự động gửi**. Phong cách viết lấy từ file hướng dẫn; không quét toàn bộ DB. |

**Lợi ích:** AI chỉ chạy **khi có sự kiện** (user mới / user quay lại), không chạy 1 lần/ngày cho toàn bộ DB → tiết kiệm chi phí và token.

---

## 2. Hiện trạng (đã có)

| Thành phần | Mô tả |
|------------|--------|
| Supabase | `chat_sessions` (session_id, user_name, user_contact, ...), `chat_messages` (role, content, session_id, created_at) |
| Admin | Trang đăng nhập, danh sách session, xem lịch sử tin nhắn |
| User identity | Có thể dedup theo email/SĐT (same_person_sessions) |

**Thiếu:**  
- Bảng **`nurturing_summary`**: tình hình tóm tắt + bước tiếp theo (nudge ngày nào, nội dung).  
- **Trigger theo sự kiện**: khi user có tin nhắn mới → (async) gọi AI cho **đúng user đó** → upsert summary + kế hoạch.  
- **Job hàng ngày**: lấy danh sách “task đến hạn hôm nay” → **với từng profile đó** AI soạn **conversion email** (có thể rất dài, tháo gỡ tư duy) theo **file hướng dẫn cách viết email** → gửi ra. AI chỉ chạy cho người có task trong ngày.  
- **Màn CRM / admin**: xem “tình hình” + “bước tiếp theo” + “nudge đề xuất”.

---

## 3. Kiến trúc đề xuất (event-driven, tiết kiệm)

```
┌─────────────────────────────────────────────────────────────────┐
│  USER CHAT                                                       │
│  User nhắn → lưu session + messages vào Supabase (như hiện tại)   │
└─────────────────────────────────────────────────────────────────┘
                                    │
                    ┌───────────────┴───────────────┐
                    ▼                               ▼
┌───────────────────────────────┐   ┌───────────────────────────────┐
│  TRIGGER THEO SỰ KIỆN         │   │  SUPABASE                     │
│  (sau khi lưu message /        │   │  • chat_sessions               │
│   kết thúc session hoặc        │   │  • chat_messages               │
│   batch nhỏ cuối ngày)         │   │  • nurturing_summary           │
│  • Chỉ với user vừa có activity│   └───────────────────────────────┘
│  • Lấy lịch sử tin gần nhất    │
│  • Gọi Gemini 1 lần → summary  │
│    + next action + nudge plan  │
│  • Upsert nurturing_summary    │
└───────────────────────────────┘
                    │
                    │  (mỗi ngày 8h)
                    ▼
┌───────────────────────────────┐   ┌───────────────────────────────┐
│  CRON HÀNG NGÀY                │   │  ADMIN / CRM                   │
│  • SELECT * FROM                │   │  • Danh sách user + tình hình  │
│    nurturing_summary             │   │  • Bước tiếp theo + nudge đề xuất│
│    WHERE suggested_nudge_at      │   │  • Nút “Gửi nudge” / “Lên lịch”  │
│    = today                      │   └───────────────────────────────┘
│  • Load file hướng dẫn viết    │
│    email (phong cách)           │
│  • Với từng profile: AI soạn   │
│    conversion email (có thể    │
│    dài) theo task + profile +  │
│    file hướng dẫn → gửi        │
└───────────────────────────────┘
```

---

## 4. Data model (Supabase)

### 4.1. Bảng `nurturing_summary` (mới)

Lưu **một dòng cho mỗi “user” (đã dedup theo contact)**. Cập nhật **khi user có tương tác** (trigger sự kiện gọi AI), **không** cập nhật bởi job quét toàn bộ.

| Cột | Kiểu | Mô tả |
|-----|------|--------|
| `id` | uuid | PK, default gen_random_uuid() |
| `normalized_contact` | text | Email hoặc SĐT đã chuẩn hoá (key dedup) |
| `display_name` | text | Tên hiển thị (lấy từ session gần nhất) |
| `last_session_id` | uuid | Session gần nhất (FK chat_sessions) |
| `last_activity_at` | timestamptz | Lần cuối có tin nhắn |
| **Journey (AI điền)** | | |
| `journey_summary` | text | Tóm tắt hành trình: quan tâm gì, đã hỏi gì, giai đoạn nào (vd: prospect / đang tìm hiểu SP / đang tìm hiểu KD) |
| `suggested_stage` | text | Giai đoạn AI gán: e.g. "prospect_business", "interested_product", "need_nudge" |
| **Next action (AI điền)** | | |
| `next_action_type` | text | Loại bước tiếp: "nudge_message", "share_benefits", "invite_call", "no_action_yet", ... |
| `next_action_reason` | text | Lý do AI đề xuất (ngắn) |
| `suggested_nudge_at` | date | Gợi ý nudge vào ngày nào (nullable) |
| `suggested_nudge_content` | text | Gợi ý nội dung từ lúc lên kế hoạch (AI tham khảo khi soạn email ngày gửi). Có thể ngắn hoặc dàn ý. |
| **Đã gửi** | | |
| `nudge_sent_at` | timestamptz | Nullable. Thời điểm đã gửi. |
| `nudge_sent_content` | text | Nội dung email đã gửi — do AI soạn theo profile + **file hướng dẫn viết email**. Có thể **rất dài** (conversion email tháo gỡ tư duy). |
| **Meta** | | |
| `summary_updated_at` | timestamptz | Lần cuối AI cập nhật bản tóm tắt này |

- **Unique constraint:** `normalized_contact` (mỗi contact một dòng).
- **Cập nhật:** mỗi khi user có tin nhắn mới (hoặc batch theo session) → trigger gọi AI cho user đó → **upsert** theo `normalized_contact`.

### 4.2. (Tuỳ chọn) Bảng `nurturing_log`

Lưu lịch sử mỗi lần AI cập nhật summary (theo sự kiện), để sau này xem “lần X AI đề xuất gì”.

| Cột | Kiểu | Mô tả |
|-----|------|--------|
| `id` | uuid | PK |
| `normalized_contact` | text | |
| `run_at` | timestamptz | Thời điểm chạy job |
| `next_action_type` | text | |
| `suggested_nudge_content` | text | |
| `journey_summary_snapshot` | text | Bản tóm tắt tại thời điểm đó |

---

## 5. Luồng chi tiết

### 5.1. Trigger theo sự kiện (gọi AI khi user tương tác)

**Khi nào chạy:** Sau khi user gửi tin nhắn và đã lưu vào `chat_messages` (hoặc khi kết thúc session / batch cuối ngày cho user có activity mới).

1. **Xác định user:** Từ session vừa có activity → `user_contact` → chuẩn hoá `normalized_contact`.
2. **Lấy dữ liệu:** Lấy N tin nhắn gần nhất (user + Joy) của **đúng user đó** (qua các session cùng contact), sort theo thời gian.
3. **Gọi Gemini một lần** (chỉ cho user này):
   - System prompt: “Bạn là trợ lý phân tích hành trình khách hàng cho A Life Well Lived. Dựa trên lịch sử hội thoại: (1) Tóm tắt hành trình, (2) Gán giai đoạn, (3) Đề xuất bước tiếp theo (no_action / nudge_message / share_benefits / invite_call...), (4) Nếu nên nudge: gợi ý ngày gửi (sau bao nhiêu ngày) và nội dung 1–2 câu.”
   - User message: `display_name`, `last_activity_at`, nội dung lịch sử tin (cắt token nếu cần).
4. **Parse + ghi DB:** Parse JSON → upsert `nurturing_summary` theo `normalized_contact`. (Tuỳ chọn: insert `nurturing_log`.)

**Cách triển khai trigger:**  
- **Cách A:** Trong API `/api/chat`, sau khi lưu message vào Supabase, gọi async (fire-and-forget) một endpoint nội bộ “update nurturing for this session” (hoặc đẩy vào queue). Endpoint đó lấy contact từ session, lấy messages, gọi Gemini, upsert summary.  
- **Cách B:** Cron mỗi 15 phút / 1 giờ chạy “batch nhỏ”: lấy danh sách session có message mới trong X phút qua (chưa được summarize lần cuối), với mỗi session (dedup contact) gọi AI rồi upsert. Cách này vẫn **chỉ** chạy AI cho user có activity, không quét toàn bộ.

### 5.2. Job hàng ngày: đến ngày thì AI soạn conversion email theo profile + file hướng dẫn viết email rồi gửi

1. **Mỗi ngày (vd 8h)** cron:  
   `SELECT * FROM nurturing_summary WHERE suggested_nudge_at = CURRENT_DATE [AND nudge_sent_at IS NULL]`.
2. **Chuẩn bị ngữ cảnh viết:** Đọc **file hướng dẫn cách viết email** (vd từ Google Drive / Library, cùng nguồn Joy rules). File này quy định phong cách, tone, cấu trúc email conversion (tháo gỡ tư duy, dẫn dắt, kêu gọi hành động, v.v.). AI **bắt buộc** soạn theo đúng hướng dẫn trong file.
3. **Với từng profile trong danh sách** (chỉ những người có task trong ngày):
   - Input cho AI: **(1)** Nội dung **file hướng dẫn cách viết email** (phong cách viết); **(2)** `display_name`, `journey_summary`, `suggested_stage`, `next_action_type`, `next_action_reason`, `suggested_nudge_content` (gợi ý từ lúc lên kế hoạch).
   - Prompt: “Bạn soạn **email conversion** (có thể rất dài) cho profile này, đúng task cần làm hôm nay. Email nhằm **tháo gỡ tư duy**, dẫn dắt, và kêu gọi bước tiếp theo. **Bắt buộc** tuân thủ phong cách và quy tắc viết trong file hướng dẫn cách viết email đính kèm. Ngôn ngữ theo profile (VN/EN). Chỉ trả về nội dung email (subject + body hoặc chỉ body, tùy quy ước trong file hướng dẫn), không giải thích.”
   - Gọi Gemini → nhận nội dung email đã soạn.
4. **Gửi:** Gửi qua kênh đã cấu hình (email là chính; WhatsApp/in-app có thể gửi bản rút gọn hoặc link). Cập nhật `nudge_sent_at`, lưu nội dung đã gửi vào `nudge_sent_content` (có thể rất dài).
5. **Chi phí:** AI chỉ chạy cho **số profile có task trong ngày**; mỗi lần có thể tốn nhiều token hơn vì email dài + file hướng dẫn trong context.

---

## 6. Admin / CRM view

- **Trang mới** (vd `/admin/nurturing` hoặc tab trong admin hiện tại):
  - Bảng/danh sách: Contact, Tên, Lần hoạt động cuối, **Tình hình (journey_summary)**, **Bước tiếp theo (next_action_type + next_action_reason)**, **Nudge đề xuất (ngày + nội dung)**.
  - Filter: theo `suggested_stage`, theo `next_action_type`, theo khoảng `last_activity_at`.
  - Sort: theo `summary_updated_at`, `last_activity_at`.
- **Sau này (phase 2):**
  - Nút “Gửi nudge” → gửi email / WhatsApp / in-app (tuỳ bạn bật kênh nào).
  - “Lên lịch nudge” → lưu vào queue và đến ngày `suggested_nudge_at` gửi tự động hoặc nhắc admin.

---

## 7. Cách triển khai từng bước (event-driven, tiết kiệm)

| Bước | Nội dung | Ưu tiên |
|------|----------|--------|
| 1 | Tạo bảng `nurturing_summary` (+ optional `nurturing_log`) trên Supabase | Cao |
| 2 | **Trigger theo sự kiện:** Sau khi lưu message (hoặc batch theo session), gọi logic “update nurturing cho user này”: lấy messages → Gemini → upsert `nurturing_summary`. Có thể là API nội bộ được gọi async từ `/api/chat` hoặc cron ngắn (vd 15 phút) chỉ xử lý session có activity mới. | Cao |
| 3 | Test: user chat → kiểm tra 1 user được tạo/cập nhật summary + kế hoạch nudge đúng. | Cao |
| 4 | Thêm màn Admin: danh sách + tình hình + bước tiếp theo + nudge đề xuất (chỉ xem). | Cao |
| 5 | **Cron hàng ngày:** Load **file hướng dẫn cách viết email**. SELECT profile có `suggested_nudge_at = today` → với từng profile gọi AI soạn **conversion email** (có thể rất dài, tháo gỡ tư duy) theo task + profile + file hướng dẫn → gửi (email chính). | Trung bình |
| 6 | (Sau) Gửi nudge thật: email/WhatsApp/in-app, nút “Gửi nudge”, đánh dấu đã gửi. | Thấp |

---

## 8. Lưu ý kỹ thuật

- **Token/chi phí:** AI chỉ chạy **khi user có tương tác** (1 request Gemini / 1 user / 1 lần có activity). Không quét toàn bộ mỗi ngày → tiết kiệm rõ rệt.
- **Trigger:** Tránh gọi AI sau **mỗi** tin nhắn (tốn). Nên: (a) sau khi kết thúc session, hoặc (b) batch mỗi 15–60 phút “user nào có message mới chưa được summarize”, hoặc (c) sau mỗi N tin trong session.
- **Bảo mật:** Endpoint/script nurture chỉ nội bộ hoặc bảo vệ bằng secret.
- **Dedup:** Dùng `normalizeContact` như hiện tại; mỗi contact một dòng `nurturing_summary`.
- **File hướng dẫn cách viết email:** Lưu ở Google Drive (vd cùng thư mục Library với Joy rules) hoặc 1 Google Doc riêng. Cấu hình Doc ID / Folder trong `.env` (vd `EMAIL_WRITING_GUIDE_DOC_ID`). Job ngày gửi đọc file này (export text) và đưa vào system prompt / user message để AI soạn conversion email đúng phong cách (tháo gỡ tư duy, cấu trúc, tone, độ dài tùy file quy định).

---

## 9. Tóm tắt (phiên bản tiết kiệm)

- **Lưu user:** Đã có (Supabase sessions + messages).
- **Summary + kế hoạch:** Tạo/cập nhật **khi user tương tác** (lần đầu có summary + plan; lần sau tương tác thì cập nhật lại). AI chỉ chạy cho user có activity.
- **Job hàng ngày:** Lấy profile có task đến hạn. Load **file hướng dẫn cách viết email**. Với từng profile gọi AI soạn **conversion email** (có thể rất dài, tháo gỡ tư duy) theo task + profile + **file hướng dẫn** → gửi. Phong cách viết bám đúng file; AI chỉ chạy cho người có task trong ngày.
- **CRM:** Màn admin xem `nurturing_summary`: tình hình + bước tiếp theo + nudge đề xuất.

Bạn có thể bắt đầu bằng **bước 1 + 2 + 4** (bảng, trigger event-driven, màn admin) rồi thêm cron nhẹ (bước 5) và gửi nudge thật (bước 6).
