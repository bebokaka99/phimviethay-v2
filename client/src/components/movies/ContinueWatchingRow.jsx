import React, { useState, useEffect, useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import { 
    FaChevronRight, FaChevronLeft, FaHistory, FaTrashAlt, FaEye
} from 'react-icons/fa';
import MovieCard from './MovieCard';
import { getWatchHistory, getCurrentUser, removeWatchHistoryItem } from '../../services/authService';

const parseDate = (dateString) => {
    if (!dateString) return new Date();
    let dateStr = String(dateString);
    if (!dateStr.includes('Z') && !dateStr.includes('+')) dateStr = dateStr.replace(' ', 'T') + 'Z';
    return new Date(dateStr);
};

const timeAgo = (dateString) => {
    const date = parseDate(dateString);
    const now = new Date();
    let seconds = Math.floor((now - date) / 1000);
    if (seconds > 21000 && seconds < 29000) seconds -= 25200; // Fix lệch múi giờ

    if (seconds < 60) return 'Vừa xong';
    const minutes = Math.floor(seconds / 60);
    if (minutes < 60) return `${minutes} phút trước`;
    const hours = Math.floor(minutes / 60);
    if (hours < 24) return `${hours} giờ trước`;
    const days = Math.floor(hours / 24);
    if (days < 7) return `${days} ngày trước`;
    return `${Math.floor(days / 365)} năm trước`;
};

// Key lưu tiến trình thời gian xem chi tiết trên trình duyệt
export const getProgressKey = (movieSlug, episodeSlug) => 
    `phimviethay_prog_${movieSlug}${episodeSlug ? `_${episodeSlug}` : ''}`;

export const getSavedProgress = (movieSlug, episodeSlug) => {
    try {
        const raw = localStorage.getItem(getProgressKey(movieSlug, episodeSlug)) ||
                    localStorage.getItem(getProgressKey(movieSlug, ''));
        if (!raw) return null;
        return JSON.parse(raw);
    } catch {
        return null;
    }
};

export const saveWatchProgress = (movieSlug, episodeSlug, currentTime, duration) => {
    if (!movieSlug || !currentTime || currentTime < 5) return;
    try {
        const data = {
            movieSlug,
            episodeSlug,
            currentTime: Math.floor(currentTime),
            duration: Math.floor(duration || 0),
            percent: duration > 0 ? Math.min(Math.round((currentTime / duration) * 100), 99) : 0,
            updatedAt: Date.now()
        };
        localStorage.setItem(getProgressKey(movieSlug, episodeSlug), JSON.stringify(data));
        localStorage.setItem(getProgressKey(movieSlug, ''), JSON.stringify(data));
    } catch {
        // Safe fail
    }
};

const ContinueWatchingRow = () => {
    const navigate = useNavigate();
    const rowRef = useRef(null);
    const [items, setItems] = useState([]);
    const [loading, setLoading] = useState(true);

    const currentUser = getCurrentUser();

    useEffect(() => {
        if (!currentUser) {
            setItems([]);
            setLoading(false);
            return;
        }

        let isMounted = true;
        const loadHistory = async () => {
            try {
                const data = await getWatchHistory();
                if (isMounted) {
                    if (Array.isArray(data) && data.length > 0) {
                        // Tối đa 12 phim xem gần nhất
                        setItems(data.slice(0, 12));
                    } else {
                        setItems([]);
                    }
                }
            } catch (err) {
                if (isMounted) setItems([]);
            } finally {
                if (isMounted) setLoading(false);
            }
        };

        loadHistory();
        return () => { isMounted = false; };
    }, [currentUser?.id]);

    const handleRemove = async (e, item) => {
        e.stopPropagation();
        e.preventDefault();
        const updated = items.filter((x) => x.movie_slug !== item.movie_slug);
        setItems(updated);
        try {
            await removeWatchHistoryItem(item.movie_slug);
            localStorage.removeItem(getProgressKey(item.movie_slug, item.episode_slug));
            localStorage.removeItem(getProgressKey(item.movie_slug, ''));
        } catch (err) {
            console.error('Lỗi xóa lịch sử:', err);
        }
    };

    const handleResume = (item) => {
        navigate(`/xem-phim/${item.movie_slug}?tap=${item.episode_slug || 'tap-1'}`);
    };

    const scroll = (direction) => {
        if (rowRef.current) {
            const amount = direction * rowRef.current.clientWidth;
            rowRef.current.scrollBy({ left: amount, behavior: 'smooth' });
        }
    };

    // Nếu chưa đăng nhập hoặc không có phim đang xem dở -> Ẩn hoàn toàn hàng này
    if (!currentUser || loading || items.length === 0) return null;

    const bgImage = items[0]?.movie_thumb;

    return (
        <div className="py-8 md:py-12 group/row relative overflow-hidden border-b border-white/5">
            {/* --- MOBILE: BANNER TIÊU ĐỀ --- */}
            <div className="md:hidden px-4 mb-4">
                <div 
                    onClick={() => navigate('/history')}
                    className="relative w-full h-24 rounded-xl overflow-hidden shadow-lg border-l-4 border-red-600 cursor-pointer"
                >
                    <div className="absolute inset-0 bg-cover bg-center opacity-50" style={{ backgroundImage: `url(${bgImage})` }} />
                    <div className="absolute inset-0 bg-gradient-to-r from-red-950 via-black to-black opacity-90" />
                    
                    <div className="absolute inset-0 flex items-center justify-between px-5">
                        <div className="flex-1 pr-4">
                            <h2 className="text-lg font-black text-white uppercase tracking-tight drop-shadow-md flex items-center gap-2">
                                Tiếp Tục Xem <span className="text-red-500 text-sm"><FaHistory /></span>
                            </h2>
                            <p className="text-[10px] text-gray-300 font-medium mt-1 opacity-90 line-clamp-2 leading-tight">
                                Bấm để tiếp tục xem tập phim bạn đang theo dõi.
                            </p>
                        </div>
                        <div className="w-8 h-8 rounded-full bg-white/10 flex items-center justify-center text-white flex-shrink-0">
                            <FaChevronRight size={12} />
                        </div>
                    </div>
                </div>
            </div>

            <div className="flex flex-col md:flex-row items-stretch gap-0 md:gap-8 pl-0 md:pl-12">
                {/* --- DESKTOP: KHỐI TẠP CHÍ ĐỒNG BỘ 100% VỚI MOVIEROW --- */}
                <div 
                    onClick={() => navigate('/history')}
                    className="hidden md:block relative flex-shrink-0 w-[240px] lg:w-[260px] rounded-2xl overflow-hidden cursor-pointer group/cat transition-all duration-500 hover:shadow-2xl hover:shadow-red-900/40 hover:-translate-y-1 bg-[#0a0e17] border border-white/5"
                >
                    <div 
                        className="absolute inset-0 bg-cover bg-center transition-all duration-1000 group-hover/cat:scale-110 opacity-70 group-hover/cat:opacity-90"
                        style={{ backgroundImage: `url(${bgImage})` }}
                    />
                    <div className="absolute inset-0 bg-gradient-to-b from-red-950 via-black to-black opacity-85 group-hover/cat:opacity-75 transition-opacity duration-500" />
                    <div className="absolute top-0 left-0 w-full h-1 bg-red-600" />

                    <div className="absolute inset-0 p-6 flex flex-col z-10">
                        <div className="mb-3 transform translate-y-0 transition-transform duration-300">
                            <div className="text-3xl mb-3 text-red-500 drop-shadow-md">
                                <FaHistory />
                            </div>
                            <h2 className="text-2xl lg:text-3xl font-black text-white leading-none uppercase drop-shadow-xl break-words">
                                Tiếp Tục Xem
                            </h2>
                        </div>

                        <div className="flex-1 relative overflow-hidden">
                            <div className="h-1 w-12 rounded-full bg-red-500/50 mb-3" />
                            <p className="text-sm text-gray-200 font-medium opacity-90 line-clamp-4 leading-relaxed text-shadow-sm">
                                Nhanh chóng quay lại những tập phim bạn đang xem dở mà không cần tìm kiếm lại.
                            </p>
                        </div>

                        <div className="pt-4 border-t border-white/10 flex items-center justify-between">
                            <span className="text-xs font-bold text-red-400 group-hover/cat:text-red-300 transition-colors uppercase tracking-wider flex items-center gap-1.5">
                                Xem lịch sử <FaChevronRight size={10} />
                            </span>
                        </div>
                    </div>
                </div>

                {/* --- RIGHT: SLIDER THẺ PHIM TIẾP TỤC XEM --- */}
                <div className="flex-1 min-w-0 relative z-20">
                    <div 
                        ref={rowRef}
                        className="flex overflow-x-auto gap-4 pl-4 pr-16 md:pl-0 md:pr-24 pb-8 pt-2 scrollbar-hide scroll-smooth items-center snap-x snap-mandatory"
                        style={{ perspective: '1000px' }}
                    >
                        {items.map((item, index) => {
                            const prog = getSavedProgress(item.movie_slug, item.episode_slug);
                            const percent = prog?.percent || 50; // Mặc định 50% nếu chưa có số giây
                            const movie = {
                                _id: item.movie_slug,
                                slug: item.movie_slug,
                                name: item.movie_name,
                                origin_name: '',
                                thumb_url: item.movie_thumb,
                                quality: 'HD',
                                year: undefined,
                                vote_average: 0
                            };

                            return (
                                <div 
                                    key={item.movie_slug}
                                    className="flex-none w-[150px] md:w-[200px] snap-start animate-card-entrance"
                                    style={{ 
                                        animationDelay: `${Math.min(index * 45, 300)}ms`,
                                        scrollSnapAlign: 'start'
                                    }}
                                >
                                    <div 
                                        className="relative group select-none"
                                        onClickCapture={(e) => {
                                            if (e.target.closest('[data-remove-continue]')) return;
                                            if (e.button !== 0 || e.metaKey || e.ctrlKey || e.shiftKey || e.altKey) return;
                                            e.preventDefault();
                                            handleResume(item);
                                        }}
                                    >
                                        {/* Card gốc MovieCard */}
                                        <MovieCard movie={movie} />

                                        {/* Lớp phủ đúng vùng poster (aspect 2/3 như poster MovieCard) */}
                                        <div className="absolute inset-x-0 top-0 aspect-[2/3] pointer-events-none rounded-[var(--card-radius,12px)] overflow-hidden">
                                            {/* Badge Tập Đang Xem (Giống hệt tab Lịch sử) */}
                                            <div className="absolute top-2 right-2 bg-red-600/90 text-white text-[9px] font-bold px-2 py-1 rounded shadow-md flex items-center gap-1 w-fit z-10 backdrop-blur-sm">
                                                <FaEye size={10} /> Bạn đang xem tập: {item.episode_name || '...'}
                                            </div>

                                            {/* Nút Xóa Từng Phim (Giống hệt tab Lịch sử) */}
                                            <button 
                                                data-remove-continue
                                                onClick={(e) => handleRemove(e, item)}
                                                className="absolute top-2 left-2 bg-black/60 text-gray-400 hover:text-red-500 hover:bg-black p-2 rounded-md backdrop-blur-sm z-20 opacity-0 group-hover:opacity-100 transition-all duration-300 border border-white/10 pointer-events-auto shadow-md"
                                                title="Xóa khỏi lịch sử"
                                                aria-label="Xóa khỏi tiếp tục xem"
                                            >
                                                <FaTrashAlt size={12} />
                                            </button>

                                            {/* Progress Bar (Visual thanh đỏ như tab Lịch sử) */}
                                            <div className="absolute bottom-0 left-0 w-full h-1 bg-gray-700">
                                                <div 
                                                    className="h-full bg-[var(--accent,theme(colors.red.600))] shadow-[0_0_10px_rgba(220,38,38,0.8)] transition-all duration-300"
                                                    style={{ width: `${percent}%` }}
                                                />
                                            </div>
                                        </div>

                                        {/* Dòng thời gian xem — giống hệt tab Lịch sử */}
                                        <div className="px-1 mt-1">
                                            <span className="text-xs text-green-400 font-bold flex items-center gap-1.5">
                                                <span className="w-1.5 h-1.5 bg-green-500 rounded-full animate-pulse" />
                                                {timeAgo(item.updated_at)}
                                            </span>
                                        </div>
                                    </div>
                                </div>
                            );
                        })}
                    </div>

                    {/* Nút bấm Cuộn trái/phải */}
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

export default ContinueWatchingRow;
