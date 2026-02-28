# Deploy Joy lên mạng (dùng GitHub + Render)

Để có link cho người khác thử Joy, bạn deploy project lên **Render** (free, đăng ký bằng GitHub).

---

## Bước 1 – Đăng ký GitHub (nếu chưa có)

1. Vào **https://github.com** → **Sign up**.
2. Nhập email, mật khẩu, tên user → Verify email.
3. Đăng nhập vào GitHub.

---

## Bước 2 – Đẩy project Joy lên GitHub

### 2.1 Cài Git (nếu máy chưa có)

Mở Terminal, gõ:
```bash
git --version
```
Nếu báo "command not found", cài Git: https://git-scm.com/download/mac hoặc `brew install git`.

### 2.2 Tạo repo trên GitHub

1. Trên GitHub, bấm **+** (góc trên phải) → **New repository**.
2. **Repository name:** `joy-alifewelllived` (hoặc tên bạn thích).
3. Chọn **Private** hoặc **Public** → **Create repository**.
4. **Không** tick "Add a README" (để repo trống).

### 2.3 Đẩy code từ máy lên repo

Trong Terminal, chạy **lần lượt** (thay `YOUR_USERNAME` bằng tên GitHub của bạn):

```bash
cd "/Users/DatVuong/Library/Mobile Documents/com~apple~CloudDocs/Documents/WORK/AI DIGITAL CURSOR/joy/scripts"

git init
git add .
git commit -m "Joy - A Life Well Lived"
git branch -M main
git remote add origin https://github.com/YOUR_USERNAME/joy-alifewelllived.git
git push -u origin main
```

Khi hỏi đăng nhập: dùng **username GitHub** và **Personal Access Token** (không dùng mật khẩu). Tạo token: GitHub → Settings → Developer settings → Personal access tokens → Generate new token (tick `repo`).

---

**Lưu ý:** File `.env` và thư mục `credentials/` đã nằm trong `.gitignore`, nên **sẽ không** bị đẩy lên GitHub (bảo mật). Khi deploy trên Render bạn sẽ nhập lại các biến môi trường.

---

## Bước 3 – Deploy trên Render

1. Vào **https://render.com** → **Get started** → chọn **Sign up with GitHub**.
2. Authorize Render truy cập GitHub (chọn repo hoặc All).
3. Trên Dashboard Render → **New +** → **Web Service**.
4. **Connect repository:** chọn repo `joy-alifewelllived` (hoặc tên bạn đặt).
5. Cấu hình:
   - **Name:** `joy-alifewelllived` (tùy chọn).
   - **Region:** Singapore hoặc Oregon.
   - **Branch:** `main`.
   - **Runtime:** Node.
   - **Build command:** `npm install`
   - **Start command:** `npm start`
   - **Instance type:** Free.

6. **Environment (biến môi trường)** – bấm **Add Environment Variable**, thêm từng biến:

   | Key | Value (ví dụ / ghi chú) |
   |-----|-------------------------|
   | `GEMINI_API_KEY` | API key Gemini của bạn |
   | `JOY_RULE_DOC_ID` | ID file Google Doc Joy rules |
   | `JOY_DRIVE_FOLDER_ID` | ID thư mục Drive (AI DIGITAL ADMIN _Final) |
   | `GOOGLE_APPLICATION_CREDENTIALS_JSON` | **Toàn bộ nội dung** file `drive-service-account.json` (copy từ `{` đến `}`) dán vào, **một dòng** |

   **Cách lấy GOOGLE_APPLICATION_CREDENTIALS_JSON:** Mở file `credentials/drive-service-account.json` trong Cursor, copy **toàn bộ** (từ `{` đến `}`), dán vào ô Value. Có thể cần bỏ xuống dòng thành 1 dòng (Render cho phép nhiều dòng trong JSON).

7. Bấm **Create Web Service**. Render sẽ build và deploy (vài phút).

8. Khi xong, bạn sẽ thấy **URL** dạng: `https://joy-alifewelllived.onrender.com`. Đó là **link preview** – gửi cho người khác để họ thử Joy.

---

## Sau khi deploy

- **Free tier:** Service có thể "ngủ" sau ~15 phút không ai vào. Lần đầu mở link có thể chậm 30–60 giây (wake up).
- **Cập nhật code:** Sửa code trên máy → `git add .` → `git commit -m "..."` → `git push`. Render tự deploy lại (nếu bật Auto-Deploy).

Nếu bạn muốn dùng **Railway** thay vì Render, có thể làm tương tự: kết nối GitHub repo, thêm env vars, deploy. Cách thêm env trên Railway cũng là mục **Variables** trong project.
