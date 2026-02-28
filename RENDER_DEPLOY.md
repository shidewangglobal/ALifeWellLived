# Hướng dẫn deploy Joy lên Render (từng bước)

## Bước 1: Đẩy code lên GitHub

1. Mở **Terminal**, vào thư mục dự án:
   ```bash
   cd "/Users/DatVuong/Library/Mobile Documents/com~apple~CloudDocs/Documents/WORK/AI DIGITAL CURSOR/joy/scripts"
   ```

2. Kiểm tra đã có git chưa:
   ```bash
   git status
   ```
   - Nếu báo "not a git repository", chạy: `git init`

3. Thêm file và commit (bỏ qua file nhạy cảm đã có trong .gitignore):
   ```bash
   git add .
   git commit -m "Deploy Joy - chat UI + Supabase + admin"
   ```

4. Tạo repo trên GitHub (nếu chưa có):
   - Vào https://github.com/new
   - Đặt tên repo (vd: `joy-chat` hoặc `a-life-well-lived-joy`)
   - **Không** chọn "Add a README" nếu folder đã có code
   - Bấm **Create repository**

5. Kết nối và đẩy code (thay `USERNAME` và `REPO` bằng tên GitHub của bạn và tên repo):
   ```bash
   git remote add origin https://github.com/USERNAME/REPO.git
   git branch -M main
   git push -u origin main
   ```
   - Khi hỏi password: dán **Personal Access Token** (PAT) của GitHub (không dùng mật khẩu đăng nhập).

---

## Bước 2: Tạo Web Service trên Render

1. Đăng nhập https://dashboard.render.com

2. Bấm **New +** → chọn **Web Service**.

3. **Connect a repository**: nếu chưa kết nối GitHub thì bấm **Connect GitHub** và chọn repo vừa đẩy (vd: `joy-chat`). Sau đó chọn repo đó.

4. Điền thông tin:
   - **Name:** `joy` (hoặc tên bạn thích)
   - **Region:** Singapore (hoặc gần VN nhất)
   - **Branch:** `main`
   - **Root Directory:** để trống (vì code nằm ở thư mục gốc của repo).  
     *Nếu bạn đẩy cả folder `scripts` lên và muốn deploy từ trong `scripts`, đặt Root Directory là `scripts`.*

5. **Build & Deploy:**
   - **Runtime:** Node
   - **Build Command:** `npm install`
   - **Start Command:** `npm start`

6. Chọn **Free** (hoặc plan khác nếu có).

---

## Bước 3: Thêm Environment Variables (biến môi trường)

Trong trang tạo/cấu hình Web Service, kéo xuống **Environment** → **Add Environment Variable**. Thêm lần lượt:

| Key | Value | Ghi chú |
|-----|--------|--------|
| `GEMINI_API_KEY` | API key Gemini của bạn | Bắt buộc |
| `SUPABASE_URL` | https://xxxx.supabase.co | Nếu dùng lịch sử chat + admin |
| `SUPABASE_SERVICE_ROLE_KEY` | key **service_role** từ Supabase | Cùng bộ với Supabase |
| `ADMIN_SECRET` | Chuỗi bí mật bạn đặt (vd: joy_admin_2024) | Để mở /admin?key=... |
| `JOY_RULE_DOC_ID` | ID Google Doc chứa rule Joy | Nếu dùng Google Doc rule |
| `JOY_DRIVE_FOLDER_ID` | ID folder Drive chứa knowledge | Nếu đọc cả folder Drive |

**Nếu bạn dùng Drive folder (service account):**

- **Key:** `GOOGLE_APPLICATION_CREDENTIALS_JSON`  
- **Value:** toàn bộ nội dung file `credentials/drive-service-account.json` **dán thành 1 dòng** (một dòng JSON, không xuống dòng).  
  Hoặc dùng base64 (trong Terminal Mac):
  ```bash
  node -e "console.log(require('fs').readFileSync('credentials/drive-service-account.json').toString('base64'))"
  ```
  Rồi trong Render thêm biến (nếu server hỗ trợ đọc base64):  
  `GOOGLE_APPLICATION_CREDENTIALS_JSON_BASE64` = chuỗi base64 vừa copy.  
  *(Trong code hiện tại thường dùng dán thẳng JSON một dòng vào `GOOGLE_APPLICATION_CREDENTIALS_JSON`.)*

Sau khi thêm xong, bấm **Save** (hoặc tương đương).

---

## Bước 4: Deploy

1. Bấm **Create Web Service** (hoặc **Save** nếu đang sửa service cũ).

2. Render sẽ chạy **Build** rồi **Deploy**. Đợi vài phút.

3. Khi trạng thái **Live** (màu xanh), bạn có link dạng:
   - `https://joy-xxxx.onrender.com`

4. Kiểm tra:
   - Trang chat: `https://joy-xxxx.onrender.com/`
   - Trang admin: `https://joy-xxxx.onrender.com/admin?key=ADMIN_SECRET` (thay `ADMIN_SECRET` bằng giá trị bạn đặt)
   - API models (kiểm tra Gemini): `https://joy-xxxx.onrender.com/api/models`

---

## Lưu ý

- **Free tier** Render sẽ sleep sau ~15 phút không có request. Lần mở đầu sau khi sleep có thể chậm 30–60 giây.
- **PORT:** Render tự gán, server đã dùng `process.env.PORT || 3000` nên không cần thêm biến PORT.
- Nếu sửa code và muốn deploy lại: commit + push lên `main`, Render sẽ tự build và deploy (nếu đã bật Auto-Deploy).
- Giữ bí mật: không commit file `.env` hoặc `credentials/*.json` lên GitHub; chỉ nhập giá trị vào Environment Variables trên Render.
