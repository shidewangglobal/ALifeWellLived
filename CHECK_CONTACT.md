# Kiểm tra contact "Bo" (0908257806) trong database

## Vì sao có thể không thấy trong "lịch sử" (trang admin)

Trang admin **chỉ hiển thị các phiên (session) có ít nhất 1 tin nhắn** trong bảng `chat_messages`. Tên/SĐT lấy từ bảng `chat_sessions`.

- Nếu **Bo** đã điền tên + SĐT nhưng **chưa gửi tin nhắn nào** → không có dòng nào trong `chat_messages` → phiên đó **không xuất hiện** trong danh sách admin.
- Tên/SĐT chỉ được lưu vào `chat_sessions` **khi có tin nhắn được gửi** (kèm thông tin đó). Nếu Bo chỉ điền form rồi thoát, chưa gửi tin → có thể không có bản ghi tương ứng.

---

## Cách kiểm tra trực tiếp trong Supabase

1. Vào **https://supabase.com** → đăng nhập → chọn project.
2. Vào **Table Editor**.
3. Kiểm tra hai bảng:

### Bảng `chat_sessions`

- Mở bảng **chat_sessions**.
- Xem cột **user_name**, **user_contact**.
- Tìm dòng có `user_contact` = `0908257806` hoặc `user_name` = `Bo` (hoặc từ khóa tương tự). Có thể dùng filter/search nếu Supabase hỗ trợ.

→ Nếu **có** dòng đó: contact Bo đã được lưu. Ghi lại **session_id** của dòng đó.

→ Nếu **không có**: Bo chưa từng gửi tin nhắn kèm SĐT này (hoặc gửi từ phiên khác với tên/SĐT khác).

### Bảng `chat_messages`

- Mở bảng **chat_messages**.
- Nếu đã có **session_id** của Bo từ bước trên: filter cột **session_id** = giá trị đó.
- Xem có dòng nào không.

→ Nếu **có** tin nhắn: phiên đó đáng lẽ phải hiện ở trang admin. Khi đó có thể do lỗi hiển thị hoặc bộ lọc.

→ Nếu **không có** tin nhắn cho session_id đó: đó là lý do phiên không hiện trong "lịch sử" (admin chỉ liệt kê session có tin nhắn).

---

## Tìm nhanh bằng SQL (trong Supabase SQL Editor)

Chạy trong **SQL Editor**:

```sql
-- Tìm trong chat_sessions theo SĐT hoặc tên
SELECT * FROM chat_sessions
WHERE user_contact LIKE '%0908257806%' OR user_name ILIKE '%Bo%';
```

Nếu có kết quả, copy **session_id** rồi chạy:

```sql
-- Xem tin nhắn của phiên đó
SELECT * FROM chat_messages
WHERE session_id = 'SESSION_ID_VỪA_COPY'
ORDER BY created_at;
```

Thay `SESSION_ID_VỪA_COPY` bằng đúng `session_id` vừa tìm được.

---

## Tóm tắt

- **Trang admin** = "lịch sử cuộc hội thoại" (chỉ các phiên **có tin nhắn**).
- Contact **Bo / 0908257806** muốn thấy trong đó thì phiên đó phải có ít nhất 1 tin nhắn trong `chat_messages`, và tên/SĐT đã được gửi kèm khi gửi tin (để lưu vào `chat_sessions`).
- Kiểm tra trực tiếp trong Supabase (Table Editor + SQL trên) sẽ cho biết có bản ghi Bo hay không và phiên đó có tin nhắn hay không.
