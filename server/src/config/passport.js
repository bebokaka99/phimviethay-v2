const passport = require('passport');
const GoogleStrategy = require('passport-google-oauth20').Strategy;
const User = require('../models/User');

// Google login CHỈ bật khi đủ credential (sửa 23/11/2026 — trước đây
// khởi tạo GoogleStrategy vô điều kiện nên thiếu GOOGLE_CLIENT_ID là
// passport ném lỗi và server crash lúc boot). Khi thiếu, server vẫn boot
// bình thường, đăng nhập thường (JWT) vẫn chạy; route /api/auth/google
// trả 503 "Google login chưa cấu hình" (xem authRoutes.js).
const googleMissing = ['GOOGLE_CLIENT_ID', 'GOOGLE_CLIENT_SECRET', 'GOOGLE_CALLBACK_URL']
  .filter((name) => !process.env[name]);

if (googleMissing.length === 0) {
  passport.use(new GoogleStrategy({
    clientID: process.env.GOOGLE_CLIENT_ID,
    clientSecret: process.env.GOOGLE_CLIENT_SECRET,
    callbackURL: process.env.GOOGLE_CALLBACK_URL
  },
  async (accessToken, refreshToken, profile, done) => {
    try {
      // Log để debug xem Google trả về gì (xóa sau khi chạy ổn)
      // console.log("Google Profile:", profile);

      // 1. Tìm xem user có google_id này chưa
      let user = await User.findByGoogleId(profile.id);

      if (user) {
        // Đã có -> Cho qua
        return done(null, user);
      }

      // 2. Nếu chưa có google_id, tìm xem có email trùng không
      // (Trường hợp user đã đăng ký bằng email này trước đó rồi)
      if (profile.emails && profile.emails.length > 0) {
          user = await User.findByEmail(profile.emails[0].value);
      }

      if (user) {
        // Tìm thấy email -> Cập nhật google_id vào user cũ để lần sau đăng nhập nhanh
        await User.update(user.id, { 
            google_id: profile.id,
            // Có thể update thêm avatar nếu muốn: avatar: profile.photos[0]?.value 
        });
        // Lấy lại thông tin mới nhất
        user = await User.findById(user.id);
        return done(null, user);
      }

      // 3. Chưa có gì cả -> Tạo user mới hoàn toàn
      const newUserId = await User.createSocialUser({
        username: profile.displayName, 
        email: profile.emails[0].value,
        googleId: profile.id,
        fullname: profile.displayName,
        avatar: profile.photos[0]?.value
      });

      const newUser = await User.findById(newUserId);
      return done(null, newUser);

    } catch (error) {
      console.error("Passport Error:", error);
      return done(error, false);
    }
  }
  ));
  console.log('✅ [Auth] Google login đã bật (GoogleStrategy đã đăng ký).');
} else {
  // Thiếu credential -> Google login TẮT, server vẫn boot bình thường.
  // Đăng nhập Google chỉ chạy khi đủ 3 biến + đã áp dụng
  // database/migrations/002_add_google_auth.sql (khôi phục cột google_id/auth_type).
  console.warn(`⚠️  [Auth] Google login TẮT: thiếu ${googleMissing.join(', ')} — server vẫn boot bình thường, đăng nhập thường (JWT) vẫn chạy.`);
}

module.exports = passport;