import React, { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Helmet } from 'react-helmet-async';
import { FaHeart, FaTimes, FaCheckCircle, FaExclamationCircle } from 'react-icons/fa';

import Header from '../components/layout/Header';
import MovieCard from '../components/movies/MovieCard';
import { getFavorites, getCurrentUser, toggleFavorite } from '../services/authService';

// --- TOAST THÔNG BÁO — tái dùng đúng mẫu Toast nội bộ có sẵn ở
// Profile.jsx/Register.jsx (không thư viện ngoài): tự tắt sau 3s.
const Toast = ({ type, message, onClose }) => {
    useEffect(() => { const timer = setTimeout(onClose, 3000); return () => clearTimeout(timer); }, [onClose]);
    const isSuccess = type === 'success';
    return (
        <div className={`fixed top-6 right-6 z-[300] flex items-center gap-4 px-6 py-4 rounded-xl border-l-4 backdrop-blur-md animate-fade-in-down transition-all shadow-2xl ${isSuccess ? 'bg-green-900/90 text-white border-green-500 shadow-green-900/30' : 'bg-red-900/90 text-white border-red-600 shadow-red-900/30'}`}>
            <div className={`p-1 rounded-full ${isSuccess ? 'bg-green-500/20' : 'bg-red-500/20'}`}>{isSuccess ? <FaCheckCircle className="text-xl text-green-400" /> : <FaExclamationCircle className="text-xl text-red-400" />}</div>
            <div>
                <h4 className={`font-bold text-sm uppercase tracking-wider ${isSuccess ? 'text-green-400' : 'text-red-400'}`}>{isSuccess ? 'Thành công' : 'Thông báo'}</h4>
                <p className="text-xs opacity-90 mt-0.5 text-gray-100">{message}</p>
            </div>
            <button onClick={onClose} className="ml-2 text-white/50 hover:text-white transition"><FaTimes /></button>
        </div>
    );
};

// --- D1 (23/11/2026): Tủ phim dùng chung MovieCard như trang chủ/Profile —
// card tự viết FavoriteItem cũ đã gỡ (khác bo góc, không có hover popup,
// hiện "N/A" khi chưa có điểm).
// --- Vòng 2 (23/11/2026): nút X gỡ lưu HIỆN RÕ LUÔN trên card (không chờ
// hover) — nút xóa hover-only cũ thực tế không bấm được: popup hover của
// MovieCard (portal z-[9999]) mở ngay khi trỏ vào card và che mất nút
// (z-20), còn trên cảm ứng thì hover không tồn tại nên nút không bao giờ
// hiện. Nút X mới đặt z-[10000] (cao hơn popup) nên luôn nhìn thấy và bấm
// được, bấm là gỡ ngay (không modal xác nhận), card biến mất khỏi state
// local tức thì + toast xác nhận; API lỗi thì card quay lại + toast lỗi.

// --- MAIN COMPONENT ---
const Favorites = () => {
    const navigate = useNavigate();
    
    // Data State
    const [favorites, setFavorites] = useState([]);
    const [loading, setLoading] = useState(true);

    // UI State
    const [toast, setToast] = useState(null);

    // 1. Fetch và Map dữ liệu
    const fetchFavs = async () => {
        const data = await getFavorites();
        
        // D1: map về đúng shape MovieCard dùng ở Profile.jsx (origin_name
        // 'Đã lưu' giữ lại dòng phụ cũ của card tủ phim).
        const mappedData = data.map(item => ({
            _id: item.id,
            slug: item.movie_slug,
            name: item.movie_name,
            thumb_url: item.movie_thumb,
            quality: item.movie_quality || 'HD',
            year: item.movie_year || '2024',
            episode_current: item.episode_current || 'Full',
            vote_average: item.vote_average ? parseFloat(item.vote_average) : 0,
            origin_name: 'Đã lưu',
        }));

        setFavorites(mappedData || []);
        setLoading(false);
    };

    useEffect(() => {
        if (!getCurrentUser()) {
            navigate('/login');
            return;
        }
        fetchFavs();
    }, [navigate]);

    // 2. Logic Xóa — gỡ trực tiếp bằng nút X trên card: card biến mất
    // khỏi state local NGAY (không chờ API, không tải lại trang), toast
    // xác nhận; API lỗi thì card quay lại đúng vị trí cũ + toast lỗi.
    const handleRemove = async (movie) => {
        const prev = favorites;
        setFavorites(prev.filter((m) => m._id !== movie._id));
        try {
            await toggleFavorite({ slug: movie.slug });
            setToast({ type: 'success', message: `Đã gỡ "${movie.name}" khỏi tủ phim.` });
        } catch (e) {
            setFavorites(prev);
            setToast({ type: 'error', message: 'Không gỡ được phim, vui lòng thử lại.' });
        }
    };

    return (
        <div className="bg-phim-dark min-h-screen text-white font-sans pb-20 selection:bg-[var(--accent)] selection:text-white">
            <Helmet>
                <title>Tủ Phim Của Tôi | PhimVietHay</title>
            </Helmet>
            {toast && <Toast type={toast.type} message={toast.message} onClose={() => setToast(null)} />}

            <div className="pt-28 px-4 md:px-12 container mx-auto">
                {/* Header */}
                <div className="mb-10 border-b border-white/10 pb-6 flex items-end justify-between">
                    <h1 className="text-2xl md:text-3xl font-bold uppercase tracking-wide flex items-center gap-3">
                        <span className="text-[var(--accent)] border-l-4 border-[var(--accent)] pl-3">Tủ Phim Của Tôi</span>
                    </h1>
                    <span className="text-gray-400 font-bold bg-white/5 px-3 py-1 rounded-lg border border-white/5">
                        {favorites.length} phim
                    </span>
                </div>

                {/* Content */}
                {loading ? (
                    <div className="flex justify-center py-40">
                        <div className="animate-spin rounded-full h-12 w-12 border-t-2 border-b-2 border-[var(--accent)]"></div>
                    </div>
                ) : favorites.length > 0 ? (
                    <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 xl:grid-cols-6 gap-4 gap-y-8">
                        {favorites.map((movie) => (
                            <div key={movie._id} className="relative group">
                                <MovieCard movie={movie} />
                                {/* Nút X gỡ lưu: HIỆN RÕ LUÔN (không chờ hover), góc
                                trên-phải poster, z-[10000] cao hơn popup hover
                                (z-[9999]) nên không bị che; nằm NGOÀI Link của
                                card nên không xung đột click mở chi tiết. */}
                                <button
                                    type="button"
                                    aria-label={`Gỡ ${movie.name} khỏi tủ phim`}
                                    title="Gỡ khỏi tủ phim"
                                    onClick={(e) => { e.stopPropagation(); e.preventDefault(); handleRemove(movie); }}
                                    className="absolute top-2 right-2 z-[10000] w-8 h-8 flex items-center justify-center rounded-full bg-red-600 text-white shadow-lg shadow-black/50 ring-1 ring-white/30 hover:bg-red-500 hover:scale-110 active:scale-95 transition cursor-pointer"
                                >
                                    <FaTimes size={14} />
                                </button>
                            </div>
                        ))}
                    </div>
                ) : (
                    <div className="flex flex-col items-center justify-center py-32 text-gray-500 border-2 border-dashed border-gray-800 rounded-2xl bg-white/5">
                        <FaHeart className="text-6xl mb-4 text-gray-700 animate-pulse"/>
                        <p className="text-xl font-bold text-gray-400">Tủ phim trống trơn</p>
                        <p className="text-sm text-gray-600 mt-2 mb-6">Lưu lại những bộ phim hay để xem sau nhé!</p>
                        <button onClick={() => navigate('/')} className="bg-[var(--accent)] px-8 py-3 rounded-full font-bold hover:bg-[var(--accent-hover)] transition text-white shadow-lg shadow-red-900/20">
                            Khám phá ngay
                        </button>
                    </div>
                )}
            </div>
        </div>
    );
};

export default Favorites;