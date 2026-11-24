# PhimVietHay — Web xem phim tiếng Việt

Web xem phim trực tuyến: giao diện dark mode, dữ liệu phim lấy trực tiếp từ
API vsmov, trình phát dùng code player của vsmov (copy nguyên) + JWPlayer
8.9.3 của mình. Backend chỉ lo auth/tài khoản/admin/cài đặt/đếm lượt xem và
tách link m3u8 + phụ đề từ trang embed vsmov.

- Repo GitHub: https://github.com/bebokaka99/phimviethay-v2
- Local HEAD tại thời điểm viết doc này: `bb83671`
- Deploy thật: Cloudflare Pages (client) + Render (server) + TiDB Cloud (DB).
  Xem [docs/setup.md](docs/setup.md).

> Lưu ý: README cũ của repo (trước bản này) ghi sai nhiều chỗ — Google
> login chưa chạy, không có server phim dự phòng, không deploy Vercel.
> Bản README này viết lại theo code thật trong repo (đọc ngày 24/11/2026).

## Tính năng chính

- **Trang chủ**: hero + các hàng phim (phim lẻ mới, phim bộ hot, hành động,
  tình cảm, Hàn Quốc, Trung Quốc, hoạt hình/anime). Slug các hàng tập trung
  ở `client/src/config/menuRows.js`.
- **Tìm kiếm**: ô tìm kiếm ở header, phím tắt `Ctrl+K` / `Cmd+K`, debounce
  500ms (`client/src/hooks/useDebounce.js`), gợi ý kết quả + tổng số phim.
- **Danh sách / Thể loại / Quốc gia**: `/danh-sach/:slug`, `/the-loai/:slug`,
  `/quoc-gia/:slug`. Menu thể loại + quốc gia lấy động từ API vsmov
  (`GET /the-loai`, `GET /quoc-gia`); số lượng mục thay đổi theo dữ liệu
  nguồn — con số "45 thể loại, 187 quốc gia" chưa xác minh lại từ API
  (xem cuối file).
- **Chi tiết phim** (`/phim/:slug`): thông tin phim, danh sách tập theo
  server, bình luận, nút yêu thích.
- **Xem phim** (`/xem-phim/:slug`): player copy code vsmov + JWPlayer 8.9.3,
  phụ đề .vtt tiếng Việt (mặc định) + tiếng Anh, chọn tập, cỡ chữ phụ đề
  35/30/25/20. Vị trí phụ đề theo player gốc vsmov: bottom 14% desktop,
  16% mobile, 12% fullscreen, cố định không nhảy khi ẩn/hiện control bar.
- **Tài khoản**: đăng ký/đăng nhập bằng JWT, hồ sơ + đổi avatar, yêu thích
  (`/tu-phim`), lịch sử xem (`/lich-su`), bình luận + trả lời lồng nhau.
  Đăng nhập sai hiện toast: "Sai tài khoản hoặc mật khẩu, vui lòng kiểm
  tra lại". **Google login CHƯA chạy** (trả 503, nút Google đang comment
  out) — cần migration 002 + OAuth, xem [docs/setup.md](docs/setup.md).
- **Cá nhân hóa giao diện** (mục "Giao diện" trong Hồ sơ): 6 preset tối
  (crimson `#E50914`, ocean `#3B82F6`, violet `#8B5CF6`, emerald `#10B981`,
  amber `#F59E0B`, rose `#EC4899`) + màu accent tự chọn, bo góc, cỡ chữ,
  mật độ, ẩn/hiện hàng trang chủ, hiệu ứng. Lưu theo tài khoản
  (`users.theme` JSON, `PATCH /api/user/theme`). Chỉ dark mode.
- **Admin** (`/admin`): dashboard, quản lý user/bình luận, cài đặt player
  (`/admin/player`), thống kê lượt xem (`/admin/views`). Xem
  [docs/architecture.md](docs/architecture.md).
- **Trang Giới thiệu** (`/gioi-thieu`) + footer có disclaimer.
- **Xem chung (Watch Party)**: có sẵn trang `/watch-party` và
  `/watch-party/:roomId` + Socket.IO ở cả 2 phía — mức độ hoàn thiện của
  tính năng này chưa xác minh (chưa test luồng thật).

## Stack

| Phần | Công nghệ |
| :--- | :--- |
| Frontend (`client/`) | React 19.2 + Vite (rolldown-vite 7.2.5) + Tailwind CSS 3.4, React Router 7.9, axios, Swiper, PWA (`vite-plugin-pwa`) |
| Backend (`server/`) | Node.js + Express 5.1, mysql2, JWT (`jsonwebtoken`), bcryptjs, Passport (Google OAuth — chưa bật), Socket.IO, helmet / rate-limit / hpp |
| Database | MySQL tương thích — TiDB Cloud (prod), MariaDB (test sandbox) |
| Player | Code player vsmov copy nguyên (`client/public/jwplayer/origin.js` v62 + `player.css` + `broadcast-player.css`) + JWPlayer 8.9.3 (`jwplayer-8.9.3.js`) + key từ `GET /api/player-key` |
| Deploy | Cloudflare Pages (client) + Render (server, Node 24) + TiDB Cloud |

## Chạy local

Yêu cầu: Node.js 20+ (theo `HUONG-DAN.md`; chưa xác minh phiên bản tối
thiểu chính xác — Node 24 đang dùng trên Render), MySQL/MariaDB local
hoặc TiDB.

```bash
# 1. Backend
cd server
npm install
cp .env.example .env   # nếu chưa có .env — xem mẫu biến trong docs/setup.md
npm run migrate        # chạy migration 001 + 003 + 004
npm run dev            # nodemon server.js, mặc định port 5000

# 2. Frontend (terminal khác)
cd client
npm install
npm run dev            # Vite, http://localhost:5173
```

- `client/.env.development` mặc định: `VITE_API_URL=http://localhost:5000/api`.
- Vite dev có proxy `/api` → `http://localhost:5000` (xem
  `client/vite.config.js`).
- Seed tài khoản test local: `database/seeds/001_test_users.sql`
  (3 tài khoản `sa_test` / `admin_test` / `user_test`, mật khẩu `Test1234` —
  chỉ dùng local, không dùng production).

Build production (client):

```bash
cd client
npm run build    # vite build (terser, drop console/debugger)
npm run preview  # xem thử bản build
```

## Deploy (tóm tắt)

- **Client — Cloudflare Pages**: root directory `client`, build command
  theo `client/package.json` (`npm run build`), env
  `VITE_API_URL=https://phimviethay-p45m.onrender.com/api`.
- **Server — Render**: repo `phimviethay-v2`, Node 24, root directory
  `server`, start `node server.js` (port từ biến `PORT`), URL
  `https://phimviethay-p45m.onrender.com`.
- **Database — TiDB Cloud**: cluster `phimviethay-v2` (Singapore),
  DB `phimviethay`, bắt buộc `DB_SSL=true`, port 4000.

⚠️ **Quan trọng**: file `client/.env.production` trong repo hiện vẫn trỏ
backend cũ `https://phimviethay.onrender.com/api` — build với file này sẽ
làm `GET /api/player-key` 404. Trước khi deploy phải sửa thành backend v2
`https://phimviethay-p45m.onrender.com/api`. Chi tiết trong
[docs/setup.md](docs/setup.md).

## Cấu trúc thư mục

```
phimviethay/
├── README.md                  File này
├── HUONG-DAN.md               Hướng dẫn pull & chạy local (bản 22/11/2026, đã cũ một phần)
├── docs/
│   ├── architecture.md        Kiến trúc + luồng dữ liệu + ranh giới trách nhiệm
│   ├── setup.md               Chạy local + deploy + quy trình database
│   ├── frontend.md            Cấu trúc client/src + tính năng frontend
│   └── roadmap.md             Dự định phát triển (đã chốt / gác lại / chưa chốt)
├── client/                    React 19 + Vite + Tailwind
│   ├── public/jwplayer/       origin.js v62, player.css, broadcast-player.css,
│   │                          jwplayer-8.9.3.js (code player copy từ vsmov)
│   └── src/                   pages, components, services, context, routes.jsx
├── server/                    Express 5.1 (server.js + src/)
│   └── src/                   config, controllers, routes, models,
│                              middlewares, socket, utils
└── database/
    ├── migrations/            001_init, 002_add_google_auth (CHƯA chạy),
    │                          003_add_user_theme, 004_admin_settings_views,
    │                          migrate.js (chạy 001 + 003 + 004)
    ├── seeds/                 001_test_users.sql (tài khoản test local)
    └── README.md              Chi tiết schema + migration
```

## Quyết định đã chốt (đừng làm ngược)

- **Chỉ dùng nguồn vsmov.** PhimAPI/KKPhim đã loại vì chèn quảng cáo giữa
  phim. Không làm chuyển nguồn.
- **Chỉ dark mode.** Không làm light mode.
- **Player: COPY code vsmov, không viết lại.** Chỉ đổi logo + dùng JWPlayer
  của mình. Player phụ thuộc 3 CDN ngoài (jQuery Google, Bootstrap cdnjs,
  FontAwesome cdnjs) — 1 CDN hỏng là player hỏng.
- **Phát triển dựa trên frontend cũ**, không thay/loại bỏ nhiều; thay đổi
  lớn hỏi user trước.
- **Không push GitHub từ sandbox.** User tự push từ máy Windows của mình.

## Tài liệu

- [docs/architecture.md](docs/architecture.md) — kiến trúc tổng thể
- [docs/setup.md](docs/setup.md) — chạy local, deploy, database
- [docs/frontend.md](docs/frontend.md) — frontend chi tiết
- [docs/roadmap.md](docs/roadmap.md) — dự định phát triển
- [database/README.md](database/README.md) — schema + migration chi tiết

## Điểm chưa xác minh

- **Số lượng "45 thể loại, 187 quốc gia"**: menu thể loại/quốc gia lấy
  động từ API vsmov (`GET /the-loai`, `GET /quoc-gia`) nên con số thay đổi
  theo dữ liệu nguồn; chưa đếm lại từ API live tại thời điểm viết doc.
- **Watch Party**: route + trang + Socket.IO có trong code nhưng chưa test
  luồng xem chung thật, chưa rõ chạy ổn định tới đâu.
- **Node.js tối thiểu local**: `HUONG-DAN.md` ghi Node 20+, Render dùng
  Node 24; chưa xác minh bản Node thấp nhất chạy được.
