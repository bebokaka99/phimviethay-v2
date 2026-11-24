# Quyết định đã chốt — PhimVietHay

> Các quyết định dưới đây do user chốt trong quá trình làm (22–24/11/2026).
> Mọi thay đổi lớn so với những điểm này đều phải hỏi user trước.

## 1. Chỉ dùng nguồn phim vsmov — không làm chuyển nguồn

- Dữ liệu phim lấy từ API vsmov (`https://vsmov.com/api`, public, không cần
  token). Frontend gọi trực tiếp; backend chỉ tách m3u8 + phụ đề từ trang
  embed và làm auth/admin.
- **PhimAPI (KKPhim) bị loại:** user tự test thấy bị chèn quảng cáo giữa
  phim. Kết luận: vsmov là nguồn sạch nhất.
- Không tích hợp chuyển nguồn, không thêm nguồn dự phòng.

## 2. Chỉ dark mode — không làm light mode

- User bỏ light mode ngày 23/11/2026: thêm light mode là vô dụng với web này.
- Mọi preset giao diện đều là bộ màu tối (6 preset + custom accent).
  Tính năng "auto-contrast" trong custom giao diện không biến web thành
  light theme thật.

## 3. Player: copy y nguyên code vsmov thay vì viết lại

- Sau 2 lần viết lại player đều không giống vsmov, user chốt ngày 24/11/2026
  ~03:00: **copy y nguyên** `origin.js` + `player.css` +
  `broadcast-player.css` của vsmov, chỉ đổi logo PhimVietHay + dùng JWPlayer
  8.9.3 + key của mình.
- Lý do: code gốc đã xử lý sẵn mọi trường hợp (phụ đề, menu, fullscreen,
  mobile); viết lại vừa lệch vừa sinh lỗi mới. Các bản sửa sau đó chỉ thêm
  CSS/JS "guard" bên ngoài (`PLAYER_GUARD_CSS`, `startPlayerMenuFixes()`),
  không sửa file copy.
- Mục tiêu dài hạn (chưa làm): dùng JWPlayer riêng để tự custom — màn ending,
  auto-next tập, custom màu player + thanh tiến trình theo theme, phục vụ
  tính năng pet xem chung sau này.

## 4. Phát triển dựa trên frontend cũ — không thay/loại bỏ nhiều

- User chốt tối 22/11/2026 sau khi bản fix làm mất hiệu ứng gốc (chuyển slide
  hero, popup): giữ frontend cũ, chỉ sửa điểm lỗi; mọi quyết định thay đổi
  hay loại bỏ đều phải thông qua ý kiến user trước.
- Nền hero đỏ pha (màu background cũ) là signature của web — không đổi
  thành nền đen hoàn toàn.
- Animation trang chủ phải mượt thật (không chỉ chuyển cảnh FPS thấp); mọi
  thay đổi trang chủ phải đồng bộ với những gì API vsmov thực sự trả về.

## 5. Muse không push GitHub — user tự push từ máy Windows

- Mọi code chỉ commit local (nhánh main, repo làm việc `~/workspace/phimviethay`).
  User tự push lên GitHub (`bebokaka99/phimviethay-v2`) từ máy của mình.
- Luôn nói rõ cái gì mới ở local, cái gì đã có trên GitHub.

## 6. Quy trình thay đổi database: gửi SQL, user chạy trên TiDB Cloud SQL Editor

- Sandbox không nối được TiDB prod; Render Shell chỉ có ở gói trả phí.
- Mọi thay đổi DB: Muse gửi code SQL, user tự chạy trên TiDB Cloud SQL
  Editor (nhớ `USE phimviethay;` trước). Migration ở `database/migrations/`
  (001→004), runner `migrate.js` chỉ chạy 001 → 003 → 004; 002 (Google auth)
  chưa chạy, chỉ chạy tay khi cần.
- Xem chi tiết ở `database.md`.

## 7. Đăng nhập sai: gộp thành 1 thông báo chung, hiện bằng toast

- Backend vẫn phân biệt 2 lỗi 400 ("Tài khoản không tồn tại!" /
  "Mật khẩu không đúng!") nhưng frontend gộp thành 1 toast duy nhất:
  **"Sai tài khoản hoặc mật khẩu, vui lòng kiểm tra lại"** — không lộ tài
  khoản có tồn tại hay không (`client/src/pages/Login.jsx:95`).
- Quy tắc chung đã chốt 23/11/2026: bỏ `alert()` trình duyệt, dùng toast
  React — cùng thư viện/mẫu thông báo đã dùng khi lưu phim (áp dụng cả cho
  lỗi đăng nhập và upload avatar).

## 8. Thứ tự ưu tiên đã chốt (23/11/2026)

- Làm **custom giao diện trước**; tab "Gợi ý phim cho bạn" và pet xem cùng
  gác lại bàn sau (không bỏ).
- Tính năng custom giao diện đã xong 23/11/2026 (migration 003,
  `PATCH /api/user/theme`, mục Giao diện trong Hồ sơ). Đổi theme có thêm
  yêu cầu bước xem trước (preview card phim + header trước khi áp dụng,
  đổi màu cả thanh tiến trình JWPlayer) — user đề xuất 24/11/2026, chưa làm.
