const express = require('express');
const router = express.Router();
const adminController = require('../controllers/adminController');
const settingsController = require('../controllers/settingsController');
const viewsController = require('../controllers/viewsController');

// Middlewares
const verifyToken = require('../middlewares/authMiddleware');
const { verifyAdmin, verifySuperAdmin } = require('../middlewares/adminMiddleware');

// ÁP DỤNG MIDDLEWARE BẢO VỆ TOÀN BỘ ROUTE ADMIN
router.use(verifyToken, verifyAdmin);

// --- Stats ---
router.get('/stats', adminController.getStats);
router.get('/stats/views', viewsController.getViewsStats);

// --- Settings (player: license/logo/VAST) ---
router.get('/settings', settingsController.getSettings);
router.put('/settings', settingsController.updateSettings);

// --- Users ---
router.get('/users', adminController.getAllUsers);
router.delete('/users/:id', adminController.deleteUser); // Admin thường xóa được User thường

// [SUPER ADMIN ONLY] Nâng quyền & Cấm User
router.put('/users/:id/role', verifySuperAdmin, adminController.updateUserRole);
router.put('/users/:id/ban', verifySuperAdmin, adminController.banUser);

// --- Comments ---
router.get('/comments', adminController.getAllComments);
router.delete('/comments/:id', adminController.deleteComment);

module.exports = router;