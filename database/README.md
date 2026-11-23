# Database — PhimVietHay

Toàn bộ schema + migration của backend (Express + MySQL) nằm tách biệt ở
đây, ngoài thư mục `server/`. Trước đây không có file `.sql` nào nên
database không tạo lại được — thư mục này khắc phục điều đó.

Cấu trúc:

```
database/
├── README.md                  (file này)
└── migrations/
    ├── 001_init.sql           Tạo toàn bộ database (7 bảng)
    ├── 002_add_google_auth.sql Khôi phục Google auth (CHƯA áp dụng — xem dưới)
    ├── 003_add_user_theme.sql Thêm cột users.theme (JSON) — Custom UI
    ├── 004_admin_settings_views.sql Bảng settings + movie_views — Admin Settings + đếm lượt xem
    └── migrate.js             Script chạy migration 001 + 003 + 004
```

## Chạy migration

Từ thư mục `server/`:

```bash
npm run migrate
# tương đương: node ../database/migrations/migrate.js
```

Hoặc từ gốc repo:

```bash
node database/migrations/migrate.js
```

Script sẽ: tạo database nếu chưa có → chạy `001_init.sql` rồi
`003_add_user_theme.sql` rồi `004_admin_settings_views.sql` → ghi nhận
vào bảng `schema_migrations` → kiểm tra lại đủ 9 bảng + cột
`users.theme` + đủ 6 key settings mặc định rồi in báo cáo.
Chạy lại nhiều lần an toàn (mọi câu đều `CREATE TABLE IF NOT EXISTS` /
`ADD COLUMN IF NOT EXISTS` / `INSERT IGNORE` — chạy lại 004 không ghi
đè giá trị settings admin đã đổi).

## Theme giao diện — migration 003 (Custom UI, 23/11/2026)

Cột `users.theme` (JSON, NULL) lưu toàn bộ cài đặt giao diện của user,
vd `{"preset":"ocean","accent":"#3b82f6","radius":"medium",
"fontSize":"medium","density":"comfortable","hiddenRows":[],
"animations":true,"glass":true}`. NULL = chưa lưu theme, dùng mặc định.
API: `GET /api/auth/me` trả thêm `theme`; `PATCH /api/user/theme`
(JWT, chỉ sửa theme của chính mình) lưu theme — validate ở
`server/src/utils/themeValidation.js` (chỉ key đã biết, preset trong
danh sách tối, accent phải là hex). MariaDB lưu JSON dạng LONGTEXT
nên backend tự parse/stringify (`server/src/models/User.js`); chuỗi
JSON hỏng trong DB trả về `null`, không crash.

## Admin Settings + đếm lượt xem — migration 004 (23/11/2026)

- Bảng `settings` (key/value chuỗi, nhóm `setting_group`): cấu hình trình
  phát do admin chỉnh qua `GET/PUT /api/admin/settings` (xem
  `server/src/controllers/settingsController.js` +
  `server/src/utils/settingsValidation.js`). Seed mặc định 6 key nhóm
  `player` bằng `INSERT IGNORE` (chạy lại không ghi đè giá trị admin
  đã đổi): `player_license` (''), `player_logo_file` (''),
  `player_logo_link` (''), `player_logo_position` ('top-right'),
  `player_vast_file` (''), `player_vast_skipoffset` ('5').
- Bảng `movie_views` (`slug`, `ip_hash` CHAR(64) = sha256 của IP — KHÔNG
  lưu IP thô, `user_id` NULL nếu khách, `viewed_at`): 1 row = 1 lượt xem
  đã ghi. API `POST /api/views` (public, không cần login) chống spam:
  cùng `ip_hash` + `slug` trong 30 phút chỉ ghi 1 row; thống kê ở
  `GET /api/admin/stats/views` (hôm nay / 7 ngày / 30 ngày + top 10,
  chỉ slug + views — backend không gọi vsmov lấy tên phim).
  Xem `server/src/controllers/viewsController.js`.

> Bảng `movies` đã bỏ (23/11/2026) cùng `movieController` — code chết cả
> 2 phía, frontend gọi thẳng vsmov. File 001 gốc còn bảng này được lưu tại
> `~/workspace/phimviethay-research/schema-001-with-movies-backup.sql`
> (chỉ để đối chiếu).

## Biến môi trường (file `server/.env`)

| Biến | Mặc định | Ghi chú |
|---|---|---|
| `DB_HOST` | `localhost` | Host MySQL |
| `DB_PORT` | `3306` | MySQL local. TiDB Serverless: `4000` |
| `DB_USER` | `root` | |
| `DB_PASS` | _(trống)_ | `database.js` dùng tên này; `DB_PASSWORD` cũng được chấp nhận |
| `DB_NAME` | `phimviethay` | Tên database sẽ tạo |
| `DB_SSL` | `false` | Đặt `true` khi dùng TiDB Serverless (bắt buộc SSL) |

Ví dụ `.env` chạy local (XAMPP/MySQL):

```env
DB_HOST=localhost
DB_PORT=3306
DB_USER=root
DB_PASS=
DB_NAME=phimviethay
```

## Các bảng (thứ tự tạo theo khóa ngoại)

| # | Bảng | Dùng ở đâu |
|---|---|---|
| 1 | `users` | Auth local (đăng ký/đăng nhập thường), admin quản lý user, ban. Google auth tạm loại bỏ — xem mục dưới |
| 2 | `favorites` | Yêu thích (dữ liệu phim lấy từ request body, không qua bảng `movies`) |
| 3 | `history` | Lịch sử xem (xem tới tập nào) |
| 4 | `comments` | Bình luận theo phim/tập, trả lời lồng nhau (`parent_id`) |
| 5 | `comment_likes` | Like bình luận |
| 6 | `behavior_logs` | Log hành vi player (suy ra intro/credits), chống spam 50 log/IP/ngày |
| 7 | `episode_intelligence` | Mốc intro/credits từng tập (player + admin God Mode) |
| 8 | `settings` | Cấu hình key/value (nhóm player: license/logo/VAST) — Admin Settings |
| 9 | `movie_views` | Lượt xem theo slug + sha256 IP (chống spam 30 phút) — thống kê views |

Bảng `schema_migrations` chỉ để ghi nhận migration đã chạy.

## Google auth — tạm loại bỏ, tích hợp lại sau

Bảng `users` trong `001_init.sql` **không có** 2 cột `google_id` và
`auth_type`. Đăng nhập Google vì vậy tạm thời không chạy được cho tới khi
tích hợp lại — đó là quyết định có chủ ý (23/11/2026), không phải thiếu sót.

Khi muốn tích hợp lại Google:

1. Chạy file `migrations/002_add_google_auth.sql` bằng MySQL client
   (migrate.js **không** tự chạy file này):
   ```bash
   mysql -h <HOST> -P <PORT> -u <USER> -p <DB_NAME> < database/migrations/002_add_google_auth.sql
   ```
2. File 002 thêm lại `google_id` + `auth_type` (+ UNIQUE KEY trên
   `google_id`) và ghi nhận vào `schema_migrations`. Dùng `IF NOT EXISTS`
   nên chạy lại nhiều lần an toàn (MariaDB 10.5+ / TiDB; MySQL 8.0 thuần
   thì bỏ cụm `IF NOT EXISTS` và chỉ chạy 1 lần).
3. Không cần sửa code: `passport.js` / `authController` hiện có đã đọc
   2 cột này. Lưu ý `password` vẫn để NULL — tài khoản Google cũ tạo
   trước khi loại bỏ vẫn có `password` NULL, và `authController.login`
   chặn đăng nhập thường khi `password` NULL (phải đăng nhập bằng Google).

> **Biến Google là tùy chọn (sửa 23/11/2026):** `passport.js` chỉ đăng ký
> GoogleStrategy khi đủ cả 3 biến `GOOGLE_CLIENT_ID`,
> `GOOGLE_CLIENT_SECRET`, `GOOGLE_CALLBACK_URL`. Thiếu biến nào, server
> vẫn boot bình thường (log cảnh báo `Google login TẮT: thiếu ...`),
> đăng nhập thường (JWT) vẫn chạy, còn route `/api/auth/google` và
> `/api/auth/google/callback` trả `503 "Google login chưa cấu hình"`.
> Đăng nhập Google chỉ chạy thật khi đủ 3 biến **và** đã áp dụng file 002.

## Lưu ý

- Muốn đổi schema sau này thì thêm file `003_*.sql` + cập nhật `migrate.js`
  (hiện chạy `001_init.sql` + `003_add_user_theme.sql`; 002 vẫn chạy tay).
- Xóa user sẽ xóa theo (CASCADE) favorites/history/comments/likes của user đó.
- 2 bug đã sửa ngày 23/11/2026 (rebuild backend): `User.delete` đã được thêm
  vào model (admin xóa user hết lỗi 500); `database.js` chỉ bật SSL khi
  `DB_SSL=true` nên backend nối được MySQL local/XAMPP không SSL.
- `database.js` và `migrate.js` dùng chung biến môi trường (xem bảng trên).
  TiDB Serverless cần `DB_PORT=4000` + `DB_SSL=true`; MySQL local/XAMPP
  dùng `DB_PORT=3306` và không đặt `DB_SSL`.
