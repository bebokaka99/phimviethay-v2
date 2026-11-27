// Hệ thống Cấp độ (Level) & Khung Avatar (Avatar Frames)
// Tính toán EXP tích lũy và mở khóa phần thưởng

export const LEVEL_MILESTONES = [
    { level: 1, exp: 0, title: 'Tân thủ điện ảnh' },
    { level: 2, exp: 50, title: 'Khán giả thân quen' },
    { level: 3, exp: 120, title: 'Mọt phim tập sự' },
    { level: 4, exp: 200, title: 'Mọt phim chuyên cần' },
    { level: 5, exp: 320, title: 'Thợ săn bom tấn' },
    { level: 6, exp: 450, title: 'Khán giả tinh hoa' },
    { level: 7, exp: 600, title: 'Nhà phê bình nhí' },
    { level: 8, exp: 800, title: 'Chuyên gia điện ảnh' },
    { level: 10, exp: 1200, title: 'Bậc thầy rạp phim' },
    { level: 12, exp: 1800, title: 'Tín đồ Cyberpunk' },
    { level: 15, exp: 2600, title: 'Đạo diễn danh dự' },
    { level: 20, exp: 4000, title: 'Huyền thoại rạp phim' },
];

export const AVATAR_FRAMES = [
    {
        id: 'default',
        name: 'Mặc định',
        minLevel: 1,
        ringClass: 'ring-2 ring-white/10',
        badgeColor: 'bg-gray-800 text-gray-300 border border-white/10',
        desc: 'Viền cơ bản'
    },
    {
        id: 'bronze',
        name: 'Đồng Cổ Điển',
        minLevel: 1,
        ringClass: 'ring-2 ring-amber-700/80 shadow-[0_0_10px_rgba(180,83,9,0.5)]',
        badgeColor: 'bg-amber-950/80 text-amber-400 border border-amber-700/50',
        desc: 'Mở khóa từ Cấp 1'
    },
    {
        id: 'silver',
        name: 'Bạc Ánh Trăng',
        minLevel: 3,
        ringClass: 'ring-2 ring-slate-300 shadow-[0_0_12px_rgba(203,213,225,0.6)]',
        badgeColor: 'bg-slate-900 text-slate-300 border border-slate-400/50',
        desc: 'Mở khóa từ Cấp 3'
    },
    {
        id: 'gold',
        name: 'Vàng Hoàng Gia',
        minLevel: 5,
        ringClass: 'ring-2 ring-yellow-400 shadow-[0_0_16px_rgba(250,204,21,0.7)] animate-pulse',
        badgeColor: 'bg-yellow-950/90 text-yellow-400 border border-yellow-500/50',
        desc: 'Mở khóa từ Cấp 5'
    },
    {
        id: 'emerald',
        name: 'Ngọc Lục Bảo',
        minLevel: 8,
        ringClass: 'ring-2 ring-emerald-400 shadow-[0_0_16px_rgba(52,211,153,0.7)]',
        badgeColor: 'bg-emerald-950/90 text-emerald-300 border border-emerald-500/50',
        desc: 'Mở khóa từ Cấp 8'
    },
    {
        id: 'cyberpunk',
        name: 'Neon Cyberpunk',
        minLevel: 12,
        ringClass: 'ring-2 ring-fuchsia-500 shadow-[0_0_20px_rgba(217,70,239,0.8)] border border-cyan-400',
        badgeColor: 'bg-fuchsia-950/90 text-fuchsia-300 border border-fuchsia-500/50',
        desc: 'Mở khóa từ Cấp 12'
    },
    {
        id: 'legend',
        name: 'Rồng Lửa Huyền Thoại',
        minLevel: 20,
        ringClass: 'ring-2 ring-red-500 shadow-[0_0_24px_rgba(239,68,68,0.9)] border-2 border-amber-400 animate-pulse',
        badgeColor: 'bg-red-950/90 text-red-300 border border-red-500/50',
        desc: 'Mở khóa từ Cấp 20'
    },
];

export function calculateLevel(exp = 0) {
    const safeExp = Math.max(0, Number(exp) || 0);
    let currentMilestone = LEVEL_MILESTONES[0];
    let nextMilestone = LEVEL_MILESTONES[1];

    for (let i = 0; i < LEVEL_MILESTONES.length; i++) {
        if (safeExp >= LEVEL_MILESTONES[i].exp) {
            currentMilestone = LEVEL_MILESTONES[i];
            nextMilestone = LEVEL_MILESTONES[i + 1] || null;
        } else {
            break;
        }
    }

    const level = currentMilestone.level;
    const title = currentMilestone.title;

    let progressPercent = 100;
    let expInCurrentLevel = safeExp - currentMilestone.exp;
    let expRequiredForNext = 0;

    if (nextMilestone) {
        expRequiredForNext = nextMilestone.exp - currentMilestone.exp;
        progressPercent = Math.min(100, Math.round((expInCurrentLevel / expRequiredForNext) * 100));
    }

    return {
        exp: safeExp,
        level,
        title,
        progressPercent,
        expInCurrentLevel,
        expRequiredForNext,
        nextMilestone
    };
}
