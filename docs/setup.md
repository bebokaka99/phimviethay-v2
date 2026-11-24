# Cài đặt & Deploy — PhimVietHay

## Chạy local

### Yêu cầu

- Node.js 20+ (theo `HUONG-DAN.md`; Render prod dùng Node 24 — phiên bản
  tối thiểu chính xác chưa xác minh).
- MySQL 8.0+ / MariaDB 10.5+ / TiDB (tương thích MySQL), hoặc dùng TiDB
  Cloud. Sandbox đã test thật trên MariaDB.
- Không cần Docker.

### 1. Clone repo

```bash
git clone https://github.com/bebokaka99/phimviethay-v2.git
cd phimviethay-v2
```

### 2. Backend (`server/`)

```bash
cd server
npm install
```

Tạo file `server/.env` mới (không có file `.env.example` trong repo;
file này đã gitignore, không commit):

```env
PORT=5000
CLIENT_URL=http://localhost:5173

# Database — ví dụ local MariaDB/MySQL
DB_HOST=localhost
DB_PORT=3306
DB_USER=root
DB_PASS=<mat-khau-db>
DB_NAME=phimviethay
DB_SSL=false

# JWT (bắt buộc — dùng cho đăng nhập)
JWT_SECRET=<chuoi-bi-mat-dai-ngau-nhien>

# Google OAuth — CHƯA dùng được (đăng nhập Google đang tắt, trả 503).
# Chỉ điền khi tích hợp lại Google login (kèm migration 002):
# GOOGLE_CLIENT_ID=
# GOOGLE_CLIENT_SECRET=
# GOOGLE_CALLBACK_URL=http://localhost:5000/api/auth/google/callback
```

Chạy migration (tạo DB nếu chưa có, chạy 001 → 003 → 004, kiểm chứng đủ
9 bảng + cột `users.theme` + đủ 6 key settings):

```bash
npm run migrate
# tương đương: node ../database/migrations/migrate.js
```

Seed tài khoản test local (chỉ local, mật khẩu `Test1234`):

```bash
mysql -h localhost -u root -p phimviethay < ../database/seeds/001_test_users.sql
# 3 tài khoản: sa_test (super_admin), admin_test (admin), user_test (user)
```

Chạy server:

```bash
npm run dev     # nodemon server.js — dùng khi phát triển
npm start       # node server.js — dùng khi chạy thật
```

Kiểm tra: mở `http://localhost:5000/` → `Server PhimVietHay (v2) is Running...`;
`http://localhost:5000/ping` → `Pong`;
`GET http://localhost:5000/api/player-key` → `200 { key: ... }`.

### 3. Frontend (`client/`)

```bash
cd client
npm install
npm run dev     # Vite — http://localhost:5173
```

Env frontend (đã có sẵn trong repo):

| File | `VITE_API_URL` | Dùng khi |
| :--- | :--- | :--- |
| `client/.env.development` | `http://localhost:5000/api` | `npm run dev` |
| `client/.env` | không có file này trong repo | — |
| `client/.env.production` | `https://phimviethay.onrender.com/api` ⚠️ **SAI — backend cũ, xem ngay dưới** | `npm run build` |

Vite dev có proxy `/api` → `http://localhost:5000`
(`client/vite.config.js`), nhưng code gọi backend qua `VITE_API_URL`
(`client/src/services/axiosConfig.js`) nên env đúng vẫn là bắt buộc.

Build production:

```bash
cd client
npm run build    # vite build (terser, drop console/debugger)
npm run preview  # xem thử bản build
```

> Lưu ý service worker: bản build cũ có SW (PWA) có thể phục vụ chunk JS
> cũ. Khi test lại sau rebuild mà không thấy code mới: unregister SW +
> xóa cache, hoặc test bằng profile Chrome mới.

## Deploy

### Client — Cloudflare Pages

- Repo: `bebokaka99/phimviethay-v2`
- Root directory: `client`
- Build command: `npm run build` (script `build` trong
  `client/package.json` tự chạy `npm install --legacy-peer-deps` rồi
  `vite build`)
- Output: theo mặc định Vite (`dist/`)
- Biến môi trường (Cloudflare Pages → Settings → Environment variables):

```env
VITE_API_URL=https://phimviethay-p45m.onrender.com/api
```

- Domain prod: `https://phimviethay.pages.dev` (đã nằm trong danh sách
  CORS cho phép của backend).

### Server — Render

- Repo: `bebokaka99/phimviethay-v2`, Node 24
- Root directory: `server`
- Start command: `node server.js` (script `start` trong
  `server/package.json`); port lấy từ biến `PORT` do Render cấp
  (mặc định code là 5000 khi chạy local)
- URL prod: `https://phimviethay-p45m.onrender.com`
- Biến môi trường trên Render (Dashboard → Environment):

```env
PORT=10000                    # Render tự cấp, ví dụ — không hardcode 5000
DB_HOST=<tidb-host>
DB_PORT=4000
DB_USER=<tidb-user>
DB_PASS=<tidb-password>
DB_NAME=phimviethay
DB_SSL=true                   # bắt buộc với TiDB Cloud
JWT_SECRET=<chuoi-bi-mat>
CLIENT_URL=https://phimviethay.pages.dev
```

### Database — TiDB Cloud

- Cluster: `phimviethay-v2` (Singapore), database: `phimviethay`
- Port TiDB Serverless: `4000`; bắt buộc `DB_SSL=true`
  (code dùng `ssl: { minVersion: 'TLSv1.2', rejectUnauthorized: false }`
  khi `DB_SSL=true`)

## ⚠️ QUAN TRỌNG — lỗi backend cũ trong `.env.production`

File `client/.env.production` trong repo **hiện vẫn ghi**:

```env
VITE_API_URL=https://phimviethay.onrender.com/api
```

Đây là backend **cũ** (Render cũ). Build với URL này sẽ làm
`GET /api/player-key` **404** và player không lấy được key.

**Trước khi deploy, bắt buộc sửa thành backend v2:**

```env
VITE_API_URL=https://phimviethay-p45m.onrender.com/api
```

Cách chắc chắn nhất: đặt đúng giá trị này trong biến môi trường của
Cloudflare Pages (nó override file `.env.production` khi build), và sửa
luôn file `client/.env.production` trong repo để lần sau không build nhầm.

## Quy trình database (migrate / thay đổi schema)

Quy tắc đã chốt ngày 24/11/2026: **sandbox không nối được TiDB prod,
Render Shell chỉ có ở gói trả phí** → mọi thay đổi DB sau này Muse gửi
code SQL, **user tự chạy trên TiDB Cloud SQL Editor**.

- Migration nằm ở `database/migrations/`:
  - `001_init.sql` — 7 bảng gốc
  - `002_add_google_auth.sql` — khôi phục Google auth (**CHƯA chạy**,
    `migrate.js` không tự chạy file này; chỉ chạy tay khi tích hợp lại
    Google login)
  - `003_add_user_theme.sql` — cột `users.theme` JSON
  - `004_admin_settings_views.sql` — bảng `settings` + `movie_views`
  - `migrate.js` — chạy 001 → 003 → 004 (local/MariaDB)
- Local: chạy `npm run migrate` trong `server/` (xem mục trên).
- TiDB prod: mở TiDB Cloud → SQL Editor → chọn database `phimviethay`
  (thêm `USE phimviethay;` đầu script nếu cần) → dán nội dung file SQL →
  chạy. Chạy lại an toàn (`CREATE TABLE IF NOT EXISTS` /
  `ADD COLUMN IF NOT EXISTS` / `INSERT IGNORE`).
- Lưu ý đã gặp: bảng `users` trên TiDB mới từng thiếu cột `theme` vì file
  003 chạy lúc bảng `users` chưa có — nếu nghi thiếu cột, chạy lại 003
  trên SQL Editor rồi kiểm tra `INFORMATION_SCHEMA.COLUMNS`.
- Seed test (`database/seeds/001_test_users.sql`): **chỉ local**, không
  chạy trên TiDB prod.

## Tài khoản admin đầu tiên

Chưa xác minh trong repo có script tạo admin hay không — tại thời điểm
viết doc này, việc tạo tài khoản admin đầu tiên trên TiDB prod chưa hoàn
tất (đang chờ user thực hiện). Cách làm khi cần: đăng ký tài khoản thường
qua web rồi đổi `role` thành `admin`/`super_admin` trực tiếp trong bảng
`users` trên TiDB Cloud SQL Editor.

## Kiểm chứng sau deploy (checklist nhanh)

```bash
# Backend v2
curl https://phimviethay-p45m.onrender.com/ping
# → Pong
curl https://phimviethay-p45m.onrender.com/api/player-key
# → 200 { "key": "..." }  (404 = frontend đang trỏ backend cũ, xem mục trên)
curl https://phimviethay-p45m.onrender.com/api/admin/settings
# → 401 khi không có token (đúng — route admin yêu cầu đăng nhập)
```

Trên web thật (`https://phimviethay.pages.dev`): mở trang chủ, mở 1 phim,
bấm xem tập 1 — player phải load, phụ đề tiếng Việt hiện, đổi tập được.
Nếu player trắng/đơ: kiểm tra `VITE_API_URL` trong bản build và xóa
cache/service worker cũ rồi thử lại.
