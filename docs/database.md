# Database — PhimVietHay

> Engine: MySQL (tương thích MySQL 8.0+ / MariaDB 10.5+ / TiDB).
> Prod: TiDB Cloud, cluster `phimviethay-v2`, region Singapore, database
> `phimviethay`, **bắt buộc `DB_SSL=true`** (TiDB Serverless dùng port 4000).
> Sandbox test: MariaDB local. Charset `utf8mb4` (tiếng Việt + emoji).
> Không có bảng `movies` — bảng cache phim local đã bỏ ngày 23/11/2026
> (frontend gọi thẳng vsmov, backend không lưu phim).

## 1. Migrations — `database/migrations/`

Chạy bằng `database/migrations/migrate.js` (lệnh `npm run migrate` trong
`server/`). Runner **chỉ chạy 001 → 003 → 004** (theo đúng thứ tự này),
ghi nhận từng version vào bảng `schema_migrations`, rồi kiểm chứng: đủ
9 bảng + cột `users.theme` + đủ 6 key settings mặc định. Các câu SQL đều
dùng `CREATE TABLE IF NOT EXISTS` / `ADD COLUMN IF NOT EXISTS` /
`INSERT IGNORE` nên chạy lại an toàn.

| File | Trạng thái | Nội dung |
|---|---|---|
| `001_init.sql` | Đã chạy | Khởi tạo toàn bộ database: 7 bảng `users`, `favorites`, `history`, `comments`, `comment_likes`, `behavior_logs`, `episode_intelligence` + bảng `schema_migrations`. `users` có 10 cột: `id, username, email, password (NULLABLE), fullname, avatar, role ENUM('user','admin','super_admin') DEFAULT 'user', banned_until, created_at, updated_at`. `password` NULLABLE để chứa tài khoản Google cũ (login thường bị chặn khi password NULL). **Không có** `google_id`, `auth_type` — 2 cột này đã bỏ khỏi 001 (xem 002). |
| `002_add_google_auth.sql` | **CHƯA CHẠY** — migrate.js không tự chạy file này | Khôi phục Google auth: thêm `google_id VARCHAR(255) NULL` + `auth_type ENUM('local','google') DEFAULT 'local'` + UNIQUE KEY trên `google_id` cho bảng `users`. Chỉ chạy khi tích hợp lại Google login (kèm cấu hình OAuth + passport). Lưu ý: MySQL 8.0 thuần không hỗ trợ `ADD COLUMN IF NOT EXISTS` — nếu dùng MySQL 8.0 thì bỏ cụm `IF NOT EXISTS` và chỉ chạy 1 lần. |
| `003_add_user_theme.sql` | Đã chạy (nhưng xem lưu ý mục 4) | Thêm cột `theme JSON NULL` vào `users` (sau cột `avatar`). NULL = user chưa lưu theme → dùng mặc định. Lưu toàn bộ cài đặt giao diện, vd `{"preset":"ocean","accent":"#3b82f6","radius":"medium","fontSize":"medium","density":"comfortable","hiddenRows":[],"animations":true,"glass":true}`. MySQL 8.0 có kiểu JSON native (validate khi ghi); MariaDB coi JSON là bí danh LONGTEXT (không validate ở DB — backend validate trước khi ghi, xem `server/src/utils/themeValidation.js`). |
| `004_admin_settings_views.sql` | Đã chạy | Tạo bảng `settings` (key-value) + `movie_views`, seed 6 key player mặc định (xem mục 3). |

## 2. Các bảng + cột chính

| Bảng | Cột chính | Ghi chú |
|---|---|---|
| `users` | `id` INT UNSIGNED AI, `username` (UNIQUE), `email` (UNIQUE), `password` NULL, `fullname` NULL, `avatar` NULL, `theme` JSON NULL (003), `role` ENUM, `banned_until` NULL, `created_at`, `updated_at` | Thêm `google_id` + `auth_type` chỉ khi chạy 002. |
| `favorites` | `id`, `user_id` (FK → users, CASCADE), `movie_slug`, `movie_name`, `movie_thumb`, `movie_quality` DEFAULT 'HD', `movie_year` DEFAULT '2024', `episode_current` DEFAULT 'Full', `vote_average` DECIMAL(4,1) DEFAULT 0, `created_at` | UNIQUE `(user_id, movie_slug)` — `INSERT IGNORE` chống trùng. Dữ liệu phim lấy từ request body, không qua bảng phim. |
| `history` | `id`, `user_id` (FK, CASCADE), `movie_slug`, `episode_slug`, `movie_name`, `movie_thumb`, `episode_name`, `created_at`, `updated_at` | UNIQUE `(user_id, movie_slug)` — `ON DUPLICATE KEY UPDATE` mỗi lần xem. |
| `comments` | `id`, `user_id` (FK, CASCADE), `movie_slug`, `episode_slug` NULL (= bình luận cấp phim), `content` TEXT, `parent_id` NULL (= bình luận gốc; có giá trị = trả lời), `created_at` | `parent_id` FK tự tham chiếu, CASCADE. |
| `comment_likes` | `id`, `user_id`, `comment_id`, `created_at` | UNIQUE `(user_id, comment_id)` — 1 user like 1 comment tối đa 1 lần (toggle). |
| `behavior_logs` | `id` BIGINT UNSIGNED, `movie_slug`, `episode_slug`, `ip_address`, `action_type`, `timestamp_recorded` DECIMAL(12,3) NULL (vị trí phát, giây), `created_at` | Log hành vi player để suy ra intro/credits. Chống spam: tối đa 50 log / IP / phim / tập / ngày. |
| `episode_intelligence` | `id`, `movie_slug`, `episode_slug`, `intro_start` / `intro_end` / `credits_start` DECIMAL(10,3) NULL (giây), `status` DEFAULT 'PENDING', `source` DEFAULT 'SYSTEM', `confidence_score` DEFAULT 0, `sample_count` DEFAULT 0, `created_at`, `updated_at` | Mốc intro/credits từng tập (player hiện nút "Bỏ qua intro"). UNIQUE `(movie_slug, episode_slug)`. |
| `settings` | `setting_key` VARCHAR(100) PK, `setting_value` TEXT NULL, `setting_group` VARCHAR(50) DEFAULT 'player', `description` | Cấu hình key/value, hiện chỉ nhóm `player` (xem mục 3). |
| `movie_views` | `id`, `slug`, `ip_hash` CHAR(64), `user_id` NULL, `viewed_at` | 1 row = 1 lượt xem đã ghi nhận. `ip_hash` = sha256(IP), **không lưu IP thô**. Dedup ở tầng API (30 phút) — xem `backend.md`. |
| `schema_migrations` | `version` PK, `applied_at` | Lịch sử migration đã áp dụng (`001_init`, `003_add_user_theme`, `004_admin_settings_views`; `002_add_google_auth` chỉ có khi chạy tay 002). |

## 3. Bảng `settings` — 6 key player mặc định (seed trong 004)

`INSERT IGNORE` nên chạy lại migration không ghi đè giá trị admin đã đổi.

| Key | Giá trị mặc định | Ý nghĩa |
|---|---|---|
| `player_license` | `ITWMv7t88JGzI0xPwW8I0+LveiXX9SWbfdmt0ArUSyc=` | License key JWPlayer. Key chia sẻ lấy từ seeder repo vsphim-core (user duyệt, chỉ để test, có thể bị thu hồi/khóa domain). Production nên mua license riêng. |
| `player_logo_file` | `''` (rỗng) | URL file logo trên trình phát. Rỗng = không dùng file logo. |
| `player_logo_link` | `''` (rỗng) | Link đích khi bấm logo. Rỗng = logo không bấm được. |
| `player_logo_position` | `top-right` | Vị trí logo: `top-left / top-right / bottom-right / bottom-left / control-bar`. |
| `player_vast_file` | `''` (rỗng) | URL file quảng cáo VAST. Rỗng = không chạy quảng cáo. |
| `player_vast_skipoffset` | `5` | Số giây sau đó cho phép bỏ qua quảng cáo VAST (≥ 0). |

**Chỉ `player_license` hiện thực sự tác dụng lên player** (qua
`GET /api/player-key`). Các key logo/VAST đã có UI chỉnh ở `/admin/player`
nhưng chưa nối vào player — xem `admin.md`.

## 4. Seed tài khoản test — `database/seeds/001_test_users.sql`

**Chỉ dùng để test local, KHÔNG dùng production.** Mật khẩu cả 3 tài khoản:
`Test1234` (đã hash bcrypt, 10 rounds). Chạy sau khi migrate 001, chạy lại
an toàn nhờ `INSERT IGNORE`:

```bash
mysql -h <HOST> -P <PORT> -u <USER> -p <DB_NAME> < database/seeds/001_test_users.sql
```

| Username | Email | Họ tên | Role |
|---|---|---|---|
| `sa_test` | `sa@test.local` | Super Admin Test | `super_admin` |
| `admin_test` | `admin@test.local` | Admin Test | `admin` |
| `user_test` | `user@test.local` | User Test | `user` |

## 5. Quy trình thay đổi database (đã chốt)

Sandbox **không nối được TiDB prod**, Render Shell chỉ có ở gói trả phí, nên:

1. Muse viết code SQL (file migration mới trong `database/migrations/`).
2. User tự chạy SQL đó trên **TiDB Cloud SQL Editor** (nhớ `USE phimviethay;`
   trước khi chạy — đã từng phải thêm tay vì SQL Editor không tự chọn DB).
3. Kiểm chứng bằng cách gọi API liên quan (vd `GET /api/player-key` → 200,
   `GET /api/admin/settings` không token → 401).

Với database local (MariaDB/MySQL), chạy `npm run migrate` trong `server/`
(đọc `server/.env`: `DB_HOST` mặc định `localhost`, `DB_PORT` mặc định 3306,
TiDB dùng 4000; `DB_USER` mặc định `root`; `DB_PASS` / `DB_PASSWORD`;
`DB_NAME` mặc định `phimviethay`; `DB_SSL=true` bắt buộc với TiDB).

## 6. Lưu ý đã biết

- **Cột `theme` trên TiDB prod từng bị thiếu:** migration 003 chạy lúc bảng
  `users` chưa có (thứ tự chạy tay 001→003→004 trên SQL Editor) nên cột
  không được tạo. **Cần chạy lại `003_add_user_theme.sql`** trên TiDB
  (câu `ADD COLUMN IF NOT EXISTS` nên chạy lại an toàn). Dấu hiệu nhận biết:
  `PATCH /api/user/theme` trả 500 "Server chưa migrate cột theme."
- **Chạy migration trên TiDB Cloud SQL Editor:** lần đầu chạy 001→003→004
  theo thứ tự, mỗi file chạy riêng; kiểm tra bảng `schema_migrations` để
  biết version nào đã áp dụng.
- Mật khẩu TiDB + JWT secret cũ từng bị commit lộ trong repo cũ (`.env`
  public) — không sao chép secret cũ sang v2; khi cần thì xoay mới.
