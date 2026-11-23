// Validate settings trình phát (Admin Settings, 23/11/2026).
// Dùng chung cho PUT /api/admin/settings. Không thêm thư viện ngoài.
//
// Quy tắc (theo spec nhóm A):
// - body phải là object JSON (không phải array/null/string) và có ít
//   nhất 1 key. Chỉ chấp nhận 6 key đã biết, key lạ -> 400.
// - player_logo_position (nếu có) phải thuộc tập:
//   top-left, top-right, bottom-right, bottom-left, control-bar.
// - player_vast_skipoffset (nếu có) phải là số nguyên >= 0; chấp nhận
//   number hoặc string số ("10"); lưu dạng string ("10").
// - player_vast_file / player_logo_file / player_logo_link (nếu có)
//   phải là chuỗi rỗng hoặc URL hợp lệ (http/https).
// - player_license (nếu có) phải là chuỗi (mọi giá trị, kể cả rỗng).
// - Validate TOÀN BỘ trước khi đổi bất kỳ key nào (atomic): controller
//   chỉ UPDATE khi validateSettings trả valid, nên sai 1 key thì
//   không có key nào bị đổi.
// Trả về { valid, error, settings }: settings là object đã chuẩn hóa
// (skipoffset về dạng string), chỉ gồm key đã biết.

const ALLOWED_SETTING_KEYS = [
    'player_license',
    'player_logo_file',
    'player_logo_link',
    'player_logo_position',
    'player_vast_file',
    'player_vast_skipoffset',
];

const LOGO_POSITIONS = ['top-left', 'top-right', 'bottom-right', 'bottom-left', 'control-bar'];

const URL_SETTING_KEYS = ['player_vast_file', 'player_logo_file', 'player_logo_link'];

// Giá trị mặc định của 6 key (khớp seed trong 004_admin_settings_views.sql).
// Dùng làm fallback khi 1 key chưa có trong DB (không được phép thiếu,
// nhưng GET vẫn phải trả đủ 6 key).
const DEFAULT_SETTINGS = {
    player_license: '',
    player_logo_file: '',
    player_logo_link: '',
    player_logo_position: 'top-right',
    player_vast_file: '',
    player_vast_skipoffset: '5',
};

function isPlainObject(value) {
    return value !== null && typeof value === 'object' && !Array.isArray(value);
}

function isValidHttpUrl(value) {
    try {
        const url = new URL(value);
        return (url.protocol === 'http:' || url.protocol === 'https:') && url.hostname !== '';
    } catch {
        return false;
    }
}

function validateSettings(body) {
    if (!isPlainObject(body)) {
        return { valid: false, error: 'Body phải là một object JSON {key: value}.', settings: null };
    }

    const keys = Object.keys(body);
    if (keys.length === 0) {
        return { valid: false, error: 'Không có key nào để cập nhật.', settings: null };
    }

    const settings = {};
    for (const key of keys) {
        if (!ALLOWED_SETTING_KEYS.includes(key)) {
            return { valid: false, error: `Key không hợp lệ: ${key}.`, settings: null };
        }
        const value = body[key];

        if (key === 'player_logo_position') {
            if (typeof value !== 'string' || !LOGO_POSITIONS.includes(value)) {
                return {
                    valid: false,
                    error: `player_logo_position phải thuộc: ${LOGO_POSITIONS.join(', ')}.`,
                    settings: null,
                };
            }
            settings[key] = value;
        } else if (key === 'player_vast_skipoffset') {
            let num = null;
            if (typeof value === 'number') {
                num = value;
            } else if (typeof value === 'string' && /^\d+$/.test(value.trim())) {
                num = parseInt(value.trim(), 10);
            }
            if (num === null || !Number.isInteger(num) || num < 0) {
                return {
                    valid: false,
                    error: 'player_vast_skipoffset phải là số nguyên >= 0.',
                    settings: null,
                };
            }
            settings[key] = String(num);
        } else if (URL_SETTING_KEYS.includes(key)) {
            if (typeof value !== 'string') {
                return { valid: false, error: `${key} phải là chuỗi (URL http/https hoặc chuỗi rỗng).`, settings: null };
            }
            if (value !== '' && !isValidHttpUrl(value)) {
                return { valid: false, error: `${key} phải là URL hợp lệ (http/https) hoặc chuỗi rỗng.`, settings: null };
            }
            settings[key] = value;
        } else {
            // player_license: chuỗi bất kỳ (kể cả rỗng).
            if (typeof value !== 'string') {
                return { valid: false, error: 'player_license phải là chuỗi.', settings: null };
            }
            settings[key] = value;
        }
    }

    return { valid: true, error: null, settings };
}

module.exports = { ALLOWED_SETTING_KEYS, LOGO_POSITIONS, DEFAULT_SETTINGS, validateSettings };
