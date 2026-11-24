import React, { useEffect, useState, useRef, useMemo } from 'react';
import { useParams, useSearchParams, useNavigate, Link } from 'react-router-dom';
import { Helmet } from 'react-helmet-async';
import {
    FaPlay, FaList, FaLightbulb, FaStar, FaStepForward,
    FaArrowLeft, FaExpand, FaClock, FaGlobe, FaUsers, FaHeart,
    FaHome, FaAngleRight, FaSearch, FaArrowRight,
    FaSortAmountDown, FaSortAmountUp
} from 'react-icons/fa';

import CommentSection from '../components/comments/CommentSection';
import MovieCard from '../components/movies/MovieCard';
import { SECTION_THEMES } from '../components/movies/MovieRow';
import useOnScreen from '../hooks/useOnScreen';

// Lazy load: cac muc duoi chi fetch/render khi sap vao viewport.
const LAZY_OPTS = { rootMargin: '400px' };
// Danh sach tap chi render theo dot (tranh render 1 lan ca nghin nut).
const EP_PAGE = 100;
// Lay so tap tu ten tap ("1156", "Tập 12", ...) de sap xep / tim kiem.
const epNumber = (ep) => {
    const m = String(ep?.name ?? '').match(/\d+/);
    return m ? parseInt(m[0], 10) : null;
};
// --- Trình phát riêng (24/11/2026): JWPlayer 8.9.3 + origin.js copy từ trang
// embed vsmov (client/public/jwplayer/), thay iframe vsmov trước đây. m3u8 +
// phụ đề lấy từ GET /api/extract-m3u8 theo link_embed của tập đang xem; key
// lấy từ GET /api/player-key (bắt buộc trước khi origin.js chạy — không key
// thì lỗi JW Player 100011). Đổi tập dùng jwplayer().load() (origin.js dùng
// load() để đổi nguồn, dòng 4091). Chi tiết: template-embed.html +
// swap-list.md trong ~/workspace/phimviethay-research/testplayer-copy-vsmov/.
// GHI CHÚ 22/11/2026: đã từng thử che watermark VSbet bằng miếng phủ blur và
// đè logo web lên logo VSmov (commit c356fa0/ac74d80/39aa4d1), nhưng user yêu
// cầu gỡ hết để về nguyên bản — overlay lệch vị trí khi khung phát rộng hơn
// và mất hoàn toàn khi xem toàn màn hình (iframe tự fullscreen).
const API_BASE = import.meta.env.VITE_API_URL || 'http://localhost:5000/api';
const JWPLAYER_JS = '/jwplayer/jwplayer-8.9.3.js';
const ORIGIN_JS = '/jwplayer/origin.js';
const PLAYER_CSS = '/jwplayer/player.css';
const BROADCAST_CSS = '/jwplayer/broadcast-player.css';
const JQUERY_JS = 'https://ajax.googleapis.com/ajax/libs/jquery/3.5.1/jquery.min.js';
const BOOTSTRAP_JS = 'https://cdnjs.cloudflare.com/ajax/libs/bootstrap/5.3.3/js/bootstrap.bundle.min.js';
const FA_CSS = 'https://cdnjs.cloudflare.com/ajax/libs/font-awesome/6.5.2/css/all.min.css';
const PLAYER_FONTS_CSS = 'https://fonts.googleapis.com/css2?family=Outfit:wght@400;500;600;700&family=JetBrains+Mono:wght@500&display=swap';

// Guard: player.css/broadcast-player.css là CSS của TRANG EMBED standalone
// nên có vài rule toàn cục (body height 100vh + overflow hidden = khóa cuộn
// trang; * user-select none; a trắng; body nền #000/font 14px; @media 640px
// khóa scroll + #rp-player 100dvh). Style này nạp SAU 2 file đó nên thắng và
// trả lại đúng giá trị của app trong client/src/index.css (body, ~dòng 85 —
// đồng bộ khi sửa index.css). Ngoài player (#rp-player) các rule của player
// giữ nguyên. Không nạp Bootstrap CSS (reboot + .container đè Tailwind); chỉ
// compat tối thiểu cho class Bootstrap mà origin.js dùng — xem mục [B].
const PLAYER_GUARD_CSS = `
html{height:auto !important;overflow:visible !important;-webkit-text-size-adjust:100% !important;scroll-behavior:auto !important}
body{height:auto !important;overflow-x:hidden !important;overflow-y:visible !important;background-color:var(--bg) !important;background-image:linear-gradient(to bottom,color-mix(in srgb,var(--accent) 15%,transparent) 0%,transparent 40%),linear-gradient(180deg,color-mix(in srgb,var(--accent) 18%,var(--bg)) 0%,var(--bg) 100%) !important;background-attachment:fixed !important;background-size:cover !important;background-repeat:no-repeat !important;color:var(--text) !important;font-size:var(--font-size-base) !important;font-family:'Inter',system-ui,-apple-system,sans-serif !important}
body :not(#rp-player):not(#rp-player *){-webkit-user-select:auto;user-select:auto}
#root a:not(#rp-player a){color:inherit !important;text-decoration:inherit !important}
#root a:not(#rp-player a):hover{color:inherit !important}
@media screen and (max-width:640px){html,body{height:auto !important;overflow-x:hidden !important;overflow-y:visible !important}#rp-player{height:auto !important;min-height:0 !important}}
/* [B] Compat tối thiểu cho Bootstrap (origin.js dùng data-bs-toggle dropdown /
tooltip + class d-none / dropdown-menu; .player-dm + .dropdown-item đã có
style trong 2 file CSS của player, chỉ thiếu display/position của Bootstrap) */
.d-none{display:none !important}
.dropdown-menu{position:absolute;z-index:1000;display:none}
.dropdown-menu.show{display:block}
.tooltip{position:absolute;z-index:1080;display:block;opacity:0;pointer-events:none}
.tooltip.show{opacity:.95}
.tooltip .tooltip-inner{max-width:200px;padding:.25rem .5rem;color:#fff;text-align:center;background-color:#000;border-radius:.25rem;font-size:.875rem}
.tooltip .tooltip-arrow{display:none}
/* Fix 1a (24/11/2026) — JW native caption: khi controls đang hiện, nâng vùng
caption lên 150px (100px mobile) để không đè control bar custom cao
~113px. CHỈ là phòng thủ: renderer mặc định của player KHÔNG phải JW
caption mà là overlay .bc-dual-subs (xem Fix 1b); JW caption chỉ xuất hiện
ở đường #sub-up (upload) / iOS native fullscreen fallback. Giữ cả 2 cơ chế
vì không xung đột. (Chú thích cũ nói "JW gốc chỉ nâng 60px" là SAI: bản
copy này đã có max-height 140px cho video::-webkit-media-text-track-container
khi controls hiện — player.css:2842.) */
.jwplayer.jw-state-playing:not(.jw-flag-user-inactive):not(.jw-flag-controls-hidden) .jw-captions,
.jwplayer:not(.jw-state-playing) .jw-captions,
.jwplayer.jw-flag-media-audio.jw-state-playing .jw-captions {
  max-height: calc(100% - 150px) !important;
}
@media screen and (max-width: 640px) {
  .jwplayer.jw-state-playing:not(.jw-flag-user-inactive):not(.jw-flag-controls-hidden) .jw-captions,
  .jwplayer:not(.jw-state-playing) .jw-captions,
  .jwplayer.jw-flag-media-audio.jw-state-playing .jw-captions {
    max-height: calc(100% - 100px) !important;
  }
}
/* Fix 1b (24/11/2026) — sub ĐÈ control bar, renderer THẬT là overlay riêng
.bc-dual-subs (origin.js mặc định gọi bcSetSingleSubtitleOverlay(true):
"1 ngôn ngữ qua overlay — không phụ thuộc JW caption engine"; JW caption
bị set 0 + ẩn bởi .bc-dual-hide-jw). Overlay có bottom:14% (player.css:2497,
desktop 493px ≈ 69px) + z-index:35, chữ 40px mặc định (JS clamp 36–72px,
origin.js bcDualFontSizes) — mép dưới overlay thấp hơn thanh control cao
113px nên sub đè lên progress bar + nút (đo thật: overlay bottom 556.3,
control bar top 512.3, chồng 43.9px). Nâng đáy overlay vượt hết thanh
control CHỈ khi controls đang hiện (state-aware): controls tự ẩn thì rule
8% gốc (player.css:2811) vẫn áp dụng, sub trở lại sát đáy, không lơ lửng.
Selector kép (con .jwplayer + :has trên #rp-player) vì fullscreen có thể
re-parent overlay sang #rp-player (bcMountDualOverlayHost). */
.jwplayer:not(.jw-flag-user-inactive):not(.jw-flag-controls-hidden) .bc-dual-subs,
#rp-player:has(.jwplayer:not(.jw-flag-user-inactive):not(.jw-flag-controls-hidden)) .bc-dual-subs,
.jwplayer:not(.jw-state-playing) .bc-dual-subs,
#rp-player:has(.jwplayer:not(.jw-state-playing)) .bc-dual-subs {
  bottom: max(14%, 150px) !important;
}
@media screen and (max-width: 640px) {
  .jwplayer:not(.jw-flag-user-inactive):not(.jw-flag-controls-hidden) .bc-dual-subs,
  #rp-player:has(.jwplayer:not(.jw-flag-user-inactive):not(.jw-flag-controls-hidden)) .bc-dual-subs,
  .jwplayer:not(.jw-state-playing) .bc-dual-subs,
  #rp-player:has(.jwplayer:not(.jw-state-playing)) .bc-dual-subs {
    bottom: max(16%, 70px) !important;
  }
}
/* Fix 1c (24/11/2026) — overlay z-index 35 vẽ ĐÈ lên panel setting khi menu
mở (menu nằm trong .jw-controlbar). Ẩn overlay trong lúc bất kỳ dropdown
player nào đang mở (.show của Bootstrap); đóng menu là sub hiện lại. */
#rp-player:has(.b_func .dropdown-menu.show) .bc-dual-subs {
  visibility: hidden !important;
}
/* Fix 2+4 (24/11/2026) — panel phụ đề/cài đặt là Bootstrap dropdown mở
xuống dưới rồi bị #rp-player{overflow:hidden} cắt; .player-dm gốc chỉ có
overflow:hidden (player.css:541) + .dm-sub có max-height:60vh nhưng KHÔNG
có overflow auto (player.css:3129) nên nội dung dài bị cắt không cuộn —
chỉ 2 cột ngôn ngữ (.sub-col, max-height 205px) tự cuộn, 3 hàng style
(Màu chữ / Màu nền / Độ trong nền) nằm ngoài vùng cuộn đó. Ép cuộn dọc cả
menu, theo đúng mẫu fullscreen đã có trong player.css:2716
(max-height:min(72dvh,480px) + overflow:auto) — chọn 480px thay vì 420px
(Nhóm B) vì đó là con số đã có sẵn trong code thật cho cùng panel.
(Mở lên trên nhờ class dropup thêm bằng JS — xem startPlayerMenuFixes.)
Riêng mobile (≤640px): player chỉ cao ~56.25vw (390px → 219px), khoảng
trống phía trên control bar ≈ chiều cao player − 58px thanh bar; menu phụ
đề cao ~320px KHÔNG thể nằm gọn trong đó nên phần trên (tiêu đề/tabs/2
cột ngôn ngữ) bị #rp-player overflow:hidden cắt mất — đo thật: menu
top −29px trong khi player top 128px, elementFromPoint tại điểm trong
menu nhưng ngoài player trả về container trang (không phải menu). Ép
max-height theo đúng chiều cao player (56.25vw − 70px ≈ 149px ở 390px)
để menu nằm gọn trong player và cuộn nội bộ tới mọi hàng. */
#rp-player .b_func .dropdown-menu.player-dm{
  max-height:min(72vh,480px) !important;
  overflow-y:auto !important;
  overflow-x:hidden !important;
  overscroll-behavior:contain;
  scrollbar-width:thin;
}
@media screen and (max-width: 640px) {
  #rp-player .b_func .dropdown-menu.player-dm{
    max-height:calc(56.25vw - 70px) !important;
  }
}
/* Fix 3 (24/11/2026) — #player_top kẹt opacity 1 (animation bc-chrome-rise
… both giữ lại), z-index 100, pointer-events auto, dải 50px trên cùng mobile
chặn chạm; nội dung rỗng trên mobile (tiêu đề display:none). Rule 1 sửa lỗi
chạm mọi viewport; rule 2 chỉ xóa vệt đen rỗng trên mobile. */
#player_top{pointer-events:none !important}
@media screen and (max-width:640px){#player_top{display:none !important}}
`;

const loadScript = (src, id) => new Promise((resolve, reject) => {
    if (document.getElementById(id)) return resolve();
    const s = document.createElement('script');
    s.id = id; s.src = src; s.async = true;
    s.onload = () => resolve();
    s.onerror = () => reject(new Error(`Không tải được ${src}`));
    document.body.appendChild(s);
});

const loadCss = (href, id, { nonBlocking = false } = {}) => {
    if (document.getElementById(id)) return;
    const l = document.createElement('link');
    l.id = id; l.rel = 'stylesheet'; l.href = href;
    if (nonBlocking) { l.media = 'print'; l.onload = () => { l.media = 'all'; }; }
    document.head.appendChild(l);
};

const injectStyle = (id, css) => {
    if (document.getElementById(id)) return;
    const st = document.createElement('style');
    st.id = id; st.textContent = css;
    document.head.appendChild(st);
};

const removeNode = (id) => { const el = document.getElementById(id); if (el) el.remove(); };

// Hash tập phim từ link_embed (vd https://v8.streamvsmov.com/video/<hash>).
// Chỉ dùng cho #rp-player data-hash (origin.js đọc 1 lần); URL phát thật lấy
// từ signedMasterUrl nên hash sai/thiếu cũng không chặn phát.
const extractVideoHash = (linkEmbed) => {
    try {
        const u = new URL(linkEmbed);
        return u.pathname.split('/').filter(Boolean).pop() || '';
    } catch { return ''; }
};

// playerOptions đúng shape template-embed.html (origin.js đọc ở dòng 2461+).
const buildPlayerOptions = ({ m3u8, subtitles }) => ({
    logo: '',
    subtitles: (subtitles || []).map((s) => ({
        name: s.label || s.code || 'Phụ đề',
        type: 'local',
        url: s.file, // URL tuyệt đối (backend đã resolve) — origin.js cộng origin vào URL tương đối (N2) nên bắt buộc tuyệt đối
        _inSubtitleFolder: true,
        code: s.code || 'vie',
    })),
    audios: [],
    thumb: '',
    linkVast: '',
    skipOffset: '5',
    enableSignedUrl: true, // N1 bắt buộc — origin.js tự dựng ${origin}/stream/{hash}/master.m3u8 nếu tắt
    signedMasterUrl: m3u8,
    volume: 100,
    mute: false,
    segmentCdnHosts: [], // origin.js không đọc field này (grep = 0) — giữ cho đủ shape template
});

// Nút brand PhimVietHay — y hệt mountVsmovBrand trong template-embed.html,
// chỉ đổi logoUrl (logo mình), href ('/'), title/alt ('PhimVietHay'). GIỮ
// nguyên tên class .vsmov-player-brand (N5: broadcast-player.css style theo
// class này — đổi tên là mất style nút).
const mountPlayerBrand = () => {
    const subBtn = document.querySelector('.b_func .item-sub') || document.querySelector('.jw-caption-button');
    if (!subBtn || !subBtn.parentElement) return false;
    if (document.querySelector('.vsmov-player-brand')) return true;
    const a = document.createElement('a');
    a.className = 'vsmov-player-brand item-btn';
    a.href = '/';
    a.target = '_blank';
    a.rel = 'noopener noreferrer';
    a.title = 'PhimVietHay';
    a.setAttribute('aria-label', 'PhimVietHay');
    a.innerHTML =
        '<span class="line-center vsmov-player-brand-inner">' +
        '<img src="' + logoImg + '" alt="PhimVietHay" decoding="async" loading="lazy" />' +
        '</span>';
    subBtn.parentElement.insertBefore(a, subBtn);
    return true;
};

// Màn hình loading % + click-to-play của template (origin.js gọi
// window.bcSetPlayerLoad / window.bcHidePlayerLoad, có guard typeof nên
// thiếu cũng không vỡ, nhưng giữ lại để có UX loading như bản gốc).
const startBootController = () => {
    const boot = document.getElementById('bc-player-boot');
    const numEl = document.getElementById('bc-load-num');
    const shell = document.getElementById('rp-player');
    if (!boot || !numEl) return () => {};
    const arcEl = boot.querySelector('.bc-load-arc');
    if (shell) shell.classList.add('bc-booting');
    let display = 0;
    let target = 4;
    let done = false;
    let raf = 0;
    const paint = (p) => {
        const v = Math.max(0, Math.min(100, Math.round(p)));
        numEl.textContent = String(v);
        if (arcEl) arcEl.style.strokeDashoffset = String(100 - v);
        boot.setAttribute('aria-label', 'Loading ' + v + '%');
    };
    const tick = () => {
        raf = 0;
        const diff = target - display;
        if (Math.abs(diff) < 0.15) { display = target; paint(display); return; }
        display += diff * 0.14;
        paint(display);
        raf = requestAnimationFrame(tick);
    };
    const setProgress = (p, force) => {
        if (done && !force) return;
        target = Math.max(target, Math.min(100, Number(p) || 0));
        if (!raf) raf = requestAnimationFrame(tick);
    };
    const onBcLoad = (e) => {
        const p = e && e.detail && e.detail.percent;
        if (typeof p === 'number') setProgress(p);
    };
    window.bcSetPlayerLoad = setProgress;
    window.addEventListener('bc-player-load', onBcLoad);
    setProgress(8);
    const soft = setInterval(() => {
        if (done || target >= 38) { clearInterval(soft); return; }
        setProgress(Math.min(38, target + 2.5));
    }, 280);
    const hideBoot = () => {
        if (done) return;
        done = true;
        clearInterval(soft);
        setProgress(100, true);
        paint(100);
        boot.classList.add('is-done');
        if (shell) shell.classList.remove('bc-booting');
        setTimeout(() => { if (boot.parentNode) boot.parentNode.removeChild(boot); }, 320);
    };
    window.bcHidePlayerLoad = hideBoot;
    boot.style.pointerEvents = 'auto';
    boot.style.cursor = 'pointer';
    const onBootClick = () => {
        hideBoot();
        try {
            const p = window.jwplayer && window.jwplayer('player');
            if (p && typeof p.play === 'function') p.play(true);
        } catch (e) {}
    };
    boot.addEventListener('click', onBootClick);
    let bootTries = 0;
    let sawJw = false;
    const bootTimer = setInterval(() => {
        const jw = document.querySelector('.jwplayer');
        if (jw) sawJw = true;
        const playing = jw && jw.classList.contains('jw-state-playing');
        const waiting = jw && (jw.classList.contains('jw-state-idle') || jw.classList.contains('jw-state-paused'));
        if (playing || (sawJw && waiting && target >= 50 && bootTries > 6)) {
            clearInterval(bootTimer);
            hideBoot();
            return;
        }
        if (jw && jw.classList.contains('jw-state-buffering') && target < 85) {
            setProgress(Math.min(85, target + 3));
        }
        if (++bootTries > 50) { clearInterval(bootTimer); hideBoot(); }
    }, 120);
    return () => {
        clearInterval(soft);
        clearInterval(bootTimer);
        boot.removeEventListener('click', onBootClick);
        window.removeEventListener('bc-player-load', onBcLoad);
        delete window.bcSetPlayerLoad;
        delete window.bcHidePlayerLoad;
    };
};
import { getMovieDetail, getMoviesBySlug, getMoviePeoples, IMG_URL } from '../services/movieService';
import { setWatchHistory, checkFavoriteStatus, toggleFavorite } from '../services/authService';
import logoImg from '../assets/logo.png';

// --- mapSubtitleTracks (inline từ playerLogic.js — bản viết lại đã xóa) ---
// Map shape backend {file,label,code} -> JW track, vie mặc định.
// Copy y nguyên logic từ playerLogic.js (44f0df6) để WatchMovie không còn
// phụ thuộc file đó; chỉ đổi `export` -> local.
const LANGUAGE_NAMES = {
    vie: { name: "Tiếng Việt", priority: 1 },
    eng: { name: "English", priority: 2 },
    jpn: { name: "Tiếng Nhật", priority: 3 },
    kor: { name: "Tiếng Hàn", priority: 4 },
    chi: { name: "Tiếng Trung", priority: 5 },
    zho: { name: "Tiếng Trung", priority: 5 },
    tha: { name: "Tiếng Thái", priority: 6 },
    ind: { name: "Tiếng Indonesia", priority: 7 },
    fre: { name: "Tiếng Pháp", priority: 8 },
    fra: { name: "Tiếng Pháp", priority: 8 },
    ger: { name: "Tiếng Đức", priority: 9 },
    deu: { name: "Tiếng Đức", priority: 9 },
    spa: { name: "Tiếng Tây Ban Nha", priority: 10 },
    rus: { name: "Tiếng Nga", priority: 11 },
};

const SRCLANG_MAP = {
    vie: "vi",
    eng: "en",
    chi: "zh",
    zho: "zh",
    kor: "ko",
    jpn: "ja",
    tha: "th",
    ind: "id",
    fre: "fr",
    fra: "fr",
    ger: "de",
    deu: "de",
    spa: "es",
    rus: "ru",
};

function iso6392ToSrclang(code) {
    if (!code || typeof code !== "string") return "vi";
    const c = code.trim().toLowerCase();
    if (SRCLANG_MAP[c]) return SRCLANG_MAP[c];
    return c.length >= 2 ? c.slice(0, 2) : "vi";
}

function mapLanguageCode(code) {
    if (!code || typeof code !== "string") return { name: "—", priority: 99 };
    const entry = LANGUAGE_NAMES[code.trim().toLowerCase()];
    if (entry) return { ...entry };
    return { name: code.trim().toUpperCase(), priority: 99 };
}

function sortPlayerSubtitles(tracks) {
    const seen = new Set();
    const list = (Array.isArray(tracks) ? tracks : []).filter((t) => {
        if (!t || typeof t.file !== "string" || !t.file.trim()) return false;
        const key = String(t.code || t.file).toLowerCase();
        if (seen.has(key)) return false;
        seen.add(key);
        return true;
    });
    return list
        .map((t, index) => ({ t, index }))
        .sort((a, b) => {
            const pa = mapLanguageCode(a.t.code).priority;
            const pb = mapLanguageCode(b.t.code).priority;
            return pa - pb || a.index - b.index;
        })
        .map(({ t }) => t);
}

function findDefaultSubtitleIndex(tracks) {
    const list = Array.isArray(tracks) ? tracks : [];
    const vieIdx = list.findIndex(
        (t) => typeof t.code === "string" && t.code.toLowerCase().startsWith("vie"),
    );
    return vieIdx >= 0 ? vieIdx : 0;
}

function mapSubtitleTracks(subtitles) {
    const sorted = sortPlayerSubtitles(subtitles);
    const defaultIdx = findDefaultSubtitleIndex(sorted);
    return sorted.map((s, i) => ({
        file: s.file,
        kind: "subtitles",
        label:
            typeof s.label === "string" && s.label.trim()
                ? s.label.trim()
                : mapLanguageCode(s.code).name,
        srclang: iso6392ToSrclang(s.code || "vie"),
        default: i === defaultIdx,
    }));
}

const Toast = ({ message, onClose }) => {
    useEffect(() => { const t = setTimeout(onClose, 3000); return () => clearTimeout(t); }, [onClose]);
    return (
        <div className="fixed top-20 right-4 z-[200] bg-black/90 border-l-4 border-red-600 text-white px-4 py-3 rounded shadow-2xl flex items-center gap-3 animate-fade-in-down max-w-[90vw]">
            <div className="bg-red-600 p-1 rounded-full"><FaHeart className="text-white text-[10px]" /></div>
            <span className="text-sm font-medium line-clamp-1">{message}</span>
        </div>
    );
};

const WatchMovie = () => {
    const { slug } = useParams();
    const [searchParams, setSearchParams] = useSearchParams();
    const navigate = useNavigate();
    const currentEpSlug = searchParams.get('tap');
    const playerRef = useRef(null);

    // --- Trình phát riêng (JWPlayer + origin.js copy) ---
    const [playerError, setPlayerError] = useState(null);
    const [retryTick, setRetryTick] = useState(0);
    const mountedRef = useRef(true);
    const scriptsPromiseRef = useRef(null);
    const originExecutedRef = useRef(false);
    const jwReadyRef = useRef(false);
    const runIdRef = useRef(0);
    const keyRef = useRef(null);
    const brandTimerRef = useRef(null);
    const bootCleanupRef = useRef(null);

    // jQuery + JWPlayer + key + text origin.js (1 lần / lần mount; lỗi thì
    // xóa cache để nút "Thử lại" tải lại từ đầu).
    const ensurePlayerScripts = () => {
        if (!scriptsPromiseRef.current) {
            scriptsPromiseRef.current = (async () => {
                if (!window.jQuery) await loadScript(JQUERY_JS, 'phimviethay-jquery');
                if (!window.jwplayer) await loadScript(JWPLAYER_JS, 'phimviethay-jwplayer');
                // Key BẮT BUỘC trước khi origin.js chạy (không key → lỗi JW Player 100011).
                if (!keyRef.current) {
                    const res = await fetch(`${API_BASE}/player-key`);
                    if (!res.ok) throw new Error(`Không lấy được key trình phát (HTTP ${res.status}).`);
                    const data = await res.json();
                    if (!data?.key) throw new Error('Không lấy được key trình phát.');
                    keyRef.current = data.key;
                }
                window.jwplayer.key = keyRef.current;
                // Bootstrap JS cho dropdown/tooltip của origin.js
                // (data-bs-toggle). Lỗi thì shim no-op để `new bootstrap.Tooltip`
                // trong origin.js (dòng 3365) không throw.
                try { await loadScript(BOOTSTRAP_JS, 'phimviethay-bootstrap'); }
                catch (e) { if (!window.bootstrap) window.bootstrap = { Tooltip: function () {}, Dropdown: function () {} }; }
                const r = await fetch(ORIGIN_JS);
                if (!r.ok) throw new Error(`Không tải được origin.js (HTTP ${r.status}).`);
                const text = await r.text();
                if (!text || text.length < 10000) throw new Error('Không tải được origin.js.');
                return text;
            })();
            scriptsPromiseRef.current.catch(() => { scriptsPromiseRef.current = null; });
        }
        return scriptsPromiseRef.current;
    };

    const startBrandPoller = () => {
        if (brandTimerRef.current) return;
        let tries = 0;
        brandTimerRef.current = setInterval(() => {
            if (mountPlayerBrand() || ++tries > 200) {
                clearInterval(brandTimerRef.current);
                brandTimerRef.current = null;
            }
        }, 200);
    };

    // Fix 2+4 (24/11/2026, Nhóm B): menu phụ đề/cài đặt là Bootstrap
    // dropdown (<ul class="dropdown-menu player-dm">) mở XUỐNG dưới rồi bị
    // #rp-player{overflow:hidden} cắt. Ép dropup (mở lên trên) bằng cách thêm
    // class `dropup` vào cha .p_b-right sau khi origin.js render .b_func.
    // KHÔNG dùng CSS-only top:auto/bottom:100% (giết transform của Popper,
    // mất căn ngang). Kèm reset slide "Tuỳ chỉnh" về chính khi menu Cài đặt
    // đóng, để lần mở sau không kẹt ở slide con.
    const dropupTimerRef = useRef(null);
    const menuFixCleanupRef = useRef(null);
    const startPlayerMenuFixes = () => {
        if (!dropupTimerRef.current) {
            let tries = 0;
            dropupTimerRef.current = setInterval(() => {
                const el = document.querySelector('#rp-player .p_b-right');
                if (el) {
                    el.classList.add('dropup');
                    clearInterval(dropupTimerRef.current);
                    dropupTimerRef.current = null;
                } else if (++tries > 200) {
                    clearInterval(dropupTimerRef.current);
                    dropupTimerRef.current = null;
                }
            }, 200);
        }
        if (menuFixCleanupRef.current) return;
        const onDropdownHidden = (e) => {
            const menu = e.target?.closest?.('.b_func')?.querySelector('.item-setup + .dropdown-menu');
            if (!menu) return;
            menu.querySelectorAll('.sub-slide').forEach((el) => { el.style.display = 'none'; });
            const main = menu.querySelector('.content-slide');
            if (main) main.style.display = '';
        };
        document.addEventListener('hidden.bs.dropdown', onDropdownHidden);
        menuFixCleanupRef.current = () => document.removeEventListener('hidden.bs.dropdown', onDropdownHidden);
    };

    const [movie, setMovie] = useState(null);
    const [episodes, setEpisodes] = useState([]);
    const [currentEpisode, setCurrentEpisode] = useState(null);
    const [currentServer, setCurrentServer] = useState(() => {
        try { return parseInt(localStorage.getItem('preferred_server')) || 0; } catch (e) { return 0; }
    });

    useEffect(() => { localStorage.setItem('preferred_server', currentServer); }, [currentServer]);

    const [casts, setCasts] = useState([]);
    const [relatedMovies, setRelatedMovies] = useState([]);
    const [loading, setLoading] = useState(true);
    const [isLightOff, setIsLightOff] = useState(false);
    const [isTheater, setIsTheater] = useState(false);
    const [toastMsg, setToastMsg] = useState('');
    const [isFavorite, setIsFavorite] = useState(false);
    const [watchedEpisodes, setWatchedEpisodes] = useState([]);

    // --- Chon tap: sap xep / tim tap / render theo dot ---
    const [epSort, setEpSort] = useState(() => {
        try { return localStorage.getItem('ep_sort_order') === 'desc' ? 'desc' : 'asc'; } catch (e) { return 'asc'; }
    });
    // Render theo cua so: chi hien ~100 tap/lan, cua so mac dinh chua tap dang xem
    // (vd tap 1156 trong danh sach 1->N nam o khoang 1101-1180) thay vi mo rong
    // tu dau toi tap do (se render het 1180 nut).
    const [epWinStart, setEpWinStart] = useState(0);
    const [epWinCount, setEpWinCount] = useState(EP_PAGE);
    const [epQuery, setEpQuery] = useState('');
    const [epSearchMsg, setEpSearchMsg] = useState('');
    const epListRef = useRef(null);
    const epBtnRefs = useRef({});
    const [jumpSlug, setJumpSlug] = useState(null);
    // --- Lazy: binh luan + phim tuong tu ---
    const [commentSectionRef, commentsVisible] = useOnScreen(LAZY_OPTS);
    const [relatedSectionRef, relatedVisible] = useOnScreen(LAZY_OPTS);
    const [relatedLoaded, setRelatedLoaded] = useState(false);

    useEffect(() => { try { localStorage.setItem('ep_sort_order', epSort); } catch (e) {} }, [epSort]);
    // Doi server / doi phim -> cua so ve dau danh sach
    useEffect(() => { setEpWinStart(0); setEpWinCount(EP_PAGE); setEpSearchMsg(''); }, [currentServer, slug]);

    const showToast = (msg) => setToastMsg(msg);
    const getActorImg = (path) => path ? `https://image.tmdb.org/t/p/w200${path}` : null;

    // Vong 2 (23/11/2026): tach fetch chinh khoi fetch phu.
    // Truoc day trinh phat phai doi: detail -> checkFavoriteStatus ->
    // getMoviesBySlug (phim tuong tu, ~0,9s) moi setLoading(false) nen
    // iframe xuat hien muon ~2,7s. Gio: co detail la hien trinh phat ngay;
    // fav/casts chay nen; phim tuong tu chi fetch khi panel sap vao viewport.
    useEffect(() => {
        if (!currentEpSlug) window.scrollTo(0, 0);
        const fetchData = async () => {
            if (!movie) setLoading(true);
            try {
                const data = await getMovieDetail(slug);
                if (data?.status && data?.movie) {
                    setMovie(data.movie);
                    setEpisodes(data.episodes || []);

                    // Server check logic
                    const validServerIndex = (data.episodes && data.episodes[currentServer]) ? currentServer : 0;
                    if (validServerIndex !== currentServer) setCurrentServer(0);

                    const serverData = data.episodes?.[validServerIndex]?.server_data || [];
                    if (serverData.length > 0) {
                        let foundEp = serverData.find(e => e.slug === currentEpSlug);
                        if (!foundEp) foundEp = serverData[0];
                        setCurrentEpisode(foundEp);
                    }
                    setLoading(false); // hien trinh phat + tap hien tai ngay

                    const key = `watched_${data.movie._id}`;
                    const saved = JSON.parse(localStorage.getItem(key)) || [];
                    setWatchedEpisodes(saved);

                    // Phu: chay nen, khong chan trinh phat
                    getMoviePeoples(slug).then(res => setCasts(res || []));
                    checkFavoriteStatus(data.movie.slug).then(setIsFavorite).catch(() => {});
                }
            } catch (error) { console.error(error); } finally { setLoading(false); }
        };
        fetchData();
    }, [slug]);

    // Phim tuong tu: chi fetch khi panel sap vao viewport (panel da doi
    // len ngay duoi phan chon tap nen thuong thay ngay sau khi mo trang,
    // nhung van khong chan trinh phat).
    useEffect(() => {
        if (!relatedVisible || !movie || relatedLoaded) return;
        if (!movie.category?.[0]) return;
        setRelatedLoaded(true);
        const catSlug = movie.category[0].slug;
        const randomPage = Math.floor(Math.random() * 5) + 1;
        getMoviesBySlug(catSlug, randomPage, 'the-loai').then(relatedData => {
            if (relatedData?.data?.items) {
                setRelatedMovies(relatedData.data.items.filter(m => m.slug !== movie.slug).sort(() => Math.random() - 0.5));
            }
        }).catch(() => {});
    }, [relatedVisible, movie, relatedLoaded]);

    useEffect(() => {
        if (episodes.length > 0) {
            const safeServerIndex = episodes[currentServer] ? currentServer : 0;
            const serverData = episodes[safeServerIndex]?.server_data || [];
            if (currentEpSlug) {
                const found = serverData.find(e => e.slug === currentEpSlug);
                if (found) {
                    window.scrollTo({ top: 0, behavior: 'smooth' });
                    setCurrentEpisode(found);
                    if (movie) {
                        setWatchHistory({ movieSlug: movie.slug, episodeSlug: found.slug, movieName: movie.name, movieThumb: movie.thumb_url, episodeName: found.name });
                        const key = `watched_${movie._id}`;
                        const currentList = JSON.parse(localStorage.getItem(key)) || [];
                        if (!currentList.includes(found.slug)) {
                            const newList = [...currentList, found.slug];
                            localStorage.setItem(key, JSON.stringify(newList));
                            setWatchedEpisodes(newList);
                        }
                    }
                }
            }
        }
    }, [currentEpSlug, episodes, currentServer, movie]);

    // Logic đổi server giữ nguyên tập
    useEffect(() => {
        if (movie && episodes.length > 0 && currentEpisode) {
            const currentEpName = currentEpisode.name;
            const newServerData = episodes[currentServer]?.server_data;
            if (!newServerData || newServerData.length === 0) return;
            
            let foundEp = newServerData.find(e => e.name === currentEpName);
            if (!foundEp) {
                // Fallback tìm theo slug nếu name khác
                let oldIndex = -1;
                for (const sv of episodes) {
                    const idx = sv.server_data.findIndex(e => e.slug === currentEpisode.slug);
                    if (idx !== -1) { oldIndex = idx; break; }
                }
                foundEp = (oldIndex !== -1 && newServerData[oldIndex]) ? newServerData[oldIndex] : newServerData[0];
            }
            if (foundEp && foundEp.slug !== currentEpisode.slug) {
                setCurrentEpisode(foundEp);
                setSearchParams({ tap: foundEp.slug });
            }
        }
    }, [currentServer, episodes, movie, currentEpisode, setSearchParams]);

    // Nạp asset trình phát 1 lần khi mở trang xem (gỡ khi rời trang).
    // CSS player + guard + font/FA; script (jQuery/JWPlayer/Bootstrap) nạp
    // lười trong ensurePlayerScripts khi đã có tập (cần DOM #rp-player).
    useEffect(() => {
        mountedRef.current = true;
        loadCss(PLAYER_CSS, 'phimviethay-player-css');
        loadCss(BROADCAST_CSS, 'phimviethay-broadcast-css');
        loadCss(FA_CSS, 'phimviethay-fa-css', { nonBlocking: true });
        loadCss(PLAYER_FONTS_CSS, 'phimviethay-player-fonts', { nonBlocking: true });
        injectStyle('phimviethay-player-guard', PLAYER_GUARD_CSS);
        document.body.classList.add('bc-player-page');
        return () => {
            mountedRef.current = false;
            try {
                const p = window.jwplayer && window.jwplayer('player');
                if (p && typeof p.remove === 'function') p.remove();
            } catch (e) {}
            if (brandTimerRef.current) { clearInterval(brandTimerRef.current); brandTimerRef.current = null; }
            if (dropupTimerRef.current) { clearInterval(dropupTimerRef.current); dropupTimerRef.current = null; }
            if (menuFixCleanupRef.current) { menuFixCleanupRef.current(); menuFixCleanupRef.current = null; }
            if (bootCleanupRef.current) { bootCleanupRef.current(); bootCleanupRef.current = null; }
            removeNode('phimviethay-player-css');
            removeNode('phimviethay-broadcast-css');
            removeNode('phimviethay-fa-css');
            removeNode('phimviethay-player-fonts');
            removeNode('phimviethay-player-guard');
            document.body.classList.remove('bc-player-page');
            document.querySelectorAll('.tooltip').forEach((el) => el.remove());
            delete window.playerOptions;
            delete window.videoSrc;
            originExecutedRef.current = false;
            jwReadyRef.current = false;
        };
    }, []);

    // Mở tập / đổi tập: lấy m3u8 + sub rồi setup (tập đầu) hoặc load() (đổi tập).
    useEffect(() => {
        if (!currentEpisode?.link_embed) return undefined;
        const runId = ++runIdRef.current;
        let cancelled = false;
        setPlayerError(null);
        (async () => {
            try {
                const originText = await ensurePlayerScripts();
                if (cancelled || !mountedRef.current || runId !== runIdRef.current) return;
                const res = await fetch(`${API_BASE}/extract-m3u8?embed=${encodeURIComponent(currentEpisode.link_embed)}`);
                if (!res.ok) throw new Error(`Không lấy được link phát (HTTP ${res.status}) — thử đổi server khác.`);
                const data = await res.json();
                if (!data?.m3u8) throw new Error('Không lấy được link phát cho tập này — thử đổi server khác.');
                if (cancelled || runId !== runIdRef.current) return;
                const subs = Array.isArray(data.subtitles) ? data.subtitles : [];
                window.playerOptions = buildPlayerOptions({ m3u8: data.m3u8, subtitles: subs });
                window.videoSrc = data.m3u8; // origin.js không đọc (N3) — giữ cho đủ shape template
                try {
                    const l = document.createElement('link');
                    l.rel = 'preload'; l.as = 'fetch'; l.href = data.m3u8; l.crossOrigin = 'anonymous';
                    document.head.appendChild(l);
                } catch (e) {}
                const tracks = [{ file: '', kind: 'thumbnails' }, ...mapSubtitleTracks(subs)];
                if (!originExecutedRef.current) {
                    if (!document.getElementById('rp-player') || !document.getElementById('player')) return;
                    bootCleanupRef.current = startBootController();
                    startBrandPoller();
                    startPlayerMenuFixes();
                    // origin.js nạp bằng <script> sẽ vỡ khi remount (top-level
                    // `const playerInstance` khai báo 2 lần trong global scope
                    // = SyntaxError, script không chạy). Nạp bằng fetch +
                    // new Function: const/let thành function-scope, chạy lại
                    // sạch mỗi lần mount; bare `playerOptions` / `jwplayer` /
                    // `$` vẫn resolve qua window như script thường. (Không CSP
                    // nào chặn eval: index.html và server đều không đặt
                    // Content-Security-Policy.)
                    new Function(originText)();
                    originExecutedRef.current = true;
                    const p = window.jwplayer('player');
                    p.on('ready', () => { jwReadyRef.current = true; });
                    p.on('setupError', (e) => {
                        // Setup hỏng (vd key lỗi 100011): gỡ player hỏng + reset
                        // cờ để nút "Thử lại" chạy lại toàn bộ setup thay vì
                        // load() trên player đã hỏng (load() sẽ lỗi tiếp).
                        originExecutedRef.current = false;
                        try { p.remove(); } catch (err) {}
                        if (mountedRef.current) setPlayerError(`Không khởi tạo được trình phát${e?.code ? ` (${e.code})` : ''}: ${e?.message || 'lỗi không rõ'}.`);
                    });
                    // DEFECT-1 (chỉ thuộc TestPlayer, đề phòng tái diễn):
                    // #rp-player có chiều cao tường minh qua aspect-ratio
                    // inline; kiểm tra lại computed height sau setup, nếu
                    // bằng 0 thì ép chiều cao pixel theo chiều rộng khung.
                    requestAnimationFrame(() => {
                        const shell = document.getElementById('rp-player');
                        if (shell && shell.getBoundingClientRect().height <= 0) {
                            const wrap = shell.parentElement;
                            if (wrap) shell.style.height = `${Math.round(wrap.clientWidth * 9 / 16)}px`;
                        }
                    });
                } else {
                    // Đổi tập: jwplayer().load() — cách origin.js tự dùng để
                    // đổi nguồn (dòng 4091: load({ file, type, autostart })).
                    // KHÔNG setup() lại / không nạp lại origin.js.
                    const p = window.jwplayer('player');
                    p.load({ file: data.m3u8, type: 'hls', autostart: true, tracks });
                    p.play();
                    if (!mountPlayerBrand()) startBrandPoller();
                    startPlayerMenuFixes();
                }
            } catch (e) {
                if (!cancelled && mountedRef.current && runId === runIdRef.current) {
                    setPlayerError(e?.message || 'Không phát được tập này.');
                }
            }
        })();
        return () => { cancelled = true; };
    }, [currentEpisode, retryTick]);

    const handleChangeEpisode = (ep) => { setCurrentEpisode(ep); setSearchParams({ tap: ep.slug }); };

    // --- Sap xep / tim tap ---
    // API vsmov tra danh sach tap khong theo thu tu (vd One Piece: khoi
    // 1156-1171 roi moi toi 1123-1155...), nen sap xep 1->N / N->1 la can.
    const displayEpisodes = episodes[currentServer] ? episodes[currentServer] : episodes[0];
    const sortedEpisodes = useMemo(() => {
        const list = [...(displayEpisodes?.server_data || [])];
        list.sort((a, b) => {
            const na = epNumber(a), nb = epNumber(b);
            if (na !== null && nb !== null) return epSort === 'asc' ? na - nb : nb - na;
            const cmp = String(a.name).localeCompare(String(b.name));
            return epSort === 'asc' ? cmp : -cmp;
        });
        return list;
    }, [displayEpisodes, epSort]);
    const visibleEpisodes = sortedEpisodes.slice(epWinStart, epWinStart + epWinCount);

    // Dam bao tap dang xem luon nam trong cua so da render + cuon toi no
    // (vd mo link ?tap=tap-1156 trong khi dang sap xep 1->N: tap 1156 o vi tri 1155,
    // cua so se la 1101-1180 thay vi render het tu 1 toi 1156).
    useEffect(() => {
        if (!currentEpisode || sortedEpisodes.length === 0) return;
        const idx = sortedEpisodes.findIndex(e => e.slug === currentEpisode.slug);
        if (idx === -1) return;
        if (idx < epWinStart || idx >= epWinStart + epWinCount) {
            setEpWinStart(Math.max(0, Math.floor(idx / EP_PAGE) * EP_PAGE));
            setEpWinCount(EP_PAGE);
        }
        setJumpSlug(currentEpisode.slug);
    }, [currentEpisode, sortedEpisodes]);

    // Cuon khung danh sach tap toi tap vua nhay (chi cuon khung trong, khong cuon trang).
    useEffect(() => {
        if (!jumpSlug) return;
        const el = epBtnRefs.current[jumpSlug];
        if (el) {
            el.scrollIntoView({ behavior: 'smooth', block: 'nearest' });
            setJumpSlug(null);
        }
    }, [jumpSlug, epWinStart, epWinCount, sortedEpisodes]);

    const handleSearchEpisode = () => {
        const q = epQuery.trim();
        if (!q) { setEpSearchMsg(''); return; }
        const list = displayEpisodes?.server_data || [];
        const num = parseInt(q.replace(/\D/g, ''), 10);
        let found = null;
        if (!Number.isNaN(num)) found = list.find(e => epNumber(e) === num);
        if (!found) found = list.find(e => String(e.name).trim().toLowerCase() === q.toLowerCase());
        if (!found) { setEpSearchMsg(`Không tìm thấy tập "${q}"`); return; }
        setEpSearchMsg('');
        const idx = sortedEpisodes.findIndex(e => e.slug === found.slug);
        if (idx < epWinStart || idx >= epWinStart + epWinCount) {
            setEpWinStart(Math.max(0, Math.floor(idx / EP_PAGE) * EP_PAGE));
            setEpWinCount(EP_PAGE);
        }
        setJumpSlug(found.slug);
        handleChangeEpisode(found);
    };

    const handleToggleFavorite = async () => {
        try {
            const rating = movie.tmdb?.vote_average || movie.vote_average || 0;
            const currentEpName = currentEpisode?.name || 'Full';
            const newStatus = await toggleFavorite({
                slug: movie.slug, name: movie.name, thumb_url: movie.thumb_url, quality: movie.quality, year: movie.year, episode_current: currentEpName, vote_average: rating
            });
            setIsFavorite(newStatus);
            showToast(newStatus ? 'Đã thêm vào tủ phim ❤️' : 'Đã xóa khỏi tủ phim 💔');
        } catch (error) {
            showToast(error.toString());
            if (error === "Vui lòng đăng nhập để lưu phim!") setTimeout(() => navigate('/login'), 1500);
        }
    };

    const getNextEpisode = () => {
        if (!episodes || episodes.length === 0 || !currentEpisode) return null;
        const safeServerIndex = episodes[currentServer] ? currentServer : 0;
        const serverData = episodes[safeServerIndex]?.server_data || [];
        if (serverData.length === 0) return null;
        const currentIndex = serverData.findIndex(e => e.slug === currentEpisode.slug);
        if (currentIndex !== -1 && currentIndex < serverData.length - 1) return serverData[currentIndex + 1];
        return null;
    };

    if (loading) return <div className="min-h-screen bg-transparent flex items-center justify-center"><div className="animate-spin rounded-full h-12 w-12 border-t-2 border-b-2 border-[var(--accent)]"></div></div>;
    if (!movie) return null;

    const nextEp = getNextEpisode();
    const bgImage = `${IMG_URL}${movie.poster_url || movie.thumb_url}`;
    const pageTitle = `Xem phim ${movie.name} - Tập ${currentEpisode?.name} | PhimVietHay`;
    const ratingVal = Number(movie.tmdb?.vote_average || movie.vote_average || 0);
    const voteCount = movie.tmdb?.vote_count || 0;

    return (
        <div className={`min-h-screen font-sans transition-colors duration-700 text-white overflow-x-hidden selection:bg-[var(--accent)] selection:text-white`}>
            <Helmet>
                <title>{pageTitle}</title>
                <meta name="description" content={`Xem phim ${movie.name} tập ${currentEpisode?.name} chất lượng cao.`} />
            </Helmet>

            {!isLightOff && (
                <div className="fixed inset-0 z-0 pointer-events-none">
                    <div className="absolute inset-0 bg-cover bg-center opacity-20 blur-[120px] scale-110 transition-all duration-1000" style={{ backgroundImage: `url(${bgImage})` }} />
                    <div className="absolute inset-0 bg-gradient-to-b from-black/60 via-black/80 to-black z-10" />
                </div>
            )}

            {toastMsg && <Toast message={toastMsg} onClose={() => setToastMsg('')} />}
            <div className={`fixed inset-0 bg-black/98 z-40 transition-opacity duration-700 pointer-events-none ${isLightOff ? 'opacity-100' : 'opacity-0'}`} />

            <div className={`relative z-50 transition-all duration-700 ${isLightOff ? 'pt-10' : 'pt-24 pb-12'} container mx-auto px-0 md:px-4`} ref={playerRef}>
                <div className={`flex items-center gap-2 text-xs md:text-sm text-gray-400 mb-4 px-4 md:px-0 transition-opacity duration-500 ${isLightOff ? 'opacity-0 pointer-events-none' : 'opacity-100'}`}>
                    <Link to="/" className="hover:text-[var(--accent)] transition-colors flex items-center gap-1"><FaHome /> Trang chủ</Link>
                    <FaAngleRight className="text-gray-600 text-[10px]" />
                    {movie && <><Link to={`/phim/${movie.slug}`} className="hover:text-[var(--accent)] transition-colors line-clamp-1 max-w-[120px] md:max-w-none" title={movie.name}>{movie.name}</Link><FaAngleRight className="text-gray-600 text-[10px]" /></>}
                    <span className="text-white font-medium line-clamp-1 text-[var(--accent)]">{currentEpisode?.name ? `Đang xem Tập ${currentEpisode.name}` : 'Đang tải...'}</span>
                </div>

                <div className={`flex flex-col lg:flex-row gap-6 ${isTheater ? 'justify-center' : ''}`}>
                    <div className={`w-full ${isTheater || isLightOff ? 'lg:w-[100%]' : 'lg:w-[75%]'} transition-all duration-500`}>
                        <div className="relative w-full aspect-video bg-black md:rounded-xl overflow-hidden shadow-[0_0_50px_rgba(220,38,38,0.15)] ring-1 ring-white/10 md:ring-red-500/20 group z-20">
                            {currentEpisode ? (
                                currentEpisode.link_embed ? (
                                    <>
                                        {/* DOM đúng template-embed.html (origin.js cần):
                                            #rp-player[data-hash] > .main-player > #player,
                                            #video_mask, #bc-player-boot; #player_top là
                                            sibling sau #rp-player. Chiều cao tường minh:
                                            aspect-ratio inline trên chính #rp-player
                                            (khung ngoài đã aspect-video) — không dùng
                                            h-full (DEFECT-1 ở TestPlayer). */}
                                        <div
                                            id="rp-player"
                                            className="bc-player-enter"
                                            data-hash={extractVideoHash(currentEpisode.link_embed)}
                                            style={{ aspectRatio: '16 / 9', height: 'auto', width: '100%' }}
                                        >
                                            <div className="main-player">
                                                <div id="player" />
                                            </div>
                                            <div id="video_mask" />
                                            <div className="bc-player-boot" id="bc-player-boot" role="status" aria-live="polite" aria-label="Loading">
                                                <div className="bc-load">
                                                    <svg className="bc-load-svg" viewBox="0 0 80 80" width="80" height="80" aria-hidden="true">
                                                        <circle className="bc-load-track" cx="40" cy="40" r="34" fill="none" />
                                                        <circle className="bc-load-arc" cx="40" cy="40" r="34" fill="none" pathLength="100" strokeDasharray="100" strokeDashoffset="100" />
                                                    </svg>
                                                    <div className="bc-load-pct">
                                                        <span className="bc-load-num" id="bc-load-num">0</span><span className="bc-load-unit">%</span>
                                                    </div>
                                                </div>
                                            </div>
                                        </div>
                                        <div id="player_top" className="bc-chrome-enter">
                                            <div className="p_t-left">
                                                <div className="video-info">
                                                    <div className="name">{movie.name} — Tập {currentEpisode.name}</div>
                                                    <div className="info" />
                                                </div>
                                            </div>
                                            <div className="p_t-right line-center gap-3" />
                                        </div>
                                        {playerError && (
                                            <div className="absolute inset-0 z-30 flex flex-col items-center justify-center gap-3 bg-black/85 px-6 text-center">
                                                <p className="text-sm text-gray-200">{playerError}</p>
                                                <button onClick={() => setRetryTick((t) => t + 1)} className="rounded-full bg-[var(--accent)] px-5 py-2 text-xs font-bold text-white hover:bg-[var(--accent-hover)]">Thử lại</button>
                                            </div>
                                        )}
                                    </>
                                ) : (
                                    <div className="flex items-center justify-center h-full text-gray-400 bg-gray-900 px-6 text-center"><p>Tập này chưa có link phát. Thử đổi server khác bên phải.</p></div>
                                )
                            ) : <div className="flex items-center justify-center h-full text-gray-500 bg-gray-900"><p>Đang tải...</p></div>}
                        </div>

                        <div className="mt-0 md:mt-4 bg-gradient-to-r from-black/80 to-black/60 border-b md:border border-white/10 border-t-white/5 p-3 md:rounded-lg backdrop-blur-xl flex flex-wrap items-center justify-between gap-3 shadow-lg">
                            <div className="flex items-center gap-4">
                                <div className="flex items-center gap-2 text-[var(--accent)] font-bold drop-shadow-[0_0_10px_rgba(220,38,38,0.5)]"><FaPlay className="text-sm" /><span className="text-sm uppercase tracking-wide">Tập: <span className="text-white ml-1">{currentEpisode?.name}</span></span></div>
                                {nextEp && <button onClick={() => handleChangeEpisode(nextEp)} className="flex items-center gap-1 text-xs font-bold text-white bg-gradient-to-r from-[var(--accent)] to-[var(--accent-hover)] hover:from-[var(--accent-hover)] hover:to-[var(--accent)] px-4 py-2 rounded-full transition-all shadow-md hover:shadow-red-600/30 animate-pulse-slow">Tiếp theo <FaStepForward /></button>}
                            </div>
                            <div className="flex items-center gap-2">
                                <button onClick={handleToggleFavorite} className={`p-2.5 rounded-full transition-all ${isFavorite ? 'text-red-500 bg-red-500/10 hover:bg-red-500/20' : 'text-gray-300 hover:bg-white/10 hover:text-white'}`} title={isFavorite ? "Bỏ theo dõi" : "Theo dõi phim"}><FaHeart /></button>
                                <button onClick={() => setIsLightOff(!isLightOff)} className="p-2.5 rounded-full hover:bg-white/10 text-gray-300 transition-all" title="Tắt đèn"><FaLightbulb /></button>
                                <button onClick={() => setIsTheater(!isTheater)} className="p-2.5 rounded-full hover:bg-white/10 text-gray-300 hidden md:block transition-all" title="Rạp chiếu"><FaExpand /></button>
                                <button onClick={() => navigate(`/phim/${movie.slug}`)} className="p-2.5 rounded-full hover:bg-white/10 text-gray-300 transition-all" title="Chi tiết"><FaArrowLeft /></button>
                            </div>
                        </div>

                        {!isLightOff && currentEpisode?.link_embed && (
                            <p className="mt-2 px-1 text-[11px] text-gray-500">Đang phát bằng trình phát riêng — bấm “Tiếp theo” để chuyển tập. Nút “Bỏ qua giới thiệu”, chọn phụ đề và tốc độ nằm trong trình phát.</p>
                        )}

                        {!isLightOff && (
                            <div className="mt-8 space-y-8 px-4 md:px-0">
                                <div className="bg-black/40 p-6 md:p-8 rounded-2xl border border-white/10 backdrop-blur-xl shadow-2xl relative overflow-hidden">
                                    <div className="absolute top-0 right-0 -mt-20 -mr-20 w-64 h-64 bg-red-600/10 rounded-full blur-[80px] pointer-events-none"></div>
                                    <h1 className="text-3xl md:text-4xl font-extrabold text-transparent bg-clip-text bg-gradient-to-r from-white to-gray-300 mb-4">{movie.name}</h1>
                                    <div className="flex flex-wrap items-center gap-3 text-sm mb-5">
                                        <span className="bg-gradient-to-r from-[var(--accent)] to-[var(--accent-hover)] text-white px-3 py-1 rounded-md font-bold text-xs shadow-lg shadow-red-900/20 uppercase tracking-wider">{movie.quality || 'HD'}</span>
                                        <span className="flex items-center gap-1 bg-yellow-500/20 text-yellow-500 px-3 py-1 rounded-md font-bold border border-yellow-500/20"><FaStar /> {ratingVal > 0 ? ratingVal.toFixed(1) : 'N/A'} <span className="text-yellow-300/70 font-normal text-xs ml-1">({voteCount})</span></span>
                                        <span className="flex items-center gap-1 text-gray-300 bg-white/5 px-3 py-1 rounded-md border border-white/10"><FaClock className="text-[var(--accent)]" /> {movie.time}</span>
                                        <span className="text-gray-300 bg-white/5 px-3 py-1 rounded-md border border-white/10">{movie.year}</span>
                                        <span className="flex items-center gap-1 text-gray-300 bg-white/5 px-3 py-1 rounded-md border border-white/10"><FaGlobe className="text-[var(--accent)]" /> {movie.country?.[0]?.name}</span>
                                    </div>
                                    <h2 className="text-base text-gray-400 italic mb-5 border-b border-white/5 pb-4 font-medium">{movie.origin_name}</h2>
                                    <p className="text-gray-200 text-sm leading-relaxed line-clamp-4 md:line-clamp-none">{movie.content?.replace(/<[^>]*>?/gm, '')}</p>
                                </div>
                                {/* Binh luan — lazy: chi mount (kem fetch /comments) khi sap vao viewport */}
                                <div ref={commentSectionRef}>
                                    {movie && currentEpisode && commentsVisible ? (
                                        <CommentSection movieSlug={movie.slug} episodeSlug={currentEpisode.slug} />
                                    ) : (
                                        <p className="text-sm text-gray-500 py-6 text-center">Đang tải bình luận...</p>
                                    )}
                                </div>
                            </div>
                        )}
                    </div>

                    {!isTheater && !isLightOff && (
                        <div className={`w-full lg:w-[28%] flex flex-col gap-6 transition-all duration-700 ${isLightOff ? 'opacity-20 blur-sm' : 'opacity-100'} px-4 md:px-0`}>
                            <div className="bg-black/40 backdrop-blur-xl rounded-2xl border border-white/10 overflow-hidden flex flex-col max-h-[500px] shadow-2xl">
                                <div className="p-4 bg-white/5 border-b border-white/10 flex flex-col gap-3">
                                    <div className="flex justify-between items-center">
                                        <h3 className="font-bold text-white flex items-center gap-2 text-sm uppercase tracking-wider"><FaList className="text-[var(--accent)]" /> Chọn Tập</h3>
                                        <span className="text-xs text-gray-400 bg-white/10 px-2 py-0.5 rounded-full">{displayEpisodes?.server_data?.length || 0} tập</span>
                                    </div>
                                    {/* Sap xep + tim tap */}
                                    <div className="flex gap-2">
                                        <button
                                            onClick={() => setEpSort(epSort === 'asc' ? 'desc' : 'asc')}
                                            title={epSort === 'asc' ? 'Đang xếp tăng dần 1 → N, bấm để đảo thành N → 1' : 'Đang xếp giảm dần N → 1, bấm để đảo thành 1 → N'}
                                            className="flex items-center gap-1 px-2.5 py-2 text-[11px] font-bold rounded-lg bg-white/5 border border-white/10 text-gray-200 hover:bg-white/10 hover:text-white transition whitespace-nowrap"
                                        >
                                            {epSort === 'asc' ? <><FaSortAmountUp className="text-[var(--accent)]" /> 1 → N</> : <><FaSortAmountDown className="text-[var(--accent)]" /> N → 1</>}
                                        </button>
                                        <div className="flex flex-1 gap-1">
                                            <input
                                                type="text"
                                                inputMode="numeric"
                                                value={epQuery}
                                                onChange={(e) => { setEpQuery(e.target.value); setEpSearchMsg(''); }}
                                                onKeyDown={(e) => { if (e.key === 'Enter') handleSearchEpisode(); }}
                                                placeholder="Tìm tập... (VD: 500)"
                                                className="min-w-0 flex-1 bg-black/40 border border-white/10 rounded-lg px-2.5 py-2 text-xs text-white placeholder-gray-500 outline-none focus:border-[var(--accent)]"
                                            />
                                            <button onClick={handleSearchEpisode} title="Nhảy tới tập" className="px-3 py-2 rounded-lg bg-[var(--accent)] hover:bg-[var(--accent-hover)] text-white transition flex items-center">
                                                <FaSearch className="text-xs" />
                                            </button>
                                        </div>
                                    </div>
                                    {epSearchMsg && <p className="text-[11px] text-red-400 font-medium">{epSearchMsg}</p>}
                                    {episodes.length > 1 && (
                                        <div className="flex flex-wrap gap-2 p-1 bg-black/20 rounded-lg">
                                            {episodes.map((s, i) => (
                                                <button key={i} onClick={() => setCurrentServer(i)} className={`px-3 py-1.5 text-[10px] font-bold rounded-md transition-all duration-300 flex-1 ${currentServer === i ? 'bg-gradient-to-r from-[var(--accent)] to-[var(--accent-hover)] text-white shadow-md' : 'text-gray-400 hover:bg-white/10 hover:text-white'}`}>{s.server_name}</button>
                                            ))}
                                        </div>
                                    )}
                                </div>
                                <div ref={epListRef} className="flex-1 overflow-y-auto custom-scrollbar p-3 bg-black/20">
                                    {epWinStart > 0 && (
                                        <button
                                            onClick={() => { setEpWinStart(Math.max(0, epWinStart - EP_PAGE)); setEpWinCount(epWinCount + EP_PAGE); }}
                                            className="mb-3 w-full py-2.5 rounded-lg bg-white/5 hover:bg-white/10 border border-white/10 text-xs font-bold text-gray-300 hover:text-white transition"
                                        >
                                            ↑ Xem các tập trước
                                        </button>
                                    )}
                                    <div className="grid grid-cols-4 gap-2">
                                        {visibleEpisodes.map((ep, idx) => {
                                            const isActive = currentEpisode?.slug === ep.slug;
                                            const isWatched = watchedEpisodes.includes(ep.slug);
                                            return (
                                                <button key={`${ep.slug}-${idx}`} ref={(el) => { if (el) epBtnRefs.current[ep.slug] = el; else delete epBtnRefs.current[ep.slug]; }} onClick={() => handleChangeEpisode(ep)} className={`relative h-10 rounded-lg text-xs font-bold transition-all duration-300 border overflow-hidden group ${isActive ? 'bg-gradient-to-r from-[var(--accent)] to-[var(--accent-hover)] text-white border-[var(--accent)] shadow-[0_0_15px_rgba(220,38,38,0.4)] scale-105 z-10' : isWatched ? 'bg-gray-800/50 text-gray-500 border-white/5 hover:bg-gray-700/50' : 'bg-white/5 text-gray-300 border-white/10 hover:bg-white/10 hover:text-white hover:border-white/30'}`}>
                                                    {isActive && <span className="absolute inset-0 bg-white/20 animate-pulse-slow mix-blend-overlay"></span>}
                                                    {ep.name}
                                                </button>
                                            );
                                        })}
                                    </div>
                                    {epWinStart + epWinCount < sortedEpisodes.length && (
                                        <button
                                            onClick={() => setEpWinCount(epWinCount + EP_PAGE)}
                                            className="mt-3 w-full py-2.5 rounded-lg bg-white/5 hover:bg-white/10 border border-white/10 text-xs font-bold text-gray-300 hover:text-white transition"
                                        >
                                            Hiển thị thêm ({sortedEpisodes.length - epWinStart - epWinCount} tập còn lại)
                                        </button>
                                    )}
                                </div>
                            </div>

                            {/* Phim tương tự — vòng 4 (23/11/2026): theo ảnh user gửi,
                                bỏ header chữ khô "Phim tương tự / Xem tất cả" và
                                lưới dọc 1 cột (vòng 3, 6 card 200px, panel ~2331px).
                                Thay bằng: (1) thẻ tiêu đề theme ở ĐẦU panel — cùng
                                kiểu thẻ tạp chí của MovieRow (ảnh nền + gradient
                                theme theo thể loại đầu của phim + tiêu đề lớn +
                                mô tả + nút "XEM TẤT CẢ →"), nhưng dạng BANNER
                                NGANG NGẮN (h ~150px) cho vừa chiều rộng sidebar
                                (~350px), không phải thẻ dọc cao 520px như trang
                                chủ; bấm cả thẻ đi tới /the-loai/<thể loại đầu>
                                như nút cũ. Ảnh nền: poster phim tương tự đầu
                                tiên (đã tải về), chưa có thì poster phim đang xem.
                                (2) lưới 2 CỘT bên dưới, đúng MovieCard chung
                                (poster + tên + badge HD/điểm/năm, hover popup
                                2s như trang chủ). Mỗi card ~153px ≈ cỡ card
                                mobile trang chủ (150px, MovieRow w-[150px]).
                                Số lượng giữ 6 phim (3 hàng): panel còn ~1,05k px
                                thay vì ~2,3k px; 8 phim (4 hàng) dài thêm ~300px
                                mà không thêm giá trị — đủ xem, không cuộn dài.
                                Vị trí (sidebar phải, dưới panel chọn tập), lazy
                                load + logic fetch (random page 1–5, xáo trộn)
                                giữ nguyên, không sửa. */}
                            <div ref={relatedSectionRef} className="bg-black/40 backdrop-blur-xl rounded-2xl border border-white/10 overflow-hidden shadow-2xl">
                                {(() => {
                                    const catSlug = movie.category?.[0]?.slug;
                                    const theme = SECTION_THEMES[catSlug] || SECTION_THEMES['default'];
                                    const bannerBg = relatedMovies[0]?.thumb_url || movie.poster_url || movie.thumb_url;
                                    const goAll = () => { if (catSlug) navigate(`/the-loai/${catSlug}`); };
                                    return (
                                        <div
                                            onClick={goAll}
                                            role="button"
                                            aria-label="Xem tất cả phim tương tự"
                                            className={`relative h-[150px] overflow-hidden cursor-pointer group/banner bg-[#0a0e17] ${catSlug ? '' : 'cursor-default'}`}
                                        >
                                            <div
                                                className="absolute inset-0 bg-cover bg-center transition-all duration-1000 group-hover/banner:scale-110 opacity-80 group-hover/banner:opacity-100"
                                                style={{ backgroundImage: `url(${bannerBg})` }}
                                            />
                                            <div className={`absolute inset-0 bg-gradient-to-b ${theme.gradient} opacity-80 group-hover/banner:opacity-60 transition-opacity duration-500`} />
                                            <div className={`absolute top-0 left-0 w-full h-1 ${theme.borderTop}`} />
                                            <div className="absolute inset-0 p-4 flex flex-col z-10">
                                                <div className={`text-2xl mb-2 ${theme.accent} drop-shadow-md`}>{theme.icon}</div>
                                                <h3 className="text-[22px] font-black text-white leading-none uppercase drop-shadow-xl">Có thể bạn muốn xem</h3>
                                                <p className="text-xs text-gray-200 font-medium opacity-90 mt-2 line-clamp-1">{theme.desc}</p>
                                                {catSlug && (
                                                    <div className="pt-3 mt-auto border-t border-white/10 flex items-center gap-2 text-xs font-bold uppercase tracking-widest text-white">
                                                        Xem tất cả
                                                        <span className={`w-6 h-6 rounded-full border border-white/40 flex items-center justify-center bg-white/10 ${theme.badgeBg} transition-colors`}>
                                                            <FaArrowRight size={8} />
                                                        </span>
                                                    </div>
                                                )}
                                            </div>
                                        </div>
                                    );
                                })()}
                                <div className="p-3 bg-black/20">
                                    {relatedMovies.length > 0 ? (
                                        <div className="grid grid-cols-2 gap-3">
                                            {relatedMovies.slice(0, 6).map((m) => (
                                                <MovieCard key={m.slug} movie={m} />
                                            ))}
                                        </div>
                                    ) : (
                                        <p className="text-xs text-gray-500 text-center py-4">Đang tải phim tương tự...</p>
                                    )}
                                </div>
                            </div>

                            {casts.length > 0 && (
                                <div className="bg-black/40 backdrop-blur-xl rounded-2xl border border-white/10 overflow-hidden shadow-2xl">
                                    <div className="p-4 bg-white/5 border-b border-white/10"><h3 className="font-bold text-white flex items-center gap-2 text-sm uppercase tracking-wider"><FaUsers className="text-[var(--accent)]" /> Diễn viên</h3></div>
                                    <div className="p-3 max-h-[350px] overflow-y-auto custom-scrollbar bg-black/20">
                                        <div className="grid grid-cols-2 gap-3">
                                            {casts.map((actor, idx) => (
                                                <div key={idx} className="flex items-center gap-3 group cursor-pointer p-2 rounded-xl hover:bg-white/5 transition-all border border-transparent hover:border-white/10">
                                                    <div className="w-10 h-10 rounded-full overflow-hidden border-2 border-white/10 group-hover:border-[var(--accent)] transition-all flex-shrink-0 bg-gray-800 shadow-sm">
                                                        {actor.profile_path ? <img src={getActorImg(actor.profile_path)} alt={actor.name} className="w-full h-full object-cover filter group-hover:brightness-110 transition-all" loading="lazy" /> : <div className="w-full h-full flex items-center justify-center text-xs text-gray-400 font-bold">{actor.name.charAt(0)}</div>}
                                                    </div>
                                                    <div className="min-w-0"><p className="text-xs font-bold text-gray-200 truncate group-hover:text-red-400 transition-colors">{actor.name}</p><p className="text-[10px] text-gray-500 truncate">{actor.character || 'Diễn viên'}</p></div>
                                                </div>
                                            ))}
                                        </div>
                                    </div>
                                </div>
                            )}
                        </div>
                    )}
                </div>
            </div>
        </div>
    );
};

export default WatchMovie;