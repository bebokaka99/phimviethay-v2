# Trang Admin — PhimVietHay

> Route frontend: `/admin/*` (`client/src/routes.jsx`), bọc trong
> `ProtectedRoute requireAdmin` — chỉ `role` là `admin` hoặc `super_admin`
> mới vào được (role khác bị chặn ở frontend; backend chặn lại bằng
> `verifyToken` + `verifyAdmin` trên toàn bộ `/api/admin/*`).
> Trang con: Dashboard (`/admin`), Users (`/admin/users`), Comments
> (`/admin/comments`), Intros (`/admin/intros`), Player (`/admin/player`),
> Views (`/admin/views`).

## 1. Tạo tài khoản admin đầu tiên

Chưa có tài khoản admin nào được tạo trên TiDB prod (tính đến 24/11/2026).
Có 2 cách:

**Cách A — đăng ký qua site rồi nâng quyền bằng SQL (khuyên dùng):**
1. Đăng ký tài khoản thường trên site (trang `/register`).
2. Chạy trên TiDB Cloud SQL Editor (nhớ `USE phimviethay;` trước):

```sql
UPDATE users SET role = 'super_admin' WHERE username = '<tên-tài-khoản>';
```

3. Đăng nhập lại để nhận JWT mới có role `super_admin`.

**Cách B — seed tài khoản test (chỉ local, không dùng production):**
Chạy `database/seeds/001_test_users.sql` — tạo sẵn `sa_test` /
`admin_test` / `user_test`, mật khẩu cả 3 là `Test1234` (xem `database.md`).

Phân quyền: admin thường xem/xóa user thường và bình luận; chỉ
`super_admin` mới được đổi role (`PUT /api/admin/users/:id/role`) và cấm
user (`PUT /api/admin/users/:id/ban`, `banned_until` → login trả 403).

## 2. Trang `/admin/player` — Cài đặt trình phát

File: `client/src/pages/admin/PlayerSettings.jsx`.
API: `GET /api/admin/settings` + `PUT /api/admin/settings` (xem `backend.md`).

Giao diện chỉnh 6 key nhóm `player` trong bảng `settings` (seed mặc định
xem `database.md`):

| Mục trên trang | Key | Ghi chú |
|---|---|---|
| License key JWPlayer | `player_license` | Key chia sẻ lấy từ seeder repo vsphim-core (user duyệt, **chỉ để test**, có thể bị thu hồi/khóa domain). Production nên mua license riêng. |
| Logo (file/link/vị trí) | `player_logo_file`, `player_logo_link`, `player_logo_position` | Có khung minh họa vị trí (góc trên trái/phải, góc dưới trái/phải, thanh trình chiếu). |
| Quảng cáo VAST | `player_vast_file`, `player_vast_skipoffset` | File VAST + số giây cho phép bỏ qua (≥ 0, mặc định 5). |

- Lưu bằng nút Save; báo thành công/lỗi bằng toast (cùng mẫu toast dùng ở
  trang đăng nhập). Validate ở backend là atomic: sai 1 key → 400, không
  đổi key nào.
- **Quan trọng: chỉ `player_license` hiện thực sự tác dụng lên player**
  (player lấy qua `GET /api/player-key` trước khi chạy `origin.js`).
  Các key logo/VAST đã có UI chỉnh nhưng **chưa nối vào player** — đổi
  chúng hiện không làm player thay đổi. Logo đang hiển thị trên player là
  logo PhimVietHay cố định trong code (`client/src/assets/logo.png`),
  32px desktop / 26px mobile, không lấy từ settings.

## 3. Trang `/admin/views` — Thống kê lượt xem

File: `client/src/pages/admin/ViewsStats.jsx`.
API: `GET /api/admin/stats/views` (cần JWT + admin).

Hiển thị 3 thẻ số: lượt xem **hôm nay / 7 ngày / 30 ngày**, và 2 bảng
Top 10 phim (tab chuyển 7 ngày ↔ 30 ngày). Dữ liệu chỉ có `slug` + số
lượt xem — backend không gọi vsmov lấy tên phim nên trang tự map slug
→ tên (chưa xác minh mức độ hiển thị tên đầy đủ trên trang này).

Cách đếm (xem `backend.md`): `POST /api/views` public, dedup cùng IP
(hash sha256, không lưu IP thô) + slug trong 30 phút; `MovieDetail.jsx`
ghi view 1 lần mỗi lần xem phim.

## 4. Các trang admin khác (tóm tắt)

| Trang | API chính | Chức năng |
|---|---|---|
| `/admin` (Dashboard) | `GET /api/admin/stats` | Thống kê tổng quan — chưa xác minh chi tiết các chỉ số hiển thị trong đợt viết docs này. |
| `/admin/users` | `GET /api/admin/users`, `DELETE /api/admin/users/:id`, `PUT /api/admin/users/:id/role`, `PUT /api/admin/users/:id/ban` | Quản lý tài khoản, xóa user, nâng quyền / cấm (2 thao tác sau chỉ `super_admin`). |
| `/admin/comments` | `GET /api/admin/comments`, `DELETE /api/admin/comments/:id` | Quản lý bình luận. |
| `/admin/intros` | `/api/analytics/admin/*` | God Mode intro/credits: xem/sửa/xóa mốc intro từng tập (bảng `episode_intelligence`) — xem `database.md`. |
