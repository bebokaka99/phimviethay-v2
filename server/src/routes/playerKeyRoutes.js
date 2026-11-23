// Route public trả key trình phát JWPlayer (23/11/2026, phương án (a)).
// GET /api/player-key -> { key: <player_license> } hoặc { key: '' }.
// KHÔNG cần login, KHÔNG cần admin — để trang test-player (và sau này
// WatchMovie) lấy key mà không bị 401. Chỉ trả đúng key, không trả
// toàn bộ settings. Mount trong server.js: app.use('/api', ...).
const express = require('express');
const router = express.Router();
const { getPlayerKey } = require('../controllers/settingsController');

router.get('/player-key', getPlayerKey);

module.exports = router;
