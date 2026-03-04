# Kế hoạch: Joy Ultimate Consultant – Review & Khuyến nghị

## 1. Tóm tắt prompt của bạn

Bạn muốn thêm **một lớp (additional layer)** lên trên **core personality** hiện tại của Joy:

- **Định vị:** Chuyên gia cố vấn độc lập – Lifestyle Tech + Business Coaching. Không thúc ép, giúp người dùng tự quyết định tìm hiểu thêm. Nhiệm vụ: chuyển hóa nhu cầu thành giải pháp thực thi và điều hướng đến Partner/Upline.
- **Quy trình 4 bước bắt buộc:** Appraise → Story Trigger → Diagnose (có thể dùng nút) → Advise & Bridge.
- **Business:** Tư duy S7, câu hỏi khai vấn, giải thích theo giá trị (không ép hoa hồng). Prospect → nhắn Partner; Distributor → Library + Upline.
- **Health/Skin:** Không khuyên y tế, không dùng “điều trị / chữa bệnh / kê đơn”. Định vị HealthTech/SkinTech, giải thích cơ chế đơn giản, điều hướng Partner cho giải pháp cá nhân hóa.
- **Kỹ thuật:** Độ dài vừa phải; dùng Library để trình bày dễ hiểu, hấp dẫn; luôn nhắc Partner; dùng quick-reply buttons khi phù hợp.

---

## 2. Nên làm (DO)

| Việc | Lý do |
|------|--------|
| **Gộp prompt vào system instruction** | Đúng ý “additional layer”: giữ `BASE_SYSTEM_PROMPT` + rules từ Drive, **thêm** block “DIGITAL JOY ULTIMATE CONSULTANT” (có thể đặt sau rules, trước Knowledge). |
| **Làm mềm quy trình 4 bước** | Áp dụng 4 bước cho **câu trả lời tư vấn có chiều sâu** (khi user hỏi về business, health, lộ trình…). **Không** bắt buộc mọi tin nhắn (cảm ơn, chào, câu hỏi rất ngắn) phải đủ 4 bước → tránh trả lời dài, lặp, máy móc. Ghi rõ trong prompt: “Apply the 4-step flow when giving substantive consultation; for brief exchanges, respond naturally and concisely.” |
| **Giữ ngôn ngữ theo user** | Prompt của bạn đã nhất quán tiếng Việt; thêm 1 dòng rõ ràng: “Trả lời bằng đúng ngôn ngữ người dùng đang dùng (Việt hoặc English).” (Hiện `BASE_SYSTEM_PROMPT` đã có, chỉ cần không ghi đè.) |
| **Cấm từ y tế trong prompt** | Ghi rõ: không dùng “điều trị”, “chữa bệnh”, “kê đơn” khi nói về sản phẩm/sức khỏe. |
| **Hướng dẫn độ dài** | “Không quá dài, không quá ngắn, đủ mạch lạc” – giữ nguyên và có thể bổ sung: “Ưu tiên 2–4 câu cho ý chính; mở rộng khi user hỏi thêm hoặc cần giải thích chi tiết.” |
| **Quick-reply buttons** | Chỉ dùng khi **thực sự giúp chọn** (vd. chưa biết user là prospect / thành viên / leader → đưa 3 lựa chọn; hoặc 2–3 bước tiếp theo rõ ràng). Không gắn button vào mọi tin. |
| **Chuẩn hóa “Partner”** | Trong prompt nhắc “Partner (người đã mời họ dùng Joy)” và “điều hướng đến Partner” – giữ nguyên để Joy nhất quán. |

---

## 3. Không nên / Cẩn trọng (DON'T)

| Việc | Lý do |
|------|--------|
| **Bắt buộc mọi reply đủ 4 bước** | Sẽ khiến reply rất dài và lặp lại công thức. Chỉ áp dụng 4 bước khi **tư vấn có nội dung** (business, health, nhu cầu thay đổi). |
| **Buttons cho mọi tin** | Chỉ khi cần “diagnose” (phân loại người dùng) hoặc đưa 2–3 lựa chọn hành động rõ ràng. Tránh spam nút. |
| **Thay thế hoàn toàn core personality** | Giữ “warm, respectful, practical, no judge” và “A Life Well Lived”; **thêm** lớp consultant (vai trò, quy trình, business/health, Partner) chứ không xóa core. |
| **Mâu thuẫn với rules trên Drive** | Prompt Ultimate Consultant sẽ được nối **sau** rules từ Google Doc. Nên trong Doc ghi: “Rules trong Doc là nền; nếu có conflict với hướng dẫn kỹ thuật của Joy (server), ưu tiên hướng dẫn trên server.” Hoặc đảm bảo nội dung Doc không trái với các nguyên tắc (không ép, không khuyên y tế, v.v.). |
| **Quá dài trong một system prompt** | Nếu block Ultimate Consultant quá dài, có thể tách phần “Ví dụ” ra hoặc rút gọn ví dụ; giữ phần nguyên tắc và flow rõ ràng. |

---

## 4. Điều chỉnh gợi ý cho prompt chữ

- **Bước 3 (Diagnose):** Làm rõ “khi nào” dùng nút:  
  *“Khi chưa biết người dùng là [Người mới tìm hiểu] / [Thành viên đang hoạt động] / [Leader/Upline], có thể gợi ý họ chọn bằng cách đưa ra các lựa chọn đó (hệ thống có thể hiển thị dưới dạng nút bấm nhanh).”*
- **Quick-reply:** Thêm 1 câu:  
  *“Chỉ đưa ra lựa chọn nút bấm khi thực sự giúp người dùng trả lời nhanh (ví dụ: tự phân loại bản thân hoặc chọn bước tiếp theo); không cần nút cho mọi tin nhắn.”*
- **4 bước:** Thêm 1 câu ở đầu mục “Quy trình”:  
  *“Áp dụng 4 bước này khi bạn đang tư vấn có chiều sâu (business, sức khỏe, lộ trình). Với trao đổi ngắn (cảm ơn, chào, câu hỏi đơn giản), trả lời tự nhiên, ngắn gọn, không bắt buộc đủ 4 bước.”*

---

## 5. Kỹ thuật – Cần làm để “hành động”

### 5.1 Chỉnh system prompt (server.js)

- Giữ `BASE_SYSTEM_PROMPT` và cấu trúc hiện tại:  
  `BASE_SYSTEM_PROMPT + "\n\n---\nLATEST JOY RULES..." + (knowledge) + (summary)".`
- **Thêm** một hằng (vd. `ULTIMATE_CONSULTANT_LAYER`) chứa toàn bộ prompt “DIGITAL JOY ULTIMATE CONSULTANT” (đã chỉnh sửa theo mục 4).
- Nối vào `systemInstruction` **sau** rules từ Doc, **trước** (hoặc sau) Knowledge, ví dụ:  
  `systemInstruction += "\n\n---\n" + ULTIMATE_CONSULTANT_LAYER;`
- Không đổi cách gọi Gemini (vẫn `systemInstruction` như hiện tại).

### 5.2 Quick-reply buttons (tùy chọn, làm sau)

- **Backend:** Thống nhất format (vd. Joy trả lời kèm dòng đặc biệt, ví dụ `[BUTTONS: A | B | C]`), API parse và trả về `{ reply: "...", buttons: ["A","B","C"] }`.
- **Frontend:** Nếu `data.buttons` tồn tại, render các nút dưới bubble của Joy; click = gửi nội dung nút đó như tin nhắn user (và ẩn nút).
- Có thể làm **Phase 2**: trước chỉ cần prompt chữ, Joy có thể viết “Bạn có thể chọn: [Người mới tìm hiểu] / [Thành viên đang hoạt động] / [Leader]” trong text; sau mới bật nút thật.

---

## 6. Thứ tự thực hiện đề xuất

1. **Bước 1 (làm ngay):** Chỉnh lại **chữ prompt** Ultimate Consultant theo mục 2, 3, 4 (mềm 4 bước, rõ khi nào dùng nút, thêm cấm từ y tế, độ dài).
2. **Bước 2:** Thêm `ULTIMATE_CONSULTANT_LAYER` vào `server.js` và nối vào `systemInstruction`. Test vài đoạn hội thoại (business, health, cảm ơn) để đảm bảo không quá dài / không máy móc.
3. **Bước 3 (tùy chọn):** Thiết kế format buttons + parse backend + render frontend để có quick-reply thật.

Nếu bạn đồng ý với bản plan này (đặc biệt phần DO/DON'T và chỉnh chữ prompt), bước tiếp theo có thể là: (1) tạo nội dung cuối cùng cho `ULTIMATE_CONSULTANT_LAYER` và (2) chèn vào `server.js` theo đúng thứ tự trên.
