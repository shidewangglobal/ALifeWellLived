# Fortune Product Plan V1

Tai lieu nay chot pham vi san pham theo nhu cau:
- User dang ky/dang nhap
- Mua luot xem
- Dashboard lich ngay
- Xem cho gia chu / nguoi khac
- Chat hoi sau
- Nhan thong bao Telegram/Zalo

## 1) User flow tong the

1. Dang ky tai khoan.
2. Tao ho so gia chu (co the tao ho so nguoi lien quan).
3. Nap luot (credit package).
4. Chon ngay gio can xem tren dashboard.
5. Chon kieu xem:
   - Cho gia chu
   - Cho nguoi khac
   - Cho gia chu + nguoi lien quan
6. He thong tinh ket qua va tru luot.
7. User co the mo chat de hoi them dua tren ket qua vua xem.
8. User dang ky kenh thong bao de nhan khung gio tot.

## 2) Module chuc nang

### M2.1 Auth + User Profile
- Dang ky, dang nhap, quen mat khau.
- Ho tro email/password.
- Moi user moi duoc cap trial premium 5 lan (`premium_trial_quota = 5`).
- Moi lan dung tinh nang premium se tru 1 trial neu user chua mua goi.
- Ho so:
  - ten hien thi
  - ngay sinh (duong/hoac am + gio sinh neu co)
  - nam sinh can chi (neu user nhap truc tiep)
  - gioi tinh (optional)

### M2.2 Ho so doi tuong xem
- Bang `subjects`:
  - owner (gia chu)
  - related_person (nguoi lien quan)
  - external_target (nguoi duoc xem ho)

### M2.3 Credit Wallet
- Goi credit: 10, 30, 100 luot.
- Moi lan xem tru 1 hoac n luot theo loai goi.
- Luu ledger:
  - topup
  - consume
  - refund
  - trial_consume

Quy tac thanh toan uu tien:
1. Neu con trial premium => tru trial truoc.
2. Het trial => tru credit da mua.
3. Khong con credit => yeu cau mua goi.

### M2.4 Fortune Engine
- Nhap ngay gio + doi tuong.
- Tra:
  - ngay duong/am
  - can chi ngay/thang/nam
  - cung ngay/gio + y nghia phoi cung
  - nhan dinh tot/xau theo nhom (tai loc, gia dao, phap ly, di chuyen)
  - gio de xuat trong ngay

### M2.5 Dashboard Lich
- Widget "Hom nay":
  - dd/mm/yyyy duong lich
  - ngay am lich
  - can chi ngay thang nam
- Lich thang:
  - danh dau ngay tot, trung binh, can than trong
- Nut hanh dong:
  - "Xem cho gia chu"
  - "Xem cho nguoi khac"
  - "Mo chat hoi them"

### M2.6 Chat theo ngu canh
- Chat session gan voi `consult_request_id`.
- Chatbot doc `explain_trace` cua ket qua vua tinh.
- Su dung Gemini API de linh hoat hoa luan giai theo `question_domain`:
  - lam an/kinh doanh
  - mua dat/bat dong san
  - cuoi xin/tinh cam
  - giay to/phap ly
  - di chuyen/xuat hanh
- Chatbot phai nhan biet vai tro:
  - nguoi chinh (owner/chu su viec)
  - nguoi phu (related_person)
  - nguoi duoc xem ho (external_target)
- Prompt policy: AI chi dien giai tren nen ket qua engine, khong tu suy doan trai rule.
- Luat tru credit:
  - tuy chon: tru theo moi cau hoi hoac theo session.

### M2.7 Notification Channel
- Telegram:
  - link bot + luu chat_id
- Zalo:
  - ket noi OA va luu user channel token/id
- Lich gui:
  - 06:00 moi ngay gui "gio tot hom nay"
  - tuy chon khung gio user muon nhan

## 3) De xuat schema toi thieu

- users
- user_profiles
- subjects
- credit_wallets
- credit_transactions
- premium_trials
- consult_requests
- consult_results
- chat_sessions
- chat_messages
- notification_channels
- notification_subscriptions
- notification_logs

## 4) API draft

- `POST /auth/register`
- `POST /auth/login`
- `GET /dashboard/today`
- `POST /consults` (tao phien xem + tru credit)
- `GET /consults/:id`
- `POST /chat/:consultId/messages`
- `POST /credits/topup`
- `GET /credits/balance`
- `GET /billing/entitlements` (trial con lai + credit con lai)
- `POST /notifications/channels/telegram/connect`
- `POST /notifications/channels/zalo/connect`
- `POST /notifications/subscriptions`

## 5) Quy tac tru credit de tranh tranh chap

- Tru credit khi tao `consult_request` thanh cong.
- Neu engine loi ky thuat => rollback + hoan credit.
- Moi giao dich credit deu co `reference_type` + `reference_id`.
- Trial premium duoc quan ly rieng, khong nap lai duoc, chi cap 1 lan khi tao tai khoan.
- Moi lan consume trial phai co idempotency_key de tranh tru lap khi retry request.

## 6) MVP milestone (8 tuan)

1. Tuan 1-2: Chuan hoa method spec + test case.
2. Tuan 3: Fortune engine V1.
3. Tuan 4: Auth + profile + subjects.
4. Tuan 5: Credit wallet + topup mock.
5. Tuan 6: Dashboard + consult flow.
6. Tuan 7: Chat context.
7. Tuan 8: Telegram notify + hardening.

## 7) Noi dung hien thi trong dashboard (theo yeu cau)

Phan "Hom nay":
- Ngay duong lich: dd/mm/yyyy
- Ngay am lich: dd/mm (am)
- Can chi ngay, thang, nam
- Tong quan: ngay nghieng tot / can than trong / xau

Phan thao tac:
- Chon doi tuong:
  - Gia chu
  - Nguoi khac
- Neu "Gia chu":
  - Ca nhan
  - Co nguoi lien quan

Phan ket qua:
- Gio nen lam
- Gio nen tranh
- Linh vuc anh huong manh (tai loc, gia dao, phap ly, di chuyen)
- Nut "Hoi them trong chat"

