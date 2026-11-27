// Validate theme giao diện (Custom UI, 23/11/2026).
// Dùng chung cho PATCH /api/user/theme. Không thêm thư viện ngoài.
//
// Quy tắc (theo spec nhóm A):
// - theme phải là object (không phải array/null/string).
// - Chỉ chấp nhận các key đã biết: preset, accent, radius, fontSize,
//   density, hiddenRows, animations, glass. Key lạ -> 400.
// - preset (nếu có) phải nằm trong danh sách preset tối có sẵn.
// - accent (nếu có) phải là mã hex hợp lệ (#RGB hoặc #RRGGBB).
// - hiddenRows (nếu có) phải là mảng các chuỗi (slug hàng trang chủ).
// - animations / glass (nếu có) phải là boolean.
// - radius / fontSize / density (nếu có) phải là chuỗi không rỗng
//   (frontend tự quy ước giá trị, vd "medium"/"comfortable" —
//   backend không khóa cứng tập giá trị để tránh vỡ khi frontend
//   thêm lựa chọn mới).
// Trả về { valid, error, theme }: theme đã lọc chỉ còn key đã biết.

const THEME_PRESETS = ['crimson', 'ocean', 'violet', 'emerald', 'amber', 'rose', 'custom'];

const ALLOWED_THEME_KEYS = [
    'preset',
    'accent',
    'radius',
    'fontSize',
    'density',
    'hiddenRows',
    'animations',
    'glass',
    'progressBar',
];

const HEX_COLOR_RE = /^#(?:[0-9a-fA-F]{3}|[0-9a-fA-F]{6})$/;

function isPlainObject(value) {
    return value !== null && typeof value === 'object' && !Array.isArray(value);
}

function validateTheme(theme) {
    if (!isPlainObject(theme)) {
        return { valid: false, error: 'Theme phải là một object JSON.', theme: null };
    }

    const unknownKeys = Object.keys(theme).filter((k) => !ALLOWED_THEME_KEYS.includes(k));
    if (unknownKeys.length > 0) {
        return { valid: false, error: `Key theme không hợp lệ: ${unknownKeys.join(', ')}.`, theme: null };
    }

    const clean = {};

    if (theme.preset !== undefined) {
        if (typeof theme.preset !== 'string' || !THEME_PRESETS.includes(theme.preset)) {
            return { valid: false, error: `Preset không hợp lệ. Preset cho phép: ${THEME_PRESETS.join(', ')}.`, theme: null };
        }
        clean.preset = theme.preset;
    }

    if (theme.accent !== undefined) {
        if (typeof theme.accent !== 'string' || !HEX_COLOR_RE.test(theme.accent)) {
            return { valid: false, error: 'Accent phải là mã màu hex hợp lệ (vd #3b82f6).', theme: null };
        }
        clean.accent = theme.accent;
    }

    for (const key of ['radius', 'fontSize', 'density', 'progressBar']) {
        if (theme[key] !== undefined) {
            if (typeof theme[key] !== 'string' || theme[key].trim() === '') {
                return { valid: false, error: `${key} phải là chuỗi không rỗng.`, theme: null };
            }
            clean[key] = theme[key];
        }
    }

    if (theme.hiddenRows !== undefined) {
        if (!Array.isArray(theme.hiddenRows) || theme.hiddenRows.some((r) => typeof r !== 'string')) {
            return { valid: false, error: 'hiddenRows phải là mảng các chuỗi.', theme: null };
        }
        clean.hiddenRows = theme.hiddenRows;
    }

    for (const key of ['animations', 'glass']) {
        if (theme[key] !== undefined) {
            if (typeof theme[key] !== 'boolean') {
                return { valid: false, error: `${key} phải là true hoặc false.`, theme: null };
            }
            clean[key] = theme[key];
        }
    }

    return { valid: true, error: null, theme: clean };
}

module.exports = { THEME_PRESETS, ALLOWED_THEME_KEYS, validateTheme };
