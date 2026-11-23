import React, { useEffect, useState, useRef } from 'react';
import axios from 'axios';
import { useNavigate } from 'react-router-dom';
import { Helmet } from 'react-helmet-async';
import { FaUserCircle, FaSave, FaSignOutAlt, FaCamera, FaLock, FaIdCard, FaHeart, FaCloudUploadAlt, FaCheckCircle, FaExclamationCircle, FaImage, FaPen, FaTimes, FaPalette, FaUndo, FaCheck } from 'react-icons/fa';

import MovieCard from '../components/movies/MovieCard';
import UserAvatar from '../components/common/UserAvatar';
import { getFavorites, getCurrentUser, updateProfile, logout, toggleFavorite } from '../services/authService';
import { getRoleLabel } from '../utils/roleLabel';
import { HOME_ROWS } from '../config/menuRows';
import { useTheme } from '../context/ThemeContext';

const CLOUD_NAME = 'dffwgj4x3';
const UPLOAD_PRESET = 'phimviethay_preset';

const PRESET_AVATARS = [
    { name: 'Luffy', url: 'https://api.dicebear.com/9.x/adventurer/svg?seed=Luffy' },
    { name: 'Natra', url: 'https://api.dicebear.com/9.x/micah/svg?seed=Natra' },
    { name: 'Iron Man', url: 'https://api.dicebear.com/9.x/bottts/svg?seed=IronMan' },
    { name: 'Batman', url: 'https://api.dicebear.com/9.x/bottts/svg?seed=Batman' },
    { name: 'Cool Boy', url: 'https://api.dicebear.com/9.x/avataaars/svg?seed=Felix' },
    { name: 'Cool Girl', url: 'https://api.dicebear.com/9.x/avataaars/svg?seed=Aneka' },
    { name: 'Cyberpunk', url: 'https://api.dicebear.com/9.x/identicon/svg?seed=Cyber' },
    { name: 'Cat', url: 'https://api.dicebear.com/9.x/fun-emoji/svg?seed=Cat' },
];

// Component Toast thông báo — tái dùng đúng mẫu Toast có sẵn ở Register.jsx
// (không có thư viện toast ngoài nào trong package.json; Toast là component
// tự viết, dùng chung cho cả lưu phim ở MovieDetail/WatchMovie).
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

// ---- Cá nhân hóa giao diện (Nhóm C) ----
// Dùng đúng hợp đồng ThemeContext của nhóm B: useTheme() -> { theme,
// setTheme, resetTheme, presets }. Mọi thay đổi áp ngay (live preview)
// + tự lưu qua setTheme — KHÔNG có nút "Lưu" riêng (trừ "Dùng màu này"
// của custom accent và "Đặt lại mặc định").
const FALLBACK_PRESETS = [
    { id: 'crimson', name: 'Đỏ Đô', accent: '#dc2626', background: '#0a0e17', surface: '#111827', text: '#ffffff', textMuted: '#9ca3af', border: 'rgba(255,255,255,0.1)' },
    { id: 'ocean', name: 'Đại Dương', accent: '#3b82f6', background: '#081120', surface: '#0f1f38', text: '#ffffff', textMuted: '#9ca3af', border: 'rgba(255,255,255,0.1)' },
    { id: 'violet', name: 'Tím Mộng', accent: '#8b5cf6', background: '#100a1e', surface: '#1d1338', text: '#ffffff', textMuted: '#9ca3af', border: 'rgba(255,255,255,0.1)' },
    { id: 'emerald', name: 'Ngọc Lục', accent: '#10b981', background: '#07130f', surface: '#0d2118', text: '#ffffff', textMuted: '#9ca3af', border: 'rgba(255,255,255,0.1)' },
    { id: 'amber', name: 'Hổ Phách', accent: '#f59e0b', background: '#171006', surface: '#241a08', text: '#ffffff', textMuted: '#9ca3af', border: 'rgba(255,255,255,0.1)' },
    { id: 'rose', name: 'Hồng Đào', accent: '#f43f5e', background: '#180a10', surface: '#26101a', text: '#ffffff', textMuted: '#9ca3af', border: 'rgba(255,255,255,0.1)' },
];

const RADIUS_OPTIONS = [
    { id: 'round', label: 'Tròn nhiều' },
    { id: 'medium', label: 'Vừa' },
    { id: 'square', label: 'Vuông' },
];
const FONT_SIZE_OPTIONS = [
    { id: 'small', label: 'Nhỏ' },
    { id: 'medium', label: 'Vừa' },
    { id: 'large', label: 'Lớn' },
];
const DENSITY_OPTIONS = [
    { id: 'compact', label: 'Gọn' },
    { id: 'comfortable', label: 'Thoải mái' },
];

// Nhóm nút lựa chọn dùng chung (bo góc / cỡ chữ / mật độ).
const OptionGroup = ({ label, options, value, onChange, accent }) => (
    <div>
        <p className="text-xs font-bold text-gray-500 uppercase mb-3">{label}</p>
        <div className="flex flex-wrap gap-2">
            {options.map((opt) => {
                const selected = value === opt.id;
                return (
                    <button
                        key={opt.id}
                        type="button"
                        onClick={() => onChange(opt.id)}
                        aria-pressed={selected}
                        className={`px-4 py-2.5 rounded-xl font-bold text-sm transition border ${selected ? 'text-white shadow-lg' : 'bg-white/5 text-gray-300 border-white/10 hover:bg-white/10 hover:text-white'}`}
                        style={selected ? { backgroundColor: accent, borderColor: accent } : undefined}
                    >
                        {opt.label}
                    </button>
                );
            })}
        </div>
    </div>
);

// Công tắc bật/tắt dùng chung (hiệu ứng).
const ToggleRow = ({ label, desc, checked, onChange, accent }) => (
    <div className="flex items-center justify-between gap-4 py-3">
        <div>
            <p className="font-bold text-sm text-white">{label}</p>
            {desc && <p className="text-xs text-gray-500 mt-0.5">{desc}</p>}
        </div>
        <button
            type="button"
            role="switch"
            aria-checked={checked}
            aria-label={label}
            onClick={() => onChange(!checked)}
            className="relative shrink-0 w-12 h-6 rounded-full transition-colors"
            style={{ backgroundColor: checked ? accent : 'rgba(255,255,255,0.2)' }}
        >
            <span className={`absolute top-0.5 w-5 h-5 rounded-full bg-white shadow transition-all ${checked ? 'left-[26px]' : 'left-0.5'}`} />
        </button>
    </div>
);

// Mục "Giao diện" — render ở cả 2 chỗ: tab trong modal Cài đặt tài khoản
// và section dưới Tủ phim trên trang Hồ sơ (cùng 1 component, cùng state).
const ThemeSettings = ({ theme, setTheme, resetTheme, presets, onReset }) => {
    const list = presets && presets.length > 0 ? presets : FALLBACK_PRESETS;
    const accent = theme?.accent || '#dc2626';
    const hiddenRows = theme?.hiddenRows || [];
    const [customAccent, setCustomAccent] = useState(theme?.accent || '#dc2626');

    // Khi user bấm preset khác ở ngoài (hoặc reset), đồng bộ lại ô chọn màu.
    useEffect(() => { setCustomAccent(theme?.accent || '#dc2626'); }, [theme?.preset]);

    const toggleRow = (slug) => {
        const next = hiddenRows.includes(slug)
            ? hiddenRows.filter((s) => s !== slug)
            : [...hiddenRows, slug];
        setTheme({ hiddenRows: next });
    };

    return (
        <div className="space-y-8 animate-fade-in">
            <div>
                <h2 className="text-2xl font-bold text-white mb-1">Giao diện</h2>
                <p className="text-xs text-gray-500">Mọi thay đổi áp dụng ngay lên toàn trang và tự lưu theo tài khoản của bạn.</p>
            </div>

            {/* (a) 6 preset màu */}
            <div>
                <p className="text-xs font-bold text-gray-500 uppercase mb-3">Bộ màu có sẵn</p>
                <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
                    {list.map((p) => {
                        const selected = theme?.preset === p.id;
                        return (
                            <button
                                key={p.id}
                                type="button"
                                onClick={() => { setTheme({ preset: p.id }); setCustomAccent(p.accent); }}
                                aria-pressed={selected}
                                className={`relative text-left rounded-xl overflow-hidden border-2 transition transform hover:scale-[1.02] ${selected ? 'shadow-lg' : 'border-transparent hover:border-white/30'}`}
                                style={selected ? { borderColor: p.accent, boxShadow: `0 0 20px ${p.accent}55` } : undefined}
                            >
                                <div className="h-12 flex items-end p-2" style={{ backgroundColor: p.background }}>
                                    <div className="w-full h-2 rounded-full" style={{ backgroundColor: p.accent }} />
                                </div>
                                <div className="px-3 py-2 bg-black/40 flex items-center justify-between gap-2">
                                    <span className="text-sm font-bold text-white truncate">{p.name}</span>
                                    {selected && <FaCheck className="shrink-0 text-xs" style={{ color: p.accent }} />}
                                </div>
                            </button>
                        );
                    })}
                </div>
            </div>

            {/* (b) Custom accent */}
            <div>
                <p className="text-xs font-bold text-gray-500 uppercase mb-3">Màu nhấn của riêng bạn</p>
                <div className="flex flex-wrap items-center gap-3">
                    <label className="relative w-12 h-12 rounded-xl overflow-hidden border border-white/20 cursor-pointer shrink-0" title="Chọn màu nhấn">
                        <input
                            type="color"
                            value={customAccent}
                            onChange={(e) => setCustomAccent(e.target.value)}
                            className="absolute inset-0 w-full h-full cursor-pointer"
                            aria-label="Chọn màu nhấn"
                        />
                    </label>
                    <span className="font-mono text-sm font-bold text-white bg-white/5 border border-white/10 rounded-lg px-3 py-2.5 uppercase">{customAccent}</span>
                    <button
                        type="button"
                        onClick={() => setTheme({ preset: 'custom', accent: customAccent })}
                        className="font-bold text-sm text-white px-5 py-2.5 rounded-xl shadow-lg transition hover:brightness-110 active:scale-95"
                        style={{ backgroundColor: customAccent }}
                    >
                        Dùng màu này
                    </button>
                    {theme?.preset === 'custom' && <span className="text-xs font-bold px-2.5 py-1 rounded-full bg-white/10 text-gray-300">Đang dùng màu riêng</span>}
                </div>
            </div>

            {/* (c) Bo góc card */}
            <OptionGroup label="Bo góc card" options={RADIUS_OPTIONS} value={theme?.radius || 'medium'} onChange={(v) => setTheme({ radius: v })} accent={accent} />

            {/* (d) Cỡ chữ */}
            <OptionGroup label="Cỡ chữ" options={FONT_SIZE_OPTIONS} value={theme?.fontSize || 'medium'} onChange={(v) => setTheme({ fontSize: v })} accent={accent} />

            {/* (e) Mật độ hiển thị */}
            <OptionGroup label="Mật độ hiển thị" options={DENSITY_OPTIONS} value={theme?.density || 'comfortable'} onChange={(v) => setTheme({ density: v })} accent={accent} />

            {/* (f) Ẩn/hiện hàng trang chủ */}
            <div>
                <p className="text-xs font-bold text-gray-500 uppercase mb-3">Hàng hiển thị trên trang chủ</p>
                <p className="text-xs text-gray-500 mb-3">Bỏ tick để ẩn một hàng khỏi trang chủ. Hàng đã ẩn vẫn xem được qua menu.</p>
                <div className="space-y-2">
                    {HOME_ROWS.map((row) => {
                        const visible = !hiddenRows.includes(row.slug);
                        return (
                            <label key={row.slug} className="flex items-center gap-3 bg-white/5 border border-white/10 rounded-xl px-4 py-3 cursor-pointer hover:bg-white/10 transition">
                                <input
                                    type="checkbox"
                                    checked={visible}
                                    onChange={() => toggleRow(row.slug)}
                                    className="w-4 h-4 accent-red-600 cursor-pointer"
                                />
                                <span className={`text-sm font-bold ${visible ? 'text-white' : 'text-gray-500 line-through'}`}>{row.title}</span>
                                {!visible && <span className="ml-auto text-[10px] font-bold px-2 py-0.5 rounded-full bg-white/10 text-gray-400">ĐÃ ẨN</span>}
                            </label>
                        );
                    })}
                </div>
            </div>

            {/* (g) Hiệu ứng */}
            <div>
                <p className="text-xs font-bold text-gray-500 uppercase mb-1">Hiệu ứng</p>
                <ToggleRow label="Animation mượt" desc="Hiệu ứng chuyển động khi chuyển slide, hover card" checked={theme?.animations !== false} onChange={(v) => setTheme({ animations: v })} accent={accent} />
                <ToggleRow label="Hiệu ứng kính mờ" desc="Nền mờ (glass) trên dropdown, popup và thanh công cụ" checked={theme?.glass !== false} onChange={(v) => setTheme({ glass: v })} accent={accent} />
            </div>

            {/* (h) Đặt lại mặc định */}
            <div className="pt-2 border-t border-white/10">
                <button
                    type="button"
                    onClick={() => { resetTheme(); if (onReset) onReset(); }}
                    className="w-full sm:w-auto bg-white/10 hover:bg-white/20 border border-white/10 text-white font-bold py-3 px-6 rounded-xl transition flex items-center justify-center gap-2 active:scale-95"
                >
                    <FaUndo className="text-xs" /> Đặt lại mặc định
                </button>
                <p className="text-xs text-gray-500 mt-2">Về bộ màu Đỏ Đô mặc định cùng các tùy chọn gốc.</p>
            </div>
        </div>
    );
};

const Profile = () => {
    const navigate = useNavigate();
    const [user, setUser] = useState(getCurrentUser());
    const [favorites, setFavorites] = useState([]);
    const [loadingFavs, setLoadingFavs] = useState(true);
    const [showEdit, setShowEdit] = useState(false);
    const [activeTab, setActiveTab] = useState('info');
    const [isSaving, setIsSaving] = useState(false);
    const [formData, setFormData] = useState({ fullname: '', avatar: '', newPassword: '', confirmPassword: '' });
    const [selectedFile, setSelectedFile] = useState(null);
    const [toast, setToast] = useState(null);
    const fileInputRef = useRef(null);

    // Cá nhân hóa giao diện (Nhóm C): lấy đúng hợp đồng của nhóm B.
    // Phòng thủ: nếu ThemeProvider chưa bọc App thì mục Giao diện vẫn
    // render (dùng FALLBACK_PRESETS + setTheme/resetTheme rỗng) thay vì crash.
    let themeApi = null;
    try { themeApi = useTheme(); } catch (e) { themeApi = null; }
    const theme = themeApi?.theme;
    const setTheme = themeApi?.setTheme || (() => {});
    const resetTheme = themeApi?.resetTheme || (() => {});
    const themePresets = themeApi?.presets || [];

    const fetchFavs = async () => {
        try {
            const data = await getFavorites();
            const mappedData = data.map(item => ({
                _id: item.id, slug: item.movie_slug, name: item.movie_name, thumb_url: item.movie_thumb,
                quality: item.movie_quality || 'HD', year: item.movie_year || '2024', episode_current: item.episode_current || 'Full',
                vote_average: item.vote_average ? parseFloat(item.vote_average) : 0, origin_name: 'Đã lưu'
            }));
            setFavorites(mappedData || []);
        } catch (e) { console.error(e); } finally { setLoadingFavs(false); }
    };

    useEffect(() => {
        if (!user) { navigate('/login'); return; }
        setFormData(prev => ({ ...prev, fullname: user.fullname, avatar: user.avatar }));
        fetchFavs();
    }, [user, navigate]);

    // Vòng 2 (23/11/2026): gỡ lưu TRỰC TIẾP bằng nút X trên card — nút
    // xóa hover-only cũ không bấm được vì popup hover của MovieCard
    // (portal z-[9999]) mở ngay khi trỏ vào card và che mất nút (z-20).
    // Nút X mới hiện rõ luôn, z-[10000] cao hơn popup; bấm là gỡ ngay:
    // card biến mất khỏi state local tức thì + toast xác nhận, API lỗi
    // thì card quay lại đúng vị trí cũ + toast lỗi (không modal).
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

    const handleFileUpload = (e) => {
        const file = e.target.files[0];
        if (file) {
            if (file.size > 5 * 1024 * 1024) { setToast({ type: 'error', message: 'Ảnh quá lớn! Vui lòng chọn ảnh dưới 5MB.' }); return; }
            const previewUrl = URL.createObjectURL(file);
            setFormData(prev => ({ ...prev, avatar: previewUrl }));
            setSelectedFile(file);
        }
    };

    const uploadImageToCloudinary = async (file) => {
        const data = new FormData();
        data.append("file", file); data.append("upload_preset", UPLOAD_PRESET); data.append("cloud_name", CLOUD_NAME);
        try {
            const res = await axios.post(`https://api.cloudinary.com/v1_1/${CLOUD_NAME}/image/upload`, data);
            return res.data.secure_url;
        } catch (err) { throw new Error("Lỗi khi tải ảnh lên máy chủ."); }
    };

    const handleUpdate = async (e) => {
        e.preventDefault();
        if (formData.newPassword && formData.newPassword !== formData.confirmPassword) { setToast({ type: 'error', message: 'Mật khẩu nhập lại không khớp!' }); return; }
        setIsSaving(true);
        try {
            let finalAvatarUrl = formData.avatar;
            if (selectedFile) finalAvatarUrl = await uploadImageToCloudinary(selectedFile);
            const dataToSend = { fullname: formData.fullname, avatar: finalAvatarUrl, ...(formData.newPassword && { password: formData.newPassword }) };
            const res = await updateProfile(dataToSend);
            setUser(res.user); setShowEdit(false); setSelectedFile(null); setToast({ type: 'success', message: 'Cập nhật hồ sơ thành công!' });
        } catch (error) {
            setToast({ type: 'error', message: error.message || "Có lỗi xảy ra khi cập nhật hồ sơ" });
        } finally { setIsSaving(false); }
    };

    if (!user) return null;

    return (
        <div className="min-h-screen bg-transparent text-white font-sans pb-20 selection:bg-red-600 selection:text-white">
            <Helmet><title>Hồ sơ của tôi | PhimVietHay</title></Helmet>
            {toast && <Toast type={toast.type} message={toast.message} onClose={() => setToast(null)} />}
            <div className="relative h-[350px] md:h-[400px] group overflow-hidden mt-[-64px] md:mt-[-80px]">
                <div className="absolute inset-0 bg-gradient-to-t from-[#0a0e17] via-transparent to-transparent" />
                <div className="absolute bottom-0 left-0 w-full container mx-auto px-4 md:px-12 pb-4 flex flex-col md:flex-row items-center md:items-end gap-6 z-10">
                    <div className="relative group/avatar">
                        <div className="p-1 rounded-full bg-gradient-to-br from-red-600 to-purple-600 shadow-[0_0_30px_rgba(220,38,38,0.3)]">
                            <UserAvatar user={user} className="w-28 h-28 md:w-36 md:h-36 border-4 border-[#0a0e17] bg-[#0a0e17]" fontSize="text-4xl" />
                        </div>
                        <button onClick={() => { setActiveTab('avatar'); setShowEdit(true); }} className="absolute bottom-1 right-1 bg-[#222] text-white p-2.5 rounded-full shadow-lg border border-white/20 hover:bg-white hover:text-black transition transform hover:scale-110"><FaCamera className="text-sm" /></button>
                    </div>
                    <div className="flex-1 text-center md:text-left mb-2">
                        <h1 className="text-3xl md:text-5xl font-black text-white tracking-tight drop-shadow-2xl mb-2">{user.fullname || user.username}</h1>
                        <div className="flex flex-wrap items-center justify-center md:justify-start gap-4 text-sm font-medium text-gray-300">
                            <span className="drop-shadow-md">@{user.username}</span><span className="w-1 h-1 bg-gray-500 rounded-full"></span><span className="drop-shadow-md">{user.email}</span>
                            {(user.role === 'admin' || user.role === 'super_admin') && <span className="bg-red-600 text-white text-[10px] px-2 py-0.5 rounded-full font-bold tracking-wider shadow-lg shadow-red-900/30">{getRoleLabel(user.role)}</span>}
                        </div>
                    </div>
                    <div className="flex gap-3 mb-2">
                        <button onClick={() => { setActiveTab('info'); setShowEdit(true); }} className="bg-white/10 hover:bg-white/20 backdrop-blur-md border border-white/10 text-white font-bold py-2.5 px-6 rounded-full shadow-lg transition flex items-center gap-2"><FaPen className="text-xs" /> Chỉnh sửa</button>
                        <button onClick={() => { logout(); navigate('/login'); }} className="bg-red-600/20 hover:bg-red-600 border border-red-600/50 text-red-500 hover:text-white font-bold py-2.5 px-4 rounded-full backdrop-blur-md transition flex items-center gap-2 transform active:scale-95 group/logout"><FaSignOutAlt className="group-hover/logout:rotate-180 transition-transform duration-300" /></button>
                    </div>
                </div>
            </div>
            <div className="h-8"></div>
            <div className="container mx-auto px-4 md:px-12">
                <div className="mb-8 flex items-end justify-between border-b border-white/10 pb-4">
                    <h2 className="text-2xl font-bold text-white flex items-center gap-3"><FaHeart className="text-red-600" /> Tủ Phim Của Tôi <span className="text-sm font-normal text-gray-500">({favorites.length})</span></h2>
                </div>
                {loadingFavs ? <div className="flex justify-center py-20"><div className="animate-spin rounded-full h-10 w-10 border-t-2 border-red-600"></div></div> : favorites.length > 0 ? (
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
                    <div className="py-20 text-center border-2 border-dashed border-white/10 rounded-2xl bg-white/5">
                        <FaHeart className="text-6xl mx-auto mb-4 text-gray-600 opacity-50"/>
                        <p className="text-xl font-bold text-gray-400">Tủ phim trống trơn</p>
                        <button onClick={() => navigate('/')} className="mt-6 bg-red-600 px-8 py-3 rounded-full font-bold hover:bg-red-700 transition text-white shadow-lg">Khám phá ngay</button>
                    </div>
                )}
            </div>
            {/* Mục Giao diện (Nhóm C): cùng component với tab trong modal Cài đặt. */}
            <div className="container mx-auto px-4 md:px-12 mt-14">
                <div className="mb-8 flex items-end justify-between border-b border-white/10 pb-4">
                    <h2 className="text-2xl font-bold text-white flex items-center gap-3"><FaPalette className="text-red-600" /> Giao Diện Của Tôi</h2>
                    <span className="text-xs font-bold text-gray-500">Tự lưu theo tài khoản</span>
                </div>
                <div className="max-w-3xl">
                    <ThemeSettings theme={theme} setTheme={setTheme} resetTheme={resetTheme} presets={themePresets} onReset={() => setToast({ type: 'success', message: 'Đã đặt lại giao diện mặc định.' })} />
                </div>
            </div>
            {showEdit && (
                <div className="fixed inset-0 z-[200] flex items-center justify-center p-4 bg-black/90 backdrop-blur-md animate-fade-in">
                    <div className="bg-[#0a0a0a] w-full max-w-4xl h-[650px] rounded-2xl border border-white/10 shadow-2xl overflow-hidden flex flex-col md:flex-row relative">
                        <button onClick={() => setShowEdit(false)} className="absolute top-4 right-4 text-gray-500 hover:text-white z-50"><FaTimes size={20}/></button>
                        <div className="w-full md:w-72 bg-black/40 border-b md:border-b-0 md:border-r border-white/10 p-6 flex flex-col">
                            <div className="mb-8"><h3 className="text-xl font-bold text-white">Cài đặt tài khoản</h3></div>
                            <div className="space-y-2 flex-1">
                                {[{ id: 'info', icon: FaIdCard, label: 'Thông tin chung' }, { id: 'avatar', icon: FaImage, label: 'Ảnh đại diện' }, { id: 'password', icon: FaLock, label: 'Bảo mật' }, { id: 'theme', icon: FaPalette, label: 'Giao diện' }].map(tab => (
                                    <button key={tab.id} onClick={() => setActiveTab(tab.id)} className={`w-full text-left px-4 py-3 rounded-xl font-bold text-sm transition flex items-center gap-3 ${activeTab === tab.id ? 'bg-white text-black' : 'text-gray-400 hover:bg-white/5 hover:text-white'}`}><tab.icon /> {tab.label}</button>
                                ))}
                            </div>
                        </div>
                        <div className="flex-1 bg-transparent relative flex flex-col">
                            <div className="flex-1 overflow-y-auto custom-scrollbar p-8">
                                <form onSubmit={handleUpdate} id="profile-form">
                                    {activeTab === 'info' && (
                                        <div className="space-y-6 animate-fade-in">
                                            <h2 className="text-2xl font-bold text-white mb-2">Thông tin chung</h2>
                                            <div><label className="block text-xs font-bold text-gray-500 uppercase mb-2">Tên hiển thị</label><input type="text" className="w-full bg-white/5 border border-white/10 rounded-xl py-4 px-5 text-white focus:border-red-600 outline-none transition font-medium" value={formData.fullname} onChange={(e) => setFormData({...formData, fullname: e.target.value})} /></div>
                                            <div><label className="block text-xs font-bold text-gray-500 uppercase mb-2">Email</label><input type="text" disabled className="w-full bg-black/40 border border-transparent rounded-xl py-4 px-5 text-gray-500 cursor-not-allowed" value={user.email} /></div>
                                        </div>
                                    )}
                                    {activeTab === 'avatar' && (
                                        <div className="space-y-6 animate-fade-in">
                                            <h2 className="text-2xl font-bold text-white mb-2">Ảnh đại diện</h2>
                                            <div className="flex items-center gap-6 mb-8">
                                                <div className="w-24 h-24 rounded-full overflow-hidden border-4 border-red-600 bg-black shadow-xl">{formData.avatar ? <img src={formData.avatar} className="w-full h-full object-cover" alt="preview"/> : <UserAvatar user={{fullname: formData.fullname}} className="w-full h-full" />}</div>
                                                <div onClick={() => fileInputRef.current.click()} className="flex-1 border-2 border-dashed border-white/20 rounded-xl h-24 flex flex-col items-center justify-center cursor-pointer hover:border-red-600 hover:bg-red-600/5 transition group"><FaCloudUploadAlt className="text-2xl text-gray-400 group-hover:text-red-500 mb-1" /><p className="text-xs text-gray-300 font-bold">Tải ảnh lên (Max 5MB)</p><input ref={fileInputRef} type="file" accept="image/*" className="hidden" onChange={handleFileUpload} /></div>
                                            </div>
                                            <div><p className="text-xs font-bold text-gray-500 uppercase mb-3">Nhân vật mẫu:</p><div className="grid grid-cols-4 sm:grid-cols-5 gap-3">{PRESET_AVATARS.map((char, idx) => (<div key={idx} onClick={() => {setFormData({...formData, avatar: char.url}); setSelectedFile(null);}} className={`relative aspect-square rounded-xl overflow-hidden cursor-pointer border-2 transition group ${formData.avatar === char.url ? 'border-red-600 scale-105 shadow-lg shadow-red-900/40' : 'border-transparent hover:border-white/30'}`}><img src={char.url} alt={char.name} className="w-full h-full object-cover" />{formData.avatar === char.url && <div className="absolute top-1 right-1 bg-red-600 rounded-full p-0.5"><FaCheckCircle size={10} /></div>}</div>))}</div></div>
                                        </div>
                                    )}
                                    {activeTab === 'password' && (
                                        <div className="space-y-6 animate-fade-in">
                                            <h2 className="text-2xl font-bold text-white mb-2">Bảo mật</h2>
                                            <div className="space-y-4"><input type="password" placeholder="Mật khẩu mới" className="w-full bg-white/5 border border-white/10 rounded-xl py-4 px-5 text-white focus:border-red-600 outline-none transition" value={formData.newPassword} onChange={(e) => setFormData({...formData, newPassword: e.target.value})} /><input type="password" placeholder="Nhập lại mật khẩu mới" className="w-full bg-white/5 border border-white/10 rounded-xl py-4 px-5 text-white focus:border-red-600 outline-none transition" value={formData.confirmPassword} onChange={(e) => setFormData({...formData, confirmPassword: e.target.value})} /></div>
                                        </div>
                                    )}
                                    {activeTab === 'theme' && (
                                        <ThemeSettings theme={theme} setTheme={setTheme} resetTheme={resetTheme} presets={themePresets} onReset={() => setToast({ type: 'success', message: 'Đã đặt lại giao diện mặc định.' })} />
                                    )}
                                </form>
                            </div>
                            <div className="p-6 border-t border-white/10 flex justify-end bg-black/20">
                                {activeTab === 'theme' ? (
                                    <span className="text-xs font-bold text-gray-500 flex items-center gap-2"><FaCheckCircle className="text-green-500" /> Giao diện tự lưu ngay khi bạn thay đổi</span>
                                ) : (
                                    <button onClick={handleUpdate} disabled={isSaving} className="bg-red-600 hover:bg-red-700 text-white font-bold py-3 px-8 rounded-xl shadow-lg shadow-red-900/20 transition flex items-center gap-2 disabled:opacity-50">{isSaving ? <><div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin"></div> Đang lưu...</> : <><FaSave /> Lưu Thay Đổi</>}</button>
                                )}
                            </div>
                        </div>
                    </div>
                </div>
            )}
        </div>
    );
};

export default Profile;