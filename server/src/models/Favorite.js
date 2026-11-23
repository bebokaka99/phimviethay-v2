const db = require('../config/database');

class Favorite {
    static async add(userId, movieData) {
        // Nhận đủ các trường dữ liệu mới
        const { slug, name, thumb, quality, year, episode_current, vote_average } = movieData;
        
        // Câu lệnh SQL đã được nâng cấp
        const sql = `
            INSERT IGNORE INTO favorites 
            (user_id, movie_slug, movie_name, movie_thumb, movie_quality, movie_year, episode_current, vote_average) 
            VALUES (?, ?, ?, ?, ?, ?, ?, ?)
        `;
        
        const [result] = await db.execute(sql, [
            userId, 
            slug, 
            name, 
            // mysql2 execute() ném lỗi nếu bind param là undefined — chuẩn
            // hóa về null (cột movie_thumb cho phép NULL). Các trường còn
            // lại đã có mặc định || ở trên.
            thumb || null, 
            quality || 'HD', 
            year || '2024', 
            episode_current || 'Full', 
            vote_average || 0
        ]);
        return result;
    }

    static async remove(userId, movieSlug) {
        const [result] = await db.execute('DELETE FROM favorites WHERE user_id = ? AND movie_slug = ?', [userId, movieSlug]);
        return result;
    }

    static async getList(userId) {
        const [rows] = await db.execute('SELECT * FROM favorites WHERE user_id = ? ORDER BY created_at DESC', [userId]);
        return rows;
    }

    static async check(userId, movieSlug) {
        const [rows] = await db.execute('SELECT id FROM favorites WHERE user_id = ? AND movie_slug = ?', [userId, movieSlug]);
        return rows.length > 0;
    }
}

module.exports = Favorite;