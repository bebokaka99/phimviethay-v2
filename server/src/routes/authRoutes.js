const express = require('express');
const router = express.Router();
const authController = require('../controllers/authController');
const passport = require('passport');
const jwt = require('jsonwebtoken');
const verifyToken = require('../middlewares/authMiddleware'); 

// POST /api/auth/register
router.post('/register', authController.register);

// POST /api/auth/login
router.post('/login', authController.login);

// GOOGLE AUTH
// Google login chỉ bật khi đủ credential (passport.js chỉ đăng ký strategy
// khi đủ GOOGLE_CLIENT_ID/SECRET/CALLBACK_URL). Khi chưa cấu hình, trả 503
// rõ ràng thay vì để passport ném "Unknown authentication strategy".
const requireGoogleAuth = (req, res, next) => {
    if (!passport._strategy('google')) {
        return res.status(503).json({
            success: false,
            message: 'Google login chưa cấu hình. Vui lòng đăng nhập bằng email/mật khẩu.'
        });
    }
    next();
};

router.get('/google', requireGoogleAuth, passport.authenticate('google', { 
    scope: ['profile', 'email'], 
    session: false 
}));

router.get('/google/callback', 
    requireGoogleAuth,
    passport.authenticate('google', { 
        failureRedirect: `${process.env.CLIENT_URL || 'http://localhost:5173'}/login?error=google_failed`, 
        session: false 
    }),
    (req, res) => {
        try {
            const user = req.user;
            const secret = process.env.JWT_SECRET || process.env.ACCESS_TOKEN_SECRET;

            const accessToken = jwt.sign(
                { id: user.id, role: user.role },
                secret,
                { expiresIn: '3d' }
            );

            const refreshToken = jwt.sign(
                { id: user.id },
                process.env.REFRESH_TOKEN_SECRET,
                { expiresIn: '30d' }
            );

            const clientURL = process.env.CLIENT_URL || 'http://localhost:5173';
            res.redirect(`${clientURL}/login?token=${accessToken}&refreshToken=${refreshToken}`);

        } catch (error) {
            console.error("Auth Callback Error:", error);
            res.redirect(`${process.env.CLIENT_URL || 'http://localhost:5173'}/login?error=server_error`);
        }
    }
);

// GET /api/auth/me
router.get('/me', verifyToken, authController.getMe);

module.exports = router;