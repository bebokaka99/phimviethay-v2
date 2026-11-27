const db = require('../config/database');

// --- THEME (Custom UI, 23/11/2026) ---
// Cột users.theme là JSON, NULL = chưa lưu theme (dùng mặc định).
// MariaDB trả JSON về dạng chuỗi LONGTEXT, MySQL 8.0 có thể trả object
// đã parse sẵn — parseTheme chấp nhận cả hai. Chuỗi hỏng -> null,
// KHÔNG crash (theme hỏng thì dùng mặc định, không chặn login/profile).
function parseTheme(value) {
    if (value === null || value === undefined) return null;
    if (typeof value === 'object') return value;
    if (typeof value === 'string') {
        try {
            const parsed = JSON.parse(value);
            return parsed && typeof parsed === 'object' ? parsed : null;
        } catch (e) {
            return null;
        }
    }
    return null;
}

// Ghi theme: object -> chuỗi JSON; null/undefined -> NULL trong DB.
function stringifyTheme(theme) {
    if (theme === null || theme === undefined) return null;
    return JSON.stringify(theme);
}

// Gắn theme đã parse vào row trả về (row có thể không có cột theme nếu
// DB chưa migrate 003 — khi đó theme = null).
function withParsedTheme(row) {
    if (!row) return row;
    row.theme = parseTheme(row.theme);
    return row;
}

class User {
    // --- CÁC HÀM CŨ (GIỮ NGUYÊN 100% LOGIC) ---

    // Tìm user để Login thường
    static async findByCredentials(identifier) {
        try {
            const [rows] = await db.execute(
                'SELECT * FROM users WHERE email = ? OR username = ?', 
                [identifier, identifier]
            );
            return withParsedTheme(rows[0]);
        } catch (e) { return null; }
    }

    // Kiểm tra tồn tại khi Register thường
    static async checkExist(username, email) {
        try {
            const [rows] = await db.execute(
                'SELECT id FROM users WHERE email = ? OR username = ? limit 1', 
                [email, username]
            );
            return rows[0];
        } catch (e) { return null; }
    }

    // Tạo user thường (Local Register)
    // Lưu ý: schema 001 hiện KHÔNG còn cột auth_type (Google auth tạm bỏ
    // 23/11/2026) nên INSERT không ghi auth_type nữa.
    static async create(username, email, password, fullname) {
        const [result] = await db.execute(
            'INSERT INTO users (username, email, password, fullname) VALUES (?, ?, ?, ?)',
            // mysql2 từ chối bind parameter undefined (nổ lỗi
            // "Bind parameters must not contain undefined") nên chuẩn hóa
            // fullname thiếu thành null (cột fullname NULLABLE) — cùng lỗi
            // từng gặp ở Favorite/History khi thiếu field (đã sửa 23/11).
            [username, email, password, fullname || null]
        );
        return result.insertId;
    }

    // Xóa user (admin). adminController.deleteUser gọi hàm này; trả về
    // kết quả mysql2 (có affectedRows). Xóa user CASCADE favorites/
    // history/comments/likes của user đó (khóa ngoại trong 001_init.sql).
    static async delete(id) {
        const [result] = await db.execute('DELETE FROM users WHERE id = ?', [id]);
        return result;
    }

    static async findById(id) {
        try {
            const [rows] = await db.execute('SELECT id, username, fullname, email, avatar, theme, role, banned_until, banner_url, is_public, exp, current_frame FROM users WHERE id = ?', [id]);
            return withParsedTheme(rows[0]);
        } catch (e) {
            // DB cũ chưa có các cột mới: đọc lại không có cột mới
            if (e && e.code === 'ER_BAD_FIELD_ERROR') {
                const [rows] = await db.execute('SELECT id, username, fullname, email, avatar, role, banned_until FROM users WHERE id = ?', [id]);
                const row = rows[0];
                if (row) {
                    row.theme = null;
                    row.banner_url = null;
                    row.is_public = 1;
                    row.exp = 0;
                    row.current_frame = 'default';
                }
                return row;
            }
            throw e;
        }
    }

    // Lưu theme giao diện của user (PATCH /api/user/theme).
    // theme = object (đã validate ở controller) -> lưu JSON;
    // theme = null -> xóa theme đã lưu (về mặc định).
    static async updateTheme(id, theme) {
        const [result] = await db.execute(
            'UPDATE users SET theme = ? WHERE id = ?',
            [stringifyTheme(theme), id]
        );
        return result;
    }

    static async update(id, data) {
        const fields = [];
        const values = [];
        if (data.fullname) { fields.push('fullname = ?'); values.push(data.fullname); }
        if (data.avatar) { fields.push('avatar = ?'); values.push(data.avatar); }
        if (data.password) { fields.push('password = ?'); values.push(data.password); }
        // Thêm update google_id nếu cần link tài khoản sau này
        if (data.google_id) { fields.push('google_id = ?'); values.push(data.google_id); }
        if (data.auth_type) { fields.push('auth_type = ?'); values.push(data.auth_type); }
        if (Object.prototype.hasOwnProperty.call(data, 'banner_url')) {
            fields.push('banner_url = ?');
            values.push(data.banner_url || null);
        }
        if (Object.prototype.hasOwnProperty.call(data, 'is_public')) {
            fields.push('is_public = ?');
            values.push(data.is_public ? 1 : 0);
        }
        if (Object.prototype.hasOwnProperty.call(data, 'exp')) {
            fields.push('exp = ?');
            values.push(Number(data.exp) || 0);
        }
        if (Object.prototype.hasOwnProperty.call(data, 'current_frame')) {
            fields.push('current_frame = ?');
            values.push(data.current_frame || 'default');
        }
        // Theme: dùng 'theme' in data (không check truthy) để cho phép
        // ghi null (= xóa theme về mặc định). Object -> JSON string.
        if (data && Object.prototype.hasOwnProperty.call(data, 'theme')) {
            fields.push('theme = ?');
            values.push(stringifyTheme(data.theme));
        }

        if (fields.length === 0) return null;
        values.push(id);
        const sql = `UPDATE users SET ${fields.join(', ')} WHERE id = ?`;
        const [result] = await db.execute(sql, values);
        return result;
    }

    static async getAll(page = 1, search = '') {
        // ... (Giữ nguyên logic getAll cũ của bạn)
        const limit = 20;
        const offset = (page - 1) * limit;
        let sql = 'SELECT id, username, email, fullname, role, avatar, banned_until, created_at FROM users';
        const params = [];
        if (search) {
            sql += ' WHERE username LIKE ? OR email LIKE ?';
            params.push(`%${search}%`, `%${search}%`);
        }
        sql += ' ORDER BY created_at DESC LIMIT ? OFFSET ?';
        params.push(String(limit), String(offset));
        const [rows] = await db.execute(sql, params);
        
        let countSql = 'SELECT COUNT(*) as total FROM users';
        let countParams = [];
        if (search) {
             countSql += ' WHERE username LIKE ? OR email LIKE ?';
             countParams.push(`%${search}%`, `%${search}%`);
        }
        const [countRows] = await db.execute(countSql, countParams);
        return { users: rows, total: countRows[0].total };
    }

    // --- CÁC HÀM MỚI (DÀNH CHO GOOGLE LOGIN) ---

    // 1. Tìm user bằng Google ID
    static async findByGoogleId(googleId) {
        try {
            const [rows] = await db.execute('SELECT * FROM users WHERE google_id = ?', [googleId]);
            return withParsedTheme(rows[0]);
        } catch (e) { return null; }
    }

    // 2. Tìm user bằng Email (để link tài khoản nếu email trùng)
    static async findByEmail(email) {
        try {
            const [rows] = await db.execute('SELECT * FROM users WHERE email = ?', [email]);
            return withParsedTheme(rows[0]);
        } catch (e) { return null; }
    }

    // 3. Tạo User mới từ Google (Không cần password)
    static async createSocialUser({ username, email, googleId, avatar, fullname }) {
        try {
            // auth_type = 'google', password để NULL
            const [result] = await db.execute(
                'INSERT INTO users (username, email, google_id, avatar, fullname, auth_type, password) VALUES (?, ?, ?, ?, ?, ?, ?)',
                [username, email, googleId, avatar, fullname, 'google', null]
            );
            return result.insertId;
        } catch (e) {
            console.error("Error creating social user:", e);
            throw e;
        }
    }
}

// Cho phép test/unit dùng lại logic parse (không gọi DB).
User.parseTheme = parseTheme;
User.stringifyTheme = stringifyTheme;

module.exports = User;