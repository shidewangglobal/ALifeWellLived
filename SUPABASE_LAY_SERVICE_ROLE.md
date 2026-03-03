# Cách lấy SUPABASE_URL và service_role key (service_role)

Làm lần lượt trong Supabase Dashboard.

---

## Bước 1: Vào project

1. Mở trình duyệt, vào **https://supabase.com**
2. Đăng nhập (nếu chưa).
3. Chọn **project** của Joy (vd: joy-chat, hoặc tên bạn đã tạo).

---

## Bước 2: Mở trang API / Settings

1. Ở **menu bên trái**, bấm **Settings** (icon bánh răng ⚙️).
2. Trong Settings, bấm **API** (hoặc **API Keys**).

Bạn sẽ thấy trang có **Project URL** và các loại key.

---

## Bước 3: Lấy Project URL (→ SUPABASE_URL)

- Ở **đầu trang** có dòng **Project URL**, dạng: `https://xxxxxx.supabase.co`
- **Copy** nguyên link đó → đây là giá trị **SUPABASE_URL** (dán vào Render Environment và .env).

---

## Bước 4: Tìm key service_role

Trên trang **API** có thể có **một trong hai kiểu** giao diện:

### Cách A: Có tab "Legacy" / "Legacy anon, service_role API keys"

- Tìm **các tab** phía trên (vd: "Publishable and secret API keys" và **"Legacy anon, service_role API keys"**).
- Bấm vào tab **"Legacy anon, service_role API keys"** (hoặc tên tương tự có chữ **Legacy**).
- Trong tab đó sẽ có **2 key**: `anon` (public) và **`service_role`** (secret).
- Chỉ cần **service_role**: bấm **Reveal** / **Copy** để xem và copy key (chuỗi dài, thường bắt đầu bằng `eyJ...`).
- Key đó là **SUPABASE_SERVICE_ROLE_KEY** (dán vào Render và .env).

### Cách B: Có mục "Secret keys" / "Project API keys"

- Nếu không thấy tab Legacy, kéo xuống tìm mục **"Secret keys"** hoặc **"Project API keys"**.
- Trong đó có key dùng cho backend (service role). Copy key **secret** (không phải key "anon" / "publishable").
- Nếu có nhiều key, chọn key có ghi **service_role** hoặc **secret** (quyền cao, dùng server-side).

### Cách C: Dùng "Connect" / "Connect to project"

- Một số phiên bản có nút **Connect** hoặc **Connect to project** trên dashboard.
- Bấm vào đó, chọn **Node.js** hoặc **Server**, sẽ hiện **Project URL** và **service_role key** (hoặc "secret key") để copy.

---

## Tóm tắt

| Biến (Render / .env) | Lấy ở đâu trong Supabase |
|----------------------|---------------------------|
| **SUPABASE_URL**     | Settings → API → **Project URL** (đầu trang) |
| **SUPABASE_SERVICE_ROLE_KEY** | Settings → API → tab **Legacy** → **service_role** HOẶC mục **Secret keys** → key secret / service_role |

---

## Sau khi có 2 giá trị

- **Trên Render:** Environment → thêm `SUPABASE_URL` và `SUPABASE_SERVICE_ROLE_KEY` = 2 giá trị vừa copy → Save → đợi deploy.
- **Local:** Mở file `.env`, sửa hoặc thêm 2 dòng tương ứng (nếu chưa có).

Lưu ý: **Không** dùng key **anon** (public). Phải dùng **service_role** (secret) thì trang admin mới đọc được dữ liệu.
