-- ============================================================================
-- PhimVietHay — Migration 003: Thêm cột theme (JSON) cho bảng users
-- ============================================================================
-- Bối cảnh: tính năng Cá nhân hóa giao diện (Custom UI, 23/11/2026).
-- Theme của user lưu trong 1 trường JSON `theme`, ví dụ:
--   {"preset":"ocean","accent":"#3b82f6","radius":"medium",
--    "fontSize":"medium","density":"comfortable","hiddenRows":[],
--    "animations":true,"glass":true}
-- NULL = user chưa từng lưu theme -> dùng theme mặc định của web.
-- Web chỉ dark mode nên mọi preset đều là bộ màu tối.
--
-- Cách chạy: migrate.js chạy file này TỰ ĐỘNG sau 001_init.sql
--   (từ thư mục server/):  npm run migrate
--   hoặc chạy tay bằng MySQL client (database đã migrate 001):
--   mysql -h <HOST> -P <PORT> -u <USER> -p <DB_NAME> < database/migrations/003_add_user_theme.sql
--
-- Chạy lại an toàn: dùng IF NOT EXISTS nên chạy nhiều lần không lỗi
-- (MariaDB 10.5+ / TiDB hỗ trợ. MySQL 8.0 thuần KHÔNG hỗ trợ IF NOT
-- EXISTS cho ADD COLUMN — nếu dùng MySQL 8.0 thì bỏ cụm IF NOT EXISTS
-- đi và chỉ chạy file này 1 lần duy nhất, giống 002_add_google_auth.sql).
--
-- Lưu ý kiểu JSON: MySQL 8.0 có kiểu JSON native (validate JSON khi ghi);
-- MariaDB dùng JSON làm bí danh của LONGTEXT (không validate ở DB,
-- backend validate trước khi ghi — xem server/src/utils/themeValidation.js).
-- ============================================================================

-- theme: toàn bộ cài đặt giao diện của user, dạng JSON. NULL = mặc định.
ALTER TABLE `users`
    ADD COLUMN IF NOT EXISTS `theme` JSON NULL AFTER `avatar`;

-- Ghi nhận đã áp dụng 003 (bảng này do 001_init.sql tạo ra).
INSERT IGNORE INTO `schema_migrations` (`version`) VALUES ('003_add_user_theme');
