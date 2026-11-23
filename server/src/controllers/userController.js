const User = require('../models/User');
const Favorite = require('../models/Favorite');
const History = require('../models/History'); 
const bcrypt = require('bcryptjs');
const { validateTheme } = require('../utils/themeValidation');

// --- FAVORITES ---
exports.getFavorites = async (req, res) => {
    try {
        const list = await Favorite.getList(req.user.id);
        res.json(list);
    } catch (error) { res.status(500).json({ message: 'Lỗi server' }); }
};

exports.addFavorite = async (req, res) => {
    try {
        const { slug, name, thumb, quality, year, episode_current, vote_average } = req.body;
        if (!slug || !name) return res.status(400).json({ message: 'Thiếu thông tin phim' });

        await Favorite.add(req.user.id, { slug, name, thumb, quality, year, episode_current, vote_average });
        res.json({ message: 'Đã thêm vào danh sách', added: true });
    } catch (error) { res.status(500).json({ message: 'Lỗi server' }); }
};

exports.removeFavorite = async (req, res) => {
    try {
        await Favorite.remove(req.user.id, req.params.slug);
        res.json({ message: 'Đã xóa khỏi danh sách', added: false });
    } catch (error) { res.status(500).json({ message: 'Lỗi server' }); }
};

exports.checkFavorite = async (req, res) => {
    try {
        const isFavorite = await Favorite.check(req.user.id, req.params.slug);
        res.json({ isFavorite });
    } catch (error) { res.status(500).json({ message: 'Lỗi server' }); }
};

// --- PROFILE ---
exports.updateProfile = async (req, res) => {
    try {
        const { fullname, password, avatar } = req.body;
        const updateData = {};
        
        if (fullname) updateData.fullname = fullname;
        if (avatar) updateData.avatar = avatar; // Lưu ý: Render không lưu file upload, avatar này phải là link ảnh (từ Cloud)
        
        if (password) {
            const salt = await bcrypt.genSalt(10);
            updateData.password = await bcrypt.hash(password, salt);
        }
        
        await User.update(req.user.id, updateData);
        
        // Lấy lại info mới nhất để trả về Client cập nhật state
        const updatedUser = await User.findById(req.user.id);
        res.json({ message: 'Cập nhật thành công!', user: updatedUser });
    } catch (error) { res.status(500).json({ message: 'Lỗi cập nhật hồ sơ' }); }
};

// --- THEME (Custom UI, 23/11/2026) ---
// PATCH /api/user/theme — lưu theme giao diện của CHÍNH user đang đăng
// nhập (user id lấy từ JWT, không nhận user id từ body nên không sửa
// được theme của người khác). Body: { "theme": {...} }.
// Validate ở server/src/utils/themeValidation.js. Trả về theme đã lưu.
exports.updateTheme = async (req, res) => {
    try {
        const { theme } = req.body || {};
        const result = validateTheme(theme);
        if (!result.valid) {
            return res.status(400).json({ message: result.error });
        }

        await User.updateTheme(req.user.id, result.theme);

        // Đọc lại từ DB để trả về đúng theme đã lưu (đã parse JSON).
        const updatedUser = await User.findById(req.user.id);
        res.json({ message: 'Đã lưu giao diện!', theme: updatedUser ? (updatedUser.theme ?? null) : result.theme });
    } catch (error) {
        console.error('UpdateTheme Error:', error);
        // DB chưa migrate 003 (thiếu cột theme) -> lỗi ER_BAD_FIELD_ERROR.
        if (error && error.code === 'ER_BAD_FIELD_ERROR') {
            return res.status(500).json({ message: 'Server chưa migrate cột theme. Chạy: npm run migrate (trong server/).' });
        }
        res.status(500).json({ message: 'Lỗi lưu giao diện' });
    }
};

// --- HISTORY ---
exports.setHistory = async (req, res) => {
    try {
        const { movieSlug, episodeSlug, movieName, movieThumb, episodeName } = req.body;
        if (!movieSlug) return res.status(400).json({ message: 'Thiếu slug' });

        await History.set(req.user.id, { movieSlug, episodeSlug, movieName, movieThumb, episodeName });
        res.json({ message: 'Saved' });
    } catch (error) { res.status(500).json({ message: 'Error saving history' }); }
};

exports.getHistory = async (req, res) => {
    try {
        const list = await History.getList(req.user.id);
        res.json(list);
    } catch (error) { res.status(500).json({ message: 'Error fetching history' }); }
};

exports.clearHistory = async (req, res) => {
    try {
        await History.clear(req.user.id);
        res.json({ message: 'Cleared' });
    } catch (error) { res.status(500).json({ message: 'Error clearing history' }); }
};

exports.removeHistoryItem = async (req, res) => {
    try {
        await History.remove(req.user.id, req.params.slug);
        res.json({ message: 'Removed' });
    } catch (error) { res.status(500).json({ message: 'Error removing item' }); }
};