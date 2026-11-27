import React, { useEffect, useState, useRef } from 'react';
import axios from 'axios';
import { useNavigate } from 'react-router-dom';
import { Helmet } from 'react-helmet-async';
import { 
    FaUserCircle, FaSave, FaSignOutAlt, FaCamera, FaLock, FaIdCard, 
    FaHeart, FaCloudUploadAlt, FaCheckCircle, FaExclamationCircle, 
    FaImage, FaPen, FaTimes, FaPalette, FaUndo, FaCheck, FaCrown,
    FaEye, FaEyeSlash, FaPlay, FaSlidersH
} from 'react-icons/fa';

import MovieCard from '../components/movies/MovieCard';
import UserAvatar from '../components/common/UserAvatar';
import { getFavorites, getCurrentUser, updateProfile, logout, toggleFavorite } from '../services/authService';
import { getRoleLabel } from '../utils/roleLabel';
import { HOME_ROWS } from '../config/menuRows';
import { useTheme } from '../context/ThemeContext';
import { calculateLevel, AVATAR_FRAMES } from '../utils/levelUtils';
import { getPlaylists, getPlaylistMovies, removeMovieFromPlaylist } from '../services/playlistService';

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

const PRESET_BANNERS = [
    { name: 'Rạp Phim Cổ Điển', url: 'https://images.unsplash.com/photo-1489599849927-2ee91cede3ba?q=80&w=1600&auto=format&fit=crop' },
    { name: 'Thành Phố Cyberpunk', url: 'https://images.unsplash.com/photo-1542751371-adc38448a05e?q=80&w=1600&auto=format&fit=crop' },
    { name: 'Không Gian Vũ Trụ', url: 'https://images.unsplash.com/photo-1506703719100-a0f3a48c0f86?q=80&w=1600&auto=format&fit=crop' },
    { name: 'Hoàng Hôn Retro', url: 'https://images.unsplash.com/photo-1518709268805-4e9042af9f23?q=80&w=1600&auto=format&fit=crop' },
    { name: 'Ánh Đèn Neon Sân Khấu', url: 'https://images.unsplash.com/photo-1514525253161-7a46d19cd819?q=80&w=1600&auto=format&fit=crop' },
];

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

const FALLBACK_PRESETS = [
    { id: 'crimson', name: 'Đỏ Đô', accent: '#dc2626', background: '#0a0e17', surface: '#111827', text: '#ffffff', textMuted: '#9ca3af', border: 'rgba(255,255,255,0.1)' },
    { id: 'ocean', name: 'Đại Dương', accent: '#3b82f6', background: '#081120', surface: '#0f1f38', text: '#ffffff', textMuted: '#9ca3af', border: 'rgba(255,255,255,0.1)' },
    { id: 'violet', name: 'Tím Mộng', accent: '#8b5cf6', background: '#100a1e', surface: '#1d1338', text: '#ffffff', textMuted: '#9ca3af', border: 'rgba(255,255,255,0.1)' },
    { id: 'emerald', name: 'Ngọc Lục', accent: '#10b981', background: '#07130f', surface: '#0d2118', text: '#ffffff', textMuted: '#9ca3af', border: 'rgba(255,255,255,0.1)' },
    { id: 'amber', name: 'Hổ Phách', accent: '#f59e0b', background: '#171006', surface: '#241a08', text: '#ffffff', textMuted: '#9ca3af', border: 'rgba(255,255,255,0.1)' },
    { id: 'rose', name: 'Hồng Đào', accent: '#f43f5e', background: '#180a10', surface: '#26101a', text: '#ffffff', textMuted: '#9ca3af', border: 'rgba(255,255,255,0.1)' },
];

const RADIUS_OPTIONS = [
    { id: 'round', label: 'Bo cong tròn (Round)' },
    { id: 'medium', label: 'Bo vừa (Medium)' },
    { id: 'square', label: 'Vuông góc (Square)' },
];
const BUTTON_SHAPE_OPTIONS = [
    { id: 'pill', label: 'Bo tròn (Pill)' },
    { id: 'rounded', label: 'Bo vừa (Rounded)' },
    { id: 'tech', label: 'Vuông góc (Tech)' },
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

const PROGRESS_BAR_OPTIONS = [
    { id: 'accent', label: 'Theo màu chủ đạo', desc: 'Đồng bộ màu Accent' },
    { id: 'crimson', label: 'Đỏ Rạp Phim', desc: 'Cổ điển #e50914' },
    { id: 'cyberpunk', label: 'Tím Cyberpunk', desc: 'Gradient Neon Hồng-Tím' },
    { id: 'emerald', label: 'Xanh Emerald', desc: 'Mượt mà #10b981' },
    { id: 'gold', label: 'Vàng Kim Gold', desc: 'Hoàng gia #f59e0b' },
];

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

// Hộp xem trước giao diện trực quan (Live Preview Box)
const ThemePreviewBox = ({ theme, accent }) => {
    const cardRadiusClass = theme?.radius === 'round' ? 'rounded-2xl' : theme?.radius === 'square' ? 'rounded-none' : 'rounded-xl';
    const btnRadiusClass = theme?.buttonShape === 'rounded' ? 'rounded-xl' : theme?.buttonShape === 'tech' ? 'rounded-sm' : 'rounded-full';
    const pb = theme?.progressBar || 'accent';
    const pbColorStyle = pb === 'crimson' ? { backgroundColor: '#e50914' }
        : pb === 'cyberpunk' ? { background: 'linear-gradient(90deg, #ec4899, #8b5cf6)' }
        : pb === 'emerald' ? { backgroundColor: '#10b981' }
        : pb === 'gold' ? { backgroundColor: '#f59e0b' }
        : { backgroundColor: accent };

    return (
        <div className={`p-4 md:p-6 bg-[#0e1422]/90 border border-white/15 ${cardRadiusClass} shadow-2xl relative overflow-hidden backdrop-blur-2xl transition-all`}>
            {/* Header mô phỏng */}
            <div className="flex items-center justify-between pb-3.5 border-b border-white/10 mb-5">
                <div className="flex items-center gap-2.5">
                    <span className="w-3 h-3 rounded-full animate-ping" style={{ backgroundColor: accent }}></span>
                    <span className="text-xs font-black tracking-wider uppercase text-white drop-shadow">Hộp Xem Trước Trực Quan</span>
                </div>
                <div className="flex items-center gap-2">
                    <button type="button" className={`px-2.5 py-1 ${btnRadiusClass} text-[10px] font-bold border transition flex items-center gap-1.5`} style={{ backgroundColor: `${accent}22`, borderColor: `${accent}55`, color: accent }}>
                        🎬 Playlist Mẫu
                    </button>
                    <span className="text-[10px] px-2.5 py-1 rounded-full font-mono font-bold tracking-wider border bg-white/5 border-white/10 text-gray-300">
                        Thời gian thực
                    </span>
                </div>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-12 gap-5 items-center">
                {/* Mini Card Phim */}
                <div className={`sm:col-span-5 relative group overflow-hidden ${cardRadiusClass} border border-white/15 aspect-[2/3] max-h-56 mx-auto sm:mx-0 shadow-2xl bg-black`}>
                    <img 
                        src="https://images.unsplash.com/photo-1536440136628-849c177e76a1?q=80&w=600&auto=format&fit=crop" 
                        alt="Preview Card" 
                        className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-500 opacity-90"
                    />
                    <div className="absolute top-2 left-2 flex gap-1">
                        <span className="text-[9px] font-black px-1.5 py-0.5 rounded text-white shadow uppercase" style={{ backgroundColor: accent }}>
                            HD
                        </span>
                    </div>
                    <div className="absolute inset-0 bg-gradient-to-t from-black/95 via-black/30 to-transparent flex flex-col justify-end p-3.5">
                        <span className="text-[10px] font-black px-2 py-0.5 rounded text-white self-start mb-1.5 shadow" style={{ backgroundColor: accent }}>
                            TẬP 12
                        </span>
                        <p className="text-xs font-black text-white truncate drop-shadow">Huyền Thoại Biển Sâu</p>
                        <p className="text-[10px] text-gray-300">Đang xem: 18:45 / 24:00</p>
                        {/* Thanh tiến trình trên card */}
                        <div className="w-full bg-white/20 h-1.5 rounded-full mt-2 overflow-hidden">
                            <div className="h-full rounded-full transition-all duration-300" style={{ width: '78%', ...pbColorStyle }} />
                        </div>
                    </div>
                </div>

                {/* Mini Player Timeline & Controls */}
                <div className="sm:col-span-7 flex flex-col gap-3.5">
                    {/* Thanh player mô phỏng */}
                    <div className="bg-white/5 border border-white/10 rounded-xl p-3.5 shadow-inner">
                        <div className="flex items-center justify-between text-[11px] font-mono text-gray-300 mb-2 font-bold">
                            <span>18:45</span>
                            <span className="text-gray-400">24:00</span>
                        </div>
                        {/* Thanh seekbar */}
                        <div className="relative w-full h-2.5 bg-white/10 rounded-full cursor-pointer overflow-hidden">
                            <div className="absolute top-0 left-0 h-full rounded-full transition-all duration-300" style={{ width: '78%', ...pbColorStyle }} />
                        </div>
                        <div className="flex items-center justify-between mt-3 pt-2.5 border-t border-white/10">
                            <div className="flex items-center gap-2">
                                <span className="w-6 h-6 rounded-full flex items-center justify-center text-white text-[10px] shadow" style={{ backgroundColor: accent }}>
                                    <FaPlay className="text-[9px] ml-0.5" />
                                </span>
                                <span className="text-[11px] font-bold text-gray-200">Trình phát PhimVietHay</span>
                            </div>
                            <span className="text-[10px] font-bold px-1.5 py-0.5 rounded bg-white/10 text-gray-300">1080p FHD</span>
                        </div>
                    </div>

                    {/* Nút bấm mẫu theo buttonShape */}
                    <div className="flex gap-2">
                        <button 
                            type="button"
                            className={`flex-1 py-2.5 px-4 ${btnRadiusClass} font-bold text-xs text-white shadow-lg transition flex items-center justify-center gap-2 active:scale-95`}
                            style={{ backgroundColor: accent }}
                        >
                            <FaPlay className="text-[10px]" /> Xem tiếp
                        </button>
                        <button 
                            type="button"
                            className={`py-2.5 px-4 ${btnRadiusClass} font-bold text-xs bg-white/10 hover:bg-white/20 text-gray-200 border border-white/10 transition flex items-center gap-1.5 active:scale-95`}
                        >
                            <FaHeart className="text-xs text-red-500" /> Tủ phim
                        </button>
                    </div>

                    {/* Thông số màu sắc tóm tắt */}
                    <div className="flex items-center justify-between text-[11px] text-gray-400 pt-1 border-t border-white/5">
                        <span>Card: <strong className="text-white capitalize">{theme?.radius || 'medium'}</strong></span>
                        <span>Nút: <strong className="text-white capitalize">{theme?.buttonShape || 'pill'}</strong></span>
                        <span>Màu: <strong className="text-white uppercase">{accent}</strong></span>
                    </div>
                </div>
            </div>
        </div>
    );
};

const ThemeSettings = ({ theme, setTheme, resetTheme, presets, onReset }) => {
    const list = presets && presets.length > 0 ? presets : FALLBACK_PRESETS;
    const accent = theme?.accent || '#dc2626';
    const hiddenRows = theme?.hiddenRows || [];
    const [customAccent, setCustomAccent] = useState(theme?.accent || '#dc2626');

    useEffect(() => { setCustomAccent(theme?.accent || '#dc2626'); }, [theme?.preset]);

    const handleSelectPreset = (preset) => {
        setTheme({ preset: preset.id, accent: preset.accent });
    };

    const handleApplyCustomAccent = () => {
        if (/^#(?:[0-9a-fA-F]{3}|[0-9a-fA-F]{6})$/.test(customAccent)) {
            setTheme({ preset: 'custom', accent: customAccent });
        }
    };

    const toggleRow = (slug) => {
        const next = hiddenRows.includes(slug)
            ? hiddenRows.filter((s) => s !== slug)
            : [...hiddenRows, slug];
        setTheme({ hiddenRows: next });
    };

    return (
        <div className="space-y-8">
            {/* Hộp xem trước trực quan */}
            <ThemePreviewBox theme={theme} accent={accent} />

            {/* (a) Bảng màu chủ đạo */}
            <div>
                <p className="text-xs font-bold text-gray-400 uppercase tracking-wider mb-1">Màu sắc chủ đạo (Accent Theme)</p>
                <p className="text-xs text-gray-500 mb-4">Màu này sẽ tạo điểm nhấn cho nút bấm, viền thẻ hover, và biểu tượng rạp phim.</p>
                <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
                    {list.map((p) => {
                        const active = theme?.preset === p.id;
                        return (
                            <button
                                key={p.id}
                                type="button"
                                onClick={() => handleSelectPreset(p)}
                                className={`flex items-center gap-3 p-3 rounded-xl border text-left transition ${active ? 'bg-white/10 border-white text-white shadow-lg' : 'bg-white/5 border-white/10 text-gray-300 hover:bg-white/10'}`}
                            >
                                <span className="w-5 h-5 rounded-full shrink-0 shadow" style={{ backgroundColor: p.accent }} />
                                <div className="flex-1 min-w-0">
                                    <p className="font-bold text-sm truncate">{p.name}</p>
                                </div>
                                {active && <FaCheck className="text-xs shrink-0 text-white" />}
                            </button>
                        );
                    })}
                </div>
            </div>

            {/* (b) Màu tùy chỉnh Hex */}
            <div className="p-4 rounded-xl bg-white/5 border border-white/10">
                <p className="text-xs font-bold text-gray-400 uppercase tracking-wider mb-2">Tự chọn mã màu riêng</p>
                <div className="flex items-center gap-3">
                    <input
                        type="color"
                        value={customAccent}
                        onChange={(e) => setCustomAccent(e.target.value)}
                        className="w-10 h-10 rounded-lg cursor-pointer bg-transparent border-0"
                    />
                    <input
                        type="text"
                        value={customAccent}
                        onChange={(e) => setCustomAccent(e.target.value)}
                        placeholder="#e50914"
                        className="flex-1 bg-black/40 border border-white/10 rounded-lg px-3 py-2 text-sm text-white font-mono focus:border-white/30 outline-none"
                    />
                    <button
                        type="button"
                        onClick={handleApplyCustomAccent}
                        className="px-4 py-2 rounded-lg font-bold text-sm text-white transition active:scale-95"
                        style={{ backgroundColor: accent }}
                    >
                        Áp dụng
                    </button>
                </div>
            </div>

            {/* (c) Màu thanh tiến trình Player */}
            <div>
                <p className="text-xs font-bold text-gray-400 uppercase tracking-wider mb-1">Màu thanh tiến trình trình phát (Video Progress Bar)</p>
                <p className="text-xs text-gray-500 mb-3">Tùy biến dải màu hiển thị khi bạn xem phim trên player.</p>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5">
                    {PROGRESS_BAR_OPTIONS.map((opt) => {
                        const selected = (theme?.progressBar || 'accent') === opt.id;
                        return (
                            <button
                                key={opt.id}
                                type="button"
                                onClick={() => setTheme({ progressBar: opt.id })}
                                className={`flex items-center gap-3 p-3 rounded-xl border text-left transition ${selected ? 'bg-white/10 text-white shadow-lg' : 'bg-white/5 text-gray-300 border-white/10 hover:bg-white/10'}`}
                                style={selected ? { borderColor: accent } : undefined}
                            >
                                <span 
                                    className="w-4 h-4 rounded-full shrink-0 shadow"
                                    style={{
                                        backgroundColor: opt.id === 'crimson' ? '#e50914'
                                            : opt.id === 'cyberpunk' ? '#ec4899'
                                            : opt.id === 'emerald' ? '#10b981'
                                            : opt.id === 'gold' ? '#f59e0b'
                                            : accent
                                    }}
                                />
                                <div className="flex-1 min-w-0">
                                    <p className="font-bold text-sm truncate">{opt.label}</p>
                                    <p className="text-[11px] text-gray-500">{opt.desc}</p>
                                </div>
                                {selected && <FaCheck className="text-xs text-white" />}
                            </button>
                        );
                    })}
                </div>
            </div>

            {/* (d) Bo góc card */}
            <OptionGroup label="Kiểu dáng Card Phim" options={RADIUS_OPTIONS} value={theme?.radius || 'medium'} onChange={(v) => setTheme({ radius: v })} accent={accent} />

            {/* (d2) Kiểu dáng Nút bấm & Playlist */}
            <OptionGroup label="Kiểu dáng Nút bấm & Playlist" options={BUTTON_SHAPE_OPTIONS} value={theme?.buttonShape || 'pill'} onChange={(v) => setTheme({ buttonShape: v })} accent={accent} />

            {/* (e) Cỡ chữ */}
            <OptionGroup label="Cỡ chữ toàn hệ thống" options={FONT_SIZE_OPTIONS} value={theme?.fontSize || 'medium'} onChange={(v) => setTheme({ fontSize: v })} accent={accent} />

            {/* (f) Mật độ hiển thị */}
            <OptionGroup label="Mật độ hiển thị lưới phim" options={DENSITY_OPTIONS} value={theme?.density || 'comfortable'} onChange={(v) => setTheme({ density: v })} accent={accent} />

            {/* (g) Ẩn/hiện hàng trang chủ */}
            <div>
                <p className="text-xs font-bold text-gray-400 uppercase tracking-wider mb-1">Hàng hiển thị trên trang chủ</p>
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

            {/* (h) Hiệu ứng */}
            <div>
                <p className="text-xs font-bold text-gray-400 uppercase tracking-wider mb-1">Hiệu ứng chuyển động & kính mờ</p>
                <ToggleRow label="Animation mượt" desc="Hiệu ứng chuyển động khi chuyển slide, hover card" checked={theme?.animations !== false} onChange={(v) => setTheme({ animations: v })} accent={accent} />
                <ToggleRow label="Hiệu ứng kính mờ (Glassmorphism)" desc="Nền mờ trên dropdown, popup và thanh công cụ" checked={theme?.glass !== false} onChange={(v) => setTheme({ glass: v })} accent={accent} />
            </div>

            {/* (i) Đặt lại mặc định */}
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
    const [formData, setFormData] = useState({ 
        fullname: '', 
        avatar: '', 
        banner_url: '',
        is_public: true,
        current_frame: 'default',
        currentPassword: '',
        newPassword: '', 
        confirmPassword: '' 
    });
    const [selectedFile, setSelectedFile] = useState(null);
    const [selectedBannerFile, setSelectedBannerFile] = useState(null);
    const [toast, setToast] = useState(null);
    const fileInputRef = useRef(null);
    const bannerInputRef = useRef(null);

    let themeApi = null;
    try { themeApi = useTheme(); } catch (e) { themeApi = null; }
    const theme = themeApi?.theme;
    const setTheme = themeApi?.setTheme || (() => {});
    const resetTheme = themeApi?.resetTheme || (() => {});
    const themePresets = themeApi?.presets || [];

    const [playlists, setPlaylists] = useState([]);
    const [activePlaylistTab, setActivePlaylistTab] = useState('favorites');
    const [playlistMovies, setPlaylistMovies] = useState([]);
    const [loadingPlaylistMovies, setLoadingPlaylistMovies] = useState(false);

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

    const fetchPlaylists = async () => {
        try {
            const data = await getPlaylists();
            setPlaylists(data || []);
        } catch (e) { console.error(e); }
    };

    useEffect(() => {
        if (!user) { navigate('/login'); return; }
        setFormData(prev => ({ 
            ...prev, 
            fullname: user.fullname || user.username || '', 
            avatar: user.avatar || '',
            banner_url: user.banner_url || '',
            is_public: user.is_public !== undefined ? Boolean(user.is_public) : true,
            current_frame: user.current_frame || 'default'
        }));
        fetchFavs();
        fetchPlaylists();
    }, [user, navigate]);

    useEffect(() => {
        if (activePlaylistTab === 'favorites') return;
        setLoadingPlaylistMovies(true);
        getPlaylistMovies(activePlaylistTab)
            .then(res => {
                const mapped = (res?.movies || []).map(m => ({
                    _id: m.id,
                    slug: m.movie_slug,
                    name: m.movie_name,
                    thumb_url: m.movie_thumb,
                    quality: m.movie_quality || 'HD',
                    year: m.movie_year || '2024',
                    episode_current: m.episode_current || 'Full',
                    vote_average: m.vote_average ? parseFloat(m.vote_average) : 0,
                    origin_name: 'Đã lưu'
                }));
                setPlaylistMovies(mapped);
            })
            .catch(e => console.error(e))
            .finally(() => setLoadingPlaylistMovies(false));
    }, [activePlaylistTab]);

    const handleRemove = async (movie) => {
        if (activePlaylistTab === 'favorites') {
            const prev = favorites;
            setFavorites(prev.filter((m) => m._id !== movie._id));
            try {
                await toggleFavorite({ slug: movie.slug });
                setToast({ type: 'success', message: `Đã gỡ "${movie.name}" khỏi tủ phim.` });
            } catch (e) {
                setFavorites(prev);
                setToast({ type: 'error', message: 'Không gỡ được phim, vui lòng thử lại.' });
            }
        } else {
            const prev = playlistMovies;
            setPlaylistMovies(prev.filter((m) => m.slug !== movie.slug));
            try {
                await removeMovieFromPlaylist(activePlaylistTab, movie.slug);
                setPlaylists(prevList => prevList.map(p => 
                    p.id === activePlaylistTab ? { ...p, movie_count: Math.max(0, (p.movie_count || 1) - 1) } : p
                ));
                setToast({ type: 'success', message: `Đã gỡ "${movie.name}" khỏi danh sách.` });
            } catch (e) {
                setPlaylistMovies(prev);
                setToast({ type: 'error', message: 'Không gỡ được phim, vui lòng thử lại.' });
            }
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

    const handleBannerUpload = (e) => {
        const file = e.target.files[0];
        if (file) {
            if (file.size > 5 * 1024 * 1024) { setToast({ type: 'error', message: 'Ảnh bìa quá lớn! Vui lòng chọn ảnh dưới 5MB.' }); return; }
            const previewUrl = URL.createObjectURL(file);
            setFormData(prev => ({ ...prev, banner_url: previewUrl }));
            setSelectedBannerFile(file);
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
        if (e) e.preventDefault();
        if (formData.newPassword) {
            if (!formData.currentPassword) {
                setToast({ type: 'error', message: 'Vui lòng nhập mật khẩu hiện tại!' });
                return;
            }
            if (formData.newPassword !== formData.confirmPassword) { 
                setToast({ type: 'error', message: 'Mật khẩu nhập lại không khớp!' }); 
                return; 
            }
        }
        setIsSaving(true);
        try {
            let finalAvatarUrl = formData.avatar;
            if (selectedFile) finalAvatarUrl = await uploadImageToCloudinary(selectedFile);

            let finalBannerUrl = formData.banner_url;
            if (selectedBannerFile) finalBannerUrl = await uploadImageToCloudinary(selectedBannerFile);

            const dataToSend = { 
                fullname: formData.fullname, 
                avatar: finalAvatarUrl,
                banner_url: finalBannerUrl,
                is_public: formData.is_public ? 1 : 0,
                current_frame: formData.current_frame,
                ...(formData.newPassword && { 
                    currentPassword: formData.currentPassword,
                    password: formData.newPassword 
                }) 
            };
            const res = await updateProfile(dataToSend);
            setUser(res.user); 
            setShowEdit(false); 
            setSelectedFile(null); 
            setSelectedBannerFile(null);
            setToast({ type: 'success', message: 'Cập nhật hồ sơ thành công!' });
        } catch (error) {
            setToast({ type: 'error', message: error.message || "Có lỗi xảy ra khi cập nhật hồ sơ" });
        } finally { setIsSaving(false); }
    };

    const handleSelectFrame = async (frameId) => {
        setFormData(prev => ({ ...prev, current_frame: frameId }));
        try {
            const res = await updateProfile({ current_frame: frameId });
            setUser(res.user);
            setToast({ type: 'success', message: `Đã đổi sang khung "${AVATAR_FRAMES.find(f => f.id === frameId)?.name}"` });
        } catch (e) {
            setToast({ type: 'error', message: 'Lỗi cập nhật khung avatar' });
        }
    };

    const openEditTab = (tabName = 'info') => {
        setFormData({
            fullname: user.fullname || '',
            avatar: user.avatar || '',
            banner_url: user.banner_url || '',
            is_public: user.is_public !== 0,
            current_frame: user.current_frame || 'default',
            currentPassword: '',
            newPassword: '',
            confirmPassword: ''
        });
        setSelectedFile(null);
        setSelectedBannerFile(null);
        setActiveTab(tabName);
        setShowEdit(true);
    };

    if (!user) return null;

    const levelInfo = calculateLevel(user.exp || 0);

    return (
        <div className="min-h-screen bg-transparent text-white font-sans pb-20 selection:bg-red-600 selection:text-white">
            <Helmet><title>Hồ sơ của tôi | PhimVietHay</title></Helmet>
            {toast && <Toast type={toast.type} message={toast.message} onClose={() => setToast(null)} />}
            
            {/* Ảnh bìa Banner (Cover Header) */}
            <div className="relative h-[360px] md:h-[420px] group overflow-hidden mt-[-64px] md:mt-[-80px] bg-slate-950">
                {user.banner_url ? (
                    <img 
                        src={user.banner_url} 
                        alt="Profile Banner" 
                        className="absolute inset-0 w-full h-full object-cover object-center scale-100 group-hover:scale-105 transition-transform duration-700 opacity-80"
                    />
                ) : (
                    <div className="absolute inset-0 bg-gradient-to-r from-slate-900 via-indigo-950/60 to-purple-950/70" />
                )}
                {/* Lớp phủ chuyển màu mượt mà xuống nền đen */}
                <div className="absolute inset-0 bg-gradient-to-t from-[#0a0e17] via-[#0a0e17]/60 to-transparent" />
                
                {/* Nút đổi ảnh bìa nhanh góc trên-phải */}
                <button
                    onClick={() => openEditTab('banner')}
                    className="absolute top-24 md:top-28 right-4 md:right-12 z-20 bg-black/60 hover:bg-black/80 backdrop-blur-md text-white font-bold text-xs py-2 px-3.5 rounded-full border border-white/20 transition flex items-center gap-2 shadow-lg"
                    title="Đổi ảnh bìa"
                >
                    <FaCamera className="text-xs" /> <span className="hidden sm:inline">Đổi ảnh bìa</span>
                </button>

                {/* Thông tin hồ sơ hiển thị dưới chân banner */}
                <div className="absolute bottom-0 left-0 w-full container mx-auto px-4 md:px-12 pb-5 flex flex-col md:flex-row items-center md:items-end gap-6 z-10">
                    <div className="relative group/avatar">
                        <div className="p-1 rounded-full">
                            <UserAvatar 
                                user={user} 
                                frame={user.current_frame} 
                                className="w-28 h-28 md:w-36 md:h-36 bg-[#0a0e17]" 
                                fontSize="text-4xl" 
                            />
                        </div>
                        <button 
                            onClick={() => openEditTab('avatar')} 
                            className="absolute bottom-1 right-1 bg-[#222] text-white p-2.5 rounded-full shadow-lg border border-white/20 hover:bg-white hover:text-black transition transform hover:scale-110"
                            title="Đổi ảnh đại diện & khung"
                        >
                            <FaCamera className="text-sm" />
                        </button>
                    </div>

                    <div className="flex-1 text-center md:text-left mb-2">
                        <div className="flex flex-wrap items-center justify-center md:justify-start gap-2.5 mb-2">
                            <h1 className="text-3xl md:text-5xl font-black text-white tracking-tight drop-shadow-2xl">
                                {user.fullname || user.username}
                            </h1>
                            {/* Huy hiệu Cấp độ (Level Badge) */}
                            <div className="flex items-center gap-1.5 px-3 py-1 rounded-full bg-gradient-to-r from-amber-500/20 to-yellow-500/30 border border-yellow-500/40 text-yellow-300 text-xs font-black shadow-lg">
                                <FaCrown className="text-yellow-400" />
                                <span>Cấp {levelInfo.level}</span>
                                <span className="text-[10px] opacity-80 hidden sm:inline">• {levelInfo.title}</span>
                            </div>
                            {/* Huy hiệu Riêng tư / Công khai */}
                            <span className={`text-[11px] font-bold px-2.5 py-0.5 rounded-full border flex items-center gap-1 ${user.is_public ? 'bg-emerald-950/80 text-emerald-400 border-emerald-500/40' : 'bg-gray-800 text-gray-400 border-white/10'}`}>
                                {user.is_public ? <><FaEye className="text-[10px]" /> Công khai</> : <><FaEyeSlash className="text-[10px]" /> Riêng tư</>}
                            </span>
                        </div>

                        {/* Thanh tiến trình EXP */}
                        <div className="max-w-md mx-auto md:mx-0 mb-3">
                            <div className="flex items-center justify-between text-[11px] font-bold text-gray-400 mb-1">
                                <span>Tiến trình cấp {levelInfo.level}</span>
                                <span className="text-yellow-400/90">{levelInfo.exp} / {levelInfo.nextMilestone ? `${levelInfo.nextMilestone.exp} EXP` : 'Đỉnh cao'}</span>
                            </div>
                            <div className="w-full bg-white/10 h-2 rounded-full overflow-hidden border border-white/10">
                                <div 
                                    className="h-full rounded-full bg-gradient-to-r from-amber-500 to-yellow-400 transition-all duration-500 shadow-[0_0_8px_rgba(251,191,36,0.6)]"
                                    style={{ width: `${levelInfo.progressPercent}%` }}
                                />
                            </div>
                        </div>

                        <div className="flex flex-wrap items-center justify-center md:justify-start gap-4 text-sm font-medium text-gray-300">
                            <span className="drop-shadow-md">@{user.username}</span>
                            <span className="w-1 h-1 bg-gray-500 rounded-full"></span>
                            <span className="drop-shadow-md">{user.email}</span>
                            {(user.role === 'admin' || user.role === 'super_admin') && (
                                <span className="bg-red-600 text-white text-[10px] px-2 py-0.5 rounded-full font-bold tracking-wider shadow-lg shadow-red-900/30">
                                    {getRoleLabel(user.role)}
                                </span>
                            )}
                        </div>
                    </div>

                    <div className="flex gap-3 mb-2">
                        <button 
                            onClick={() => openEditTab('info')} 
                            className="bg-white/10 hover:bg-white/20 backdrop-blur-md border border-white/15 text-white font-bold py-2.5 px-6 rounded-full shadow-lg transition flex items-center gap-2"
                        >
                            <FaPen className="text-xs" /> Chỉnh sửa hồ sơ
                        </button>
                        <button 
                            onClick={() => { logout(); navigate('/login'); }} 
                            className="bg-red-600/20 hover:bg-red-600 border border-red-600/50 text-red-500 hover:text-white font-bold py-2.5 px-4 rounded-full backdrop-blur-md transition flex items-center gap-2 transform active:scale-95 group/logout"
                            title="Đăng xuất"
                        >
                            <FaSignOutAlt className="group-hover/logout:rotate-180 transition-transform duration-300" />
                        </button>
                    </div>
                </div>
            </div>

            <div className="h-6"></div>

            {/* Tủ Phim Của Tôi & Playlists */}
            <div className="container mx-auto px-4 md:px-12">
                <div className="mb-6 flex flex-col sm:flex-row sm:items-end justify-between border-b border-white/10 pb-4 gap-3">
                    <div>
                        <h2 className="text-2xl font-bold text-white flex items-center gap-3">
                            <FaHeart className="text-red-600" /> Tủ Phim & Bộ Sưu Tập
                        </h2>
                        <p className="text-xs text-gray-400 mt-0.5">Danh sách yêu thích và các bộ sưu tập phim bạn đã tạo.</p>
                    </div>
                    <button
                        type="button"
                        onClick={() => navigate('/tu-phim')}
                        className="text-xs font-bold text-[var(--accent)] hover:underline self-start sm:self-auto flex items-center gap-1.5"
                    >
                        Quản lý chi tiết tủ phim →
                    </button>
                </div>

                {/* Tabs phân loại nhanh */}
                <div className="flex items-center gap-2 overflow-x-auto pb-4 custom-scrollbar mb-6 select-none">
                    <button
                        type="button"
                        onClick={() => setActivePlaylistTab('favorites')}
                        className={`flex items-center gap-2 px-3.5 py-2 rounded-full font-bold text-xs whitespace-nowrap transition border shrink-0 ${activePlaylistTab === 'favorites' ? 'bg-red-600 text-white border-red-500 shadow' : 'bg-white/5 border-white/10 text-gray-300 hover:bg-white/10'}`}
                    >
                        <FaHeart className="text-[11px]" />
                        <span>Yêu thích ({favorites.length})</span>
                    </button>
                    {playlists.map((pl) => {
                        const isActive = activePlaylistTab === pl.id;
                        return (
                            <button
                                key={pl.id}
                                type="button"
                                onClick={() => setActivePlaylistTab(pl.id)}
                                className={`flex items-center gap-2 px-3.5 py-2 rounded-full font-bold text-xs whitespace-nowrap transition border shrink-0 ${isActive ? 'bg-white text-black border-white shadow' : 'bg-white/5 border-white/10 text-gray-300 hover:bg-white/10'}`}
                            >
                                <span>{pl.icon || '🎬'} {pl.title}</span>
                                <span className={`text-[10px] px-1.5 py-0.2 rounded-full font-mono ${isActive ? 'bg-black/20 text-black' : 'bg-white/10 text-gray-400'}`}>
                                    {pl.movie_count || 0}
                                </span>
                            </button>
                        );
                    })}
                </div>

                {(activePlaylistTab === 'favorites' ? loadingFavs : loadingPlaylistMovies) ? (
                    <div className="flex justify-center py-20">
                        <div className="animate-spin rounded-full h-10 w-10 border-t-2 border-red-600"></div>
                    </div>
                ) : (activePlaylistTab === 'favorites' ? favorites : playlistMovies).length > 0 ? (
                    <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 xl:grid-cols-6 gap-4 gap-y-8">
                        {(activePlaylistTab === 'favorites' ? favorites : playlistMovies).map((movie) => (
                            <div key={movie._id || movie.slug} className="relative group">
                                <MovieCard movie={movie} />
                                <button
                                    type="button"
                                    aria-label={`Gỡ ${movie.name} khỏi danh sách`}
                                    title="Gỡ khỏi danh sách này"
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
                        <p className="text-xl font-bold text-gray-400">Danh sách này đang trống</p>
                        <button onClick={() => navigate('/')} className="mt-6 bg-red-600 px-8 py-3 rounded-full font-bold hover:bg-red-700 transition text-white shadow-lg">
                            Khám phá ngay
                        </button>
                    </div>
                )}
            </div>

            {/* Mục Giao Diện & Preview */}
            <div className="container mx-auto px-4 md:px-12 mt-16">
                <div className="mb-8 flex items-end justify-between border-b border-white/10 pb-4">
                    <div>
                        <h2 className="text-2xl font-bold text-white flex items-center gap-3">
                            <FaPalette className="text-red-600" /> Cá Nhân Hóa Giao Diện
                        </h2>
                        <p className="text-xs text-gray-400 mt-1">Tùy biến bảng màu, thanh tiến trình trình phát và kiểu hiển thị theo sở thích của bạn.</p>
                    </div>
                    <span className="text-xs font-bold text-gray-500 hidden sm:inline">Tự lưu theo tài khoản</span>
                </div>
                <div className="max-w-4xl">
                    <ThemeSettings 
                        theme={theme} 
                        setTheme={setTheme} 
                        resetTheme={resetTheme} 
                        presets={themePresets} 
                        onReset={() => setToast({ type: 'success', message: 'Đã đặt lại giao diện mặc định.' })} 
                    />
                </div>
            </div>

            {/* Modal Cài đặt tài khoản & Hồ sơ */}
            {showEdit && (
                <div className="fixed inset-0 z-[20000] flex items-center justify-center p-4 bg-black/90 backdrop-blur-md animate-fade-in">
                    <div className="bg-[#0a0f1d] w-full max-w-4xl h-[700px] rounded-2xl border border-white/15 shadow-2xl overflow-hidden flex flex-col md:flex-row relative">
                        <button 
                            onClick={() => setShowEdit(false)} 
                            className="absolute top-4 right-4 text-gray-400 hover:text-white z-50 p-2 rounded-full hover:bg-white/10 transition"
                        >
                            <FaTimes size={18}/>
                        </button>
                        
                        {/* Sidebar Tabs */}
                        <div className="w-full md:w-64 bg-black/40 border-b md:border-b-0 md:border-r border-white/10 p-5 flex flex-col">
                            <div className="mb-6">
                                <h3 className="text-lg font-black text-white tracking-wide">Cài đặt tài khoản</h3>
                                <p className="text-xs text-gray-400 mt-0.5">Quản lý hồ sơ & giao diện</p>
                            </div>
                            <div className="space-y-1.5 flex-1">
                                {[
                                    { id: 'info', icon: FaIdCard, label: 'Thông tin chung' },
                                    { id: 'avatar', icon: FaImage, label: 'Ảnh & Khung avatar' },
                                    { id: 'banner', icon: FaCamera, label: 'Ảnh bìa Banner' },
                                    { id: 'password', icon: FaLock, label: 'Mật khẩu bảo mật' },
                                    { id: 'theme', icon: FaPalette, label: 'Giao diện & Preview' }
                                ].map(tab => (
                                    <button 
                                        key={tab.id} 
                                        onClick={() => setActiveTab(tab.id)} 
                                        className={`w-full text-left px-3.5 py-3 rounded-xl font-bold text-sm transition flex items-center gap-3 ${activeTab === tab.id ? 'bg-white text-black shadow-lg' : 'text-gray-300 hover:bg-white/5 hover:text-white'}`}
                                    >
                                        <tab.icon className="text-base" /> {tab.label}
                                    </button>
                                ))}
                            </div>
                        </div>

                        {/* Content Area */}
                        <div className="flex-1 bg-transparent relative flex flex-col">
                            <div className="flex-1 overflow-y-auto custom-scrollbar p-6 md:p-8">
                                <form onSubmit={handleUpdate} id="profile-form">
                                    {/* Tab 1: Thông tin chung & Quyền riêng tư */}
                                    {activeTab === 'info' && (
                                        <div className="space-y-6 animate-fade-in">
                                            <div>
                                                <h2 className="text-2xl font-black text-white mb-1">Thông tin chung</h2>
                                                <p className="text-xs text-gray-400">Tên hiển thị và quyền riêng tư của hồ sơ</p>
                                            </div>
                                            <div>
                                                <label className="block text-xs font-bold text-gray-400 uppercase tracking-wider mb-2">Tên hiển thị</label>
                                                <input 
                                                    type="text" 
                                                    className="w-full bg-white/5 border border-white/10 rounded-xl py-3.5 px-4 text-white focus:border-red-600 outline-none transition font-medium" 
                                                    value={formData.fullname} 
                                                    onChange={(e) => setFormData({...formData, fullname: e.target.value})} 
                                                />
                                            </div>
                                            <div>
                                                <label className="block text-xs font-bold text-gray-400 uppercase tracking-wider mb-2">Email đăng ký</label>
                                                <input 
                                                    type="text" 
                                                    disabled 
                                                    className="w-full bg-black/40 border border-transparent rounded-xl py-3.5 px-4 text-gray-500 cursor-not-allowed font-medium" 
                                                    value={user.email} 
                                                />
                                            </div>

                                            {/* Công tắc Public / Private Profile */}
                                            <div className="pt-4 border-t border-white/10">
                                                <div className="flex items-center justify-between gap-4 p-4 rounded-xl bg-white/5 border border-white/10">
                                                    <div>
                                                        <div className="flex items-center gap-2">
                                                            <p className="font-bold text-sm text-white">Chế độ hồ sơ công khai</p>
                                                            <span className={`text-[10px] font-bold px-2 py-0.5 rounded-full ${formData.is_public ? 'bg-emerald-950 text-emerald-400' : 'bg-gray-800 text-gray-400'}`}>
                                                                {formData.is_public ? 'Công khai' : 'Riêng tư'}
                                                            </span>
                                                        </div>
                                                        <p className="text-xs text-gray-400 mt-1">Cho phép mọi người xem danh sách phim yêu thích, cấp độ và ảnh bìa khi truy cập trang cá nhân của bạn.</p>
                                                    </div>
                                                    <button
                                                        type="button"
                                                        role="switch"
                                                        aria-checked={formData.is_public}
                                                        onClick={() => setFormData(prev => ({ ...prev, is_public: !prev.is_public }))}
                                                        className={`relative shrink-0 w-12 h-6 rounded-full transition-colors ${formData.is_public ? 'bg-emerald-500' : 'bg-white/20'}`}
                                                    >
                                                        <span className={`absolute top-0.5 w-5 h-5 rounded-full bg-white shadow transition-all ${formData.is_public ? 'left-[26px]' : 'left-0.5'}`} />
                                                    </button>
                                                </div>
                                            </div>
                                        </div>
                                    )}

                                    {/* Tab 2: Ảnh đại diện & Khung Avatar */}
                                    {activeTab === 'avatar' && (
                                        <div className="space-y-6 animate-fade-in">
                                            <div>
                                                <h2 className="text-2xl font-black text-white mb-1">Ảnh đại diện & Khung viền</h2>
                                                <p className="text-xs text-gray-400">Chọn ảnh đại diện và khung avatar mở khóa theo cấp độ xem phim</p>
                                            </div>
                                            
                                            {/* Preview avatar hiện tại */}
                                            <div className="flex items-center gap-6 p-4 rounded-xl bg-white/5 border border-white/10">
                                                <div className="w-24 h-24 rounded-full flex items-center justify-center">
                                                    <UserAvatar 
                                                        user={{ fullname: formData.fullname, avatar: formData.avatar, current_frame: formData.current_frame }} 
                                                        frame={formData.current_frame}
                                                        className="w-20 h-20" 
                                                    />
                                                </div>
                                                <div 
                                                    onClick={() => fileInputRef.current.click()} 
                                                    className="flex-1 border-2 border-dashed border-white/20 rounded-xl h-20 flex flex-col items-center justify-center cursor-pointer hover:border-red-500 hover:bg-red-500/5 transition group"
                                                >
                                                    <FaCloudUploadAlt className="text-2xl text-gray-400 group-hover:text-red-500 mb-1" />
                                                    <p className="text-xs text-gray-300 font-bold">Tải ảnh đại diện riêng (Max 5MB)</p>
                                                    <input ref={fileInputRef} type="file" accept="image/*" className="hidden" onChange={handleFileUpload} />
                                                </div>
                                            </div>

                                            {/* Bộ sưu tập Khung Avatar mở khóa theo cấp */}
                                            <div>
                                                <div className="flex items-center justify-between mb-3">
                                                    <p className="text-xs font-bold text-gray-400 uppercase tracking-wider">Khung viền Avatar (Mở khóa theo Cấp độ):</p>
                                                    <span className="text-xs font-bold text-yellow-400">Bạn đang ở Cấp {levelInfo.level}</span>
                                                </div>
                                                <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
                                                    {AVATAR_FRAMES.map((f) => {
                                                        const isUnlocked = levelInfo.level >= f.minLevel;
                                                        const isSelected = formData.current_frame === f.id;
                                                        return (
                                                            <div 
                                                                key={f.id}
                                                                onClick={() => {
                                                                    if (isUnlocked) handleSelectFrame(f.id);
                                                                }}
                                                                className={`p-3 rounded-xl border transition flex items-center gap-3 relative ${isUnlocked ? 'cursor-pointer hover:bg-white/10' : 'opacity-40 cursor-not-allowed bg-black/40'} ${isSelected ? 'border-yellow-400 bg-white/10 shadow-lg' : 'border-white/10 bg-white/5'}`}
                                                            >
                                                                <div className={`w-10 h-10 rounded-full flex items-center justify-center bg-gray-800 ${f.ringClass}`}>
                                                                    <UserAvatar user={{ fullname: formData.fullname, avatar: formData.avatar }} className="w-8 h-8" />
                                                                </div>
                                                                <div className="flex-1 min-w-0">
                                                                    <p className="font-bold text-xs text-white truncate">{f.name}</p>
                                                                    <p className="text-[10px] text-gray-400">{isUnlocked ? f.desc : `Cần Cấp ${f.minLevel}`}</p>
                                                                </div>
                                                                {isSelected && <FaCheckCircle className="text-yellow-400 text-sm shrink-0" />}
                                                                {!isUnlocked && <FaLock className="text-gray-500 text-xs shrink-0" />}
                                                            </div>
                                                        );
                                                    })}
                                                </div>
                                            </div>

                                            {/* Nhân vật mẫu */}
                                            <div>
                                                <p className="text-xs font-bold text-gray-400 uppercase tracking-wider mb-3">Ảnh nhân vật Anime / Siêu anh hùng mẫu:</p>
                                                <div className="grid grid-cols-4 sm:grid-cols-8 gap-2.5">
                                                    {PRESET_AVATARS.map((char, idx) => (
                                                        <div 
                                                            key={idx} 
                                                            onClick={() => { setFormData({...formData, avatar: char.url}); setSelectedFile(null); }} 
                                                            className={`relative aspect-square rounded-xl overflow-hidden cursor-pointer border-2 transition group ${formData.avatar === char.url ? 'border-red-600 scale-105 shadow-lg shadow-red-900/40' : 'border-transparent hover:border-white/30'}`}
                                                        >
                                                            <img src={char.url} alt={char.name} className="w-full h-full object-cover" />
                                                            {formData.avatar === char.url && <div className="absolute top-1 right-1 bg-red-600 rounded-full p-0.5"><FaCheckCircle size={10} /></div>}
                                                        </div>
                                                    ))}
                                                </div>
                                            </div>
                                        </div>
                                    )}

                                    {/* Tab 3: Ảnh bìa Banner */}
                                    {activeTab === 'banner' && (
                                        <div className="space-y-6 animate-fade-in">
                                            <div>
                                                <h2 className="text-2xl font-black text-white mb-1">Ảnh bìa trang cá nhân</h2>
                                                <p className="text-xs text-gray-400">Tùy biến hình nền rạp phim phong cách của riêng bạn</p>
                                            </div>

                                            {/* Xem trước ảnh bìa */}
                                            <div className="relative aspect-[21/9] rounded-xl overflow-hidden border border-white/15 bg-black shadow-xl">
                                                {formData.banner_url ? (
                                                    <img src={formData.banner_url} alt="Banner Preview" className="w-full h-full object-cover" />
                                                ) : (
                                                    <div className="w-full h-full bg-gradient-to-r from-slate-900 to-indigo-950 flex items-center justify-center text-gray-500 text-xs font-bold">
                                                        Chưa có ảnh bìa
                                                    </div>
                                                )}
                                                <div className="absolute inset-0 bg-gradient-to-t from-black/80 via-transparent to-transparent flex items-end p-4">
                                                    <p className="text-xs font-bold text-white drop-shadow">Xem trước hiển thị ảnh bìa</p>
                                                </div>
                                            </div>

                                            {/* Nút upload banner */}
                                            <div 
                                                onClick={() => bannerInputRef.current.click()} 
                                                className="border-2 border-dashed border-white/20 rounded-xl p-5 flex flex-col items-center justify-center cursor-pointer hover:border-red-500 hover:bg-red-500/5 transition group"
                                            >
                                                <FaCloudUploadAlt className="text-3xl text-gray-400 group-hover:text-red-500 mb-1.5" />
                                                <p className="text-xs text-gray-200 font-bold">Tải ảnh bìa lên từ máy tính (Khuyên dùng tỉ lệ 16:9, dưới 5MB)</p>
                                                <input ref={bannerInputRef} type="file" accept="image/*" className="hidden" onChange={handleBannerUpload} />
                                            </div>

                                            {/* Danh sách ảnh bìa mẫu có sẵn */}
                                            <div>
                                                <p className="text-xs font-bold text-gray-400 uppercase tracking-wider mb-3">Hoặc chọn nhanh từ thư viện ảnh phim đẹp mắt:</p>
                                                <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
                                                    {PRESET_BANNERS.map((b, idx) => (
                                                        <div 
                                                            key={idx}
                                                            onClick={() => { setFormData({...formData, banner_url: b.url}); setSelectedBannerFile(null); }}
                                                            className={`relative aspect-[16/9] rounded-xl overflow-hidden cursor-pointer border-2 transition group ${formData.banner_url === b.url ? 'border-red-600 scale-[1.02] shadow-lg' : 'border-white/10 hover:border-white/30'}`}
                                                        >
                                                            <img src={b.url} alt={b.name} className="w-full h-full object-cover group-hover:scale-105 transition-transform" />
                                                            <div className="absolute inset-0 bg-gradient-to-t from-black/90 to-transparent flex items-end p-2">
                                                                <span className="text-[11px] font-bold text-white truncate drop-shadow">{b.name}</span>
                                                            </div>
                                                            {formData.banner_url === b.url && (
                                                                <div className="absolute top-1.5 right-1.5 bg-red-600 rounded-full p-1 text-white shadow">
                                                                    <FaCheckCircle size={11} />
                                                                </div>
                                                            )}
                                                        </div>
                                                    ))}
                                                </div>
                                            </div>
                                        </div>
                                    )}

                                    {/* Tab 4: Mật khẩu */}
                                    {activeTab === 'password' && (
                                        <div className="space-y-6 animate-fade-in">
                                            <div>
                                                <h2 className="text-2xl font-black text-white mb-1">Bảo mật tài khoản</h2>
                                                <p className="text-xs text-gray-400">Đổi mật khẩu định kỳ để bảo vệ tài khoản của bạn</p>
                                            </div>
                                            <div className="space-y-4">
                                                <div>
                                                    <label className="block text-xs font-bold text-gray-400 uppercase tracking-wider mb-2">Mật khẩu hiện tại</label>
                                                    <input 
                                                        type="password" 
                                                        placeholder="Nhập mật khẩu hiện tại..." 
                                                        className="w-full bg-white/5 border border-white/10 rounded-xl py-3.5 px-4 text-white focus:border-red-600 outline-none transition" 
                                                        value={formData.currentPassword} 
                                                        onChange={(e) => setFormData({...formData, currentPassword: e.target.value})} 
                                                    />
                                                </div>
                                                <div>
                                                    <label className="block text-xs font-bold text-gray-400 uppercase tracking-wider mb-2">Mật khẩu mới</label>
                                                    <input 
                                                        type="password" 
                                                        placeholder="Mật khẩu mới (tối thiểu 6 ký tự)" 
                                                        className="w-full bg-white/5 border border-white/10 rounded-xl py-3.5 px-4 text-white focus:border-red-600 outline-none transition" 
                                                        value={formData.newPassword} 
                                                        onChange={(e) => setFormData({...formData, newPassword: e.target.value})} 
                                                    />
                                                </div>
                                                <div>
                                                    <label className="block text-xs font-bold text-gray-400 uppercase tracking-wider mb-2">Xác nhận mật khẩu mới</label>
                                                    <input 
                                                        type="password" 
                                                        placeholder="Nhập lại mật khẩu mới" 
                                                        className="w-full bg-white/5 border border-white/10 rounded-xl py-3.5 px-4 text-white focus:border-red-600 outline-none transition" 
                                                        value={formData.confirmPassword} 
                                                        onChange={(e) => setFormData({...formData, confirmPassword: e.target.value})} 
                                                    />
                                                </div>
                                            </div>
                                        </div>
                                    )}

                                    {/* Tab 5: Giao diện */}
                                    {activeTab === 'theme' && (
                                        <ThemeSettings 
                                            theme={theme} 
                                            setTheme={setTheme} 
                                            resetTheme={resetTheme} 
                                            presets={themePresets} 
                                            onReset={() => setToast({ type: 'success', message: 'Đã đặt lại giao diện mặc định.' })} 
                                        />
                                    )}
                                </form>
                            </div>

                            {/* Footer nút Lưu */}
                            <div className="p-5 border-t border-white/10 flex justify-end bg-black/30 backdrop-blur-md">
                                {activeTab === 'theme' ? (
                                    <span className="text-xs font-bold text-gray-400 flex items-center gap-2">
                                        <FaCheckCircle className="text-green-400" /> Giao diện tự động áp dụng và lưu tức thì
                                    </span>
                                ) : (
                                    <button 
                                        onClick={handleUpdate} 
                                        disabled={isSaving} 
                                        className="bg-red-600 hover:bg-red-700 text-white font-bold py-3 px-8 rounded-xl shadow-lg shadow-red-900/30 transition flex items-center gap-2 disabled:opacity-50 active:scale-95"
                                    >
                                        {isSaving ? (
                                            <><div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin"></div> Đang lưu...</>
                                        ) : (
                                            <><FaSave /> Lưu Thay Đổi</>
                                        )}
                                    </button>
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
