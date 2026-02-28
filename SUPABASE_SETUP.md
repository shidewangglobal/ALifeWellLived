# Hướng dẫn thiết lập Supabase cho lịch sử hội thoại (Cách 2)

## 1. Tạo project Supabase

1. Vào [supabase.com](https://supabase.com), đăng ký / đăng nhập.
2. New project → đặt tên (vd: `joy-chat`), chọn region, đặt mật khẩu database → Create.
3. Đợi vài phút cho project ready.

## 2. Tạo bảng `chat_messages`

1. Trong dashboard Supabase: **Table Editor** → **New table**.
2. Tên bảng: `chat_messages`.
3. Thêm cột (Columns):
   - `id`: type `int8`, tick **Primary key**, tick **Identity (auto-generate)**.
   - `session_id`: type `text`, bỏ **Nullable** (bắt buộc).
   - `role`: type `text`, bỏ **Nullable** (giá trị: `user` hoặc `model`).
   - `content`: type `text`, cho phép Nullable nếu muốn.
   - `created_at`: type `timestamptz`, mặc định: `now()`.
4. **Save**.

Hoặc chạy SQL trong **SQL Editor**:

```sql
create table if not exists chat_messages (
  id bigint primary key generated always as identity,
  session_id text not null,
  role text not null,
  content text,
  created_at timestamptz default now()
);

create index idx_chat_messages_session on chat_messages(session_id);
create index idx_chat_messages_created on chat_messages(created_at desc);
```

**Bảng lưu thông tin người dùng (để biết “ai đang chat”):**

```sql
create table if not exists chat_sessions (
  session_id text primary key,
  user_name text,
  user_contact text,
  conversation_summary text,
  last_seen timestamptz default now()
);
```

Nếu bảng `chat_sessions` đã tạo trước đó, thêm cột tóm tắt:  
`alter table chat_sessions add column if not exists conversation_summary text;`

- **conversation_summary**: tóm tắt cuộc hội thoại; Joy dùng để "nhớ" nội dung cũ khi hội thoại dài (chỉ gửi ~25 tin gần nhất + tóm tắt phần cũ cho Gemini). Tạo tóm tắt: `POST /api/admin/summarize-session?key=ADMIN_SECRET&session_id=xxx`
- Sau khi user điền "Tên" hoặc "SĐT/Email" và gửi tin, backend lưu vào bảng này. Trang admin hiển thị tên/liên hệ bên cạnh mỗi phiên.

## 3. Lấy URL và API key

1. **Settings** (icon bánh răng) → **API** → trang **API Keys**.
2. **Project URL** (ở đầu trang) → copy vào `.env` biến `SUPABASE_URL`.
3. Trên trang API Keys có **2 tab**:
   - **Publishable and secret API keys** (tab mặc định) — *không dùng cho backend*
   - **Legacy anon, service_role API keys** ← **bấm vào tab này**
4. Trong tab Legacy, copy **service_role** (key dài, thường bắt đầu `eyJ...`) → dán vào `.env` biến `SUPABASE_SERVICE_ROLE_KEY`.  
   ⚠️ Không dùng key **anon**; phải dùng **service_role** thì trang admin mới đọc được tất cả tin nhắn.

## 4. Cấu hình .env

Thêm vào file `.env` (tạo từ `.env.example`):

```
SUPABASE_URL=https://xxxx.supabase.co
SUPABASE_SERVICE_ROLE_KEY=eyJhbGc...
ADMIN_SECRET=dat_chon_mot_mat_khau_ban_quyen
```

- `ADMIN_SECRET`: đặt bất kỳ chuỗi bí mật nào bạn muốn. Khi xem lịch sử, mở:  
  `https://your-app.onrender.com/admin?key=dat_chon_ột_mat_khau_ban_quyen`

## 5. Cài dependency (nếu chưa)

```bash
npm install @supabase/supabase-js
```

## 6. Chạy lại server

```bash
npm start
```

Sau mỗi lần user gửi tin và Joy trả lời, backend sẽ lưu 2 dòng (user + model) vào Supabase. Trang admin liệt kê theo phiên, mới nhất trước, bấm để xem nội dung.

---

## Lưu dữ liệu ở đâu?

- **Tin nhắn:** bảng `chat_messages` (session_id, role, content, created_at).
- **Thông tin người dùng (tùy chọn):** bảng `chat_sessions` (session_id, user_name, user_contact, last_seen). User điền "Tên" / "SĐT hoặc Email" trên trang chat → lưu vào đây → trang admin hiển thị để bạn biết ai đang chat và lịch sử của họ.
- **Khi user “quay lại”:** cùng trình duyệt = cùng `session_id` (lưu trong localStorage) → tự tải lại lịch sử. Nếu họ đã điền tên/liên hệ, bạn sẽ thấy trên admin.

**Nếu refresh trang Joy mà không thấy lại cuộc hội thoại:** (1) Kiểm tra terminal có dòng "Supabase save chat ERROR" không. (2) Vào trang admin với đúng key, xem đã có phiên đó chưa. (3) Nếu dùng trình duyệt ẩn danh hoặc xóa dữ liệu trang, session_id mới → lịch sử cũ không hiện (đó là phiên khác).
