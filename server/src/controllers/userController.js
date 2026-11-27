const User = require('../models/User');
const Favorite = require('../models/Favorite');
const History = require('../models/History'); 
const bcrypt = require('bcryptjs');
const db = require('../config/database');
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
        const { fullname, password, currentPassword, avatar, banner_url, is_public, current_frame, exp } = req.body;
        const updateData = {};
        
        if (fullname !== undefined) updateData.fullname = fullname;
        if (avatar !== undefined) updateData.avatar = avatar;
        if (banner_url !== undefined) updateData.banner_url = banner_url;
        if (is_public !== undefined) updateData.is_public = is_public ? 1 : 0;
        if (current_frame !== undefined) updateData.current_frame = current_frame;
        if (exp !== undefined) updateData.exp = Number(exp) || 0;
        
        if (password) {
            const [userRows] = await db.execute('SELECT password FROM users WHERE id = ?', [req.user.id]);
            const existingHash = userRows[0]?.password;
            if (existingHash) {
                if (!currentPassword) {
                    return res.status(400).json({ message: 'Vui lòng nhập mật khẩu hiện tại để đổi mật khẩu mới.' });
                }
                const isMatch = await bcrypt.compare(currentPassword, existingHash);
                if (!isMatch) {
                    return res.status(400).json({ message: 'Mật khẩu hiện tại không chính xác!' });
                }
            }
            if (password.length < 6) {
                return res.status(400).json({ message: 'Mật khẩu mới phải có tối thiểu 6 ký tự.' });
            }
            const salt = await bcrypt.genSalt(10);
            updateData.password = await bcrypt.hash(password, salt);
        }
        
        await User.update(req.user.id, updateData);
        
        // Lấy lại info mới nhất để trả về Client cập nhật state
        const updatedUser = await User.findById(req.user.id);
        res.json({ message: 'Cập nhật thành công!', user: updatedUser });
    } catch (error) { 
        console.error('UpdateProfile Error:', error);
        res.status(500).json({ message: error.message || 'Lỗi cập nhật hồ sơ' }); 
    }
};

// [MỚI] Xem hồ sơ công khai của một user khác (phục vụ diễn đàn / chia sẻ)
exports.getPublicProfile = async (req, res) => {
    try {
        const { identifier } = req.params;
        let user = null;
        if (/^\d+$/.test(identifier)) {
            user = await User.findById(Number(identifier));
        } else {
            user = await User.findByCredentials(identifier);
        }

        if (!user) {
            return res.status(404).json({ message: 'Không tìm thấy người dùng' });
        }

        if (!user.is_public) {
            return res.json({
                id: user.id,
                username: user.username,
                avatar: user.avatar,
                is_public: 0,
                message: 'Hồ sơ này đang ở chế độ riêng tư'
            });
        }

        res.json({
            id: user.id,
            username: user.username,
            fullname: user.fullname,
            avatar: user.avatar,
            banner_url: user.banner_url ?? null,
            role: user.role,
            exp: user.exp ?? 0,
            current_frame: user.current_frame ?? 'default',
            is_public: 1,
            created_at: user.created_at
        });
    } catch (error) {
        console.error('GetPublicProfile Error:', error);
        res.status(500).json({ message: 'Lỗi lấy hồ sơ công khai' });
    }
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