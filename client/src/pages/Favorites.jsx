import React, { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Helmet } from 'react-helmet-async';
import { FaHeart, FaTrashAlt, FaExclamationTriangle } from 'react-icons/fa';

import Header from '../components/layout/Header';
import MovieCard from '../components/movies/MovieCard';
import { getFavorites, getCurrentUser, toggleFavorite } from '../services/authService';

// --- SUB-COMPONENT: MODAL XÓA ---
const DeleteModal = ({ isOpen, movieName, onClose, onConfirm }) => {
    if (!isOpen) return null;
    return (
        <div className="fixed inset-0 z-[200] flex items-center justify-center p-4 bg-black/90 backdrop-blur-sm animate-fade-in">
            <div className="bg-[#1a1a1a] border border-white/10 p-6 rounded-2xl shadow-2xl w-full max-w-sm text-center transform scale-100 transition-all">
                <div className="w-16 h-16 bg-red-900/30 rounded-full flex items-center justify-center mx-auto mb-4">
                    <FaExclamationTriangle className="text-3xl text-red-500" />
                </div>
                <h3 className="text-xl font-bold text-white mb-2">Xóa khỏi tủ phim?</h3>
                <p className="text-gray-400 text-sm mb-6">
                    Bạn có chắc chắn muốn xóa <span className="text-white font-bold">"{movieName}"</span> khỏi danh sách yêu thích không?
                </p>
                <div className="flex gap-3">
                    <button onClick={onClose} className="flex-1 py-2.5 rounded-xl font-bold text-gray-400 bg-[#222] hover:bg-[#333] transition">
                        Hủy bỏ
                    </button>
                    <button onClick={onConfirm} className="flex-1 py-2.5 rounded-xl font-bold text-white bg-red-600 hover:bg-red-700 transition shadow-lg">
                        Xóa ngay
                    </button>
                </div>
            </div>
        </div>
    );
};

// --- D1 (23/11/2026): Tủ phim dùng chung MovieCard như trang chủ/Profile —
// card tự viết FavoriteItem cũ đã gỡ (khác bo góc, không có hover popup,
// hiện "N/A" khi chưa có điểm). Nút xóa giữ nguyên, phủ lên trên card theo
// đúng mẫu Profile.jsx (overlay top-left, hiện khi hover).

// --- MAIN COMPONENT ---
const Favorites = () => {
    const navigate = useNavigate();
    
    // Data State
    const [favorites, setFavorites] = useState([]);
    const [loading, setLoading] = useState(true);
    
    // UI State
    const [showDeleteModal, setShowDeleteModal] = useState(false);
    const [movieToDelete, setMovieToDelete] = useState(null);

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

    // 2. Logic Xóa
    const requestDelete = (movie) => {
        setMovieToDelete(movie);
        setShowDeleteModal(true);
    };

    const confirmDelete = async () => {
        if (movieToDelete) {
            await toggleFavorite({ slug: movieToDelete.slug });
            fetchFavs();
            setShowDeleteModal(false);
            setMovieToDelete(null);
        }
    };

    return (
        <div className="bg-phim-dark min-h-screen text-white font-sans pb-20 selection:bg-red-600 selection:text-white">
            <Helmet>
                <title>Tủ Phim Của Tôi | PhimVietHay</title>
            </Helmet>

            <div className="pt-28 px-4 md:px-12 container mx-auto">
                {/* Header */}
                <div className="mb-10 border-b border-white/10 pb-6 flex items-end justify-between">
                    <h1 className="text-2xl md:text-3xl font-bold uppercase tracking-wide flex items-center gap-3">
                        <span className="text-red-600 border-l-4 border-red-600 pl-3">Tủ Phim Của Tôi</span>
                    </h1>
                    <span className="text-gray-400 font-bold bg-white/5 px-3 py-1 rounded-lg border border-white/5">
                        {favorites.length} phim
                    </span>
                </div>

                {/* Content */}
                {loading ? (
                    <div className="flex justify-center py-40">
                        <div className="animate-spin rounded-full h-12 w-12 border-t-2 border-b-2 border-red-600"></div>
                    </div>
                ) : favorites.length > 0 ? (
                    <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 xl:grid-cols-6 gap-4 gap-y-8">
                        {favorites.map((movie) => (
                            <div key={movie._id} className="relative group">
                                <MovieCard movie={movie} />
                                <div onClick={(e) => { e.stopPropagation(); requestDelete(movie); }} className="absolute top-2 left-2 z-20 opacity-0 group-hover:opacity-100 transition-opacity duration-200 cursor-pointer" title="Xóa khỏi tủ">
                                    <div className="bg-black/80 text-white hover:text-red-500 p-2 rounded-md backdrop-blur-md border border-white/10 shadow-xl transform hover:scale-110 transition"><FaTrashAlt size={12} /></div>
                                </div>
                            </div>
                        ))}
                    </div>
                ) : (
                    <div className="flex flex-col items-center justify-center py-32 text-gray-500 border-2 border-dashed border-gray-800 rounded-2xl bg-white/5">
                        <FaHeart className="text-6xl mb-4 text-gray-700 animate-pulse"/>
                        <p className="text-xl font-bold text-gray-400">Tủ phim trống trơn</p>
                        <p className="text-sm text-gray-600 mt-2 mb-6">Lưu lại những bộ phim hay để xem sau nhé!</p>
                        <button onClick={() => navigate('/')} className="bg-red-600 px-8 py-3 rounded-full font-bold hover:bg-red-700 transition text-white shadow-lg shadow-red-900/20">
                            Khám phá ngay
                        </button>
                    </div>
                )}
            </div>

            <DeleteModal 
                isOpen={showDeleteModal} 
                movieName={movieToDelete?.name} 
                onClose={() => setShowDeleteModal(false)} 
                onConfirm={confirmDelete} 
            />
        </div>
    );
};

export default Favorites;