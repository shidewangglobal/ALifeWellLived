# Fortune Method Spec V1

Nguon bien soan: tai lieu do user cung cap (truong phai doan toan theo Luc Nham Tieu Don + Luc Thap Hoa Giap).

Muc tieu:
- Chuan hoa quy tac nghiep vu de trien khai `fortune engine`.
- Tach ro "rule dinh luat" va "rule kinh nghiem".
- Ho tro su dung trong dashboard, chat, thong bao.

## 1) Pham vi phien ban V1

V1 tap trung:
- Cach lay cung theo thang/ngay/gio (uu tien ngay + gio).
- 6 cung co ban va y nghia.
- Y nghia cung phoi hop (ngay + gio).
- 30 cap nap am cua Luc Thap Hoa Giap (dung cho ngay/gio).
- Nguyen tac bo tro: tam hop, can hop/khac, khac ky theo tuoi, gio can chi.

V1 chua bao gom:
- He thong "do so tuoi" nang cao.
- Bien the truong phai khac.
- Suy luan boi canh qua sau theo gioi tinh/nghe nghiep (de V2).

## 2) Tu dien thuat ngu

- Cung thang: cung tinh theo thang am lich, chi dong vai tro phu tro.
- Cung ngay: cung chu (ban than, "minh").
- Cung gio: cung khach (su viec, "viec").
- Phoi cung: ket hop cap (cung ngay + cung gio).
- Hoa giap ngay/gio: can chi ngay/gio doi sang nap am (1 trong 30 cap).
- Rule dinh luat: quy tac co cong thuc ro rang.
- Rule kinh nghiem: ket luan duoc ghi chu tu tai lieu, do tin cay thap hon rule dinh luat.

## 3) Quy trinh tinh toan chuan

### B3.1 - Lay cung thang
- Khoi thang Gieng tai cung Dai An.
- Dem theo chieu kim dong ho, moi cung 1 thang.
- Xac dinh cung cua thang can tinh.

Thu tu 6 cung (vong lap):
1. Dai An
2. Luu Lien
3. Toc Hi
4. Xich Khau
5. Tieu Cat
6. Khong Vong

### B3.2 - Lay cung ngay
- Tu cung thang vua tim duoc, khoi ngay Mong Mot.
- Dem thuan moi cung 1 ngay toi ngay am lich hien tai.

### B3.3 - Lay cung gio
- Tu cung ngay vua tim duoc, khoi gio Ty.
- Dem moi gio 1 cung theo thu tu 6 cung toi gio can tinh.

### B3.4 - Trong so
- Ngay la chu.
- Gio la khach.
- Thang la phu tro.

## 4) 6 cung can ban

1. Dai An
- Tinh chat: hien lanh, cau an, giam do manh (ca tot va xau).
- Tuong hinh: can nha, bat dong san, hop go.

2. Luu Lien
- Tinh chat: tri tre, keo dai, tang do manh cua su kien.
- Tuong hinh: co quan luat phap, nha thuong, nha tu, giay to.

3. Toc Hi
- Tinh chat: thong tin, tin tuc, lien lac.
- Tuong hinh: dam cuoi, tinh cam, thu tin.

4. Xich Khau
- Tinh chat: mieng noi, ban cai, an uong.
- Tuong hinh: dam tiec, dai hoi, xe co, quan xa.

5. Tieu Cat
- Tinh chat: loi loc, giao dich, buon ban.
- Tuong hinh: cho bua, noi giao dich.

6. Khong Vong
- Tinh chat: rui ro, tai nan, mat mat, trom cap.
- Tuong hinh: dam ma, nghia dia, vung lay.

## 5) Bang y nghia phoi cung (ngay + gio)

Luu duoi dang key `DAY_CUNG + HOUR_CUNG`.

### 5.1 Cac cap duoc neu ro trong tai lieu
- DaiAn + DaiAn: Binh an, khong viec lon.
- DaiAn + LuuLien: Dung dang, kho quyet dinh.
- DaiAn + TocHi: Neu TocHi la gio thi loi viec nhanh.
- DaiAn + XichKhau: Doi cho, di dung, van chuyen.
- DaiAn + TieuCat: That nghiep cho viec, sua nha.
- DaiAn + KhongVong: Buon phien, be tac.

- LuuLien + LuuLien: Tri tre, cho doi, ro rac phap ly.
- LuuLien + TocHi: Buc tuc, thu tin xa.
- LuuLien + XichKhau: Xung dot dan toi phap ly, hoa khau.
- LuuLien + KhongVong: Chui luon, tron chay, phi phap.
- LuuLien + DaiAn: Dung dang, kho quyet.

- TocHi + TocHi: Viec bat ngo, tin thu xa.
- TocHi + XichKhau: Cai va, khau thiet.
- TocHi + TieuCat: Qua cap, loi loc bat ngo.
- TocHi + KhongVong: Du lich, vui choi.
- TocHi + DaiAn: Neu DaiAn la gio thi loi viec lau dai.
- TocHi + LuuLien: Buc tuc, thu tin xa.

- XichKhau + XichKhau: Ban luan, tranh cai, an uong.
- XichKhau + TieuCat: Ban lam an, dich vu, moi gioi.
- XichKhau + KhongVong: Truoc xau sau tot.
- XichKhau + DaiAn: Doi cho, di dung, van chuyen.
- XichKhau + LuuLien: Xung dot dan toi phap ly.
- XichKhau + TocHi: Cai va, khau thiet.

- TieuCat + TieuCat: Lam an lon, loi loc lon.
- TieuCat + KhongVong: Ton tai, lo la, om dau.
- TieuCat + DaiAn: That nghiep, cho viec, sua nha.
- TieuCat + LuuLien: Tai loc lon, buon ban lon.

- KhongVong + KhongVong: Rui ro rat cao, xui ro lon.

### 5.2 Rule doi chieu
- Neu cap `A + B` khong duoc ghi ro, cho phep map sang `B + A` neu trong tai lieu co "coi phan tren".
- Danh dau do tin cay: `derived_from_reference`.

## 6) Luc Thap Hoa Giap (30 nap am cap can chi)

Trong V1, can bo day du 30 cap nap am phai duoc luu bang du lieu rieng (`hoa_giap_30`), gom:
- cap can chi (vi du: Giap Ty, At Suu)
- nap am (vi du: Hai Trung Kim)
- mo ta tinh chat
- ghi chu ung dung (neu co)
- muc do tin cay (`core` hoac `experience`)

Ghi chu:
- Cac mo ta nay duoc dung theo he quy chieu doan toan cua tai lieu, khong dong nhat voi menh tuoi.

## 7) Nguyen tac bo tro

### 7.1 Tam hop ngu hanh
- Hoi - Mao - Mui => Moc
- Ty - Dau - Suu => Kim
- Than - Ty - Thin => Thuy
- Dan - Ngo - Tuat => Hoa

### 7.2 Thap can tuong hop
- Giap hop Ky
- At hop Canh
- Binh hop Tan
- Dinh hop Nham
- Mau hop Quy

### 7.3 Thap can tuong khac
- Giap pha Mau
- Ky pha Quy
- At pha Ky
- Canh pha Giap
- Binh pha Canh
- Tan pha At
- Dinh pha Tan
- Nham pha Binh
- Mau pha Nham
- Quy pha Dinh

### 7.4 Khac ky 12 tuoi
- Ty ky nam Ngo, Ty
- Suu ky nam Suu, Ngo, Mui
- Dan ky nam Than, Dan
- Mao ky nam Mao, Dau, Thin
- Thin ky nam Thin, Tuat
- Ty ky nam Ty, Hoi
- Ngo ky nam Suu, Ngo, Ty
- Mui ky nam Dau, Hoi
- Than ky nam Dan, Than
- Dau ky nam Mao, Dau, Tuat
- Tuat ky nam Thin, Tuat
- Hoi ky nam Ty, Hoi

### 7.5 Nhom tuoi de gap xui xeo (tham khao)
- Nam: 25, 31, 33, 37, 38, 53
- Nu: 28, 37, 39, 46, 49

### 7.6 Quy tac tim gio can chi tu can ngay
- Ngay can Giap/Ky => gio Ty la Giap Ty
- Ngay can At/Canh => gio Ty la Binh Ty
- Ngay can Binh/Tan => gio Ty la Mau Ty
- Ngay can Dinh/Nham => gio Ty la Canh Ty
- Ngay can Mau/Quy => gio Ty la Nham Ty

## 8) Pipeline luan giai de xuat (engine)

1. Tinh lich am + can chi ngay gio.
2. Lay cung thang, cung ngay, cung gio.
3. Tao cap phoi cung (ngay + gio) => y nghia phoi cung.
4. Tra nap am hoa giap cho ngay va gio.
5. Ghep bo tro theo tuoi (ky nam/thang, can hop/khac, tam hop) neu co input tuoi.
6. Sinh ket qua theo nhom:
   - Tai loc
   - Gia dao
   - Giay to/phap ly
   - Di chuyen
   - Rui ro/tai nan
7. Tinh diem tong hop:
   - positive_score
   - risk_score
   - confidence_score
8. Sinh `explain_trace` de hien trong UI/chat.

## 9) Quy tac confidence

- `core`: rule cong thuc ro rang trong tai lieu.
- `experience`: ghi chu kinh nghiem, can giam trong so.
- `derived`: rule doi chieu "coi phan tren".

Goi y diem:
- core = 1.0
- experience = 0.7
- derived = 0.6

## 10) Inputs/Outputs chuan API V1

Input toi thieu:
- solar_datetime
- timezone
- lunar_date (co the de engine tinh)
- question_subject_type: `owner` | `other`
- owner_birth_year_can_chi (optional)
- related_person_birth_year_can_chi (optional)
- question_domain: `general` | `business` | `real_estate` | `marriage` | `family` | `legal` | `travel`
- subject_roles:
  - primary_subject (nguoi chinh)
  - secondary_subjects[] (nguoi phu lien quan, co the rong)

Output:
- month_cung, day_cung, hour_cung
- pair_meaning
- day_hoa_giap, hour_hoa_giap
- positives[]
- risks[]
- recommendations[]
- scores { positive, risk, confidence }
- explain_trace[]
- ai_context_payload:
  - domain_focus
  - primary_subject_summary
  - secondary_subject_summaries[]
  - forbidden_claims[]

## 10.1 LLM interpretation layer (Gemini)

Muc tieu:
- Bien doi ket qua engine thanh huong dan de hieu theo tung nhu cau user.
- Khong cho phep LLM thay doi ket luan cot loi cua rule engine.

Nguyen tac:
1. Engine la nguon su that duy nhat cho diem so va ket luan.
2. Gemini chi duoc:
   - dien giai
   - sap thu uu tien hanh dong
   - viet goi y theo boi canh (business, mua dat, cuoi xin, ...)
3. Gemini khong duoc:
   - tu them rule moi
   - dao nguoc danh gia tot/xau khi engine khong ho tro
   - khang dinh "chac chan xay ra"

Prompt data bat buoc:
- day_cung, hour_cung, pair_meaning
- day_hoa_giap, hour_hoa_giap
- question_domain
- primary_subject + secondary_subjects
- top_risks + top_opportunities

Output cho UI/chat:
- `short_advice` (ngan gon)
- `domain_actions[]` (hanh dong theo linh vuc)
- `watch_out[]` (dieu can tranh)
- `reasoning_trace_refs[]` (tham chieu toi explain_trace)

## 11) Ngoai le can quy dinh ro trong code

- Moc giao ngay theo gio Ty: phai chon quy uoc duy nhat (23:00 hay 00:00).
- Gio am lich map theo khung 2 tieng, can dong bo timezone.
- Nam nhuan/thang nhuan am lich.
- Truong hop thieu du lieu tuoi: van tra ket qua theo ngay-gio, giam confidence.

## 12) Test cases toi thieu cho V1

- Test mapping 6 cung cho 12 thang.
- Test de quy cung ngay tu ngay 1 den ngay 30.
- Test de quy cung gio cho du 12 dia chi gio.
- Test 4 bai tap mau trong tai lieu (lam integration test).
- Test doi chieu cap phoi cung `A+B` va `B+A`.
- Test confidence khi rule chi la `derived`.

## 13) Nguyen tac quan tri phien ban rule

- Moi rule co `rule_id`.
- Moi thay doi rule tang `method_version`.
- Ket qua xem phai luu kem `method_version` de truy vet.

