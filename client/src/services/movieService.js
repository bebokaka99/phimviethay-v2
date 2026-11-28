import axios from 'axios';

// --- CẤU HÌNH API VSMOV (Nguồn chính) & NGUỒN C (Nguồn phụ/dự phòng) ---
// Vsmov Docs: https://vsmov.com/api-document — public, không cần token.
// Nguồn C Docs: https://phim.nguonc.com/api/ — public CORS (*), không cần token.
const client = axios.create({
    baseURL: 'https://vsmov.com/api',
    headers: { 'Content-Type': 'application/json' },
    timeout: 8000
});

const nguoncClient = axios.create({
    baseURL: 'https://phim.nguonc.com/api',
    headers: { 'Content-Type': 'application/json' },
    timeout: 8000
});

export const IMG_URL = '';
export let DYNAMIC_CDN = '';

// --- HELPER FUNCTIONS ---
const PLACEHOLDER = 'https://placehold.co/300x450?text=No+Image';

// --- EPISODE CACHE & QUEUE FETCHER ---
const EP_CACHE_KEY = 'pvh_episode_cache_v1';
const episodeCache = new Map();

try {
    const raw = typeof sessionStorage !== 'undefined' ? sessionStorage.getItem(EP_CACHE_KEY) : null;
    if (raw) {
        const parsed = JSON.parse(raw);
        Object.entries(parsed).forEach(([k, v]) => episodeCache.set(k, v));
    }
} catch { /* Bỏ qua nếu storage không hỗ trợ */ }

const persistEpCache = () => {
    try {
        if (typeof sessionStorage === 'undefined') return;
        const obj = Object.fromEntries(episodeCache);
        sessionStorage.setItem(EP_CACHE_KEY, JSON.stringify(obj));
    } catch { /* Bỏ qua nếu storage đầy */ }
};

const notifyEpListeners = (slug, ep) => {
    const cbs = epListeners.get(slug);
    if (cbs) {
        cbs.forEach(cb => {
            try { cb(ep); } catch { /* Bỏ qua callback lỗi */ }
        });
        epListeners.delete(slug);
    }
};

const queue = [];
let activeQueueRequests = 0;
const MAX_CONCURRENT_EP_REQUESTS = 4;
const epListeners = new Map();

const processEpQueue = () => {
    while (activeQueueRequests < MAX_CONCURRENT_EP_REQUESTS && queue.length > 0) {
        const slug = queue.shift();
        activeQueueRequests++;

        // Ưu tiên hỏi Vsmov, nếu lỗi/404 thì hỏi Nguồn C
        client.get(`/phim/${slug}`)
            .then((response) => {
                const resData = response.data;
                const ep = resData?.movie?.episode_current || 'Full';
                episodeCache.set(slug, ep);
                persistEpCache();
                notifyEpListeners(slug, ep);
            })
            .catch(() => {
                nguoncClient.get(`/film/${slug}`)
                    .then((resN) => {
                        const ep = resN.data?.movie?.current_episode || 'Full';
                        episodeCache.set(slug, ep);
                        persistEpCache();
                        notifyEpListeners(slug, ep);
                    })
                    .catch(() => {
                        episodeCache.set(slug, 'Full');
                    });
            })
            .finally(() => {
                activeQueueRequests--;
                processEpQueue();
            });
    }
};

export const fetchEpisodeCurrent = (slug, onLoaded) => {
    if (!slug) return () => {};
    const cleanSlug = slug.replace(/^player-/, '');

    if (episodeCache.has(cleanSlug)) {
        onLoaded(episodeCache.get(cleanSlug));
        return () => {};
    }

    if (!epListeners.has(cleanSlug)) {
        epListeners.set(cleanSlug, new Set());
    }
    epListeners.get(cleanSlug).add(onLoaded);

    if (!queue.includes(cleanSlug)) {
        queue.push(cleanSlug);
        processEpQueue();
    }

    return () => {
        epListeners.get(cleanSlug)?.delete(onLoaded);
    };
};

const resolveImg = (url) => {
    if (!url || typeof url !== 'string' || url === '') return PLACEHOLDER;
    if (url.startsWith('http')) return url;
    return url;
};

const slugifyText = (text = '') => {
    return text
        .toString()
        .toLowerCase()
        .normalize('NFD')
        .replace(/[\u0300-\u036f]/g, '')
        .replace(/[đĐ]/g, 'd')
        .replace(/[^a-z0-9]+/g, '-')
        .replace(/^-+|-+$/g, '');
};

const extractNguonCGroups = (categoryObj) => {
    let categories = [];
    let countries = [];
    if (!categoryObj) return { categories, countries };

    const items = Array.isArray(categoryObj) ? categoryObj : Object.values(categoryObj);
    for (const group of items) {
        const groupName = group?.group?.name;
        const list = group?.list || [];
        if (groupName === 'Thể loại') {
            categories = list.map(c => ({ id: c.id, name: c.name, slug: slugifyText(c.name) }));
        } else if (groupName === 'Quốc gia') {
            countries = list.map(c => ({ id: c.id, name: c.name, slug: slugifyText(c.name) }));
        }
    }
    return { categories, countries };
};

export const sanitizeMovie = (m = {}) => ({
    ...m,
    poster_url: typeof m.poster_url === 'string' && m.poster_url
        ? resolveImg(m.poster_url)
        : resolveImg(m.thumb_url),
    thumb_url: resolveImg(m.thumb_url),
});

export const sanitizeNguonCMovie = (item = {}) => {
    const { categories, countries } = extractNguonCGroups(item.category);
    return {
        _id: item.id || item.slug,
        name: item.name || '',
        origin_name: item.original_name || item.name || '',
        slug: item.slug || '',
        year: item.year || '',
        thumb_url: resolveImg(item.thumb_url_webp || item.thumb_url),
        poster_url: resolveImg(item.poster_url_webp || item.poster_url || item.thumb_url),
        content: item.description || '',
        episode_current: item.current_episode || 'Full',
        quality: item.quality || 'HD',
        lang: item.language || 'Vietsub',
        time: item.time || '',
        actor: typeof item.casts === 'string' ? item.casts.split(',').map(s => s.trim()) : (item.casts || []),
        director: item.director || '',
        category: categories,
        country: countries,
        tmdb: item.tmdb || { id: null, type: null, vote_average: 0, vote_count: 0 },
        imdb: item.imdb || { id: null },
        source: 'nguonc',
        is_nguonc: true,
    };
};

// --- LOGIC LỌC TRÙNG VÀ GỘP PHIM HAI NGUỒN ---
export const getMovieKey = (m) => {
    if (!m) return '';
    if (m.tmdb?.id) return `tmdb_${m.tmdb.id}`;
    if (m.imdb?.id) return `imdb_${m.imdb.id}`;
    const name = (m.original_name || m.origin_name || m.name || '')
        .toLowerCase()
        .replace(/[^a-z0-9]/g, '');
    const y = m.year || '';
    if (name) return `meta_${name}_${y}`;
    return `slug_${m.slug || ''}`;
};

export const mergeMovieLists = (vsmovItems = [], nguoncItems = []) => {
    const mergedMap = new Map();

    // 1. Ưu tiên Vsmov
    for (const item of vsmovItems) {
        if (!item || !item.slug) continue;
        const key = getMovieKey(item);
        mergedMap.set(key, {
            ...sanitizeMovie(item),
            source: 'vsmov',
            primary_slug: item.slug,
            vsmov_slug: item.slug,
        });
    }

    // 2. Gộp Nguồn C
    for (const item of nguoncItems) {
        if (!item || !item.slug) continue;
        const key = getMovieKey(item);
        if (mergedMap.has(key)) {
            const existing = mergedMap.get(key);
            existing.nguonc_slug = item.slug;
            existing.has_nguonc = true;
            if ((!existing.episode_current || existing.episode_current === 'Full') && item.current_episode) {
                existing.episode_current = item.current_episode;
            }
        } else {
            const sanitized = sanitizeNguonCMovie(item);
            mergedMap.set(key, {
                ...sanitized,
                primary_slug: item.slug,
                nguonc_slug: item.slug,
            });
        }
    }

    return Array.from(mergedMap.values());
};

const normalizeMergedList = (vRes, nRes, titlePage) => {
    const vItems = (vRes?.items || vRes?.data?.items || []).map(sanitizeMovie);
    const nItems = nRes?.items || [];
    const items = mergeMovieLists(vItems, nItems);

    const pagination = vRes?.pagination || vRes?.data?.params?.pagination || (nRes?.paginate ? {
        totalItems: nRes.paginate.total_items,
        totalItemsPerPage: nRes.paginate.items_per_page,
        currentPage: nRes.paginate.current_page,
        totalPages: nRes.paginate.total_page
    } : null);

    return {
        data: {
            items,
            titlePage: titlePage || vRes?.data?.titlePage || 'Danh sách phim',
            params: { pagination },
        },
    };
};

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

const REMAP = {
    'danh-sach/hoat-hinh': { type: 'the-loai', slug: 'hoat-hinh' },
    'danh-sach/tv-shows': { type: 'danh-sach', slug: 'phim-bo' },
    'the-loai/tv-shows': { type: 'danh-sach', slug: 'phim-bo' },
    'the-loai/tinh-cam': { type: 'the-loai', slug: 'lang-man' },
};

// --- CORE SERVICES ---

// 1. Lấy chi tiết phim — Gộp song song Vsmov & Nguồn C
export const getMovieDetail = async (slug) => {
    try {
        const cleanSlug = slug.replace(/^player-/, '');

        // Gọi song song cả Vsmov và Nguồn C trực tiếp từ trình duyệt
        const [vsmovRes, nguoncRes] = await Promise.allSettled([
            client.get(`/phim/${cleanSlug}`),
            nguoncClient.get(`/film/${cleanSlug}`)
        ]);

        const vData = (vsmovRes.status === 'fulfilled' && vsmovRes.value.data?.status) ? vsmovRes.value.data : null;
        let nMovie = (nguoncRes.status === 'fulfilled' && nguoncRes.value.data?.status === 'success' && nguoncRes.value.data?.movie) ? nguoncRes.value.data.movie : null;

        // Nếu cả hai đều không tìm thấy theo slug trực tiếp, thử tìm Nguồn C bằng search nếu slug có dấu gạch ngang
        if (!vData && !nMovie) {
            try {
                const searchRes = await nguoncClient.get('/films/search', { params: { keyword: cleanSlug.replace(/-/g, ' ') } });
                const matchedItem = searchRes.data?.items?.[0];
                if (matchedItem?.slug) {
                    const detailRes = await nguoncClient.get(`/film/${matchedItem.slug}`);
                    if (detailRes.data?.status === 'success' && detailRes.data?.movie) {
                        nMovie = detailRes.data.movie;
                    }
                }
            } catch { /* Bỏ qua fallback nếu lỗi */ }
        }

        if (!vData && !nMovie) {
            return { status: false, msg: 'Không tìm thấy phim' };
        }

        let movieObj = null;
        let episodes = [];

        // 1. Nếu Vsmov có dữ liệu: lấy Vsmov làm nguồn chính
        if (vData?.movie) {
            movieObj = sanitizeMovie(vData.movie);
            if (!movieObj.tmdb) movieObj.tmdb = { vote_average: 0, vote_count: 0 };

            // Episodes từ Vsmov
            episodes = (vData.episodes || []).map((sv) => ({
                server_name: typeof sv.server_name === 'string'
                    ? sv.server_name.replace(/\s+/g, ' ').trim()
                    : (sv.server_name || 'Vietsub #1'),
                server_data: (sv.server_data || []).map((ep) => ({
                    ...ep,
                    link_m3u8: ep.link_m3u8 || null,
                    is_nguonc: false,
                    source: 'vsmov',
                })),
            }));

            // Nếu Nguồn C cũng có phim, gộp các server dự phòng từ Nguồn C vào!
            if (nMovie?.episodes && Array.isArray(nMovie.episodes)) {
                nMovie.episodes.forEach((nSv, idx) => {
                    const svName = nSv.server_name || `Nguồn C #${idx + 1}`;
                    const customName = svName.toLowerCase().includes('lồng tiếng') 
                        ? `Lồng Tiếng (Dự phòng Nguồn C)` 
                        : `Dự phòng Nguồn C (#${idx + 1})`;

                    episodes.push({
                        server_name: customName,
                        server_data: (nSv.items || []).map((ep) => ({
                            name: String(ep.name),
                            slug: ep.slug || `tap-${ep.name}`,
                            filename: ep.name,
                            link_embed: ep.embed || '',
                            link_m3u8: null,
                            is_nguonc: true,
                            source: 'nguonc',
                        })),
                    });
                });
            }
        } 
        // 2. Nếu Vsmov không có (hoặc 404), lấy Nguồn C làm nguồn phát
        else if (nMovie) {
            movieObj = sanitizeNguonCMovie(nMovie);

            episodes = (nMovie.episodes || []).map((nSv, idx) => ({
                server_name: nSv.server_name ? `${nSv.server_name} (Nguồn C)` : `Nguồn C #${idx + 1}`,
                server_data: (nSv.items || []).map((ep) => ({
                    name: String(ep.name),
                    slug: ep.slug || `tap-${ep.name}`,
                    filename: ep.name,
                    link_embed: ep.embed || '',
                    link_m3u8: null,
                    is_nguonc: true,
                    source: 'nguonc',
                })),
            }));
        }

        if (movieObj) {
            if (movieObj.episode_current) {
                episodeCache.set(cleanSlug, movieObj.episode_current);
                persistEpCache();
                notifyEpListeners(cleanSlug, movieObj.episode_current);
            }
            return { status: true, movie: movieObj, episodes };
        }

        return { status: false, msg: 'Không tìm thấy phim' };
    } catch (error) {
        console.error('Lỗi lấy chi tiết phim:', error);
        return { status: false, msg: 'Lỗi kết nối Server' };
    }
};

// 2. Trang chủ — Gọi song song cả 2 nguồn, lọc trùng
export const getHomeData = async () => {
    try {
        const [vsmovRes, nguoncRes] = await Promise.allSettled([
            client.get('/danh-sach/phim-moi-cap-nhat', { params: { page: 1 } }),
            nguoncClient.get('/films/phim-moi-cap-nhat', { params: { page: 1 } })
        ]);

        const vData = vsmovRes.status === 'fulfilled' ? vsmovRes.value.data : null;
        const nData = nguoncRes.status === 'fulfilled' ? nguoncRes.value.data : null;

        return normalizeMergedList(vData, nData, 'Phim Mới Cập Nhật');
    } catch {
        return null;
    }
};

// 3. Danh sách phim theo slug / thể loại / quốc gia
export const getMoviesBySlug = async (slug, page = 1, type = 'danh-sach', filterParams = {}) => {
    try {
        const remapped = REMAP[`${type}/${slug}`];
        const finalType = remapped?.type || type;
        const finalSlug = remapped?.slug || slug;
        const url = `/${finalType}/${finalSlug}`;

        const [vsmovRes, nguoncRes] = await Promise.allSettled([
            client.get(url, { params: { page, ...filterParams } }),
            nguoncClient.get(`/films/${finalType}/${finalSlug}`, { params: { page } })
        ]);

        const vData = vsmovRes.status === 'fulfilled' ? vsmovRes.value.data : null;
        const nData = nguoncRes.status === 'fulfilled' ? nguoncRes.value.data : null;

        return normalizeMergedList(vData, nData);
    } catch {
        return null;
    }
};

let menuCache = null;
export const getMenuData = async () => {
    if (menuCache) return menuCache;
    let lastError = null;
    for (let attempt = 0; attempt < 3; attempt++) {
        try {
            const [theLoai, quocGia] = await Promise.all([
                client.get('/the-loai'),
                client.get('/quoc-gia')
            ]);
            menuCache = {
                theLoai: theLoai.data?.data?.items || theLoai.data?.items || [],
                quocGia: quocGia.data?.data?.items || quocGia.data?.items || []
            };
            return menuCache;
        } catch (error) {
            lastError = error;
            if (attempt < 2) await new Promise(r => setTimeout(r, 1000));
        }
    }
    console.error('Lỗi tải menu:', lastError);
    return null;
};

// 4. Tìm kiếm — Tìm kiếm đồng thời cả hai API
export const searchMovies = async (keyword, page = 1) => {
    try {
        const [vsmovRes, nguoncRes] = await Promise.allSettled([
            client.get('/tim-kiem', { params: { keyword, page } }),
            nguoncClient.get('/films/search', { params: { keyword, page } })
        ]);

        const vData = vsmovRes.status === 'fulfilled' ? vsmovRes.value.data : null;
        const nData = nguoncRes.status === 'fulfilled' ? nguoncRes.value.data : null;

        return normalizeMergedList(vData, nData, `Tìm kiếm: ${keyword}`);
    } catch {
        return null;
    }
};

export const getMoviePeoples = async (slug) => {
    try {
        const cleanSlug = slug.replace(/^player-/, '');
        const response = await client.get(`/phim/${cleanSlug}/peoples`);
        return response.data?.data?.peoples || [];
    } catch { return []; }
};

export const getMovieImages = async (slug) => {
    try {
        const cleanSlug = slug.replace(/^player-/, '');
        const response = await client.get(`/phim/${cleanSlug}/images`);
        return response.data?.data || [];
    } catch { return []; }
};
