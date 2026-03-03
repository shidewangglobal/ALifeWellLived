# Review thiết kế: Hai ô hai bên (Desktop) – Joy / Prysm iO 2026

## Ý tưởng của bạn (tóm tắt)

- **Desktop:** Thêm 2 khung cùng kích thước hai bên khung chat để tạo điểm nhấn.
- **Bên trái:** Tên dự án **Prysm iO 2026** + tagline "Nền tảng quản trị sức khoẻ gia đình".
- **Bên phải:** Collage hình ảnh (từ folder "final visual") + quote truyền động lực, style minimal, có thể tùy nhu cầu người dùng.

---

## 1. Bố cục tổng thể (desktop)

```
┌─────────────────┬─────────────────┬─────────────────┐
│                 │                 │                 │
│   TRÁI          │   GIỮA          │   PHẢI          │
│   Prysm iO      │   Khung chat    │   Hình ảnh +     │
│   2026          │   Joy           │   quote          │
│   + tagline     │   (như hiện tại)│   (collage)      │
│                 │                 │                 │
└─────────────────┴─────────────────┴─────────────────┘
      Ô 1                Ô 2                Ô 3
   (cùng width)      (có thể rộng hơn)   (cùng width)
```

**Đề xuất:**

- **Hai ô hai bên cùng kích thước:** ví dụ mỗi ô rộng ~280–320px (hoặc cùng % width), tạo cảm giác đối xứng, dễ nhìn.
- **Ô giữa (chat):** giữ nguyên hoặc tăng nhẹ (ví dụ max-width 420–480px) để vẫn là trung tâm tương tác.
- **Chỉ áp dụng khi màn hình đủ rộng:** ví dụ từ 1024px trở lên; dưới đó chỉ hiện khung chat như hiện tại (đã tối ưu mobile).

---

## 2. Ô bên trái – Prysm iO 2026

**Nội dung:**

- **Tiêu đề:** Prysm iO 2026  
- **Dòng phụ:** Nền tảng quản trị sức khoẻ gia đình  

**Gợi ý style (minimal):**

- Nền: trong suốt hoặc cùng tone gradient trang (xanh nhạt → lavender) để đồng bộ với Joy.
- Chữ: tiêu đề đậm, cỡ lớn; tagline nhỏ hơn, màu muted (ví dụ `--text-muted`).
- Có thể thêm một đường gạch ngang hoặc icon nhỏ dưới tagline để tách nội dung, không cần nhiều trang trí.
- Khung: bo góc (ví dụ 24px như chat), có thể có shadow nhẹ giống khung chat để “cùng họ” với ô giữa.

**Điểm cần quyết:**

- Có nút CTA (ví dụ “Tìm hiểu thêm”) hay chỉ để thông tin? Nếu có, cần link/trang đích.

---

## 3. Ô bên phải – Hình ảnh + Quote (theo ref Apple Education)

**Tham chiếu từ ảnh bạn gửi:**

- Nhiều ảnh trong các khung **bo góc lớn** (rounded), xếp chồng/overlap nhẹ, không grid cứng.
- Nền trắng/sáng; ảnh không viền dày, chỉ cắt theo khung bo góc.
- Cảm giác: cộng đồng, học tập, tích cực – có thể chuyển sang “sức khoẻ gia đình” + “hành động”.

**Áp cho ô phải:**

- **Collage:**
  - Ảnh lấy từ folder **final visual** (cần xác định nguồn: Drive, thư mục public trên server, hay static trong repo).
  - 4–6 ảnh nhỏ, kích thước không cần đều; xếp chồng/xiên nhẹ, bo góc 16–24px.
  - Có thể có 1 ảnh “lớn” làm trọng tâm, các ảnh còn lại nhỏ hơn xung quanh.
- **Quote:**
  - Một câu ngắn về hành động / động lực, font chữ sạch (sans-serif), cỡ vừa.
  - Đặt dưới collage hoặc đè nhẹ lên vùng trống của collage (nếu đủ tương phản).
  - “Tùy nhu cầu người dùng”: có thể là 2–3 quote cố định xoay vòng, hoặc sau này Joy/backend gợi ý quote theo ngữ cảnh (bước sau).

**Style minimal:**

- Ít màu: chủ yếu ảnh + chữ đen/xám trên nền sáng hoặc trên vùng ảnh sáng.
- Không khung viền dày; có thể chỉ shadow nhẹ cho từng ảnh trong collage.

---

## 4. Kích thước & tỷ lệ

| Vùng        | Đề xuất (desktop ≥1024px)     | Ghi chú                    |
|------------|--------------------------------|-----------------------------|
| Ô trái     | 280–320px cố định (hoặc ~22%) | Cùng “cấp” với ô phải      |
| Ô giữa     | 400–480px (max)                | Khung chat Joy, trung tâm   |
| Ô phải     | 280–320px (hoặc ~22%)         | Cùng width với ô trái       |
| Khoảng cách| 16–24px giữa các ô            | Thoáng, không dính sát      |

“Hai ô hai bên cùng kích thước” = trái và phải bằng nhau; giữa có thể rộng hơn một chút để chat thoải mái.

---

## 5. Luồng hiển thị (desktop)

1. **Pre-chat (màn hình điền Tên + Email/SĐT):**  
   Có thể giữ toàn màn gradient, form ở giữa; hai ô trái/phải có thể ẩn hoặc vẫn hiện (tùy bạn muốn tập trung vào form hay vẫn quảng bá Prysm + hình ảnh ngay từ đầu).

2. **Sau khi vào chat:**  
   Layout 3 cột: Trái (Prysm) | Chat Joy | Phải (collage + quote).  
   Trên mobile/tablet nhỏ: chỉ khung chat full màn như hiện tại, không hiện hai ô.

---

## 6. Nguồn dữ liệu cần làm rõ

| Nội dung        | Câu hỏi                                      | Gợi ý triển khai (sau khi bạn chốt) |
|-----------------|-----------------------------------------------|--------------------------------------|
| Ảnh “final visual” | Folder nằm ở đâu? (Drive / server / repo?)   | Drive: dùng API lấy link ảnh; server: thư mục public; repo: `/public/images/final-visual/`. |
| Quote            | Cố định vài câu hay động theo người dùng?     | Bước 1: 3–5 quote xoay random hoặc theo thời gian; sau có thể gắn với chủ đề chat. |
| Link Prysm iO    | Có trang riêng “Tìm hiểu thêm” không?         | Nếu có: nút CTA trái dẫn đến URL; nếu chưa: chỉ text, không nút. |

---

## 7. Điểm mạnh của hướng thiết kế này

- **Nhất quán thương hiệu:** Prysm iO 2026 và Joy (A Life Well Lived) cùng một màn hình, rõ vai trò “nền tảng sức khoẻ gia đình”.
- **Cân bằng:** Hai ô hai bên cùng kích thước tạo đối xứng, dễ nhìn, chuyên nghiệp.
- **Cảm xúc & động lực:** Collage + quote minimal giống ref bạn gửi, phù hợp “truyền động lực” mà không rối.
- **Chỉ desktop:** Không ảnh hưởng trải nghiệm mobile đã tối ưu.

---

## 8. Lưu ý / rủi ro

- **Tập trung:** Hai ô quá nhiều nội dung hoặc màu mạnh có thể tranh với khung chat. Nên giữ ô trái và ô phải **tĩnh, nhẹ**, chat vẫn là nơi mắt dừng lâu nhất.
- **Performance:** Nếu ảnh lấy từ Drive hoặc nhiều ảnh lớn, nên resize/optimize và lazy-load để desktop vẫn mở nhanh.
- **Quote “tùy nhu cầu”:** Giai đoạn đầu có thể dùng vài quote cố định; “theo nhu cầu” có thể làm dần (ví dụ theo chủ đề hội thoại hoặc thời gian trong ngày).

---

## 9. Bước tiếp theo (sau khi bạn duyệt)

1. Bạn chốt: có CTA bên trái hay không, nguồn ảnh “final visual”, và quote cố định hay xoay vòng.
2. Implement layout 3 cột desktop (chỉ ≥1024px), hai ô hai bên cùng width.
3. Implement nội dung ô trái (Prysm iO 2026 + tagline).
4. Implement ô phải: collage (từ nguồn bạn chọn) + 1 quote, style minimal.
5. (Tùy chọn) Quote xoay vòng hoặc thay theo thời gian/ngữ cảnh.

Nếu bạn gửi thêm ảnh mockup hoặc chốt nguồn ảnh/quote, mình có thể đề xuất chi tiết hơn (hoặc chuyển sang bước code layout + nội dung).

---

## Xem trước layout (HTML)

Mở trong trình duyệt để **xem design** trước khi tích hợp:

- **Khi đang chạy server:** [http://localhost:3000/design-preview-desktop.html](http://localhost:3000/design-preview-desktop.html)
- File: `public/design-preview-desktop.html`

Trang preview có: ô trái (Prysm iO 2026), ô giữa (placeholder chat), ô phải (placeholder collage + quote luân phiên). Thu nhỏ cửa sổ &lt; 1024px sẽ thấy layout xếp dọc.
