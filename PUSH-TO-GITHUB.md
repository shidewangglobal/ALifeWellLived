# Đẩy code Joy lên GitHub – từng bước

Bạn đã tạo repo trên GitHub. Giờ đẩy code từ máy lên repo đó.

---

## Bước 1 – Lấy địa chỉ repo (URL)

1. Mở trình duyệt, vào **https://github.com** và đăng nhập.
2. Vào **repo bạn vừa tạo** (bấm vào tên repo).
3. Trên trang repo, bấm nút màu xanh **Code**.
4. Chọn **HTTPS**, copy **địa chỉ** (dạng `https://github.com/TÊN_BẠN/TÊN_REPO.git`).  
   Ví dụ: `https://github.com/shidewang/joy-alifewelllived.git`  
   → **Dán vào Notepad hoặc Notes để dùng ở Bước 6.**

---

## Bước 2 – Mở Terminal

- Trên Mac: **Cmd + Space** → gõ **Terminal** → Enter.

---

## Bước 3 – Vào đúng thư mục project

Gõ hoặc dán lệnh sau rồi **Enter**:

```bash
cd "/Users/DatVuong/Library/Mobile Documents/com~apple~CloudDocs/Documents/WORK/AI DIGITAL CURSOR/joy/scripts"
```

(Không có thông báo gì là đúng.)

---

## Bước 4 – Khởi tạo Git và thêm file

Gõ **từng lệnh** (sau mỗi lệnh nhấn **Enter**):

**4.1**
```bash
git init
```
(Báo "Initialized empty Git repository" hoặc "Reinitialized...")

**4.2**
```bash
git add .
```

**4.3**
```bash
git status
```
(Bạn sẽ thấy danh sách file sẽ được đẩy. **Không** được có ` .env` hoặc `credentials/drive-service-account.json` – hai thứ này đã bị bỏ qua để bảo mật.)

---

## Bước 5 – Commit (ghi nhận lần đẩy)

```bash
git commit -m "Joy - A Life Well Lived - Sống Chất"
```

(Nếu lần đầu có thể hỏi tên/email – xem Bước 7.)

---

## Bước 6 – Kết nối repo trên GitHub

**Thay `ĐỊA_CHỈ_REPO_CỦA_BẠN`** bằng địa chỉ bạn đã copy ở Bước 1 (ví dụ `https://github.com/shidewang/joy-alifewelllived.git`).

```bash
git remote add origin ĐỊA_CHỈ_REPO_CỦA_BẠN
```

Ví dụ:
```bash
git remote add origin https://github.com/shidewang/joy-alifewelllived.git
```

(Nếu báo "remote origin already exists" thì bỏ qua hoặc chạy: `git remote set-url origin ĐỊA_CHỈ_REPO_CỦA_BẠN`.)

---

## Bước 7 – Đặt tên nhánh và đẩy lên GitHub

**7.1**
```bash
git branch -M main
```

**7.2**
```bash
git push -u origin main
```

- Nếu **hỏi đăng nhập:** GitHub **không dùng mật khẩu** nữa khi push qua HTTPS. Bạn cần dùng **Personal Access Token**:
  - **Username:** tên tài khoản GitHub của bạn.
  - **Password:** dán **Token** (không phải mật khẩu đăng nhập).

**7.3 – Tạo Token (nếu chưa có):**

1. GitHub → ảnh avatar (góc phải) → **Settings**.
2. Menu trái cuối → **Developer settings**.
3. **Personal access tokens** → **Tokens (classic)** → **Generate new token (classic)**.
4. **Note:** gõ `joy-deploy` (hoặc tên bất kỳ).
5. **Expiration:** chọn 30 days hoặc 90 days.
6. Tick **repo** (full control of private repositories).
7. Bấm **Generate token** → **Copy** token (chỉ hiện một lần).
8. Khi Terminal hỏi **Password**, dán token đó rồi Enter.

Sau khi push thành công, bạn sẽ thấy dòng kiểu: `Branch 'main' set up to track remote branch 'main' from 'origin'.`

---

## Bước 8 – Kiểm tra trên GitHub

1. Vào lại **trang repo** trên GitHub (F5).
2. Bạn sẽ thấy các file: `server.js`, `package.json`, `public/`, `DEPLOY.md`, ... (không có `.env`, không có file trong `credentials/`).

Xong bước đẩy code. Tiếp theo bạn có thể deploy lên **Render** theo file **DEPLOY.md** (Bước 3 – Deploy trên Render).
