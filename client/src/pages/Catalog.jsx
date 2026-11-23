import React, { useEffect, useState } from 'react';
import { useParams, useNavigate, useSearchParams } from 'react-router-dom';
import { Helmet } from 'react-helmet-async';
import { 
    FaFilter, FaCheck, FaTags, FaTrashAlt, 
    FaLayerGroup, FaGlobe, FaFilm, FaCalendarAlt,
    FaChevronLeft, FaChevronRight, FaFire, FaHeart, FaGhost, 
    FaLaughSquint, FaSearch, FaBolt, FaStar, FaTv
} from 'react-icons/fa';
import MovieGrid from '../components/movies/MovieGrid';
import { MovieGridSkeleton } from '../components/common/Skeleton';
import { getMoviesBySlug, getMenuData } from '../services/movieService';
import { HIDDEN_GENRE_SLUGS, HIDDEN_COUNTRY_SLUGS } from '../config/menuRows';

// --- CONSTANTS ---
// C1 (23/11/2026) — khả năng lọc THẬT của vsmov, kiểm chứng bằng curl:
// - 1 điều kiện chính qua path: /the-loai/<1 slug> | /quoc-gia/<1 slug>
//   | /danh-sach/<1 slug>. Nhiều slug (dấu phẩy) hoặc nhiều giá trị 1
//   param đều trả 0 phim.
// - /the-loai/<slug> NHẬN THÊM: ?country=<1 slug> (4178 -> 223 phim) và
//   ?year=<yyyy> (4178 -> 296, toàn 2024). Cả 3 cùng lúc: 4178 -> 16 phim.
// - /quoc-gia/<slug> NHẬN THÊM: ?year=<yyyy> (1217 -> 92, toàn 2024).
//   Param category/genre/the-loai trên endpoint này bị bỏ qua.
// - /danh-sach/<slug> (phim-le/phim-bo/phim-moi/...): country/year/
//   category/sort_* đều bị bỏ qua. Loại phim lẻ/bộ chính là path.
// - /the-loai/hoat-hinh (đích remap của /danh-sach/hoat-hinh) nhận thêm
//   country+year như mọi /the-loai/* khác (342 / 15 phim).
// - sort_field/sort_type bị bỏ qua ở mọi endpoint -> KHÔNG có sắp xếp.
// - Vì vậy: mỗi chiều chỉ chọn 1 (single-select), nhưng thể loại +
//   quốc gia + năm ĐƯỢC kết hợp; phim lẻ/bộ thì không kết hợp thêm gì.
const FILTER_DATA = {
    type: [ { name: 'Phim lẻ', value: 'phim-le' }, { name: 'Phim bộ', value: 'phim-bo' }, { name: 'Hoạt hình', value: 'hoat-hinh' } ],
    // Năm: 2026 (năm hiện tại theo dữ liệu API) lùi về 2010, mỗi năm 1 pill.
    years: Array.from({ length: 17 }, (_, i) => 2026 - i).map(y => ({ name: String(y), value: String(y) })),
};

// Helper Icon Header
const getHeaderIcon = (title) => {
    const t = (title || '').toLowerCase();
    if (t.includes('hành động')) return <FaFire className="text-red-500" />;
    if (t.includes('tình cảm')) return <FaHeart className="text-pink-500" />;
    if (t.includes('kinh dị')) return <FaGhost className="text-gray-400" />;
    if (t.includes('hài')) return <FaLaughSquint className="text-yellow-400" />;
    if (t.includes('mới') || t.includes('new')) return <FaBolt className="text-blue-400" />;
    if (t.includes('hot') || t.includes('nổi bật')) return <FaStar className="text-yellow-500" />;
    if (t.includes('bộ') || t.includes('series')) return <FaTv className="text-purple-500" />;
    return <FaFilm className="text-[var(--accent)]" />;
};

// Filter Pill
const FilterPill = ({ label, active, onClick }) => (
    <button 
        onClick={onClick} 
        className={`px-3 py-1.5 rounded-lg text-xs font-bold transition-all duration-300 border flex items-center justify-center gap-2 whitespace-nowrap active:scale-95
        ${active 
            ? 'bg-[var(--accent)] text-white border-[var(--accent)] shadow-[0_0_15px_rgba(var(--accent-rgb),0.4)]' 
            : 'bg-transparent text-gray-400 border-transparent hover:bg-white/5 hover:text-white hover:border-white/10'}`}
    >
        {label}
    </button>
);

// Filter Row — disabled: hàng bị vô hiệu (vd: Năm khi chưa chọn điều kiện
// chính nào mà API cho phép kết hợp năm) thì mờ + không bấm được, kèm hint.
const FilterRow = ({ label, icon, items, activeValue, onSelect, isMulti = false, gridClass = "flex flex-wrap gap-1", disabled = false, hint = '' }) => (
    <div className="flex flex-col md:flex-row gap-3 md:gap-6 border-b border-white/5 py-5 last:border-0 hover:bg-white/[0.02] transition-colors rounded-xl px-2 -mx-2">
        <div className="w-36 flex-shrink-0 pt-1 md:text-right flex items-center md:justify-end gap-3 group">
            <span className="text-gray-200 font-bold text-xs uppercase tracking-widest group-hover:text-white transition-colors">{label}</span>
            <div className="w-9 h-9 rounded-xl bg-white/5 flex items-center justify-center shadow-sm border border-white/5 group-hover:border-white/20 group-hover:bg-white/10 transition-all">
                {icon}
            </div>
        </div>
        <div className="flex-1 min-w-0">
            <div className={`${gridClass} ${disabled ? 'opacity-40 pointer-events-none' : ''}`}>
                <FilterPill label="Tất cả" active={isMulti ? (!activeValue || activeValue.length === 0) : activeValue === ''} onClick={() => onSelect('')} />
                {items?.map((item) => {
                    const val = item.slug !== undefined ? item.slug : item.value;
                    const isActive = isMulti ? activeValue?.includes(val) : activeValue === val;
                    return <FilterPill key={val} label={item.name} active={isActive} onClick={() => onSelect(val)} />;
                })}
            </div>
            {disabled && hint && (
                <p className="text-xs text-gray-500 italic mt-2">{hint}</p>
            )}
        </div>
    </div>
);

// Pagination
const Pagination = ({ currentPage, totalPages, onPageChange }) => {
    if (totalPages <= 1) return null;
    let pages = [];
    if (totalPages <= 7) {
        pages = Array.from({ length: totalPages }, (_, i) => i + 1);
    } else {
        if (currentPage <= 4) pages = [1, 2, 3, 4, 5, '...', totalPages];
        else if (currentPage >= totalPages - 3) pages = [1, '...', totalPages - 4, totalPages - 3, totalPages - 2, totalPages - 1, totalPages];
        else pages = [1, '...', currentPage - 1, currentPage, currentPage + 1, '...', totalPages];
    }

    return (
        <div className="flex justify-center items-center gap-2 mt-16 pb-10">
            <button onClick={() => onPageChange(currentPage - 1)} disabled={currentPage === 1} className="w-9 h-9 rounded-lg flex items-center justify-center bg-white/5 text-gray-400 hover:bg-[var(--accent)] hover:text-white transition disabled:opacity-30 disabled:cursor-not-allowed"><FaChevronLeft size={10}/></button>
            {pages.map((p, i) => (
                <button 
                    key={i} 
                    onClick={() => typeof p === 'number' && onPageChange(p)} 
                    disabled={typeof p !== 'number'}
                    className={`w-9 h-9 rounded-lg text-sm font-bold flex items-center justify-center transition-all
                    ${p === currentPage 
                        ? 'bg-[var(--accent)] text-white shadow-lg shadow-red-900/40' 
                        : typeof p === 'number' 
                            ? 'bg-white/5 text-gray-400 hover:bg-white/10 hover:text-white' 
                            : 'text-gray-600 bg-transparent cursor-default'}`}
                >
                    {p}
                </button>
            ))}
            <button onClick={() => onPageChange(currentPage + 1)} disabled={currentPage === totalPages} className="w-9 h-9 rounded-lg flex items-center justify-center bg-white/5 text-gray-400 hover:bg-[var(--accent)] hover:text-white transition disabled:opacity-30 disabled:cursor-not-allowed"><FaChevronRight size={10}/></button>
        </div>
    );
};

// C1: suy ra ĐÚNG điều kiện API sẽ áp dụng từ URL (group + slug + query),
// dùng chung cho: đồng bộ state bộ lọc, fetch dữ liệu và tag/tiêu đề.
// Thứ tự ưu tiên giống nhau ở cả 3 chỗ nên tag không bao giờ hiện điều
// kiện bị API bỏ qua. Điều kiện không có endpoint nào nhận (vd: chỉ chọn
// năm, hoặc category kèm quoc-gia base) bị loại khỏi `eff`.
// Vòng 2 (23/11/2026): KHÔNG đọc ?type= trên trang the-loai/quoc-gia nữa
// — không code nào sinh param này, và nó có thể cướp mất điều kiện chính
// trên path (vd: /the-loai/hanh-dong?type=phim-bo sẽ hiện nhầm Phim Bộ).
// Điều kiện chính luôn lấy từ path; ?type= chỉ còn ý nghĩa khi group là
// danh-sach — mà lúc đó nó chính là slug nên cũng không cần đọc.
const deriveEffective = (group, slug, searchParams) => {
    const urlType = group === 'danh-sach' ? slug : '';
    let urlCat = searchParams.get('category') ? searchParams.get('category').split(',')[0] : '';
    let urlCountry = searchParams.get('country') ? searchParams.get('country').split(',')[0] : '';
    const urlYear = searchParams.get('year') || '';
    if (group === 'the-loai') urlCat = slug;
    if (group === 'quoc-gia') urlCountry = slug;

    let apiSlug = 'phim-moi', apiType = 'danh-sach';
    const eff = { category: '', country: '', type: '', year: '' };
    if (urlType && urlType !== 'phim-moi') {
        apiSlug = urlType; apiType = 'danh-sach'; eff.type = urlType;
        // Chỉ hoat-hinh (remap -> /the-loai/hoat-hinh) nhận thêm country+year.
        if (urlType === 'hoat-hinh') { eff.country = urlCountry; eff.year = urlYear; }
    } else if (urlCat) {
        apiSlug = urlCat; apiType = 'the-loai';
        eff.category = urlCat; eff.country = urlCountry; eff.year = urlYear;
    } else if (urlCountry) {
        apiSlug = urlCountry; apiType = 'quoc-gia';
        eff.country = urlCountry; eff.year = urlYear;
    }
    return { apiSlug, apiType, ...eff };
};

// Param phụ (?country=, ?year=) chỉ gửi khi endpoint đích thật sự nhận
// (xem bảng ở FILTER_DATA). Gửi kèm lên /danh-sach/* cũng vô hại nhưng
// dễ gây hiểu lầm là API có lọc nên KHÔNG gửi.
const buildFilterParams = (apiType, apiSlug, eff) => {
    const params = {};
    if (apiType === 'the-loai') {
        if (eff.country) params.country = eff.country;
        if (eff.year) params.year = eff.year;
    } else if (apiType === 'quoc-gia') {
        if (eff.year) params.year = eff.year;
    } else if (apiType === 'danh-sach' && apiSlug === 'hoat-hinh') {
        if (eff.country) params.country = eff.country;
        if (eff.year) params.year = eff.year;
    }
    return params;
};

// Vòng 2 (23/11/2026): tiêu đề + tag được TÍNH TRỰC TIẾP lúc render từ
// cùng deriveEffective với fetch — không qua useEffect/setState nữa.
// Trước đây có 2 nơi cùng ghi `title` (fetchData ghi titlePage khi
// title còn rỗng, effect tag ghi tiêu đề theo điều kiện lọc) nên đua nhau:
// tải mới trang /danh-sach/hoat-hinh hay /quoc-gia/han-quoc?year=2024 thì
// H1 ra "Danh sách phim" chung chung thay vì "Hoạt hình" / "Hàn Quốc •
// 2024"; còn sau khi Xóa bộ lọc thì H1 vẫn dính tiêu đề lọc cũ ("Hàn Quốc
// • 2024") dù tag đã hết và dữ liệu đã là phim-mới. Tính lúc render thì
// tiêu đề luôn khớp đúng URL đang hiển thị, kể cả khi menu chưa tải xong
// (tên thể loại/quốc gia hiện sau khi menu về, giống hành vi cũ).
const deriveTitleAndTags = (eff, menuData) => {
    const tags = [], titleParts = [];
    const pushTag = (label) => { if (label) { tags.push({ label }); titleParts.push(label); } };
    if (eff.type && eff.type !== 'phim-moi') {
        const name = eff.type === 'tv-shows' ? 'Phim Bộ' : FILTER_DATA.type.find(t => t.value === eff.type)?.name;
        pushTag(name);
    }
    if (eff.category) pushTag(menuData.theLoai.find(i => i.slug === eff.category)?.name);
    if (eff.country) pushTag(menuData.quocGia.find(i => i.slug === eff.country)?.name);
    if (eff.year) pushTag(eff.year);
    return { tags, titleParts };
};

const Catalog = ({ group }) => {
    const { slug } = useParams();
    const [searchParams, setSearchParams] = useSearchParams();
    const navigate = useNavigate();
    const currentPage = parseInt(searchParams.get('page')) || 1;
    
    // --- STATE LOGIC (GIỮ NGUYÊN) ---
    const [movies, setMovies] = useState([]);
    const [menuData, setMenuData] = useState({ theLoai: [], quocGia: [] });
    const [totalPages, setTotalPages] = useState(1);
    const [loading, setLoading] = useState(true);
    // Vòng 2: apiTitle chỉ là tiêu đề dự phòng khi URL không có điều kiện
    // lọc nào (vsmov không trả titlePage nên thực tế luôn là "Danh sách
    // phim"). Tiêu đề hiển thị + tag được tính lúc render (xem
    // deriveTitleAndTags), không còn state `title`/`activeTags` riêng.
    const [apiTitle, setApiTitle] = useState('');
    const [showFilter, setShowFilter] = useState(false);
    // C1: mỗi chiều chỉ chọn 1 giá trị (API chỉ nhận 1 slug/param), NHƯNG
    // thể loại + quốc gia + năm được kết hợp với nhau (xem FILTER_DATA).
    // Chỉ loại hình phim lẻ/bộ là loại trừ với mọi chiều khác.
    const [selectedFilters, setSelectedFilters] = useState({ category: '', country: '', type: '', year: '' });

    // Năm chỉ có tác dụng khi đi kèm thể loại, quốc gia hoặc Hoạt hình
    // (API không lọc được theo năm riêng lẻ) -> hàng Năm bị khóa khi
    // chưa có điều kiện chính nào trong 3 loại đó.
    const yearEnabled = !!selectedFilters.category || !!selectedFilters.country || selectedFilters.type === 'hoat-hinh';

    // Giai đoạn 3 (L6): bộ lọc cũng ẩn slug trùng/rỗng như menu header.
    const visibleGenres = menuData.theLoai.filter(g => !HIDDEN_GENRE_SLUGS.includes(g.slug));
    const visibleCountries = menuData.quocGia.filter(c => !HIDDEN_COUNTRY_SLUGS.includes(c.slug));

    useEffect(() => { getMenuData().then(data => data && setMenuData(data)); }, []);

    useEffect(() => {
        // C1: state bộ lọc = đúng điều kiện API sẽ áp dụng (deriveEffective),
        // nên panel không bao giờ hiện lựa chọn "ảo" mà URL không lọc thật.
        const { category, country, type, year } = deriveEffective(group, slug, searchParams);
        setSelectedFilters({ category, country, type, year });
    }, [group, slug, searchParams]);

    useEffect(() => {
        window.scrollTo(0, 0);
        const fetchData = async () => {
            setLoading(true);
            try {
                // C1: lọc đa điều kiện thật qua API — điều kiện chính qua
                // path + ?country=/?year= theo đúng endpoint đích
                // (buildFilterParams). Không gửi sort_field/year lên
                // /danh-sach/* vì vsmov bỏ qua hết.
                const { apiSlug, apiType, category, country, type, year } = deriveEffective(group, slug, searchParams);
                const filterParams = buildFilterParams(apiType, apiSlug, { category, country, type, year });

                const data = await getMoviesBySlug(apiSlug, currentPage, apiType, filterParams);
                if (data?.data?.items) {
                    setMovies(data.data.items);
                    // Vòng 2: chỉ ghi lại tiêu đề API làm dự phòng; tiêu đề
                    // hiển thị do deriveTitleAndTags tính lúc render nên
                    // không còn chuyện fetch về sau ghi đè tiêu đề lọc.
                    setApiTitle(data.data.titlePage || 'Danh sách phim');
                    const pagination = data.data.params?.pagination;
                    if (pagination) setTotalPages(Math.ceil(pagination.totalItems / pagination.totalItemsPerPage));
                } else { setMovies([]); }
            } catch (error) { console.error(error); } finally { setLoading(false); }
        };
        fetchData();
    }, [slug, currentPage, group, searchParams]);

    // Vòng 2: tiêu đề + tag tính lúc render từ đúng điều kiện API đang áp
    // dụng (cùng deriveEffective với fetchData) — luôn khớp URL hiện tại.
    const effective = deriveEffective(group, slug, searchParams);
    const { tags: activeTags, titleParts } = deriveTitleAndTags(effective, menuData);
    const title = titleParts.length > 0 ? titleParts.join(' • ') : (apiTitle || 'Danh sách phim');

    // Handlers
    // C1: điều hướng theo điều kiện CHÍNH (path) + điều kiện phụ (query)
    // đúng như API nhận: thể loại -> /the-loai/<slug>?country=&year=,
    // quốc gia -> /quoc-gia/<slug>?year=, loại hình -> /danh-sach/<slug>
    // (riêng hoat-hinh giữ country/year vì remap về /the-loai/hoat-hinh).
    // Chỉ chọn năm (không có điều kiện chính) thì API không lọc được nên
    // nút Áp dụng đã bị khóa ở hàng Năm — nhánh cuối chỉ là phòng thủ.
    // Vòng 2 (23/11/2026): Hoạt hình PHẢI xét trước Quốc gia — trước đây
    // nhánh country đứng trước nên chọn Hoạt hình + Hàn Quốc + 2024 rồi
    // bấm Áp dụng lại ra /quoc-gia/han-quoc?year=2024, mất hẳn Hoạt hình
    // (24 phim Hàn 2024 thay vì 3 phim hoạt hình Hàn 2024). Đây là tổ hợp
    // duy nhất mà thứ tự nhánh làm sai lệch kết quả lọc thật.
    const handleApplyFilter = () => {
        const { category, country, type, year } = selectedFilters;
        let path = '/danh-sach/phim-moi';
        const params = new URLSearchParams();
        if (category) {
            path = `/the-loai/${category}`;
            if (country) params.set('country', country);
            if (year) params.set('year', year);
        } else if (type === 'hoat-hinh') {
            path = '/danh-sach/hoat-hinh';
            if (country) params.set('country', country);
            if (year) params.set('year', year);
        } else if (country) {
            path = `/quoc-gia/${country}`;
            if (year) params.set('year', year);
        } else if (type) {
            path = `/danh-sach/${type}`;
        }
        params.set('page', '1');
        navigate(`${path}?${params.toString()}`); setShowFilter(false);
    };

    const handleClearFilter = () => { setSelectedFilters({ category: '', country: '', type: '', year: '' }); navigate('/danh-sach/phim-moi'); setShowFilter(false); };
    // C1: kết hợp theo đúng khả năng API — thể loại + quốc gia + năm
    // được chọn cùng lúc; chỉ loại hình phim lẻ/bộ là loại trừ mọi chiều
    // khác (vì /danh-sach/phim-le|phim-bo bỏ qua mọi param phụ). Hoat-hinh
    // là ngoại lệ: giữ được quốc gia + năm nhờ remap về /the-loai/*.
    // Vòng 2 (23/11/2026): (1) năm KHÔNG được "dính" lại khi điều kiện
    // chính cuối cùng bị bỏ chọn — trước đây chọn Hàn Quốc + 2024 rồi bấm
    // "Tất cả" ở hàng Quốc gia thì pill 2024 vẫn đỏ trong khi hàng Năm đã
    // khóa, bấm Áp dụng thì năm bị lặng lẽ bỏ (ra /danh-sach/phim-moi),
    // panel hiện một đằng, kết quả một nẻo. (2) chặn chọn năm khi hàng Năm
    // đang khóa (khóa trước đây chỉ là CSS pointer-events nên vẫn bấm
    // được bằng bàn phím/gọi trực tiếp).
    const setFilterValue = (key, value) => {
        setSelectedFilters(prev => {
            if (key === 'year' && value) {
                const enabled = !!prev.category || !!prev.country || prev.type === 'hoat-hinh';
                if (!enabled) return prev;
            }
            const next = { ...prev, [key]: value };
            if (key === 'category' && value) { next.type = ''; }
            if (key === 'country' && value) { if (next.type && next.type !== 'hoat-hinh') next.type = ''; }
            if (key === 'type' && value) {
                if (value === 'hoat-hinh') { next.category = ''; }
                else { next.category = ''; next.country = ''; next.year = ''; }
            }
            // Năm chỉ có nghĩa khi còn ít nhất 1 điều kiện chính mà API
            // cho kết hợp năm (thể loại / quốc gia / Hoạt hình).
            if (next.year && !next.category && !next.country && next.type !== 'hoat-hinh') next.year = '';
            return next;
        });
    };
    const handlePageChange = (newPage) => { if (newPage >= 1 && newPage <= totalPages) setSearchParams(prev => { prev.set('page', newPage); return prev; }); };

    // --- RENDER ---
    return (
        <div className="min-h-screen text-white font-sans overflow-x-hidden relative bg-transparent">
            <Helmet>
                <title>{title ? `${title} | PhimVietHay` : 'Danh sách phim - PhimVietHay'}</title>
                <meta name="description" content={`Xem danh sách ${title} mới nhất...`} />
            </Helmet>

            {/* AMBIENT GLOW */}
            <div className="absolute top-0 left-0 w-full h-[300px] bg-gradient-to-b from-red-900/10 via-red-900/5 to-transparent pointer-events-none -z-10" />

            <div className="pt-24 px-4 md:px-8 container mx-auto pb-20">
                
                {/* 1. HEADER: FIX MOBILE */}
                {/* [MOBILE FIX] Thêm items-start trên mobile để nút và tiêu đề không bị lệch, mt-4 cho nút */}
                <div className="flex flex-col md:flex-row md:items-end justify-between gap-6 mb-10 border-b border-white/5 pb-8 relative">
                    {/* Background Light Spot */}
                    <div className="absolute top-0 left-0 w-32 h-32 bg-red-600/20 rounded-full blur-[60px] pointer-events-none -mt-10 -ml-10"></div>

                    <div className="relative z-10 w-full md:w-auto">
                        {/* Tagline */}
                        <div className="flex items-center gap-2 mb-2 animate-fade-in">
                            <div className="h-[2px] w-8 bg-[var(--accent)] shadow-[0_0_10px_rgba(var(--accent-rgb),0.8)]"></div>
                            <span className="text-xs md:text-sm font-bold text-[var(--accent)] uppercase tracking-[0.2em] drop-shadow-sm">Khám phá vũ trụ phim</span>
                        </div>

                        {/* Massive Title with Icon Box */}
                        <div className="flex items-center gap-4 md:gap-6">
                            {/* Glass Icon Box: Nhỏ hơn trên mobile (w-12 h-12) */}
                            <div className="flex-shrink-0 w-12 h-12 md:w-20 md:h-20 rounded-2xl bg-gradient-to-br from-white/10 to-transparent border border-white/10 backdrop-blur-md shadow-2xl flex items-center justify-center text-2xl md:text-5xl animate-fade-up">
                                {getHeaderIcon(title)}
                            </div>
                            
                            {/* Text with Gradient & Shadow */}
                            {/* [MOBILE FIX] Giảm font-size xuống text-2xl/3xl, thêm line-clamp để không vỡ layout */}
                            <h2 className="flex-1 text-1xl md:text-3xl lg:text-3xl font-black uppercase tracking-tighter text-transparent bg-clip-text bg-gradient-to-r from-white via-gray-200 to-gray-500 drop-shadow-[0_5px_15px_rgba(0,0,0,0.5)] animate-fade-up delay-100 line-clamp-2 md:line-clamp-1 py-1">
                                {title || 'Kho Phim'}
                            </h2>
                        </div>
                    </div>
                    
                    {/* Filter Button */}
                    {/* [MOBILE FIX] Nút full width trên mobile để dễ bấm */}
                    <button 
                        onClick={() => setShowFilter(!showFilter)} 
                        className={`w-full md:w-auto group flex items-center justify-center gap-3 px-7 py-3.5 rounded-full font-bold text-sm transition-all shadow-xl backdrop-blur-md border animate-fade-in delay-200
                        ${showFilter 
                            ? 'bg-[var(--accent)] text-white border-[var(--accent)] ring-4 ring-[var(--accent)] scale-105' 
                            : 'bg-white/5 text-gray-300 border-white/10 hover:bg-white/10 hover:text-white hover:border-white/30 hover:-translate-y-1'}`}
                    >
                        <FaFilter className={`text-sm transition-transform duration-300 ${showFilter ? 'rotate-180' : ''}`} /> 
                        {showFilter ? 'Đóng bộ lọc' : 'Bộ lọc tìm kiếm'}
                    </button>
                </div>

                {/* 2. ACTIVE TAGS */}
                {activeTags.length > 0 && !showFilter && (
                    <div className="flex flex-wrap items-center gap-2 mb-8 animate-fade-in-down px-1">
                        <span className="text-xs font-bold text-gray-500 uppercase tracking-wider mr-2">Đang lọc:</span>
                        {activeTags.map((tag, idx) => (
                            <div key={idx} className="bg-white/5 border border-white/10 px-4 py-1.5 rounded-full text-xs font-bold flex items-center gap-2 shadow-sm text-gray-300 hover:border-white/30 transition-colors">
                                <FaTags className="text-[var(--accent)] text-[10px]" /> {tag.label}
                            </div>
                        ))}
                        <button onClick={handleClearFilter} className="text-xs text-red-500 font-bold hover:text-red-400 ml-2 hover:underline flex items-center gap-1"><FaTrashAlt/> Xóa tất cả</button>
                    </div>
                )}

                {/* 3. FILTER HUD */}
                <div className={`overflow-hidden transition-all duration-500 ease-in-out ${showFilter ? 'max-h-[3000px] opacity-100 mb-16' : 'max-h-0 opacity-0 mb-0'}`}>
                    <div className="bg-white/5 backdrop-blur-2xl border border-white/10 p-6 md:p-10 rounded-3xl shadow-2xl relative overflow-hidden ring-1 ring-white/5">
                        <div className="absolute top-0 right-0 p-12 opacity-[0.03] pointer-events-none transform rotate-12"><FaFilter size={250} /></div>

                        <div className="relative z-10 space-y-2">
                            {/* C1 + vòng 2: ghi rõ giới hạn thật của API ngay trong
                                panel để người dùng không tưởng lọc được cái API
                                không cho (vd: sắp xếp, lọc nhiều thể loại/quốc
                                gia, năm riêng lẻ). Hoạt hình là ngoại lệ duy
                                nhất của loại hình: kết hợp được Quốc gia + Năm. */}
                            <p className="text-xs text-gray-500 pb-2">
                                Lọc được tối đa 1 thể loại + 1 quốc gia + 1 năm cùng lúc. Phim lẻ / Phim bộ không kết hợp thêm điều kiện khác (riêng Hoạt hình kết hợp được Quốc gia + Năm). Năm chỉ lọc được khi đã chọn Thể loại, Quốc gia hoặc Hoạt hình. Không sắp xếp kết quả, không lọc nhiều giá trị trong cùng 1 nhóm.
                            </p>
                            <FilterRow label="Loại hình" icon={<FaLayerGroup className="text-blue-400 drop-shadow"/>} items={FILTER_DATA.type} activeValue={selectedFilters.type} onSelect={(val) => setFilterValue('type', val)} />
                            <FilterRow label="Quốc gia" icon={<FaGlobe className="text-green-400 drop-shadow"/>} items={visibleCountries} activeValue={selectedFilters.country} onSelect={(val) => setFilterValue('country', val)} gridClass="grid grid-cols-2 sm:grid-cols-4 md:grid-cols-6 lg:grid-cols-8 gap-1.5" />
                            <FilterRow label="Thể loại" icon={<FaTags className="text-yellow-400 drop-shadow"/>} items={visibleGenres} activeValue={selectedFilters.category} onSelect={(val) => setFilterValue('category', val)} gridClass="grid grid-cols-2 sm:grid-cols-4 md:grid-cols-6 lg:grid-cols-8 gap-1.5" />
                            <FilterRow label="Năm phát hành" icon={<FaCalendarAlt className="text-purple-400 drop-shadow"/>} items={FILTER_DATA.years} activeValue={selectedFilters.year} onSelect={(val) => setFilterValue('year', val)} gridClass="grid grid-cols-4 sm:grid-cols-6 md:grid-cols-8 lg:grid-cols-10 gap-1.5" disabled={!yearEnabled} hint="Chọn Thể loại, Quốc gia hoặc Hoạt hình trước — API không lọc được theo năm riêng lẻ." />
                        </div>

                        <div className="mt-10 flex flex-col md:flex-row justify-end gap-4 border-t border-white/5 pt-8 relative z-10">
                            <button onClick={handleClearFilter} className="px-8 py-3 rounded-xl font-bold text-gray-400 hover:text-white hover:bg-white/5 transition flex items-center justify-center gap-2 text-sm w-full md:w-auto"><FaTrashAlt /> Đặt lại</button>
                            <button onClick={handleApplyFilter} className="bg-gradient-to-r from-[var(--accent)] to-[var(--accent-hover)] hover:from-[var(--accent-hover)] hover:to-[var(--accent)] text-white px-10 py-3 rounded-xl font-bold shadow-xl shadow-red-900/30 transition flex items-center justify-center gap-2 text-sm transform hover:-translate-y-1 w-full md:w-auto"><FaCheck /> Áp dụng bộ lọc</button>
                        </div>
                    </div>
                </div>

                {/* 4. RESULTS */}
                {loading ? <div className="py-10"><MovieGridSkeleton /></div> : (
                    <>
                        {movies.length > 0 ? (
                            <MovieGrid movies={movies} />
                        ) : (
                            <div className="py-24 text-center border-2 border-dashed border-white/5 rounded-3xl bg-white/[0.02]">
                                <div className="inline-block p-6 rounded-full bg-white/5 mb-4 animate-bounce"><FaSearch className="text-4xl text-gray-600"/></div>
                                <h3 className="text-2xl font-bold text-white mb-2">Không tìm thấy phim</h3>
                                <p className="text-gray-500 mb-6 max-w-md mx-auto">Chúng tôi không tìm thấy kết quả nào phù hợp với bộ lọc của bạn.</p>
                                <button onClick={handleClearFilter} className="text-red-500 font-bold hover:text-red-400 hover:underline">Xóa bộ lọc và thử lại</button>
                            </div>
                        )}
                        <Pagination currentPage={currentPage} totalPages={totalPages} onPageChange={handlePageChange} />
                    </>
                )}
            </div>
        </div>
    );
};

export default Catalog;