# PhimVietHay — Bundle sửa sub player (theo vị trí gốc vsmov)

Ngày: 24/11/2026. Commit local: `bb83671` (trên `cd9fd64` — bản sửa 4 lỗi player trước).
Bundle này CHỈ chứa bản sửa sub lần này (2 file). Bạn đã apply bundle tổng
footer + About + 4 lỗi player trước đó thì chỉ cần apply bundle này đè lên.

## Gồm những gì

1. **Sub hiện khi mở Cài đặt / panel Phụ đề** — trước đây mở Cài đặt là sub biến
   mất (do rule ẩn overlay khi dropdown mở). Giờ sub vẫn hiện để bạn chỉnh
   màu/nền/độ trong/cỡ chữ và nhìn thấy kết quả ngay.
2. **Vị trí sub theo đúng player gốc vsmov, cố định không nhảy** — đo thật trên
   player gốc: desktop `bottom: 14%` (69px), mobile `bottom: 16%` (35px),
   fullscreen `12%`. Một giá trị cho mọi trạng thái: sub không nhảy lên/xuống
   khi control bar hiện/ẩn, không tụt về 8% khi hết timeout.
3. **Sub nằm DƯỚI control bar + panel (z-index 15 < control bar 20)** — control
   bar và bảng Cài đặt luôn vẽ trên cùng, sub chỉ hiện ở phần không bị che,
   không đè lên nút nào.
4. **Thêm cỡ chữ sub nhỏ: 35, 30, 25, 20** — danh sách cỡ chữ desktop giờ là
   [64, 56, 48, 40, 35, 30, 25, 20] (trước đây min là 40). Mobile có sẵn
   [35, 32, 30, 25, 24, 20, 18, 16, 14, 12]; lưu ý chọn 25 trên mobile ra
   24px do cap mobile 24px có sẵn trong code gốc, không phải lỗi.

## File trong bundle (2 file)

- `client/src/pages/WatchMovie.jsx` — vị trí + z-index + hiện sub khi mở panel
- `client/public/jwplayer/origin.js` — thêm cỡ chữ 35/30/25/20

## Cách apply

1. Commit hoặc tạo branch sạch trước cho an toàn.
2. Giải nén đè lên gốc repo (chỉ đúng 2 file trên).
3. Kiểm tra `client/.env.production`: phải trỏ backend v2
   `https://phimviethay-p45m.onrender.com/api` (backend cũ
   `https://phimviethay.onrender.com/api` làm `/api/player-key` 404).
4. `cd client && npm run build` — bản này đã build PASS trong sandbox.
5. Commit + push, deploy như bình thường.

## Test sau deploy (điện thoại thật + desktop)

- Bật sub → sub ở sát đáy, trong vùng control bar như player gốc; bật/tắt
  control bar (chạm vùng video) → sub đứng yên 1 chỗ, không nhảy.
- Mở Cài đặt → sub vẫn hiện, bảng Cài đặt vẽ trên sub, control bar không bị che.
- Mở CC → Phụ đề → Cỡ chữ: chọn 25 → sub nhỏ lại đúng cỡ.
- Xoá cache / unregister service worker cũ trước khi test kẻo thấy code cũ.

## Lưu ý chưa sửa

- **Mobile khi mở panel Phụ đề**: panel gần full-width nên che gần hết sub
  (phần còn lại bị nút bấm che) — hệ quả của vị trí sub 16% + sub nằm dưới
  panel. Đóng panel thì sub mobile hiện rõ bình thường. Desktop không bị
  (panel chỉ chiếm bên phải). Muốn xem trước sub trên mobile thì cần thu nhỏ
  panel — báo lại nếu bạn muốn làm hướng này.
- Sub vẫn hiện literal `<i>...</i>` (VTT bị escape, quirk sẵn của bản copy
  vsmov) — chưa sửa.
- JW tự ẩn control bar + panel sau ~5s không di chuột là hành vi gốc của
  player vsmov, không phải bug mới.
