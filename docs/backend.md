# Backend API — PhimVietHay

> Backend: Express 5.1, `server/` (entry `server/server.js`, port mặc định
> 5000, Node 24 trên Render). Deploy prod: `phimviethay-p45m.onrender.com`.
> CORS chỉ cho: `http://localhost:5173`, `https://phimviethay.pages.dev`,
> và `CLIENT_URL` (env). Rate limit: 300 request / 5 phút trên `/api`.
> Base URL frontend dùng: `VITE_API_URL` (xem `troubleshooting.md`).
>
> Dữ liệu phim KHÔNG qua backend: frontend gọi trực tiếp API vsmov
> (`https://vsmov.com/api`, public, không cần token —
> `client/src/services/movieService.js`). Backend chỉ làm auth, tài khoản,
> admin, settings, views và extract m3u8 + phụ đề.

## 1. Auth — `POST /api/auth/*` (`server/src/routes/authRoutes.js`)

JWT: access token hết hạn sau **7 ngày**, payload `{ id, role }`; Google
callback cấp thêm refresh token 30 ngày. Header: `Authorization: Bearer <token>`.

| Endpoint | Method | Auth | Mô tả |
|---|---|---|---|
| `/api/auth/register` | POST | Không | Body `{ username, email, password, fullname? }`. Thiếu trường → 400 "Vui lòng nhập đầy đủ thông tin!". Trùng username/email → 400 "Email hoặc Username đã tồn tại!". Thành công → 201 "Đăng ký thành công!". Mật khẩu hash bcrypt 10 rounds. **Lưu ý:** `fullname` thiếu phải thành `null` (commit `9f277eb`) — mysql2 từ chối bind `undefined` nên trước đây đăng ký không gửi `fullname` bị 500 (xem `troubleshooting.md`). |
| `/api/auth/login` | POST | Không | Body `{ email, password }` (đăng nhập bằng email). Tài khoản không tồn tại → 400 "Tài khoản không tồn tại!". Sai mật khẩu → 400 "Mật khẩu không đúng!". Tài khoản Google (password NULL) → 400 "Email này đã đăng ký bằng Google...". Tài khoản bị khóa (`banned_until` còn hiệu lực) → 403. Thành công → 200 `{ token, user: { id, username, fullname, email, avatar, role, theme } }` — `theme` đã parse, frontend áp theme ngay sau login. **Frontend gộp 2 lỗi 400 thành 1 toast** "Sai tài khoản hoặc mật khẩu, vui lòng kiểm tra lại" (không lộ tài khoản có tồn tại hay không) — `client/src/pages/Login.jsx:95`. |
| `/api/auth/me` | GET | JWT | Trả thông tin user hiện tại (kèm `theme`, `null` nếu chưa lưu). Không tìm thấy → 404. |
| `/api/auth/google` | GET | Không | **CHƯA CHẠY — trả 503** "Google login chưa cấu hình. Vui lòng đăng nhập bằng email/mật khẩu." khi chưa đủ `GOOGLE_CLIENT_ID` / `GOOGLE_CLIENT_SECRET` / `GOOGLE_CALLBACK_URL` (passport chỉ đăng ký strategy khi đủ credential). Nút Google trên form login đang comment out. Để bật cần migration `002_add_google_auth` (thêm `google_id`, `auth_type`) + cấu hình OAuth — xem `database.md`. |
| `/api/auth/google/callback` | GET | Không | Cũng qua gate 503 như trên. Khi chạy: cấp access token 3 ngày + refresh token 30 ngày, redirect về `/login?token=...&refreshToken=...`. |

## 2. Tài khoản / theme — `/api/user/*` (`server/src/routes/userRoutes.js`)

Tất cả cần JWT (`verifyToken`).

| Endpoint | Method | Mô tả |
|---|---|---|
| `/api/user/favorites` | GET / POST / DELETE `/:slug` | Yêu thích. Thêm: body `{ movie_slug, movie_name, ... }`, mặc định quality `HD`, year `2024`, episode `Full`, vote 0. |
| `/api/user/favorites/check/:slug` | GET | Kiểm tra phim đã yêu thích chưa. |
| `/api/user/profile` | PUT | Cập nhật thông tin user. |
| `/api/user/history` | GET / POST / DELETE (cả list và `/:slug`) | Lịch sử xem (xem tới tập nào). |
| `/api/user/theme` | **PATCH** | Lưu giao diện cá nhân (xem mục 5). |

## 3. Settings — `/api/admin/settings` (`server/src/routes/adminRoutes.js`)

Cần JWT + quyền admin (`verifyToken` + `verifyAdmin` áp toàn bộ router admin).
Dữ liệu ở bảng `settings` (migration 004) — xem `database.md`, `admin.md`.

| Endpoint | Method | Mô tả |
|---|---|---|
| `/api/admin/settings` | GET | Trả `{ player: { player_license, player_logo_file, player_logo_link, player_logo_position, player_vast_file, player_vast_skipoffset } }`. Key nào thiếu trong DB thì dùng giá trị mặc định. |
| `/api/admin/settings` | PUT | Body object phẳng `{ key: value }`, chỉ gồm key cần đổi. Validate **toàn bộ trước** (atomic): sai 1 key → 400, không đổi key nào. Key lạ → 400. `player_logo_position` chỉ nhận `top-left / top-right / bottom-right / bottom-left / control-bar`. `player_vast_skipoffset` phải là số nguyên ≥ 0 (nhận number hoặc string số, lưu dạng string). `player_logo_file / player_logo_link / player_vast_file` phải là URL http/https hoặc chuỗi rỗng. `player_license` là chuỗi bất kỳ (kể cả rỗng). Thành công → 200 kèm settings đã cập nhật dạng group như GET. |

## 4. Lượt xem — `POST /api/views` + `GET /api/admin/stats/views`

### `POST /api/views` — public, không cần login
(`server/src/routes/viewsRoutes.js`, controller `viewsController.js`)

- Body: `{ slug }`. Thiếu slug → 400 "Thiếu slug phim."
- Lưu vào bảng `movie_views`: `slug` + `ip_hash` (sha256 của IP, **không lưu
  IP thô**; IP lấy từ `X-Forwarded-For` phần tử đầu, rồi `req.ip`) +
  `user_id` (từ JWT nếu client gửi token hợp lệ, không thì NULL) +
  `viewed_at`.
- **Chống spam (dedup):** cùng `ip_hash` + `slug` trong 30 phút qua chỉ ghi
  1 row. Luôn trả 200: `{ recorded: true }` nếu vừa ghi,
  `{ recorded: false }` nếu trùng dedup.
- Frontend (`MovieDetail.jsx`) gọi 1 lần mỗi lần xem phim.

### `GET /api/admin/stats/views` — cần JWT + admin
(`adminRoutes.js` → `viewsController.getViewsStats`)

Trả JSON:

```json
{
  "today": 0,
  "last7Days": 0,
  "last30Days": 0,
  "top7Days": [{ "slug": "...", "views": 0 }],
  "top30Days": [{ "slug": "...", "views": 0 }]
}
```

Top 10 mỗi loại, sắp xếp theo lượt xem giảm dần. **Chỉ trả slug + số lượt
xem — backend KHÔNG gọi vsmov để lấy tên phim**, frontend tự map slug → tên.

## 5. Theme giao diện — `PATCH /api/user/theme`

(Cần JWT. Controller `userController.updateTheme`, validate
`server/src/utils/themeValidation.js`.)

- Body: `{ theme: { ... } }`. `theme` phải là object JSON; chỉ chấp nhận
  8 key đã biết, key lạ → 400:
  `preset, accent, radius, fontSize, density, hiddenRows, animations, glass`.
- `preset` phải thuộc: `crimson, ocean, violet, emerald, amber, rose, custom`
  (6 preset tối + custom). `accent` phải là hex hợp lệ (`#RGB` / `#RRGGBB`).
  `hiddenRows` phải là mảng chuỗi (slug các hàng trang chủ muốn ẩn).
  `animations` / `glass` phải là boolean. `radius` / `fontSize` / `density`
  là chuỗi không rỗng (backend không khóa cứng tập giá trị).
- Thành công → 200 `{ message: "Đã lưu giao diện!", theme: <theme đã lưu> }`
  (đọc lại từ DB sau khi ghi).
- **Lỗi đặc trưng:** DB chưa chạy migration 003 (thiếu cột `theme`) →
  500 "Server chưa migrate cột theme. Chạy: npm run migrate (trong server/)."
  Xem `database.md` — trên TiDB prod từng thiếu cột này, cần chạy lại 003.
- Giá trị 6 preset (accent): crimson `#E50914`, ocean `#3B82F6`,
  violet `#8B5CF6`, emerald `#10B981`, amber `#F59E0B`, rose `#EC4899`.
  Ngoài ra có custom accent + bo góc / cỡ chữ / mật độ + ẩn/hiện hàng
  (mục Giao diện trong Hồ sơ, tự lưu ngay khi đổi).
- Lưu ý đã biết: JSON thô trong DB hơi lệch khi đổi preset (hiển thị vẫn
  đúng); auto-contrast không thành light theme thật — web chỉ có dark mode.

## 6. Extract m3u8 + phụ đề, key player — public

### `GET /api/extract-m3u8?embed=<link_embed>`
(`server/src/routes/extractRoutes.js`, controller `extractController.js`)

- **Vì sao cần:** API vsmov chỉ trả `link_embed`, field `link_m3u8` luôn
  null. Muốn có m3u8 phải fetch HTML trang embed rồi parse.
- Chỉ chấp nhận host `vsmov.com` / `*.vsmov.com` / `streamvsmov.com` /
  `*.streamvsmov.com` (host thực tế đo được: `v<so>.streamvsmov.com`,
  vd `v10.streamvsmov.com`). Ngoài host này → 400 "URL embed không thuộc vsmov".
  Thiếu `embed` → 400; URL sai định dạng → 400; fetch lỗi / timeout 10s /
  không tách được → 404 "Không tách được m3u8".
- Cách parse (thử lần lượt): `signedMasterUrl` → `"file": "...m3u8"` (JSON) →
  `file: '...m3u8'` (JS) → `sources: [{ file: ... }]` → dựng từ
  `baseUrl + '/stream/' + videoHash + '/master.m3u8'` → bất kỳ URL `.m3u8`
  nào trong trang (ưu tiên URL có query/signature).
- **Cache in-memory 30 phút theo URL embed** (`CACHE_TTL_MS = 30 * 60 * 1000`),
  tự động prune dọn dẹp khi cache vượt quá 500 bản ghi. Kèm header response
  `Cache-Control: public, max-age=1800, stale-while-revalidate=300` giúp trình duyệt
  phía client và CDN cache lại kết quả, mở phim gần như tức thì.
- Trả: `{ m3u8, subtitles: [{ file, label, code }] }`. `subtitles` parse từ
  mảng `subtitles` trong HTML trang embed (file `.vtt`, thường `vie` + `eng`,
  label Tiếng Việt / English / ... theo bảng `SUBTITLE_LABELS` trong
  controller); URL tương đối được resolve thành tuyệt đối theo origin trang
  embed. Không có sub → `[]`, player vẫn chạy bình thường.
- Giả lập trình duyệt chống chặn: Header đầy đủ (`Sec-Ch-Ua`, `Sec-Fetch-*`,
  `Accept-Language`, `Referer`, Chrome 131) + cơ chế tự động retry (tối đa 2 lần,
  backoff 400ms) khi mạng chập chờn hoặc vsmov phản hồi chậm.

### `GET /api/player-key` — public, không cần login
(`server/src/routes/playerKeyRoutes.js` → `settingsController.getPlayerKey`)

- Trả `{ key: <player_license> }` — chỉ đúng key này, không trả toàn bộ
  settings. Key rỗng / chưa có trong DB → `{ key: "" }` (200, không lỗi)
  để frontend tự xử lý. Lỗi DB → 500 "Lỗi lấy key trình phát".
- Player bắt buộc lấy key trước khi chạy `origin.js` (không key → lỗi
  JW Player 100011). Xem `player.md`.

## 7. Các API khác (đã có, ngoài phạm vi tài liệu này)

- `/api/comments/:slug` (GET public, POST/DELETE cần JWT, `POST /:id/like`),
  `/api/analytics/*` (log hành vi player + admin God Mode intro/credits),
  `/api/admin/*` (stats, users, comments — xem `admin.md`).
  Socket.IO (watch party) chạy cùng server HTTP — chưa xác minh chi tiết
  trong đợt viết docs này, xem `server/src/socket/`.
