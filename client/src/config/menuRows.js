// Giai đoạn 3 (L10): NGUỒN DUY NHẤT cho slug hàng trang chủ + menu header.
// Trước đây Home.jsx (ROW_CONFIG) và Header.jsx (listItems) dùng 2 bộ slug
// hardcode riêng nên dễ lệch nhau. Từ nay đổi slug chỉ cần sửa 1 chỗ này.
// Mọi slug đã kiểm chứng bằng curl (23/11/2026): trả 200 + có items thật.

// Menu "Danh sách" (Header).
// L1: "Sắp Chiếu" chết (endpoint /danh-sach/phim-sap-chieu 404) -> thay bằng
// "Phim Chiếu Rạp" (686 phim thật).
// L4: "TV Shows" ẩn — vsmov không có endpoint danh sách TV shows riêng
// (đã thử tv-shows/series/tv-series/phim-truyen-hinh đều 404 hoặc 0 phim);
// "Phim Bộ" (tmdb.type='tv') đã là danh sách series thật.
export const LIST_ITEMS = [
    { name: 'Phim Mới', slug: 'phim-moi' },
    { name: 'Phim Bộ', slug: 'phim-bo' },
    { name: 'Phim Lẻ', slug: 'phim-le' },
    { name: 'Hoạt Hình', slug: 'hoat-hinh' },
    { name: 'Phim Chiếu Rạp', slug: 'phim-chieu-rap' },
];

// Hàng trang chủ (Home) — L4: không còn hàng TV Shows.
export const HOME_ROWS = [
    { title: "Phim Lẻ Mới Cập Nhật", slug: "phim-le", type: "danh-sach" },
    { title: "Phim Bộ Hot", slug: "phim-bo", type: "danh-sach" },
    { title: "Phim Hành Động", slug: "hanh-dong", type: "the-loai" },
    { title: "Phim Tình Cảm", slug: "lang-man", type: "the-loai" },
    { title: "Phim Hàn Quốc", slug: "han-quoc", type: "quoc-gia" },
    { title: "Phim Trung Quốc", slug: "trung-quoc", type: "quoc-gia" },
    { title: "Hoạt Hình / Anime", slug: "hoat-hinh", type: "the-loai" },
];

// L6: slug trùng/rỗng của API — ẩn khỏi menu (không sửa dữ liệu API).
// Thể loại: lang-mang trùng lang-man (gõ sai chính tả, 43 phim);
// drama trùng chinh-kich (800 vs 8.744 phim); action-adventure 6 phim,
// sci-fi-fantasy 7 phim (gần như rỗng).
export const HIDDEN_GENRE_SLUGS = ['lang-mang', 'drama', 'action-adventure', 'sci-fi-fantasy'];

// Quốc gia: china 0 phim, trung-quoc-dai-luc 1 phim (trùng trung-quoc).
// au-my giữ lại (10.153 phim) nhưng là khu vực, không phải nước —
// hiển thị với nhãn "Khu vực" trong menu.
export const HIDDEN_COUNTRY_SLUGS = ['china', 'trung-quoc-dai-luc'];

// H2: chip "Phổ biến" đầu mega-menu (chọn theo số phim thật từ API).
export const POPULAR_GENRES = [
    { name: 'Hành Động', slug: 'hanh-dong' },
    { name: 'Lãng Mạn', slug: 'lang-man' },
    { name: 'Hài', slug: 'hai' },
    { name: 'Chính Kịch', slug: 'chinh-kich' },
    { name: 'Kinh Dị', slug: 'kinh-di' },
    { name: 'Phiêu Lưu', slug: 'phieu-luu' },
];

export const POPULAR_COUNTRIES = [
    { name: 'Hàn Quốc', slug: 'han-quoc' },
    { name: 'Trung Quốc', slug: 'trung-quoc' },
    { name: 'Mỹ', slug: 'my' },
    { name: 'Việt Nam', slug: 'viet-nam' },
    { name: 'Âu Mỹ', slug: 'au-my' },
    { name: 'Nhật Bản', slug: 'nhat-ban' },
];

// H5: gợi ý tìm kiếm phổ biến khi ô tìm kiếm trống.
export const POPULAR_SEARCHES = ['Dâu Tây Ngọt Ngào', 'Hàn Quốc', 'Hành Động', 'Chuyến Tàu Băng Giá', 'Hoạt Hình', 'Phim Chiếu Rạp'];
