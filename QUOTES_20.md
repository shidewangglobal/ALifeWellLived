# Bộ 20 câu quote – luân phiên bên ô phải (desktop)

Dùng cho ô "Hình ảnh + Quote" bên phải, style minimal, truyền động lực / hành động.

---

## Danh sách 20 câu (gợi ý – bạn có thể chỉnh lại cho hay hơn)

1. Hành động nhỏ mỗi ngày — sức khoẻ bền lâu.
2. Sống chất là chọn điều có ý nghĩa, mỗi ngày.
3. Bước đầu tiên luôn là bước quan trọng nhất.
4. Gia đình khoẻ là nền tảng của mọi thành công.
5. Chăm sóc bản thân không phải ích kỷ — đó là trách nhiệm.
6. Mỗi ngày một thay đổi nhỏ, một năm sau là cả hành trình.
7. Sức khoẻ không phải tất cả, nhưng không có nó ta chẳng có gì.
8. Bắt đầu từ hôm nay — không cần hoàn hảo, chỉ cần bắt đầu.
9. Động lực đưa bạn đi, thói quen giữ bạn lại.
10. Yêu thương gia đình bắt đầu từ việc chăm sóc chính mình.
11. Sức khoẻ tinh thần và thể chất đi cùng nhau — hãy nuôi cả hai.
12. Không có "đủ thời gian", chỉ có "ưu tiên đúng".
13. Một cơ thể khoẻ là khách sạn; một cơ thể yếu là nhà tù.
14. Đầu tư vào sức khoẻ hôm nay, tận hưởng ngày mai.
15. Thay đổi nhỏ, kiên trì mỗi ngày — đó là bí quyết.
16. Gia đình là nơi ta bắt đầu và là nơi ta luôn quay về.
17. Hãy là phiên bản khoẻ mạnh nhất của chính bạn.
18. Không chờ "đúng lúc" — đúng lúc là khi bạn bắt đầu.
19. Sống có chủ đích từng ngày, không chỉ tồn tại.
20. Sức khoẻ gia đình bắt đầu từ từng thành viên — bắt đầu từ bạn.

---

## Cách luân phiên (khi develop)

- **Nguồn:** Lưu 20 câu trong code (mảng) hoặc file JSON; sau có thể đưa vào Drive/DB nếu cần.
- **Luân phiên theo "yêu cầu" (bộ 20 câu):**
  - **Theo thời gian:** Mỗi lần load trang (hoặc mỗi 5–10 phút) chọn 1 câu random từ 20, hoặc chọn theo giờ trong ngày (ví dụ 8 câu sáng, 8 câu chiều, 4 câu tối).
  - **Theo phiên:** Mỗi session_id (người dùng vào chat) gán 1 câu cố định cho phiên đó (hash(session_id) % 20) — cùng người sẽ thấy cùng quote trong phiên, lần sau có thể khác.
  - **Random mỗi lần:** Mỗi lần mở trang / refresh chọn ngẫu nhiên 1 trong 20.
  - **Xoay vòng:** Hiển thị lần lượt 1, 2, 3... 20 rồi lặp (lưu index trong sessionStorage hoặc cookie).
- **Ưu tiên:** Tránh lặp lại quote vừa hiển thị; có thể shuffle 20 câu rồi xoay, hoặc bỏ qua câu vừa dùng trong N lần gần nhất.

Khi tích hợp vào trang thật, chỉ cần một hàm kiểu `getQuoteForDisplay()` trả về 1 câu từ 20 theo logic bạn chọn (random / theo phiên / theo giờ).
