# Joy đọc toàn bộ thư mục Google Drive (AI DIGITAL ADMIN)

Joy tự đọc **tất cả file** trong thư mục gốc (và thư mục con) qua **Google Drive API** (Service Account). Hỗ trợ:

- **Google Docs** (.gdoc)
- **Google Sheets** (bảng tính, export CSV)
- **PDF**
- **Excel** (.xlsx)

---

## Bước 1 – Bật Drive API và tạo Service Account (làm trên Google Cloud)

### 1.1 Mở Google Cloud Console

1. Mở trình duyệt (Chrome, Safari…).
2. Vào địa chỉ: **https://console.cloud.google.com**
3. Đăng nhập bằng tài khoản Google (ví dụ `shidewang@gmail.com`).
4. Ở **góc trên bên trái**, bấm vào ô chọn **Project** (tên dự án).
5. Chọn project bạn đang dùng cho Joy (nếu đã tạo từ trước, ví dụ "a-life-well-lived-joy" hoặc "J Joy"). Nếu chưa có project thì bấm **New Project**, đặt tên rồi chọn project đó.

### 1.2 Bật Google Drive API

1. Ở **thanh tìm kiếm** trên cùng (Search products and resources), gõ: **Drive API**.
2. Bấm vào kết quả **Google Drive API**.
3. Nếu thấy nút **Enable** / **Bật** thì bấm **Enable** và chờ vài giây. Nếu đã bật thì sẽ thấy **Manage** (không cần làm gì thêm).

### 1.3 Tạo Service Account (tài khoản dịch vụ)

1. Ở **menu bên trái**, bấm **APIs & Services** → **Credentials** (Hoặc tìm kiếm "Credentials" trên thanh search).
2. Trên trang Credentials, bấm nút **+ Create Credentials** (ở trên cùng).
3. Chọn **Service account**.
4. **Service account name**: gõ tên, ví dụ `joy-drive-reader` (hoặc tên bất kỳ bạn dễ nhớ).
5. Bấm **Create and Continue** → **Done** (có thể bỏ qua bước "Grant access" và "Grant users access").
6. Bạn sẽ quay lại trang Credentials. Ở phần **Service Accounts**, tìm dòng vừa tạo (tên `joy-drive-reader` hoặc tương tự), bấm vào **email** của nó (dạng `joy-drive-reader@tên-project.iam.gserviceaccount.com`) để mở chi tiết.

### 1.4 Tải file key (file JSON)

1. Trong trang chi tiết Service account, chọn tab **Keys**.
2. Bấm **Add Key** → **Create new key**.
3. Chọn **JSON** → bấm **Create**.
4. File JSON sẽ tự tải về máy (thường nằm trong thư mục **Downloads**). **Giữ file này an toàn**, không gửi cho người khác và không đưa lên mạng.

---

## Bước 2 – Đặt file key vào project Joy

1. Mở **Finder**, đi tới thư mục:  
   `joy/scripts` (trong project Joy của bạn).
2. Trong đó đã có sẵn thư mục tên **credentials**. Mở thư mục **credentials**.
3. Tìm file JSON vừa tải ở Bước 1.4 (trong **Downloads**), **copy** (hoặc kéo thả) file đó vào thư mục **credentials**.
4. Đổi tên file thành: **drive-service-account.json** (để dễ nhớ và đúng với hướng dẫn).

---

## Bước 3 – Chia sẻ thư mục Drive cho Service Account

1. Mở file **drive-service-account.json** (bằng TextEdit hoặc Cursor). Tìm dòng có chữ **"client_email"**. Giá trị bên cạnh là một email dạng:  
   `joy-drive-reader@tên-project.iam.gserviceaccount.com`  
   → **Copy** nguyên email đó.
2. Mở **Google Drive** (drive.google.com), đăng nhập bằng tài khoản chứa thư mục **AI DIGITAL ADMIN _Final**.
3. Tìm và mở thư mục **AI DIGITAL ADMIN _Final** (thư mục gốc bạn muốn Joy đọc toàn bộ).
4. **Chuột phải** vào thư mục đó → chọn **Share** / **Chia sẻ**.
5. Ở ô thêm người, **dán** email service account (bước 1). Quyền chọn **Viewer** (Người xem).
6. Bấm **Send** / **Gửi** (có thể bỏ qua thông báo “Notify people” nếu không cần).

---

## Bước 4 – Lấy Folder ID

1. Trong Google Drive, **mở** thư mục **AI DIGITAL ADMIN _Final** (bấm đúp vào thư mục).
2. Nhìn lên **thanh địa chỉ** của trình duyệt. URL sẽ dạng:  
   `https://drive.google.com/drive/folders/1AbCdEfGhIjKlMnOpQrStUvWxYz`
3. Đoạn chữ sau **`/folders/`** (ví dụ `1AbCdEfGhIjKlMnOpQrStUvWxYz`) chính là **Folder ID**. **Copy** đoạn đó.

---

## Bước 5 – Cấu hình file .env

1. Mở project Joy trong **Cursor**, mở file **.env** trong thư mục `joy/scripts` (nếu không thấy, có thể file bị ẩn; trong Cursor vẫn mở được qua cây thư mục).
2. Thêm **hai dòng** sau (hoặc sửa nếu đã có):

```env
JOY_DRIVE_FOLDER_ID=XXXXXXXXXX
GOOGLE_APPLICATION_CREDENTIALS=./credentials/drive-service-account.json
```

3. Thay **XXXXXXXXXX** bằng **Folder ID** bạn đã copy ở Bước 4.
4. Lưu file **.env** (Cmd + S).

## Bước 6 – Cài thư viện (npm) và chạy lại Joy

**“Thư viện” ở đây** là các gói code (packages) Node.js mà Joy cần để gọi **Google Drive API** (ví dụ gói `googleapis`). Bạn chỉ cần chạy **một lệnh** để cài tất cả.

### 6.1 Mở Terminal trên máy Mac

1. Bấm **Cmd + Space** (hoặc mở Spotlight), gõ **Terminal**, rồi mở **Terminal**.

### 6.2 Đi tới đúng thư mục project Joy

Gõ hoặc dán lệnh sau (rồi nhấn **Enter**):

```bash
cd "/Users/DatVuong/Library/Mobile Documents/com~apple~CloudDocs/Documents/WORK/AI DIGITAL CURSOR/joy/scripts"
```

### 6.3 Cài thư viện

Gõ lệnh (rồi nhấn **Enter**):

```bash
npm install
```

- Lệnh này sẽ tải và cài các gói trong `package.json` (gồm cả `googleapis` dùng cho Drive).
- Chờ đến khi không còn chạy gì (vài chục giây đến vài phút). Xong sẽ thấy dòng kiểu `added X packages`.

### 6.4 Chạy lại server Joy

Gõ (rồi nhấn **Enter**):

```bash
npm start
```

- Nếu thấy dòng **Joy server is running on http://localhost:3000** là đã chạy thành công.

### 6.5 Kiểm tra

1. Mở trình duyệt, vào: **http://localhost:3000/api/knowledge**
2. Nếu cấu hình đúng, bạn sẽ thấy `meta.source: "folder"` và số doc đã load.
3. Vào **http://localhost:3000** và chat thử với Joy; câu trả lời sẽ dựa trên nội dung trong Drive.

---

**Lưu ý:** Nếu không dùng thư mục (bỏ `JOY_DRIVE_FOLDER_ID`), Joy sẽ quay lại chế độ cũ: chỉ đọc các Doc ID liệt kê trong `JOY_KNOWLEDGE_DOC_IDS`.
