# Kiến trúc PhimVietHay

## Tổng quan

PhimVietHay là web xem phim mà **dữ liệu phim không nằm trong hệ thống
của mình**: frontend gọi trực tiếp API vsmov (`https://vsmov.com/api`,
public, không cần token). Backend của mình chỉ phục vụ những gì vsmov
không có: tài khoản, yêu thích, lịch sử, bình luận, cài đặt admin, đếm
lượt xem, và tách link m3u8 + phụ đề từ trang embed vsmov.

```
Người dùng
   │
   ├─ Dữ liệu phim ────────────────► vsmov API (https://vsmov.com/api)
   │    (danh sách, chi tiết, tập, tìm kiếm, menu thể loại/quốc gia)
   │
   ├─ Tài khoản / admin / views ───► Backend Express (Render)
   │    (JWT auth, favorites, history, comments, settings, views,
   │     extract m3u8 + subtitles, player-key)
   │         │
   │         └─► TiDB Cloud (MySQL) — 9 bảng
   │
   └─ Stream + phụ đề ─────────────► CDN vsmov (m3u8 đã ký, .vtt)
        (player JWPlayer trong trình duyệt phát trực tiếp)
```

## Luồng dữ liệu theo tính năng

### 1. Trang chủ / danh sách / tìm kiếm / chi tiết

```
Browser (movieService.js, axios baseURL https://vsmov.com/api)
  → GET /danh-sach/phim-moi-cap-nhat?page=1        (hero + hàng phim)
  → GET /danh-sach/{slug} | /the-loai/{slug} | /quoc-gia/{slug}?page=N
  → GET /tim-kiem?keyword=...&page=N
  → GET /phim/{slug}                               (chi tiết + tập)
  → GET /the-loai | /quoc-gia                      (menu header, cache trong phiên,
                                                     retry tối đa 2 lần cách nhau ~1s)
```

- Response vsmov dạng `{ status, items, pagination }` được chuẩn hóa
  (`normalizeList`) về shape Ophim cũ để không sửa các trang.
- Một số slug được remap vì vsmov không có endpoint tương ứng, vd
  `danh-sach/hoat-hinh` → `the-loai/hoat-hinh`,
  `danh-sach/tv-shows` → `danh-sach/phim-bo`,
  `the-loai/tinh-cam` → `the-loai/lang-man`
  (xem `REMAP` trong `client/src/services/movieService.js`).
- Một số endpoint vsmov không có (404) nên frontend tự xử lý:
  `/phim/{slug}/peoples` và `/phim/{slug}/images` trả `[]` khi lỗi;
  `/home` không tồn tại nên hero lấy từ phim mới cập nhật.
- Ảnh poster/thumb là URL đầy đủ do vsmov trả; ảnh lỗi/rỗng được thay
  bằng placeholder `https://placehold.co/300x450?text=No+Image`.

### 2. Xem phim (player)

```
Browser (WatchMovie.jsx)
  1. GET https://vsmov.com/api/phim/{slug}          → link_embed từng tập
  2. GET {VITE_API_URL}/extract-m3u8?embed=<link>   → { m3u8, subtitles }
       (backend fetch HTML trang embed vsmov, parse URL m3u8 đã ký
        + mảng `subtitles` [.vtt vie + eng], cache in-memory 5 phút)
  3. GET {VITE_API_URL}/player-key                  → { key } (JWPlayer license)
  4. Nạp origin.js v62 + player.css + broadcast-player.css
     (copy y nguyên code player vsmov, chỉ đổi logo) + jwplayer-8.9.3.js
     + 3 CDN ngoài (jQuery Google, Bootstrap cdnjs, FontAwesome cdnjs)
  5. JWPlayer phát m3u8 trực tiếp từ CDN vsmov; phụ đề .vtt,
     Tiếng Việt mặc định
```

- Phụ đề: vị trí theo player gốc vsmov — bottom 14% desktop, 16%
  mobile (≤980px), 12% fullscreen, cố định không nhảy khi control bar
  ẩn/hiện; cỡ chữ 35/30/25/20. Quirk còn tồn tại: phụ đề có thể hiện
  literal `<i>...</i>` (VTT bị escape, có sẵn từ bản copy vsmov).
- Player settings (license/logo/VAST) lấy từ bảng `settings` qua
  `GET /api/admin/settings` (admin) và `GET /api/player-key` (public,
  chỉ trả key). Lưu ý: player settings chưa tác dụng lên iframe — trang
  xem phim hiện tại dùng JWPlayer trực tiếp, không còn iframe.
- Rủi ro đã biết: player phụ thuộc 3 CDN ngoài; 1 CDN hỏng là cả player
  hỏng. Chưa tự host các file này.

### 3. Tài khoản / yêu thích / lịch sử / bình luận

```
Browser (axiosConfig.js, baseURL = VITE_API_URL, kèm Bearer token)
  → POST /api/auth/register | /api/auth/login   → JWT (localStorage: token)
  → GET  /api/auth/me                          → user + theme
  → PATCH /api/user/theme                      → lưu theme (users.theme JSON)
  → GET/POST/DELETE /api/user/favorites[/:slug | /check/:slug]
  → GET/POST/DELETE /api/user/history[/:slug]
  → GET  /api/comments/:slug                   (xem không cần login)
  → POST /api/comments                         (cần login; trả lời lồng nhau qua parent_id)
  → POST /api/analytics/log                    (behavior_logs)
```

- Token hết hạn (401/403, trừ route `/auth/*`) → xóa token + chuyển
  về `/login?expired=true`. Rate limit: 300 request / 5 phút / IP
  trên toàn bộ `/api` (trả 429 khi vượt).
- Google login **CHƯA chạy**: route `/api/auth/google` trả 503
  "Google login chưa cấu hình" khi thiếu `GOOGLE_CLIENT_ID` /
  `GOOGLE_CLIENT_SECRET` / `GOOGLE_CALLBACK_URL`; nút Google đang
  comment out ở frontend. Khôi phục cần migration 002 + OAuth thật.

### 4. Admin + đếm lượt xem

```
Admin (role admin / super_admin, verifyToken + verifyAdmin)
  → GET  /api/admin/stats                       (dashboard)
  → GET  /api/admin/stats/views                 (hôm nay / 7 ngày / 30 ngày + top 10)
  → GET/PUT /api/admin/settings                 (6 key nhóm player)
  → GET  /api/admin/users   DELETE /api/admin/users/:id
  → PUT  /api/admin/users/:id/role | /ban       (chỉ super_admin)
  → GET  /api/admin/comments  DELETE /api/admin/comments/:id

Public (không cần login)
  → POST /api/views { slug }                    (MovieDetail ghi 1 lần)
       dedup: cùng sha256(IP) + slug trong 30 phút chỉ ghi 1 row,
       không lưu IP thô; luôn trả 200 { recorded: true|false }
```

### 5. Xem chung (Watch Party) — chưa xác minh mức hoàn thiện

- Route `/watch-party`, `/watch-party/:roomId`; Socket.IO ở cả client
  (`client/src/services/socket.js`) và server (`server/src/socket/`,
  `watchParty.js`). Chưa test luồng thật nên không mô tả chi tiết hơn.

## Ranh giới trách nhiệm

| Phần | Làm gì | Không làm gì |
| :--- | :--- | :--- |
| **Frontend (`client/`)** | Gọi trực tiếp vsmov lấy dữ liệu phim; render UI; player JWPlayer; gọi backend cho auth/user/admin/views/extract | Không lưu phim, không sync DB phim (bảng `movies` đã bỏ 23/11/2026 cùng movieController) |
| **Backend (`server/`)** | Auth JWT, user/favorites/history/comments, settings, views, extract m3u8 + subtitles, player-key, Socket.IO | Không proxy dữ liệu phim (trừ extract), không lưu nội dung phim |
| **Database (TiDB)** | 9 bảng: `users`, `favorites`, `history`, `comments`, `comment_likes`, `behavior_logs`, `episode_intelligence`, `settings`, `movie_views` (+ `schema_migrations`) | Không có bảng phim; `movie_views` chỉ lưu slug |
| **vsmov (bên ngoài)** | Nguồn dữ liệu phim duy nhất, link embed, m3u8 + .vtt, code player gốc | Không thuộc quyền kiểm soát — API đổi là frontend phải theo |
| **Cloudflare Pages** | Host tĩnh client | Không chạy backend |
| **Render** | Chạy Express (`server.js`, Node 24) | Không host DB |
| **TiDB Cloud** | Database MySQL (`phimviethay`, Singapore, SSL bắt buộc) | Không chạy app |

## Các file/mô-đun chính

**Frontend** — `client/src/`:
- `services/movieService.js` — mọi gọi API vsmov + normalize + remap slug
- `services/axiosConfig.js` — axios backend (`VITE_API_URL`), gắn token,
  xử lý 401/429
- `services/authService.js`, `commentService.js`, `adminService.js`,
  `analyticsService.js`, `tmdbService.js` — gọi backend (TMDB dùng làm
  fallback cho dàn cast — chưa xác minh chi tiết)
- `context/ThemeContext.jsx` — theme/preset, CSS var `--accent`, `--bg`…
- `routes.jsx` — toàn bộ route (lazy load từng trang)
- `pages/WatchMovie.jsx` — player (origin.js + JWPlayer 8.9.3)
- `config/menuRows.js` — nguồn duy nhất cho slug hàng trang chủ + menu

**Backend** — `server/`:
- `server.js` — Express app: helmet/hpp/CORS/rate-limit, mount route,
  Socket.IO; CORS chỉ cho `http://localhost:5173`,
  `https://phimviethay.pages.dev` và `CLIENT_URL`
- `src/routes/` — `authRoutes`, `userRoutes`, `commentRoutes`,
  `adminRoutes`, `analyticsRoutes`, `viewsRoutes`, `extractRoutes`,
  `playerKeyRoutes`
- `src/controllers/` — `auth`, `user`, `comment`, `admin`, `analytics`,
  `extract`, `settings`, `views`
- `src/models/` — `User`, `Favorite`, `History`, `Comment`
  (query SQL trực tiếp qua mysql2, không dùng ORM)
- `src/config/database.js` — pool mysql2 (`DB_HOST/PORT/USER/PASS/NAME/SSL`)
- `src/utils/themeValidation.js`, `settingsValidation.js` — validate
  theme/settings trước khi ghi DB

**Database** — `database/migrations/`:
- `001_init.sql` — 7 bảng gốc (users 10 cột, chưa có google_id/auth_type)
- `002_add_google_auth.sql` — khôi phục google_id + auth_type (**chưa chạy**,
  migrate.js không tự chạy file này)
- `003_add_user_theme.sql` — cột `users.theme` JSON
- `004_admin_settings_views.sql` — bảng `settings` (seed 6 key player) +
  `movie_views`
- `migrate.js` — chạy 001 → 003 → 004, ghi `schema_migrations`, kiểm chứng
  đủ 9 bảng + cột theme + đủ 6 key settings

## Quyết định kiến trúc đã chốt

- Chỉ dùng nguồn vsmov (PhimAPI/KKPhim loại vì chèn quảng cáo; không làm
  chuyển nguồn). Frontend gọi thẳng vsmov thay vì qua backend, vì backend
  sync phim từ Ophim đã chết theo Ophim.
- Player COPY y nguyên code vsmov, chỉ đổi logo + dùng JWPlayer của mình;
  không viết lại player.
- Chỉ dark mode; theme là các preset tối + custom accent.
- Mọi thay đổi lớn trên frontend cũ phải hỏi user trước.
