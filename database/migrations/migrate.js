/**
 * PhimVietHay — Migration runner (001_init.sql + 003_add_user_theme.sql
 *   + 004_admin_settings_views.sql)
 * ---------------------------------------------------------------
 * Chạy:  npm run migrate        (trong thư mục server/)
 *        node ../database/migrations/migrate.js   (từ thư mục server/)
 *        node database/migrations/migrate.js      (từ gốc repo)
 *
 * Chạy 001_init.sql rồi 003_add_user_theme.sql rồi
 * 004_admin_settings_views.sql (bảng settings + movie_views — Admin
 * Settings + đếm lượt xem, 23/11/2026). File
 * 002_add_google_auth.sql KHÔNG tự chạy — nó chỉ dùng khi tích hợp
 * lại Google login (xem database/README.md).
 *
 * Biến môi trường (đọc từ server/.env nếu có, giống database.js):
 *   DB_HOST       mặc định 'localhost'
 *   DB_PORT       mặc định 3306 (MySQL local). TiDB Serverless: 4000.
 *   DB_USER       mặc định 'root'
 *   DB_PASS       mật khẩu (database.js dùng tên này; DB_PASSWORD cũng được chấp nhận)
 *   DB_NAME       mặc định 'phimviethay'
 *   DB_SSL        'true' để bật SSL (bắt buộc với TiDB Serverless)
 *
 * Hành vi: tạo database nếu chưa có -> chạy lần lượt từng migration
 * (001 rồi 003 rồi 004; CREATE TABLE IF NOT EXISTS / ADD COLUMN IF NOT
 * EXISTS / INSERT IGNORE nên chạy lại an toàn) -> ghi nhận từng version
 * vào bảng schema_migrations -> kiểm tra lại 9 bảng + cột users.theme
 * + đủ 6 key settings mặc định rồi in báo cáo.
 */
const fs = require('fs');
const path = require('path');
// migrate.js nằm ở database/migrations/ (ngoài server/) nên Node không tự
// tìm thấy mysql2/dotenv trong server/node_modules — dùng createRequire
// trỏ về server/package.json để nạp đúng 2 dependency đã có sẵn.
const { createRequire } = require('module');
const serverRequire = createRequire(path.join(__dirname, '..', '..', 'server', 'package.json'));
const mysql = serverRequire('mysql2/promise');

serverRequire('dotenv').config({ path: path.join(__dirname, '..', '..', 'server', '.env') });

// Thứ tự chạy quan trọng: 001 tạo bảng users trước, 003 thêm cột theme
// vào bảng đó sau, 004 tạo bảng settings + movie_views (không phụ thuộc
// bảng nào khác ngoài schema_migrations do 001 tạo). 002 KHÔNG có trong
// danh sách này (Google auth chưa tích hợp lại — chạy tay khi cần,
// xem database/README.md).
const MIGRATIONS = [
    { version: '001_init', file: '001_init.sql' },
    { version: '003_add_user_theme', file: '003_add_user_theme.sql' },
    { version: '004_admin_settings_views', file: '004_admin_settings_views.sql' },
];

// 9 bảng mà code backend đang dùng (đối chiếu trong 001_init.sql + 004).
// Bảng movies đã BỎ (23/11/2026) cùng movieController — xem 001_init.sql.
// Lưu ý: bảng users trong 001_init.sql đã TẠM LOẠI BỎ google_id +
// auth_type (Google auth tích hợp lại sau bằng 002_add_google_auth.sql).
const EXPECTED_TABLES = [
    'users',
    'favorites',
    'history',
    'comments',
    'comment_likes',
    'behavior_logs',
    'episode_intelligence',
    'settings',
    'movie_views',
];

// 6 key settings mặc định nhóm player mà 004 phải seed (INSERT IGNORE).
const EXPECTED_SETTING_KEYS = [
    'player_license',
    'player_logo_file',
    'player_logo_link',
    'player_logo_position',
    'player_vast_file',
    'player_vast_skipoffset',
];

function env(name, fallback) {
    const v = process.env[name];
    return v === undefined || v === '' ? fallback : v;
}

async function main() {
    const host = env('DB_HOST', 'localhost');
    const port = parseInt(env('DB_PORT', '3306'), 10);
    const user = env('DB_USER', 'root');
    // database.js dùng DB_PASS; chấp nhận DB_PASSWORD làm phương án dự phòng.
    const password = env('DB_PASS', env('DB_PASSWORD', ''));
    const database = env('DB_NAME', 'phimviethay');
    const useSsl = env('DB_SSL', 'false').toLowerCase() === 'true';

    console.log(`[migrate] Kết nối MySQL ${host}:${port} (user=${user}, db=${database}, ssl=${useSsl})...`);

    for (const { version, file } of MIGRATIONS) {
        const sqlFile = path.join(__dirname, file);
        if (!fs.existsSync(sqlFile)) {
            console.error(`[migrate] Không tìm thấy file SQL: ${sqlFile}`);
            process.exit(1);
        }
    }

    // Kết nối chưa chọn database để có thể CREATE DATABASE nếu chưa có.
    const conn = await mysql.createConnection({
        host,
        port,
        user,
        password,
        multipleStatements: true,
        ...(useSsl ? { ssl: { minVersion: 'TLSv1.2', rejectUnauthorized: false } } : {}),
    });

    try {
        await conn.query(`CREATE DATABASE IF NOT EXISTS \`${database}\` CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci`);
        await conn.query(`USE \`${database}\``);
        console.log(`[migrate] Database '${database}' đã sẵn sàng.`);

        for (const { version, file } of MIGRATIONS) {
            const sql = fs.readFileSync(path.join(__dirname, file), 'utf8');
            await conn.query(sql);
            console.log(`[migrate] Đã chạy ${version}.sql`);

            await conn.query(
                'INSERT IGNORE INTO `schema_migrations` (`version`) VALUES (?)',
                [version]
            );
        }

        // Kiểm chứng: 9 bảng có đủ + đếm cột mỗi bảng.
        const [rows] = await conn.query(
            `SELECT TABLE_NAME AS t, COUNT(*) AS cols
               FROM INFORMATION_SCHEMA.COLUMNS
              WHERE TABLE_SCHEMA = ?
                AND TABLE_NAME IN (${EXPECTED_TABLES.map(() => '?').join(', ')})
              GROUP BY TABLE_NAME ORDER BY TABLE_NAME`,
            [database, ...EXPECTED_TABLES]
        );
        const found = new Map(rows.map((r) => [r.t, Number(r.cols)]));
        let ok = true;
        for (const table of EXPECTED_TABLES) {
            if (found.has(table)) {
                console.log(`[migrate] ✓ ${table} (${found.get(table)} cột)`);
            } else {
                console.log(`[migrate] ✗ THIẾU bảng ${table}`);
                ok = false;
            }
        }

        if (!ok) {
            console.error('[migrate] Migration chạy nhưng thiếu bảng — kiểm tra lại 001_init.sql');
            process.exit(1);
        }

        // Kiểm chứng thêm: cột users.theme (003) phải tồn tại.
        const [themeCols] = await conn.query(
            `SELECT COLUMN_NAME AS c, DATA_TYPE AS t, IS_NULLABLE AS n
               FROM INFORMATION_SCHEMA.COLUMNS
              WHERE TABLE_SCHEMA = ? AND TABLE_NAME = 'users' AND COLUMN_NAME = 'theme'`,
            [database]
        );
        if (themeCols.length === 1) {
            console.log(`[migrate] ✓ users.theme (${themeCols[0].t}, nullable=${themeCols[0].n})`);
        } else {
            console.log('[migrate] ✗ THIẾU cột users.theme');
            ok = false;
        }

        if (!ok) {
            console.error('[migrate] Migration chạy nhưng thiếu bảng/cột — kiểm tra lại file SQL');
            process.exit(1);
        }
        // Kiểm chứng thêm: bảng settings (004) phải có đủ 6 key mặc định.
        const [settingRows] = await conn.query(
            `SELECT setting_key AS k FROM settings
              WHERE setting_key IN (${EXPECTED_SETTING_KEYS.map(() => '?').join(', ')})`,
            EXPECTED_SETTING_KEYS
        );
        const foundKeys = new Set(settingRows.map((r) => r.k));
        const missingKeys = EXPECTED_SETTING_KEYS.filter((k) => !foundKeys.has(k));
        if (missingKeys.length === 0) {
            console.log('[migrate] ✓ settings: đủ 6 key mặc định nhóm player');
        } else {
            console.log(`[migrate] ✗ THIẾU key settings: ${missingKeys.join(', ')}`);
            ok = false;
        }

        if (!ok) {
            console.error('[migrate] Migration chạy nhưng thiếu key settings — kiểm tra lại 004_admin_settings_views.sql');
            process.exit(1);
        }
        console.log('[migrate] XONG — đủ 9 bảng + cột users.theme + 6 key settings.');
    } finally {
        await conn.end();
    }
}

main().catch((err) => {
    console.error('[migrate] LỖI:', err.message);
    if (err.code === 'ECONNREFUSED') {
        console.error('[migrate] Không kết nối được MySQL. Kiểm tra DB_HOST/DB_PORT và MySQL đã chạy chưa.');
    }
    if (err.code === 'ER_ACCESS_DENIED_ERROR') {
        console.error('[migrate] Sai user/password. Kiểm tra DB_USER/DB_PASS (hoặc DB_PASSWORD).');
    }
    process.exit(1);
});
