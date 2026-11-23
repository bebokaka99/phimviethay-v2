// Admin Settings — cấu hình trình phát (23/11/2026).
// GET /api/admin/settings + PUT /api/admin/settings (route đã qua
// verifyToken + verifyAdmin toàn cục trong adminRoutes.js).
// Settings lưu trong bảng `settings` (migration 004), dạng key/value
// chuỗi, nhóm 'player'. Trả về dạng group: { player: { key: value } }.
const db = require('../config/database');
const { DEFAULT_SETTINGS, validateSettings } = require('../utils/settingsValidation');

// Đọc toàn bộ settings từ DB, gộp với giá trị mặc định (key nào thiếu
// trong DB thì dùng default) rồi nhóm theo setting_group.
async function fetchGroupedSettings() {
    const [rows] = await db.query(
        'SELECT setting_key, setting_value, setting_group FROM settings'
    );
    const flat = { ...DEFAULT_SETTINGS };
    const groups = {};
    for (const row of rows) {
        flat[row.setting_key] = row.setting_value === null ? '' : String(row.setting_value);
        const group = row.setting_group || 'player';
        if (!groups[group]) groups[group] = {};
        groups[group][row.setting_key] = flat[row.setting_key];
    }
    // Key nào có trong DEFAULT nhưng chưa có trong DB: bổ sung vào nhóm player.
    if (!groups.player) groups.player = {};
    for (const [key, value] of Object.entries(DEFAULT_SETTINGS)) {
        if (!(key in groups.player)) groups.player[key] = value;
    }
    return groups;
}

// GET /api/admin/settings -> 200 { player: { ...6 key... } }
exports.getSettings = async (req, res) => {
    try {
        const settings = await fetchGroupedSettings();
        res.json(settings);
    } catch (error) {
        console.error(error);
        res.status(500).json({ message: 'Lỗi lấy cài đặt' });
    }
};

// GET /api/player-key (PUBLIC, không cần login/admin) -> 200 { key: <player_license> }.
// Chỉ trả đúng key player_license, không trả toàn bộ settings.
// Key chưa có trong DB hoặc rỗng -> { key: '' } (200, không lỗi) để
// frontend tự xử lý (fallback/hiển thị lỗi riêng).
exports.getPlayerKey = async (req, res) => {
    try {
        const [rows] = await db.query(
            "SELECT setting_value FROM settings WHERE setting_key = 'player_license' LIMIT 1"
        );
        const key = rows.length && rows[0].setting_value !== null
            ? String(rows[0].setting_value)
            : '';
        res.json({ key });
    } catch (error) {
        console.error(error);
        res.status(500).json({ message: 'Lỗi lấy key trình phát' });
    }
};

// PUT /api/admin/settings
// Body: object phẳng { key: value } chỉ gồm key cần đổi.
// Validate TOÀN BỘ trước (atomic): sai 1 key -> 400, KHÔNG đổi gì.
// Thành công -> 200 kèm settings đã cập nhật, dạng group như GET.
exports.updateSettings = async (req, res) => {
    try {
        const { valid, error, settings } = validateSettings(req.body);
        if (!valid) {
            return res.status(400).json({ message: error });
        }

        for (const [key, value] of Object.entries(settings)) {
            await db.query(
                `INSERT INTO settings (setting_key, setting_value, setting_group)
                 VALUES (?, ?, 'player')
                 ON DUPLICATE KEY UPDATE setting_value = VALUES(setting_value)`,
                [key, value]
            );
        }

        const updated = await fetchGroupedSettings();
        res.json(updated);
    } catch (error) {
        console.error(error);
        res.status(500).json({ message: 'Lỗi cập nhật cài đặt' });
    }
};
