import React, { useState, useEffect } from 'react';
import { 
    FaTimes, FaHeart, FaPlus, FaCheck, FaLock, FaGlobe, 
    FaFolderPlus, FaSpinner 
} from 'react-icons/fa';
import { toggleFavorite } from '../../services/authService';
import { 
    getPlaylists, 
    createPlaylist, 
    addMovieToPlaylist, 
    removeMovieFromPlaylist, 
    checkMovieInPlaylists 
} from '../../services/playlistService';

const PLAYLIST_ICONS = ['🎬', '🍿', '🔥', '⭐', '💖', '🌙', '🎌', '💀', '⚔️', '📺', '🚀', '📁'];

const SaveToPlaylistModal = ({ movie, isOpen, onClose, onStatusChange }) => {
    const [playlists, setPlaylists] = useState([]);
    const [inFavorites, setInFavorites] = useState(false);
    const [checkedPlaylists, setCheckedPlaylists] = useState([]);
    const [loading, setLoading] = useState(true);
    const [actionLoadingId, setActionLoadingId] = useState(null);

    // Form tạo playlist mới
    const [showCreateForm, setShowCreateForm] = useState(false);
    const [newTitle, setNewTitle] = useState('');
    const [newIcon, setNewIcon] = useState('🎬');
    const [isPublic, setIsPublic] = useState(true);
    const [creating, setCreating] = useState(false);
    const [errorMsg, setErrorMsg] = useState('');

    useEffect(() => {
        if (!isOpen || !movie?.slug) return;

        let isMounted = true;
        setLoading(true);
        setShowCreateForm(false);
        setNewTitle('');
        setErrorMsg('');

        Promise.all([
            getPlaylists(),
            checkMovieInPlaylists(movie.slug)
        ]).then(([pls, checkRes]) => {
            if (!isMounted) return;
            setPlaylists(pls || []);
            setInFavorites(Boolean(checkRes?.inFavorites));
            setCheckedPlaylists(checkRes?.inPlaylists || []);
        }).catch(err => {
            console.error('SaveModal init error:', err);
        }).finally(() => {
            if (isMounted) setLoading(false);
        });

        return () => {
            isMounted = false;
        };
    }, [isOpen, movie?.slug]);

    if (!isOpen || !movie) return null;

    // Xử lý toggle yêu thích
    const handleToggleFavorite = async () => {
        setActionLoadingId('fav');
        try {
            const nextFav = await toggleFavorite(movie);
            setInFavorites(nextFav);
            if (onStatusChange) onStatusChange({ isFavorite: nextFav });
        } catch (err) {
            console.error(err);
        } finally {
            setActionLoadingId(null);
        }
    };

    // Xử lý toggle playlist tùy chỉnh
    const handleTogglePlaylist = async (playlist) => {
        const isChecked = checkedPlaylists.includes(playlist.id);
        setActionLoadingId(playlist.id);

        try {
            if (isChecked) {
                await removeMovieFromPlaylist(playlist.id, movie.slug);
                setCheckedPlaylists(prev => prev.filter(id => id !== playlist.id));
                setPlaylists(prev => prev.map(p => p.id === playlist.id ? { ...p, movie_count: Math.max(0, (p.movie_count || 1) - 1) } : p));
            } else {
                await addMovieToPlaylist(playlist.id, movie);
                setCheckedPlaylists(prev => [...prev, playlist.id]);
                setPlaylists(prev => prev.map(p => p.id === playlist.id ? { ...p, movie_count: (p.movie_count || 0) + 1 } : p));
            }
        } catch (err) {
            console.error(err);
        } finally {
            setActionLoadingId(null);
        }
    };

    // Xử lý tạo playlist mới và tự động lưu phim vào đó
    const handleCreatePlaylist = async (e) => {
        e.preventDefault();
        if (!newTitle.trim()) {
            setErrorMsg('Vui lòng nhập tên danh sách');
            return;
        }

        setCreating(true);
        setErrorMsg('');

        try {
            const res = await createPlaylist({
                title: newTitle.trim(),
                icon: newIcon,
                is_public: isPublic ? 1 : 0
            });

            const newPl = res.playlist;
            // Tự động thêm phim vào danh sách vừa tạo
            await addMovieToPlaylist(newPl.id, movie);

            setPlaylists(prev => [{ ...newPl, movie_count: 1 }, ...prev]);
            setCheckedPlaylists(prev => [...prev, newPl.id]);
            setNewTitle('');
            setNewIcon('🎬');
            setShowCreateForm(false);
        } catch (err) {
            setErrorMsg(typeof err === 'string' ? err : 'Lỗi tạo danh sách');
        } finally {
            setCreating(false);
        }
    };

    return (
        <div className="fixed inset-0 z-[99999] flex items-center justify-center p-4 bg-black/80 backdrop-blur-md animate-fade-in">
            <div 
                className="bg-[#0f172a] w-full max-w-sm rounded-2xl border border-white/15 shadow-2xl overflow-hidden flex flex-col relative text-white"
                onClick={(e) => e.stopPropagation()}
            >
                {/* Header */}
                <div className="flex items-center justify-between px-5 py-4 border-b border-white/10">
                    <div>
                        <h3 className="font-black text-sm tracking-wide text-white">Lưu vào Tủ Phim</h3>
                        <p className="text-[11px] text-gray-400 truncate max-w-[240px] font-medium">{movie.name}</p>
                    </div>
                    <button 
                        onClick={onClose}
                        className="text-gray-400 hover:text-white p-1 rounded-full hover:bg-white/10 transition"
                    >
                        <FaTimes size={16} />
                    </button>
                </div>

                {/* Body: Danh sách Checkbox */}
                <div className="p-4 max-h-72 overflow-y-auto custom-scrollbar space-y-1.5">
                    {loading ? (
                        <div className="py-8 flex flex-col items-center justify-center text-gray-400 gap-2">
                            <FaSpinner className="animate-spin text-xl text-red-500" />
                            <span className="text-xs">Đang tải danh sách...</span>
                        </div>
                    ) : (
                        <>
                            {/* 1. Mục Yêu thích mặc định */}
                            <label 
                                onClick={handleToggleFavorite}
                                className={`flex items-center justify-between p-3 rounded-xl border cursor-pointer transition select-none ${inFavorites ? 'bg-red-950/40 border-red-500/50 text-white' : 'bg-white/5 border-white/10 text-gray-300 hover:bg-white/10'}`}
                            >
                                <div className="flex items-center gap-3">
                                    <span className={`w-7 h-7 rounded-lg flex items-center justify-center text-sm ${inFavorites ? 'bg-red-600 text-white shadow-lg' : 'bg-white/10 text-gray-400'}`}>
                                        <FaHeart className={inFavorites ? 'text-white' : 'text-gray-400'} />
                                    </span>
                                    <div>
                                        <p className="text-xs font-bold text-white">Phim Yêu Thích</p>
                                        <p className="text-[10px] text-gray-400">Danh sách mặc định</p>
                                    </div>
                                </div>
                                <div className="flex items-center gap-2">
                                    {actionLoadingId === 'fav' ? (
                                        <FaSpinner className="animate-spin text-xs text-red-400" />
                                    ) : (
                                        <div className={`w-5 h-5 rounded-md flex items-center justify-center border transition ${inFavorites ? 'bg-red-600 border-red-500 text-white' : 'border-white/30 bg-black/40'}`}>
                                            {inFavorites && <FaCheck size={10} />}
                                        </div>
                                    )}
                                </div>
                            </label>

                            {/* 2. Các playlist do người dùng tạo */}
                            {playlists.map((pl) => {
                                const isChecked = checkedPlaylists.includes(pl.id);
                                const isBusy = actionLoadingId === pl.id;

                                return (
                                    <label 
                                        key={pl.id}
                                        onClick={() => handleTogglePlaylist(pl)}
                                        className={`flex items-center justify-between p-3 rounded-xl border cursor-pointer transition select-none ${isChecked ? 'bg-white/10 border-white/40 text-white' : 'bg-white/5 border-white/10 text-gray-300 hover:bg-white/10'}`}
                                    >
                                        <div className="flex items-center gap-3 min-w-0 flex-1 mr-2">
                                            <span className="w-7 h-7 rounded-lg bg-white/10 flex items-center justify-center text-sm shrink-0">
                                                {pl.icon || '🎬'}
                                            </span>
                                            <div className="min-w-0 flex-1">
                                                <div className="flex items-center gap-1.5">
                                                    <p className="text-xs font-bold text-white truncate">{pl.title}</p>
                                                    {pl.is_public ? (
                                                        <FaGlobe className="text-[9px] text-emerald-400 shrink-0" title="Công khai" />
                                                    ) : (
                                                        <FaLock className="text-[9px] text-gray-400 shrink-0" title="Riêng tư" />
                                                    )}
                                                </div>
                                                <p className="text-[10px] text-gray-400">{pl.movie_count || 0} phim</p>
                                            </div>
                                        </div>
                                        <div className="flex items-center gap-2">
                                            {isBusy ? (
                                                <FaSpinner className="animate-spin text-xs text-white" />
                                            ) : (
                                                <div className={`w-5 h-5 rounded-md flex items-center justify-center border transition ${isChecked ? 'bg-white text-black border-white' : 'border-white/30 bg-black/40'}`}>
                                                    {isChecked && <FaCheck size={10} />}
                                                </div>
                                            )}
                                        </div>
                                    </label>
                                );
                            })}
                        </>
                    )}
                </div>

                {/* Footer: Nút tạo playlist mới */}
                <div className="p-4 border-t border-white/10 bg-black/30">
                    {!showCreateForm ? (
                        <button
                            type="button"
                            onClick={() => setShowCreateForm(true)}
                            className="w-full py-2.5 px-3 rounded-xl border border-dashed border-white/20 hover:border-white/40 bg-white/5 hover:bg-white/10 text-xs font-bold text-gray-200 transition flex items-center justify-center gap-2"
                        >
                            <FaPlus className="text-[10px]" /> Tạo danh sách mới
                        </button>
                    ) : (
                        <form onSubmit={handleCreatePlaylist} className="space-y-3 animate-fade-in">
                            <input 
                                type="text"
                                placeholder="Nhập tên danh sách..."
                                value={newTitle}
                                onChange={(e) => setNewTitle(e.target.value)}
                                autoFocus
                                className="w-full bg-black/50 border border-white/20 rounded-xl px-3 py-2 text-xs text-white focus:border-red-500 outline-none"
                            />

                            <div>
                                <label className="block text-[10px] text-gray-400 font-bold mb-1.5">Chọn biểu tượng:</label>
                                <div className="grid grid-cols-6 gap-1 bg-black/40 p-2 rounded-xl border border-white/10">
                                    {PLAYLIST_ICONS.map(ic => (
                                        <button
                                            key={ic}
                                            type="button"
                                            onClick={() => setNewIcon(ic)}
                                            className={`h-7 rounded-lg flex items-center justify-center text-sm transition ${newIcon === ic ? 'bg-red-600/80 scale-110 shadow' : 'hover:bg-white/10'}`}
                                        >
                                            {ic}
                                        </button>
                                    ))}
                                </div>
                            </div>
                            
                            <div className="flex items-center justify-between text-xs text-gray-400 px-1">
                                <span>Quyền riêng tư:</span>
                                <button
                                    type="button"
                                    onClick={() => setIsPublic(!isPublic)}
                                    className="flex items-center gap-1.5 text-xs font-bold px-2.5 py-1 rounded-lg bg-white/10 hover:bg-white/15 text-white transition"
                                >
                                    {isPublic ? <><FaGlobe className="text-emerald-400 text-[10px]" /> Công khai</> : <><FaLock className="text-gray-400 text-[10px]" /> Riêng tư</>}
                                </button>
                            </div>

                            {errorMsg && <p className="text-[10px] text-red-400 font-bold">{errorMsg}</p>}

                            <div className="flex gap-2 pt-1">
                                <button
                                    type="button"
                                    onClick={() => setShowCreateForm(false)}
                                    className="flex-1 py-2 px-3 rounded-xl bg-white/10 hover:bg-white/15 text-xs font-bold text-gray-300 transition"
                                >
                                    Hủy
                                </button>
                                <button
                                    type="submit"
                                    disabled={creating}
                                    className="flex-1 py-2 px-3 rounded-xl bg-red-600 hover:bg-red-700 text-xs font-bold text-white transition flex items-center justify-center gap-1.5 disabled:opacity-50"
                                >
                                    {creating ? <FaSpinner className="animate-spin text-xs" /> : 'Tạo & Lưu'}
                                </button>
                            </div>
                        </form>
                    )}
                </div>
            </div>
        </div>
    );
};

export default SaveToPlaylistModal;
