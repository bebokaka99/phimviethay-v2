import React, { useState, useEffect, useRef, useCallback } from 'react';
import { Link } from 'react-router-dom';
import { FaPlay, FaInfoCircle, FaStar } from 'react-icons/fa';
import { IMG_URL, getMovieDetail } from '../../services/movieService';
import OptimizedImage from '../common/OptimizedImage';

const HeroSection = ({ movies }) => {
    const [currentIndex, setCurrentIndex] = useState(0);
    const [heroMovies, setHeroMovies] = useState([]);
    
    // Đồng bộ đồng hồ: các trạng thái tạm dừng tự chuyển
    const [isHovered, setIsHovered] = useState(false);
    const [isTabVisible, setIsTabVisible] = useState(true);
    const [isHeroOnScreen, setIsHeroOnScreen] = useState(true);
    const [isTouchPaused, setIsTouchPaused] = useState(false);

    // Vuốt trên mobile (Touch Swipe)
    const [touchStartX, setTouchStartX] = useState(0);
    const [touchDeltaX, setTouchDeltaX] = useState(0);
    const [isSwiping, setIsSwiping] = useState(false);

    const heroRef = useRef(null);
    const touchPauseTimeout = useRef(null);

    // Giai đoạn 2 (3b): MỘT đồng hồ duy nhất cho cả slide + thanh tiến trình.
    // remainingRef = số ms còn lại của slide hiện tại; stretchStartRef = lúc
    // bắt đầu quãng chạy hiện tại. Khi pause: cộng dồn thời gian đã chạy vào
    // remaining; khi resume: chạy tiếp từ đúng chỗ đã dừng (không chạy lại
    // từ đầu như setInterval cũ). Đổi slide thì reset về đủ 8s.
    const SLIDE_MS = 8000;
    const remainingRef = useRef(SLIDE_MS);
    const stretchStartRef = useRef(null);
    const slideTimerRef = useRef(null);
    const lastSlideIndexRef = useRef(0);

    // Tối ưu 22/11/2026: hiện hero NGAY bằng dữ liệu danh sách (đã có sẵn
    // poster/thumb/content), rồi mới gọi 5 API chi tiết ở nền để bổ sung
    useEffect(() => {
        if (!movies || movies.length === 0) return;
        const top5 = movies.slice(0, 5);
        setHeroMovies(top5);
        const enhance = async () => {
            const updatedMovies = await Promise.all(top5.map(async (movie) => {
                try {
                    const data = await getMovieDetail(movie.slug);
                    if (data?.status && data?.movie) {
                        return {
                            ...movie,
                            poster_url: data.movie.poster_url,
                            tmdb: data.movie.tmdb,
                            content: data.movie.content
                        };
                    }
                    return movie;
                } catch (e) { return movie; }
            }));
            setHeroMovies(updatedMovies);
        };
        enhance();
    }, [movies]);

    // Xử lý chuyển slide prev/next
    const handlePrev = useCallback(() => {
        setCurrentIndex(prev => (prev === 0 ? heroMovies.length - 1 : prev - 1));
    }, [heroMovies.length]);

    const handleNext = useCallback(() => {
        setCurrentIndex(prev => (prev === heroMovies.length - 1 ? 0 : prev + 1));
    }, [heroMovies.length]);

    // Lắng nghe khi tab ẩn / hiện (document.visibilitychange)
    useEffect(() => {
        const handleVisibility = () => {
            setIsTabVisible(document.visibilityState === 'visible');
        };
        document.addEventListener('visibilitychange', handleVisibility);
        return () => document.removeEventListener('visibilitychange', handleVisibility);
    }, []);

    // Lắng nghe khi Hero ra ngoài màn hình (IntersectionObserver)
    useEffect(() => {
        const el = heroRef.current;
        if (!el) return;
        const observer = new IntersectionObserver(([entry]) => {
            setIsHeroOnScreen(entry.isIntersecting);
        }, { threshold: 0.15 });
        observer.observe(el);
        return () => observer.disconnect();
    }, []);

    // Tổng hợp điều kiện dừng
    const shouldPause = isHovered || !isTabVisible || !isHeroOnScreen || isTouchPaused || isSwiping;

    // Bộ đếm duy nhất 8 giây chuyển slide — chung đồng hồ với thanh tiến trình.
    useEffect(() => {
        if (heroMovies.length === 0) return;
        const slideChanged = lastSlideIndexRef.current !== currentIndex;
        if (slideChanged) lastSlideIndexRef.current = currentIndex;
        // Ghi nhận thời gian đã chạy của quãng trước (trừ khi vừa đổi slide)
        if (!slideChanged && stretchStartRef.current != null) {
            remainingRef.current = Math.max(0, remainingRef.current - (performance.now() - stretchStartRef.current));
            stretchStartRef.current = null;
        }
        if (slideTimerRef.current) {
            clearTimeout(slideTimerRef.current);
            slideTimerRef.current = null;
        }
        if (slideChanged) remainingRef.current = SLIDE_MS;
        if (shouldPause) return;
        stretchStartRef.current = performance.now();
        slideTimerRef.current = setTimeout(() => {
            handleNext();
        }, remainingRef.current);
        return () => {
            if (slideTimerRef.current) {
                clearTimeout(slideTimerRef.current);
                slideTimerRef.current = null;
            }
        };
    }, [currentIndex, heroMovies.length, shouldPause, handleNext]);

    // Thanh tiến trình: vẽ bằng rAF từ CÙNG đồng hồ với bộ đếm slide
    // (không dùng CSS animation riêng nên không bao giờ lệch nhịp với slide).
    // Cập nhật trực tiếp DOM (không re-render) qua [data-hero-progress].
    useEffect(() => {
        if (heroMovies.length === 0 || shouldPause) return;
        // Fix A3 (23/11/2026): thanh tiến trình là chỉ báo thời gian (thông
        // tin chức năng), KHÔNG phải animation trang trí — luôn chạy kể cả
        // khi hệ thống bật prefers-reduced-motion. Trước đây dòng matchMedia
        // dưới này khiến progress đứng yên ở scaleX(0) trong khi slide vẫn
        // tự chuyển 8s (đã tái hiện đúng bằng giả lập reduced-motion).
        let raf = 0;
        const tick = () => {
            const nodes = heroRef.current?.querySelectorAll('[data-hero-progress]');
            if (nodes && stretchStartRef.current != null) {
                const elapsed = SLIDE_MS - remainingRef.current + (performance.now() - stretchStartRef.current);
                const p = Math.max(0, Math.min(1, elapsed / SLIDE_MS));
                nodes.forEach((el) => { el.style.transform = `scaleX(${p})`; });
            }
            raf = requestAnimationFrame(tick);
        };
        raf = requestAnimationFrame(tick);
        return () => cancelAnimationFrame(raf);
    }, [currentIndex, heroMovies.length, shouldPause]);

    // Giai đoạn 2 (3c): preload ảnh slide kế tiếp để fade không diễn ra
    // trên nền đen (chỉ preload 1 ảnh kế tiếp, không tăng số ảnh tải cùng lúc).
    useEffect(() => {
        if (heroMovies.length === 0) return;
        const next = heroMovies[(currentIndex + 1) % heroMovies.length];
        if (!next) return;
        const url = next.poster_url && next.poster_url.includes('http')
            ? next.poster_url
            : `${IMG_URL}${next.poster_url || next.thumb_url}`;
        const img = new Image();
        img.src = url;
    }, [currentIndex, heroMovies]);

    // Xử lý vuốt trên thiết bị di động
    const handleTouchStart = (e) => {
        if (e.touches && e.touches.length === 1) {
            setTouchStartX(e.touches[0].clientX);
            setTouchDeltaX(0);
            setIsSwiping(true);
        }
    };

    const handleTouchMove = (e) => {
        if (!isSwiping || !e.touches || e.touches.length !== 1) return;
        const delta = e.touches[0].clientX - touchStartX;
        const clamped = Math.max(-120, Math.min(120, delta));
        setTouchDeltaX(clamped);
    };

    const handleTouchEnd = () => {
        if (!isSwiping) return;
        setIsSwiping(false);

        if (touchDeltaX < -45) {
            handleNext();
        } else if (touchDeltaX > 45) {
            handlePrev();
        }
        setTouchDeltaX(0);

        // Tạm dừng tự chuyển trong 5 giây sau khi vuốt
        setIsTouchPaused(true);
        if (touchPauseTimeout.current) clearTimeout(touchPauseTimeout.current);
        touchPauseTimeout.current = setTimeout(() => {
            setIsTouchPaused(false);
        }, 5000);
    };

    const stripHtml = (html) => {
        if (!html) return "";
        return html.replace(/<[^>]*>?/gm, '');
    };

    if (heroMovies.length === 0) return null;

    return (
        <div 
            ref={heroRef}
            className="relative h-[60vh] md:h-[700px] w-full text-white overflow-hidden group bg-[#0a0e17] touch-pan-y select-none"
            onMouseEnter={() => setIsHovered(true)}
            onMouseLeave={() => setIsHovered(false)}
            onTouchStart={handleTouchStart}
            onTouchMove={handleTouchMove}
            onTouchEnd={handleTouchEnd}
        >
            {/* Các slide phim */}
            {heroMovies.map((movie, index) => {
                const isActive = index === currentIndex;

                const desktopImg = movie.poster_url && movie.poster_url.includes('http')
                                    ? movie.poster_url
                                    : `${IMG_URL}${movie.poster_url || movie.thumb_url}`;

                const posterThumb = `${IMG_URL}${movie.thumb_url}`;
                const ratingValue = Number(movie.tmdb?.vote_average || movie.vote_average || 0);
                const displayRating = ratingValue > 0 ? ratingValue.toFixed(1) : null;

                return (
                    <div 
                        key={movie._id || index}
                        className={`absolute inset-0 transition-opacity duration-[1400ms] ease-[cubic-bezier(0.22,1,0.36,1)] will-change-[opacity] ${
                            isActive ? 'opacity-100 z-10 pointer-events-auto' : 'opacity-0 z-0 pointer-events-none'
                        }`}
                        style={{
                            transform: isActive && isSwiping && touchDeltaX !== 0 ? `translateX(${touchDeltaX}px)` : undefined,
                            transition: isSwiping ? 'none' : undefined
                        }}
                    >
                        {/* 1. BACKGROUND IMAGE with subtle Ken Burns zoom */}
                        <div className="absolute inset-0 overflow-hidden">
                            {/* Fix A2 (23/11/2026): Ken Burns rõ hơn (zoom tới 1.08)
                                để chuyển slide có chuyển động nhìn thấy được,
                                không chỉ đổi opacity. */}
                            <div className={`w-full h-full transition-transform duration-[8000ms] ease-[cubic-bezier(0.22,1,0.36,1)] will-change-transform ${
                                isActive ? 'scale-[1.08]' : 'scale-100'
                            }`}>
                                <OptimizedImage
                                    src={desktopImg}
                                    width={1440}
                                    alt={movie.name}
                                    className="w-full h-full object-cover object-top"
                                    eager={index === currentIndex || index === (currentIndex + 1) % heroMovies.length}
                                    fetchPriority={index === currentIndex ? 'high' : undefined}
                                />
                            </div>
                            {/* Gradient Overlay */}
                            <div className="absolute inset-0 bg-gradient-to-t from-[#0a0e17] via-[#0a0e17]/40 to-transparent md:bg-gradient-to-r md:from-[#0a0e17] md:via-[#0a0e17]/70 md:to-transparent" />
                        </div>

                        {/* 2. NỘI DUNG CHÍNH */}
                        <div className="absolute inset-0 flex items-center justify-center pb-6 md:pb-0">
                            <div className="w-full max-w-[1500px] mx-auto px-4 md:px-16 flex flex-col md:flex-row items-end md:items-center justify-between gap-8 md:gap-12 h-full md:h-auto">
                                
                                {/* Cột trái: Thông tin phim */}
                                <div className={`w-full md:w-[60%] space-y-2 md:space-y-6 z-10 flex flex-col justify-end h-full md:h-auto pb-4 md:pb-0 transition-all duration-[900ms] ease-[cubic-bezier(0.22,1,0.36,1)] delay-100 ${
                                    isActive ? 'opacity-100 translate-y-0' : 'opacity-0 translate-y-6'
                                }`}>
                                    
                                    <Link to={`/phim/${movie.slug}`} className="block hover:opacity-80 transition group/title">
                                        <h1 className="text-2xl md:text-5xl font-black leading-tight drop-shadow-2xl text-transparent bg-clip-text bg-gradient-to-r from-white to-gray-300 py-1 line-clamp-2 md:line-clamp-none">
                                            {movie.name}
                                        </h1>
                                        <p className="hidden md:block text-lg text-gray-400 italic font-medium mt-1">{movie.origin_name}</p>
                                    </Link>

                                    {/* Meta Data */}
                                    <div className="flex flex-wrap items-center gap-2 md:gap-3 text-xs md:text-base font-medium text-gray-200">
                                        {displayRating && (
                                            <span className="flex items-center gap-1 text-yellow-400 font-bold text-sm md:text-lg">
                                                <FaStar /> {displayRating}
                                            </span>
                                        )}
                                        <span className="bg-white/10 border border-white/10 px-2 py-0.5 md:px-3 md:py-1 rounded">
                                            {movie.year}
                                        </span>
                                        <span className="bg-red-600 px-2 py-0.5 md:px-3 md:py-1 rounded text-white font-bold uppercase tracking-wider shadow-lg shadow-red-900/40 text-[10px] md:text-sm">
                                            {movie.quality || 'HD'}
                                        </span>
                                        {movie.lang && (
                                            <span className="text-gray-300 border border-gray-500 px-2 py-0.5 md:px-3 md:py-1 rounded uppercase text-[10px] md:text-sm">
                                                {movie.lang}
                                            </span>
                                        )}
                                    </div>

                                    {/* Mô tả */}
                                    <p className="text-gray-300 text-xs md:text-lg line-clamp-3 md:line-clamp-4 leading-relaxed max-w-xl drop-shadow-md opacity-90">
                                        {stripHtml(movie.content) || `Trải nghiệm điện ảnh đỉnh cao với ${movie.name}.`}
                                    </p>

                                    {/* Buttons */}
                                    <div className="flex items-center gap-3 md:gap-4 w-full md:w-auto pt-2">
                                        <Link 
                                            to={`/xem-phim/${movie.slug}`} 
                                            className="flex-1 md:flex-none bg-red-600 text-white px-4 py-3 md:px-10 md:py-4 rounded-xl hover:bg-red-700 transition font-bold flex items-center justify-center gap-2 md:gap-3 shadow-xl shadow-red-900/40 active:scale-95 text-sm md:text-lg"
                                        >
                                            <FaPlay /> XEM NGAY
                                        </Link>
                                        
                                        <Link 
                                            to={`/phim/${movie.slug}`} 
                                            className="flex-1 md:flex-none bg-white/10 text-white px-4 py-3 md:px-10 md:py-4 rounded-xl hover:bg-white/20 transition backdrop-blur-md font-bold flex items-center justify-center gap-2 md:gap-3 border border-white/20 active:scale-95 text-sm md:text-lg"
                                        >
                                            <FaInfoCircle /> CHI TIẾT
                                        </Link>
                                    </div>
                                </div>

                                {/* Cột phải: Poster */}
                                <div className={`hidden md:flex w-full md:w-[40%] justify-end relative z-10 pr-8 transition-all duration-[900ms] ease-[cubic-bezier(0.22,1,0.36,1)] delay-200 ${
                                    isActive ? 'opacity-100 translate-x-0 rotate-3' : 'opacity-0 translate-x-8 rotate-0'
                                }`}>
                                    <Link 
                                        to={`/phim/${movie.slug}`}
                                        className="block w-[280px] aspect-[2/3] rounded-2xl overflow-hidden shadow-[0_20px_50px_rgba(0,0,0,0.7)] border border-white/10 hover:rotate-0 transition duration-500 ease-out hover:scale-105"
                                    >
                                        <OptimizedImage src={posterThumb} width={320} alt={movie.name} className="w-full h-full object-cover" />
                                    </Link>
                                </div>
                            </div>
                        </div>
                    </div>
                );
            })}

            {/* Thumbnail Navigation (Desktop / Tablet) — Giai đoạn 2 (3b):
                thanh tiến trình nằm BÊN DƯỚI mỗi thumbnail (ngoài ảnh, không bị
                overlay gradient che). Mọi thumbnail đều có vạch nền (track);
                thumbnail active có vạch đỏ chạy (vẽ bằng rAF, xem useEffect trên). */}
            <div className="absolute bottom-6 md:bottom-8 right-6 md:right-12 z-20 hidden md:flex items-start gap-3">
                {heroMovies.map((m, idx) => {
                    let thumbWide = `${IMG_URL}${m.poster_url || m.thumb_url}`;
                    if (m.poster_url && m.poster_url.includes('http')) thumbWide = m.poster_url;
                    const isActive = idx === currentIndex;
                    return (
                        <button
                            key={m._id || idx}
                            onClick={() => setCurrentIndex(idx)}
                            aria-label={`Xem ${m.name}`}
                            className="group/thumb flex flex-col gap-1.5 w-24 lg:w-28 cursor-pointer bg-transparent p-0 text-left"
                        >
                            <div
                                className={`relative w-full h-14 lg:h-16 rounded-xl overflow-hidden transition-all duration-500 ease-out ${
                                    isActive 
                                        ? 'scale-110 -translate-y-1.5 shadow-2xl shadow-red-950/70 ring-2 ring-red-500/80 z-10 opacity-100' 
                                        : 'opacity-50 hover:opacity-90 hover:scale-105 hover:-translate-y-0.5 border border-white/10'
                                }`}
                            >
                                <OptimizedImage 
                                    src={thumbWide} 
                                    width={224} 
                                    alt={m.name} 
                                    className="w-full h-full object-cover transition-transform duration-500 group-hover/thumb:scale-110" 
                                />
                                
                                {/* Overlay */}
                                <div className={`absolute inset-0 transition-opacity duration-300 ${
                                    isActive ? 'bg-gradient-to-t from-black/80 via-transparent to-transparent' : 'bg-black/40 group-hover/thumb:bg-transparent'
                                }`} />
                            </div>

                            {/* Thanh tiến trình dưới thumbnail */}
                            <div className="h-[3px] w-full bg-white/20 rounded-full overflow-hidden">
                                {isActive && (
                                    <div 
                                        data-hero-progress
                                        className="h-full w-full bg-gradient-to-r from-red-600 via-red-500 to-rose-400 shadow-[0_0_10px_rgba(239,68,68,0.9)] origin-left"
                                        style={{ transform: 'scaleX(0)' }}
                                    />
                                )}
                            </div>
                        </button>
                    );
                })}
            </div>

            {/* Mobile Indicators */}
            <div className="absolute bottom-3 left-1/2 -translate-x-1/2 z-20 flex md:hidden items-center gap-2">
                {heroMovies.map((_, idx) => {
                    const isActive = idx === currentIndex;
                    return (
                        <button
                            key={idx}
                            onClick={() => setCurrentIndex(idx)}
                            className={`h-1.5 rounded-full transition-all duration-300 overflow-hidden ${
                                isActive ? 'w-8 bg-white/30' : 'w-2 bg-white/20'
                            }`}
                            aria-label={`Slide ${idx + 1}`}
                        >
                            {isActive && (
                                <div
                                    data-hero-progress
                                    className="h-full w-full bg-red-600 rounded-full origin-left"
                                    style={{ transform: 'scaleX(0)' }}
                                />
                            )}
                        </button>
                    );
                })}
            </div>
        </div>
    );
};

export default HeroSection;
