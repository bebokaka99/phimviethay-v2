import React, { memo, useState, useRef, useEffect, useCallback } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { createPortal } from 'react-dom';
import { FaPlay, FaStar, FaInfoCircle, FaPlayCircle } from 'react-icons/fa';
import { IMG_URL, getMovieDetail } from '../../services/movieService';
import OptimizedImage from '../common/OptimizedImage';

// Fix A1 (23/11/2026): chỉ 1 popup hover được mở tại 1 thời điểm — thẻ mới
// được trỏ vào đóng NGAY popup của thẻ cũ (không chờ exit 300ms), để không
// còn nội dung phim cũ nào hiện trước popup mới.
let activePopupClose = null;

const MovieCard = memo(({ movie }) => {
    const navigate = useNavigate();
    const [isHovered, setIsHovered] = useState(false);
    const [coords, setCoords] = useState({ top: 0, left: 0, width: 0 });
    // Giai đoạn 2 (5.3): dữ liệu chi tiết thật của phim (mô tả/diễn viên/
    // thể loại) lấy sau khi hover ổn định, chỉ 1 lần cho mỗi thẻ.
    const [detail, setDetail] = useState(null);
    // Fix A1: đang chờ API chi tiết -> popup hiện skeleton thay vì câu mô tả
    // generic "Phim X chất lượng cao..." (tầng hover cũ, đã bỏ).
    const [detailLoading, setDetailLoading] = useState(false);
    const cardRef = useRef(null);
    const exitTimer = useRef(null);
    const detailTimer = useRef(null);
    const hoveredRef = useRef(false);
    const detailFetchedRef = useRef(false);

    // Đóng popup này NGAY LẬP TỨC (dùng khi thẻ khác được trỏ vào).
    const closePopupNow = useCallback(() => {
        if (exitTimer.current) clearTimeout(exitTimer.current);
        if (detailTimer.current) clearTimeout(detailTimer.current);
        hoveredRef.current = false;
        if (activePopupClose === closePopupNow) activePopupClose = null;
        setIsHovered(false);
    }, []);

    // Dọn registry khi thẻ bị unmount (vd chuyển trang).
    useEffect(() => () => {
        if (activePopupClose === closePopupNow) activePopupClose = null;
    }, [closePopupNow]);

    // UI 22/11/2026: không có điểm thì ẨN badge điểm (trước đây hiện "N/A"
    // màu vàng, nhìn như phim bị chê); không có số tập thì ẨN badge tập
    // (API danh sách không trả episode_current nên trước đây mọi thẻ đều
    // hiện "Full", kể cả phim bộ đang chiếu).
    const ratingVal = Number(movie.tmdb?.vote_average || movie.vote_average || 0);
    const displayRating = ratingVal > 0 ? ratingVal.toFixed(1) : null;
    const year = movie.year || null; // Chỉ hiện năm khi có dữ liệu thật (vd Lịch sử không lưu năm → ẩn badge, không hiện "Unknown" hay tên thể loại).
    const posterUrl = `${IMG_URL}${movie.thumb_url}`;
    const backdropUrl = movie.poster_url && movie.poster_url.includes('http') ? movie.poster_url : posterUrl;

    const stripHtml = (html) => {
        if (!html) return "";
        const doc = new DOMParser().parseFromString(html, 'text/html');
        return doc.body.textContent || "";
    };

    const handleMouseEnter = () => {
        if (window.innerWidth < 1024) return;
        if (exitTimer.current) clearTimeout(exitTimer.current);
        if (detailTimer.current) clearTimeout(detailTimer.current);
        hoveredRef.current = true;
        // Fix A1: trỏ sang thẻ khác thì đóng NGAY popup thẻ cũ (không chờ
        // exit 300ms) rồi mới mở popup thẻ này.
        if (activePopupClose && activePopupClose !== closePopupNow) activePopupClose();
        // Fix A1: popup mới hiện NGAY bằng dữ liệu đã có sẵn trên card
        // (tên/năm/điểm/poster), không chờ 250ms như trước; phần mô tả/
        // diễn viên/thể loại hiện skeleton rồi điền khi fetch về.
        if (!isHovered) {
            if (cardRef.current) {
                const rect = cardRef.current.getBoundingClientRect();
                setCoords({ top: rect.top + window.scrollY, left: rect.left + window.scrollX, width: rect.width });
                setIsHovered(true);
                activePopupClose = closePopupNow;
            }
            if (!detail && !detailFetchedRef.current) setDetailLoading(true);
        }
        // Giai đoạn 2 (5.3): hover ổn định ~400ms và popup đang mở thì gọi
        // 1 lần duy nhất API chi tiết để lấy mô tả/diễn viên/thể loại thật.
        // Hủy nếu chuột rời trước khi gọi hoặc trước khi trả về. Rê nhanh
        // qua nhiều thẻ không gọi (debounce chặn). Lỗi/trống thì popup giữ
        // dữ liệu danh sách và ẩn các dòng trống (mục 5.2).
        if (!detailFetchedRef.current && !detail) {
            detailTimer.current = setTimeout(async () => {
                if (!hoveredRef.current) { setDetailLoading(false); return; }
                detailFetchedRef.current = true;
                try {
                    const data = await getMovieDetail(movie.slug);
                    // Fix A1: rời chuột trước khi fetch về thì bỏ kết quả
                    // nhưng CHO PHÉP fetch lại lần hover sau (trước đây kẹt
                    // ở trạng thái đã-fetch mà detail vẫn null).
                    if (!hoveredRef.current) { detailFetchedRef.current = false; return; }
                    if (data?.status && data?.movie) {
                        setDetail({
                            content: data.movie.content,
                            actor: data.movie.actor || [],
                            category: data.movie.category || [],
                        });
                    } else {
                        detailFetchedRef.current = false;
                    }
                } catch (e) {
                    detailFetchedRef.current = false;
                } finally {
                    setDetailLoading(false);
                }
            }, 400);
        }
    };

    const handleMouseLeave = () => {
        hoveredRef.current = false;
        if (detailTimer.current) clearTimeout(detailTimer.current);
        exitTimer.current = setTimeout(() => {
            if (activePopupClose === closePopupNow) activePopupClose = null;
            setIsHovered(false);
        }, 300);
    };

    const MiniHeroPopup = () => {
        // ... (Giữ nguyên logic MiniHeroPopup) ...
        if (!isHovered) return null;
        const scale = 1.9;
        const newWidth = coords.width * scale;
        const leftPos = coords.left - (newWidth - coords.width) / 2;
        const rect = cardRef.current ? cardRef.current.getBoundingClientRect() : { top: 0 };
        const topPos = (rect.top + window.scrollY) - 60;
        const content = stripHtml(detail?.content || movie.content);
        // Fix A1: đang chờ API chi tiết thì hiện skeleton, KHÔNG hiện câu
        // generic "Phim X chất lượng cao..." (tầng hover cũ đã bỏ hẳn).
        const loadingDetail = detailLoading && !detail;
        // Giai đoạn 2 (5.2 + 5.3): diễn viên/thể loại lấy từ API chi tiết
        // (debounce 400ms); không có dữ liệu thì ẨN hẳn dòng đó — không hiện
        // "Đang cập nhật" hay pill trống. Dữ liệu danh sách không có các
        // trường này nên movie.actor/movie.category luôn rỗng ở đây.
        const actors = detail?.actor?.length ? detail.actor : (movie.actor || []);
        const categories = detail?.category?.length ? detail.category : (movie.category || []);
        const time = movie.time || "";

        return createPortal(
            <div className="fixed z-[9999] rounded-xl overflow-hidden shadow-[0_25px_50px_rgba(0,0,0,0.95)] animate-popup-in ring-1 ring-white/20 group cursor-pointer"
                style={{ top: topPos - window.scrollY, left: leftPos, width: newWidth, aspectRatio: '4/3', backgroundColor: '#0a0e17' }}
                onMouseEnter={handleMouseEnter} onMouseLeave={handleMouseLeave}
                onClick={() => navigate(`/phim/${movie.slug}`)}
            >
                <OptimizedImage src={backdropUrl} width={640} alt={movie.name} className="w-full h-full object-cover transition-transform duration-[4s] group-hover:scale-110" />
                <div className="absolute inset-0 bg-gradient-to-t from-[#0a0e17] via-[#0a0e17]/80 to-transparent" />
                <div className="absolute inset-0 p-4 flex flex-col justify-end items-start gap-2">
                    <Link to={`/phim/${movie.slug}`} onClick={(e) => e.stopPropagation()} className="block hover:opacity-80 transition w-full">
                        <h3 className="text-white font-black text-xl leading-tight line-clamp-2 drop-shadow-lg text-shadow-md font-sans">{movie.name}</h3>
                        <p className="text-gray-400 text-[10px] font-medium line-clamp-1">{movie.origin_name}</p>
                    </Link>
                    <div className="flex items-center flex-wrap gap-2 text-[10px] font-bold text-gray-300 mt-1">
                        {displayRating && (<span className="flex items-center gap-1 text-yellow-400 text-xs font-extrabold shadow-black drop-shadow-md"><FaStar /> {displayRating}</span>)}
                        {year && (<span className="bg-white/10 px-1.5 py-0.5 rounded border border-white/10">{year}</span>)}
                        {time && (<span className="bg-white/10 px-1.5 py-0.5 rounded border border-white/10">{time.replace('phút', 'p')}</span>)}
                        <span className="bg-red-600 text-white px-1.5 py-0.5 rounded uppercase shadow-sm">{movie.quality || 'HD'}</span>
                    </div>
                    {loadingDetail ? (
                        <div className="w-full space-y-1.5 py-1" aria-hidden="true">
                            <div className="h-2.5 w-full rounded bg-white/10 animate-pulse" />
                            <div className="h-2.5 w-11/12 rounded bg-white/10 animate-pulse" />
                            <div className="h-2.5 w-8/12 rounded bg-white/10 animate-pulse" />
                        </div>
                    ) : (
                        <>
                            {content && (<p className="text-gray-300 text-[10px] leading-relaxed line-clamp-3 opacity-90 font-medium text-justify">{content}</p>)}
                            {(actors.length > 0 || categories.length > 0) && (
                                <div className="w-full flex flex-col gap-1 mt-1 pt-2 border-t border-white/10">
                                    {actors.length > 0 && (<div className="text-[10px] text-gray-400 line-clamp-1"><span className="text-white font-bold opacity-70">Diễn viên: </span>{actors.slice(0, 3).join(', ')}</div>)}
                                    {categories.length > 0 && (<div className="text-[10px] text-gray-400 line-clamp-1"><span className="text-white font-bold opacity-70">Thể loại: </span>{categories.map(c => c.name).slice(0, 3).join(' • ')}</div>)}
                                </div>
                            )}
                        </>
                    )}
                    <div className="flex items-center gap-2 w-full mt-2">
                        <Link to={`/xem-phim/${movie.slug}`} onClick={(e) => e.stopPropagation()} className="flex-1 bg-red-600 text-white py-2 rounded-md font-bold text-xs flex items-center justify-center gap-2 hover:bg-red-700 transition shadow-lg shadow-red-900/30"><FaPlay size={10} /> Xem</Link>
                        <Link to={`/phim/${movie.slug}`} onClick={(e) => e.stopPropagation()} className="flex-1 bg-white/10 text-white py-2 rounded-md font-bold text-xs flex items-center justify-center gap-2 hover:bg-white/20 transition border border-white/20 backdrop-blur-sm"><FaInfoCircle size={12} /> Chi Tiết</Link>
                    </div>
                </div>
            </div>,
            document.body
        );
    };

    return (
        <>
            <Link ref={cardRef} to={`/phim/${movie.slug}`} className="relative group cursor-pointer select-none h-full flex flex-col block transform hover:scale-[1.06] hover:-translate-y-1 transition-transform duration-500 ease-[cubic-bezier(0.22,1,0.36,1)] will-change-transform z-10 hover:z-20" onMouseEnter={handleMouseEnter} onMouseLeave={handleMouseLeave}>
                
                {/* GLASS CONTAINER with hover ring & shadow (loại bỏ gradient blur-md tốn render) */}
                <div className="relative w-full aspect-[2/3] rounded-xl overflow-hidden mb-3 bg-[#1a1a1a] shadow-xl transition-[box-shadow,border-color,background-color] duration-500 ease-out ring-1 ring-white/10 
                            group-hover:ring-1 group-hover:ring-red-500/80 group-hover:shadow-[0_0_28px_rgba(220,38,38,0.8)] group-hover:bg-black/50">

                    <OptimizedImage src={posterUrl} width={320} alt={movie.name} className="w-full h-full object-cover transform transition-[transform,opacity] duration-700 ease-[cubic-bezier(0.22,1,0.36,1)] group-hover:scale-[1.07] group-hover:opacity-80" />
                    
                    {/* Badge/Info (Giữ nguyên) */}
                    <div className="absolute top-2 left-2"><span className="bg-red-600 text-white text-[9px] font-bold px-2 py-0.5 rounded shadow-md uppercase">{movie.quality || 'HD'}</span></div>
                    {displayRating && (<div className="absolute top-2 right-2"><span className="bg-yellow-500 text-black text-[9px] font-bold px-1.5 py-0.5 rounded shadow-md flex items-center gap-1">{displayRating} <FaStar size={8} /></span></div>)}
                    {movie.episode_current && (<div className="absolute bottom-2 right-2 z-10"><span className="bg-black/70 text-white text-[10px] font-bold px-2 py-0.5 rounded border border-white/10">{movie.episode_current}</span></div>)}
                    
                    {/* Play Icon (Nổi bật hơn) */}
                    <div className="absolute inset-0 flex items-center justify-center opacity-0 group-hover:opacity-100 transition-[opacity,transform] duration-500 ease-out scale-75 group-hover:scale-100">
                        <FaPlayCircle className="text-6xl text-red-500 drop-shadow-[0_0_15px_rgba(255,255,255,0.8)] animate-pulse-slow" />
                    </div>
                </div>
                
                <div className="px-1">
                    <h3 className="font-bold text-sm text-gray-200 line-clamp-1 group-hover:text-red-600 transition-colors">{movie.name}</h3>
                    <div className="flex items-center justify-between text-xs text-gray-500 mt-1"><span className="line-clamp-1 max-w-[70%] truncate" title={movie.origin_name}>{movie.origin_name}</span>{year && (<span className="text-gray-400 border border-gray-700 px-1.5 rounded-[4px] bg-[#1a1a1a]">{year}</span>)}</div>
                </div>
            </Link>
            <MiniHeroPopup />
        </>
    );
});

export default MovieCard;