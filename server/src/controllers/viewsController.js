// Đếm lượt xem phim — POST /api/views (public) + thống kê admin
// GET /api/admin/stats/views (23/11/2026).
//
// - POST /api/views: body { slug }. Không cần login. Lưu vào bảng
//   `movie_views` (migration 004): slug + ip_hash (sha256 của IP,
//   KHÔNG lưu IP thô) + user_id (từ JWT nếu có token hợp lệ, không
//   thì NULL) + viewed_at. Chống spam: cùng ip_hash + slug trong
//   30 phút qua chỉ ghi 1 row. Luôn trả 200:
//   { recorded: true } nếu vừa ghi, { recorded: false } nếu trùng dedup.
// - GET /api/admin/stats/views: hôm nay / 7 ngày / 30 ngày + top 10
//   phim mỗi loại (chỉ slug + views — backend KHÔNG gọi vsmov để
//   lấy tên phim, frontend tự map slug -> tên).
const crypto = require('crypto');
const jwt = require('jsonwebtoken');
const db = require('../config/database');

// IP client: ưu tiên X-Forwarded-For (phần tử đầu) rồi mới req.ip.
// Server đã set trust proxy nên req.ip cũng đã tôn trọng header này;
// lấy trực tiếp ở đây cho rõ ràng và đúng spec.
function getClientIp(req) {
    const forwarded = req.headers['x-forwarded-for'];
    if (typeof forwarded === 'string' && forwarded.trim() !== '') {
        return forwarded.split(',')[0].trim();
    }
    if (Array.isArray(forwarded) && forwarded.length > 0) {
        return String(forwarded[0]).split(',')[0].trim();
    }
    return req.ip || (req.socket && req.socket.remoteAddress) || 'unknown';
}

// user_id từ JWT nếu client gửi token hợp lệ; token thiếu/sai/hết hạn
// thì NULL (đây là route public, không bắt buộc login).
function getOptionalUserId(req) {
    const authHeader = req.headers['authorization'];
    const token = authHeader && authHeader.split(' ')[1];
    const secret = process.env.JWT_SECRET;
    if (!token || !secret) return null;
    try {
        const decoded = jwt.verify(token, secret);
        return typeof decoded.id === 'number' ? decoded.id : null;
    } catch {
        return null;
    }
}

// POST /api/views
exports.recordView = async (req, res) => {
    try {
        const slug = typeof req.body?.slug === 'string' ? req.body.slug.trim() : '';
        if (!slug) {
            return res.status(400).json({ message: 'Thiếu slug phim.' });
        }

        const ipHash = crypto.createHash('sha256').update(getClientIp(req)).digest('hex');
        const userId = getOptionalUserId(req);

        // Chống spam: đã có row cùng ip_hash + slug trong 30 phút qua?
        const [existing] = await db.query(
            `SELECT id FROM movie_views
              WHERE ip_hash = ? AND slug = ?
                AND viewed_at >= NOW() - INTERVAL 30 MINUTE
              LIMIT 1`,
            [ipHash, slug]
        );
        if (existing.length > 0) {
            return res.json({ recorded: false });
        }

        await db.query(
            'INSERT INTO movie_views (slug, ip_hash, user_id) VALUES (?, ?, ?)',
            [slug, ipHash, userId]
        );
        res.json({ recorded: true });
    } catch (error) {
        console.error(error);
        res.status(500).json({ message: 'Lỗi ghi lượt xem' });
    }
};

// GET /api/admin/stats/views (admin)
exports.getViewsStats = async (req, res) => {
    try {
        const [[todayRow]] = await db.query(
            'SELECT COUNT(*) as count FROM movie_views WHERE viewed_at >= CURDATE()'
        );
        const [[last7Row]] = await db.query(
            'SELECT COUNT(*) as count FROM movie_views WHERE viewed_at >= NOW() - INTERVAL 7 DAY'
        );
        const [[last30Row]] = await db.query(
            'SELECT COUNT(*) as count FROM movie_views WHERE viewed_at >= NOW() - INTERVAL 30 DAY'
        );
        const [top7] = await db.query(
            `SELECT slug, COUNT(*) as views FROM movie_views
              WHERE viewed_at >= NOW() - INTERVAL 7 DAY
              GROUP BY slug ORDER BY views DESC, slug ASC LIMIT 10`
        );
        const [top30] = await db.query(
            `SELECT slug, COUNT(*) as views FROM movie_views
              WHERE viewed_at >= NOW() - INTERVAL 30 DAY
              GROUP BY slug ORDER BY views DESC, slug ASC LIMIT 10`
        );

        res.json({
            today: Number(todayRow.count),
            last7Days: Number(last7Row.count),
            last30Days: Number(last30Row.count),
            top7Days: top7.map((r) => ({ slug: r.slug, views: Number(r.views) })),
            top30Days: top30.map((r) => ({ slug: r.slug, views: Number(r.views) })),
        });
    } catch (error) {
        console.error(error);
        res.status(500).json({ message: 'Lỗi lấy thống kê lượt xem' });
    }
};
