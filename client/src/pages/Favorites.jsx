import React, { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Helmet } from 'react-helmet-async';
import { 
    FaHeart, FaTimes, FaCheckCircle, FaExclamationCircle, 
    FaPlus, FaEdit, FaTrash, FaGlobe, FaLock, FaSpinner, 
    FaFolder, FaFilm, FaCheck
} from 'react-icons/fa';

import MovieCard from '../components/movies/MovieCard';
import { getFavorites, getCurrentUser, toggleFavorite } from '../services/authService';
import { 
    getPlaylists, 
    createPlaylist, 
    updatePlaylist, 
    deletePlaylist, 
    getPlaylistMovies, 
    removeMovieFromPlaylist 
} from '../services/playlistService';

const PLAYLIST_ICONS = ['🎬', '🍿', '🔥', '⭐', '💖', '🌙', '🎌', '💀', '⚔️', '📺', '🚀', '📁'];

// Toast thông báo
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

const Favorites = () => {
    const navigate = useNavigate();

    // Data State
    const [playlists, setPlaylists] = useState([]);
    const [activeTab, setActiveTab] = useState('favorites'); // 'favorites' hoặc playlist.id (số)
    const [movies, setMovies] = useState([]);
    const [loadingMovies, setLoadingMovies] = useState(true);
    const [loadingPlaylists, setLoadingPlaylists] = useState(true);

    // Modal tạo / sửa playlist
    const [showModal, setShowModal] = useState(false);
    const [isEditing, setIsEditing] = useState(false);
    const [modalData, setModalData] = useState({ id: null, title: '', description: '', is_public: true, icon: '🎬' });
    const [modalSubmitting, setModalSubmitting] = useState(false);

    // Toast
    const [toast, setToast] = useState(null);

    // 1. Tải danh sách playlist của người dùng
    const loadPlaylists = async () => {
        setLoadingPlaylists(true);
        try {
            const data = await getPlaylists();
            setPlaylists(data || []);
        } catch (e) {
            console.error(e);
        } finally {
            setLoadingPlaylists(false);
        }
    };

    // 2. Tải phim tương ứng với Tab hiện tại
    const loadCurrentMovies = async (tab) => {
        setLoadingMovies(true);
        try {
            if (tab === 'favorites') {
                const data = await getFavorites();
                const mappedData = (data || []).map(item => ({
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
                setMovies(mappedData);
            } else {
                const res = await getPlaylistMovies(tab);
                const mappedData = (res?.movies || []).map(item => ({
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
                setMovies(mappedData);
            }
        } catch (e) {
            console.error(e);
            setMovies([]);
        } finally {
            setLoadingMovies(false);
        }
    };

    useEffect(() => {
        if (!getCurrentUser()) {
            navigate('/login');
            return;
        }
        loadPlaylists();
    }, [navigate]);

    useEffect(() => {
        loadCurrentMovies(activeTab);
    }, [activeTab]);

    // 3. Xử lý gỡ phim
    const handleRemoveMovie = async (movie) => {
        const prev = movies;
        setMovies(prev.filter(m => m.slug !== movie.slug));

        try {
            if (activeTab === 'favorites') {
                await toggleFavorite({ slug: movie.slug });
                setToast({ type: 'success', message: `Đã gỡ "${movie.name}" khỏi danh sách Yêu thích.` });
            } else {
                await removeMovieFromPlaylist(activeTab, movie.slug);
                setPlaylists(prevList => prevList.map(p => 
                    p.id === activeTab ? { ...p, movie_count: Math.max(0, (p.movie_count || 1) - 1) } : p
                ));
                setToast({ type: 'success', message: `Đã gỡ "${movie.name}" khỏi danh sách.` });
            }
        } catch (e) {
            setMovies(prev);
            setToast({ type: 'error', message: 'Không thể gỡ phim, vui lòng thử lại.' });
        }
    };

    // 4. Mở modal tạo mới
    const handleOpenCreateModal = () => {
        setIsEditing(false);
        setModalData({ id: null, title: '', description: '', is_public: true, icon: '🎬' });
        setShowModal(true);
    };

    // 5. Mở modal sửa playlist
    const handleOpenEditModal = (pl) => {
        setIsEditing(true);
        setModalData({
            id: pl.id,
            title: pl.title,
            description: pl.description || '',
            is_public: Boolean(pl.is_public),
            icon: pl.icon || '🎬'
        });
        setShowModal(true);
    };

    // 6. Xử lý lưu modal (Tạo mới hoặc Cập nhật)
    const handleSavePlaylistModal = async (e) => {
        e.preventDefault();
        if (!modalData.title.trim()) {
            setToast({ type: 'error', message: 'Tên danh sách không được để trống' });
            return;
        }

        setModalSubmitting(true);
        try {
            if (isEditing) {
                const res = await updatePlaylist(modalData.id, {
                    title: modalData.title.trim(),
                    description: modalData.description.trim(),
                    is_public: modalData.is_public ? 1 : 0,
                    icon: modalData.icon || '🎬'
                });
                setPlaylists(prev => prev.map(p => p.id === modalData.id ? { ...p, ...res.playlist } : p));
                setToast({ type: 'success', message: 'Cập nhật danh sách thành công!' });
            } else {
                const res = await createPlaylist({
                    title: modalData.title.trim(),
                    description: modalData.description.trim(),
                    is_public: modalData.is_public ? 1 : 0,
                    icon: modalData.icon || '🎬'
                });
                setPlaylists(prev => [res.playlist, ...prev]);
                setActiveTab(res.playlist.id);
                setToast({ type: 'success', message: 'Đã tạo danh sách mới!' });
            }
            setShowModal(false);
        } catch (err) {
            setToast({ type: 'error', message: typeof err === 'string' ? err : 'Có lỗi xảy ra' });
        } finally {
            setModalSubmitting(false);
        }
    };

    // 7. Xóa playlist
    const handleDeletePlaylist = async (pl) => {
        if (!window.confirm(`Bạn có chắc chắn muốn xóa danh sách "${pl.title}" không? (Phim gốc sẽ không bị xóa)`)) {
            return;
        }

        try {
            await deletePlaylist(pl.id);
            setPlaylists(prev => prev.filter(p => p.id !== pl.id));
            if (activeTab === pl.id) {
                setActiveTab('favorites');
            }
            setToast({ type: 'success', message: `Đã xóa danh sách "${pl.title}".` });
        } catch (err) {
            setToast({ type: 'error', message: 'Lỗi khi xóa danh sách' });
        }
    };

    const currentPlaylist = playlists.find(p => p.id === activeTab);

    return (
        <div className="bg-phim-dark min-h-screen text-white font-sans pb-24 selection:bg-[var(--accent)] selection:text-white">
            <Helmet>
                <title>Tủ Phim & Bộ Sưu Tập | PhimVietHay</title>
            </Helmet>
            {toast && <Toast type={toast.type} message={toast.message} onClose={() => setToast(null)} />}

            <div className="pt-28 px-4 md:px-12 container mx-auto">
                {/* Header trang */}
                <div className="mb-8 border-b border-white/10 pb-6 flex flex-col sm:flex-row sm:items-end justify-between gap-4">
                    <div>
                        <h1 className="text-2xl md:text-3xl font-black uppercase tracking-wide flex items-center gap-3">
                            <span className="text-[var(--accent)] border-l-4 border-[var(--accent)] pl-3">Tủ Phim Của Tôi</span>
                        </h1>
                        <p className="text-xs text-gray-400 mt-1 pl-3.5">Quản lý danh sách yêu thích và các bộ sưu tập phim cá nhân.</p>
                    </div>

                    <button
                        type="button"
                        onClick={handleOpenCreateModal}
                        className="self-start sm:self-auto py-2.5 px-4 rounded-xl font-bold text-xs bg-[var(--accent)] hover:opacity-90 text-white shadow-lg shadow-black/40 transition flex items-center gap-2 active:scale-95"
                    >
                        <FaPlus className="text-xs" /> Tạo Danh Sách Mới
                    </button>
                </div>

                {/* Danh sách Tab Pills (Tương tự YouTube Playlists) */}
                <div className="flex items-center gap-2 overflow-x-auto pb-4 custom-scrollbar mb-8 select-none">
                    {/* Tab 1: Yêu Thích Mặc Định */}
                    <button
                        type="button"
                        onClick={() => setActiveTab('favorites')}
                        className={`flex items-center gap-2.5 px-4 py-2.5 rounded-full font-bold text-xs whitespace-nowrap transition border shrink-0 ${activeTab === 'favorites' ? 'bg-red-600 text-white border-red-500 shadow-lg shadow-red-900/40' : 'bg-white/5 border-white/10 text-gray-300 hover:bg-white/10 hover:text-white'}`}
                    >
                        <FaHeart className="text-xs text-white" />
                        <span>Phim Yêu Thích</span>
                        {activeTab === 'favorites' && <span className="ml-1 opacity-90">({movies.length})</span>}
                    </button>

                    {/* Các Tab Playlist do User tạo */}
                    {playlists.map((pl) => {
                        const isActive = activeTab === pl.id;
                        return (
                            <button
                                key={pl.id}
                                type="button"
                                onClick={() => setActiveTab(pl.id)}
                                className={`flex items-center gap-2 px-4 py-2.5 rounded-full font-bold text-xs whitespace-nowrap transition border shrink-0 ${isActive ? 'bg-white text-black border-white shadow-lg' : 'bg-white/5 border-white/10 text-gray-300 hover:bg-white/10 hover:text-white'}`}
                            >
                                <span className="text-sm shrink-0">{pl.icon || '🎬'}</span>
                                <span>{pl.title}</span>
                                <span className={`text-[10px] px-1.5 py-0.2 rounded-full font-mono ${isActive ? 'bg-black/20 text-black' : 'bg-white/10 text-gray-400'}`}>
                                    {pl.movie_count || 0}
                                </span>
                                {pl.is_public ? (
                                    <FaGlobe className={`text-[10px] ${isActive ? 'text-emerald-700' : 'text-emerald-400'}`} title="Công khai" />
                                ) : (
                                    <FaLock className={`text-[10px] ${isActive ? 'text-gray-700' : 'text-gray-500'}`} title="Riêng tư" />
                                )}
                            </button>
                        );
                    })}
                </div>

                {/* Thông tin Playlist đang chọn */}
                <div className="mb-6 flex flex-col sm:flex-row sm:items-center justify-between gap-4 p-4 rounded-2xl bg-white/5 border border-white/10">
                    <div>
                        <div className="flex items-center gap-2.5">
                            {activeTab !== 'favorites' && <span className="text-xl">{currentPlaylist?.icon || '🎬'}</span>}
                            <h2 className="text-lg font-black text-white">
                                {activeTab === 'favorites' ? 'Danh Sách Phim Yêu Thích' : currentPlaylist?.title}
                            </h2>
                            {activeTab !== 'favorites' && (
                                <span className={`text-[10px] font-bold px-2 py-0.5 rounded-full flex items-center gap-1 border ${currentPlaylist?.is_public ? 'bg-emerald-950/80 text-emerald-400 border-emerald-500/30' : 'bg-gray-800 text-gray-400 border-white/10'}`}>
                                    {currentPlaylist?.is_public ? <><FaGlobe size={9} /> Công khai</> : <><FaLock size={9} /> Riêng tư</>}
                                </span>
                            )}
                        </div>
                        <p className="text-xs text-gray-400 mt-1">
                            {activeTab === 'favorites' 
                                ? 'Danh sách phim yêu thích mặc định của bạn' 
                                : (currentPlaylist?.description || 'Chưa có mô tả cho danh sách này')}
                        </p>
                    </div>

                    {activeTab !== 'favorites' && currentPlaylist && (
                        <div className="flex items-center gap-2 shrink-0">
                            <button
                                type="button"
                                onClick={() => handleOpenEditModal(currentPlaylist)}
                                className="py-2 px-3 rounded-xl bg-white/10 hover:bg-white/20 text-gray-200 border border-white/10 text-xs font-bold transition flex items-center gap-1.5"
                            >
                                <FaEdit size={12} /> Chỉnh sửa
                            </button>
                            <button
                                type="button"
                                onClick={() => handleDeletePlaylist(currentPlaylist)}
                                className="py-2 px-3 rounded-xl bg-red-600/20 hover:bg-red-600 border border-red-600/40 text-red-400 hover:text-white text-xs font-bold transition flex items-center gap-1.5"
                            >
                                <FaTrash size={12} /> Xóa
                            </button>
                        </div>
                    )}
                </div>

                {/* Grid Phim */}
                {loadingMovies ? (
                    <div className="flex justify-center py-32">
                        <div className="animate-spin rounded-full h-10 w-10 border-t-2 border-b-2 border-[var(--accent)]"></div>
                    </div>
                ) : movies.length > 0 ? (
                    <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 xl:grid-cols-6 gap-4 gap-y-8">
                        {movies.map((movie) => (
                            <div key={movie._id || movie.slug} className="relative group">
                                <MovieCard movie={movie} />
                                <button
                                    type="button"
                                    aria-label={`Gỡ ${movie.name} khỏi danh sách`}
                                    title="Gỡ khỏi danh sách này"
                                    onClick={(e) => { e.stopPropagation(); e.preventDefault(); handleRemoveMovie(movie); }}
                                    className="absolute top-2 right-2 z-[10000] w-8 h-8 flex items-center justify-center rounded-full bg-red-600 text-white shadow-lg shadow-black/50 ring-1 ring-white/30 hover:bg-red-500 hover:scale-110 active:scale-95 transition cursor-pointer"
                                >
                                    <FaTimes size={14} />
                                </button>
                            </div>
                        ))}
                    </div>
                ) : (
                    <div className="flex flex-col items-center justify-center py-28 text-gray-500 border-2 border-dashed border-white/10 rounded-2xl bg-white/5">
                        <FaFilm className="text-5xl mb-4 text-gray-600 opacity-60"/>
                        <p className="text-lg font-bold text-gray-300">Danh sách này đang trống</p>
                        <p className="text-xs text-gray-500 mt-1 mb-6">Bạn có thể thêm phim vào đây khi đang xem phim hoặc ở trang chi tiết phim.</p>
                        <button 
                            onClick={() => navigate('/')} 
                            className="bg-[var(--accent)] px-7 py-2.5 rounded-full font-bold text-xs hover:opacity-90 transition text-white shadow-lg shadow-red-900/30"
                        >
                            Khám phá phim hay ngay
                        </button>
                    </div>
                )}
            </div>

            {/* Modal Tạo / Sửa Playlist */}
            {showModal && (
                <div className="fixed inset-0 z-[200] flex items-center justify-center p-4 bg-black/80 backdrop-blur-md animate-fade-in">
                    <div className="bg-[#0f172a] w-full max-w-md rounded-2xl border border-white/15 shadow-2xl overflow-hidden flex flex-col relative text-white">
                        <div className="flex items-center justify-between px-6 py-4 border-b border-white/10">
                            <h3 className="font-black text-sm tracking-wide">
                                {isEditing ? 'Chỉnh Sửa Danh Sách' : 'Tạo Danh Sách Mới'}
                            </h3>
                            <button 
                                onClick={() => setShowModal(false)}
                                className="text-gray-400 hover:text-white p-1 rounded-full hover:bg-white/10 transition"
                            >
                                <FaTimes size={16} />
                            </button>
                        </div>

                        <form onSubmit={handleSavePlaylistModal} className="p-6 space-y-4">
                            <div>
                                <label className="block text-xs font-bold text-gray-400 uppercase tracking-wider mb-2">Tên danh sách</label>
                                <input 
                                    type="text"
                                    placeholder="VD: Phim cày đêm, Top Anime đỉnh..."
                                    value={modalData.title}
                                    onChange={(e) => setModalData({ ...modalData, title: e.target.value })}
                                    autoFocus
                                    className="w-full bg-white/5 border border-white/10 rounded-xl py-3 px-4 text-sm text-white focus:border-[var(--accent)] outline-none transition"
                                />
                            </div>

                            <div>
                                <label className="block text-xs font-bold text-gray-400 uppercase tracking-wider mb-2">Biểu tượng danh sách</label>
                                <div className="grid grid-cols-6 sm:grid-cols-12 gap-1.5 p-2 bg-white/5 rounded-xl border border-white/10">
                                    {PLAYLIST_ICONS.map(ic => (
                                        <button
                                            key={ic}
                                            type="button"
                                            onClick={() => setModalData({ ...modalData, icon: ic })}
                                            className={`h-9 rounded-lg flex items-center justify-center text-lg transition ${modalData.icon === ic ? 'bg-[var(--accent)] scale-110 shadow-lg text-white' : 'hover:bg-white/10'}`}
                                        >
                                            {ic}
                                        </button>
                                    ))}
                                </div>
                            </div>

                            <div>
                                <label className="block text-xs font-bold text-gray-400 uppercase tracking-wider mb-2">Mô tả (tùy chọn)</label>
                                <textarea 
                                    placeholder="Thêm mô tả cho bộ sưu tập này..."
                                    rows={3}
                                    value={modalData.description}
                                    onChange={(e) => setModalData({ ...modalData, description: e.target.value })}
                                    className="w-full bg-white/5 border border-white/10 rounded-xl py-3 px-4 text-sm text-white focus:border-[var(--accent)] outline-none transition resize-none"
                                />
                            </div>

                            {/* Quyền riêng tư */}
                            <div className="pt-2 border-t border-white/10">
                                <label className="block text-xs font-bold text-gray-400 uppercase tracking-wider mb-2">Quyền riêng tư</label>
                                <div className="grid grid-cols-2 gap-3">
                                    <button
                                        type="button"
                                        onClick={() => setModalData({ ...modalData, is_public: true })}
                                        className={`p-3 rounded-xl border text-left transition flex items-center gap-2.5 ${modalData.is_public ? 'bg-white/10 border-white text-white shadow' : 'bg-white/5 border-white/10 text-gray-400 hover:bg-white/10'}`}
                                    >
                                        <FaGlobe className={modalData.is_public ? 'text-emerald-400' : 'text-gray-500'} />
                                        <div>
                                            <p className="font-bold text-xs text-white">Công khai</p>
                                            <p className="text-[10px] text-gray-400">Hiện trên profile</p>
                                        </div>
                                    </button>

                                    <button
                                        type="button"
                                        onClick={() => setModalData({ ...modalData, is_public: false })}
                                        className={`p-3 rounded-xl border text-left transition flex items-center gap-2.5 ${!modalData.is_public ? 'bg-white/10 border-white text-white shadow' : 'bg-white/5 border-white/10 text-gray-400 hover:bg-white/10'}`}
                                    >
                                        <FaLock className={!modalData.is_public ? 'text-amber-400' : 'text-gray-500'} />
                                        <div>
                                            <p className="font-bold text-xs text-white">Riêng tư</p>
                                            <p className="text-[10px] text-gray-400">Chỉ mình bạn xem</p>
                                        </div>
                                    </button>
                                </div>
                            </div>

                            <div className="flex gap-3 pt-3">
                                <button
                                    type="button"
                                    onClick={() => setShowModal(false)}
                                    className="flex-1 py-3 px-4 rounded-xl bg-white/10 hover:bg-white/20 font-bold text-xs text-gray-300 transition"
                                >
                                    Hủy
                                </button>
                                <button
                                    type="submit"
                                    disabled={modalSubmitting}
                                    className="flex-1 py-3 px-4 rounded-xl bg-[var(--accent)] hover:opacity-90 font-bold text-xs text-white transition flex items-center justify-center gap-2 disabled:opacity-50 shadow-lg"
                                >
                                    {modalSubmitting ? <FaSpinner className="animate-spin text-sm" /> : <><FaCheck /> Lưu Danh Sách</>}
                                </button>
                            </div>
                        </form>
                    </div>
                </div>
            )}
        </div>
    );
};

export default Favorites;
