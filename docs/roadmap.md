# Roadmap — PhimVietHay

Dự định phát triển của PhimVietHay, tổng hợp từ các ý user đã chốt hoặc gác
lại (tính tới 24/11/2026, local HEAD `bb83671`). Chỉ liệt kê những mục này —
không thêm tính năng mới ngoài danh sách dưới đây.

> Lưu ý: các mục dưới đây là kế hoạch, chưa phải cam kết thời gian. Thứ tự
> ưu tiên có thể đổi khi user quay lại quyết định.

## Tạm gác — chờ user quay lại

### Đăng nhập / đăng ký redesign kiểu Netflix

- **Trạng thái:** tạm gác. Đã làm 3 mẫu thử theo phong cách Netflix, user
  chốt Mẫu 2 (Poster Wall) rồi yêu cầu sửa thành v3 (form glass blur bên
  trái, 1 form morph login ↔ đăng ký, không tab, không panel phim phải);
  user vẫn chưa ưng v3 nên tạm gác, ưu tiên fix lỗi player trước.
- **Yêu cầu khi làm thật:**
  - Form đăng ký kiểm tra độ mạnh mật khẩu, bắt buộc có số, chữ hoa, chữ
    thường, ký tự đặc biệt.
  - Form đăng ký thật bắt buộc có ô họ tên (fullname).
  - Login chỉ báo lỗi bằng toast (không hiện lỗi trong form).
  - Nút Google hiện đang comment out — cần migration 002 + OAuth mới bật
    được (xem `database.md`, `setup.md`).
- Bản thử (preview) lưu ở `~/workspace/phimviethay-research/login-design-netflix/`
  (không nằm trong repo này).

## Ưu tiên tiếp theo

### 1. Theme preview — xem trước theme trước khi áp dụng

- **Trạng thái:** ưu tiên tiếp theo, chưa làm.
- Khi đổi theme, hiển thị bản xem trước gồm card phim + header để hình dung
  ảnh hưởng trước khi áp dụng.
- Đổi màu web cũng đổi luôn màu thanh tiến trình JWPlayer.
- Tính năng custom giao diện hiện tại (6 preset tối + accent tự chọn, lưu
  theo tài khoản) xem `frontend.md`, `database.md`.

### 2. Diễn đàn tối giản, ưu tiên đánh giá (reviews-first)

- **Trạng thái:** ưu tiên tiếp theo, chưa làm.
- Làm diễn đàn tối giản, ưu tiên đánh giá phim trước, kèm badge "đã xem"
  cho người đã xem phim đó.
- Chỉ làm forum đầy đủ sau khi bản tối giản này chạy ổn.

### 3. Hoàn thiện admin — player settings

- **Trạng thái:** ưu tiên tiếp theo, chưa làm xong.
- Hiện tại trang `/admin/player` và API `GET/PUT /api/admin/settings` đã
  có, nhưng trong các setting player chỉ có `player_license` là có tác
  dụng lên player thật; các setting còn lại chưa tác dụng.
- Mục tiêu: mọi setting trong `/admin/player` đều tác dụng lên player thật
  (xem `admin.md`, `player.md`, `backend.md`).

## Gác lại — không bỏ

### Pet xem cùng

- **Trạng thái:** gác lại, không bỏ. User đề xuất 23/11/2026: pet theo cả
  khi xem toàn màn hình, có animation, bắt buộc có nút tắt.
- Bàn lại sau khi xong các mục ưu tiên trên.

### Tab "Gợi ý phim cho bạn"

- **Trạng thái:** gác lại, không bỏ. Gợi ý phim dựa trên dữ liệu xem của
  từng tài khoản.
- Bàn lại sau, cùng với pet xem cùng.

## Ý tưởng dài hạn

### Player riêng

- **Trạng thái:** ý tưởng dài hạn, chưa làm.
- Dùng JWPlayer riêng của mình để tự custom sâu hơn, ví dụ:
  - Màn ending sau khi hết tập.
  - Tự chuyển sang tập sau.
  - Custom màu player + thanh tiến trình theo theme tài khoản.
- Ranh giới hiện tại (đã chốt): player đang COPY code vsmov, chỉ đổi logo
  + dùng JWPlayer 8.9.3 của mình — xem `player.md`, `decisions.md`.

## Chưa chốt

### Tự host jQuery / Bootstrap / FontAwesome / Google Fonts

- **Trạng thái:** chưa chốt, chưa quyết.
- Hiện player phụ thuộc 4 CDN ngoài: jQuery (Google), Bootstrap (cdnjs),
  FontAwesome (cdnjs), Google Fonts. Một CDN hỏng là cả player hỏng.
- Phương án đang cân nhắc: tự host các thư viện này trong repo thay vì
  dùng CDN. Cần user quyết trước khi làm (xem `player.md`).

## Việc nhỏ còn tồn

| Việc | Trạng thái |
| :--- | :--- |
| Hàng "Tiếp tục xem" trên trang chủ | Chưa làm |
| Sửa sub hiện literal `<i>...</i>` (VTT bị escape, quirk sẵn của bản copy vsmov) | Chưa sửa |
| Mobile mở panel Phụ đề che gần hết sub — cần thu nhỏ panel nếu muốn xem trước sub trên mobile | Chưa sửa |
| Chạy lại migration 003 trên TiDB prod (bảng `users` còn thiếu cột `theme`) | Chưa chạy — user tự chạy trên TiDB Cloud SQL Editor (xem `setup.md`, `database.md`) |
| Tạo tài khoản admin đầu tiên trên prod | Chưa làm |
| Sửa lỗi MovieCard.jsx:136 | **Cần kiểm tra lại vị trí chính xác trước khi sửa** — kiểm tra file thật thì dòng 136 là `getBoundingClientRect()` đã có guard, vị trí lỗi chưa khớp với brief ban đầu nên chưa sửa vội |

## Tài liệu liên quan

- [architecture.md](architecture.md) — kiến trúc tổng thể
- [frontend.md](frontend.md) — frontend, custom giao diện
- [player.md](player.md) — player vsmov + JWPlayer
- [backend.md](backend.md) — API, settings, đếm lượt xem
- [database.md](database.md) — schema, migration 002/003/004
- [admin.md](admin.md) — trang admin, player settings
- [decisions.md](decisions.md) — các quyết định đã chốt
- [troubleshooting.md](troubleshooting.md) — lỗi thường gặp
- [setup.md](setup.md) — chạy local, deploy, quy trình database
