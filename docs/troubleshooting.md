# Xử lý lỗi thường gặp (Troubleshooting) — PhimVietHay

## 1. Trang vẫn chạy code cũ sau khi deploy — service worker / cache cũ

- **Triệu chứng:** đã deploy bản mới nhưng trình duyệt vẫn chạy code cũ
  (lỗi đã sửa vẫn còn, giao diện cũ).
- **Nguyên nhân:** client dùng `vite-plugin-pwa` (`registerType: 'autoUpdate'`,
  `client/vite.config.js`) nên service worker của bản build cũ có thể phục
  vụ chunk JS cũ.
- **Cách xử lý:** xóa cache trình duyệt, hoặc unregister service worker rồi
  tải lại trang. Khi test sau rebuild, tốt nhất xóa profile Chrome test
  hoặc mở cửa sổ ẩn danh mới.

## 2. Player không phát trên localhost, nhưng chạy tốt trên domain thật — CORS chỉ cho HTTPS

- **Triệu chứng:** direct m3u8 lỗi trên `http://localhost:5173`, nhưng cùng
  phim đó phát bình thường trên `https://phimviethay.pages.dev`.
- **Nguyên nhân:** CDN segment `p<so>.streamvsmov.com` chỉ trả header CORS
  khi Origin là HTTPS; Origin HTTP không được trả CORS. Đây không phải lỗi
  player.
- **Cách xử lý:** không cần proxy, không sửa player. Test phát video trên
  domain thật (HTTPS) hoặc deploy bản test lên Cloudflare Pages rồi xem.
  Ngược lại, file phụ đề `.vtt` trả `Access-Control-Allow-Origin: *` cho cả
  HTTP lẫn HTTPS nên sub vẫn tải được ở local.

## 3. `GET /api/player-key` trả 404 — build trỏ backend cũ

- **Triệu chứng:** player báo "Không lấy được key trình phát (HTTP 404)",
  lỗi JW Player 100011.
- **Nguyên nhân:** `client/.env.production` trong repo đang là
  `VITE_API_URL=https://phimviethay.onrender.com/api` (Render **cũ** — backend
  này không có route `/api/player-key`). Backend v2 đúng là
  `https://phimviethay-p45m.onrender.com/api`.
- **Cách xử lý:** trước khi build để deploy, sửa `client/.env.production`
  thành:

```bash
VITE_API_URL=https://phimviethay-p45m.onrender.com/api
```

  rồi build lại. Kiểm chứng nhanh: mở
  `https://phimviethay-p45m.onrender.com/api/player-key` trên trình duyệt —
  phải trả 200 `{ "key": "..." }`. (Backend cũ `phimviethay.onrender.com`
  trả 404 ở route này là đúng — nó không có route đó.)

## 4. Đăng ký tài khoản bị lỗi 500

- **Triệu chứng:** đăng ký không gửi `fullname` (hoặc frontend cũ không gửi)
  thì server trả 500 "Lỗi đăng ký tài khoản."
- **Nguyên nhân:** mysql2 từ chối bind parameter `undefined`
  ("Bind parameters must not contain undefined").
- **Cách xử lý:** đã sửa ở commit `9f277eb` — `User.create` chuẩn hóa
  `fullname || null` (`server/src/models/User.js:71`). Nếu vẫn gặp 500 khi
  đăng ký sau commit này, kiểm tra xem backend đang chạy có chứa commit đó
  chưa (Render deploy từ GitHub — phải push code mới thì Render mới có),
  và xem log server để biết field nào còn `undefined`.

## 5. Google login trả 503 / nút Google không hiện

- **Triệu chứng:** `GET /api/auth/google` trả 503 "Google login chưa cấu
  hình. Vui lòng đăng nhập bằng email/mật khẩu."; nút Google trên form
  login đang bị comment out.
- **Nguyên nhân:** đây là trạng thái **đúng theo thiết kế hiện tại** — Google
  login chưa tích hợp lại. Passport chỉ đăng ký strategy Google khi đủ
  `GOOGLE_CLIENT_ID` / `GOOGLE_CLIENT_SECRET` / `GOOGLE_CALLBACK_URL`.
- **Cách xử lý:** chưa có cách bật nhanh. Để bật cần cả 3 việc: chạy migration
  `002_add_google_auth.sql` (thêm `google_id`, `auth_type` vào bảng `users`),
  cấu hình OAuth trên Google Cloud + env trên Render, và mở lại nút Google
  ở `client/src/pages/Login.jsx`. Xem `database.md` (mục 002) và `backend.md`.

## 6. Phụ đề hiện chữ `<i>...</i>` thay vì chữ nghiêng

- **Triệu chứng:** sub hiển thị literal `<i>...</i>` trên màn hình.
- **Nguyên nhân:** file `.vtt` chứa thẻ `<i>` nhưng bị escape thành text
  (`origin.js` có hàm `escapeHtml` ở dòng 771) — quirk sẵn của bản copy
  code vsmov, không phải do dữ liệu sub sai.
- **Cách xử lý:** chưa sửa. Muốn sửa phải can thiệp vào `origin.js` (file
  copy của vsmov) hoặc xử lý cue trước khi render — cần quyết định riêng
  vì đi ngược nguyên tắc "không sửa file copy" (xem `decisions.md`).

## 7. Mobile: mở panel Phụ đề thì che gần hết phụ đề

- **Triệu chứng:** mobile mở panel Phụ đề, panel che gần hết dòng sub; đóng
  panel thì sub hiện bình thường.
- **Nguyên nhân:** panel mở lên trên (dropup) nhưng chiếm gần hết chiều cao
  player mobile (~219px ở màn 390px), trong khi sub cố định ở bottom 16%
  nên nằm dưới panel.
- **Cách xử lý:** chưa sửa (đây là hành vi chấp nhận được tạm thời — user
  chọn xong phụ đề rồi đóng panel là xem bình thường). Hướng sửa có thể
  bàn sau: thu nhỏ panel mobile hơn nữa hoặc tạm ẩn sub khi panel mở.

## 8. `PATCH /api/user/theme` trả 500 "Server chưa migrate cột theme"

- **Triệu chứng:** đổi giao diện trong Hồ sơ bị lỗi 500 với message trên.
- **Nguyên nhân:** bảng `users` trên TiDB prod thiếu cột `theme` do migration
  003 từng chạy lúc bảng `users` chưa có.
- **Cách xử lý:** chạy lại `database/migrations/003_add_user_theme.sql` trên
  TiDB Cloud SQL Editor (nhớ `USE phimviethay;`). Câu SQL dùng
  `ADD COLUMN IF NOT EXISTS` nên chạy lại an toàn. Xem `database.md`.

## 9. Lỗi khác đã biết (chưa sửa, không cần xử lý gấp)

- `MovieCard.jsx:136` cần guard `instanceof Node` — chưa xác minh vị trí
  chính xác trong đợt viết docs này, xem code trước khi sửa.
- Nút back-to-top che chữ "chủ." cuối đoạn disclaimer ở footer — user đã
  chấp nhận, không sửa.
