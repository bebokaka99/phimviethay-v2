import React, { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Helmet } from 'react-helmet-async';
import { FaHistory, FaTrashAlt, FaEye, FaExclamationTriangle } from 'react-icons/fa';

import Header from '../components/layout/Header';
import MovieCard from '../components/movies/MovieCard';
import { getWatchHistory, getCurrentUser, clearWatchHistory, removeWatchHistoryItem } from '../services/authService';

// --- HELPER FUNCTIONS ---
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
    if (seconds > 21000 && seconds < 29000) seconds -= 25200; // Fix múi giờ

    if (seconds < 60) return 'Vừa xong';
    const minutes = Math.floor(seconds / 60);
    if (minutes < 60) return `${minutes} phút trước`;
    const hours = Math.floor(minutes / 60);
    if (hours < 24) return `${hours} giờ trước`;
    const days = Math.floor(hours / 24);
    if (days < 7) return `${days} ngày trước`;
    return `${Math.floor(days / 365)} năm trước`;
};

// --- SUB-COMPONENT: MODAL XÁC NHẬN ---
const ConfirmationModal = ({ isOpen, title, message, onClose, onConfirm }) => {
    if (!isOpen) return null;
    return (
        <div className="fixed inset-0 z-[200] flex items-center justify-center p-4 bg-black/90 backdrop-blur-sm animate-fade-in">
            <div className="bg-[#1a1a1a] border border-white/10 p-6 rounded-2xl shadow-2xl w-full max-w-sm text-center transform scale-100 transition-all">
                <div className="w-16 h-16 bg-red-900/30 rounded-full flex items-center justify-center mx-auto mb-4">
                    <FaExclamationTriangle className="text-3xl text-red-500" />
                </div>
                <h3 className="text-xl font-bold text-white mb-2">{title}</h3>
                <p className="text-gray-400 text-sm mb-6 leading-relaxed">{message}</p>
                <div className="flex gap-3">
                    <button onClick={onClose} className="flex-1 py-3 rounded-xl font-bold text-gray-400 bg-[#222] hover:bg-[#333] transition border border-white/5">
                        Hủy bỏ
                    </button>
                    <button onClick={onConfirm} className="flex-1 py-3 rounded-xl font-bold text-white bg-red-600 hover:bg-red-700 transition shadow-lg shadow-red-900/20">
                        Xác nhận
                    </button>
                </div>
            </div>
        </div>
    );
};

// --- D1 (23/11/2026): Lịch sử dùng chung MovieCard như trang chủ — card tự
// viết HistoryItem cũ đã gỡ (khác bo góc, không có hover popup, không có
// badge điểm/năm). Chỉ giữ lại những gì riêng của lịch sử, phủ lên trên
// card chung: badge "đang xem tập", nút xóa từng phim, thanh tiến trình
// (visual như cũ), dòng "xem cách đây..." bên dưới card.
// - Bấm vào card vẫn xem tiếp đúng tập đã dừng (onClickCapture chặn link
//   /phim/:slug mặc định của MovieCard, chỉ với click chuột trái thường;
//   Ctrl/Cmd+click vẫn mở tab mới như cũ). Nút Xem/Chi Tiết trong popup
//   hover là portal ngoài wrapper nên không bị chặn.
// - Lịch sử KHÔNG lưu năm phát hành nên MovieCard hiện badge "Unknown"
//   (xem ghi chú ở map bên dưới) — cần nhóm sở hữu MovieCard ẩn badge
//   năm khi không có dữ liệu, hoặc BE lưu thêm movie_year vào history.
const HistoryItem = ({ item, onDelete, onResume }) => {
    // Shape MovieCard cần; episode_current KHÔNG truyền để tránh trùng với
    // badge "Bạn đang xem tập" phủ phía trên (cùng 1 thông tin).
    const movie = {
        _id: item.movie_slug,
        slug: item.movie_slug,
        name: item.movie_name,
        origin_name: '',
        thumb_url: item.movie_thumb,
        quality: 'HD',
        year: undefined,
        vote_average: 0,
    };
    return (
        <div
            className="relative group"
            onClickCapture={(e) => {
                // Bỏ qua click từ nút xóa; chỉ chặn click chuột trái thường.
                if (e.target.closest('[data-history-delete]')) return;
                if (e.button !== 0 || e.metaKey || e.ctrlKey || e.shiftKey || e.altKey) return;
                e.preventDefault();
                onResume(item);
            }}
        >
            <MovieCard movie={movie} />
            {/* Lớp phủ đúng vùng poster (aspect 2/3 như poster MovieCard),
                pointer-events-none để không chặn hover/click của card. */}
            <div className="absolute inset-x-0 top-0 aspect-[2/3] pointer-events-none">
                {/* Badge Tập Đang Xem */}
                <div className="absolute top-2 right-2 bg-red-600/90 text-white text-[9px] font-bold px-2 py-1 rounded shadow-md flex items-center gap-1 w-fit z-10">
                    <FaEye /> Bạn đang xem tập: {item.episode_name || '...'}
                </div>

                {/* Nút Xóa Từng Phim */}
                <button
                    data-history-delete
                    onClick={(e) => { e.stopPropagation(); onDelete(item); }}
                    className="absolute top-2 left-2 bg-black/60 text-gray-400 hover:text-red-500 hover:bg-black p-2 rounded-md backdrop-blur-sm z-20 opacity-0 group-hover:opacity-100 transition-all duration-300 border border-white/10 pointer-events-auto"
                    title="Xóa khỏi lịch sử"
                >
                    <FaTrashAlt size={12} />
                </button>

                {/* Progress Bar (Visual, như cũ) */}
                <div className="absolute bottom-0 left-0 w-full h-1 bg-gray-700">
                    <div className="h-full bg-[var(--accent)] w-3/4 shadow-[0_0_10px_rgba(var(--accent-rgb),0.8)]"></div>
                </div>
            </div>

            {/* Dòng thời gian xem — giữ nguyên thông tin cũ */}
            <div className="px-1 mt-1">
                <span className="text-xs text-green-400 font-bold flex items-center gap-1.5">
                    <div className="w-1.5 h-1.5 bg-green-500 rounded-full animate-pulse"></div>
                    {timeAgo(item.updated_at)}
                </span>
            </div>
        </div>
    );
};

// --- MAIN COMPONENT ---
const History = () => {
    const navigate = useNavigate();
    
    // Data State
    const [history, setHistory] = useState([]);
    const [loading, setLoading] = useState(true);

    // Modal State
    const [showModal, setShowModal] = useState(false);
    const [actionType, setActionType] = useState(null); // 'SINGLE' | 'ALL'
    const [selectedItem, setSelectedItem] = useState(null);

    useEffect(() => {
        if (!getCurrentUser()) {
            navigate('/login');
            return;
        }
        fetchHistory();
    }, [navigate]);

    const fetchHistory = async () => {
        const data = await getWatchHistory();
        setHistory(data || []);
        setLoading(false);
    };

    // Logic Mở Modal
    const requestClearAll = () => {
        setActionType('ALL');
        setShowModal(true);
    };

    const requestDeleteOne = (item) => {
        setSelectedItem(item);
        setActionType('SINGLE');
        setShowModal(true);
    };

    // Logic Thực Thi Xóa
    const handleConfirmDelete = async () => {
        setLoading(true);
        try {
            if (actionType === 'ALL') {
                await clearWatchHistory();
                setHistory([]);
            } else if (actionType === 'SINGLE' && selectedItem) {
                await removeWatchHistoryItem(selectedItem.movie_slug);
                // Update local state để UI phản hồi ngay lập tức
                setHistory(prev => prev.filter(h => h.movie_slug !== selectedItem.movie_slug));
            }
        } catch (error) {
            console.error(error);
        } finally {
            setLoading(false);
            setShowModal(false);
            setSelectedItem(null);
        }
    };

    return (
        <div className="min-h-screen text-white font-sans pb-20 selection:bg-[var(--accent)] selection:text-white">
            <Helmet>
                <title>Lịch Sử Xem | PhimVietHay</title>
            </Helmet>
            
            <div className="pt-28 px-4 md:px-12 container mx-auto">
                {/* Header */}
                <div className="mb-10 border-b border-white/10 pb-6 flex items-end justify-between">
                    <h1 className="text-2xl md:text-3xl font-bold uppercase tracking-wide flex items-center gap-3">
                        <span className="text-[var(--accent)] border-l-4 border-[var(--accent)] pl-3">Lịch Sử Xem</span>
                    </h1>
                    {history.length > 0 && (
                        <button 
                            onClick={requestClearAll}
                            className="flex items-center gap-2 bg-white/5 hover:bg-red-900/50 text-gray-400 hover:text-red-500 px-4 py-2 rounded-lg transition border border-white/5 hover:border-red-900/50 text-sm font-bold"
                        >
                            <FaTrashAlt /> Xóa tất cả
                        </button>
                    )}
                </div>

                {/* Content */}
                {loading && !showModal ? (
                    <div className="flex justify-center py-40">
                        <div className="animate-spin rounded-full h-12 w-12 border-t-2 border-b-2 border-[var(--accent)]"></div>
                    </div>
                ) : history.length > 0 ? (
                    <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 xl:grid-cols-6 gap-4 gap-y-8">
                        {history.map((item, idx) => (
                            <HistoryItem
                                key={idx}
                                item={item}
                                onResume={(it) => navigate(`/xem-phim/${it.movie_slug}?tap=${it.episode_slug}`)}
                                onDelete={requestDeleteOne}
                            />
                        ))}
                    </div>
                ) : (
                    <div className="py-20 text-center border-2 border-dashed border-gray-800 rounded-2xl bg-white/5">
                        <FaHistory className="text-6xl mx-auto mb-4 text-gray-700"/>
                        <p className="text-xl font-bold text-gray-400">Lịch sử trống.</p>
                        <button onClick={() => navigate('/')} className="mt-6 bg-[var(--accent)] px-8 py-3 rounded-full font-bold hover:bg-[var(--accent-hover)] transition text-white shadow-lg">
                            Xem phim ngay
                        </button>
                    </div>
                )}
            </div>

            {/* Modal Xác Nhận */}
            <ConfirmationModal 
                isOpen={showModal} 
                title={actionType === 'ALL' ? 'Xóa toàn bộ lịch sử?' : 'Xóa khỏi lịch sử?'}
                message={
                    actionType === 'ALL' 
                        ? 'Bạn có chắc chắn muốn xóa toàn bộ danh sách phim đã xem không? Hành động này không thể hoàn tác.'
                        : <>Bạn muốn xóa phim <span className="text-white font-bold">"{selectedItem?.movie_name}"</span> khỏi lịch sử xem?</>
                }
                onClose={() => setShowModal(false)}
                onConfirm={handleConfirmDelete}
            />
        </div>
    );
};

export default History;