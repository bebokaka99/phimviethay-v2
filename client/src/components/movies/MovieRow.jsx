import React, { useRef, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { 
    FaChevronRight, FaChevronLeft, FaArrowRight, 
    FaFire, FaFilm, FaTv, FaMagic, 
    FaHeart, FaDragon, FaGem, FaMicrophoneAlt
} from 'react-icons/fa';
import MovieCard from './MovieCard';
import { useTheme } from '../../context/ThemeContext';

// --- CẤU HÌNH THEME (Map class tĩnh 100% để Tailwind biên dịch chuẩn xác) ---
// Export để WatchMovie.jsx tái dùng đúng 1 theme cho thẻ tiêu đề "Phim tương tự"
// (vòng 4, 23/11/2026) thay vì hardcode map thứ hai dễ lệch.
export const SECTION_THEMES = {
    // 1. Phim Lẻ
    'phim-le': {
        gradient: 'from-[#be123c] to-black', 
        accent: 'text-rose-500', 
        border: 'border-rose-600',
        borderTop: 'bg-rose-600',
        hoverShadow: 'hover:shadow-rose-900/40',
        badgeBg: 'group-hover/cat:bg-rose-600',
        desc: 'Tuyển tập bom tấn điện ảnh mới nhất, chất lượng HD cực nét.',
        icon: <FaFilm />
    },
    // 2. Phim Bộ
    'phim-bo': {
        gradient: 'from-[#7e22ce] to-black', 
        accent: 'text-purple-500',
        border: 'border-purple-600',
        borderTop: 'bg-purple-600',
        hoverShadow: 'hover:shadow-purple-900/40',
        badgeBg: 'group-hover/cat:bg-purple-600',
        desc: 'Marathon phim truyền hình thả ga, drama kịch tính không hồi kết.',
        icon: <FaTv />
    },
    // 3. Phim Hành Động
    'hanh-dong': {
        gradient: 'from-[#b91c1c] to-black', 
        accent: 'text-red-600',
        border: 'border-red-600',
        borderTop: 'bg-red-600',
        hoverShadow: 'hover:shadow-red-900/40',
        badgeBg: 'group-hover/cat:bg-red-600',
        desc: 'Những pha hành động mãn nhãn và những cuộc đối đầu nghẹt thở.',
        icon: <FaFire />
    },
    // 4. Phim Tình Cảm / Lãng Mạn
    'tinh-cam': {
        gradient: 'from-[#be185d] to-black', 
        accent: 'text-pink-500',
        border: 'border-pink-600',
        borderTop: 'bg-pink-600',
        hoverShadow: 'hover:shadow-pink-900/40',
        badgeBg: 'group-hover/cat:bg-pink-600',
        desc: 'Những câu chuyện tình yêu lãng mạn, ngọt ngào và đầy cảm xúc.',
        icon: <FaHeart />
    },
    'lang-man': {
        gradient: 'from-[#be185d] to-black', 
        accent: 'text-pink-500',
        border: 'border-pink-600',
        borderTop: 'bg-pink-600',
        hoverShadow: 'hover:shadow-pink-900/40',
        badgeBg: 'group-hover/cat:bg-pink-600',
        desc: 'Những câu chuyện tình yêu lãng mạn, ngọt ngào và đầy cảm xúc.',
        icon: <FaHeart />
    },
    // 5. Phim Hàn Quốc
    'han-quoc': {
        gradient: 'from-[#2563eb] to-black', 
        accent: 'text-blue-500',
        border: 'border-blue-600',
        borderTop: 'bg-blue-600',
        hoverShadow: 'hover:shadow-blue-900/40',
        badgeBg: 'group-hover/cat:bg-blue-600',
        desc: 'Làn sóng Hallyu với dàn diễn viên đình đám và kịch bản lôi cuốn.',
        icon: <FaGem />
    },
    // 6. Phim Trung Quốc
    'trung-quoc': {
        gradient: 'from-[#b45309] to-black', 
        accent: 'text-amber-500',
        border: 'border-amber-600',
        borderTop: 'bg-amber-600',
        hoverShadow: 'hover:shadow-amber-900/40',
        badgeBg: 'group-hover/cat:bg-amber-600',
        desc: 'Thế giới Tiên hiệp kỳ ảo, Kiếm hiệp và Ngôn tình hoa ngữ đặc sắc.',
        icon: <FaDragon />
    },
    // 7. Hoạt Hình
    'hoat-hinh': {
        gradient: 'from-[#059669] to-black', 
        accent: 'text-emerald-500',
        border: 'border-emerald-600',
        borderTop: 'bg-emerald-600',
        hoverShadow: 'hover:shadow-emerald-900/40',
        badgeBg: 'group-hover/cat:bg-emerald-600',
        desc: 'Thế giới sắc màu của Anime và hoạt hình dành cho mọi lứa tuổi.',
        icon: <FaMagic />
    },
    // 8. TV Shows / Truyền Hình Thực Tế
    'truyen-hinh-thuc-te': {
        gradient: 'from-[#0284c7] to-black', 
        accent: 'text-sky-500',
        border: 'border-sky-600',
        borderTop: 'bg-sky-600',
        hoverShadow: 'hover:shadow-sky-900/40',
        badgeBg: 'group-hover/cat:bg-sky-600',
        desc: 'Gameshow và truyền hình thực tế giải trí đỉnh cao.',
        icon: <FaMicrophoneAlt />
    },
    'tv-shows': {
        gradient: 'from-[#0284c7] to-black', 
        accent: 'text-sky-500',
        border: 'border-sky-600',
        borderTop: 'bg-sky-600',
        hoverShadow: 'hover:shadow-sky-900/40',
        badgeBg: 'group-hover/cat:bg-sky-600',
        desc: 'Gameshow và truyền hình thực tế giải trí đỉnh cao.',
        icon: <FaMicrophoneAlt />
    },
    // Fallback cho các loại khác
    'default': {
        gradient: 'from-[#3f3f46] to-black',
        accent: 'text-gray-400',
        border: 'border-gray-500',
        borderTop: 'bg-gray-500',
        hoverShadow: 'hover:shadow-gray-900/40',
        badgeBg: 'group-hover/cat:bg-gray-500',
        desc: 'Khám phá kho tàng điện ảnh đa dạng.',
        icon: <FaArrowRight />
    }
};

const MovieRow = ({ title, movies, slug, type = 'danh-sach' }) => {
    const navigate = useNavigate();
    const rowRef = useRef(null);

    // Nhóm D (Custom UI, 23/11/2026): mật độ hiển thị — đọc theme.density
    // qua useTheme() (hợp đồng nhóm B). Khi chưa có Provider (nhóm B chưa
    // gắn) thì fallback 'comfortable' thay vì crash — đúng mẫu try/catch
    // của Profile.jsx (nhóm C). Gap giữa các card dùng biến --card-gap do
    // ThemeContext đặt (compact=8px, comfortable=16px), fallback 16px.
    // KHÔNG sửa index.css (file của nhóm B).
    let themeApi = null;
    try { themeApi = useTheme(); } catch (e) { themeApi = null; }
    const density = themeApi?.theme?.density || 'comfortable';
    const isCompact = density === 'compact';
    const cardWidthClass = isCompact ? 'w-[120px] md:w-[160px]' : 'w-[150px] md:w-[200px]';

    // Ưu tiên lấy theme theo slug, fallback sang type hoặc default
    const themeKey = SECTION_THEMES[slug] ? slug : (SECTION_THEMES[type] ? type : 'default');
    const theme = SECTION_THEMES[themeKey] || SECTION_THEMES['default'];

    // Cuộn đúng 1 trang = clientWidth của khung hàng
    const scroll = (direction) => {
        if (rowRef.current) {
            const amount = direction * rowRef.current.clientWidth;
            rowRef.current.scrollBy({ left: amount, behavior: 'smooth' });
        }
    };

    // Khôi phục vị trí cuộn đã lưu trong sessionStorage khi vào lại trang
    useEffect(() => {
        const storageKey = `row_scroll_${slug || type}`;
        const savedPos = sessionStorage.getItem(storageKey);
        if (savedPos && rowRef.current) {
            const parsed = parseFloat(savedPos);
            if (!isNaN(parsed) && parsed > 0) {
                requestAnimationFrame(() => {
                    if (rowRef.current) {
                        rowRef.current.scrollLeft = parsed;
                    }
                });
            }
        }
    }, [slug, type]);

    // Lưu vị trí cuộn vào sessionStorage khi người dùng cuộn
    useEffect(() => {
        const el = rowRef.current;
        const storageKey = `row_scroll_${slug || type}`;
        if (!el) return;

        let debounceTimer = null;
        const handleScroll = () => {
            if (debounceTimer) clearTimeout(debounceTimer);
            debounceTimer = setTimeout(() => {
                if (el) {
                    sessionStorage.setItem(storageKey, el.scrollLeft);
                }
            }, 150);
        };

        el.addEventListener('scroll', handleScroll, { passive: true });
        return () => {
            if (debounceTimer) clearTimeout(debounceTimer);
            el.removeEventListener('scroll', handleScroll);
        };
    }, [slug, type]);

    const handleViewAll = () => { if (slug) navigate(`/${type}/${slug}`); };
    
    if (!movies || movies.length === 0) return null;

    // Lấy ảnh nền poster
    const bgImage = movies[0]?.thumb_url;

    return (
        <div className="py-8 md:py-12 group/row relative overflow-hidden">
            
            {/* --- MOBILE: BANNER NGANG --- */}
            <div className="md:hidden px-4 mb-4">
                <div 
                    onClick={handleViewAll}
                    className={`relative w-full h-24 rounded-xl overflow-hidden shadow-lg border-l-4 ${theme.border} cursor-pointer`}
                >
                    <div className="absolute inset-0 bg-cover bg-center opacity-60" style={{ backgroundImage: `url(${bgImage})` }} />
                    <div className={`absolute inset-0 bg-gradient-to-r ${theme.gradient} opacity-90`} />
                    
                    <div className="absolute inset-0 flex items-center justify-between px-5">
                        <div className="flex-1 pr-4">
                            <h2 className="text-lg font-black text-white uppercase tracking-tight drop-shadow-md flex items-center gap-2">
                                {title} <span className={`${theme.accent} text-sm`}>{theme.icon}</span>
                            </h2>
                            <p className="text-[10px] text-gray-300 font-medium mt-1 opacity-90 line-clamp-2 leading-tight">{theme.desc}</p>
                        </div>
                        <div className="w-8 h-8 rounded-full bg-white/10 flex items-center justify-center text-white flex-shrink-0">
                            <FaChevronRight size={12} />
                        </div>
                    </div>
                </div>
            </div>

            <div className="flex flex-col md:flex-row items-stretch gap-0 md:gap-8 pl-0 md:pl-12">
                
                {/* --- DESKTOP: KHỐI POSTER TẠP CHÍ (Class Tailwind tĩnh 100%) --- */}
                <div 
                    onClick={handleViewAll}
                    className={`hidden md:block relative flex-shrink-0 w-[240px] lg:w-[260px] rounded-2xl overflow-hidden cursor-pointer group/cat transition-all duration-500 hover:shadow-2xl ${theme.hoverShadow} hover:-translate-y-1 bg-[#0a0e17] border border-white/5`}
                >
                    {/* Background Art */}
                    <div 
                        className="absolute inset-0 bg-cover bg-center transition-all duration-1000 group-hover/cat:scale-110 opacity-80 group-hover/cat:opacity-100"
                        style={{ backgroundImage: `url(${bgImage})` }}
                    />
                    
                    {/* Gradient Overlay */}
                    <div className={`absolute inset-0 bg-gradient-to-b ${theme.gradient} opacity-80 group-hover/cat:opacity-60 transition-opacity duration-500`} />
                    
                    {/* Border Accent Top - Class tĩnh */}
                    <div className={`absolute top-0 left-0 w-full h-1 ${theme.borderTop}`} />

                    {/* CONTENT */}
                    <div className="absolute inset-0 p-6 flex flex-col z-10">
                        {/* 1. Header */}
                        <div className="mb-3 transform translate-y-0 transition-transform duration-300">
                            <div className={`text-3xl mb-3 ${theme.accent} drop-shadow-md`}>
                                {theme.icon}
                            </div>
                            <h2 className="text-2xl lg:text-3xl font-black text-white leading-none uppercase drop-shadow-xl break-words">
                                {title}
                            </h2>
                        </div>

                        {/* 2. Description */}
                        <div className="flex-1 relative overflow-hidden">
                            <div className="h-1 w-12 rounded-full bg-white/30 mb-3" />
                            <p className="text-sm text-gray-200 font-medium opacity-90 line-clamp-5 leading-relaxed text-shadow-sm">
                                {theme.desc}
                            </p>
                        </div>

                        {/* 3. Footer */}
                        <div className="pt-4 mt-auto border-t border-white/10 flex items-center gap-2 text-xs font-bold uppercase tracking-widest text-white hover:text-white transition-colors group/link">
                            Xem tất cả 
                            <span className={`w-6 h-6 rounded-full border border-white/40 flex items-center justify-center bg-white/10 ${theme.badgeBg} transition-colors`}>
                                <FaArrowRight size={8}/>
                            </span>
                        </div>
                    </div>
                </div>

                {/* --- RIGHT: SLIDER (Snap-x, Snap-start, Peeking Tile) --- */}
                <div className="flex-1 min-w-0 relative z-20">
                    <div 
                        ref={rowRef}
                        className="flex overflow-x-auto gap-[var(--card-gap,16px)] pl-4 pr-16 md:pl-0 md:pr-24 pb-8 pt-2 scrollbar-hide scroll-smooth items-center snap-x snap-mandatory"
                        style={{ perspective: '1000px' }}
                    >
                        {movies.map((movie, index) => (
                            <div 
                                key={movie._id} 
                                className={`flex-none ${cardWidthClass} snap-start animate-card-entrance`}
                                style={{ 
                                    animationDelay: `${Math.min(index * 45, 300)}ms`,
                                    scrollSnapAlign: 'start'
                                }}
                            >
                                <MovieCard movie={movie} />
                            </div>
                        ))}
                        
                        {/* Ô "Xem tất cả" ở cuối hàng — nằm trong khung cuộn ngang,
                            bấm vào đi tới danh sách đầy đủ của hàng (handleViewAll:
                            /{type}/{slug}, vd /quoc-gia/han-quoc). Hiện mọi cỡ màn hình. */}
                        <div
                            onClick={handleViewAll}
                            role="button"
                            aria-label={`Xem tất cả ${title}`}
                            className={`flex-none ${cardWidthClass} aspect-[2/3] rounded-[var(--card-radius,12px)] bg-gradient-to-b ${theme.gradient} border ${theme.border} flex flex-col items-center justify-center gap-3 cursor-pointer snap-start group/more transition-all duration-300 hover:scale-[1.02] hover:shadow-2xl ${theme.hoverShadow}`}
                        >
                            <div className={`w-14 h-14 md:w-16 md:h-16 rounded-full bg-white/10 border border-white/30 flex items-center justify-center text-white shadow-lg transition-transform duration-300 group-hover/more:translate-x-1`}>
                                <FaArrowRight className="text-xl md:text-2xl" />
                            </div>
                            <span className="text-sm md:text-base text-white font-black uppercase tracking-wide text-center px-3">Xem tất cả</span>
                            <span className="text-[11px] md:text-xs text-gray-300 font-medium text-center px-3 line-clamp-2">{title}</span>
                        </div>
                    </div>

                    {/* Navigation Buttons: nền mờ đặc không dùng blur để tối ưu render */}
                    <button 
                        onClick={() => scroll(-1)}
                        className="absolute left-0 top-1/2 -translate-y-1/2 -ml-6 w-14 h-14 bg-[#0a0e17]/90 border border-white/10 rounded-full text-white flex items-center justify-center opacity-0 group-hover/row:opacity-100 hover:bg-white hover:text-black transition-all shadow-2xl z-30 hidden md:flex"
                        aria-label="Cuộn sang trái"
                    >
                        <FaChevronLeft />
                    </button>
                    <button 
                        onClick={() => scroll(1)}
                        className="absolute right-4 top-1/2 -translate-y-1/2 w-14 h-14 bg-[#0a0e17]/90 border border-white/10 rounded-full text-white flex items-center justify-center opacity-0 group-hover/row:opacity-100 hover:bg-white hover:text-black transition-all shadow-2xl z-30 hidden md:flex"
                        aria-label="Cuộn sang phải"
                    >
                        <FaChevronRight />
                    </button>
                </div>
            </div>
        </div>
    );
};

export default MovieRow;
