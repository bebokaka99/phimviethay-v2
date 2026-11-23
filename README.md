# PhimVietHay — Bundle 2026-11-24: Trang xem dùng player copy vsmov + logo to hơn 20%

Bundle này áp dụng 2 commit local trên sandbox (chưa từng push GitHub):

- `4c3202d` — WatchMovie dùng player copy vsmov (origin.js v62 + player.css +
  broadcast-player.css + JWPlayer 8.9.3), màu đỏ `#e50914`, logo 27px, xóa TestPlayer.
- `fc0ac35` — Tăng logo control bar thêm 20% (27px → 32px desktop, 22px → 26px mobile).

Repo local của bạn đang ở commit `32841be` trở lên — bundle này chỉ ghi đè
10 file liệt kê ở mục 8, không đụng tới phần còn lại của repo.
**KHÔNG push commit nào từ sandbox** — bạn tự commit + push sau khi áp bundle.

## 0. Bundle này tự đủ để build (không cần bundle khác)

Bundle đã kèm sẵn 4 file của các task trước (xong 23/11, chưa push) vì
`WatchMovie.jsx` và `routes.jsx` trong bundle import tới chúng — không có
thì build lỗi `Could not resolve` / `Missing export`:

- `client/src/components/movies/MovieRow.jsx` — phải có export
  `SECTION_THEMES` (bản trên GitHub chỉ định nghĩa local, chưa export)
- `client/src/services/adminService.js` — có export `getPlayerSettings`,
  `updatePlayerSettings` (bản trên GitHub hiện chưa có 2 hàm này)
- `client/src/pages/admin/PlayerSettings.jsx` +
  `client/src/pages/admin/ViewsStats.jsx` — 2 trang admin `/admin/player`,
  `/admin/views`

Đã kiểm chứng: bundle này áp lên `origin/main` (5a98545) build PASS.

## 1. Cách áp dụng

Đứng ở **thư mục gốc repo** PhimVietHay trên máy bạn rồi chạy:

```bash
tar -xzf phimviethay-2026-11-24-watchmovie-copy.tar.gz -C .
```

Lệnh này ghi đè đúng 10 file theo đường dẫn trong repo (không tạo thư mục thừa).

## 2. File BẮT BUỘC phải xóa ở repo local

2 file này đã bị xóa ở commit `4c3202d`, nhưng vì repo local của bạn đang ở
`32841be` (cũ hơn) nên chúng vẫn còn — xóa tay:

```bash
rm client/src/pages/TestPlayer.jsx client/src/pages/TestPlayer.css
```

Sau khi xóa, route `/test-player` không còn tồn tại (truy cập sẽ ra trang 404) —
đây là hành vi đúng theo thiết kế mới, trang xem chính đã thay thế nó.

> Lưu ý: 2 file `client/src/pages/playerLogic.js` và
> `client/public/jwplayer/vsmov-pom.css` CHỈ tồn tại ở sandbox, chưa từng lên
> GitHub nên repo của bạn KHÔNG có chúng — không cần xóa gì thêm.

## 3. Kiểm tra nhanh sau khi giải nén

```bash
ls client/public/jwplayer/
# phải thấy: origin.js, player.css, broadcast-player.css, jwplayer-8.9.3.js

ls client/src/pages/TestPlayer.jsx client/src/pages/TestPlayer.css
# phải báo "No such file or directory" (đã xóa xong ở bước 2)
```

## 4. Build thử

```bash
cd client
npm run build
```

Build phải PASS rồi mới commit/push và deploy.

## 5. KHÔNG cần sửa `.env.production`

Cloudflare Pages của bạn đã được sửa tay để trỏ đúng backend v2
(`VITE_API_URL=https://phimviethay-p45m.onrender.com/api`) nên bundle này
không đụng tới file env nào. Đừng sửa lại `.env.production` trong repo.

## 6. Chỉnh cỡ logo control bar (nếu muốn to/nhỏ hơn nữa)

File: `client/public/jwplayer/broadcast-player.css`,
rule `.b_func .vsmov-player-brand img`:

- **Desktop — dòng ~897** (rule bắt đầu dòng 897, `height` ở dòng 899):

```css
.b_func .vsmov-player-brand img {
  display: block;
  height: 32px;
  width: auto;
  max-width: 130px;
  ...
}
```

- **Mobile — dòng ~984**, nằm trong `@media screen and (max-width: 640px)`
  (dòng 975):

```css
  .b_func .vsmov-player-brand img {
    height: 26px;
    max-width: 106px;
  }
```

Ví dụ muốn to hơn nữa (vd 38px desktop): tăng **cả `height` và `max-width`
cùng tỉ lệ** (vd `height: 38px; max-width: 154px;`), nhớ giữ `max-width` lớn
hơn chiều rộng thật của logo để logo không bị bóp ngang. Làm tương tự cho
bản mobile.

> ⚠️ CẢNH BÁO — đừng nhầm: dòng **645** trong cùng file có
> `height: 26px !important;` nhưng đó là rule KHÁC (nút display icon
> `.jw-display-icon-display::after`), KHÔNG phải logo. Chỉ sửa 2 rule
> `.b_func .vsmov-player-brand img` ở trên.

Kích thước đo thật sau khi tăng 20%: desktop 85,2×32px (trước 71,9×27px),
mobile 69,2×26px (trước 58,5×22px).

## 7. Lưu ý nhỏ về màu player

Màu nhấn mặc định của player bây giờ là đỏ `#e50914` (đã đổi hết `#f97316`
trong 3 file copy). Tuy nhiên, user nào trước đây đã lưu
`localStorage` `bc_player_chrome_color=#f97316` thì trình duyệt của họ vẫn
giữ màu cam cũ — chỉ người mới (chưa từng lưu) mới mặc định đỏ. Đây là hành
vi cố ý giữ lại, không phải lỗi.

## 8. Nội dung bundle (10 file + README này)

| File | Nội dung |
| --- | --- |
| `client/public/jwplayer/origin.js` | Logic player copy từ vsmov (v62), đã gỡ tracking GA + embed-hit |
| `client/public/jwplayer/player.css` | CSS player vsmov, màu nhấn đổi sang đỏ `#e50914` |
| `client/public/jwplayer/broadcast-player.css` | CSS control bar vsmov, logo 32px desktop / 26px mobile |
| `client/public/jwplayer/jwplayer-8.9.3.js` | JWPlayer 8.9.3 (key lấy từ `/api/player-key`) |
| `client/src/pages/WatchMovie.jsx` | Trang xem chính: bỏ iframe, dùng player copy vsmov |
| `client/src/routes.jsx` | Gỡ route `/test-player` |
| `client/src/components/movies/MovieRow.jsx` | Thêm export `SECTION_THEMES` (task custom UI) |
| `client/src/services/adminService.js` | Thêm `getPlayerSettings`, `updatePlayerSettings` (task admin-vsphim) |
| `client/src/pages/admin/PlayerSettings.jsx` | Trang admin `/admin/player` (task admin-vsphim) |
| `client/src/pages/admin/ViewsStats.jsx` | Trang admin `/admin/views` (task admin-vsphim) |

Các file bị xóa ở commit `4c3202d` (`TestPlayer.jsx`, `TestPlayer.css`,
`playerLogic.js`, `vsmov-pom.css`) không có mặt trong bundle — xem bước 2.
