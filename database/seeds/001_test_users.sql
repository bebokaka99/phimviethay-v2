-- Seed: 3 tài khoản test cho PhimVietHay (CHỈ dùng để test local, KHÔNG dùng production).
-- Mật khẩu cho cả 3 tài khoản: Test1234 (đã hash bằng bcrypt, 10 rounds).
--   - sa_test / sa@test.local / Super Admin Test / super_admin
--   - admin_test / admin@test.local / Admin Test / admin
--   - user_test / user@test.local / User Test / user
-- Chạy SAU khi migrate (database/migrations/001_init.sql đã tạo bảng users):
--   mysql -h <HOST> -P <PORT> -u <USER> -p <DB_NAME> < database/seeds/001_test_users.sql
-- Chạy lại an toàn: INSERT IGNORE bỏ qua tài khoản đã có (username/email UNIQUE).
-- Tài khoản Google không có trong seed này (Google auth tạm dừng, xem 002_add_google_auth.sql).

INSERT IGNORE INTO `users` (`username`, `email`, `password`, `fullname`, `role`) VALUES
  ('sa_test', 'sa@test.local', '$2b$10$CBUKypEmAlpwRw5mzr6zFuGWvEDKt5Eo/rytK56ICSbrjFj4N8zqi', 'Super Admin Test', 'super_admin'),
  ('admin_test', 'admin@test.local', '$2b$10$a3g9DQ3nwMIMNAwJ69FzeeR/VE/H0jD7DAUKW/IQgj/yJBrpXbcQS', 'Admin Test', 'admin'),
  ('user_test', 'user@test.local', '$2b$10$xCdyVFgZA/otWJOug2aoA.OvAgQdFEY.vHgAE/eiWIzyKBaGaxeae', 'User Test', 'user');
