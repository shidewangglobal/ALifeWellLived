# Joy nhớ từng người + Quản trị data khách hàng (không cần đăng nhập)

Bạn muốn:
1. **Joy nhớ tình hình từng người** – người mới hay đã làm kinh doanh với OTG, nhu cầu, v.v.
2. **Onboarding questions** – thu thập thông tin ban đầu để Joy biết context.
3. **Quản trị data khách hàng** – dù chỉ dùng website (không đăng nhập), vẫn có lịch sử theo từng người và quản lý được.

---

## 1. Hiện trạng

- **Session:** Mỗi lần mở web = 1 `session_id` (lưu trong trình duyệt). Cùng một người dùng máy khác hoặc xóa cookie → session mới → Joy không biết là “cùng người”.
- **Danh tính:** User có thể nhập **Tên** + **SĐT/Email** (không bắt buộc). Backend lưu vào `chat_sessions` (user_name, user_contact) theo từng session.
- **Hạn chế:** Chưa có “một người = một hồ sơ”; chưa có onboarding; admin chỉ thấy danh sách session, chưa gom theo “khách hàng”.

---

## 2. Cách “nhận diện một người” khi không có đăng nhập

**Ý tưởng:** Dùng **SĐT hoặc Email** làm “chìa khóa” để coi là cùng một khách hàng.

- Lần đầu họ nhập email/SĐT → tạo hoặc cập nhật **hồ sơ khách hàng** (customer) gắn với contact đó.
- Mỗi lần chat (mỗi session) vẫn có `session_id` riêng, nhưng **gắn thêm** với **contact** (email/SĐT). Khi cùng contact → nhiều session vẫn thuộc **cùng một khách hàng**.
- Admin: thay vì chỉ xem danh sách session, có thể xem **danh sách khách hàng** (theo contact), mỗi khách hàng có nhiều phiên chat và **một bộ thông tin onboarding/profile** dùng chung.

**Kết luận:** Không cần form “đăng nhập” (mật khẩu, OTP). Chỉ cần user **điền SĐT hoặc Email** (như hiện tại) và backend **chuẩn hóa + lưu** contact đó; mọi session có cùng contact sẽ được gom về một “khách hàng” để Joy nhớ và admin quản lý.

---

## 3. Joy nhớ tình hình từng người – Onboarding + Profile

### 3.1. Onboarding questions (câu hỏi làm quen)

Mục đích: Thu thập ít thông tin quan trọng ngay từ đầu để Joy biết context (mới / đã làm với OTG, quan tâm gì).

**Ví dụ câu hỏi (có thể chỉnh lại):**

1. Bạn đang là **người mới tìm hiểu** hay **đã làm kinh doanh / hợp tác với OTG**?
2. Bạn quan tâm nhất đến **sức khỏe**, **kinh doanh**, hay **cả hai**?
3. (Tùy chọn) Bạn muốn Joy hỗ trợ ưu tiên: **tư vấn sản phẩm**, **quy trình tham gia**, **theo dõi đơn hàng**, v.v.?

**Cách triển khai:**

- **Cách A – Hỏi trong chat:** Joy tự hỏi từng câu trong vài tin nhắn đầu (theo script trong rule/prompt), user trả lời bằng text. Backend nhận diện câu trả lời (keyword hoặc đơn giản) và **lưu vào profile** (bảng mới hoặc cột trong bảng khách hàng).
- **Cách B – Form ngắn trên web:** Trước khi vào khung chat, hiện 3–5 câu hỏi (dropdown/radio). User điền xong → gửi lên server → lưu profile và gắn với session/contact → mới vào chat. Joy lúc trả lời đã có sẵn profile trong context.

Cả hai cách đều cần **lưu kết quả onboarding** vào database (xem mục 4).

### 3.2. Joy dùng profile khi trả lời

- Mỗi khi tạo tin nhắn cho user, backend **lấy profile/onboarding** của khách hàng tương ứng (theo session → contact → customer profile).
- **Đưa vào system prompt** cho Gemini, ví dụ:  
  “Khách hàng này: đã làm kinh doanh với OTG; quan tâm cả sức khỏe và kinh doanh; ưu tiên tư vấn quy trình tham gia.”
- Joy sẽ trả lời phù hợp (người mới vs đã làm, nhu cầu khác nhau) và “nhớ” tình hình từng người dù họ quay lại sau nhiều ngày.

---

## 4. Cấu trúc dữ liệu gợi ý (Supabase)

### 4.1. Bảng `customers` (khách hàng = một người, nhận diện bởi contact)

| Cột | Kiểu | Ghi chú |
|-----|------|--------|
| id | uuid (PK, auto) | |
| contact | text, unique | Email hoặc SĐT đã chuẩn hóa (lowercase, bỏ khoảng trắng) |
| name | text | Tên (cập nhật mỗi lần user nhập) |
| onboarding_done | boolean | Đã trả lời onboarding chưa |
| profile_json | jsonb hoặc text | Lưu câu trả lời onboarding (vd: {"type": "existing_otg", "interest": "health_business", "priority": "process"}) |
| first_seen_at | timestamptz | Lần đầu có tương tác |
| last_seen_at | timestamptz | Cập nhật mỗi lần chat |

- **contact** là key: cùng SĐT/email → cùng 1 row `customers`.

### 4.2. Cập nhật bảng `chat_sessions`

Thêm cột:

- **customer_id** (uuid, nullable): khóa ngoại tham chiếu `customers.id`. Khi user gửi tin có kèm contact, backend tìm hoặc tạo `customers` theo contact rồi gán `session.customer_id = customers.id`.

Như vậy: một customer có nhiều session; mỗi session vẫn có user_name, user_contact (để hiển thị), nhưng đã được “gom” về một khách hàng.

### 4.3. Quan hệ

- `customers` 1 – n `chat_sessions` (qua customer_id).
- `chat_sessions` 1 – n `chat_messages` (đã có sẵn).

---

## 5. Quản trị data khách hàng (Admin)

### 5.1. Không cần đăng nhập website, vẫn quản trị được vì:

- **Dữ liệu nằm ở backend (Supabase):** Mọi tin nhắn và thông tin user (contact, tên, onboarding) đều lưu trên server, gắn với `session_id` và (sau khi thêm) `customer_id`.
- **Admin là trang riêng** (vd: `/admin?key=...`) chỉ cho người có secret; không phụ thuộc user có “đăng nhập” hay không.

### 5.2. Chức năng admin nên có (theo từng bước)

1. **Danh sách session (như hiện tại)** – đã có: session_id, tên, contact, số tin, thời gian.
2. **Danh sách khách hàng (theo contact):**
   - Gom các session có cùng contact (hoặc cùng customer_id) thành “một khách hàng”.
   - Hiển thị: contact, tên, đã onboarding chưa, profile tóm tắt, số lần chat / số session, last_seen.
   - Click vào một khách hàng → xem **tất cả phiên chat** của người đó (danh sách session + nội dung từng session).
3. **Lịch sử từng người:** Chính là “tất cả session của customer đó” + toàn bộ tin nhắn trong từng session. Có thể thêm tóm tắt (conversation_summary) cho từng session nếu đã có.

Như vậy dù user **chỉ dùng website, không đăng nhập**, bạn vẫn:
- **Quản trị được data:** Xem theo khách hàng (contact), xem từng phiên, từng tin nhắn.
- **Có lịch sử từng người:** Mỗi người (contact) = một hồ sơ + nhiều phiên chat.

---

## 6. Luồng kỹ thuật tóm tắt

1. **User mở web →** Tạo hoặc lấy `session_id` (như hiện tại). Có thể hiện form onboarding (Cách B) hoặc vào chat luôn (Cách A).
2. **User nhập Tên + SĐT/Email (và nếu dùng form) trả lời onboarding →** Gửi lên server. Backend:
   - Chuẩn hóa contact (email/SĐT).
   - Tìm hoặc tạo bản ghi `customers` (theo contact), cập nhật name, onboarding_done, profile_json, last_seen.
   - Cập nhật `chat_sessions` (session_id): user_name, user_contact, **customer_id**.
3. **Mỗi lần chat:** Backend lấy `customer_id` từ session → lấy `customers.profile_json` (+ conversation_summary nếu cần) → đưa vào system prompt cho Joy → Joy trả lời theo đúng tình hình người đó (mới / đã làm OTG, nhu cầu).
4. **Admin:** Trang mới hoặc tab “Khách hàng”: list customers, click vào → xem mọi session và tin nhắn của người đó. Có thể export hoặc filter theo contact/onboarding (sau này).

---

## 7. Các bước triển khai gợi ý

| Bước | Nội dung |
|------|----------|
| 1 | Tạo bảng `customers` và thêm cột `customer_id` vào `chat_sessions` (Supabase). |
| 2 | Backend: khi nhận tin nhắn có user_contact, chuẩn hóa contact → tìm/tạo customer → gán session.customer_id. Lưu/cập nhật onboarding (profile_json) nếu request gửi kèm câu trả lời onboarding. |
| 3 | Backend: khi gọi Gemini, lấy profile của customer (nếu có) và đưa vào system prompt để Joy “nhớ” tình hình. |
| 4 | Frontend: thêm luồng onboarding (form ngắn trước chat hoặc để Joy hỏi trong chat và parse câu trả lời). Gửi kèm contact + câu trả lời lên API. |
| 5 | Admin: API + trang “Khách hàng” – list theo customer, xem tất cả session và tin nhắn của từng người. |

Khi bạn muốn bắt đầu từ bước nào (vd: thiết kế bảng `customers` + API, hoặc luồng onboarding trên web), có thể nói rõ để triển khai từng bước cụ thể trong code.
