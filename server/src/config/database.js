const mysql = require('mysql2');
require('dotenv').config();

// Cấu hình Connection Pool.
// SSL chỉ bật khi DB_SSL=true (TiDB Serverless bắt buộc SSL); mặc định
// tắt để nối được MySQL local/XAMPP không SSL (sửa 23/11/2026 — trước đây
// ép SSL vô điều kiện nên backend không nối được MySQL local).
// Biến môi trường (đồng bộ với database/migrations/migrate.js):
//   DB_HOST (mặc định 'localhost'), DB_PORT (mặc định 3306; TiDB: 4000),
//   DB_USER (mặc định 'root'), DB_PASS hoặc DB_PASSWORD,
//   DB_NAME (mặc định 'phimviethay'), DB_SSL ('true' để bật SSL).
const useSsl = String(process.env.DB_SSL || 'false').toLowerCase() === 'true';

const pool = mysql.createPool({
    host: process.env.DB_HOST || 'localhost',
    user: process.env.DB_USER || 'root',
    password: process.env.DB_PASS || process.env.DB_PASSWORD || '',
    database: process.env.DB_NAME || 'phimviethay',
    port: process.env.DB_PORT || 3306,

    // Tinh chỉnh tài nguyên: Giảm limit để phù hợp với gói Free
    waitForConnections: true,
    connectionLimit: 5,  // Giảm từ 10 -> 5 (TiDB Free chịu tải tốt hơn ở mức này)
    queueLimit: 50,      // Giới hạn hàng đợi request DB để server Fail-fast thay vì treo

    // Giữ kết nối ổn định trên môi trường Cloud
    enableKeepAlive: true,
    keepAliveInitialDelay: 10000,

    // SSL chỉ bật khi DB_SSL=true (TiDB Serverless bắt buộc).
    ...(useSsl ? {
        ssl: {
            minVersion: 'TLSv1.2',
            rejectUnauthorized: false
        }
    } : {})
});

const db = pool.promise();

// Kiểm tra kết nối 1 lần khi khởi động
pool.getConnection((err, connection) => {
    if (err) {
        console.error('❌ [Database] Kết nối thất bại:', err.message);
    } else {
        console.log('✅ [Database] Kết nối thành công!');
        connection.release();
    }
});

module.exports = db;
