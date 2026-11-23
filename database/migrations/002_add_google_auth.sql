-- ============================================================================
-- PhimVietHay — Migration 002: Khôi phục Google auth cho bảng users
-- ============================================================================
-- CHƯA ÁP DỤNG — chỉ chạy file này khi tích hợp lại Google login.
-- migrate.js MẶC ĐỊNH CHỈ CHẠY 001_init.sql, không tự chạy file này.
--
-- Bối cảnh: 001_init.sql đã TẠM LOẠI BỎ 2 cột google_id + auth_type khỏi
-- bảng users (quyết định 23/11/2026). File này thêm lại đúng 2 cột đó
-- (kèm UNIQUE KEY trên google_id) để đăng nhập Google chạy lại được
-- cùng với code passport.js / authController hiện có.
--
-- Cách chạy (từ gốc repo, database đã migrate 001):
--   mysql -h <HOST> -P <PORT> -u <USER> -p <DB_NAME> < database/migrations/002_add_google_auth.sql
--   Ví dụ local: mysql -h localhost -u root phimviethay < database/migrations/002_add_google_auth.sql
--
-- Chạy lại an toàn: dùng IF NOT EXISTS nên chạy nhiều lần không lỗi
-- (MariaDB 10.5+ / TiDB hỗ trợ. MySQL 8.0 thuần KHÔNG hỗ trợ IF NOT
-- EXISTS cho ADD COLUMN — nếu dùng MySQL 8.0 thì bỏ cụm IF NOT EXISTS
-- đi và chỉ chạy file này 1 lần duy nhất).
-- ============================================================================

-- google_id: id tài khoản Google (passport.js lưu khi login Google).
ALTER TABLE `users`
    ADD COLUMN IF NOT EXISTS `google_id` VARCHAR(255) NULL AFTER `avatar`;

-- auth_type: phân biệt tài khoản đăng ký thường ('local') và Google ('google').
ALTER TABLE `users`
    ADD COLUMN IF NOT EXISTS `auth_type` ENUM('local', 'google') NOT NULL DEFAULT 'local' AFTER `google_id`;

-- 1 google_id chỉ gắn với tối đa 1 tài khoản.
ALTER TABLE `users`
    ADD UNIQUE KEY IF NOT EXISTS `uk_users_google_id` (`google_id`);

-- Ghi nhận đã áp dụng 002 (bảng này do 001_init.sql tạo ra).
INSERT IGNORE INTO `schema_migrations` (`version`) VALUES ('002_add_google_auth');
