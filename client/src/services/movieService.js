import axios from 'axios';
import axiosInstance from './axiosConfig'; // Dùng instance đã cấu hình chuẩn (cho các API backend riêng: auth/favorite/history...)

// --- CẤU HÌNH API VSMOV (thay Ophim đã chết 22/11/2026) ---
// Docs: https://vsmov.com/api-document — public, không cần token.
// Vsmov trả list dạng { status, items, pagination } (top-level),
// khác Ophim { data: { items, params: { pagination }, titlePage } }.
// Các trang trong repo đang đọc data.data.items nên cần adapter normalize
// về đúng shape Ophim cũ để không phải sửa Home/Catalog/SearchPage/LazyMovieRow.
const client = axios.create({
    baseURL: 'https://vsmov.com/api',
    headers: { 'Content-Type': 'application/json' }
});

// Ophim đã bỏ: không còn CDN ảnh riêng, vsmov trả poster/thumb là URL đầy đủ.
export const IMG_URL = '';
export let DYNAMIC_CDN = '';

// --- HELPER FUNCTIONS ---
const PLACEHOLDER = 'https://placehold.co/300x450?text=No+Image';

// Vsmov có vài phim poster_url = {} (object rỗng) -> phải guard typeof string,
// nếu không .startsWith sẽ crash cả trang.
const resolveImg = (url) => {
    if (!url || typeof url !== 'string' || url === '') return PLACEHOLDER;
    if (url.startsWith('http')) return url;
    return url;
};

const sanitizeMovie = (m = {}) => ({
    ...m,
    poster_url: typeof m.poster_url === 'string' && m.poster_url
        ? resolveImg(m.poster_url)
        : resolveImg(m.thumb_url),
    thumb_url: resolveImg(m.thumb_url),
});

// Chuẩn hoá response list của vsmov về shape Ophim cũ:
// { data: { items, titlePage, params: { pagination } } }
const normalizeList = (resData, titlePage) => {
    const items = (resData?.items || resData?.data?.items || []).map(sanitizeMovie);
    const pagination = resData?.pagination || resData?.data?.params?.pagination || null;
    return {
        data: {
            items,
            titlePage: titlePage || resData?.data?.titlePage || 'Danh sách phim',
            params: { pagination },
        },
    };
};

// Vsmov không có /danh-sach/hoat-hinh và /danh-sach/tv-shows (404),
// /the-loai/tinh-cam trả 0 phim -> remap về endpoint có dữ liệu thật.
const REMAP = {
    'danh-sach/hoat-hinh': { type: 'the-loai', slug: 'hoat-hinh' },
    'danh-sach/tv-shows': { type: 'danh-sach', slug: 'phim-bo' },
    'the-loai/tinh-cam': { type: 'the-loai', slug: 'lang-man' },
};

// --- CORE SERVICES ---

// 1. Lấy chi tiết phim — TẠM GỌI TRỰC TIẾP VSMOV (22/11/2026).
// Trước đây gọi backend mình (/movies/phim/{slug}) để backend sync từ Ophim,
// nhưng backend đó gọi ophim1.com/phim/{slug} đã 404 nên chi tiết sẽ chết.
// Khi nào chốt hướng backend mới thì chuyển lại về backend + sync DB.
export const getMovieDetail = async (slug) => {
    try {
        const cleanSlug = slug.replace(/^player-/, '');
        const response = await client.get(`/phim/${cleanSlug}`);
        const resData = response.data;

        if (resData?.status && resData.movie) {
            const movieObj = sanitizeMovie(resData.movie);
            if (!movieObj.tmdb) movieObj.tmdb = { vote_average: 0, vote_count: 0 };

            // Vsmov chỉ trả link_embed, CHƯA có link_m3u8 (player chưa đụng tới).
            // Dọn server_name dính rác "Vietsub\r\n #1" -> "Vietsub #1".
            const episodes = (resData.episodes || []).map((sv) => ({
                server_name: typeof sv.server_name === 'string'
                    ? sv.server_name.replace(/\s+/g, ' ').trim()
                    : (sv.server_name || 'Vietsub'),
                server_data: (sv.server_data || []).map((ep) => ({
                    ...ep,
                    link_m3u8: ep.link_m3u8 || null,
                })),
            }));

            return { status: true, movie: movieObj, episodes };
        }
        return { status: false, msg: 'Không tìm thấy phim' };
    } catch (error) {
        console.error('Lỗi lấy chi tiết phim:', error);
        return { status: false, msg: 'Lỗi kết nối Server' };
    }
};

// 2. Lấy Trending từ Backend mình (giữ nguyên — backend Render hiện trả []).
export const getTrendingMovies = async () => {
    try {
        const data = await axiosInstance.get(`/movies/trending`);
        return (Array.isArray(data) ? data : []).map(m => ({
            ...m,
            thumb_url: resolveImg(m.thumb_url),
            poster_url: resolveImg(m.poster_url),
            origin_name: `${m.view_count || 0} lượt xem`
        }));
    } catch (e) {
        return [];
    }
};

// 3. Home banner — vsmov KHÔNG có /home (404) nên lấy phim mới cập nhật thay thế.
export const getHomeData = async () => {
    try {
        const response = await client.get('/danh-sach/phim-moi-cap-nhat', { params: { page: 1 } });
        return normalizeList(response.data);
    } catch (error) { return null; }
};

export const getMoviesBySlug = async (slug, page = 1, type = 'danh-sach', filterParams = {}) => {
    try {
        // Lưu ý: vsmov bỏ qua filter category/country/year/sort_field/limit,
        // chỉ lọc được 1 thể loại/quốc gia duy nhất qua path. Cứ gửi kèm cho đủ,
        // lọc nhiều điều kiện sẽ xử lý ở bước sau (hoặc bỏ filter).
        const remapped = REMAP[`${type}/${slug}`];
        const finalType = remapped?.type || type;
        const finalSlug = remapped?.slug || slug;
        const url = `/${finalType}/${finalSlug}`;
        const response = await client.get(url, { params: { page, ...filterParams } });
        return normalizeList(response.data);
    } catch (error) { return null; }
};

export const getMenuData = async () => {
    try {
        const [theLoai, quocGia] = await Promise.all([
            client.get('/the-loai'),
            client.get('/quoc-gia')
        ]);
        // Vsmov: { status: "success", data: { items } } — khớp shape Ophim cũ.
        return {
            theLoai: theLoai.data?.data?.items || theLoai.data?.items || [],
            quocGia: quocGia.data?.data?.items || quocGia.data?.items || []
        };
    } catch (error) { return { theLoai: [], quocGia: [] }; }
};

export const searchMovies = async (keyword, page = 1) => {
    try {
        const response = await client.get('/tim-kiem', { params: { keyword, page } });
        return normalizeList(response.data);
    } catch (error) { return null; }
};

// Vsmov không có 2 endpoint này (404) -> catch trả [] như cũ,
// dàn cast sẽ trống, bù bằng TMDB fallback (vsmov vẫn trả tmdb/imdb id).
export const getMoviePeoples = async (slug) => {
    try {
        const cleanSlug = slug.replace(/^player-/, '');
        const response = await client.get(`/phim/${cleanSlug}/peoples`);
        return response.data?.data?.peoples || [];
    } catch (error) { return []; }
};

export const getMovieImages = async (slug) => {
    try {
        const cleanSlug = slug.replace(/^player-/, '');
        const response = await client.get(`/phim/${cleanSlug}/images`);
        return response.data?.data || [];
    } catch (error) { return []; }
};
