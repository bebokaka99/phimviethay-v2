# PhimVietHay — Hướng dẫn pull & chạy local (22/11/2026)

Bản này là repo `phimviethay_git` sau khi đổi nguồn phim từ Ophim (đã chết)
sang Vsmov + gắn trình phát iframe + miếng phủ mờ che watermark. Code chỉ nằm
local ở máy này, CHƯA push lên GitHub.

## Các commit có trong bản này

- `5cbcf15` — commit gốc của repo (14/12/2025)
- `fa6302b` — đổi nguồn API Ophim → Vsmov (frontend gọi thẳng vsmov.com/api,
  sửa lỗi `vote_average` trả về dạng chuỗi)
- `40c719b` — trang xem phim dùng iframe `link_embed` thay Artplayer
  (vsmov không có `link_m3u8`)
- `c356fa0` — thử nghiệm che watermark VSbet bằng miếng phủ đen + nút bật/tắt
- `ac74d80` — đổi miếng phủ đen sang mờ (blur), nhìn tự nhiên hơn

## Pull về máy Windows

1. Tải file bundle `phimviethay-2026-11-22.tar.gz` về máy.
2. Giải nén ra `C:\phimviethay` (giữ nguyên cả thư mục ẩn `.git` trong bundle
   để còn lịch sử commit và remote GitHub).
3. Mở terminal (PowerShell) tại `C:\phimviethay`, kiểm tra:
   ```
   git log --oneline
   ```
   Phải thấy đủ 5 commit như trên, commit mới nhất là `ac74d80`.

## Chạy thử trên local

Yêu cầu: Node.js 20 trở lên (`node -v` để kiểm tra).

```powershell
cd C:\phimviethay\client
npm install --legacy-peer-deps
npm run dev
```

Mở http://localhost:5173 — trang chủ + chi tiết phim lấy dữ liệu trực tiếp
từ vsmov nên chạy được ngay, không cần backend. Bình luận / yêu thích / lịch
sử xem cần backend nên khi chưa chạy backend thì các mục đó trống, đó là
bình thường (backend vẫn trỏ về Render trong `.env.production`, còn
`.env.development` trỏ `http://localhost:5000/api`).

Muốn chạy bản production thay vì dev:

```powershell
npm run build
npm run preview
```

rồi mở địa chỉ `preview` in ra (thường là http://localhost:4173).

Lưu ý: web có PWA service worker. Nếu trình duyệt đã mở bản cũ thì bấm
Ctrl+Shift+R (hard refresh) để thấy code mới.

## Đẩy lên GitHub (tùy chọn, làm khi nào muốn deploy)

```powershell
cd C:\phimviethay
git push origin main
```

Remote `origin` đã trỏ sẵn `https://github.com/bebokaka99/phimviethay_git`.
Lần đầu push GitHub sẽ hỏi đăng nhập.

## Những việc đang dở (chưa làm)

- Server Artplayer từ m3u8: TẠM BỎ. Kiểm chứng ngày 22/11/2026: link m3u8
  của vsmov không phải video thật mà là playlist 657 ảnh PNG tĩnh (mỗi ảnh
  6 giây, không có tiếng), nên hls.js/Artplayer không phát được. Muốn video
  thật + tự điều khiển thì phải tìm nguồn khác, không phải vsmov embed.
- Backend `server/` vẫn đang trỏ Ophim ở `movieController.js` (chưa đổi sang
  vsmov) và chưa có file schema/migration nào. Hướng backend (giữ Express,
  viết lại gọn, hay bỏ backend) đang chờ quyết định.
- Lỗi nhỏ còn tồn: thẻ phim bộ vẫn hiện badge "Full" (vsmov không trả
  `episode_current`), banner có 1 pill trống do `lang` rỗng, cast/gallery
  trống (vsmov trả 404), bộ lọc Catalog bị vsmov bỏ qua.
