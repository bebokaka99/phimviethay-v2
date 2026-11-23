import React, { useEffect, useState, useRef, useMemo } from 'react';
import { useParams, useSearchParams, useNavigate, Link } from 'react-router-dom';
import { Helmet } from 'react-helmet-async';
import {
    FaPlay, FaList, FaLightbulb, FaStar, FaStepForward,
    FaArrowLeft, FaExpand, FaClock, FaGlobe, FaUsers, FaHeart,
    FaHome, FaAngleRight, FaSearch, FaArrowRight,
    FaSortAmountDown, FaSortAmountUp
} from 'react-icons/fa';

import CommentSection from '../components/comments/CommentSection';
import MovieCard from '../components/movies/MovieCard';
import { SECTION_THEMES } from '../components/movies/MovieRow';
import useOnScreen from '../hooks/useOnScreen';

// Lazy load: cac muc duoi chi fetch/render khi sap vao viewport.
const LAZY_OPTS = { rootMargin: '400px' };
// Danh sach tap chi render theo dot (tranh render 1 lan ca nghin nut).
const EP_PAGE = 100;
// Lay so tap tu ten tap ("1156", "Tập 12", ...) de sap xep / tim kiem.
const epNumber = (ep) => {
    const m = String(ep?.name ?? '').match(/\d+/);
    return m ? parseInt(m[0], 10) : null;
};
// Player iframe embed (22/11/2026): vsmov chỉ có link_embed, không có link_m3u8
// nên Artplayer không phát được. VideoPlayer.jsx giữ lại cho hướng resolve m3u8 sau này.
// ĐÍNH CHÍNH 22/11/2026 (tối): m3u8 của vsmov LÀ video thật có tiếng — mỗi "ảnh PNG"
// trong playlist thực chất là file polyglot: đầu là PNG nhỏ (199×133) rồi ~1,9 MB
// MPEG-TS (H.264 1920×812 + AAC stereo). hls.js phát được bình thường (JWPlayer
// trong embed cũng dùng hls.js). Vì vậy trình phát riêng bằng hls.js/Artplayer từ
// m3u8 này LÀM ĐƯỢC — cần backend lấy URL m3u8 có chữ ký theo từng lượt xem
// (trang embed cần header Referer mới trả link; link hết hạn sau ~1h).
// GHI CHÚ 22/11/2026: đã từng thử che watermark VSbet bằng miếng phủ blur và đè
// logo web lên logo VSmov (commit c356fa0/ac74d80/39aa4d1), nhưng user yêu cầu gỡ
// hết để về nguyên bản — overlay lệch vị trí khi khung phát rộng hơn và mất hoàn
// toàn khi xem toàn màn hình (iframe tự fullscreen). Sẽ thử lại sau khi có phương
// án khác hợp lý hơn.
import { getMovieDetail, getMoviesBySlug, getMoviePeoples, IMG_URL } from '../services/movieService';
import { setWatchHistory, checkFavoriteStatus, toggleFavorite } from '../services/authService';

const Toast = ({ message, onClose }) => {
    useEffect(() => { const t = setTimeout(onClose, 3000); return () => clearTimeout(t); }, [onClose]);
    return (
        <div className="fixed top-20 right-4 z-[200] bg-black/90 border-l-4 border-red-600 text-white px-4 py-3 rounded shadow-2xl flex items-center gap-3 animate-fade-in-down max-w-[90vw]">
            <div className="bg-red-600 p-1 rounded-full"><FaHeart className="text-white text-[10px]" /></div>
            <span className="text-sm font-medium line-clamp-1">{message}</span>
        </div>
    );
};

const WatchMovie = () => {
    const { slug } = useParams();
    const [searchParams, setSearchParams] = useSearchParams();
    const navigate = useNavigate();
    const currentEpSlug = searchParams.get('tap');
    const playerRef = useRef(null);

    const [movie, setMovie] = useState(null);
    const [episodes, setEpisodes] = useState([]);
    const [currentEpisode, setCurrentEpisode] = useState(null);
    const [currentServer, setCurrentServer] = useState(() => {
        try { return parseInt(localStorage.getItem('preferred_server')) || 0; } catch (e) { return 0; }
    });

    useEffect(() => { localStorage.setItem('preferred_server', currentServer); }, [currentServer]);

    const [casts, setCasts] = useState([]);
    const [relatedMovies, setRelatedMovies] = useState([]);
    const [loading, setLoading] = useState(true);
    const [isLightOff, setIsLightOff] = useState(false);
    const [isTheater, setIsTheater] = useState(false);
    const [toastMsg, setToastMsg] = useState('');
    const [isFavorite, setIsFavorite] = useState(false);
    const [watchedEpisodes, setWatchedEpisodes] = useState([]);

    // --- Chon tap: sap xep / tim tap / render theo dot ---
    const [epSort, setEpSort] = useState(() => {
        try { return localStorage.getItem('ep_sort_order') === 'desc' ? 'desc' : 'asc'; } catch (e) { return 'asc'; }
    });
    // Render theo cua so: chi hien ~100 tap/lan, cua so mac dinh chua tap dang xem
    // (vd tap 1156 trong danh sach 1->N nam o khoang 1101-1180) thay vi mo rong
    // tu dau toi tap do (se render het 1180 nut).
    const [epWinStart, setEpWinStart] = useState(0);
    const [epWinCount, setEpWinCount] = useState(EP_PAGE);
    const [epQuery, setEpQuery] = useState('');
    const [epSearchMsg, setEpSearchMsg] = useState('');
    const epListRef = useRef(null);
    const epBtnRefs = useRef({});
    const [jumpSlug, setJumpSlug] = useState(null);
    // --- Lazy: binh luan + phim tuong tu ---
    const [commentSectionRef, commentsVisible] = useOnScreen(LAZY_OPTS);
    const [relatedSectionRef, relatedVisible] = useOnScreen(LAZY_OPTS);
    const [relatedLoaded, setRelatedLoaded] = useState(false);

    useEffect(() => { try { localStorage.setItem('ep_sort_order', epSort); } catch (e) {} }, [epSort]);
    // Doi server / doi phim -> cua so ve dau danh sach
    useEffect(() => { setEpWinStart(0); setEpWinCount(EP_PAGE); setEpSearchMsg(''); }, [currentServer, slug]);

    const showToast = (msg) => setToastMsg(msg);
    const getActorImg = (path) => path ? `https://image.tmdb.org/t/p/w200${path}` : null;

    // Vong 2 (23/11/2026): tach fetch chinh khoi fetch phu.
    // Truoc day trinh phat phai doi: detail -> checkFavoriteStatus ->
    // getMoviesBySlug (phim tuong tu, ~0,9s) moi setLoading(false) nen
    // iframe xuat hien muon ~2,7s. Gio: co detail la hien trinh phat ngay;
    // fav/casts chay nen; phim tuong tu chi fetch khi panel sap vao viewport.
    useEffect(() => {
        if (!currentEpSlug) window.scrollTo(0, 0);
        const fetchData = async () => {
            if (!movie) setLoading(true);
            try {
                const data = await getMovieDetail(slug);
                if (data?.status && data?.movie) {
                    setMovie(data.movie);
                    setEpisodes(data.episodes || []);

                    // Server check logic
                    const validServerIndex = (data.episodes && data.episodes[currentServer]) ? currentServer : 0;
                    if (validServerIndex !== currentServer) setCurrentServer(0);

                    const serverData = data.episodes?.[validServerIndex]?.server_data || [];
                    if (serverData.length > 0) {
                        let foundEp = serverData.find(e => e.slug === currentEpSlug);
                        if (!foundEp) foundEp = serverData[0];
                        setCurrentEpisode(foundEp);
                    }
                    setLoading(false); // hien trinh phat + tap hien tai ngay

                    const key = `watched_${data.movie._id}`;
                    const saved = JSON.parse(localStorage.getItem(key)) || [];
                    setWatchedEpisodes(saved);

                    // Phu: chay nen, khong chan trinh phat
                    getMoviePeoples(slug).then(res => setCasts(res || []));
                    checkFavoriteStatus(data.movie.slug).then(setIsFavorite).catch(() => {});
                }
            } catch (error) { console.error(error); } finally { setLoading(false); }
        };
        fetchData();
    }, [slug]);

    // Phim tuong tu: chi fetch khi panel sap vao viewport (panel da doi
    // len ngay duoi phan chon tap nen thuong thay ngay sau khi mo trang,
    // nhung van khong chan trinh phat).
    useEffect(() => {
        if (!relatedVisible || !movie || relatedLoaded) return;
        if (!movie.category?.[0]) return;
        setRelatedLoaded(true);
        const catSlug = movie.category[0].slug;
        const randomPage = Math.floor(Math.random() * 5) + 1;
        getMoviesBySlug(catSlug, randomPage, 'the-loai').then(relatedData => {
            if (relatedData?.data?.items) {
                setRelatedMovies(relatedData.data.items.filter(m => m.slug !== movie.slug).sort(() => Math.random() - 0.5));
            }
        }).catch(() => {});
    }, [relatedVisible, movie, relatedLoaded]);

    useEffect(() => {
        if (episodes.length > 0) {
            const safeServerIndex = episodes[currentServer] ? currentServer : 0;
            const serverData = episodes[safeServerIndex]?.server_data || [];
            if (currentEpSlug) {
                const found = serverData.find(e => e.slug === currentEpSlug);
                if (found) {
                    window.scrollTo({ top: 0, behavior: 'smooth' });
                    setCurrentEpisode(found);
                    if (movie) {
                        setWatchHistory({ movieSlug: movie.slug, episodeSlug: found.slug, movieName: movie.name, movieThumb: movie.thumb_url, episodeName: found.name });
                        const key = `watched_${movie._id}`;
                        const currentList = JSON.parse(localStorage.getItem(key)) || [];
                        if (!currentList.includes(found.slug)) {
                            const newList = [...currentList, found.slug];
                            localStorage.setItem(key, JSON.stringify(newList));
                            setWatchedEpisodes(newList);
                        }
                    }
                }
            }
        }
    }, [currentEpSlug, episodes, currentServer, movie]);

    // Logic đổi server giữ nguyên tập
    useEffect(() => {
        if (movie && episodes.length > 0 && currentEpisode) {
            const currentEpName = currentEpisode.name;
            const newServerData = episodes[currentServer]?.server_data;
            if (!newServerData || newServerData.length === 0) return;
            
            let foundEp = newServerData.find(e => e.name === currentEpName);
            if (!foundEp) {
                // Fallback tìm theo slug nếu name khác
                let oldIndex = -1;
                for (const sv of episodes) {
                    const idx = sv.server_data.findIndex(e => e.slug === currentEpisode.slug);
                    if (idx !== -1) { oldIndex = idx; break; }
                }
                foundEp = (oldIndex !== -1 && newServerData[oldIndex]) ? newServerData[oldIndex] : newServerData[0];
            }
            if (foundEp && foundEp.slug !== currentEpisode.slug) {
                setCurrentEpisode(foundEp);
                setSearchParams({ tap: foundEp.slug });
            }
        }
    }, [currentServer, episodes, movie, currentEpisode, setSearchParams]);

    const handleChangeEpisode = (ep) => { setCurrentEpisode(ep); setSearchParams({ tap: ep.slug }); };

    // --- Sap xep / tim tap ---
    // API vsmov tra danh sach tap khong theo thu tu (vd One Piece: khoi
    // 1156-1171 roi moi toi 1123-1155...), nen sap xep 1->N / N->1 la can.
    const displayEpisodes = episodes[currentServer] ? episodes[currentServer] : episodes[0];
    const sortedEpisodes = useMemo(() => {
        const list = [...(displayEpisodes?.server_data || [])];
        list.sort((a, b) => {
            const na = epNumber(a), nb = epNumber(b);
            if (na !== null && nb !== null) return epSort === 'asc' ? na - nb : nb - na;
            const cmp = String(a.name).localeCompare(String(b.name));
            return epSort === 'asc' ? cmp : -cmp;
        });
        return list;
    }, [displayEpisodes, epSort]);
    const visibleEpisodes = sortedEpisodes.slice(epWinStart, epWinStart + epWinCount);

    // Dam bao tap dang xem luon nam trong cua so da render + cuon toi no
    // (vd mo link ?tap=tap-1156 trong khi dang sap xep 1->N: tap 1156 o vi tri 1155,
    // cua so se la 1101-1180 thay vi render het tu 1 toi 1156).
    useEffect(() => {
        if (!currentEpisode || sortedEpisodes.length === 0) return;
        const idx = sortedEpisodes.findIndex(e => e.slug === currentEpisode.slug);
        if (idx === -1) return;
        if (idx < epWinStart || idx >= epWinStart + epWinCount) {
            setEpWinStart(Math.max(0, Math.floor(idx / EP_PAGE) * EP_PAGE));
            setEpWinCount(EP_PAGE);
        }
        setJumpSlug(currentEpisode.slug);
    }, [currentEpisode, sortedEpisodes]);

    // Cuon khung danh sach tap toi tap vua nhay (chi cuon khung trong, khong cuon trang).
    useEffect(() => {
        if (!jumpSlug) return;
        const el = epBtnRefs.current[jumpSlug];
        if (el) {
            el.scrollIntoView({ behavior: 'smooth', block: 'nearest' });
            setJumpSlug(null);
        }
    }, [jumpSlug, epWinStart, epWinCount, sortedEpisodes]);

    const handleSearchEpisode = () => {
        const q = epQuery.trim();
        if (!q) { setEpSearchMsg(''); return; }
        const list = displayEpisodes?.server_data || [];
        const num = parseInt(q.replace(/\D/g, ''), 10);
        let found = null;
        if (!Number.isNaN(num)) found = list.find(e => epNumber(e) === num);
        if (!found) found = list.find(e => String(e.name).trim().toLowerCase() === q.toLowerCase());
        if (!found) { setEpSearchMsg(`Không tìm thấy tập "${q}"`); return; }
        setEpSearchMsg('');
        const idx = sortedEpisodes.findIndex(e => e.slug === found.slug);
        if (idx < epWinStart || idx >= epWinStart + epWinCount) {
            setEpWinStart(Math.max(0, Math.floor(idx / EP_PAGE) * EP_PAGE));
            setEpWinCount(EP_PAGE);
        }
        setJumpSlug(found.slug);
        handleChangeEpisode(found);
    };

    const handleToggleFavorite = async () => {
        try {
            const rating = movie.tmdb?.vote_average || movie.vote_average || 0;
            const currentEpName = currentEpisode?.name || 'Full';
            const newStatus = await toggleFavorite({
                slug: movie.slug, name: movie.name, thumb_url: movie.thumb_url, quality: movie.quality, year: movie.year, episode_current: currentEpName, vote_average: rating
            });
            setIsFavorite(newStatus);
            showToast(newStatus ? 'Đã thêm vào tủ phim ❤️' : 'Đã xóa khỏi tủ phim 💔');
        } catch (error) {
            showToast(error.toString());
            if (error === "Vui lòng đăng nhập để lưu phim!") setTimeout(() => navigate('/login'), 1500);
        }
    };

    const getNextEpisode = () => {
        if (!episodes || episodes.length === 0 || !currentEpisode) return null;
        const safeServerIndex = episodes[currentServer] ? currentServer : 0;
        const serverData = episodes[safeServerIndex]?.server_data || [];
        if (serverData.length === 0) return null;
        const currentIndex = serverData.findIndex(e => e.slug === currentEpisode.slug);
        if (currentIndex !== -1 && currentIndex < serverData.length - 1) return serverData[currentIndex + 1];
        return null;
    };

    if (loading) return <div className="min-h-screen bg-transparent flex items-center justify-center"><div className="animate-spin rounded-full h-12 w-12 border-t-2 border-b-2 border-red-600"></div></div>;
    if (!movie) return null;

    const nextEp = getNextEpisode();
    const bgImage = `${IMG_URL}${movie.poster_url || movie.thumb_url}`;
    const pageTitle = `Xem phim ${movie.name} - Tập ${currentEpisode?.name} | PhimVietHay`;
    const ratingVal = Number(movie.tmdb?.vote_average || movie.vote_average || 0);
    const voteCount = movie.tmdb?.vote_count || 0;

    return (
        <div className={`min-h-screen font-sans transition-colors duration-700 text-white overflow-x-hidden selection:bg-red-600 selection:text-white`}>
            <Helmet>
                <title>{pageTitle}</title>
                <meta name="description" content={`Xem phim ${movie.name} tập ${currentEpisode?.name} chất lượng cao.`} />
            </Helmet>

            {!isLightOff && (
                <div className="fixed inset-0 z-0 pointer-events-none">
                    <div className="absolute inset-0 bg-cover bg-center opacity-20 blur-[120px] scale-110 transition-all duration-1000" style={{ backgroundImage: `url(${bgImage})` }} />
                    <div className="absolute inset-0 bg-gradient-to-b from-black/60 via-black/80 to-black z-10" />
                </div>
            )}

            {toastMsg && <Toast message={toastMsg} onClose={() => setToastMsg('')} />}
            <div className={`fixed inset-0 bg-black/98 z-40 transition-opacity duration-700 pointer-events-none ${isLightOff ? 'opacity-100' : 'opacity-0'}`} />

            <div className={`relative z-50 transition-all duration-700 ${isLightOff ? 'pt-10' : 'pt-24 pb-12'} container mx-auto px-0 md:px-4`} ref={playerRef}>
                <div className={`flex items-center gap-2 text-xs md:text-sm text-gray-400 mb-4 px-4 md:px-0 transition-opacity duration-500 ${isLightOff ? 'opacity-0 pointer-events-none' : 'opacity-100'}`}>
                    <Link to="/" className="hover:text-red-500 transition-colors flex items-center gap-1"><FaHome /> Trang chủ</Link>
                    <FaAngleRight className="text-gray-600 text-[10px]" />
                    {movie && <><Link to={`/phim/${movie.slug}`} className="hover:text-red-500 transition-colors line-clamp-1 max-w-[120px] md:max-w-none" title={movie.name}>{movie.name}</Link><FaAngleRight className="text-gray-600 text-[10px]" /></>}
                    <span className="text-white font-medium line-clamp-1 text-red-500">{currentEpisode?.name ? `Đang xem Tập ${currentEpisode.name}` : 'Đang tải...'}</span>
                </div>

                <div className={`flex flex-col lg:flex-row gap-6 ${isTheater ? 'justify-center' : ''}`}>
                    <div className={`w-full ${isTheater || isLightOff ? 'lg:w-[100%]' : 'lg:w-[75%]'} transition-all duration-500`}>
                        <div className="relative w-full aspect-video bg-black md:rounded-xl overflow-hidden shadow-[0_0_50px_rgba(220,38,38,0.15)] ring-1 ring-white/10 md:ring-red-500/20 group z-20">
                            {currentEpisode ? (
                                currentEpisode.link_embed ? (
                                    <iframe
                                        key={`${currentServer}-${currentEpisode.slug}`}
                                        src={currentEpisode.link_embed}
                                        title={`Xem ${movie.name} - Tập ${currentEpisode.name}`}
                                        className="w-full h-full"
                                        frameBorder="0"
                                        allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture; web-share"
                                        allowFullScreen
                                    />
                                ) : (
                                    <div className="flex items-center justify-center h-full text-gray-400 bg-gray-900 px-6 text-center"><p>Tập này chưa có link phát. Thử đổi server khác bên phải.</p></div>
                                )
                            ) : <div className="flex items-center justify-center h-full text-gray-500 bg-gray-900"><p>Đang tải...</p></div>}
                        </div>

                        <div className="mt-0 md:mt-4 bg-gradient-to-r from-black/80 to-black/60 border-b md:border border-white/10 border-t-white/5 p-3 md:rounded-lg backdrop-blur-xl flex flex-wrap items-center justify-between gap-3 shadow-lg">
                            <div className="flex items-center gap-4">
                                <div className="flex items-center gap-2 text-red-500 font-bold drop-shadow-[0_0_10px_rgba(220,38,38,0.5)]"><FaPlay className="text-sm" /><span className="text-sm uppercase tracking-wide">Tập: <span className="text-white ml-1">{currentEpisode?.name}</span></span></div>
                                {nextEp && <button onClick={() => handleChangeEpisode(nextEp)} className="flex items-center gap-1 text-xs font-bold text-white bg-gradient-to-r from-red-600 to-red-700 hover:from-red-500 hover:to-red-600 px-4 py-2 rounded-full transition-all shadow-md hover:shadow-red-600/30 animate-pulse-slow">Tiếp theo <FaStepForward /></button>}
                            </div>
                            <div className="flex items-center gap-2">
                                <button onClick={handleToggleFavorite} className={`p-2.5 rounded-full transition-all ${isFavorite ? 'text-red-500 bg-red-500/10 hover:bg-red-500/20' : 'text-gray-300 hover:bg-white/10 hover:text-white'}`} title={isFavorite ? "Bỏ theo dõi" : "Theo dõi phim"}><FaHeart /></button>
                                <button onClick={() => setIsLightOff(!isLightOff)} className="p-2.5 rounded-full hover:bg-white/10 text-gray-300 transition-all" title="Tắt đèn"><FaLightbulb /></button>
                                <button onClick={() => setIsTheater(!isTheater)} className="p-2.5 rounded-full hover:bg-white/10 text-gray-300 hidden md:block transition-all" title="Rạp chiếu"><FaExpand /></button>
                                <button onClick={() => navigate(`/phim/${movie.slug}`)} className="p-2.5 rounded-full hover:bg-white/10 text-gray-300 transition-all" title="Chi tiết"><FaArrowLeft /></button>
                            </div>
                        </div>

                        {!isLightOff && currentEpisode?.link_embed && (
                            <p className="mt-2 px-1 text-[11px] text-gray-500">Đang phát bằng trình nhúng ngoài — bấm “Tiếp theo” để chuyển tập. Tự chuyển tập, lưu vị trí xem và skip intro chưa hỗ trợ với dạng nhúng này.</p>
                        )}

                        {!isLightOff && (
                            <div className="mt-8 space-y-8 px-4 md:px-0">
                                <div className="bg-black/40 p-6 md:p-8 rounded-2xl border border-white/10 backdrop-blur-xl shadow-2xl relative overflow-hidden">
                                    <div className="absolute top-0 right-0 -mt-20 -mr-20 w-64 h-64 bg-red-600/10 rounded-full blur-[80px] pointer-events-none"></div>
                                    <h1 className="text-3xl md:text-4xl font-extrabold text-transparent bg-clip-text bg-gradient-to-r from-white to-gray-300 mb-4">{movie.name}</h1>
                                    <div className="flex flex-wrap items-center gap-3 text-sm mb-5">
                                        <span className="bg-gradient-to-r from-red-600 to-red-700 text-white px-3 py-1 rounded-md font-bold text-xs shadow-lg shadow-red-900/20 uppercase tracking-wider">{movie.quality || 'HD'}</span>
                                        <span className="flex items-center gap-1 bg-yellow-500/20 text-yellow-500 px-3 py-1 rounded-md font-bold border border-yellow-500/20"><FaStar /> {ratingVal > 0 ? ratingVal.toFixed(1) : 'N/A'} <span className="text-yellow-300/70 font-normal text-xs ml-1">({voteCount})</span></span>
                                        <span className="flex items-center gap-1 text-gray-300 bg-white/5 px-3 py-1 rounded-md border border-white/10"><FaClock className="text-red-500" /> {movie.time}</span>
                                        <span className="text-gray-300 bg-white/5 px-3 py-1 rounded-md border border-white/10">{movie.year}</span>
                                        <span className="flex items-center gap-1 text-gray-300 bg-white/5 px-3 py-1 rounded-md border border-white/10"><FaGlobe className="text-red-500" /> {movie.country?.[0]?.name}</span>
                                    </div>
                                    <h2 className="text-base text-gray-400 italic mb-5 border-b border-white/5 pb-4 font-medium">{movie.origin_name}</h2>
                                    <p className="text-gray-200 text-sm leading-relaxed line-clamp-4 md:line-clamp-none">{movie.content?.replace(/<[^>]*>?/gm, '')}</p>
                                </div>
                                {/* Binh luan — lazy: chi mount (kem fetch /comments) khi sap vao viewport */}
                                <div ref={commentSectionRef}>
                                    {movie && currentEpisode && commentsVisible ? (
                                        <CommentSection movieSlug={movie.slug} episodeSlug={currentEpisode.slug} />
                                    ) : (
                                        <p className="text-sm text-gray-500 py-6 text-center">Đang tải bình luận...</p>
                                    )}
                                </div>
                            </div>
                        )}
                    </div>

                    {!isTheater && !isLightOff && (
                        <div className={`w-full lg:w-[28%] flex flex-col gap-6 transition-all duration-700 ${isLightOff ? 'opacity-20 blur-sm' : 'opacity-100'} px-4 md:px-0`}>
                            <div className="bg-black/40 backdrop-blur-xl rounded-2xl border border-white/10 overflow-hidden flex flex-col max-h-[500px] shadow-2xl">
                                <div className="p-4 bg-white/5 border-b border-white/10 flex flex-col gap-3">
                                    <div className="flex justify-between items-center">
                                        <h3 className="font-bold text-white flex items-center gap-2 text-sm uppercase tracking-wider"><FaList className="text-red-600" /> Chọn Tập</h3>
                                        <span className="text-xs text-gray-400 bg-white/10 px-2 py-0.5 rounded-full">{displayEpisodes?.server_data?.length || 0} tập</span>
                                    </div>
                                    {/* Sap xep + tim tap */}
                                    <div className="flex gap-2">
                                        <button
                                            onClick={() => setEpSort(epSort === 'asc' ? 'desc' : 'asc')}
                                            title={epSort === 'asc' ? 'Đang xếp tăng dần 1 → N, bấm để đảo thành N → 1' : 'Đang xếp giảm dần N → 1, bấm để đảo thành 1 → N'}
                                            className="flex items-center gap-1 px-2.5 py-2 text-[11px] font-bold rounded-lg bg-white/5 border border-white/10 text-gray-200 hover:bg-white/10 hover:text-white transition whitespace-nowrap"
                                        >
                                            {epSort === 'asc' ? <><FaSortAmountUp className="text-red-500" /> 1 → N</> : <><FaSortAmountDown className="text-red-500" /> N → 1</>}
                                        </button>
                                        <div className="flex flex-1 gap-1">
                                            <input
                                                type="text"
                                                inputMode="numeric"
                                                value={epQuery}
                                                onChange={(e) => { setEpQuery(e.target.value); setEpSearchMsg(''); }}
                                                onKeyDown={(e) => { if (e.key === 'Enter') handleSearchEpisode(); }}
                                                placeholder="Tìm tập... (VD: 500)"
                                                className="min-w-0 flex-1 bg-black/40 border border-white/10 rounded-lg px-2.5 py-2 text-xs text-white placeholder-gray-500 outline-none focus:border-red-500/60"
                                            />
                                            <button onClick={handleSearchEpisode} title="Nhảy tới tập" className="px-3 py-2 rounded-lg bg-red-600 hover:bg-red-500 text-white transition flex items-center">
                                                <FaSearch className="text-xs" />
                                            </button>
                                        </div>
                                    </div>
                                    {epSearchMsg && <p className="text-[11px] text-red-400 font-medium">{epSearchMsg}</p>}
                                    {episodes.length > 1 && (
                                        <div className="flex flex-wrap gap-2 p-1 bg-black/20 rounded-lg">
                                            {episodes.map((s, i) => (
                                                <button key={i} onClick={() => setCurrentServer(i)} className={`px-3 py-1.5 text-[10px] font-bold rounded-md transition-all duration-300 flex-1 ${currentServer === i ? 'bg-gradient-to-r from-red-600 to-red-700 text-white shadow-md' : 'text-gray-400 hover:bg-white/10 hover:text-white'}`}>{s.server_name}</button>
                                            ))}
                                        </div>
                                    )}
                                </div>
                                <div ref={epListRef} className="flex-1 overflow-y-auto custom-scrollbar p-3 bg-black/20">
                                    {epWinStart > 0 && (
                                        <button
                                            onClick={() => { setEpWinStart(Math.max(0, epWinStart - EP_PAGE)); setEpWinCount(epWinCount + EP_PAGE); }}
                                            className="mb-3 w-full py-2.5 rounded-lg bg-white/5 hover:bg-white/10 border border-white/10 text-xs font-bold text-gray-300 hover:text-white transition"
                                        >
                                            ↑ Xem các tập trước
                                        </button>
                                    )}
                                    <div className="grid grid-cols-4 gap-2">
                                        {visibleEpisodes.map((ep, idx) => {
                                            const isActive = currentEpisode?.slug === ep.slug;
                                            const isWatched = watchedEpisodes.includes(ep.slug);
                                            return (
                                                <button key={`${ep.slug}-${idx}`} ref={(el) => { if (el) epBtnRefs.current[ep.slug] = el; else delete epBtnRefs.current[ep.slug]; }} onClick={() => handleChangeEpisode(ep)} className={`relative h-10 rounded-lg text-xs font-bold transition-all duration-300 border overflow-hidden group ${isActive ? 'bg-gradient-to-r from-red-600 to-red-700 text-white border-red-500/50 shadow-[0_0_15px_rgba(220,38,38,0.4)] scale-105 z-10' : isWatched ? 'bg-gray-800/50 text-gray-500 border-white/5 hover:bg-gray-700/50' : 'bg-white/5 text-gray-300 border-white/10 hover:bg-white/10 hover:text-white hover:border-white/30'}`}>
                                                    {isActive && <span className="absolute inset-0 bg-white/20 animate-pulse-slow mix-blend-overlay"></span>}
                                                    {ep.name}
                                                </button>
                                            );
                                        })}
                                    </div>
                                    {epWinStart + epWinCount < sortedEpisodes.length && (
                                        <button
                                            onClick={() => setEpWinCount(epWinCount + EP_PAGE)}
                                            className="mt-3 w-full py-2.5 rounded-lg bg-white/5 hover:bg-white/10 border border-white/10 text-xs font-bold text-gray-300 hover:text-white transition"
                                        >
                                            Hiển thị thêm ({sortedEpisodes.length - epWinStart - epWinCount} tập còn lại)
                                        </button>
                                    )}
                                </div>
                            </div>

                            {/* Phim tương tự — vòng 4 (23/11/2026): theo ảnh user gửi,
                                bỏ header chữ khô "Phim tương tự / Xem tất cả" và
                                lưới dọc 1 cột (vòng 3, 6 card 200px, panel ~2331px).
                                Thay bằng: (1) thẻ tiêu đề theme ở ĐẦU panel — cùng
                                kiểu thẻ tạp chí của MovieRow (ảnh nền + gradient
                                theme theo thể loại đầu của phim + tiêu đề lớn +
                                mô tả + nút "XEM TẤT CẢ →"), nhưng dạng BANNER
                                NGANG NGẮN (h ~150px) cho vừa chiều rộng sidebar
                                (~350px), không phải thẻ dọc cao 520px như trang
                                chủ; bấm cả thẻ đi tới /the-loai/<thể loại đầu>
                                như nút cũ. Ảnh nền: poster phim tương tự đầu
                                tiên (đã tải về), chưa có thì poster phim đang xem.
                                (2) lưới 2 CỘT bên dưới, đúng MovieCard chung
                                (poster + tên + badge HD/điểm/năm, hover popup
                                2s như trang chủ). Mỗi card ~153px ≈ cỡ card
                                mobile trang chủ (150px, MovieRow w-[150px]).
                                Số lượng giữ 6 phim (3 hàng): panel còn ~1,05k px
                                thay vì ~2,3k px; 8 phim (4 hàng) dài thêm ~300px
                                mà không thêm giá trị — đủ xem, không cuộn dài.
                                Vị trí (sidebar phải, dưới panel chọn tập), lazy
                                load + logic fetch (random page 1–5, xáo trộn)
                                giữ nguyên, không sửa. */}
                            <div ref={relatedSectionRef} className="bg-black/40 backdrop-blur-xl rounded-2xl border border-white/10 overflow-hidden shadow-2xl">
                                {(() => {
                                    const catSlug = movie.category?.[0]?.slug;
                                    const theme = SECTION_THEMES[catSlug] || SECTION_THEMES['default'];
                                    const bannerBg = relatedMovies[0]?.thumb_url || movie.poster_url || movie.thumb_url;
                                    const goAll = () => { if (catSlug) navigate(`/the-loai/${catSlug}`); };
                                    return (
                                        <div
                                            onClick={goAll}
                                            role="button"
                                            aria-label="Xem tất cả phim tương tự"
                                            className={`relative h-[150px] overflow-hidden cursor-pointer group/banner bg-[#0a0e17] ${catSlug ? '' : 'cursor-default'}`}
                                        >
                                            <div
                                                className="absolute inset-0 bg-cover bg-center transition-all duration-1000 group-hover/banner:scale-110 opacity-80 group-hover/banner:opacity-100"
                                                style={{ backgroundImage: `url(${bannerBg})` }}
                                            />
                                            <div className={`absolute inset-0 bg-gradient-to-b ${theme.gradient} opacity-80 group-hover/banner:opacity-60 transition-opacity duration-500`} />
                                            <div className={`absolute top-0 left-0 w-full h-1 ${theme.borderTop}`} />
                                            <div className="absolute inset-0 p-4 flex flex-col z-10">
                                                <div className={`text-2xl mb-2 ${theme.accent} drop-shadow-md`}>{theme.icon}</div>
                                                <h3 className="text-[22px] font-black text-white leading-none uppercase drop-shadow-xl">Có thể bạn muốn xem</h3>
                                                <p className="text-xs text-gray-200 font-medium opacity-90 mt-2 line-clamp-1">{theme.desc}</p>
                                                {catSlug && (
                                                    <div className="pt-3 mt-auto border-t border-white/10 flex items-center gap-2 text-xs font-bold uppercase tracking-widest text-white">
                                                        Xem tất cả
                                                        <span className={`w-6 h-6 rounded-full border border-white/40 flex items-center justify-center bg-white/10 ${theme.badgeBg} transition-colors`}>
                                                            <FaArrowRight size={8} />
                                                        </span>
                                                    </div>
                                                )}
                                            </div>
                                        </div>
                                    );
                                })()}
                                <div className="p-3 bg-black/20">
                                    {relatedMovies.length > 0 ? (
                                        <div className="grid grid-cols-2 gap-3">
                                            {relatedMovies.slice(0, 6).map((m) => (
                                                <MovieCard key={m.slug} movie={m} />
                                            ))}
                                        </div>
                                    ) : (
                                        <p className="text-xs text-gray-500 text-center py-4">Đang tải phim tương tự...</p>
                                    )}
                                </div>
                            </div>

                            {casts.length > 0 && (
                                <div className="bg-black/40 backdrop-blur-xl rounded-2xl border border-white/10 overflow-hidden shadow-2xl">
                                    <div className="p-4 bg-white/5 border-b border-white/10"><h3 className="font-bold text-white flex items-center gap-2 text-sm uppercase tracking-wider"><FaUsers className="text-red-600" /> Diễn viên</h3></div>
                                    <div className="p-3 max-h-[350px] overflow-y-auto custom-scrollbar bg-black/20">
                                        <div className="grid grid-cols-2 gap-3">
                                            {casts.map((actor, idx) => (
                                                <div key={idx} className="flex items-center gap-3 group cursor-pointer p-2 rounded-xl hover:bg-white/5 transition-all border border-transparent hover:border-white/10">
                                                    <div className="w-10 h-10 rounded-full overflow-hidden border-2 border-white/10 group-hover:border-red-500/50 transition-all flex-shrink-0 bg-gray-800 shadow-sm">
                                                        {actor.profile_path ? <img src={getActorImg(actor.profile_path)} alt={actor.name} className="w-full h-full object-cover filter group-hover:brightness-110 transition-all" loading="lazy" /> : <div className="w-full h-full flex items-center justify-center text-xs text-gray-400 font-bold">{actor.name.charAt(0)}</div>}
                                                    </div>
                                                    <div className="min-w-0"><p className="text-xs font-bold text-gray-200 truncate group-hover:text-red-400 transition-colors">{actor.name}</p><p className="text-[10px] text-gray-500 truncate">{actor.character || 'Diễn viên'}</p></div>
                                                </div>
                                            ))}
                                        </div>
                                    </div>
                                </div>
                            )}
                        </div>
                    )}
                </div>
            </div>
        </div>
    );
};

export default WatchMovie;