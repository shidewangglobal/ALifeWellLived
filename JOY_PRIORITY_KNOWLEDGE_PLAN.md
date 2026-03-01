# Kế hoạch: Joy ưu tiên thông tin quan trọng & thông tin mới

Khi Drive có rất nhiều file, cần cách để Joy:
1. **Ưu tiên thông tin quan trọng** (core, chính thống).
2. **Ưu tiên thông tin mới** (cập nhật gần đây).

---

## 1. Nguyên tắc

- **Thứ tự trong context** ảnh hưởng tới câu trả lời: nội dung đưa **trước** và có **nhãn rõ ràng** thường được model ưu tiên hơn.
- **Giới hạn token**: không gửi hết mọi file; cần chọn/sắp xếp để phần quan trọng + mới nằm trong giới hạn.

---

## 2. Ưu tiên “thông tin quan trọng”

### Ưu tiên theo folder (phù hợp khi nội dung đổi hàng tuần)

Vì hoạt động diễn ra hàng tuần, ưu tiên từng file rất khó. **Ưu tiên theo folder** hợp lý hơn: ví dụ folder **Kế hoạch kinh doanh**, **Sản phẩm**, **Hướng dẫn chính**. Mọi file trong folder đó được Joy coi là ưu tiên; bạn chỉ cần đặt/sửa file trong đúng folder.

- Trên Drive, tạo vài folder "luôn ưu tiên", ví dụ:
  - **Kế hoạch kinh doanh** (business plan, chiến lược)
  - **Sản phẩm** (mô tả sản phẩm, giá, ưu đãi)
  - **Hướng dẫn / Quy trình** (nếu có)
- Trong code: khi quét Drive, **load folder “Core” trước**, rồi mới tới folder còn lại. Trong chuỗi gửi cho Gemini, phần Core đặt **trước** và có tiêu đề rõ (vd: `--- KIẾN THỨC ƯU TIÊN (CORE) ---`).

**Việc bạn cần làm:** Sắp xếp lại Drive (hoặc từ giờ đặt file quan trọng vào folder tên cố định, ví dụ `Core` hoặc `Priority`). Code sẽ được chỉnh để nhận diện folder đó và ưu tiên.

**Cấu hình:** Trong .env thêm `JOY_PRIORITY_FOLDER_IDS=id1,id2,id3` (ID từng folder ưu tiên). Lấy folder ID từ URL Drive: phần `folders/XXXXXXXX` → `XXXXXXXX` là ID. Code sẽ load các folder đó trước, rồi mới tới folder chung; trong mỗi folder sort file theo modifiedTime (mới trước).

---

## 3. Ưu tiên “thông tin mới”

### Sắp xếp theo ngày sửa đổi (modifiedTime)

- Drive API trả về `modifiedTime` cho mỗi file.
- Trong code:
  - Khi list file (trong từng folder hoặc toàn bộ), lấy thêm `modifiedTime`.
  - Sort danh sách: **mới nhất trước** (modifiedTime giảm dần).
  - Ghép nội dung theo thứ tự đã sort → phần **mới nhất** nằm **trước** trong context gửi Gemini.

Kết hợp với “quan trọng”:  
**Bước 1:** Lấy nhóm “ưu tiên” (Core / priority IDs) → sort trong nhóm theo modifiedTime (mới trước) → nối vào chuỗi.  
**Bước 2:** Lấy các file còn lại → sort theo modifiedTime (mới trước) → nối tiếp đến khi đủ giới hạn ký tự.

---

## 4. Hướng dẫn cho Joy trong system prompt

Thêm (hoặc chỉnh) đoạn trong system prompt, đại ý:

- “Phần KNOWLEDGE được sắp xếp: trước là **ưu tiên cao / core**, sau là **cập nhật gần đây**. Khi trả lời, ưu tiên thông tin xuất hiện trước và thông tin mới hơn; nếu có mâu thuẫn giữa các nguồn, chọn theo thứ tự ưu tiên và bản mới nhất.”

Như vậy Joy vừa “biết” thứ tự ưu tiên vừa biết nên tin vào bản mới.

---

## 5. Các bước triển khai (gợi ý)

| Bước | Nội dung | Độ khó |
|------|----------|--------|
| **1** | Thêm `modifiedTime` vào API list file Drive; sort toàn bộ file theo **mới nhất trước**; giữ nguyên cách ghép nội dung hiện tại. | Dễ |
| **2** | Trong prompt: thêm 1–2 câu nói rõ “phần knowledge đã xếp: mới trước; ưu tiên thông tin mới khi có mâu thuẫn.” | Dễ |
| **3** | Quy ước folder **Core** (hoặc tên cố định) trên Drive; chỉnh code: load folder Core trước, rồi mới load folder chính; mỗi nhóm sort theo modifiedTime. | Trung bình |
| **4** | (Tùy chọn) Thêm .env `JOY_PRIORITY_FOLDER_IDS` / `JOY_PRIORITY_DOC_IDS`; load các ID đó trước rồi mới load phần còn lại. | Trung bình |
| **5** | (Tùy chọn) Thêm tiêu đề rõ trong chuỗi knowledge, ví dụ: `--- CORE (ưu tiên cao) ---`, `--- CẬP NHẬT GẦN ĐÂY ---` để model đọc rõ hơn. | Dễ |

---

## 6. Bạn có thể làm ngay (không cần sửa code)

- **Chuẩn bị cấu trúc Drive:** Tạo folder tên cố định cho tài liệu quan trọng (vd: `Core`, `Priority`) và cho tài liệu chung (vd: `Knowledge`). Từ giờ đặt file đúng folder.
- **Cập nhật thường xuyên:** File nào quan trọng và hay đổi thì sửa lại (save) để `modifiedTime` mới → khi code sort theo ngày, chúng tự được đưa lên trước.
- **Quy ước tên (nếu sau này dùng Cách C):** Có thể đặt tên file dạng `[CORE] Tên.docx` hoặc `[P1] Tên.docx` để sau code dễ nhận diện và ưu tiên.

Khi bạn sẵn sàng, có thể làm lần lượt từ **Bước 1** (sort theo modifiedTime) và **Bước 2** (chỉnh prompt), rồi mới tới folder ưu tiên (Bước 3–4). Nếu bạn gửi cấu trúc folder Drive hiện tại (tên folder, ví dụ vài file), có thể đề xuất chi tiết hơn cho từng bước (vd: folder ID nào là “Core”, biến .env nên đặt tên gì).
