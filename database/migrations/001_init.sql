-- ============================================================================
-- PhimVietHay — Migration 001: Khởi tạo toàn bộ database
-- ----------------------------------------------------------------------------
-- Nguồn: trích từ code backend (server/src/models + controllers), KHÔNG đoán.
-- Chạy bằng:  npm run migrate   (trong thư mục server/)
--   hoặc:      node database/migrations/migrate.js   (từ gốc repo)
--   hoặc:      node ../database/migrations/migrate.js (từ thư mục server/)
-- Yêu cầu: MySQL 8.0+ / MariaDB 10.5+ / TiDB (tương thích MySQL).
-- Charset utf8mb4 để lưu tiếng Việt + emoji trong bình luận.
-- Thứ tự tạo bảng theo khóa ngoại: users -> favorites/history/
-- comments -> comment_likes -> behavior_logs -> episode_intelligence.
-- Tất cả câu đều dùng CREATE TABLE IF NOT EXISTS nên chạy lại an toàn.
-- ============================================================================

CREATE TABLE IF NOT EXISTS `users` (
    `id` INT UNSIGNED NOT NULL AUTO_INCREMENT,
    `username` VARCHAR(100) NOT NULL,
    `email` VARCHAR(255) NOT NULL,
    -- NULL chỉ còn với tài khoản Google cũ tạo trước khi loại bỏ Google
    -- auth (authController.login chặn login thường khi password NULL).
    -- Google auth TẠM LOẠI BỎ (23/11/2026): 2 cột google_id + auth_type
    -- đã bỏ khỏi schema này. Tích hợp lại sau bằng migration
    -- database/migrations/002_add_google_auth.sql (chưa áp dụng mặc định).
    `password` VARCHAR(255) NULL,
    `fullname` VARCHAR(255) NULL,
    `avatar` VARCHAR(500) NULL,
    -- JWT payload { id, role }; adminMiddleware chỉ cho 'admin'/'super_admin'.
    `role` ENUM('user', 'admin', 'super_admin') NOT NULL DEFAULT 'user',
    -- authController.login chặn nếu banned_until còn trong tương lai.
    `banned_until` DATETIME NULL,
    `created_at` TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
    `updated_at` TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    PRIMARY KEY (`id`),
    UNIQUE KEY `uk_users_username` (`username`),
    UNIQUE KEY `uk_users_email` (`email`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci
COMMENT='Tài khoản đăng ký thường (local). Google login tạm loại bỏ — xem 002_add_google_auth.sql';

-- ----------------------------------------------------------------------------
-- movies: ĐÃ BỎ (23/11/2026). Bảng cache phim local của movieController đã
-- bị xóa cùng controller (code chết cả 2 phía, frontend gọi thẳng vsmov).
-- File 001 gốc còn bảng movies được lưu tại
-- ~/workspace/phimviethay-research/schema-001-with-movies-backup.sql
-- (chỉ để đối chiếu, không dùng để migrate).
-- ----------------------------------------------------------------------------

-- ----------------------------------------------------------------------------
-- favorites: phim yêu thích. Dữ liệu phim lấy TRỰC TIẾP từ request body
-- (userController.addFavorite), KHÔNG qua movieController/bảng movies.
-- ----------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS `favorites` (
    `id` INT UNSIGNED NOT NULL AUTO_INCREMENT,
    `user_id` INT UNSIGNED NOT NULL,
    `movie_slug` VARCHAR(255) NOT NULL,
    `movie_name` VARCHAR(255) NOT NULL,
    `movie_thumb` VARCHAR(500) NULL,
    -- Favorite.add mặc định: quality 'HD', year '2024', episode_current 'Full',
    -- vote_average 0 khi client không gửi.
    `movie_quality` VARCHAR(20) NOT NULL DEFAULT 'HD',
    `movie_year` VARCHAR(10) NOT NULL DEFAULT '2024',
    `episode_current` VARCHAR(50) NOT NULL DEFAULT 'Full',
    `vote_average` DECIMAL(4,1) NOT NULL DEFAULT 0,
    `created_at` TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
    PRIMARY KEY (`id`),
    -- UNIQUE để INSERT IGNORE trong Favorite.add chống trùng yêu thích.
    UNIQUE KEY `uk_favorites_user_movie` (`user_id`, `movie_slug`),
    INDEX `idx_favorites_user` (`user_id`, `created_at`),
    CONSTRAINT `fk_favorites_user` FOREIGN KEY (`user_id`)
        REFERENCES `users` (`id`) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci
COMMENT='Phim yêu thích của user (dữ liệu phim lấy từ request body)';

-- ----------------------------------------------------------------------------
-- history: lịch sử xem (tiếp tục xem). ON DUPLICATE KEY UPDATE trong
-- History.set yêu cầu UNIQUE KEY (user_id, movie_slug).
-- ----------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS `history` (
    `id` INT UNSIGNED NOT NULL AUTO_INCREMENT,
    `user_id` INT UNSIGNED NOT NULL,
    `movie_slug` VARCHAR(255) NOT NULL,
    `episode_slug` VARCHAR(255) NULL,
    `movie_name` VARCHAR(255) NULL,
    `movie_thumb` VARCHAR(500) NULL,
    `episode_name` VARCHAR(255) NULL,
    `created_at` TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
    -- set() ghi updated_at = NOW() mỗi lần xem; getList sắp xếp theo updated_at.
    `updated_at` TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    PRIMARY KEY (`id`),
    UNIQUE KEY `uk_history_user_movie` (`user_id`, `movie_slug`),
    INDEX `idx_history_user_updated` (`user_id`, `updated_at`),
    CONSTRAINT `fk_history_user` FOREIGN KEY (`user_id`)
        REFERENCES `users` (`id`) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci
COMMENT='Lịch sử xem phim của user (xem tới tập nào)';

-- ----------------------------------------------------------------------------
-- comments: bình luận theo phim (+ tập, NULL = bình luận chung của phim)
-- và trả lời lồng nhau qua parent_id.
-- ----------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS `comments` (
    `id` INT UNSIGNED NOT NULL AUTO_INCREMENT,
    `user_id` INT UNSIGNED NOT NULL,
    `movie_slug` VARCHAR(255) NOT NULL,
    -- NULL = bình luận ở cấp phim; getByContext lọc episode_slug IS NULL.
    `episode_slug` VARCHAR(255) NULL,
    `content` TEXT NOT NULL,
    -- NULL = bình luận gốc; có giá trị = trả lời bình luận parent_id.
    `parent_id` INT UNSIGNED NULL,
    `created_at` TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
    PRIMARY KEY (`id`),
    INDEX `idx_comments_movie` (`movie_slug`, `episode_slug`, `created_at`),
    INDEX `idx_comments_user` (`user_id`),
    CONSTRAINT `fk_comments_user` FOREIGN KEY (`user_id`)
        REFERENCES `users` (`id`) ON DELETE CASCADE,
    CONSTRAINT `fk_comments_parent` FOREIGN KEY (`parent_id`)
        REFERENCES `comments` (`id`) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci
COMMENT='Bình luận theo phim/tập, có trả lời lồng nhau';

-- ----------------------------------------------------------------------------
-- comment_likes: lượt thích bình luận (toggleLike: có thì xóa, chưa có thì thêm).
-- ----------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS `comment_likes` (
    `id` INT UNSIGNED NOT NULL AUTO_INCREMENT,
    `user_id` INT UNSIGNED NOT NULL,
    `comment_id` INT UNSIGNED NOT NULL,
    `created_at` TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
    PRIMARY KEY (`id`),
    UNIQUE KEY `uk_comment_likes` (`user_id`, `comment_id`),
    CONSTRAINT `fk_comment_likes_user` FOREIGN KEY (`user_id`)
        REFERENCES `users` (`id`) ON DELETE CASCADE,
    CONSTRAINT `fk_comment_likes_comment` FOREIGN KEY (`comment_id`)
        REFERENCES `comments` (`id`) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci
COMMENT='Like bình luận (1 user like 1 comment tối đa 1 lần)';

-- ----------------------------------------------------------------------------
-- behavior_logs: log hành vi xem của player (để suy ra intro/credits).
-- submitLog chặn spam: tối đa 50 log / IP / phim / tập / ngày.
-- ----------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS `behavior_logs` (
    `id` BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,
    `movie_slug` VARCHAR(255) NOT NULL,
    `episode_slug` VARCHAR(255) NOT NULL,
    `ip_address` VARCHAR(45) NOT NULL,
    `action_type` VARCHAR(50) NOT NULL,
    -- Vị trí phát (giây, có mili-giây) mà player gửi lên.
    `timestamp_recorded` DECIMAL(12,3) NULL,
    -- Spam check dùng created_at > NOW() - INTERVAL 1 DAY.
    `created_at` TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
    PRIMARY KEY (`id`),
    INDEX `idx_behavior_spam` (`ip_address`, `movie_slug`, `episode_slug`, `created_at`),
    INDEX `idx_behavior_movie` (`movie_slug`, `episode_slug`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci
COMMENT='Log hành vi player (phục vụ suy luận intro/credits)';

-- ----------------------------------------------------------------------------
-- episode_intelligence: dữ liệu intro/credits từng tập (player dùng để
-- hiện nút "Bỏ qua intro"). adminForceIntro ghi đè bằng tay (VERIFIED/ADMIN).
-- ----------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS `episode_intelligence` (
    `id` INT UNSIGNED NOT NULL AUTO_INCREMENT,
    `movie_slug` VARCHAR(255) NOT NULL,
    `episode_slug` VARCHAR(255) NOT NULL,
    -- Mốc thời gian tính bằng giây (có mili-giây), NULL = chưa xác định.
    `intro_start` DECIMAL(10,3) NULL,
    `intro_end` DECIMAL(10,3) NULL,
    `credits_start` DECIMAL(10,3) NULL,
    `status` VARCHAR(20) NOT NULL DEFAULT 'PENDING',
    `source` VARCHAR(20) NOT NULL DEFAULT 'SYSTEM',
    `confidence_score` DECIMAL(3,2) NOT NULL DEFAULT 0,
    `sample_count` INT UNSIGNED NOT NULL DEFAULT 0,
    `created_at` TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
    `updated_at` TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    PRIMARY KEY (`id`),
    -- UNIQUE để ON DUPLICATE KEY UPDATE trong adminForceIntro hoạt động.
    UNIQUE KEY `uk_episode_intelligence` (`movie_slug`, `episode_slug`),
    INDEX `idx_episode_movie` (`movie_slug`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci
COMMENT='Mốc intro/credits từng tập (player + admin God Mode)';

-- Bảng ghi nhận migration đã chạy (để migrate.js kiểm tra/báo cáo).
CREATE TABLE IF NOT EXISTS `schema_migrations` (
    `version` VARCHAR(255) NOT NULL,
    `applied_at` TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
    PRIMARY KEY (`version`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci
COMMENT='Lịch sử migration đã áp dụng';
