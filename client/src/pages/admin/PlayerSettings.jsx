import React, { useEffect, useState } from 'react';
import { FaPlay, FaSave, FaTrashAlt, FaExclamationTriangle, FaCheckCircle, FaTimesCircle, FaKey } from 'react-icons/fa';
import { getPlayerSettings, updatePlayerSettings } from '../../services/adminService';

// --- TOAST NOTIFICATION (theo mẫu MovieDetail.jsx) ---
const Toast = ({ message, type = 'success', onClose }) => {
    useEffect(() => {
        const t = setTimeout(onClose, type === 'error' ? 5000 : 3000);
        return () => clearTimeout(t);
    }, [onClose, type]);

    const isError = type === 'error';
    return (
        <div className={`fixed top-20 right-4 z-[200] bg-black/80 backdrop-blur-md border-l-4 ${isError ? 'border-red-500' : 'border-green-500'} text-white px-6 py-4 rounded-lg shadow-2xl flex items-center gap-3 animate-fade-in-down max-w-[90vw]`}>
            <div className={`${isError ? 'bg-red-500' : 'bg-green-500'} p-1.5 rounded-full`}>
                {isError ? <FaTimesCircle className="text-white text-xs" /> : <FaCheckCircle className="text-white text-xs" />}
            </div>
            <span className="text-sm font-bold">{message}</span>
        </div>
    );
};

// --- VỊ TRÍ LOGO (theo mẫu vsphim-core) ---
const LOGO_POSITIONS = [
    { value: 'top-left', label: 'Góc trên trái' },
    { value: 'top-right', label: 'Góc trên phải' },
    { value: 'bottom-left', label: 'Góc dưới trái' },
    { value: 'bottom-right', label: 'Góc dưới phải' },
    { value: 'control-bar', label: 'Thanh trình chiếu' },
];

// Khung minh họa vị trí: 1 khung hình chữ nhật nhỏ + 1 vuông đỏ ở vị trí tương ứng
// (control-bar: 1 thanh ngang ở đáy khung)
const PositionPreview = ({ value, selected }) => {
    const dotClass = 'absolute w-3 h-3 bg-red-600 rounded-[2px] shadow';
    const posClass = {
        'top-left': 'top-1.5 left-1.5',
        'top-right': 'top-1.5 right-1.5',
        'bottom-left': 'bottom-1.5 left-1.5',
        'bottom-right': 'bottom-1.5 right-1.5',
    }[value];

    return (
        <div className={`relative w-full aspect-video bg-black/60 border rounded-lg overflow-hidden ${selected ? 'border-red-600' : 'border-white/15'}`}>
            {value === 'control-bar' ? (
                <div className="absolute left-0 right-0 bottom-0 h-3 bg-red-600/90 flex items-center justify-center">
                    <span className="text-[8px] font-bold text-white leading-none">CONTROL BAR</span>
                </div>
            ) : (
                <div className={`${dotClass} ${posClass}`} />
            )}
            {/* Vạch giữa khung cho dễ hình dung tỉ lệ màn hình */}
            <div className="absolute inset-0 flex items-center justify-center pointer-events-none">
                <span className="text-[10px] font-bold text-white/25">16 : 9</span>
            </div>
        </div>
    );
};

const DEFAULT_FORM = {
    player_license: '',
    player_logo_file: '',
    player_logo_link: '',
    player_logo_position: 'top-right',
    player_vast_file: '',
    player_vast_skipoffset: '5',
};

const isValidUrl = (value) => {
    if (!value) return true;
    try {
        const u = new URL(value);
        return u.protocol === 'http:' || u.protocol === 'https:';
    } catch {
        return false;
    }
};

// --- MAIN COMPONENT ---
const PlayerSettings = () => {
    const [form, setForm] = useState(DEFAULT_FORM);
    const [loading, setLoading] = useState(true);
    const [saving, setSaving] = useState(false);
    const [loadError, setLoadError] = useState('');
    const [formError, setFormError] = useState('');
    const [toast, setToast] = useState(null); // { message, type }
    const [logoImgError, setLogoImgError] = useState(false);

    const showToast = (message, type = 'success') => setToast({ message, type });

    const fetchSettings = async () => {
        setLoading(true);
        setLoadError('');
        try {
            const res = await getPlayerSettings();
            const player = res?.player || res || {};
            setForm({
                player_license: player.player_license ?? '',
                player_logo_file: player.player_logo_file ?? '',
                player_logo_link: player.player_logo_link ?? '',
                player_logo_position: player.player_logo_position || 'top-right',
                player_vast_file: player.player_vast_file ?? '',
                player_vast_skipoffset: player.player_vast_skipoffset ?? '5',
            });
        } catch (error) {
            // API chưa sẵn (404) hoặc lỗi mạng: giữ giá trị mặc định để vẫn xem/sửa được giao diện
            setLoadError(error.response?.data?.message || 'Không tải được cài đặt hiện tại (API chưa sẵn sàng). Đang hiển thị giá trị mặc định.');
        } finally {
            setLoading(false);
        }
    };

    useEffect(() => { fetchSettings(); }, []);

    // Reset trạng thái lỗi ảnh mỗi khi URL logo đổi
    useEffect(() => { setLogoImgError(false); }, [form.player_logo_file]);

    const setField = (key, value) => {
        setForm((prev) => ({ ...prev, [key]: value }));
        setFormError('');
    };

    const handleClearLogo = () => setField('player_logo_file', '');

    const handleSave = async () => {
        setFormError('');

        // --- Validate nhẹ ở client trước khi gửi ---
        const skip = String(form.player_vast_skipoffset).trim();
        if (skip === '' || !/^\d+$/.test(skip) || Number(skip) < 0) {
            const msg = 'Thời gian cho bỏ qua quảng cáo phải là số nguyên >= 0 (giây).';
            setFormError(msg);
            showToast(msg, 'error');
            return;
        }
        const urlFields = [
            { key: 'player_logo_file', label: 'URL ảnh logo' },
            { key: 'player_logo_link', label: 'Link khi bấm logo' },
            { key: 'player_vast_file', label: 'URL file VAST' },
        ];
        for (const { key, label } of urlFields) {
            const v = String(form[key] || '').trim();
            if (v && !isValidUrl(v)) {
                const msg = `${label} không đúng dạng URL (phải bắt đầu bằng http:// hoặc https://).`;
                setFormError(msg);
                showToast(msg, 'error');
                return;
            }
        }

        setSaving(true);
        try {
            const payload = {
                player_license: String(form.player_license || '').trim(),
                player_logo_file: String(form.player_logo_file || '').trim(),
                player_logo_link: String(form.player_logo_link || '').trim(),
                player_logo_position: form.player_logo_position,
                player_vast_file: String(form.player_vast_file || '').trim(),
                player_vast_skipoffset: skip,
            };
            await updatePlayerSettings(payload);
            showToast('Đã lưu cài đặt trình phát', 'success');
        } catch (error) {
            // Service đã ném message từ backend (vd: 400 validate)
            const msg = typeof error === 'string' ? error : (error?.message || 'Lỗi lưu cài đặt trình phát');
            setFormError(msg);
            showToast(msg, 'error');
        } finally {
            setSaving(false);
        }
    };

    const inputClass = 'w-full bg-[#111] border border-white/20 rounded-lg px-4 py-2.5 text-sm text-white placeholder-gray-500 focus:border-red-600 focus:outline-none transition';
    const logoUrlValid = form.player_logo_file.trim() !== '' && isValidUrl(form.player_logo_file.trim());

    return (
        <div>
            {/* Header */}
            <div className="flex flex-col md:flex-row justify-between items-start md:items-center mb-6 gap-4">
                <h1 className="text-2xl font-black text-white border-l-4 border-red-600 pl-3 flex items-center gap-2">
                    <FaPlay className="text-red-600 text-xl" /> Trình phát
                </h1>
            </div>

            {/* GHI CHÚ QUAN TRỌNG: setting chưa có tác dụng với iframe vsmov hiện tại */}
            <div className="mb-6 bg-amber-500/10 border border-amber-500/50 rounded-xl px-5 py-4 flex items-start gap-3">
                <FaExclamationTriangle className="text-amber-400 text-xl shrink-0 mt-0.5" />
                <p className="text-amber-200 text-sm md:text-base font-bold leading-relaxed">
                    Các cài đặt này sẽ áp dụng khi trình phát riêng được triển khai. Hiện web đang dùng iframe của vsmov nên chưa có tác dụng.
                </p>
            </div>

            {loading ? (
                <div className="bg-[#161616] rounded-xl border border-white/10 p-10 text-center text-gray-400 text-sm">Đang tải cài đặt trình phát...</div>
            ) : (
                <div className="bg-[#161616] rounded-xl border border-white/10 shadow-lg p-6 md:p-8 space-y-8 max-w-3xl">
                    {loadError && (
                        <div className="bg-yellow-500/10 border border-yellow-500/40 text-yellow-200 text-sm rounded-lg px-4 py-3">{loadError}</div>
                    )}

                    {/* (1) LOGO PLAYER */}
                    <section>
                        <label className="block text-sm font-bold text-white mb-2">Logo trình phát</label>
                        <div className="flex gap-2">
                            <input
                                type="text"
                                className={inputClass}
                                placeholder="https://example.com/logo.png"
                                value={form.player_logo_file}
                                onChange={(e) => setField('player_logo_file', e.target.value)}
                            />
                            {form.player_logo_file && (
                                <button onClick={handleClearLogo} className="shrink-0 px-4 py-2 bg-white/5 hover:bg-red-600/20 border border-white/10 hover:border-red-600/50 text-gray-300 hover:text-red-400 rounded-lg text-sm font-bold transition flex items-center gap-2" title="Xóa logo">
                                    <FaTrashAlt /> Xóa logo
                                </button>
                            )}
                        </div>
                        {/* Xem trước ảnh ngay bên dưới (chỉ khi URL hợp lệ) */}
                        {logoUrlValid && (
                            <div className="mt-3">
                                {logoImgError ? (
                                    <p className="text-sm text-red-400 font-bold">Không tải được ảnh</p>
                                ) : (
                                    <div className="inline-block bg-black/60 border border-white/10 rounded-lg p-3">
                                        <img
                                            src={form.player_logo_file.trim()}
                                            alt="Xem trước logo trình phát"
                                            className="max-h-16 max-w-full object-contain"
                                            onError={() => setLogoImgError(true)}
                                            onLoad={() => setLogoImgError(false)}
                                        />
                                        <p className="text-xs text-gray-500 mt-2">Xem trước logo</p>
                                    </div>
                                )}
                            </div>
                        )}
                    </section>

                    {/* (2) LINK KHI BẤM LOGO */}
                    <section>
                        <label className="block text-sm font-bold text-white mb-2">Link khi bấm logo</label>
                        <input
                            type="text"
                            className={inputClass}
                            placeholder="https://example.com"
                            value={form.player_logo_link}
                            onChange={(e) => setField('player_logo_link', e.target.value)}
                        />
                        <p className="text-xs text-gray-500 mt-2">Địa chỉ sẽ mở ra khi người xem bấm vào logo trên trình phát. Để trống nếu không cần.</p>
                    </section>

                    {/* (3) VỊ TRÍ LOGO */}
                    <section>
                        <label className="block text-sm font-bold text-white mb-3">Vị trí logo</label>
                        <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-5 gap-3">
                            {LOGO_POSITIONS.map((opt) => {
                                const selected = form.player_logo_position === opt.value;
                                return (
                                    <label
                                        key={opt.value}
                                        className={`cursor-pointer rounded-xl border p-2 transition ${selected ? 'border-red-600 bg-red-600/10' : 'border-white/10 bg-white/[0.02] hover:border-white/30'}`}
                                    >
                                        <input
                                            type="radio"
                                            name="player_logo_position"
                                            value={opt.value}
                                            checked={selected}
                                            onChange={() => setField('player_logo_position', opt.value)}
                                            className="sr-only"
                                        />
                                        <PositionPreview value={opt.value} selected={selected} />
                                        <span className={`block text-center text-xs font-bold mt-2 ${selected ? 'text-white' : 'text-gray-400'}`}>{opt.label}</span>
                                    </label>
                                );
                            })}
                        </div>
                    </section>

                    {/* (4) QUẢNG CÁO VAST */}
                    <section>
                        <label className="block text-sm font-bold text-white mb-2">Quảng cáo VAST (URL file VAST)</label>
                        <input
                            type="text"
                            className={inputClass}
                            placeholder="https://example.com/vast.xml"
                            value={form.player_vast_file}
                            onChange={(e) => setField('player_vast_file', e.target.value)}
                        />
                        <p className="text-xs text-gray-500 mt-2">Để trống nếu không chạy quảng cáo VAST.</p>
                    </section>

                    {/* (5) THỜI GIAN CHO BỎ QUA QUẢNG CÁO */}
                    <section>
                        <label className="block text-sm font-bold text-white mb-2">Thời gian cho bỏ qua quảng cáo (giây)</label>
                        <input
                            type="number"
                            min="0"
                            step="1"
                            className={`${inputClass} max-w-xs`}
                            placeholder="5"
                            value={form.player_vast_skipoffset}
                            onChange={(e) => setField('player_vast_skipoffset', e.target.value)}
                        />
                        <p className="text-xs text-gray-500 mt-2">Số giây người xem phải chờ trước khi được bỏ qua quảng cáo. Nhập 0 để cho bỏ qua ngay.</p>
                    </section>

                    {/* (6) LICENSE JWPLAYER */}
                    <section>
                        <label className="block text-sm font-bold text-white mb-2 flex items-center gap-2">
                            <FaKey className="text-gray-400 text-xs" /> License JWPlayer
                        </label>
                        <input
                            type="text"
                            className={inputClass}
                            placeholder="Để trống nếu không dùng JWPlayer bản quyền"
                            value={form.player_license}
                            onChange={(e) => setField('player_license', e.target.value)}
                        />
                        <p className="text-xs text-gray-500 mt-2">Key mặc định lấy từ repo vsphim (key chia sẻ). Để dùng chính thức nên mua license JWPlayer riêng hoặc chuyển sang hls.js.</p>
                    </section>

                    {/* Lỗi validate / lỗi backend */}
                    {formError && (
                        <div className="bg-red-600/10 border border-red-600/50 text-red-300 text-sm font-bold rounded-lg px-4 py-3 flex items-start gap-2">
                            <FaTimesCircle className="shrink-0 mt-0.5" /> <span>{formError}</span>
                        </div>
                    )}

                    {/* Nút Lưu */}
                    <div className="flex items-center gap-3 pt-2 border-t border-white/10">
                        <button
                            onClick={handleSave}
                            disabled={saving}
                            className="px-6 py-3 bg-red-600 hover:bg-red-700 disabled:opacity-50 disabled:cursor-not-allowed text-white rounded-xl font-bold text-sm transition flex items-center gap-2 shadow-lg shadow-red-900/30"
                        >
                            <FaSave /> {saving ? 'Đang lưu...' : 'Lưu cài đặt'}
                        </button>
                        <button
                            onClick={fetchSettings}
                            disabled={saving || loading}
                            className="px-5 py-3 bg-white/5 hover:bg-white/10 border border-white/10 text-gray-300 rounded-xl font-bold text-sm transition disabled:opacity-50"
                        >
                            Tải lại
                        </button>
                    </div>
                </div>
            )}

            {toast && <Toast message={toast.message} type={toast.type} onClose={() => setToast(null)} />}
        </div>
    );
};

export default PlayerSettings;
