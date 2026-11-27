const express = require('express');
const router = express.Router();
const playlistController = require('../controllers/playlistController');
const verifyToken = require('../middlewares/authMiddleware');

// Lấy danh sách playlist của user
router.get('/', verifyToken, playlistController.getPlaylists);

// Tạo playlist mới
router.post('/', verifyToken, playlistController.createPlaylist);

// Cập nhật thông tin playlist
router.put('/:id', verifyToken, playlistController.updatePlaylist);

// Xóa playlist
router.delete('/:id', verifyToken, playlistController.deletePlaylist);

// Lấy danh sách phim trong 1 playlist
router.get('/:id/movies', verifyToken, playlistController.getPlaylistMovies);

// Thêm phim vào playlist
router.post('/:id/movies', verifyToken, playlistController.addMovieToPlaylist);

// Gỡ phim khỏi playlist
router.delete('/:id/movies/:slug', verifyToken, playlistController.removeMovieFromPlaylist);

// Kiểm tra trạng thái phim trong tất cả playlist của user (phục vụ checklist modal)
router.get('/check/:slug', verifyToken, playlistController.checkMovieInPlaylists);

// Lấy danh sách playlist công khai của user khác (không bắt buộc auth)
router.get('/public/:userId', playlistController.getPublicUserPlaylists);

module.exports = router;
