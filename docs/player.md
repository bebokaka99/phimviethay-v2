# Trình phát (Player) — PhimVietHay

> File liên quan: `client/src/pages/WatchMovie.jsx`, `client/public/jwplayer/`.
> Local HEAD kiểm chứng: `bb83671`.

## 1. Nguyên tắc: copy y nguyên code vsmov, chỉ đổi logo + key

Player KHÔNG viết lại, KHÔNG dùng iframe trang embed vsmov nữa (iframe đã bỏ
từ commit `4c3202d`). WatchMovie.jsx nạp code player của vsmov về chạy trong
trang của mình, với JWPlayer 8.9.3 + key của mình:

| Thành phần | Vị trí | Ghi chú |
|---|---|---|
| `origin.js` | `client/public/jwplayer/origin.js` | Copy từ trang embed vsmov, v62, 183.761 byte, 5.064 dòng |
| `player.css` | `client/public/jwplayer/player.css` | Copy từ trang embed vsmov, 3.806 dòng |
| `broadcast-player.css` | `client/public/jwplayer/broadcast-player.css` | Copy từ trang embed vsmov, 1.271 dòng |
| JWPlayer | `client/public/jwplayer/jwplayer-8.9.3.js` | Bản 8.9.3 tự host, 108.634 byte |
| Key JWPlayer | `GET /api/player-key` | Lấy từ bảng `settings` (key `player_license`), xem `backend.md` |

Thứ tự khởi tạo trong `WatchMovie.jsx` (`ensurePlayerScripts`):
1. Nạp jQuery (CDN) → 2. Nạp `jwplayer-8.9.3.js` → 3. Lấy key qua
   `GET /api/player-key` (bắt buộc trước khi `origin.js` chạy — không có key
   thì lỗi JW Player 100011) → 4. Gán `window.jwplayer.key` → 5. Nạp
   Bootstrap JS (CDN) → 6. Fetch text `origin.js` rồi chạy.
Đổi tập dùng `jwplayer().load()`, không `setup()` lại, không nạp lại
`origin.js`. Khung player giữ tỉ lệ 16/9. Logo PhimVietHay trên control bar:
32px desktop, 26px mobile (tăng 20% ở commit `fc0ac35`), bấm vào về trang chủ.
Trong cả 3 file copy, màu `#f97316` đã đổi thành `#e50914` (0 lần xuất hiện).

## 2. Nguồn phát (m3u8) và phụ đề

- API vsmov chỉ trả `link_embed`, KHÔNG có `link_m3u8`. Backend tách m3u8 từ
  HTML trang embed: `GET /api/extract-m3u8?embed=<link_embed>` → trả
  `{ m3u8, subtitles }` (xem `backend.md`).
- Phụ đề lấy từ mảng `subtitles` trong HTML trang embed: file `.vtt`, thường
  có `vie` + `eng`. URL tương đối (`/video/<uuid>/subtitle/vie_....vtt`)
  được backend resolve thành URL tuyệt đối theo origin của trang embed.
  File `.vtt` trả `Access-Control-Allow-Origin: *` nên JWPlayer tải được
  từ mọi domain.
- Frontend mặc định chọn track Tiếng Việt (`findDefaultSubtitleIndex` ưu tiên
  code bắt đầu bằng `vie`, nếu không có thì lấy track đầu tiên).
- Renderer phụ đề thật KHÔNG phải caption native của JWPlayer mà là overlay
  riêng `.bc-dual-subs` do `origin.js` tạo (`bcSetSingleSubtitleOverlay`).
  Caption native của JW chỉ xuất hiện ở đường upload phụ đề / iOS fullscreen
  fallback; `PLAYER_GUARD_CSS` vẫn giữ rule phòng thủ nâng vùng
  `.jw-captions` lên `calc(100% - 150px)` (100px mobile) khi controls hiện.

### Vị trí phụ đề (chốt theo player gốc vsmov, commit `bb83671`)

Một giá trị cố định cho mọi trạng thái (playing/paused, controls hiện/ẩn,
menu mở) — sub KHÔNG nhảy lên/xuống:

| Trạng thái | `bottom` của `.bc-dual-subs` | Đo thật (24/11/2026, phim `hoc-tai-thi-ho`) |
|---|---|---|
| Desktop | **14%** | Player 877×493 → 69px (14,0%). Control bar cao 113px, nút bấm ở 20–60px từ đáy → không chồng nút |
| Mobile / tablet (≤980px) | **16%** | Player 390×219 → 35px (16,0%). Bar cao 58px |
| Fullscreen | **12%** | 96px (đo thật). Rule dùng `:has()` vì fullscreen overlay bị re-parent sang `#rp-player` |

Quy tắc trong `player.css` gốc tương ứng: dòng 2497 (14%), 2813–2820
(16% ≤980px), 2670–2676 (12% fullscreen). Trước `bb83671` từng thử hướng
"đáy = chiều cao control bar + khe hở" (120px/66px) nhưng user bác vì sub
bị đẩy lên cao, nhìn như nổi giữa video.

### Thứ tự lớp (z-index)

- Overlay sub `.bc-dual-subs`: **z-index 15** (sửa ở `bb83671`, trước đó là
  35 trong `player.css:2502` nên vẽ đè cả control bar).
- Control bar: z-index 20 (`player.css:2301`); fullscreen control bar
  2147483640, panel fullscreen 2147483646 (`player.css:2716–2730`).
- Tăng z-index của panel KHÔNG có tác dụng vì panel kẹt trong stacking
  context của control bar — chỉ hạ overlay xuống dưới 20 mới đủ. Sub chỉ
  hiện ở phần không bị panel che (giống YouTube).

### Cỡ chữ phụ đề

Chọn trong menu Cài đặt → Phụ đề. Thêm các cỡ 35/30/25/20 ngày 24/11/2026
(commit `bb83671`, trong `origin.js`):

- Desktop: 20 · 25 · 30 · 35 · 40 · 48 · 56 · 64 (pt).
- Mobile/iOS: 12 · 20 · 25 · 30 · 35 (pt, giữ bộ cỡ chi tiết).
- Floor cũ 36 (desktop) / 28 (mobile) đã hạ xuống 20.
- Lưu ý đã đo thật: mobile chọn 25 thì hiển thị 24px do cap sẵn trong code;
  desktop chọn 25 ra đúng 25px.

## 3. Các lỗi đã sửa (commit `cd9fd64` + `bb83671`)

Chỉ sửa 1 file `WatchMovie.jsx`: hằng `PLAYER_GUARD_CSS` (CSS tiêm thêm) +
hàm `startPlayerMenuFixes()` (JS). Không sửa 3 file copy của vsmov.

### Lỗi 1 — Phụ đề đè lên thanh control bar (`cd9fd64`, sửa lại ở `bb83671`)

- **Triệu chứng:** sub nằm đè lên nút bấm / thanh tiến trình của control bar.
- **Nguyên nhân:** overlay `.bc-dual-subs` (z-index 35) vẽ đè control bar
  (z-index 20); vị trí đáy mặc định của vsmov tụt về 8% khi controls ẩn.
- **Cách sửa:** `PLAYER_GUARD_CSS` ép `bottom: 14% / 16% / 12%` cố định
  (mục 2) + `z-index: 15` (dưới control bar 20 + panel). Bỏ hướng cũ nâng
  đáy lên 120px/66px.
- **Kiểm chứng:** xem phim thật `hoc-tai-thi-ho`, đo `bottom` của overlay:
  desktop 69px, mobile 35px, fullscreen 96px; sub không nhảy khi controls
  hiện/ẩn; mở Cài đặt thì sub vẫn hiện (không bị ẩn như bản `cd9fd64`).

### Lỗi 2 — Panel phụ đề / Cài đặt dài hơn khung, không cuộn được (`cd9fd64`)

- **Triệu chứng:** panel Phụ đề dài, phần "Độ trong nền" bị cắt, không cuộn
  tới được. Chỉ 2 cột ngôn ngữ (`.sub-col`, max-height 205px) tự cuộn.
- **Nguyên nhân:** menu là Bootstrap dropdown mở xuống dưới, bị
  `#rp-player { overflow: hidden }` cắt; `.player-dm` gốc chỉ có
  `overflow: hidden` (`player.css:541`), `.dm-sub` có `max-height: 60vh`
  nhưng không có `overflow: auto` (`player.css:3129`).
- **Cách sửa:** ép `.b_func .dropdown-menu.player-dm` dùng
  `max-height: min(72vh, 480px) + overflow-y: auto` (theo đúng mẫu
  fullscreen đã có trong `player.css:2716`). Riêng mobile ≤640px:
  `max-height: calc(56.25vw - 70px)` (≈149px ở màn 390px) để menu nằm gọn
  trong player rồi cuộn nội bộ.
- **Kiểm chứng:** mở panel Phụ đề, cuộn xuống tới được hàng "Độ trong nền";
  mobile 390px: menu nằm gọn trong player, cuộn được tới mọi hàng
  (5/5 PASS video thật, ảnh tại
  `~/workspace/phimviethay-research/player-bugfix-verify/`).

### Lỗi 3 — Mobile có lớp phủ đen chặn chạm (`cd9fd64`)

- **Triệu chứng:** trên mobile, dải 50px trên cùng của player có lớp phủ đen,
  bấm không ăn.
- **Nguyên nhân:** `#player_top` kẹt `opacity: 1` (animation `bc-chrome-rise`
  giữ lại), `z-index: 100`, `pointer-events: auto`; nội dung rỗng trên
  mobile (tiêu đề `display: none`).
- **Cách sửa:** `#player_top { pointer-events: none !important }` mọi
  viewport; `display: none !important` khi ≤640px.
- **Kiểm chứng:** mobile 390px bấm được vào vùng trên cùng của player, không
  còn vệt đen rỗng.

### Lỗi 4 — Bảng Cài đặt tuột hẳn xuống dưới khung player (`cd9fd64`)

- **Triệu chứng:** chỉ thấy 1 vệt nhỏ của bảng Cài đặt ở mép dưới khung
  player (báo trên phim "Trò Chơi Vương Quyền - Phần 6", Tập 1).
- **Nguyên nhân:** menu Cài đặt là Bootstrap dropdown mở XUỐNG dưới, bị
  `#rp-player { overflow: hidden }` cắt.
- **Cách sửa:** `startPlayerMenuFixes()` dùng `setInterval` 200ms (tối đa
  200 lần) chờ `origin.js` render `.b_func`, rồi thêm class `dropup` vào
  cha `.p_b-right` để menu mở LÊN TRÊN. Không dùng CSS `top: auto;
  bottom: 100%` vì giết transform của Popper, mất căn ngang. Kèm reset:
  khi menu Cài đặt đóng (`hidden.bs.dropdown`), ẩn các `.sub-slide` và
  hiện lại `.content-slide` chính để lần mở sau không kẹt ở slide con
  "Tuỳ chỉnh".
- **Kiểm chứng:** mở Cài đặt trên desktop + mobile, bảng hiện đầy đủ phía
  trên control bar, không bị cắt.

### Sửa thêm ở `bb83671` — sub mất khi mở Cài đặt

- **Triệu chứng (bản `cd9fd64`):** mở Cài đặt thì overlay sub bị ẩn.
- **Cách sửa:** bỏ rule ẩn overlay khi dropdown player mở (Fix 1c — xóa).
  Sub vẫn hiện khi mở Cài đặt, chỉ bị panel che phần nào thì thôi.
- **Kiểm chứng:** mở Cài đặt, sub vẫn hiển thị ở vị trí 14%/16%/12%.

## 4. Phụ thuộc CDN ngoài (rủi ro)

Player phụ thuộc runtime vào 4 URL ngoài (khai báo ở đầu `WatchMovie.jsx`,
dòng 41–44). Một CDN hỏng là cả player hỏng — cân nhắc tự host sau:

| URL | Dùng cho |
|---|---|
| `https://ajax.googleapis.com/ajax/libs/jquery/3.5.1/jquery.min.js` | jQuery — `origin.js` bắt buộc |
| `https://cdnjs.cloudflare.com/ajax/libs/bootstrap/5.3.3/js/bootstrap.bundle.min.js` | Bootstrap JS — dropdown/tooltip của `origin.js` (`data-bs-toggle`). Lỗi thì có shim no-op (`window.bootstrap = { Tooltip, Dropdown }`) để `new bootstrap.Tooltip` ở `origin.js:3365` không throw |
| `https://cdnjs.cloudflare.com/ajax/libs/font-awesome/6.5.2/css/all.min.css` | Icon FontAwesome |
| `https://fonts.googleapis.com/css2?family=Outfit...&family=JetBrains+Mono...` | Font Outfit + JetBrains Mono cho player |

Lưu ý: `PLAYER_GUARD_CSS` có sẵn compat tối thiểu cho Bootstrap
(`.d-none`, `.dropdown-menu`, `.tooltip`) để dropdown chạy được ngay cả
khi Bootstrap JS chưa kịp nạp.

## 5. Lưu ý CORS: chỉ HTTPS mới phát được direct m3u8

- CDN segment video `p<so>.streamvsmov.com` chỉ trả header CORS khi Origin
  là **HTTPS**; Origin HTTP (localhost) không được trả CORS → direct m3u8
  chạy trên domain thật `https://phimviethay.pages.dev`, lỗi trên localhost
  HTTP. Đây KHÔNG phải lỗi player, **không cần proxy**.
- Ngược lại, file phụ đề `.vtt` trả `Access-Control-Allow-Origin: *` cho cả
  HTTP lẫn HTTPS.
- Lỗi còn tồn, chưa sửa: sub hiện literal `<i>...</i>` (VTT bị escape —
  `origin.js` có hàm `escapeHtml` ở dòng 771; đây là quirk sẵn của bản copy
  vsmov). Trên mobile, mở panel Phụ đề thì panel che gần hết sub (đóng panel
  sub hiện bình thường).
