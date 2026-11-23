// Route public đếm lượt xem phim (23/11/2026).
// Đặt riêng ở đây (KHÔNG đặt trong adminRoutes.js) vì route đó áp
// verifyToken + verifyAdmin toàn cục, còn POST /api/views là PUBLIC
// (không cần login). Mount trong server.js: app.use('/api/views', ...).
const express = require('express');
const router = express.Router();
const viewsController = require('../controllers/viewsController');

router.post('/', viewsController.recordView);

module.exports = router;
