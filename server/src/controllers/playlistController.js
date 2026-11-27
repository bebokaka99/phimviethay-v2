const Playlist = require('../models/Playlist');
const Favorite = require('../models/Favorite');

// 1. Lấy tất cả playlist của người dùng hiện tại
exports.getPlaylists = async (req, res) => {
    try {
        const playlists = await Playlist.getUserPlaylists(req.user.id);
        res.json(playlists);
    } catch (error) {
        console.error('getPlaylists Error:', error);
        res.status(500).json({ message: 'Lỗi lấy danh sách playlist' });
    }
};

// 2. Tạo playlist mới
exports.createPlaylist = async (req, res) => {
    try {
        const { title, description, is_public } = req.body;
        if (!title || !title.trim()) {
            return res.status(400).json({ message: 'Tên danh sách không được để trống' });
        }

        const newId = await Playlist.create(req.user.id, {
            title: title.trim(),
            description: description || '',
            is_public: is_public !== undefined ? is_public : 1
        });

        const created = await Playlist.getById(newId);
        res.status(201).json({
            message: 'Tạo danh sách thành công!',
            playlist: {
                ...created,
                movie_count: 0,
                cover_thumb: null
            }
        });
    } catch (error) {
        console.error('createPlaylist Error:', error);
        res.status(500).json({ message: 'Lỗi tạo playlist' });
    }
};

// 3. Cập nhật thông tin playlist
exports.updatePlaylist = async (req, res) => {
    try {
        const { id } = req.params;
        const { title, description, is_public } = req.body;

        const existing = await Playlist.getById(id);
        if (!existing) {
            return res.status(404).json({ message: 'Không tìm thấy danh sách' });
        }
        if (existing.user_id !== req.user.id) {
            return res.status(403).json({ message: 'Bạn không có quyền chỉnh sửa danh sách này' });
        }

        await Playlist.update(id, req.user.id, { title, description, is_public });
        const updated = await Playlist.getById(id);
        res.json({ message: 'Cập nhật danh sách thành công!', playlist: updated });
    } catch (error) {
        console.error('updatePlaylist Error:', error);
        res.status(500).json({ message: 'Lỗi cập nhật playlist' });
    }
};

// 4. Xóa playlist
exports.deletePlaylist = async (req, res) => {
    try {
        const { id } = req.params;
        const existing = await Playlist.getById(id);
        if (!existing) {
            return res.status(404).json({ message: 'Không tìm thấy danh sách' });
        }
        if (existing.user_id !== req.user.id) {
            return res.status(403).json({ message: 'Bạn không có quyền xóa danh sách này' });
        }

        await Playlist.delete(id, req.user.id);
        res.json({ message: 'Đã xóa danh sách thành công!' });
    } catch (error) {
        console.error('deletePlaylist Error:', error);
        res.status(500).json({ message: 'Lỗi xóa playlist' });
    }
};

// 5. Lấy danh sách phim trong 1 playlist
exports.getPlaylistMovies = async (req, res) => {
    try {
        const { id } = req.params;
        const playlist = await Playlist.getById(id);
        if (!playlist) {
            return res.status(404).json({ message: 'Không tìm thấy danh sách' });
        }

        // Nếu playlist là riêng tư và không phải của chính user đang xem
        if (!playlist.is_public && (!req.user || req.user.id !== playlist.user_id)) {
            return res.status(403).json({ message: 'Danh sách này ở chế độ riêng tư' });
        }

        const movies = await Playlist.getMovies(id);
        res.json({
            playlist,
            movies
        });
    } catch (error) {
        console.error('getPlaylistMovies Error:', error);
        res.status(500).json({ message: 'Lỗi lấy phim trong playlist' });
    }
};

// 6. Thêm phim vào playlist
exports.addMovieToPlaylist = async (req, res) => {
    try {
        const { id } = req.params;
        const { slug, name, thumb, quality, year, episode_current, vote_average } = req.body;

        if (!slug || !name) {
            return res.status(400).json({ message: 'Thiếu thông tin phim' });
        }

        const playlist = await Playlist.getById(id);
        if (!playlist) {
            return res.status(404).json({ message: 'Không tìm thấy danh sách' });
        }
        if (playlist.user_id !== req.user.id) {
            return res.status(403).json({ message: 'Bạn không sở hữu danh sách này' });
        }

        await Playlist.addMovie(id, { slug, name, thumb, quality, year, episode_current, vote_average });
        res.json({ message: `Đã lưu "${name}" vào danh sách "${playlist.title}"`, added: true });
    } catch (error) {
        console.error('addMovieToPlaylist Error:', error);
        res.status(500).json({ message: 'Lỗi thêm phim vào playlist' });
    }
};

// 7. Xóa phim khỏi playlist
exports.removeMovieFromPlaylist = async (req, res) => {
    try {
        const { id, slug } = req.params;

        const playlist = await Playlist.getById(id);
        if (!playlist) {
            return res.status(404).json({ message: 'Không tìm thấy danh sách' });
        }
        if (playlist.user_id !== req.user.id) {
            return res.status(403).json({ message: 'Bạn không sở hữu danh sách này' });
        }

        await Playlist.removeMovie(id, slug);
        res.json({ message: `Đã gỡ phim khỏi danh sách "${playlist.title}"`, removed: true });
    } catch (error) {
        console.error('removeMovieFromPlaylist Error:', error);
        res.status(500).json({ message: 'Lỗi gỡ phim khỏi playlist' });
    }
};

// 8. Kiểm tra trạng thái phim trong tất cả danh sách của user (cho Popup Lưu phim)
exports.checkMovieInPlaylists = async (req, res) => {
    try {
        const { slug } = req.params;
        if (!slug) return res.status(400).json({ message: 'Thiếu slug phim' });

        // Kiểm tra trong bảng favorites
        const inFavorites = await Favorite.check(req.user.id, slug);

        // Kiểm tra trong các playlist tùy chỉnh
        const inPlaylists = await Playlist.checkMovieInUserPlaylists(req.user.id, slug);

        res.json({
            inFavorites: Boolean(inFavorites),
            inPlaylists // Mảng các playlist_id đang chứa phim này
        });
    } catch (error) {
        console.error('checkMovieInPlaylists Error:', error);
        res.status(500).json({ message: 'Lỗi kiểm tra danh sách' });
    }
};

// 9. Lấy danh sách playlist công khai của 1 người dùng (cho trang cá nhân public)
exports.getPublicUserPlaylists = async (req, res) => {
    try {
        const { userId } = req.params;
        const playlists = await Playlist.getPublicPlaylists(userId);
        res.json(playlists);
    } catch (error) {
        console.error('getPublicUserPlaylists Error:', error);
        res.status(500).json({ message: 'Lỗi lấy danh sách công khai' });
    }
};
