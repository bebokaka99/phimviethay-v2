# Frontend — PhimVietHay

Stack: React 19.2 + Vite (rolldown-vite 7.2.5) + Tailwind CSS 3.4,
React Router 7.9, axios, Swiper 12, PWA (`vite-plugin-pwa`).
Chỉ dark mode. Dữ liệu phim gọi trực tiếp API vsmov
(`https://vsmov.com/api`, public, không cần token) — xem luồng đầy đủ
trong [docs/architecture.md](architecture.md).

## Cấu trúc `client/src`

```
client/src/
├── main.jsx                 Entry: render App + ThemeProvider (chưa xác minh chi tiết main.jsx)
├── App.jsx / App.css        Khung app
├── index.css                CSS global + theme var (--accent, --bg, ...)
├── routes.jsx               Toàn bộ route (lazy load từng trang)
├── assets/logo.png          Logo PhimVietHay (551×207) — logo đúng của web
├── config/menuRows.js       Nguồn DUY NHẤT cho slug hàng trang chủ + menu header
├── context/ThemeContext.jsx Theme/preset, CSS var, auto-contrast
├── hooks/useDebounce.js     Debounce tìm kiếm (500ms)
├── hooks/useOnScreen.js     (chưa xác minh công dụng cụ thể)
├── services/
│   ├── movieService.js      Mọi gọi API vsmov + normalize + remap slug
│   ├── axiosConfig.js       Axios backend (VITE_API_URL), gắn Bearer token,
│   │                        xử lý 401 (về /login?expired=true) + 429
│   ├── authService.js       Đăng nhập/đăng ký/me (backend)
│   ├── commentService.js    Bình luận (backend)
│   ├── adminService.js      Admin: settings, stats, users, comments
│   ├── analyticsService.js  Gửi behavior log
│   ├── tmdbService.js       TMDB fallback (dàn cast/backdrop — xem dưới)
│   └── socket.js            Socket.IO client (Watch Party)
├── components/
│   ├── layout/              Header.jsx, Footer.jsx, MainLayout.jsx
│   ├── movies/              HeroSection.jsx, MovieCard.jsx, MovieRow.jsx,
│   │                        LazyMovieRow.jsx, MovieGrid.jsx, VideoPlayer.jsx,
│   │                        WatchPartyPlayer.jsx
│   ├── common/              Logo.jsx, OptimizedImage.jsx, Skeleton.jsx,
│   │                        UserAvatar.jsx, ScrollToTopBtn.jsx,
│   │                        SessionExpiredModal.jsx
│   ├── comments/            CommentSection.jsx
│   └── admin/               AdminLayout.jsx, MovieIntroCard.jsx, MovieStatRow.jsx
├── pages/                   Home, MovieDetail, WatchMovie, SearchPage,
│   ├── admin/               Catalog, Login, Register, Profile, Favorites,
│   │                        History, About, WatchParty, WatchPartyLobby, NotFound
│   └── admin/               Dashboard, Users, Comments, Intros,
│                            PlayerSettings, ViewsStats (+ IntroDetailTable)
└── utils/roleLabel.js       Nhãn hiển thị theo role
```

## Các trang / route chính (`client/src/routes.jsx`)

Tất cả các trang đều lazy load (`React.lazy` + `Suspense`, fallback là
spinner). Route cần đăng nhập dùng `ProtectedRoute` (đọc `user` trong
`localStorage`; admin cần `role` là `admin` hoặc `super_admin`).

| Route | Trang | Ghi chú |
| :--- | :--- | :--- |
| `/` | `Home.jsx` | Hero + các hàng phim |
| `/phim/:slug` | `MovieDetail.jsx` | Chi tiết + tập + bình luận + yêu thích |
| `/xem-phim/:slug` | `WatchMovie.jsx` | Player JWPlayer (copy code vsmov) |
| `/tim-kiem` | `SearchPage.jsx` | Kết quả tìm kiếm |
| `/the-loai/:slug`, `/quoc-gia/:slug`, `/danh-sach/:slug` | `Catalog.jsx` (`group` tương ứng) | Danh sách có phân trang/lọc |
| `/the-loai`, `/quoc-gia`, `/danh-sach` (không slug) | `Catalog.jsx` (`group="danh-sach"`) | Fallback về danh sách |
| `/gioi-thieu` | `About.jsx` | Trang Giới thiệu (có ảnh minh họa + Q&A) |
| `/login`, `/register` | `Login.jsx`, `Register.jsx` | Standalone, không dùng MainLayout |
| `/ho-so` | `Profile.jsx` | Cần đăng nhập — hồ sơ + mục Giao diện |
| `/tu-phim` | `Favorites.jsx` | Cần đăng nhập |
| `/lich-su` | `History.jsx` | Cần đăng nhập |
| `/watch-party`, `/watch-party/:roomId` | `WatchPartyLobby.jsx`, `WatchParty.jsx` | Xem chung (chưa xác minh mức hoàn thiện) |
| `/admin` (+ `users`, `comments`, `intros`, `player`, `views`) | `pages/admin/*` + `AdminLayout` | Cần role admin/super_admin |
| Sai route | `NotFound.jsx` | `errorElement` của layout chính |

## Tính năng frontend

### Trang chủ — hero + hàng phim

- `HeroSection.jsx`: slideshow phim mới, **1 đồng hồ duy nhất 8 giây**
  cho cả chuyển slide + thanh tiến trình (đổi slide reset về đủ 8s);
  slide + progress luôn chạy kể cả khi hover.
- Các hàng phim lấy từ `HOME_ROWS` trong `config/menuRows.js` (7 hàng:
  Phim Lẻ Mới Cập Nhật, Phim Bộ Hot, Phim Hành Động, Phim Tình Cảm,
  Phim Hàn Quốc, Phim Trung Quốc, Hoạt Hình/Anime). Slug ở đây là nguồn
  duy nhất — `Home.jsx` và `Header.jsx` không còn hardcode slug riêng.
- Nền hero đỏ pha (gradient theo `--accent`) là signature của web —
  không đổi thành nền đen hoàn toàn.
- Hàng phim render qua `MovieRow.jsx` / `LazyMovieRow.jsx` (lazy theo
  viewport — chưa xác minh chi tiết cơ chế), card qua `MovieCard.jsx`.

### Tìm kiếm (Ctrl+K)

- Ô tìm kiếm trong `Header.jsx`: phím tắt `Ctrl+K` / `Cmd+K` mở tìm
  kiếm, `Esc` đóng menu/tìm kiếm; `↑` `↓` chọn gợi ý, `Enter` mở phim.
- Debounce 500ms (`useDebounce`) rồi gọi `searchMovies()` (vsmov
  `GET /tim-kiem?keyword=...`); hiện gợi ý + tổng số kết quả.
- Trang kết quả đầy đủ: `/tim-kiem` (`SearchPage.jsx`).

### Thể loại / quốc gia / danh sách

- Menu header lấy động từ vsmov: `GET /the-loai`, `GET /quoc-gia`
  (`getMenuData()` trong `movieService.js`, cache trong phiên, retry
  tối đa 2 lần cách nhau ~1s; lỗi thì header hiện trạng thái lỗi + nút
  thử lại thay vì menu trống).
- Một số slug bị ẩn khỏi menu vì trùng/rỗng
  (`HIDDEN_GENRE_SLUGS`: `lang-mang`, `drama`, `action-adventure`,
  `sci-fi-fantasy`; `HIDDEN_COUNTRY_SLUGS`: `china`,
  `trung-quoc-dai-luc`) — xem `config/menuRows.js`.
- `Catalog.jsx`: phân trang; filter chỉ gửi param khi endpoint đích
  nhận (`/the-loai/*` nhận country + year, `/quoc-gia/*` nhận year,
  `/danh-sach/*` bỏ qua hết — kể cả `sort_field`).
- Menu "Danh sách" trong header: Phim Mới, Phim Bộ, Phim Lẻ, Hoạt Hình,
  Phim Chiếu Rạp (không có "Sắp Chiếu" — endpoint 404; không có
  "TV Shows" riêng — "Phim Bộ" đã là series thật).

### Chi tiết phim + xem phim

- `MovieDetail.jsx`: gọi `GET /phim/{slug}` (vsmov), hiện tập theo
  server (tên server được dọn `"Vietsub\r\n #1"` → `"Vietsub #1"`),
  bình luận (`CommentSection.jsx`, trả lời lồng nhau), nút yêu thích,
  ghi 1 lượt xem qua `POST /api/views` (dedup ở backend).
- Dàn cast: vsmov không có endpoint `/phim/{slug}/peoples` (404) nên
  `getMoviePeoples()` trả `[]`; bù bằng TMDB fallback
  (`tmdbService.js` — dùng key TMDB hardcode trong file, chưa xác minh
  luồng fallback chạy tới đâu).
- `WatchMovie.jsx`: player copy code vsmov (`origin.js` v62) +
  JWPlayer 8.9.3 + key từ `GET /api/player-key`; m3u8 + phụ đề lấy qua
  `GET /api/extract-m3u8?embed=...`; đổi tập bằng `jwplayer().load()`;
  khung 16/9; logo PhimVietHay 32px desktop / 26px mobile, bấm về trang
  chủ. Chi tiết luồng + các lỗi vừa sửa (sub, panel, mobile, dropup)
  xem [docs/architecture.md](architecture.md).

### Yêu thích / lịch sử / hồ sơ / bình luận

- Yêu thích (`/tu-phim`): `GET/POST/DELETE /api/user/favorites`,
  `GET /api/user/favorites/check/:slug`; chống trùng bằng UNIQUE KEY
  `(user_id, movie_slug)`.
- Lịch sử (`/lich-su`): `POST/GET/DELETE /api/user/history`, xóa 1 phim
  `DELETE /api/user/history/:slug`; lưu tới tập nào (`episode_slug`).
- Hồ sơ (`/ho-so`): cập nhật thông tin (`PUT /api/user/profile`), đổi
  avatar (upload xong báo bằng toast, không dùng `alert` trình duyệt).
- Bình luận: xem không cần login (`GET /api/comments/:slug`), viết cần
  login; bình luận theo phim hoặc theo tập (`episode_slug`), trả lời
  lồng nhau qua `parent_id`.
- Đăng nhập sai: toast "Sai tài khoản hoặc mật khẩu, vui lòng kiểm tra
  lại" (chỉ toast, không alert). Đăng ký: form có kiểm tra độ mạnh mật
  khẩu — **chưa xác minh** đã áp vào form thật hay mới ở mức bản mẫu
  thiết kế (tháng 11/2026 có làm 3 mẫu login Netflix-style nhưng user
  tạm gác, chưa làm thật).

### Cá nhân hóa giao diện / theme

- `ThemeContext.jsx`: `DEFAULT_THEME` = preset `crimson`, accent
  `#E50914`, bo góc `medium` (12px), cỡ chữ `medium` (16px), mật độ
  `comfortable`, `hiddenRows: []`, `animations: true`, `glass: true`.
- 6 preset tối (accent + background + surface + text + textMuted +
  border): crimson `#E50914`, ocean `#3B82F6`, violet `#8B5CF6`,
  emerald `#10B981`, amber `#F59E0B`, rose `#EC4899`.
- Áp theme bằng CSS var (`--accent`, `--bg`, …) + auto-contrast
  (trộn màu để chữ đọc được). Theme lưu theo tài khoản:
  `PATCH /api/user/theme` (validate 8 key + accent hex ở
  `server/src/utils/themeValidation.js`); `GET /api/auth/me` và login
  trả kèm theme. Chưa đăng nhập thì theme lưu localStorage
  (`phimviethay-theme`) — chưa xác minh đầy đủ luồng đồng bộ local ↔ DB.
- Mục "Giao diện" trong Hồ sơ (`Profile.jsx` → `ThemeSettings`):
  6 preset + chọn màu accent tự chọn + bo góc/cỡ chữ/mật độ +
  7 checkbox ẩn/hiện hàng trang chủ + 2 toggle hiệu ứng + nút đặt lại.
  Mọi thay đổi áp ngay (live preview) + tự lưu, không có nút "Lưu"
  riêng. Ẩn hàng: `Home.jsx` lọc `ROW_CONFIG` theo `theme.hiddenRows`.
- Màu thanh tiến trình JWPlayer đổi theo theme — **chưa làm** (đang
  chờ bước xem trước theme; user yêu cầu preview hiển thị cả card
  phim/header trước khi áp dụng).

## Lưu ý kỹ thuật / việc còn dở (đọc trước khi sửa)

1. **Màu đỏ hardcode chưa theo theme var** — `Header.jsx` có **29 chỗ**
   dùng màu đỏ cố định (đếm ngày 24/11/2026: các class `red-600`,
   `red-500`, mã `#e50914`…) và **0 lần** dùng `var(--accent)`.
   `MovieCard.jsx` cũng còn hardcode: badge chất lượng `bg-red-600`
   (dòng 171, 215), nút "Xem" `bg-red-600`/`hover:bg-red-700`, ring
   hover `ring-red-500`, icon play `text-red-500`, tên phim hover
   `group-hover:text-red-600`. Đổi preset theme sẽ không đổi các chỗ
   này. `SECTION_THEMES` trong `MovieRow.jsx` (màu đỏ theo từng mục)
   được giữ cố ý vì là màu ngữ nghĩa.
2. **JSON theme thô trong DB hơi lệch khi đổi preset** (hiển thị vẫn
   đúng) — đã biết, chưa sửa.
3. **Auto-contrast không thành light theme thật** — mọi preset đều tối.
4. **Phụ đề hiện literal `<i>...</i>`** (VTT bị escape, quirk sẵn của
   bản copy vsmov) — chưa sửa.
5. **Player phụ thuộc 3 CDN ngoài** (jQuery Google, Bootstrap cdnjs,
   FontAwesome cdnjs) — 1 CDN hỏng là player hỏng; chưa tự host.
6. **TMDB key hardcode** trong `client/src/services/tmdbService.js`
   (key public trong code frontend) — đã biết, chưa xoay/chuyển.
7. **Nút Google login đang comment out**; route Google trả 503 khi
   chưa cấu hình (xem [docs/setup.md](setup.md)).
8. **Không có test tự động**: `server/package.json` (`test`) chỉ là
   `echo "Error: no test specified"`; client không có script test.
   Kiểm chứng bằng chạy thật + test tay.
9. **PWA**: `vite-plugin-pwa` (`registerType: autoUpdate`); service
   worker bản cũ có thể phục vụ chunk JS cũ — xem lưu ý trong
   [docs/setup.md](setup.md).

## Build

```bash
cd client
npm run dev      # Vite dev — http://localhost:5173
npm run build    # npm install --legacy-peer-deps && vite build (terser)
npm run preview  # xem thử bản build
npm run lint     # eslint .
```

⚠️ Trước khi build để deploy, kiểm tra `client/.env.production` phải
trỏ backend v2 `https://phimviethay-p45m.onrender.com/api` (file trong
repo hiện vẫn trỏ backend cũ `phimviethay.onrender.com` → `/api/player-key`
404). Chi tiết trong [docs/setup.md](setup.md).
