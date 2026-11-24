# PhimVietHay — Bundle Footer + About + 4 lỗi player

Ngày đóng: 24/11/2026. Bundle này gộp 3 phần đã làm xong trên sandbox
(commit local `f3e727e` + `ef192cc` + `cd9fd64`).

## Bundle này GỒM

1. **Footer** (`client/src/components/layout/Footer.jsx`)
   - Disclaimer bản quyền đặt ngang hàng với dòng copyright
     (desktop trái/phải, mobile tự xuống dòng).
   - Link cột "Khám phá" map đúng route thật của web
     (phim chiếu rạp, phim bộ, phim lẻ hành động, TV Shows, anime).
   - Link "Giới thiệu" đã gỡ chấm tròn thừa.
   - 10 chip "Từ khóa hot" bấm vào ra trang tìm kiếm
     (`/tim-kiem?keyword=...`).
2. **Trang Giới thiệu** (`client/src/pages/About.jsx`,
   `client/src/routes.jsx` — route `/gioi-thieu`,
   `client/public/about/` — 6 ảnh minh họa: home, search, catalog,
   favorites, history, profile)
   - Đủ 5 mục nội dung + mục "Xem trước giao diện" (6 ảnh chụp thật)
     + Q&A accordion 6 câu cuối trang.
3. **Sửa 4 lỗi player** (`client/src/pages/WatchMovie.jsx`, +128 dòng)
   - Phụ đề không còn đè lên thanh control bar.
   - Panel phụ đề và bảng Cài đặt cuộn được, không bị cắt
     (thấy được mục "Độ trong nền").
   - Mobile: không còn lớp phủ đen chặn chạm — chạm vào player
     ẩn/hiện control bar bình thường.
   - Bảng Cài đặt mở lên trên (dropup), không tuột xuống dưới
     khung player nữa.

## Cách áp dụng (trên máy Windows, repo phimviethay-v2)

> ⚠️ LƯU Ý QUAN TRỌNG — KHÔNG giải nén toàn bộ nếu repo của bạn mới hơn
> ở file khác: bundle này CHỈ được phép ghi đè đúng các file liệt kê
> ở mục "Danh sách file trong bundle" bên dưới. Các file khác trong repo
> của bạn (custom UI, admin, theme...) KHÔNG nằm trong bundle này và
> không được đụng tới.

1. Giải nén file `.tar.gz` này đè lên **gốc repo** (thư mục chứa
   `client/` và `server/`), sao cho các file trong bundle thay thế
   đúng các file cùng đường dẫn trong repo. Nếu dùng 7-Zip: mở file
   `.tar.gz` 2 lần (lần 1 ra `.tar`, lần 2 ra thư mục), rồi copy
   đè các file vào repo.
2. Kiểm tra `git status` — chỉ được thấy đúng các file liệt kê
   bên dưới thay đổi. Nếu thấy file khác thay đổi, DỪNG LẠI và
   kiểm tra trước khi commit.
3. Build thử:
   ```
   cd client
   npm run build
   ```
   Build phải PASS, không lỗi.
4. Commit + push lên GitHub (repo phimviethay-v2), Cloudflare Pages
   tự deploy lại. Không cần đổi `.env` — env Cloudflare Pages
   đã trỏ đúng backend v2.
5. **Trước khi test lại player:** xóa cache trình duyệt và
   unregister service worker cũ (DevTools → Application →
   Service Workers → Unregister, rồi tải lại trang). Service worker
   bản build cũ có thể phục vụ chunk JS cũ khiến bạn vẫn thấy lỗi cũ
   dù code mới đã deploy.

## Checklist test nhanh (sau khi deploy)

### Player — mở 1 phim bất kỳ (vd "Trò Chơi Vương Quyền - Phần 6" Tập 1)
- [ ] Phụ đề (sub) KHÔNG đè lên thanh control bar khi controls hiện.
- [ ] Mở panel phụ đề, cuộn xuống cuối thấy được mục "Độ trong nền"
      (không bị cắt, cuộn được).
- [ ] Mobile (điện thoại thật): chạm vào vùng giữa player thì
      control bar ẩn/hiện bình thường, không có vùng nào chạm không ăn.
- [ ] Mở bảng Cài đặt (bánh răng): bảng mở LÊN TRÊN khung player,
      bấm được đầy đủ các mục, không tuột xuống dưới.

### Footer (mọi trang)
- [ ] Dòng disclaimer bản quyền nằm ngang hàng với dòng copyright
      (desktop), mobile tự xuống dòng gọn gàng.
- [ ] Link cột "Khám phá" bấm vào ra đúng trang (chiếu rạp / phim bộ /
      phim lẻ hành động / TV Shows / anime).
- [ ] 10 chip "Từ khóa hot" bấm vào ra trang tìm kiếm với đúng từ khóa.

### Trang Giới thiệu — mở `/gioi-thieu`
- [ ] Đủ 5 mục nội dung + mục "Xem trước giao diện" hiển thị đủ 6 ảnh.
- [ ] Q&A accordion 6 câu cuối trang bấm mở/đóng được.

## Danh sách file trong bundle

```
README.md
client/src/components/layout/Footer.jsx
client/src/pages/About.jsx
client/src/routes.jsx
client/src/pages/WatchMovie.jsx
client/public/about/home.png
client/public/about/search.png
client/public/about/catalog.png
client/public/about/favorites.png
client/public/about/history.png
client/public/about/profile.png
```

Tổng: 11 file (README + 4 file code + 6 ảnh).

## Lưu ý nhỏ còn tồn (không nằm trong bundle này)

- Nút "back to top" có thể che mất chữ "chủ." cuối disclaimer trên
  desktop (mobile không bị) — đã chấp nhận để vậy, không sửa nữa.
- Phụ đề đôi khi hiện literal `<i>...</i>` (VTT bị escape) — quirk
  sẵn có từ bản copy player của vsmov, chưa sửa.
- 6 ảnh minh họa trong `client/public/about/` được chụp trên sandbox
  (API vsmov bị chặn nên một số ảnh gần như trống) — nên chụp lại
  trên máy thật nếu muốn ảnh đẹp hơn.
