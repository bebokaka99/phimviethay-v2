-- ============================================================================
-- PhimVietHay — Migration 004: Bảng settings + bảng movie_views
-- ============================================================================
-- Bối cảnh: tính năng Admin Settings + đếm lượt xem phim (23/11/2026).
--   - settings: cấu hình trình phát (player) do admin chỉnh: license
--     JWPlayer/vsphim, logo (file/link/vị trí), quảng cáo VAST
--     (file + skip offset). Lưu dạng key/value chuỗi để frontend lấy
--     1 lần khi khởi tạo player, không cần gọi vsmov.
--   - movie_views: đếm lượt xem theo slug phim, chống spam bằng hash IP
--     (chỉ lưu sha256 của IP, KHÔNG lưu IP thô). Dùng cho thống kê
--     /api/admin/stats/views (hôm nay / 7 ngày / 30 ngày + top 10).
--
-- Cách chạy: migrate.js chạy file này TỰ ĐỘNG sau 001 + 003
--   (từ thư mục server/):  npm run migrate
--   hoặc chạy tay bằng MySQL client (database đã migrate 001 + 003):
--   mysql -h <HOST> -P <PORT> -u <USER> -p <DB_NAME> < database/migrations/004_admin_settings_views.sql
--
-- Chạy lại an toàn: CREATE TABLE IF NOT EXISTS + INSERT IGNORE nên
-- chạy nhiều lần không lỗi và KHÔNG ghi đè giá trị admin đã đổi
-- (INSERT IGNORE chỉ thêm key chưa có, key đã có giữ nguyên).
--
-- Lưu ý: KHÔNG có bảng movies (đã bỏ 23/11/2026) — movie_views chỉ lưu
-- slug (VARCHAR), backend KHÔNG gọi vsmov để lấy tên phim.
-- ============================================================================

-- ----------------------------------------------------------------------------
-- settings: cấu hình key/value. setting_group để nhóm khi trả về API
-- (hiện chỉ có nhóm 'player'; thêm nhóm mới sau này không cần đổi schema).
-- ----------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS `settings` (
    `setting_key` VARCHAR(100) NOT NULL,
    `setting_value` TEXT NULL,
    `setting_group` VARCHAR(50) NOT NULL DEFAULT 'player',
    `description` VARCHAR(255) NULL,
    PRIMARY KEY (`setting_key`),
    INDEX `idx_settings_group` (`setting_group`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci
COMMENT='Cấu hình hệ thống dạng key/value (nhóm player: license/logo/VAST)';

-- Seed mặc định 6 key nhóm player. INSERT IGNORE: chạy lại không ghi đè
-- giá trị admin đã đổi (chỉ thêm key nào chưa có).
INSERT IGNORE INTO `settings` (`setting_key`, `setting_value`, `setting_group`, `description`) VALUES
    ('player_license', 'ITWMv7t88JGzI0xPwW8I0+LveiXX9SWbfdmt0ArUSyc=', 'player', 'License key JWPlayer (key chia sẻ lấy từ repo vsphim-core; production nên mua license riêng hoặc dùng hls.js).'),
    ('player_logo_file', '', 'player', 'URL file logo hiển thị trên trình phát (http/https). Rỗng = không dùng file logo.'),
    ('player_logo_link', '', 'player', 'Link đích khi bấm vào logo trên trình phát (http/https). Rỗng = logo không bấm được.'),
    ('player_logo_position', 'top-right', 'player', 'Vị trí logo: top-left, top-right, bottom-right, bottom-left, control-bar.'),
    ('player_vast_file', '', 'player', 'URL file quảng cáo VAST (http/https). Rỗng = không chạy quảng cáo.'),
    ('player_vast_skipoffset', '5', 'player', 'Số giây sau đó cho phép bỏ qua quảng cáo VAST (>= 0).');

-- ----------------------------------------------------------------------------
-- movie_views: 1 row = 1 lượt xem đã ghi nhận. Chống spam ở tầng API:
-- cùng ip_hash + slug trong 30 phút chỉ ghi 1 row (xem
-- server/src/controllers/viewsController.js).
-- ----------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS `movie_views` (
    `id` INT NOT NULL AUTO_INCREMENT,
    `slug` VARCHAR(255) NOT NULL,
    `ip_hash` CHAR(64) NOT NULL,
    `user_id` INT NULL,
    `viewed_at` DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    PRIMARY KEY (`id`),
    INDEX `idx_slug_time` (`slug`, `viewed_at`),
    INDEX `idx_ip_slug` (`ip_hash`, `slug`, `viewed_at`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci
COMMENT='Lượt xem phim (chỉ slug + sha256 IP + user_id nếu đăng nhập)';

-- Ghi nhận đã áp dụng 004 (bảng này do 001_init.sql tạo ra).
INSERT IGNORE INTO `schema_migrations` (`version`) VALUES ('004_admin_settings_views');
