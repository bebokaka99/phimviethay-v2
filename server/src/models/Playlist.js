const db = require('../config/database');

class Playlist {
    // Lấy danh sách playlist của người dùng kèm số lượng phim và ảnh cover mới nhất
    static async getUserPlaylists(userId) {
        const sql = `
            SELECT 
                p.id, 
                p.user_id, 
                p.title, 
                p.description, 
                p.icon,
                p.is_public, 
                p.created_at, 
                p.updated_at,
                COUNT(pm.id) AS movie_count,
                (
                    SELECT pm2.movie_thumb 
                    FROM playlist_movies pm2 
                    WHERE pm2.playlist_id = p.id 
                    ORDER BY pm2.added_at DESC 
                    LIMIT 1
                ) AS cover_thumb
            FROM playlists p
            LEFT JOIN playlist_movies pm ON p.id = pm.playlist_id
            WHERE p.user_id = ?
            GROUP BY p.id
            ORDER BY p.created_at DESC
        `;
        const [rows] = await db.execute(sql, [userId]);
        return rows;
    }

    // Lấy chi tiết 1 playlist theo ID
    static async getById(id) {
        const [rows] = await db.execute('SELECT * FROM playlists WHERE id = ?', [id]);
        return rows[0] || null;
    }

    // Tạo playlist mới
    static async create(userId, { title, description = '', icon = '🎬', is_public = 1 }) {
        const [result] = await db.execute(
            'INSERT INTO playlists (user_id, title, description, icon, is_public) VALUES (?, ?, ?, ?, ?)',
            [userId, title.trim(), description || null, icon || '🎬', is_public ? 1 : 0]
        );
        return result.insertId;
    }

    // Cập nhật thông tin playlist (tiêu đề, mô tả, quyền riêng tư, icon)
    static async update(id, userId, { title, description, icon, is_public }) {
        const fields = [];
        const values = [];

        if (title !== undefined) {
            fields.push('title = ?');
            values.push(title.trim());
        }
        if (description !== undefined) {
            fields.push('description = ?');
            values.push(description || null);
        }
        if (icon !== undefined) {
            fields.push('icon = ?');
            values.push(icon || '🎬');
        }
        if (is_public !== undefined) {
            fields.push('is_public = ?');
            values.push(is_public ? 1 : 0);
        }

        if (fields.length === 0) return null;
        values.push(id, userId);

        const sql = `UPDATE playlists SET ${fields.join(', ')} WHERE id = ? AND user_id = ?`;
        const [result] = await db.execute(sql, values);
        return result;
    }

    // Xóa playlist (sẽ tự động cascade xóa các phim bên trong playlist_movies)
    static async delete(id, userId) {
        const [result] = await db.execute(
            'DELETE FROM playlists WHERE id = ? AND user_id = ?',
            [id, userId]
        );
        return result;
    }

    // Lấy danh sách phim trong 1 playlist
    static async getMovies(playlistId) {
        const sql = `
            SELECT 
                id, 
                playlist_id, 
                movie_slug, 
                movie_name, 
                movie_thumb, 
                movie_quality, 
                movie_year, 
                episode_current, 
                vote_average, 
                added_at 
            FROM playlist_movies 
            WHERE playlist_id = ? 
            ORDER BY added_at DESC
        `;
        const [rows] = await db.execute(sql, [playlistId]);
        return rows;
    }

    // Thêm phim vào playlist
    static async addMovie(playlistId, movie) {
        const sql = `
            INSERT INTO playlist_movies 
                (playlist_id, movie_slug, movie_name, movie_thumb, movie_quality, movie_year, episode_current, vote_average) 
            VALUES (?, ?, ?, ?, ?, ?, ?, ?)
            ON DUPLICATE KEY UPDATE added_at = CURRENT_TIMESTAMP
        `;
        const [result] = await db.execute(sql, [
            playlistId,
            movie.slug,
            movie.name,
            movie.thumb || null,
            movie.quality || 'HD',
            movie.year || '2024',
            movie.episode_current || 'Full',
            movie.vote_average !== undefined ? movie.vote_average : 0
        ]);
        return result;
    }

    // Xóa phim khỏi playlist
    static async removeMovie(playlistId, movieSlug) {
        const [result] = await db.execute(
            'DELETE FROM playlist_movies WHERE playlist_id = ? AND movie_slug = ?',
            [playlistId, movieSlug]
        );
        return result;
    }

    // Kiểm tra xem phim đã có trong những playlist nào của user
    static async checkMovieInUserPlaylists(userId, movieSlug) {
        const sql = `
            SELECT p.id, p.title 
            FROM playlists p
            INNER JOIN playlist_movies pm ON p.id = pm.playlist_id
            WHERE p.user_id = ? AND pm.movie_slug = ?
        `;
        const [rows] = await db.execute(sql, [userId, movieSlug]);
        return rows.map(r => r.id);
    }

    // Lấy danh sách playlist công khai của 1 user (dùng cho trang cá nhân public)
    static async getPublicPlaylists(userId) {
        const sql = `
            SELECT 
                p.id, 
                p.title, 
                p.description, 
                p.icon,
                p.created_at,
                COUNT(pm.id) AS movie_count,
                (
                    SELECT pm2.movie_thumb 
                    FROM playlist_movies pm2 
                    WHERE pm2.playlist_id = p.id 
                    ORDER BY pm2.added_at DESC 
                    LIMIT 1
                ) AS cover_thumb
            FROM playlists p
            LEFT JOIN playlist_movies pm ON p.id = pm.playlist_id
            WHERE p.user_id = ? AND p.is_public = 1
            GROUP BY p.id
            ORDER BY p.created_at DESC
        `;
        const [rows] = await db.execute(sql, [userId]);
        return rows;
    }
}

module.exports = Playlist;
