// Nhóm B — Custom UI (23/11/2026): ThemeContext.
// Hợp đồng với nhóm A (backend), C (cài đặt ở Hồ sơ), D (card/hàng):
//   file: client/src/context/ThemeContext.jsx
//   export: ThemeProvider, useTheme
//   useTheme() -> { theme, setTheme, resetTheme, presets }
//   theme = object ĐẦY ĐỦ (gồm cả màu đã suy ra: background, surface,
//   text, textMuted, border) + các trường đã lưu (preset, accent, radius,
//   fontSize, density, hiddenRows, animations, glass).
//   localStorage key (khách): 'phimviethay-theme'
//   Backend: GET /auth/me trả thêm `theme`; PATCH /user/theme {theme} (JWT).
// CSS variables đặt trên documentElement (nhóm C/D dùng đúng tên này):
//   --accent, --bg, --surface, --text, --text-muted, --border,
//   --card-radius, --font-size-base, --card-gap
//   (+ phụ: --accent-hover, --accent-rgb, --text-on-accent)
//   data-density ("compact"|"comfortable"), data-animations ("on"|"off"),
//   data-glass ("on"|"off") trên documentElement.
// Lưu ý: web CHỈ dark mode, preset toàn tối. Auto-contrast (luminance)
// là "lưới an toàn": nếu nền bị set sáng thì chữ tự đổi sang đen.

import React, {
    createContext,
    useCallback,
    useContext,
    useEffect,
    useMemo,
    useRef,
    useState,
} from 'react';
import axios from '../services/axiosConfig';
import { getMe } from '../services/authService';

export const THEME_STORAGE_KEY = 'phimviethay-theme';

// Màu đỏ hiện tại của site (tailwind 'phim-accent' #e50914 — Netflix Red).
export const DEFAULT_ACCENT = '#E50914';

export const DEFAULT_THEME = Object.freeze({
    preset: 'crimson',
    accent: DEFAULT_ACCENT,
    radius: 'medium',       // square | medium | round (Card Style)
    buttonShape: 'pill',    // pill | rounded | tech (Button / Playlist Shape)
    fontSize: 'medium',     // small | medium | large
    density: 'comfortable', // compact | comfortable
    hiddenRows: [],
    animations: true,
    glass: true,
    progressBar: 'accent',  // accent | crimson | cyberpunk | emerald | gold
});

// 6 preset tối: accent + background + surface + text trắng + textMuted + border.
// Nền mỗi preset đủ tối để chữ trắng đọc được (kiểm chứng bằng contrast).
export const PRESETS = [
    {
        id: 'crimson', name: 'Đỏ mặc định',
        accent: '#E50914', background: '#0A0E17', surface: '#141A26',
        text: '#FFFFFF', textMuted: '#9CA3AF', border: 'rgba(255,255,255,0.12)',
    },
    {
        id: 'ocean', name: 'Xanh dương',
        accent: '#3B82F6', background: '#081120', surface: '#0E1A2E',
        text: '#FFFFFF', textMuted: '#93A4BD', border: 'rgba(255,255,255,0.12)',
    },
    {
        id: 'violet', name: 'Tím',
        accent: '#8B5CF6', background: '#120A1E', surface: '#1C1230',
        text: '#FFFFFF', textMuted: '#A89CC4', border: 'rgba(255,255,255,0.12)',
    },
    {
        id: 'emerald', name: 'Xanh lá',
        accent: '#10B981', background: '#07130E', surface: '#0D1F16',
        text: '#FFFFFF', textMuted: '#8FB3A2', border: 'rgba(255,255,255,0.12)',
    },
    {
        id: 'amber', name: 'Vàng',
        accent: '#F59E0B', background: '#171006', surface: '#241A08',
        text: '#FFFFFF', textMuted: '#B3A586', border: 'rgba(255,255,255,0.12)',
    },
    {
        id: 'rose', name: 'Hồng',
        accent: '#EC4899', background: '#170A12', surface: '#25101D',
        text: '#FFFFFF', textMuted: '#C09AAD', border: 'rgba(255,255,255,0.12)',
    },
];

const RADIUS_PX = { square: '4px', medium: '12px', round: '20px' };
const BUTTON_RADIUS_PX = { tech: '4px', rounded: '12px', pill: '9999px' };
const FONT_SIZE_PX = { small: '14px', medium: '16px', large: '18px' };
const CARD_GAP_PX = { compact: '8px', comfortable: '16px' };

// ---------- Màu: luminance / contrast (WCAG) ----------

export function hexToRgb(hex) {
    if (!hex || typeof hex !== 'string') return null;
    let h = hex.trim().replace('#', '');
    if (h.length === 3) h = h.split('').map((c) => c + c).join('');
    if (h.length !== 6) return null;
    const n = parseInt(h, 16);
    if (Number.isNaN(n)) return null;
    return { r: (n >> 16) & 255, g: (n >> 8) & 255, b: n & 255 };
}

function toHex({ r, g, b }) {
    const c = (v) => Math.round(Math.max(0, Math.min(255, v))).toString(16).padStart(2, '0');
    return `#${c(r)}${c(g)}${c(b)}`;
}

/** Trộn 2 màu hex: mix(a, b, weight) = weight phần b + (1-weight) phần a. */
export function mixHex(a, b, weight) {
    const ca = hexToRgb(a);
    const cb = hexToRgb(b);
    if (!ca || !cb) return a;
    return toHex({
        r: ca.r + (cb.r - ca.r) * weight,
        g: ca.g + (cb.g - ca.g) * weight,
        b: ca.b + (cb.b - ca.b) * weight,
    });
}

function relativeLuminance(hex) {
    const c = hexToRgb(hex);
    if (!c) return 0;
    const f = (v) => {
        const s = v / 255;
        return s <= 0.03928 ? s / 12.92 : Math.pow((s + 0.055) / 1.055, 2.4);
    };
    return 0.2126 * f(c.r) + 0.7152 * f(c.g) + 0.0722 * f(c.b);
}

function contrastRatio(hexA, hexB) {
    const la = relativeLuminance(hexA);
    const lb = relativeLuminance(hexB);
    const hi = Math.max(la, lb);
    const lo = Math.min(la, lb);
    return (hi + 0.05) / (lo + 0.05);
}

/**
 * Auto-contrast: chọn màu chữ (trắng/đen) + chữ mờ sao cho đọc được
 * trên nền `background`. Đây là lưới an toàn — preset toàn tối nên
 * bình thường luôn ra trắng; chỉ khi nền bị set sáng (vd test #f5f5f5)
 * thì chữ mới tự đổi sang đen.
 */
export function pickTextColors(background) {
    const whiteOnBg = contrastRatio('#FFFFFF', background);
    const blackOnBg = contrastRatio('#111827', background);
    if (whiteOnBg >= blackOnBg) {
        return { text: '#FFFFFF', textMuted: '#9CA3AF' };
    }
    return { text: '#111827', textMuted: '#4B5563' };
}

// ---------- Suy ra theme đầy đủ từ theme đã lưu ----------

/**
 * raw có thể chứa thêm `background` / `surface` (ghi đè — dùng cho test
 * nền sáng; UI cài đặt của nhóm C không set 2 trường này).
 */
export function resolveTheme(raw) {
    const base = { ...DEFAULT_THEME, ...(raw || {}) };
    if (!Array.isArray(base.hiddenRows)) base.hiddenRows = [];
    const preset = PRESETS.find((p) => p.id === base.preset) || PRESETS[0];

    let accent;
    let background;
    let surface;
    if (base.preset === 'custom') {
        // Vòng tròn màu chỉ chọn màu nhấn; nền tự tính thành tông tối
        // hợp với màu nhấn (trộn accent với ~90% đen).
        accent = base.accent || DEFAULT_ACCENT;
        background = base.background || mixHex(accent, '#000000', 0.9);
        surface = base.surface || mixHex(background, '#FFFFFF', 0.07);
    } else {
        // Preset có sẵn: accent + nền lấy theo preset (accent trong raw
        // bị preset ghi đè — muốn accent tự do thì dùng preset "custom").
        accent = preset.accent;
        background = base.background || preset.background;
        surface = base.surface || preset.surface;
    }

    // Auto-contrast: chữ suy ra từ độ sáng nền, không tin mù preset.
    const { text, textMuted } = pickTextColors(background);
    const isLightBg = relativeLuminance(background) > 0.5;
    const border = base.border
        || (isLightBg ? 'rgba(0,0,0,0.14)' : 'rgba(255,255,255,0.12)');
    // Chữ trên nền accent (nút chính): trắng trừ khi accent quá sáng.
    const textOnAccent = contrastRatio('#FFFFFF', accent) >= contrastRatio('#111827', accent)
        ? '#FFFFFF' : '#111827';

    return {
        ...base,
        preset: base.preset === 'custom' ? 'custom' : preset.id,
        accent,
        background,
        surface,
        text,
        textMuted,
        border,
        textOnAccent,
        radiusPx: RADIUS_PX[base.radius] || RADIUS_PX.medium,
        buttonRadiusPx: BUTTON_RADIUS_PX[base.buttonShape] || BUTTON_RADIUS_PX.pill,
        fontSizePx: FONT_SIZE_PX[base.fontSize] || FONT_SIZE_PX.medium,
        gapPx: CARD_GAP_PX[base.density] || CARD_GAP_PX.comfortable,
    };
}

/** Áp theme đã resolve lên toàn trang (live preview). */
export function applyTheme(resolved) {
    if (typeof document === 'undefined') return;
    const el = document.documentElement;
    const accentRgb = hexToRgb(resolved.accent) || { r: 229, g: 9, b: 20 };
    el.style.setProperty('--accent', resolved.accent);
    el.style.setProperty('--accent-hover', mixHex(resolved.accent, '#000000', 0.14));
    el.style.setProperty('--accent-rgb', `${accentRgb.r}, ${accentRgb.g}, ${accentRgb.b}`);
    el.style.setProperty('--bg', resolved.background);
    el.style.setProperty('--surface', resolved.surface);
    el.style.setProperty('--text', resolved.text);
    el.style.setProperty('--text-muted', resolved.textMuted);
    el.style.setProperty('--border', resolved.border);
    el.style.setProperty('--text-on-accent', resolved.textOnAccent);
    el.style.setProperty('--card-radius', resolved.radiusPx);
    el.style.setProperty('--btn-radius', resolved.buttonRadiusPx);
    el.style.setProperty('--font-size-base', resolved.fontSizePx);
    el.style.setProperty('--card-gap', resolved.gapPx);
    const pb = resolved.progressBar || 'accent';
    const pbColor = pb === 'crimson' ? '#e50914'
        : pb === 'cyberpunk' ? 'linear-gradient(90deg, #ec4899, #8b5cf6)'
        : pb === 'emerald' ? '#10b981'
        : pb === 'gold' ? '#f59e0b'
        : resolved.accent;
    el.style.setProperty('--player-progress-color', pbColor);
    el.setAttribute('data-density', resolved.density === 'compact' ? 'compact' : 'comfortable');
    el.setAttribute('data-animations', resolved.animations === false ? 'off' : 'on');
    el.setAttribute('data-glass', resolved.glass === false ? 'off' : 'on');
}

function readLocalTheme() {
    try {
        const raw = localStorage.getItem(THEME_STORAGE_KEY);
        if (!raw) return null;
        const parsed = JSON.parse(raw);
        if (parsed && typeof parsed === 'object') return parsed;
        return null;
    } catch {
        return null;
    }
}

function parseAccountTheme(value) {
    if (!value) return null;
    if (typeof value === 'object') return value;
    if (typeof value === 'string') {
        try {
            const parsed = JSON.parse(value);
            return parsed && typeof parsed === 'object' ? parsed : null;
        } catch {
            return null;
        }
    }
    return null;
}

// ---------- Context ----------

const ThemeContext = createContext(null);

export function ThemeProvider({ children }) {
    // Khởi động đồng bộ từ localStorage để tránh nháy theme mặc định.
    const [rawTheme, setRawTheme] = useState(() => {
        const local = readLocalTheme();
        const initial = local || { ...DEFAULT_THEME };
        applyTheme(resolveTheme(initial));
        return initial;
    });
    const rawRef = useRef(rawTheme);
    const suppressPersistRef = useRef(false); // đổi do đồng bộ từ /me: không PATCH lại
    const saveTimerRef = useRef(null);
    const syncedOnceRef = useRef(false);

    const theme = useMemo(() => resolveTheme(rawTheme), [rawTheme]);

    // Áp ngay mỗi khi theme đổi (live preview).
    useEffect(() => {
        applyTheme(theme);
    }, [theme]);

    const persist = useCallback((raw) => {
        try {
            localStorage.setItem(THEME_STORAGE_KEY, JSON.stringify(raw));
        } catch {
            // localStorage đầy/bị chặn: theme vẫn áp trên trang, chỉ không lưu.
        }
        const token = localStorage.getItem('token') || localStorage.getItem('accessToken');
        if (!token) return;
        // PATCH lên tài khoản (debounce: kéo vòng tròn màu bắn rất nhiều event).
        if (saveTimerRef.current) clearTimeout(saveTimerRef.current);
        saveTimerRef.current = setTimeout(() => {
            axios.patch('/user/theme', { theme: raw }).catch(() => {
                // Backend nhóm A chưa deploy / theme chưa có cột: im lặng,
                // localStorage vẫn giữ theme (đồng bộ lại ở lần đăng nhập sau).
            });
        }, 600);
    }, []);

    // Lưu mỗi khi rawTheme đổi do người dùng (không lưu khi vừa đồng bộ từ /me).
    useEffect(() => {
        if (suppressPersistRef.current) {
            suppressPersistRef.current = false;
            return;
        }
        // Bỏ qua lần chạy đầu (raw đã đọc từ localStorage, chưa có gì mới).
        if (!syncedOnceRef.current) return;
        persist(rawRef.current);
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [rawTheme]);

    /**
     * Đồng bộ với tài khoản (luồng auth hiện tại của app: token trong
     * localStorage, user lấy qua getMe() -> GET /auth/me):
     *  - Tài khoản đã có theme -> theme tài khoản thắng, ghi đè local.
     *  - Tài khoản chưa có theme + khách đang có theme local
     *    (khác mặc định) -> PATCH 1 lần để lưu theme local lên tài khoản.
     *  - Chưa đăng nhập -> chỉ dùng localStorage.
     */
    const syncFromAccount = useCallback(async () => {
        const token = localStorage.getItem('token') || localStorage.getItem('accessToken');
        if (!token) return;
        let me = null;
        try {
            me = await getMe();
        } catch {
            return;
        }
        const accountTheme = parseAccountTheme(me?.theme);
        if (accountTheme) {
            suppressPersistRef.current = true;
            rawRef.current = accountTheme;
            setRawTheme(accountTheme);
            try {
                localStorage.setItem(THEME_STORAGE_KEY, JSON.stringify(accountTheme));
            } catch { /* bỏ qua */ }
            return;
        }
        // Tài khoản chưa có theme: đẩy theme local (nếu khác mặc định) lên 1 lần.
        const local = readLocalTheme();
        const isCustomized = local && JSON.stringify(local) !== JSON.stringify(DEFAULT_THEME);
        if (isCustomized) {
            axios.patch('/user/theme', { theme: local }).catch(() => {});
        }
    }, []);

    useEffect(() => {
        syncedOnceRef.current = true;
        syncFromAccount();
        // Đăng nhập/đăng xuất (authService dispatch event này) -> đồng bộ lại.
        const onAuthChanged = () => {
            if (localStorage.getItem('token') || localStorage.getItem('accessToken')) {
                syncFromAccount();
            } else {
                // Vừa đăng xuất: về theme khách trong localStorage (hoặc mặc định).
                const local = readLocalTheme();
                suppressPersistRef.current = true;
                rawRef.current = local || { ...DEFAULT_THEME };
                setRawTheme(rawRef.current);
            }
        };
        window.addEventListener('phimviethay:auth-changed', onAuthChanged);
        return () => {
            window.removeEventListener('phimviethay:auth-changed', onAuthChanged);
            if (saveTimerRef.current) clearTimeout(saveTimerRef.current);
        };
    }, [syncFromAccount]);

    const setTheme = useCallback((patch) => {
        if (!patch || typeof patch !== 'object') return;
        const next = { ...rawRef.current, ...patch };
        rawRef.current = next;
        setRawTheme(next);
    }, []);

    const resetTheme = useCallback(() => {
        const next = { ...DEFAULT_THEME };
        rawRef.current = next;
        setRawTheme(next);
    }, []);

    const value = useMemo(() => ({
        theme,
        rawTheme,
        setTheme,
        resetTheme,
        presets: PRESETS,
        syncFromAccount,
    }), [theme, rawTheme, setTheme, resetTheme, syncFromAccount]);

    return <ThemeContext.Provider value={value}>{children}</ThemeContext.Provider>;
}

export function useTheme() {
    const ctx = useContext(ThemeContext);
    if (!ctx) {
        throw new Error('useTheme() phải dùng bên trong <ThemeProvider> (nhóm B: client/src/main.jsx)');
    }
    return ctx;
}

export default ThemeContext;
