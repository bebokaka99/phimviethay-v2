// Route public tách m3u8 từ trang embed vsmov (23/11/2026).
// GET /api/extract-m3u8?embed=<link_embed> -> { m3u8 } hoặc 404 { error }.
// KHÔNG cần login. Mount trong server.js: app.use('/api', ...).
const express = require('express');
const router = express.Router();
const { extractM3u8 } = require('../controllers/extractController');

router.get('/extract-m3u8', extractM3u8);

module.exports = router;
