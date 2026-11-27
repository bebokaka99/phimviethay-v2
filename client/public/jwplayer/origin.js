const playerInstance = jwplayer('player');

// —— Player chrome color (per-viewer, localStorage — not admin config) ——
const BC_PLAYER_COLOR_KEY = 'bc_player_chrome_color';
const BC_PLAYER_COLOR_DEFAULT = '#e50914';
const BC_PLAYER_COLOR_PRESETS = [
  { value: '#e50914', label: 'Đỏ' },
  { value: '#e11d48', label: 'Rose' },
  { value: '#ffffff', label: 'Trắng' },
  { value: '#ef4444', label: 'Đỏ' },
  { value: '#22c55e', label: 'Xanh lá' },
  { value: '#3b82f6', label: 'Xanh dương' },
  { value: '#fbbf24', label: 'Vàng' },
  { value: '#1c1917', label: 'Đen' }
];

function bcNormalizeHexColor(raw, fallback) {
  const fb = fallback || BC_PLAYER_COLOR_DEFAULT;
  const s = String(raw || '').trim();
  const m3 = /^#([0-9a-fA-F]{3})$/.exec(s);
  if (m3) {
    const [r, g, b] = m3[1].split('');
    return ('#' + r + r + g + g + b + b).toLowerCase();
  }
  const m6 = /^#([0-9a-fA-F]{6})$/.exec(s);
  if (m6) return ('#' + m6[1]).toLowerCase();
  return fb;
}

function bcDarkenHex(hex, amount) {
  const h = bcNormalizeHexColor(hex).slice(1);
  const t = 1 - (amount || 0.18);
  const r = Math.round(parseInt(h.slice(0, 2), 16) * t);
  const g = Math.round(parseInt(h.slice(2, 4), 16) * t);
  const b = Math.round(parseInt(h.slice(4, 6), 16) * t);
  return (
    '#' +
    [r, g, b]
      .map((n) => Math.max(0, Math.min(255, n)).toString(16).padStart(2, '0'))
      .join('')
  );
}

function bcContrastInkFor(hex) {
  const h = bcNormalizeHexColor(hex).slice(1);
  const rgb = [0, 2, 4].map((i) => parseInt(h.slice(i, i + 2), 16));
  const lin = rgb.map((c) => {
    const s = c / 255;
    return s <= 0.03928 ? s / 12.92 : Math.pow((s + 0.055) / 1.055, 2.4);
  });
  const L = 0.2126 * lin[0] + 0.7152 * lin[1] + 0.0722 * lin[2];
  return L > 0.55 ? '#1c1917' : '#ffffff';
}

function bcApplyPlayerChromeColor(raw) {
  const color = bcNormalizeHexColor(raw);
  const hover = bcDarkenHex(color, 0.18);
  const text = bcContrastInkFor(color);
  const root = document.documentElement;
  root.style.setProperty('--primary-color', color);
  root.style.setProperty('--bc-player-accent', color);
  root.style.setProperty('--bc-player-accent-hover', hover);
  root.style.setProperty('--bc-player-sky', hover);
  root.style.setProperty('--bg-primary', color);
  root.style.setProperty('--primary-text', text);
  const label = document.querySelector('.jw-player-color-text');
  if (label) label.textContent = color.toUpperCase();
  const picker = document.getElementById('bc-player-color-input');
  if (picker) picker.value = color;
  document.querySelectorAll('#sub-player-color .cs-item[data-chrome-color]').forEach((el) => {
    el.classList.toggle(
      'active',
      bcNormalizeHexColor(el.getAttribute('data-chrome-color')) === color
    );
  });
  return color;
}

function bcLoadPlayerChromeColor() {
  let saved = null;
  try {
    saved = localStorage.getItem(BC_PLAYER_COLOR_KEY);
  } catch (e) {}
  return bcApplyPlayerChromeColor(saved || BC_PLAYER_COLOR_DEFAULT);
}

function bcSavePlayerChromeColor(raw) {
  const color = bcApplyPlayerChromeColor(raw);
  try {
    localStorage.setItem(BC_PLAYER_COLOR_KEY, color);
  } catch (e) {}
  return color;
}

bcLoadPlayerChromeColor();

// Load Phimmoi Font for subtitles
const fontStyle = document.createElement('style');
fontStyle.textContent = `
  @font-face {
    font-family: 'Phimmoi Font';
    src: url('/phimmoi.TTF') format('truetype');
    font-weight: bold;
    font-style: normal;
  }
`;
document.head.appendChild(fontStyle);
let dualSubtitlesEnabled = false; // true khi song ngữ (2 dòng)
let singleSubtitleOverlay = false; // true khi 1 ngôn ngữ qua overlay (tránh JW không load VTT Việt)
let mainSubtitleTrack = null;
let secondarySubtitleTrack = null;
let subtitleTracks = [];
let introSkipped = false;
let isAdPlaying = false;
let bcTopTickerHideTimer = null;
let bcTopTickerLastPos = null;
let bcTopTickerRaf = null;
const bcTopTickerFired = new Set();
const BC_TOP_TICKER_DURATION_MS = 18000;
let currentConfigSub = {
  color: 'white',
  size: '70',
  opacity: '100',
  font: 'Phimmoi Font',
};

const BC_CAPTION_STYLE_KEY = 'bc_player_caption_style';
const BC_CAPTION_STYLE_FS_MIGRATE = 'bc_caption_fs_device_v6';
const BC_CAPTION_STYLE_DEFAULT = {
  color: 'white',
  fontSize: 40,
  fontOpacity: 100,
  fontFamily: 'Phimmoi Font',
  edgeStyle: 'none',
  backgroundColor: '#000000',
  backgroundOpacity: 0,
};

/** Mặc định: PC 40pt · mobile/iOS 20pt */
function bcDefaultCaptionFontSize() {
  try {
    if (typeof bcIsIosLikeDevice === 'function' && bcIsIosLikeDevice()) {
      return 20;
    }
  } catch (e) {}
  try {
    if (typeof bcIsMobilePlayerLayout === 'function' && bcIsMobilePlayerLayout()) {
      return 20;
    }
  } catch (e2) {}
  try {
    const w = window.innerWidth || 0;
    if (w > 0 && w <= 768) return 20;
  } catch (e3) {}
  return 40;
}

function bcLoadCaptionStyle() {
  const deviceDefault = {
    ...BC_CAPTION_STYLE_DEFAULT,
    fontSize: bcDefaultCaptionFontSize(),
  };
  try {
    const raw = localStorage.getItem(BC_CAPTION_STYLE_KEY);
    if (raw) {
      const parsed = JSON.parse(raw);
      if (parsed && typeof parsed === 'object') {
        const next = { ...deviceDefault, ...parsed };
        // Migrate v6: PC bỏ 24/32 → mặc định 40; mobile giữ 20 nếu đang cỡ cũ
        try {
          if (!localStorage.getItem(BC_CAPTION_STYLE_FS_MIGRATE)) {
            localStorage.setItem(BC_CAPTION_STYLE_FS_MIGRATE, '1');
            const oldFs = parseFloat(parsed.fontSize);
            const mobile =
              (typeof bcIsIosLikeDevice === 'function' && bcIsIosLikeDevice()) ||
              (typeof bcIsMobilePlayerLayout === 'function' &&
                bcIsMobilePlayerLayout());
            if (mobile) {
              if (oldFs === 16 || oldFs === 18) {
                next.fontSize = bcDefaultCaptionFontSize();
                localStorage.setItem(
                  BC_CAPTION_STYLE_KEY,
                  JSON.stringify(next)
                );
              }
            } else if (
              oldFs === 16 ||
              oldFs === 18 ||
              oldFs === 20 ||
              oldFs === 24 ||
              oldFs === 32
            ) {
              next.fontSize = bcDefaultCaptionFontSize();
              localStorage.setItem(
                BC_CAPTION_STYLE_KEY,
                JSON.stringify(next)
              );
            }
          }
        } catch (m) {}
        return next;
      }
    }
  } catch (e) {}
  return { ...deviceDefault };
}

function bcSaveCaptionStyle(partial) {
  const next = { ...bcLoadCaptionStyle(), ...(partial || {}) };
  try {
    localStorage.setItem(BC_CAPTION_STYLE_KEY, JSON.stringify(next));
  } catch (e) {}
  return next;
}

function bcNamedOrHexToRgb(color) {
  const named = {
    white: '#ffffff',
    yellow: '#ffff00',
    blue: '#0000ff',
    green: '#008000',
    purple: '#800080',
    black: '#000000',
  };
  let hex = named[String(color || '').toLowerCase()] || String(color || '#ffffff');
  if (!/^#([0-9a-fA-F]{3}|[0-9a-fA-F]{6})$/.test(hex)) hex = '#ffffff';
  if (hex.length === 4) {
    hex =
      '#' +
      hex[1] +
      hex[1] +
      hex[2] +
      hex[2] +
      hex[3] +
      hex[3];
  }
  const h = hex.slice(1);
  return {
    r: parseInt(h.slice(0, 2), 16),
    g: parseInt(h.slice(2, 4), 16),
    b: parseInt(h.slice(4, 6), 16),
    hex: hex.toLowerCase(),
  };
}

function bcColorWithOpacity(color, opacityPct) {
  const { r, g, b } = bcNamedOrHexToRgb(color);
  const a = Math.max(0, Math.min(100, parseInt(opacityPct, 10) || 0)) / 100;
  return `rgba(${r}, ${g}, ${b}, ${a})`;
}

function bcCaptionEdgeShadow(edgeStyle) {
  if (edgeStyle === 'raised') {
    return '-1px -1px 0 #000, 1px -1px 0 #000, -1px 1px 0 #000, 1px 1px 0 #000, 0 2px 4px rgba(0,0,0,.85)';
  }
  if (edgeStyle === 'depressed' || edgeStyle === 'dropshadow') {
    return '2px 2px 4px rgba(0,0,0,.9)';
  }
  return '0 0 4px rgba(0,0,0,.9), 0 2px 10px rgba(0,0,0,.75)';
}

function bcGetLiveCaptions() {
  let fromJw = {};
  try {
    fromJw = (playerInstance.getConfig && playerInstance.getConfig().captions) || {};
  } catch (e) {}
  // localStorage thắng JW — JW hay giữ color=white dù đã setCaptions
  return { ...BC_CAPTION_STYLE_DEFAULT, ...fromJw, ...bcLoadCaptionStyle() };
}

function bcCaptionTextColorCss(color) {
  const { hex } = bcNamedOrHexToRgb(color || 'white');
  return hex;
}

function bcColorLabel(color) {
  const hex = bcCaptionTextColorCss(color);
  const hit = arrayColor.find(
    (i) =>
      i.color === color ||
      bcCaptionTextColorCss(i.color) === hex ||
      String(i.color).toLowerCase() === String(color || '').toLowerCase()
  );
  return (hit && hit.label) || 'Trắng';
}

function bcBackgroundLabel(background) {
  const bg = String(background || '#000000').toLowerCase();
  const hit = arrayBackground.find(
    (i) => String(i.background || '').toLowerCase() === bg
  );
  return (hit && hit.label) || 'Đen';
}

function bcSyncSubStyleBar() {
  const caps = bcGetLiveCaptions();
  const textColor = bcCaptionTextColorCss(caps.color || 'white');
  const bg = String(caps.backgroundColor || '#000000').toLowerCase();
  const bgOp = String(parseInt(caps.backgroundOpacity, 10) || 0);
  document.querySelectorAll('.bc-sub-text-colors .bc-swatch').forEach((el) => {
    const swatch = bcCaptionTextColorCss(el.getAttribute('data-sub-color') || '');
    el.classList.toggle('active', swatch === textColor);
  });
  document.querySelectorAll('.bc-sub-bg-colors .bc-swatch').forEach((el) => {
    const v = String(el.getAttribute('data-sub-bg') || '').toLowerCase();
    const isNone = v === 'none' || v === 'transparent';
    el.classList.toggle(
      'active',
      isNone ? bgOp === '0' : v === bg && bgOp !== '0'
    );
  });
  document.querySelectorAll('.bc-sub-bg-opacity .bc-swatch-op').forEach((el) => {
    el.classList.toggle(
      'active',
      String(el.getAttribute('data-sub-bg-opacity') || '') === bgOp
    );
  });
}

function bcSetCaptionsStyle(partial, opts) {
  const options = opts || {};
  const cleaned = { ...(partial || {}) };
  if (cleaned.color != null) {
    cleaned.color = bcCaptionTextColorCss(cleaned.color);
  }
  let next = bcSaveCaptionStyle(cleaned);
  if (
    cleaned.backgroundColor != null &&
    cleaned.backgroundOpacity == null &&
    (parseInt(next.backgroundOpacity, 10) || 0) === 0 &&
    options.autoBgOpacity !== false
  ) {
    next = bcSaveCaptionStyle({ backgroundOpacity: 75 });
  }
  if (
    cleaned.backgroundOpacity != null &&
    parseInt(cleaned.backgroundOpacity, 10) === 0
  ) {
    next = bcSaveCaptionStyle({ backgroundOpacity: 0 });
  }
  try {
    const current = (playerInstance.getConfig && playerInstance.getConfig().captions) || {};
    playerInstance.setCaptions({
      ...current,
      ...next,
      // Lưu localStorage theo size PC; JW nhận scale nội bộ (map riêng)
      fontSize: bcJwInternalFontSize(next.fontSize),
    });
  } catch (e) {}
  bcSyncSubStyleBar();
  bcSyncNativeCueCss();
  bcForceCaptionSizeRefresh();
  if (typeof bcSubtitleOverlayActive === 'function' && bcSubtitleOverlayActive()) {
    updateDualSubtitles();
    // iOS native FS: áp màu/cỡ ngay lên TextTrack
    if (typeof bcIsNativeVideoFullscreen === 'function' && bcIsNativeVideoFullscreen()) {
      bcShowNativeFsSubs(true);
    }
  }
  const savedColor = String(next.color || 'white').toLowerCase();
  const colorLabel = bcColorLabel(next.color);
  const bgLabel = bcBackgroundLabel(next.backgroundColor);
  $('a[data-type="color"] .csi-current').html(
    `<div class="csi-color" style="background-color: ${next.color};"></div><span>${colorLabel}</span><i class="fa-solid fa-angle-right"></i>`
  );
  $('a[data-type="backgroundColor"] .csi-current').html(
    `<div class="csi-color" style="background-color: ${next.backgroundColor};"></div><span>${bgLabel}</span><i class="fa-solid fa-angle-right"></i>`
  );
  $('a[data-type="backgroundOpacity"] .csi-current span').text(
    (parseInt(next.backgroundOpacity, 10) || 0) + '%'
  );
  return next;
}

const BC_INTRO_SKIP_KEY = 'bc_player_intro_skip_sec';
const BC_INTRO_SKIP_DEFAULT = 65; // 1:05
const BC_INTRO_SKIP_PRESETS = [
  { value: 0, label: 'Tắt' },
  { value: 30, label: '0:30' },
  { value: 60, label: '1:00' },
  { value: 65, label: '1:05' },
  { value: 90, label: '1:30' },
  { value: 120, label: '2:00' }
];

function bcFormatSkipTime(sec) {
  const s = Math.max(0, Math.floor(Number(sec) || 0));
  const m = Math.floor(s / 60);
  const r = s % 60;
  return m + ':' + (r < 10 ? '0' : '') + r;
}

function bcGetIntroSkipSec() {
  try {
    const raw = localStorage.getItem(BC_INTRO_SKIP_KEY);
    if (raw === null || raw === '') return BC_INTRO_SKIP_DEFAULT;
    const v = parseInt(raw, 10);
    if (Number.isFinite(v) && v >= 0 && v <= 3600) return v;
  } catch (e) {}
  return BC_INTRO_SKIP_DEFAULT;
}

function bcSaveIntroSkipSec(sec) {
  const v = Math.max(0, Math.min(3600, parseInt(sec, 10) || 0));
  try {
    localStorage.setItem(BC_INTRO_SKIP_KEY, String(v));
  } catch (e) {}
  introSkipped = false;
  const label = document.querySelector('.jw-intro-skip-text');
  if (label) label.textContent = v === 0 ? 'Tắt' : bcFormatSkipTime(v);
  document.querySelectorAll('#sub-intro-skip .cs-item[data-intro-skip]').forEach((el) => {
    el.classList.toggle('active', parseInt(el.getAttribute('data-intro-skip'), 10) === v);
  });
  return v;
}

function bcEnsureSkipIntroUI() {
  if ($('#rp-player > .skip-buttons').length) return;
  $('#rp-player').append(`
    <div class="skip-buttons" style="display:none" aria-hidden="true">
      <a href="javascript:void(0)" class="sb-button light bc-skip-intro" role="button">
        <span class="line-center gap-2">
          <i class="fa-solid fa-forward"></i>
          <span>Bỏ qua giới thiệu</span>
        </span>
      </a>
    </div>
  `);
}

function bcUpdateIntroMarker(duration) {
  const introSec = bcGetIntroSkipSec();
  const $slider = $('.jw-slider-time .jw-slider-container').first();
  if (!$slider.length) return;
  let $marker = $slider.children('.jw-intro');
  if (introSec <= 0 || !duration || duration <= introSec) {
    $marker.remove();
    return;
  }
  if (!$marker.length) {
    $marker = $('<div class="jw-intro" title="Intro"></div>').appendTo($slider);
  }
  const pct = Math.min(99.5, (introSec / duration) * 100);
  $marker.css({ left: pct + '%', width: '3px' });
}

function bcUpdateSkipIntroButton(current, duration) {
  bcEnsureSkipIntroUI();
  const introSec = bcGetIntroSkipSec();
  const $wrap = $('#rp-player > .skip-buttons');

  if (introSec > 0 && current < introSec - 1) {
    introSkipped = false;
  }
  if (introSec > 0 && current >= introSec - 0.2) {
    introSkipped = true;
  }

  const show =
    !introSkipped &&
    !isAdPlaying &&
    introSec > 0 &&
    current >= 0 &&
    current < introSec - 0.35 &&
    duration > introSec + 1;

  $wrap.toggle(!!show).attr('aria-hidden', show ? 'false' : 'true');
  bcUpdateIntroMarker(duration);
}

const BC_TOP_TICKER_MARKS = []; // tắt ticker VSMOV.COM
const BC_TOP_TICKER_ENABLED = false;
const BC_TOP_TICKER_HTML =
  '<span class="bc-brand"><span class="bc-brand-vs">VS</span><span class="bc-brand-mov">MOV.COM</span></span> chia sẻ dữ liệu phim song ngữ, 4K miễn phí — Cập nhật nhanh nhất, API ổn định lâu dài.';

function bcTopTickerHost() {
  const fs =
    document.fullscreenElement ||
    document.webkitFullscreenElement ||
    document.mozFullScreenElement ||
    null;
  if (fs) return fs;
  const container = playerInstance.getContainer
    ? playerInstance.getContainer()
    : null;
  if (container) return container;
  const $jw = $('.jwplayer').first();
  if ($jw.length) return $jw[0];
  return document.getElementById('rp-player');
}

function bcMountTopTickerHost() {
  const el = document.getElementById('bc-top-ticker');
  if (!el) return;
  const host = bcTopTickerHost();
  if (host && el.parentElement !== host) {
    const wasRunning = el.classList.contains('is-running');
    host.appendChild(el);
    // Đổi parent: CSS anim bị hủy — rAF tự tiếp tục nếu còn is-running
    if (wasRunning) {
      bcRestartTopTickerAnim(el);
    }
  }
}

function bcStopTopTickerAnim() {
  if (bcTopTickerRaf != null) {
    cancelAnimationFrame(bcTopTickerRaf);
    bcTopTickerRaf = null;
  }
}

/**
 * Marquee bằng rAF + translate3d — CSS animation dễ đứng khi HLS decode trên VPS.
 */
function bcRestartTopTickerAnim(el) {
  const track = el && el.querySelector('.bc-top-ticker-track');
  if (!track) return;
  bcStopTopTickerAnim();

  // Bỏ CSS animation; chỉ dùng JS
  track.style.animation = 'none';
  el.classList.add('is-running');

  const reduced =
    typeof window.matchMedia === 'function' &&
    window.matchMedia('(prefers-reduced-motion: reduce)').matches;
  if (reduced) {
    track.style.transform = 'none';
    track.style.left = '0';
    track.style.width = '100%';
    return;
  }

  const parentW = el.clientWidth || window.innerWidth || 0;
  // Đợi layout (font/text) rồi đo width
  const start = () => {
    const textW = Math.max(track.scrollWidth, track.offsetWidth, 1);
    const startX = parentW;
    const endX = -textW;
    const dist = endX - startX;
    const t0 = performance.now();
    track.style.willChange = 'transform';
    track.style.transform = 'translate3d(' + startX + 'px,0,0)';

    const tick = (now) => {
      if (!el.classList.contains('is-running') || el.hasAttribute('hidden')) {
        bcTopTickerRaf = null;
        return;
      }
      const p = Math.min(1, (now - t0) / BC_TOP_TICKER_DURATION_MS);
      const x = startX + dist * p;
      track.style.transform = 'translate3d(' + x + 'px,0,0)';
      if (p < 1) {
        bcTopTickerRaf = requestAnimationFrame(tick);
      } else {
        bcTopTickerRaf = null;
        bcHideTopTicker();
      }
    };
    bcTopTickerRaf = requestAnimationFrame(tick);
  };

  // 2 frame để text có kích thước đúng sau append/fullscreen
  requestAnimationFrame(() => requestAnimationFrame(start));
}

function bcEnsureTopTicker() {
  let $el = $('#bc-top-ticker');
  if ($el.length) {
    bcMountTopTickerHost();
    return $el;
  }
  $el = $(`
    <div id="bc-top-ticker" class="bc-top-ticker" hidden aria-hidden="true">
      <div class="bc-top-ticker-track">
        <span class="bc-top-ticker-text"></span>
      </div>
    </div>
  `);
  $el.find('.bc-top-ticker-text').html(BC_TOP_TICKER_HTML);
  const host = bcTopTickerHost();
  $(host || '#rp-player').append($el);
  return $el;
}

function bcHideTopTicker() {
  bcStopTopTickerAnim();
  const $el = $('#bc-top-ticker');
  if (!$el.length) return;
  $el
    .removeClass('is-on is-running')
    .attr('hidden', true)
    .attr('aria-hidden', 'true');
  const track = $el.find('.bc-top-ticker-track')[0];
  if (track) {
    track.style.animation = 'none';
    track.style.transform = 'translate3d(100%,0,0)';
    track.style.willChange = 'auto';
  }
  if (bcTopTickerHideTimer) {
    clearTimeout(bcTopTickerHideTimer);
    bcTopTickerHideTimer = null;
  }
}

function bcShowTopTicker() {
  if (!BC_TOP_TICKER_ENABLED) return;
  if (isAdPlaying) return;
  const $el = bcEnsureTopTicker();
  bcMountTopTickerHost();
  const el = $el[0];
  $el.removeAttr('hidden').attr('aria-hidden', 'false').addClass('is-on');
  bcRestartTopTickerAnim(el);
  if (bcTopTickerHideTimer) clearTimeout(bcTopTickerHideTimer);
  // Safety hide nếu rAF bị browser pause lâu
  bcTopTickerHideTimer = setTimeout(bcHideTopTicker, BC_TOP_TICKER_DURATION_MS + 4000);
}

function bcUpdateTopTicker(current) {
  if (isAdPlaying) {
    bcHideTopTicker();
    bcTopTickerLastPos = current;
    return;
  }

  // First sample: sync only — avoid firing after resume/seek land
  if (bcTopTickerLastPos === null) {
    bcTopTickerLastPos = current;
    return;
  }

  const last = bcTopTickerLastPos;
  const delta = current - last;

  for (let i = 0; i < BC_TOP_TICKER_MARKS.length; i++) {
    const mark = BC_TOP_TICKER_MARKS[i];
    if (bcTopTickerFired.has(mark)) continue;
    // Forward cross only
    if (!(last < mark && current >= mark)) continue;
    // VPS HLS hay nhảy 4–10s — chỉ bỏ qua seek lớn (tua tay)
    if (delta > 20) continue;
    bcTopTickerFired.add(mark);
    bcShowTopTicker();
    break;
  }

  bcTopTickerLastPos = current;
}

function bcPlayerMotionMs() {
  try {
    return window.matchMedia('(prefers-reduced-motion: reduce)').matches ? 0 : 180;
  } catch (e) {
    return 180;
  }
}

function bcShowPlayerSlide(selector) {
  const ms = bcPlayerMotionMs();
  const $panels = $('.sub-slide, .content-slide');
  $panels.removeClass('is-open');
  $panels.fadeOut(ms, function () {
    $(selector).addClass('is-open').fadeIn(ms);
  });
}

function bcSwapPlayerSlide($current, $parent) {
  const ms = bcPlayerMotionMs();
  $current.removeClass('is-open').fadeOut(ms, function () {
    $parent.addClass('is-open').fadeIn(ms);
  });
}

function bcBackPlayerSlide($current, $parent) {
  $('.level-1').hide();
  bcSwapPlayerSlide($current, $parent);
}

const languageMap = {
	// 🔥 Ưu tiên cao
	vie: { name: "Tiếng Việt", priority: 1 },
	eng: { name: "Tiếng Anh", priority: 2 },
	jpn: { name: "Tiếng Nhật", priority: 3 },
	kor: { name: "Tiếng Hàn", priority: 4 },
	chi: { name: "Tiếng Trung", priority: 5 },
	zho: { name: "Tiếng Trung", priority: 5 },

	// 🌏 Châu Á
	tha: { name: "Tiếng Thái", priority: 10 },
	ind: { name: "Tiếng Indonesia", priority: 11 },
	msa: { name: "Tiếng Mã Lai", priority: 12 },
	khm: { name: "Tiếng Khmer", priority: 13 },
	lao: { name: "Tiếng Lào", priority: 14 },
	mya: { name: "Tiếng Myanmar", priority: 15 },
	may: { name: "Tiếng Myanmar", priority: 15 },
	hin: { name: "Tiếng Hindi", priority: 16 },
	tam: { name: "Tiếng Tamil", priority: 17 },
	tel: { name: "Tiếng Telugu", priority: 18 },

	// 🌍 Châu Âu
	fre: { name: "Tiếng Pháp", priority: 20 },
	fra: { name: "Tiếng Pháp", priority: 20 },
	spa: { name: "Tiếng Tây Ban Nha", priority: 21 },
	ger: { name: "Tiếng Đức", priority: 22 },
	deu: { name: "Tiếng Đức", priority: 22 },
	ita: { name: "Tiếng Ý", priority: 23 },
	por: { name: "Tiếng Bồ Đào Nha", priority: 24 },
	rus: { name: "Tiếng Nga", priority: 25 },
	ukr: { name: "Tiếng Ukraina", priority: 26 },
	pol: { name: "Tiếng Ba Lan", priority: 27 },
	nld: { name: "Tiếng Hà Lan", priority: 28 },
	dut: { name: "Tiếng Hà Lan", priority: 28 },
	swe: { name: "Tiếng Thụy Điển", priority: 29 },
	nor: { name: "Tiếng Na Uy", priority: 30 },
	dan: { name: "Tiếng Đan Mạch", priority: 31 },
	fin: { name: "Tiếng Phần Lan", priority: 32 },
	ces: { name: "Tiếng Séc", priority: 33 },
	cze: { name: "Tiếng Séc", priority: 33 },
	hun: { name: "Tiếng Hungary", priority: 34 },
	ell: { name: "Tiếng Hy Lạp", priority: 35 },

	// 🌍 Trung Đông
	ara: { name: "Tiếng Ả Rập", priority: 40 },
	heb: { name: "Tiếng Do Thái", priority: 41 },
	fas: { name: "Tiếng Ba Tư", priority: 42 },
	per: { name: "Tiếng Ba Tư", priority: 42 },
	tur: { name: "Tiếng Thổ Nhĩ Kỳ", priority: 43 },

	// 🎧 Khác
	und: { name: "Không xác định", priority: 90 },
	mul: { name: "Đa ngôn ngữ", priority: 91 },
};

function mapLanguageCode(input = "") {
  const raw = input.toLowerCase().trim();
  const shortToIso = { vi: "vie", en: "eng", zh: "chi", ko: "kor", ja: "jpn", th: "tha" };
  const code = shortToIso[raw] || raw;
  const match = code.match(/^[a-z]{3}/);
  const short = match ? match[0] : "";

  return (
    languageMap[short] || {
      name: `Unknown (${input})`,
      priority: 99,
    }
  );
}

const isMobile = {
	Android: function () {
			return navigator.userAgent.match(/Android/i);
	},
	BlackBerry: function () {
			return navigator.userAgent.match(/BlackBerry/i);
	},
	iOS: function () {
			return navigator.userAgent.match(/iPhone|iPad|iPod/i);
	},
	Opera: function () {
			return navigator.userAgent.match(/Opera Mini/i);
	},
	Windows: function () {
			return navigator.userAgent.match(/IEMobile/i) || navigator.userAgent.match(/WPDesktop/i);
	},
	any: function () {
			return isMobile.Android() || isMobile.BlackBerry() || isMobile.iOS() || isMobile.Opera() || isMobile.Windows();
	}
};

function escapeHtml(text) {
  if (!text) return '';
  const map = {
    '&': '&amp;',
    '<': '&lt;',
    '>': '&gt;',
    '"': '&quot;',
    "'": '&#039;'
  };
  return text.replace(/[&<>"']/g, function(m) { return map[m]; });
}

const arrayColor = [
  {
    label: 'Trắng',
    color: 'white',
  },
  {
    label: 'Vàng',
    color: 'yellow',
  },
  {
    label: 'Xanh dương',
    color: 'blue',
  },
  {
    label: 'Xanh lá',
    color: 'green',
  },
  {
    label: 'Tím',
    color: 'purple',
  },
];

/** Mobile/iOS: giữ bộ cỡ chi tiết (thêm 35/30/25 ngày 24/11/2026 theo yêu
cầu user — 20 đã có sẵn) */
const arraySizeMobile = [
  { label: '35pt', size: '35' },
  { label: '32pt', size: '32' },
  { label: '30pt', size: '30' },
  { label: '25pt', size: '25' },
  { label: '24pt', size: '24' },
  { label: '20pt', size: '20' },
  { label: '18pt', size: '18' },
  { label: '16pt', size: '16' },
  { label: '14pt', size: '14' },
  { label: '12pt', size: '12' },
];

/** PC: 20 · 25 · 30 · 35 · 40 · 48 · 56 · 64 (thêm 20/25/30/35 ngày
24/11/2026 theo yêu cầu user — trước đây nhỏ nhất là 40) */
const arraySizeDesktop = [
  { label: '64pt', size: '64' },
  { label: '56pt', size: '56' },
  { label: '48pt', size: '48' },
  { label: '40pt', size: '40' },
  { label: '35pt', size: '35' },
  { label: '30pt', size: '30' },
  { label: '25pt', size: '25' },
  { label: '20pt', size: '20' },
];

/** @deprecated dùng bcCaptionSizeOptions() — giữ alias để không vỡ chỗ cũ */
const arraySize = arraySizeMobile;

function bcCaptionSizeOptions() {
  try {
    if (
      (typeof bcIsIosLikeDevice === 'function' && bcIsIosLikeDevice()) ||
      (typeof bcIsMobilePlayerLayout === 'function' && bcIsMobilePlayerLayout())
    ) {
      return arraySizeMobile;
    }
  } catch (e) {}
  try {
    const w = window.innerWidth || 0;
    if (w > 0 && w <= 768) return arraySizeMobile;
  } catch (e2) {}
  return arraySizeDesktop;
}

const arrayOpacity = [
  {
    label: '100%',
    opacity: '100',
  },
  {
    label: '75%',
    opacity: '75',
  },
  {
    label: '50%',
    opacity: '50',
  },
  {
    label: '25%',
    opacity: '25',
  },
  {
    label: '0%',
    opacity: '0',
  },
];

const arrayFont = [
  {
    label: 'Arial',
    font: 'Arial',
  },
  {
    label: 'Courier',
    font: 'Courier',
  },
  {
    label: 'Georgia',
    font: 'Georgia',
  },
  {
    label: 'Impact',
    font: 'Impact',
  },
  {
    label: 'Lucida Console',
    font: 'Lucida Console',
  },
  {
    label: 'Tahoma',
    font: 'Tahoma',
  },
  {
    label: 'Times New Roman',
    font: 'Times New Roman',
  },
  {
    label: 'Trebuchet MS',
    font: 'Trebuchet MS',
  },
  {
    label: 'Verdana',
    font: 'Verdana',
  },
  {
    label: 'Phimmoi Font',
    font: 'Phimmoi Font',
  },
];

const arraySizeFont = [
  {
    label: '150%',
    size: '150',
  },
  {
    label: '120%',
    size: '120',
  },
  {
    label: '100%',
    size: '100',
  },
  {
    label: '75%',
    size: '75',
  },
  {
    label: '70%',
    size: '70',
  },
  {
    label: '50%',
    size: '50',
  },
];

const arrayBackground = [
  {
    label: 'Đen',
    background: '#000000',
  },
  {
    label: 'Xám Đậm',
    background: '#323232',
  },
  {
    label: 'Xanh Hải Quân',
    background: '#03047d',
  },
  {
    label: 'Nâu Ấm',
    background: '#592c07',
  },
  {
    label: 'Tím Nhạt',
    background: '#4a027f',
  },
  {
    label: 'Xanh Olive Đậm',
    background: '#243224',
  },
  {
    label: 'Than Chì',
    background: '#37454e',
  },
  {
    label: 'Xanh Biển Sâu',
    background: '#0d5555',
  },
  {
    label: 'Xám nhạt',
    background: '#f0f0f0',
  },
  {
    label: 'Vàng Hổ Phách',
    background: '#fdcb36',
  },
];

async function loadCuesFromFile(track) {
  if (!track) return [];
  const url = subtitleFileUrl(track.url || track.file || '');
  if (!url) return [];

  try {
    const vttRes = await fetch(url, { credentials: 'same-origin', cache: 'no-cache' });
    if (!vttRes.ok) {
      console.warn('[sub] fetch failed', vttRes.status, url);
      return [];
    }
    let vttText = await vttRes.text();
    if (!vttText) return [];
    // SRT raw (phòng khi server chưa convert)
    if (!/^\s*WEBVTT/i.test(vttText) && /^\s*\d+\s*$/m.test(vttText) && vttText.includes('-->')) {
      vttText =
        'WEBVTT\n\n' +
        vttText
          .replace(/\r\n/g, '\n')
          .replace(/(\d{2}:\d{2}:\d{2}),(\d{3})/g, '$1.$2');
    }
    const cues = parseVTT(vttText);
    if (!cues.length) {
      console.warn('[sub] parsed 0 cues from', url);
    }
    return cues;
  } catch (error) {
    console.error('Error loading subtitle file:', error, url);
    return [];
  }
}

function parseVTT(vttText) {
  const cues = [];
  const lines = String(vttText || '')
    .replace(/^\uFEFF/, '')
    .replace(/\r\n/g, '\n')
    .replace(/\r/g, '\n')
    .split('\n');
  let i = 0;

  while (i < lines.length && !lines[i].includes('-->')) {
    i++;
  }

  while (i < lines.length) {
    if (lines[i].includes('-->')) {
      const [startRaw, endRaw] = lines[i].split('-->');
      const startTime = parseTimeString(
        String(startRaw || '')
          .trim()
          .split(/\s+/)[0]
      );
      const endTime = parseTimeString(
        String(endRaw || '')
          .trim()
          .split(/\s+/)[0]
      );

      i++;
      let text = '';
      while (i < lines.length && lines[i].trim() !== '') {
        text += lines[i] + '\n';
        i++;
      }

      if (text && Number.isFinite(startTime) && Number.isFinite(endTime)) {
        cues.push({
          startTime: startTime,
          endTime: endTime,
          text: text.trim(),
        });
      }
    }
    i++;
  }
  return cues;
}

function parseTimeString(timeStr) {
  const cleaned = String(timeStr || '')
    .trim()
    .replace(',', '.');
  const parts = cleaned.split(':');
  let seconds = 0;

  if (parts.length === 3) {
    seconds =
      parseInt(parts[0], 10) * 3600 +
      parseInt(parts[1], 10) * 60 +
      parseFloat(parts[2]);
  } else if (parts.length === 2) {
    seconds = parseInt(parts[0], 10) * 60 + parseFloat(parts[1]);
  } else {
    seconds = parseFloat(cleaned);
  }

  return Number.isFinite(seconds) ? seconds : NaN;
}

let secondaryCues = [];
let primaryCues = [];

function bcCueTextHtml(text) {
  let s = String(text || '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/\n/g, '<br>');

  // Strip WebVTT internal voice (<v...>), class (<c...>), and timestamp (<00:00.000>) tags
  s = s
    .replace(/&lt;\/?(?:c|v)(?:\.[^&>]*|\s+[^&>]*)?&gt;/gi, '')
    .replace(/&lt;\d{2}:\d{2}(?::\d{2})?(?:\.\d{3})?&gt;/gi, '');

  // Restore safe subtitle formatting tags: <i>, <b>, <u>, <em>, <strong>, <font color="...">
  s = s
    .replace(/&lt;(\/?(?:i|b|u|em|strong))(?:\s+[^&>]*)?&gt;/gi, '<$1>')
    .replace(/&lt;font(\s+color=(?:&quot;[^&quot;]*&quot;|&#39;[^&#39;]*&#39;|[^\s&>]+))?\s*&gt;/gi, (m, p1) => {
      if (!p1) return '<font>';
      const cleanColor = p1.replace(/&quot;/g, '"').replace(/&#39;/g, "'");
      return '<font' + cleanColor + '>';
    })
    .replace(/&lt;\/font\s*&gt;/gi, '</font>');

  return s;
}

function bcFindActiveCue(cues, currentTime) {
  if (!cues || !cues.length) return null;
  return (
    cues.find(
      (cue) => currentTime >= cue.startTime && currentTime <= cue.endTime
    ) || null
  );
}

function bcEnsureDualOverlay() {
  let $ov = $('#bc-dual-subs');
  if ($ov.length) return $ov;
  const container = playerInstance.getContainer
    ? playerInstance.getContainer()
    : null;
  const $host = container
    ? $(container)
    : $('.jwplayer').first().length
      ? $('.jwplayer').first()
      : $('#rp-player');
  $ov = $(`
    <div id="bc-dual-subs" class="bc-dual-subs" aria-live="polite" hidden>
      <div class="bc-dual-line bc-dual-primary"></div>
      <div class="bc-dual-line bc-dual-secondary"></div>
    </div>
  `).appendTo($host);
  return $ov;
}

function bcMountDualOverlayHost() {
  const $ov = $('#bc-dual-subs');
  if (!$ov.length) return;
  const fs =
    document.fullscreenElement ||
    document.webkitFullscreenElement ||
    document.mozFullScreenElement ||
    null;
  const container = playerInstance.getContainer
    ? playerInstance.getContainer()
    : null;
  // CSS fake-fullscreen: ưu tiên #rp-player / container đang .bc-css-fullscreen
  const cssFs =
    document.querySelector('#rp-player.bc-css-fullscreen') ||
    document.querySelector('.jwplayer.bc-css-fs-player') ||
    null;
  const host =
    fs ||
    cssFs ||
    container ||
    document.getElementById('rp-player');
  if (host && $ov[0].parentElement !== host) {
    host.appendChild($ov[0]);
  }
}

function bcSubtitleOverlayActive() {
  return dualSubtitlesEnabled || singleSubtitleOverlay;
}

/** —— Mobile / iOS fullscreen: giữ phụ đề overlay (CSS FS) + fallback TextTrack —— */
let bcCssFullscreenActive = false;
let bcNativeFsPack = null;

function bcGetPlayerVideo() {
  try {
    const c =
      playerInstance && playerInstance.getContainer
        ? playerInstance.getContainer()
        : null;
    if (c) {
      const v = c.querySelector('video');
      if (v) return v;
    }
  } catch (e) {}
  return document.querySelector('#rp-player video, .jwplayer video');
}

function bcIsIosLikeDevice() {
  const ua = navigator.userAgent || '';
  if (/iPhone|iPad|iPod/i.test(ua)) return true;
  try {
    if (navigator.platform === 'MacIntel' && navigator.maxTouchPoints > 1) {
      return true;
    }
  } catch (e) {}
  return false;
}

function bcIsNativeVideoFullscreen() {
  const video = bcGetPlayerVideo();
  if (!video) return false;
  if (video.webkitDisplayingFullscreen) return true;
  const fs =
    document.fullscreenElement ||
    document.webkitFullscreenElement ||
    document.mozFullScreenElement ||
    null;
  return fs === video;
}

function bcStripHtmlToText(html) {
  const d = document.createElement('div');
  d.innerHTML = String(html || '');
  return String(d.textContent || d.innerText || '')
    .replace(/\s+/g, ' ')
    .trim();
}

function bcEnterCssFullscreen() {
  const container = playerInstance.getContainer
    ? playerInstance.getContainer()
    : null;
  const root = document.getElementById('rp-player') || container;
  if (!root) return;
  bcCssFullscreenActive = true;
  root.classList.add('bc-css-fullscreen');
  document.documentElement.classList.add('bc-css-fs-lock');
  document.body.classList.add('bc-css-fs-lock');
  if (container) {
    container.classList.add('jw-flag-fullscreen', 'bc-css-fs-player');
  }
  $('.item-max').addClass('d-none');
  $('.item-min').removeClass('d-none');
  setTimeout(function () {
    bcMountDualOverlayHost();
    bcMountTopTickerHost();
    if (bcSubtitleOverlayActive()) updateDualSubtitles();
  }, 40);
}

function bcExitCssFullscreen() {
  if (!bcCssFullscreenActive) return;
  bcCssFullscreenActive = false;
  const container = playerInstance.getContainer
    ? playerInstance.getContainer()
    : null;
  const root = document.getElementById('rp-player') || container;
  if (root) root.classList.remove('bc-css-fullscreen');
  if (container) {
    container.classList.remove('jw-flag-fullscreen', 'bc-css-fs-player');
  }
  document.documentElement.classList.remove('bc-css-fs-lock');
  document.body.classList.remove('bc-css-fs-lock');
  $('.item-max').removeClass('d-none');
  $('.item-min').addClass('d-none');
  setTimeout(function () {
    bcMountDualOverlayHost();
    if (bcSubtitleOverlayActive()) updateDualSubtitles();
  }, 40);
}

function bcEnsureNativeFsTrack() {
  const video = bcGetPlayerVideo();
  if (!video || typeof window.VTTCue === 'undefined') return null;
  if (bcNativeFsPack && bcNativeFsPack.video === video && bcNativeFsPack.track) {
    return bcNativeFsPack;
  }
  if (bcNativeFsPack && bcNativeFsPack.track) {
    try {
      bcNativeFsPack.track.mode = 'disabled';
    } catch (e) {}
  }
  let track = null;
  try {
    track = video.addTextTrack('subtitles', 'BC', 'vi');
  } catch (e) {
    return null;
  }
  track.mode = 'hidden';
  bcNativeFsPack = { video, track };
  return bcNativeFsPack;
}

function bcClearTextTrackCues(track) {
  if (!track) return;
  try {
    const list = track.cues ? Array.from(track.cues) : [];
    list.forEach(function (c) {
      try {
        track.removeCue(c);
      } catch (e) {}
    });
  } catch (e) {}
}

/** Đồng bộ màu/cỡ sub → CSS vars + stylesheet cứng cho ::cue (iOS native FS). */
function bcIsLandscapeLayout() {
  try {
    if (window.matchMedia && window.matchMedia('(orientation: landscape)').matches) {
      return true;
    }
  } catch (e) {}
  const w = window.innerWidth || 0;
  const h = window.innerHeight || 0;
  if (w > 0 && h > 0) return w > h;
  try {
    return (screen.width || 0) > (screen.height || 0);
  } catch (e2) {}
  return false;
}

function bcCollectViewportSides() {
  const vals = [];
  try {
    vals.push(window.innerWidth || 0, window.innerHeight || 0);
  } catch (e) {}
  try {
    if (window.visualViewport) {
      vals.push(window.visualViewport.width || 0, window.visualViewport.height || 0);
    }
  } catch (e) {}
  try {
    vals.push(screen.width || 0, screen.height || 0);
    vals.push(screen.availWidth || 0, screen.availHeight || 0);
  } catch (e) {}
  return vals.filter(function (n) {
    return Number.isFinite(n) && n > 0;
  });
}

/** Cạnh dài vật lý — không tin innerHeight khi native FS landscape (hay ~390). */
function bcViewportLongSide() {
  const vals = bcCollectViewportSides();
  const max = vals.length ? Math.max.apply(null, vals) : 0;
  return max >= 320 ? max : 844;
}

/** Cạnh ngắn ≈ chiều cao video landscape — dùng làm mốc cỡ chữ native FS. */
function bcViewportShortSide() {
  const vals = bcCollectViewportSides();
  if (!vals.length) return 390;
  const min = Math.min.apply(null, vals);
  return min >= 200 ? min : 390;
}

/**
 * Metrics chữ native TextTrack — bám fontSize tùy chỉnh (12–32pt).
 * Landscape chỉ bù co WebKit vừa đủ, không ép một cỡ khổng lồ.
 */
function bcNativeCueUserFontPt() {
  try {
    const saved = bcLoadCaptionStyle();
    const n = parseFloat(saved && saved.fontSize);
    if (Number.isFinite(n) && n >= 8 && n <= 72) return n;
  } catch (e) {}
  try {
    const caps =
      (typeof bcGetLiveCaptions === 'function' && bcGetLiveCaptions()) || {};
    const n = parseFloat(caps.fontSize);
    // Bỏ qua size JW đã bị thu mobile (bcEffectiveCaptionFontSize)
    if (Number.isFinite(n) && n >= 12) return n;
  } catch (e) {}
  return bcDefaultCaptionFontSize();
}

/**
 * iOS native FS: ::cue phải nhỏ — trước đây scale theo cạnh dài + transform 1.28
 * làm phụ đề chiếm nửa–toàn màn hình. Mốc = cạnh ngắn (chiều cao video).
 */
function bcNativeCueMetrics() {
  const jwSize = bcNativeCueUserFontPt();
  // Chuẩn hóa theo 18pt (menu); iOS mặc định 16 → ratio ~0.89
  const ratio = Math.max(0.5, Math.min(2.0, jwSize / 18));
  const longSide = bcViewportLongSide();
  const shortSide = bcViewportShortSide();
  const landscape = bcIsLandscapeLayout();
  const ios = typeof bcIsIosLikeDevice === 'function' && bcIsIosLikeDevice();
  const nativeFs =
    (typeof bcIsNativeVideoFullscreen === 'function' &&
      bcIsNativeVideoFullscreen()) ||
    false;

  let px;
  // Không dùng transform scale — WebKit đã vẽ cue theo font-size; scale chỉ làm to gấp đôi.
  const scale = 1;

  if (nativeFs && ios) {
    // ~4.4–4.8% chiều cao khung — to hơn chút, vẫn không chiếm nửa màn
    const pct = landscape ? 0.048 : 0.044;
    px = shortSide * pct * ratio;
    const maxPx = landscape ? 23 : 26;
    const minPx = 14;
    px = Math.max(minPx, Math.min(maxPx, Math.round(px)));
  } else if (nativeFs) {
    // Android/other native video FS
    px = shortSide * 0.044 * ratio;
    px = Math.max(14, Math.min(26, Math.round(px)));
  } else {
    // Inline / desktop (hiếm dùng TextTrack): vẫn giữ vừa phải
    px = Math.round(Math.min(longSide, shortSide * 1.6) * 0.034 * ratio);
    px = Math.max(14, Math.min(32, px));
  }

  return { px, scale, landscape, nativeFs, longSide, shortSide, jwSize };
}

/** Style tag tuyệt đối (px + scale) — CSS var đôi khi không vào được lớp fullscreen iOS. */
function bcEnsureNativeCueStyleSheet() {
  let el = document.getElementById('bc-native-cue-style');
  if (!el) {
    el = document.createElement('style');
    el.id = 'bc-native-cue-style';
    (document.head || document.documentElement).appendChild(el);
  }
  return el;
}

function bcSyncNativeCueCss() {
  try {
    const caps = bcGetLiveCaptions();
    const m = bcNativeCueMetrics();
    const px = m.px;
    const scale = m.scale;
    const textColor = bcCaptionTextColorCss(caps.color || '#ffffff');
    const bgOp = parseInt(caps.backgroundOpacity, 10) || 0;
    const bg =
      bgOp > 0 && caps.backgroundColor
        ? bcColorWithOpacity(caps.backgroundColor, bgOp)
        : 'transparent';

    const applyVars = function (node) {
      if (!node || !node.style) return;
      node.style.setProperty('--bc-native-cue-size', px + 'px');
      node.style.setProperty('--bc-native-cue-scale', String(scale));
      node.style.setProperty('--bc-native-cue-color', textColor);
      node.style.setProperty('--bc-native-cue-bg', bg);
    };

    applyVars(document.documentElement);
    applyVars(document.body);
    applyVars(document.getElementById('rp-player'));
    const video = bcGetPlayerVideo();
    if (video) {
      applyVars(video);
    }

    // Stylesheet tường minh — chỉ khi native FS (Chrome/Safari iOS)
    const sheet = bcEnsureNativeCueStyleSheet();
    if (!m.nativeFs) {
      sheet.textContent = '';
      return;
    }
    // Chỉ set font-size trên container + display; ::cue dùng 1em — tránh cộng dồn.
    sheet.textContent =
      'video::-webkit-media-text-track-container,' +
      '.bc-native-fs-subs video::-webkit-media-text-track-container{' +
      'font-size:' +
      px +
      'px !important;' +
      'transform:none !important;' +
      'overflow:visible !important;' +
      '}' +
      'video::-webkit-media-text-track-display,' +
      '.bc-native-fs-subs video::-webkit-media-text-track-display{' +
      'font-size:1em !important;' +
      'transform:none !important;' +
      'transform-origin:bottom center !important;' +
      'overflow:visible !important;' +
      'padding:0.12em 0.35em !important;' +
      'background-color:' +
      bg +
      ' !important;' +
      'border-radius:0.25em !important;' +
      '}' +
      'video::cue,' +
      '.bc-native-fs-subs video::cue{' +
      'font-size:1em !important;' +
      'color:' +
      textColor +
      ' !important;' +
      'background-color:transparent !important;' +
      'font-weight:600 !important;' +
      'line-height:1.25 !important;' +
      'text-shadow:0 1px 2px rgba(0,0,0,.9),0 0 6px rgba(0,0,0,.75) !important;' +
      '}';
  } catch (e) {}
}

function bcRefreshNativeFsCues() {
  const pack = bcEnsureNativeFsTrack();
  if (!pack || !pack.track) return;
  const track = pack.track;
  bcClearTextTrackCues(track);
  bcSyncNativeCueCss();
  const push = function (cues) {
    (cues || []).forEach(function (c) {
      const text = bcStripHtmlToText(c.text);
      if (!text) return;
      try {
        const cue = new VTTCue(
          Number(c.startTime) || 0,
          Number(c.endTime) || 0,
          text
        );
        cue.line = -2;
        cue.snapToLines = true;
        cue.align = 'center';
        cue.position = 'auto';
        // Không 96% — box quá rộng + bg → cảm giác “chiếm cả màn”
        cue.size = 80;
        track.addCue(cue);
      } catch (err) {}
    });
  };
  push(primaryCues);
  if (dualSubtitlesEnabled) push(secondaryCues);
}

function bcShowNativeFsSubs(show) {
  const container = playerInstance.getContainer
    ? playerInstance.getContainer()
    : null;
  const $root = $('#rp-player');
  const $jw = container ? $(container) : $('.jwplayer').first();
  if (show) {
    if (!bcSubtitleOverlayActive()) return;
    const pack = bcEnsureNativeFsTrack();
    if (!pack) return;
    bcRefreshNativeFsCues();
    bcSyncNativeCueCss();
    try {
      pack.track.mode = 'showing';
    } catch (e) {}
    $root.addClass('bc-native-fs-subs').removeClass('bc-dual-hide-jw');
    $jw.addClass('bc-native-fs-subs').removeClass('bc-dual-hide-jw');
    const $ov = $('#bc-dual-subs');
    if ($ov.length) $ov.prop('hidden', true).hide();
  } else {
    if (bcNativeFsPack && bcNativeFsPack.track) {
      try {
        bcNativeFsPack.track.mode = 'hidden';
      } catch (e) {}
    }
    $root.removeClass('bc-native-fs-subs');
    $jw.removeClass('bc-native-fs-subs');
    if (bcSubtitleOverlayActive()) {
      $root.addClass('bc-dual-hide-jw');
      $jw.addClass('bc-dual-hide-jw');
      const $ov = $('#bc-dual-subs');
      if ($ov.length) $ov.prop('hidden', false).show();
      updateDualSubtitles();
    }
  }
}

function bcBindNativeFullscreenEvents() {
  const video = bcGetPlayerVideo();
  if (!video || video.dataset.bcFsBound === '1') return;
  video.dataset.bcFsBound = '1';
  // playsinline: xem trong trang; vẫn gọi được webkitEnterFullscreen từ nút Full
  try {
    video.setAttribute('playsinline', '');
    video.setAttribute('webkit-playsinline', '');
    video.playsInline = true;
  } catch (e) {}
  video.addEventListener('webkitbeginfullscreen', function () {
    try {
      if (bcCssFullscreenActive) bcExitCssFullscreen();
    } catch (e) {}
    // Native iOS FS: chỉ TextTrack (::cue) hiện được + không có thanh URL
    bcShowNativeFsSubs(true);
    bcSyncNativeCueCss();
    $('.item-max').addClass('d-none');
    $('.item-min').removeClass('d-none');
  });
  video.addEventListener('webkitendfullscreen', function () {
    bcShowNativeFsSubs(false);
    $('.item-max').removeClass('d-none');
    $('.item-min').addClass('d-none');
    setTimeout(bcAfterFullscreenUiChange, 40);
  });
}

// Element Fullscreen (Android/Chrome): remount overlay + áp style sau khi FS xong
(function bcBindDocumentFullscreenOnce() {
  if (window.__bcDocFsBound) return;
  window.__bcDocFsBound = true;
  const onFs = function () {
    setTimeout(function () {
      try {
        bcAfterFullscreenUiChange();
        bcSyncNativeCueCss();
      } catch (e) {}
    }, 60);
  };
  document.addEventListener('fullscreenchange', onFs);
  document.addEventListener('webkitfullscreenchange', onFs);
})();

function bcAfterFullscreenUiChange() {
  bcBindNativeFullscreenEvents();
  if (bcIsNativeVideoFullscreen() && bcSubtitleOverlayActive()) {
    bcShowNativeFsSubs(true);
    return;
  }
  if (!bcIsNativeVideoFullscreen()) {
    bcShowNativeFsSubs(false);
  }
  // Element / CSS FS: hiện lại overlay + màu đã chọn
  if (bcCssFullscreenActive || document.fullscreenElement || document.webkitFullscreenElement) {
    $('.item-max').addClass('d-none');
    $('.item-min').removeClass('d-none');
  }
  bcMountTopTickerHost();
  if (bcSubtitleOverlayActive()) {
    bcMountDualOverlayHost();
    updateDualSubtitles();
  }
}

function bcSetDualMode(enabled) {
  dualSubtitlesEnabled = !!enabled;
  if (enabled) singleSubtitleOverlay = false;
  const $root = $('#rp-player');
  const container = playerInstance.getContainer
    ? playerInstance.getContainer()
    : null;
  const $jw = container ? $(container) : $('.jwplayer').first();
  if (enabled) {
    $root.addClass('bc-dual-on bc-dual-hide-jw');
    $jw.addClass('bc-dual-on bc-dual-hide-jw');
    // JW must not render its own captions — they fight dual sizing
    try {
      playerInstance.setCurrentCaptions(0);
    } catch (e) {}
    bcEnsureDualOverlay().prop('hidden', false).show();
    bcMountDualOverlayHost();
  } else if (!singleSubtitleOverlay) {
    $root.removeClass('bc-dual-on bc-dual-hide-jw');
    $jw.removeClass('bc-dual-on bc-dual-hide-jw');
    primaryCues = [];
    secondaryCues = [];
    const $ov = $('#bc-dual-subs');
    if ($ov.length) {
      $ov.prop('hidden', true).hide();
      $ov.find('.bc-dual-primary, .bc-dual-secondary').empty();
    }
  } else {
    // Rời song ngữ nhưng vẫn giữ overlay 1 ngôn ngữ
    $root.removeClass('bc-dual-on');
    $jw.removeClass('bc-dual-on');
    $root.addClass('bc-dual-hide-jw');
    $jw.addClass('bc-dual-hide-jw');
    secondaryCues = [];
    const $ov = bcEnsureDualOverlay();
    $ov.prop('hidden', false).show();
    $ov.find('.bc-dual-secondary').empty();
    bcMountDualOverlayHost();
  }
}

async function bcResolveTrackFromMenu($item) {
  if (!$item || !$item.length) return null;
  const trackIndex = parseInt($item.attr('data'), 10);
  // Ưu tiên index JW (0=Off) → subtitleTracks[index-1]
  if (Number.isFinite(trackIndex) && trackIndex > 0) {
    const byIndex = subtitleTracks[trackIndex - 1];
    if (byIndex) return byIndex;
  }
  const label = $item.attr('label');
  return findCaptionTrackByLabel(label);
}

async function bcLoadPrimaryCuesFromSelection() {
  if (!subtitleTracks.length && typeof playerOptions !== 'undefined') {
    subtitleTracks = sortPlayerSubtitles(playerOptions.subtitles);
  }

  let track = await bcResolveTrackFromMenu(
    $('.jw-main-caption-menu .dropdown-item.active')
  );
  if (!track) {
    let idx = 0;
    try {
      idx = playerInstance.getCurrentCaptions();
    } catch (e) {}
    if (idx > 0) track = subtitleTracks[idx - 1] || null;
  }
  if (!track && subtitleTracks.length) {
    track =
      subtitleTracks.find((t) =>
        String(t.code || '').toLowerCase().startsWith('vie')
      ) ||
      subtitleTracks.find((t) =>
        /việt|viet|vietnamese/i.test(
          String(t.name || '') + ' ' + String(t.filename || '')
        )
      ) ||
      subtitleTracks[0];
  }
  primaryCues = track ? await loadCuesFromFile(track) : [];
  return primaryCues;
}

/** Chế độ 1 ngôn ngữ: render VTT bằng overlay (cùng path với song ngữ) — JW hay fail với track Việt. */
async function bcSetSingleSubtitleOverlay(enabled) {
  singleSubtitleOverlay = !!enabled;
  if (enabled) dualSubtitlesEnabled = false;
  const $root = $('#rp-player');
  const container = playerInstance.getContainer
    ? playerInstance.getContainer()
    : null;
  const $jw = container ? $(container) : $('.jwplayer').first();
  if (enabled) {
    $root.removeClass('bc-dual-on');
    $jw.removeClass('bc-dual-on');
    $root.addClass('bc-dual-hide-jw');
    $jw.addClass('bc-dual-hide-jw');
    secondaryCues = [];
    // Load VTT trước — đừng tắt JW track trước khi đọc selection
    await bcLoadPrimaryCuesFromSelection();
    try {
      playerInstance.setCurrentCaptions(0);
    } catch (e) {}
    bcEnsureDualOverlay().prop('hidden', false).show();
    bcMountDualOverlayHost();
    updateDualSubtitles();
    if (bcIsNativeVideoFullscreen()) bcShowNativeFsSubs(true);
  } else if (!dualSubtitlesEnabled) {
    $root.removeClass('bc-dual-on bc-dual-hide-jw');
    $jw.removeClass('bc-dual-on bc-dual-hide-jw');
    primaryCues = [];
    secondaryCues = [];
    const $ov = $('#bc-dual-subs');
    if ($ov.length) {
      $ov.prop('hidden', true).hide();
      $ov.find('.bc-dual-primary, .bc-dual-secondary').empty();
    }
  }
}

function bcIsMobilePlayerLayout() {
  try {
    if (typeof isMobile !== 'undefined' && isMobile.any()) return true;
  } catch (e) {}
  try {
    if (typeof bcIsIosLikeDevice === 'function' && bcIsIosLikeDevice()) return true;
  } catch (e) {}
  const w = window.innerWidth || 0;
  if (w > 0 && w <= 768) return true;
  const container = playerInstance?.getContainer
    ? playerInstance.getContainer()
    : document.getElementById('rp-player') || document.getElementById('player');
  const cw = container && container.clientWidth;
  return Number.isFinite(cw) && cw > 0 && cw <= 768;
}

/** Mobile: nút tua ±10s hai bên Play ở giữa màn hình (theo visibility của JW display). */
function bcInjectCenterSkipButtons() {
  const $player = $('.jwplayer').first();
  if ($player.length && bcIsMobilePlayerLayout()) {
    $player.addClass('bc-mobile-center-skip');
  } else {
    $player.removeClass('bc-mobile-center-skip');
  }

  const $controls = $('.jw-display-controls');
  if (!$controls.length || $controls.find('.bc-display-skip').length) return;
  const $display = $controls.find('.jw-display-icon-display').first();
  if (!$display.length) return;

  const skipPrev =
    '<div class="jw-display-icon-container jw-reset bc-display-skip bc-display-skip-prev skip-10-prev" role="button" tabindex="0" aria-label="Tua ngược 10 giây">' +
    '<div class="jw-icon jw-button-color jw-reset">' +
    '<span class="bc-display-skip-ring" aria-hidden="true">' +
    '<svg viewBox="0 0 24 24" width="22" height="22" fill="currentColor">' +
    '<path d="M12.5 8c-2.65 0-5.05.99-6.9 2.6L2 7v9h9l-3.62-3.62c1.39-1.16 3.16-1.88 5.12-1.88 3.54 0 6.55 2.31 7.6 5.5l2.37-.78C21.08 11.03 17.15 8 12.5 8z"/>' +
    '</svg>' +
    '<span class="bc-display-skip-num">10</span>' +
    '</span></div></div>';

  const skipNext =
    '<div class="jw-display-icon-container jw-reset bc-display-skip bc-display-skip-next skip-10-next" role="button" tabindex="0" aria-label="Tua tới 10 giây">' +
    '<div class="jw-icon jw-button-color jw-reset">' +
    '<span class="bc-display-skip-ring" aria-hidden="true">' +
    '<svg viewBox="0 0 24 24" width="22" height="22" fill="currentColor">' +
    '<path d="M18.4 10.6C16.55 8.99 14.15 8 11.5 8c-4.65 0-8.58 3.03-9.96 7.22L3.9 16c1.05-3.19 4.05-5.5 7.6-5.5 1.95 0 3.73.72 5.12 1.88L13 16h9V7l-3.6 3.6z"/>' +
    '</svg>' +
    '<span class="bc-display-skip-num">10</span>' +
    '</span></div></div>';

  $display.before(skipPrev);
  $display.after(skipNext);
}

function bcIsFullscreenLayout() {
  if (typeof bcCssFullscreenActive !== 'undefined' && bcCssFullscreenActive) {
    return true;
  }
  try {
    if (typeof bcIsNativeVideoFullscreen === 'function' && bcIsNativeVideoFullscreen()) {
      return true;
    }
  } catch (e) {}
  if (document.fullscreenElement || document.webkitFullscreenElement) {
    return true;
  }
  try {
    const c =
      playerInstance && playerInstance.getContainer
        ? playerInstance.getContainer()
        : null;
    if (c && c.classList && c.classList.contains('jw-flag-fullscreen')) {
      return true;
    }
  } catch (e) {}
  return false;
}

/**
 * JW fontSize dùng hệ scale nội bộ (≈ height × 0.05 × size/14) và đôi khi
 * chỉ vẽ lại khi resize/fullscreen. Ép DOM + resize để đổi size ngay trên cửa sổ PC.
 */
function bcEffectiveCaptionFontSize(size) {
  return bcJwInternalFontSize(size);
}

function bcJwInternalFontSize(pt) {
  const n = parseFloat(pt);
  const base = Number.isFinite(n) && n > 0 ? n : bcDefaultCaptionFontSize();
  // Map menu PC 40–64 → khoảng JW ~16–26 (đọc ổn cửa sổ); mobile giữ gần số thật
  try {
    if (
      (typeof bcIsMobilePlayerLayout === 'function' && bcIsMobilePlayerLayout()) ||
      (typeof bcIsIosLikeDevice === 'function' && bcIsIosLikeDevice())
    ) {
      return Math.max(12, Math.min(26, base));
    }
  } catch (e) {}
  // 40→18, 48→20, 56→23, 64→26 (gần tuyến tính quanh default JW 14–20)
  const mapped = Math.round(10 + (base / 40) * 8);
  return Math.max(16, Math.min(28, mapped));
}

function bcForceCaptionSizeRefresh() {
  const pt = bcNativeCueUserFontPt();
  const overlayPx = (function () {
    try {
      return bcDualFontSizes().primary;
    } catch (e) {
      return Math.round(Math.max(36, Math.min(72, pt)));
    }
  })();

  try {
    const nodes = [
      document.documentElement,
      document.body,
      document.getElementById('rp-player'),
      playerInstance && playerInstance.getContainer
        ? playerInstance.getContainer()
        : null,
    ];
    nodes.forEach(function (node) {
      if (!node || !node.style) return;
      node.style.setProperty('--bc-jw-caption-size', overlayPx + 'px');
    });
  } catch (e) {}

  try {
    document
      .querySelectorAll(
        '.jwplayer .jw-text-track-cue, .jwplayer .jw-captions .jw-text-track-cue'
      )
      .forEach(function (el) {
        el.style.setProperty('font-size', overlayPx + 'px', 'important');
      });
  } catch (e2) {}

  // Bắt JW tính lại caption style (cùng lúc fullscreen trước đây mới chạy)
  try {
    const c =
      playerInstance && playerInstance.getContainer
        ? playerInstance.getContainer()
        : null;
    if (c && typeof playerInstance.resize === 'function') {
      playerInstance.resize(c.clientWidth, c.clientHeight);
    }
  } catch (e3) {}

  if (typeof bcSubtitleOverlayActive === 'function' && bcSubtitleOverlayActive()) {
    try {
      updateDualSubtitles();
    } catch (e4) {}
  }
  try {
    bcSyncNativeCueCss();
  } catch (e5) {}
}

/** Player đang bị nhúng iframe (motphim / site khác). */
function bcIsEmbeddedPlayer() {
  try {
    if (window.self !== window.top) return true;
  } catch (e) {
    return true;
  }
  try {
    const q = new URLSearchParams(window.location.search || '');
    if (q.get('embed') === '1' || q.get('embedded') === '1') return true;
  } catch (e2) {}
  return false;
}

/** Kích thước hộp video thật — không dùng screen/device khi chưa fullscreen. */
function bcPlayerBoxSize() {
  let h = 0;
  let w = 0;
  try {
    const container = playerInstance.getContainer
      ? playerInstance.getContainer()
      : null;
    const root = document.getElementById('rp-player') || container;
    if (root) {
      h = root.clientHeight || 0;
      w = root.clientWidth || 0;
    }
    if (container) {
      h = Math.max(h, container.clientHeight || 0);
      w = Math.max(w, container.clientWidth || 0);
    }
  } catch (e) {}
  try {
    const video = typeof bcGetPlayerVideo === 'function' ? bcGetPlayerVideo() : null;
    if (video) {
      const r = video.getBoundingClientRect();
      if (r && r.height > 40) h = r.height;
      if (r && r.width > 40) w = r.width;
    }
  } catch (e2) {}
  return { w: Math.round(w) || 0, h: Math.round(h) || 0 };
}

function bcDualFontSizes() {
  // Overlay: PC luôn bám setting (20–64); mobile có trần riêng; không ép PC embed về 28px
  const jwSize = bcNativeCueUserFontPt();
  const box = bcPlayerBoxSize();
  const mobile = bcIsMobilePlayerLayout() || bcIsIosLikeDevice();
  const fullscreen = bcIsFullscreenLayout();
  const embedded = !fullscreen && bcIsEmbeddedPlayer();
  let h = box.h;

  if (fullscreen) {
    const longSide = bcViewportLongSide();
    const landscape = bcIsLandscapeLayout();
    h = Math.max(h, Math.round(longSide * (landscape ? 0.52 : 0.55)));
  }
  if (!h) h = mobile ? 200 : embedded ? 360 : 480;

  let primary;
  if (mobile && fullscreen) {
    const shortSide =
      typeof bcViewportShortSide === 'function' ? bcViewportShortSide() : 390;
    primary = Math.round(
      Math.max(16, Math.min(24, shortSide * 0.038 * (jwSize / 18)))
    );
  } else if (mobile) {
    const cap = 24;
    primary = Math.round(jwSize * 1.08);
    if (h > 0 && h < 140) {
      primary = Math.round(jwSize * (h / 140));
    }
    primary = Math.round(Math.max(13, Math.min(cap, primary)));
  } else {
    // Desktop (cửa sổ / embed / fullscreen): đúng menu 20–64 (floor 20 từ
    // 24/11/2026 — trước đây floor 36 nên các cỡ 20/25/30/35 chọn được nhưng
    // không có tác dụng, đều bị kẹp về 36)
    primary = Math.round(Math.max(20, Math.min(72, jwSize || 40)));
    // Hộp rất thấp (thumbnail): co vừa đủ đọc, vẫn phân biệt các bậc size
    if (!fullscreen && h > 0 && h < 240) {
      const scale = Math.max(0.55, Math.min(1, h / 360));
      primary = Math.round(
        Math.max(20, Math.min(primary, primary * scale))
      );
    }
  }

  const subPct = parseFloat(currentConfigSub.size) || 70;
  const secondary = Math.max(
    mobile && !fullscreen ? 12 : mobile ? 13 : 16,
    Math.round(primary * Math.min(0.85, subPct / 100))
  );
  return { primary, secondary, unit: 'px' };
}

function bcApplyDualLineStyle(el, opts) {
  if (!el) return;
  const {
    show,
    fontSize,
    unit,
    weight,
    color,
    opacity,
    font,
    backgroundColor,
    backgroundOpacity,
    edgeStyle,
  } = opts;
  if (!show) {
    el.style.cssText = 'display:none;';
    return;
  }
  el.style.cssText = '';
  el.style.display = 'block';
  el.style.setProperty('font-size', `${fontSize}${unit || 'pt'}`, 'important');
  el.style.setProperty('line-height', '1.35', 'important');
  el.style.setProperty('font-weight', String(weight || 600), 'important');
  const textColor = bcCaptionTextColorCss(color || '#fff');
  el.style.setProperty('color', textColor, 'important');
  el.style.setProperty('--bc-sub-color', textColor, 'important');
  if (opacity != null) {
    el.style.setProperty('opacity', String(opacity), 'important');
  }
  el.style.setProperty(
    'font-family',
    font || '"Phimmoi Font", Arial, sans-serif',
    'important'
  );
  el.style.setProperty(
    'text-shadow',
    bcCaptionEdgeShadow(edgeStyle || 'none'),
    'important'
  );

  const bgOp = parseInt(backgroundOpacity, 10);
  const cue = el.querySelector('.bc-dual-cue');
  if (cue) {
    cue.style.setProperty('color', textColor, 'important');
    cue.style.setProperty('-webkit-text-fill-color', textColor, 'important');
    if (backgroundColor && Number.isFinite(bgOp) && bgOp > 0) {
      cue.style.setProperty(
        'background-color',
        bcColorWithOpacity(backgroundColor, bgOp),
        'important'
      );
      cue.style.setProperty('padding', '0.08em 0.35em', 'important');
      cue.style.setProperty('border-radius', '0.22em', 'important');
      cue.style.setProperty('box-decoration-break', 'clone', 'important');
      cue.style.setProperty('-webkit-box-decoration-break', 'clone', 'important');
    } else {
      cue.style.removeProperty('background-color');
      cue.style.removeProperty('padding');
      cue.style.removeProperty('border-radius');
    }
  }
}

async function updateDualSubtitles() {
  if (!bcSubtitleOverlayActive()) return;

  // iOS native video fullscreen: chỉ TextTrack — sync size khi xoay (throttle)
  if (bcIsNativeVideoFullscreen()) {
    const pack = bcEnsureNativeFsTrack();
    if (pack && pack.track && pack.track.mode !== 'showing') {
      bcShowNativeFsSubs(true);
    } else {
      const now = Date.now();
      if (!window.__bcCueSyncAt || now - window.__bcCueSyncAt > 400) {
        window.__bcCueSyncAt = now;
        bcSyncNativeCueCss();
      }
    }
    return;
  }

  const $ov = bcEnsureDualOverlay();
  bcMountDualOverlayHost();
  $ov.prop('hidden', false).show();

  const currentTime = playerInstance.getPosition() || 0;
  const primary = bcFindActiveCue(primaryCues, currentTime);
  const secondary = dualSubtitlesEnabled
    ? bcFindActiveCue(secondaryCues, currentTime)
    : null;
  const sizes = bcDualFontSizes();

  const primaryHtml = primary ? bcCueTextHtml(primary.text) : '';
  const secondaryHtml = secondary ? bcCueTextHtml(secondary.text) : '';
  const caps = bcGetLiveCaptions();
  const textColor = bcCaptionTextColorCss(caps.color || '#fff');
  const fontOpacity =
    Math.max(0, Math.min(100, parseInt(caps.fontOpacity, 10) || 100)) / 100;
  const subOpacity =
    Math.max(
      0,
      Math.min(100, parseInt(currentConfigSub.opacity, 10) || 100)
    ) / 100;

  const $root = $('#rp-player');
  const container = playerInstance.getContainer
    ? playerInstance.getContainer()
    : null;
  const $jw = container ? $(container) : $('.jwplayer').first();

  // Always hide JW captions while overlay owns the cue text
  $root.addClass('bc-dual-hide-jw');
  $jw.addClass('bc-dual-hide-jw');
  try {
    if (playerInstance.getCurrentCaptions() !== 0) {
      playerInstance.setCurrentCaptions(0);
    }
  } catch (e) {}

  const $pri = $ov.find('.bc-dual-primary');
  const $sec = $ov.find('.bc-dual-secondary');
  $ov[0].style.setProperty('--bc-sub-color', textColor);
  $pri.html(primaryHtml ? `<span class="bc-dual-cue">${primaryHtml}</span>` : '');
  $sec.html(
    secondaryHtml ? `<span class="bc-dual-cue">${secondaryHtml}</span>` : ''
  );

  bcApplyDualLineStyle($pri[0], {
    show: !!primaryHtml,
    fontSize: sizes.primary,
    unit: sizes.unit,
    weight: 700,
    color: textColor,
    opacity: fontOpacity,
    font: caps.fontFamily
      ? `"${caps.fontFamily}", Arial, sans-serif`
      : '"Phimmoi Font", Arial, sans-serif',
    backgroundColor: caps.backgroundColor,
    backgroundOpacity: caps.backgroundOpacity,
    edgeStyle: caps.edgeStyle,
  });

  bcApplyDualLineStyle($sec[0], {
    show: !!secondaryHtml,
    fontSize: sizes.secondary,
    unit: sizes.unit,
    weight: 500,
    color: bcCaptionTextColorCss(currentConfigSub.color || textColor),
    opacity: Math.min(0.95, subOpacity),
    font: currentConfigSub.font
      ? `"${currentConfigSub.font}", Arial, sans-serif`
      : '"Phimmoi Font", Arial, sans-serif',
    backgroundColor: caps.backgroundColor,
    backgroundOpacity: caps.backgroundOpacity,
    edgeStyle: caps.edgeStyle,
  });
}

$(document).on('click', '#sub-off', function () {
  $('.jw-main-caption-menu').removeClass('active');
  $('.jw-sub-caption-menu').removeClass('active');
  $('.sub-toggle-tabs .item').removeClass('active');
  $(this).addClass('active');

  playerInstance.setCurrentCaptions(0);
  singleSubtitleOverlay = false;
  bcSetDualMode(false);
});

$(document).on('click', '#sub-on', async function () {
  $('.sub-upload').addClass('d-none');
  $('.sub-sbs').removeClass('d-none');
  $('.jw-main-caption-menu').addClass('active');
  $('.jw-sub-caption-menu').removeClass('active');
  $('.sub-toggle-tabs .item').removeClass('active');
  $(this).addClass('active');

  // Một ngôn ngữ: dùng overlay + fetch VTT (JW thường không hiện track Việt sau khi tắt song ngữ)
  await bcSetSingleSubtitleOverlay(true);
});

$(document).on('click', '#sub-up', async function () {
  $('.sub-sbs').addClass('d-none');
  $('.sub-toggle-tabs .item').removeClass('active');
  $(this).addClass('active');
  $('.sub-upload').removeClass('d-none');

  singleSubtitleOverlay = false;
  bcSetDualMode(false);

  const mainIndex = $('.jw-main-caption-menu .dropdown-item.active').attr(
    'data'
  );
  if (mainIndex !== undefined) {
    playerInstance.setCurrentCaptions(parseInt(mainIndex));
  } else if (subtitleTracks.length > 0) {
    playerInstance.setCurrentCaptions(1);
  }
});

$(document).on('click', '.btn-upload-form', async function () {
  const fileInput = $('#formFile')[0];
  const nameInput = $('#formName').val().trim();
  
  if (!fileInput.files || fileInput.files.length === 0) {
    alert('Vui lòng chọn file phụ đề');
    return;
  }
  
  const file = fileInput.files[0];
  const fileName = file.name;
  const fileExtension = fileName.split('.').pop().toLowerCase();
  
  if (fileExtension !== 'vtt' && fileExtension !== 'srt') {
    alert('Chỉ chấp nhận file .vtt hoặc .srt');
    return;
  }
  
  const fileReader = new FileReader();
  
  fileReader.onload = function(e) {
    try {
      const fileContent = e.target.result;
      
      const blob = new Blob([fileContent], { type: fileExtension === 'vtt' ? 'text/vtt' : 'text/plain' });
      const objectUrl = URL.createObjectURL(blob);
      
      const subtitleName = nameInput || fileName.replace(/\.[^/.]+$/, '');

      const currentConfig = playerInstance.getConfig();
      
      const currentTracks = currentConfig.tracks || [];
      const existingTrack = currentTracks.find(t => 
        t.kind === 'subtitles' && t.file === objectUrl
      );
      
      if (existingTrack) {
        const trackIndex = currentTracks.indexOf(existingTrack);
        playerInstance.setCurrentCaptions(trackIndex);
      } else {
        const newTrack = {
          file: objectUrl,
          kind: 'subtitles',
          label: subtitleName,
          srclang: 'custom',
          default: false
        };
        
        const newConfig = {
          ...currentConfig,
          tracks: [...currentTracks, newTrack]
        };

        const currentTime = playerInstance.getPosition() || 0;
        const wasPlaying = playerInstance.getState() === "playing";

        playerInstance.load(newConfig);

        let restoreCalled = false;
        const restore = () => {
          if (restoreCalled) return;
          restoreCalled = true;
          
          setTimeout(() => {
            try {
              const duration = playerInstance.getDuration();
              
              if (duration && currentTime > 0 && currentTime < duration) {
                playerInstance.seek(currentTime);
                
                if (wasPlaying) {
                  setTimeout(() => {
                    playerInstance.play();
                  }, 200);
                }
              } else if (currentTime > 0) {
                setTimeout(() => {
                  const retryDuration = playerInstance.getDuration();
                  if (retryDuration && currentTime < retryDuration) {
                    playerInstance.seek(currentTime);
                    if (wasPlaying) {
                      setTimeout(() => {
                        playerInstance.play();
                      }, 200);
                    }
                  }
                }, 500);
              } else if (wasPlaying) {
                playerInstance.play();
              }
            } catch (e) {
              console.error('Lỗi khi restore:', e);
            }
          }, 500);
        };

        playerInstance.once("playlistItem", restore);
      }
      
      $('#sub-on').click();
    } catch (error) {
      console.error('Lỗi khi tải lên phụ đề:', error);
      alert('Có lỗi xảy ra khi tải lên phụ đề');
    }
  };
  
  fileReader.onerror = function() {
    alert('Lỗi khi đọc file');
  };
  
  // Đọc file dưới dạng text
  fileReader.readAsText(file, 'UTF-8');
});

$(document).on('click', '#sub-dual', async function () {
  $('.sub-upload').addClass('d-none');
  $('.sub-sbs').removeClass('d-none');
  $('.jw-main-caption-menu').addClass('active');
  $('.jw-sub-caption-menu').addClass('active');
  $('.sub-toggle-tabs .item').removeClass('active');
  $(this).addClass('active');

  bcSetDualMode(true);
  await bcLoadPrimaryCuesFromSelection();

  // Auto-pick a secondary track different from primary when possible
  const $secActive = $('.jw-sub-caption-menu .dropdown-item.active');
  if (!$secActive.length) {
    const mainLabel = $('.jw-main-caption-menu .dropdown-item.active').attr('label');
    const $alt = $('.jw-sub-caption-menu .dropdown-item').filter(function () {
      return $(this).attr('label') !== mainLabel;
    }).first();
    if ($alt.length) {
      $alt.trigger('click');
      return;
    }
  } else {
    const label = $secActive.attr('label');
    const trackIndex = parseInt($secActive.attr('data'), 10);
    const selectSub =
      findCaptionTrackByLabel(label) ||
      (Number.isFinite(trackIndex) ? subtitleTracks[trackIndex - 1] : null);
    if (selectSub) secondaryCues = await loadCuesFromFile(selectSub);
  }

  updateDualSubtitles();
});

async function getSubtitleTracks(masterUrl) {
  const res = await fetch(masterUrl);
  const text = await res.text();
  const lines = text.split('\n');
  const subs = [];
  for (const line of lines) {
    if (line.startsWith('#EXT-X-MEDIA:') && line.includes('TYPE=SUBTITLES')) {
      const nameMatch = line.match(/NAME="([^"]+)"/);
      const uriMatch = line.match(/URI="([^"]+)"/);
      if (nameMatch && uriMatch) {
        subs.push({
          label: nameMatch[1],
          file: uriMatch[1],
        });
      }
    }
  }
  return subs;
}

$(document).on('change', '#formFile', function () {
  const file = this.files[0];
  if (!file) return;
  const fileName = file.name;

  const nameOnly = fileName.replace(/\.[^/.]+$/, "");
  $('#formName').val(nameOnly);
});


$(document).on(
  'click',
  '.jw-sub-caption-menu.active .dropdown-item',
  async function () {
    const trackIndex = parseInt($(this).attr('data'));

    $('.jw-sub-caption-menu .dropdown-item').removeClass('active');
    $(this).addClass('active');

    if ($('#sub-dual').hasClass('active')) {
      const label = $(this).attr('label');
      const trackIndex = parseInt($(this).attr('data'), 10);
      const selectSub =
        findCaptionTrackByLabel(label) ||
        (Number.isFinite(trackIndex) ? subtitleTracks[trackIndex - 1] : null);
      if (selectSub) {
        secondaryCues = await loadCuesFromFile(selectSub);
        updateDualSubtitles();
      }
    }
  }
);

function iso6392ToSrclang(code) {
  const raw = String(code || "").toLowerCase();
  const map = { vie: "vi", eng: "en", chi: "zh", zho: "zh", kor: "ko", jpn: "ja", tha: "th" };
  if (map[raw]) return map[raw];
  const short = raw.match(/^[a-z]{3}/);
  return short ? short[0].slice(0, 2) : "vi";
}

function subtitleLangPriority(code) {
  const c = String(code || "").toLowerCase();
  const order = { vie: 1, eng: 2, jpn: 3, kor: 4, chi: 5, zho: 5 };
  return order[c] ?? 99;
}

function sortPlayerSubtitles(tracks) {
  const list = Array.isArray(tracks) ? [...tracks] : [];
  const seen = new Set();
  return list
    .filter((t) => t && t.url)
    .filter((t) => {
      const key = (t.code || t.url).toLowerCase();
      if (seen.has(key)) return false;
      seen.add(key);
      return true;
    })
    .sort((a, b) => subtitleLangPriority(a.code) - subtitleLangPriority(b.code));
}

function subtitleFileUrl(url) {
  if (!url) return "";
  if (url.startsWith("http://") || url.startsWith("https://")) return url;
  return window.location.origin + url;
}

function findDefaultSubtitleIndex(tracks) {
  const idx = tracks.findIndex((t) => String(t.code || "").toLowerCase().startsWith("vie"));
  return idx >= 0 ? idx : 0;
}

function findCaptionTrackByLabel(label) {
  if (!label) return null;
  const norm = (s) =>
    String(s || '')
      .toLowerCase()
      .normalize('NFC')
      .replace(/\s+/g, ' ')
      .trim();
  const target = norm(label);
  return (
    subtitleTracks.find((t) => {
      const lang = mapLanguageCode(t.code || t.name || '');
      const names = [
        fixVietnamese(lang.name),
        lang.name,
        t.name,
        t.code,
        t.filename
      ].map(norm);
      return names.some(
        (n) => n && (n === target || target.includes(n) || n.includes(target))
      );
    }) || null
  );
}

function fixVietnamese(str) {
  try {
    return decodeURIComponent(escape(str));
  } catch {
    return str;
  }
}

let vastData = null;

const toBLOB = async (url) => {
    const response = await fetch(url);
    return await response.blob();
};

let customControlsAdded = false;
const hash = $('#rp-player').data('hash');
const urlParams = new URLSearchParams(window.location.search);
const cdnParam = urlParams.get('cdn');
// Use signed URL if available, otherwise use basic URL
let file;
if (playerOptions.enableSignedUrl && playerOptions.signedMasterUrl) {
    file = playerOptions.signedMasterUrl;
    console.log('[Origin] Using signed URL:', file);
} else {
    file = `${window.location.origin}/stream/${hash}/master.m3u8${cdnParam ? `?cdn=${cdnParam}` : ''}`;
    console.log('[Origin] Using basic URL:', file);
}

(async () => {
  const embedded =
    (typeof bcIsEmbeddedPlayer === 'function' && bcIsEmbeddedPlayer()) ||
    (document.documentElement &&
      document.documentElement.classList.contains('bc-embed'));
  if (embedded) {
    try {
      document.documentElement.classList.add('bc-embed');
    } catch (e) {}
  }
  // Embed: streamc-style 100%x100%, không aspectratio, không fill-zoom.
  // Ẩn #player_top (gradient tối đè giữa phim trên mobile).
  const setupOpts = {
		file: file,
		type: 'hls',
		width: '100%',
		height: '100%',
		primary: 'html5',
		skin: {
			name: 'pom',
		},
		autostart: true,
		repeat: true,
		playbackRateControls: true,
		playbackRates: [0.25, 0.5, 0.75, 1, 1.25, 1.5, 2],
		allowfullscreen: true,
		playsinline: true,
		hlsjsConfig: {
			enableWorker: true,
			startFragPrefetch: true,
			testBandwidth: true,
			progressive: false,
			lowLatencyMode: false,
			maxBufferLength: 30,
			maxMaxBufferLength: 60,
			maxBufferSize: 60 * 1000 * 1000,
			maxBufferHole: 0.5,
			backBufferLength: 30,
			abrEwmaDefaultEstimate: 2_500_000,
			fragLoadingTimeOut: 20000,
			manifestLoadingTimeOut: 12000,
			levelLoadingTimeOut: 12000
		},
		volume: 100,
		mute: false,
		logo: {
			file: playerOptions.logo || '',
			position: 'top-left',
		},
		advertising: {
			tag: playerOptions.linkVast || '',
			skipoffset: playerOptions.skipOffset || 5,
		},
		captions: (function () {
			const saved = bcLoadCaptionStyle();
			return {
				fontFamily: saved.fontFamily || 'Phimmoi Font',
				fontSize: bcEffectiveCaptionFontSize(
					saved.fontSize || bcDefaultCaptionFontSize()
				),
				color: saved.color || 'white',
				fontOpacity: saved.fontOpacity ?? 100,
				edgeStyle: saved.edgeStyle || 'none',
				backgroundColor: saved.backgroundColor || '#000000',
				backgroundOpacity: saved.backgroundOpacity ?? 0,
			};
		})(),
		tracks: [
			{
				file: playerOptions.thumb || "",
				kind: "thumbnails",
			},
		
			...(function () {
				const sorted = sortPlayerSubtitles(playerOptions.subtitles);
				const defaultIdx = findDefaultSubtitleIndex(sorted);
				return sorted.map((subtitle, index) => {
					const lang = mapLanguageCode(subtitle.code || subtitle.name || "");
					return {
						file: subtitleFileUrl(subtitle.url),
						kind: "subtitles",
						label: fixVietnamese(lang.name),
						srclang: iso6392ToSrclang(subtitle.code || "vie"),
						default: index === defaultIdx,
					};
				});
			})(),
		],
	};
  if (!embedded) {
    setupOpts.aspectratio = '16:9';
  }
  playerInstance.setup(setupOpts);

  if (embedded) {
    const fitEmbed = function () {
      try {
        document.documentElement.classList.add('bc-embed');
        document.body && document.body.classList.add('bc-embed');
        // Ẩn chrome tối đè video
        ['player_top', 'player_bottom', 'video_mask', 'bc-player-boot'].forEach(function (id) {
          const el = document.getElementById(id);
          if (el) {
            el.style.setProperty('display', 'none', 'important');
            el.style.setProperty('opacity', '0', 'important');
          }
        });
        const w = Math.max(1, window.innerWidth || 0);
        const h = Math.max(1, window.innerHeight || 0);
        if (typeof playerInstance.resize === 'function' && w && h) {
          playerInstance.resize(w, h);
        }
        const root = playerInstance.getContainer
          ? playerInstance.getContainer()
          : document.querySelector('.jwplayer');
        if (root && root.classList) {
          root.classList.remove('jw-flag-aspect-mode');
        }
        document.querySelectorAll('.jw-aspect').forEach(function (el) {
          el.style.paddingBottom = '0';
          el.style.height = '100%';
        });
      } catch (e) {}
    };
    try {
      playerInstance.on('ready', fitEmbed);
      playerInstance.on('play', fitEmbed);
      window.addEventListener('resize', function () {
        clearTimeout(window.__bcEmbedFitT);
        window.__bcEmbedFitT = setTimeout(fitEmbed, 100);
      });
      setTimeout(fitEmbed, 50);
      setTimeout(fitEmbed, 500);
    } catch (e) {}
  }
})();

playerInstance.on('adPlay', function() {
  isAdPlaying = true;
});

playerInstance.on('adComplete', function() {
  isAdPlaying = false;;

  setTimeout(() => {
    addCustomControls();
}, 100);
});

playerInstance.on('adSkipped', function() {
  isAdPlaying = false;
  
  setTimeout(() => {
      addCustomControls();
  }, 100);
});

const resumeData = 'PlayerPosition-' + hash;
playerInstance.on('ready', function () {
  try {
    if (typeof window.bcSetPlayerLoad === 'function') window.bcSetPlayerLoad(55);
    window.dispatchEvent(new CustomEvent('bc-player-load', { detail: { percent: 55 } }));
  } catch (e) {}
  // Autoplay bị chặn → bỏ overlay, hiện nút play (đừng kẹt ở 48%)
  setTimeout(function () {
    try {
      var st = typeof playerInstance.getState === 'function' ? playerInstance.getState() : '';
      if (st === 'idle' || st === 'paused' || st === 'complete') {
        if (typeof window.bcHidePlayerLoad === 'function') window.bcHidePlayerLoad();
      }
    } catch (e) {}
  }, 500);

  $('#video_mask').remove();
  setTimeout(bcBindNativeFullscreenEvents, 300);
  setTimeout(bcBindNativeFullscreenEvents, 1500);

  const savedCaps = bcLoadCaptionStyle();
  playerInstance.setCaptions({
    ...playerInstance.getConfig().captions,
    ...savedCaps,
    fontFamily: savedCaps.fontFamily || 'Phimmoi Font',
    fontSize: bcJwInternalFontSize(
      savedCaps.fontSize || bcDefaultCaptionFontSize()
    ),
  });
  bcSyncSubStyleBar();
  setTimeout(bcForceCaptionSizeRefresh, 80);
  setTimeout(bcForceCaptionSizeRefresh, 500);

  // Apply initial volume settings if defined
  if (window.initialVolume !== undefined && window.initialVolume !== null) {
    playerInstance.setVolume(window.initialVolume);
  }
  if (window.initialMute === true) {
    playerInstance.setMute(true);
  }

  let currentPosition = 0;

  if (currentPosition == 0) {
    if (typeof Storage !== 'undefined') {
      if (
        localStorage[resumeData] == '' ||
        localStorage[resumeData] == 'undefined'
      ) {
        currentPosition = 0;
      } else {
        if (localStorage[resumeData] == 'null') {
          localStorage[resumeData] = 0;
        } else {
          currentPosition = localStorage[resumeData];
        }
      }

      window.onunload = function () {
        localStorage[resumeData] = playerInstance.getPosition();
      };
    } else {
      console.log('Your browser is too old!');
    }
  }

  playerInstance.once('play', function () {
    try {
      if (typeof window.bcSetPlayerLoad === 'function') window.bcSetPlayerLoad(100);
      if (typeof window.bcHidePlayerLoad === 'function') window.bcHidePlayerLoad();
    } catch (e) {}
    setTimeout(() => {
      if (
        currentPosition > 60 &&
        Math.abs(playerInstance.getDuration() - currentPosition) > 5
      ) {
        playerInstance.seek(currentPosition);
      }
    }, 500);
  });

  if ($('.jw-time-container').length > 0) {
    bcEnsureSkipIntroUI();
    bcBuildAudioMenu();
    initializeTooltips();
    return;
  }
  if (!vastData || vastData === '') {
    addCustomControls();
  } else {
    bcEnsureSkipIntroUI();
  }

  bcBuildAudioMenu();
  initializeTooltips();
});

playerInstance.on('audioTracks', function () {
  // HLS multi-audio tracks sẵn sàng sau khi media load
  const list = Array.isArray(playerOptions.audios) ? playerOptions.audios : [];
  if (list.length < 2) bcBuildAudioMenu();
});

playerInstance.on('levels', function () {
  const list = Array.isArray(playerOptions.audios) ? playerOptions.audios : [];
  if (list.length < 2) bcBuildAudioMenu();
});

playerInstance.on('play', function() {
  $('.item-play').removeClass('d-none');
  $('.item-pause').addClass('d-none');
});

playerInstance.on('pause', function() {
  $('.item-pause').removeClass('d-none');
  $('.item-play').addClass('d-none');
});


function addCustomControls() {
  const currentCaptions = bcGetLiveCaptions();

  const colorLabel = bcColorLabel(currentCaptions.color || 'white');
  const fontSize =
    (currentCaptions.fontSize || bcDefaultCaptionFontSize()) + 'pt';
  const fontOpacity = (currentCaptions.fontOpacity || '100') + '%';
  const fontFamily = currentCaptions.fontFamily || 'Arial';
  const colorValue = bcCaptionTextColorCss(currentCaptions.color || 'white');
  const edgeStyle = currentCaptions.edgeStyle || 'none';
  const colorLabel1 = bcBackgroundLabel(
    currentCaptions.backgroundColor || '#000000'
  );
  const colorValue1 = currentCaptions.backgroundColor || '#000000';
  const backgroundOpacity = (currentCaptions.backgroundOpacity || '0') + '%';

  const colorLabelSub = bcColorLabel(currentConfigSub.color || 'white');
  const colorValueSub = currentConfigSub.color || '#fff';

  let savedPlayerColor = BC_PLAYER_COLOR_DEFAULT;
  try {
    savedPlayerColor = bcNormalizeHexColor(
      localStorage.getItem(BC_PLAYER_COLOR_KEY) || BC_PLAYER_COLOR_DEFAULT
    );
  } catch (e) {}
  const playerColorMenuHtml = BC_PLAYER_COLOR_PRESETS.map((p) => {
    const active =
      bcNormalizeHexColor(p.value) === savedPlayerColor ? ' active' : '';
    return `<a class="cs-item line-center${active}" data-chrome-color="${p.value}">
                         <div class="csi-color" style="background-color: ${p.value};"></div>
                         <div class="csi-title">${p.label}</div>
                         <i class="fa-solid fa-check"></i>
                       </a>`;
  }).join('');

  const savedIntroSkip = bcGetIntroSkipSec();
  const introSkipMenuHtml = BC_INTRO_SKIP_PRESETS.map((p) => {
    const active = p.value === savedIntroSkip ? ' active' : '';
    return `<a class="cs-item line-center${active}" data-intro-skip="${p.value}">
                         <div class="csi-title">${p.label}</div>
                         <i class="fa-solid fa-check"></i>
                       </a>`;
  }).join('');
  
  $('.jw-button-container').remove();
  $('.jw-controlbar')
  .prepend(`<div class="jw-time-container jw-icon-inline jw-text jw-reset">
              <div class="jw-icon jw-icon-inline jw-text jw-reset jw-text-elapsed" role="timer">00:00</div>
              <div class="jw-text-div"></div>
              <div class="jw-icon jw-icon-inline jw-text jw-reset jw-text-countdown" role="timer">00:00</div>
              <div class="jw-icon jw-icon-inline jw-text jw-reset jw-text-duration" role="timer">00:00</div>
            </div>`);
  $('.jw-slider-time').addClass('b_bar jw-chapter-slider-time');
  $('.jw-controlbar').append(`<div class="b_func">
    <div class="p_b-left line-center gap-4">
                 <div class="item-btn item-pause jw-btn-play d-none" data-bs-toggle="tooltip" data-bs-custom-class="custom-tooltip" data-bs-placement="top" data-bs-title="Tạm dừng">
                   <div class="inc-icon icon-large">
                     <svg fill="none" height="512" viewBox="0 0 24 24" width="512" xmlns="http://www.w3.org/2000/svg">
                       <path d="m10.8 15.9 4.67-3.5c.27-.2.27-.6 0-.8l-4.67-3.5c-.33-.25-.8-.01-.8.4v7c0 .41.47.65.8.4zm1.2-13.9c-5.52 0-10 4.48-10 10s4.48 10 10 10 10-4.48 10-10-4.48-10-10-10zm0 18c-4.41 0-8-3.59-8-8s3.59-8 8-8 8 3.59 8 8-3.59 8-8 8z" fill="currentColor"></path>
                     </svg>
                   </div>
                 </div>
                 <div class="item-btn item-play jw-btn-play d-none" data-bs-toggle="tooltip" data-bs-custom-class="custom-tooltip" data-bs-placement="top" data-bs-title="Phát">
                   <div class="inc-icon  icon-large">
                     <svg fill="none" height="512" viewBox="0 0 24 24" width="512" xmlns="http://www.w3.org/2000/svg">
                       <path d="m10 16c.55 0 1-.45 1-1v-6c0-.55-.45-1-1-1s-1 .45-1 1v6c0 .55.45 1 1 1zm2-14c-5.52 0-10 4.48-10 10s4.48 10 10 10 10-4.48 10-10-4.48-10-10-10zm0 18c-4.41 0-8-3.59-8-8s3.59-8 8-8 8 3.59 8 8-3.59 8-8 8zm2-4c.55 0 1-.45 1-1v-6c0-.55-.45-1-1-1s-1 .45-1 1v6c0 .55.45 1 1 1z" fill="currentColor"></path>
                     </svg>
                   </div>
                 </div>
                 <div class="line-center gap-2">
                   <div class="item-btn skip-10-prev" data-bs-toggle="tooltip" data-bs-custom-class="custom-tooltip" data-bs-placement="top" data-bs-title="10s trước">
                     <div class="line-center">
                       <div class="inc-icon">
                         <svg width="396" height="430" viewBox="0 0 396 430" fill="none" xmlns="http://www.w3.org/2000/svg">
                           <g fill="currentColor">
                             <path d="M237.342 26.3129C243.281 20.3742 243.281 10.7449 237.342 4.80589C231.403 -1.13321 221.773 -1.13321 215.835 4.80589L178.779 41.8615C178.72 41.9187 178.661 41.9765 178.603 42.0348C175.633 45.0044 174.148 48.8971 174.149 52.7894C174.148 56.6821 175.633 60.5748 178.603 63.5444C178.661 63.6027 178.72 63.6605 178.779 63.7178L215.835 100.773C221.773 106.713 231.403 106.713 237.342 100.773C243.281 94.8342 243.281 85.205 237.342 79.2663L225.235 67.1593C254.972 72.106 283 85.0372 306.208 104.807C336.452 130.57 356.532 166.263 362.848 205.487C369.165 244.711 361.305 284.903 340.677 318.858C320.05 352.813 288.003 378.312 250.282 390.783C212.56 403.255 171.63 401.885 134.828 386.919C98.0256 371.951 67.7562 344.366 49.4459 309.108C31.1355 273.849 25.9816 233.222 34.9071 194.508C43.8326 155.794 66.2547 121.524 98.1538 97.8413C104.898 92.8343 106.306 83.3091 101.299 76.5649C96.2924 69.8212 86.7666 68.4135 80.0229 73.4199C42.3199 101.412 15.8181 141.916 5.26888 187.674C-5.28085 233.432 0.811443 281.452 22.4528 323.125C44.0947 364.8 79.8708 397.403 123.37 415.093C166.868 432.784 215.246 434.403 259.83 419.662C304.414 404.921 342.292 374.783 366.672 334.65C391.052 294.517 400.343 247.012 392.877 200.651C385.412 154.291 361.679 112.104 325.932 81.653C297.666 57.5743 263.349 42.0784 227.007 36.6477L237.342 26.3129Z">
                             </path>
                             <path d="M150.883 149.325C150.883 131.568 129.676 122.388 116.729 134.54L90.9877 158.701C84.8635 164.449 84.5588 174.073 90.3069 180.197C96.055 186.321 105.68 186.626 111.803 180.878L120.467 172.746V312.954C120.467 321.354 127.276 328.162 135.675 328.162C144.074 328.162 150.883 321.354 150.883 312.954V149.325Z">
                             </path>
                             <path fill-rule="evenodd" clip-rule="evenodd" d="M190.579 187.772C190.579 159.154 213.779 135.953 242.398 135.953C271.016 135.953 294.217 159.154 294.217 187.772V276.358C294.217 304.976 271.016 328.176 242.398 328.176C213.779 328.176 190.579 304.976 190.579 276.358V187.772ZM263.801 187.772V276.358C263.801 288.178 254.218 297.761 242.398 297.761C230.577 297.761 220.995 288.178 220.995 276.358V187.772C220.995 175.952 230.577 166.369 242.398 166.369C254.218 166.369 263.801 175.952 263.801 187.772Z">
                             </path>
                           </g>
                         </svg>
                       </div>
                     </div>
                   </div>
                   <div class="item-btn skip-10-next" data-bs-toggle="tooltip" data-bs-custom-class="custom-tooltip" data-bs-placement="top" data-bs-title="10s sau">
                     <div class="line-center">
                       <div class="inc-icon">
                         <svg width="396" height="430" viewBox="0 0 396 430" fill="none" xmlns="http://www.w3.org/2000/svg">
                           <g fill="currentColor">
                             <path d="M158.267 26.3129C152.327 20.3742 152.327 10.7449 158.267 4.80589C164.206 -1.13321 173.835 -1.13321 179.774 4.80589L216.829 41.8615C216.889 41.9187 216.947 41.9765 217.005 42.0348C219.975 45.0044 221.46 48.8971 221.46 52.7894C221.46 56.6821 219.975 60.5748 217.005 63.5444C216.947 63.6027 216.889 63.6605 216.829 63.7178L179.774 100.773C173.835 106.713 164.206 106.713 158.267 100.773C152.327 94.8342 152.327 85.205 158.267 79.2663L170.374 67.1593C140.637 72.106 112.608 85.0372 89.4001 104.807C59.1561 130.57 39.0766 166.263 32.7602 205.487C26.4439 244.711 34.3038 284.903 54.9314 318.858C75.5589 352.813 107.605 378.312 145.327 390.783C183.048 403.255 223.978 401.885 260.781 386.919C297.583 371.951 327.852 344.366 346.163 309.108C364.473 273.849 369.627 233.222 360.701 194.508C351.776 155.794 329.354 121.524 297.455 97.8413C290.711 92.8343 289.303 83.3091 294.31 76.5649C299.316 69.8212 308.842 68.4135 315.585 73.4199C353.288 101.412 379.79 141.916 390.34 187.674C400.889 233.432 394.797 281.452 373.156 323.125C351.514 364.8 315.738 397.403 272.239 415.093C228.74 432.784 180.363 434.403 135.778 419.662C91.1941 404.921 53.3168 374.783 28.9365 334.65C4.55614 294.517 -4.73438 247.012 2.73119 200.651C10.1968 154.291 33.9297 112.104 69.6765 81.653C97.9424 57.5743 132.259 42.0784 168.601 36.6477L158.267 26.3129Z">
                             </path>
                             <path d="M150.883 149.325C150.883 131.568 129.676 122.388 116.729 134.54L90.9877 158.701C84.8635 164.449 84.5588 174.073 90.3069 180.197C96.055 186.321 105.68 186.626 111.803 180.878L120.467 172.746V312.954C120.467 321.354 127.276 328.162 135.675 328.162C144.074 328.162 150.883 321.354 150.883 312.954V149.325Z">
                             </path>
                             <path fill-rule="evenodd" clip-rule="evenodd" d="M190.579 187.772C190.579 159.154 213.779 135.953 242.398 135.953C271.016 135.953 294.217 159.154 294.217 187.772V276.358C294.217 304.976 271.016 328.176 242.398 328.176C213.779 328.176 190.579 304.976 190.579 276.358V187.772ZM263.801 187.772V276.358C263.801 288.178 254.218 297.761 242.398 297.761C230.577 297.761 220.995 288.178 220.995 276.358V187.772C220.995 175.952 230.577 166.369 242.398 166.369C254.218 166.369 263.801 175.952 263.801 187.772Z">
                             </path>
                           </g>
                         </svg>
                       </div>
                     </div>
                   </div>
                 </div>
                 <div class="item-volume ps-3">
                   <div class="iv-volume line-center gap-3">
                     <i class="fa-solid fa-volume-high iv-icon btn-muted" data-bs-toggle="tooltip" data-bs-custom-class="custom-tooltip" data-bs-placement="top" data-bs-title="Tắt tiếng"></i>
                     <div id="volume" class="iv-bar">
                       <div class="iv-load" style="width: 100%;"></div>
                     </div>
                   </div>
                 </div>
               </div>
               <div class="p_b-right line-center gap-4">
                 <div class="item-btn item-next d-none" data-bs-toggle="tooltip" data-bs-custom-class="custom-tooltip" data-bs-placement="top" data-bs-title="">
                   <div class="line-center">
                     <div class="inc-icon">
                       <svg height="512" viewBox="0 0 24 24" width="512" xmlns="http://www.w3.org/2000/svg">
                         <path fill="currentColor" d="m4.028 20.882a1 1 0 0 0 1.027-.05l12-8a1 1 0 0 0 0-1.664l-12-8a1 1 0 0 0 -1.555.832v16a1 1 0 0 0 .528.882zm1.472-15.013 9.2 6.131-9.2 6.131z">
                         </path>
                         <path fill="currentColor" d="m19.5 19a1 1 0 0 0 1-1v-12a1 1 0 0 0 -2 0v12a1 1 0 0 0 1 1z"></path>
                       </svg>
                     </div>
                     <span>Tập sau</span>
                   </div>
                 </div>

                 <div class="item-btn item-audio jw-audio-button d-none" data-bs-toggle="dropdown" data-bs-auto-close="outside" aria-expanded="false">
                    <div class="line-center" data-bs-toggle="tooltip" data-bs-custom-class="custom-tooltip" data-bs-placement="top" data-bs-title="Audio / Thuyết minh">
                      <div class="inc-icon">
                        <svg width="40" height="41" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
                          <path d="M3 10C2.4 11 2.4 13 3 14" stroke="currentColor" stroke-width="2" stroke-linecap="round"/>
                          <path d="M6 8C5 10 5 14 6 16" stroke="currentColor" stroke-width="2" stroke-linecap="round"/>
                          <path d="M21 10C21.6 11 21.6 13 21 14" stroke="currentColor" stroke-width="2" stroke-linecap="round"/>
                          <path d="M18 8C19 10 19 14 18 16" stroke="currentColor" stroke-width="2" stroke-linecap="round"/>
                          <rect x="9" y="3" width="6" height="10" rx="3" stroke="currentColor" stroke-width="2" fill="none"/>
                          <path d="M6 11a6 6 0 0 0 12 0" stroke="currentColor" stroke-width="2" stroke-linecap="round"/>
                          <line x1="12" y1="17" x2="12" y2="21" stroke="currentColor" stroke-width="2" stroke-linecap="round"/>
                          <line x1="9" y1="21" x2="15" y2="21" stroke="currentColor" stroke-width="2" stroke-linecap="round"/>
                        </svg>
                      </div>
                      <span class="jw-audio-label">Audio</span>
                    </div>
                  </div>
                  <ul class="dropdown-menu player-dm dm-audio jw-audio-menu">
                    <div class="dropdown-title"><span>Audio / Thuyết minh</span></div>
                    <div class="jw-audio-menu-list"></div>
                  </ul>

                 <div class="item-btn item-sub jw-caption-button d-none" data-bs-toggle="dropdown" data-bs-auto-close="outside" aria-expanded="false">
                    <div class="line-center" data-bs-toggle="tooltip" data-bs-custom-class="custom-tooltip" data-bs-placement="top" data-bs-title="Phụ đề">
                      <div class="inc-icon">
                        <svg width="40" height="41" viewBox="0 0 40 41" fill="none" xmlns="http://www.w3.org/2000/svg">
                          <path d="M33.75 30.5H6.25C5.25544 30.5 4.30161 30.1049 3.59835 29.4017C2.89509 28.6984 2.5 27.7446 2.5 26.75V9.25C2.5 8.25544 2.89509 7.30161 3.59835 6.59835C4.30161 5.89509 5.25544 5.5 6.25 5.5H33.75C34.7446 5.5 35.6984 5.89509 36.4016 6.59835C37.1049 7.30161 37.5 8.25544 37.5 9.25V26.75C37.5 27.7446 37.1049 28.6984 36.4016 29.4017C35.6984 30.1049 34.7446 30.5 33.75 30.5ZM6.25 8C5.91848 8 5.60054 8.1317 5.36612 8.36612C5.1317 8.60054 5 8.91848 5 9.25V26.75C5 27.0815 5.1317 27.3995 5.36612 27.6339C5.60054 27.8683 5.91848 28 6.25 28H33.75C34.0815 28 34.3995 27.8683 34.6339 27.6339C34.8683 27.3995 35 27.0815 35 26.75V9.25C35 8.91848 34.8683 8.60054 34.6339 8.36612C34.3995 8.1317 34.0815 8 33.75 8H6.25ZM18 23C18 22.6685 17.8683 22.3505 17.6339 22.1161C17.3995 21.8817 17.0815 21.75 16.75 21.75H11.75C11.6515 21.75 11.554 21.7306 11.463 21.6929C11.372 21.6552 11.2893 21.6 11.2197 21.5303C11.15 21.4607 11.0948 21.378 11.0571 21.287C11.0194 21.196 11 21.0985 11 21V15C11 14.8011 11.079 14.6103 11.2197 14.4697C11.3603 14.329 11.5511 14.25 11.75 14.25H16.75C17.0815 14.25 17.3995 14.1183 17.6339 13.8839C17.8683 13.6495 18 13.3315 18 13C18 12.6685 17.8683 12.3505 17.6339 12.1161C17.3995 11.8817 17.0815 11.75 16.75 11.75H11.75C10.8891 11.7533 10.0643 12.0968 9.45554 12.7055C8.84676 13.3143 8.50329 14.1391 8.5 15V21C8.50329 21.8609 8.84676 22.6857 9.45554 23.2945C10.0643 23.9032 10.8891 24.2467 11.75 24.25H16.75C17.0815 24.25 17.3995 24.1183 17.6339 23.8839C17.8683 23.6495 18 23.3315 18 23ZM31.5 23C31.5 22.6685 31.3683 22.3505 31.1339 22.1161C30.8995 21.8817 30.5815 21.75 30.25 21.75H25.25C25.0521 21.7468 24.8632 21.6667 24.7232 21.5268C24.5833 21.3868 24.5032 21.1979 24.5 21V15C24.5032 14.8021 24.5833 14.6132 24.7232 14.4732C24.8632 14.3333 25.0521 14.2532 25.25 14.25H30.25C30.5815 14.25 30.8995 14.1183 31.1339 13.8839C31.3683 13.6495 31.5 13.3315 31.5 13C31.5 12.6685 31.3683 12.3505 31.1339 12.1161C30.8995 11.8817 30.5815 11.75 30.25 11.75H25.25C24.3891 11.7533 23.5643 12.0968 22.9555 12.7055C22.3468 13.3143 22.0033 14.1391 22 15V21C22.0033 21.8609 22.3468 22.6857 22.9555 23.2945C23.5643 23.9032 24.3891 24.2467 25.25 24.25H30.25C30.5815 24.25 30.8995 24.1183 31.1339 23.8839C31.3683 23.6495 31.5 23.3315 31.5 23ZM37.5 34.25C37.5 33.9185 37.3683 33.6005 37.1339 33.3661C36.8995 33.1317 36.5815 33 36.25 33H3.75C3.41848 33 3.10054 33.1317 2.86612 33.3661C2.6317 33.6005 2.5 33.9185 2.5 34.25C2.5 34.5815 2.6317 34.8995 2.86612 35.1339C3.10054 35.3683 3.41848 35.5 3.75 35.5H36.25C36.5815 35.5 36.8995 35.3683 37.1339 35.1339C37.3683 34.8995 37.5 34.5815 37.5 34.25Z" fill="currentColor"></path>
                        </svg>
                      </div>
                      <span>Phụ đề</span>
                    </div>
                  </div>
                  <ul class="dropdown-menu player-dm dm-sub ">
                    <div class="dropdown-title">
                      <div class="line-center w-100">
                        <span data-bs-toggle="tooltip" data-bs-custom-class="custom-tooltip" data-bs-placement="top" data-bs-title="Hiển thị 2 phụ đề cùng lúc">Phụ đề</span>
                        <div class="flex-grow-1"></div>
                        <div class="sub-toggle-tabs line-center jw-caption-switch">
                          <a id="sub-on" data="on" class="item">Bật</a>
                          <a id="sub-dual" data="doul" class="item">Song ngữ</a>
                          <a id="sub-off" data="off" class="item">Tắt</a>
                          <a id="sub-up" data="upload" class="item"><i class="fa-solid fa-arrow-up-from-bracket"></i></a>
                          <a id="toggle-subs" data="setting" class="item item-circle"><i class="fa-solid fa-gear"></i></a>
                        </div>
                      </div>
                    </div>
                    <div class="sub-sbs">
                      <div class="sub-col is-primary jw-main-caption-menu">
                      </div>
                      <div class="sub-col is-secondary jw-sub-caption-menu">
                      </div>
                    </div>
                    <div class="sub-upload d-none">
                        <div class="m-group">
                            <div class="small">Tải lên phụ đề (.vtt, .srt) </div>
                            <div class="upload-form">
                                <input class="form-control form-control-sm" type="file" id="formFile" accept=".vtt,.srt">
                            </div>
                        </div>
                        <div class="m-group">
                            <div class="small">Đặt tên phụ đề</div>
                            <input type="text" id="formName" class="form-control form-control-sm form-dark" placeholder="Nhập tên">
                        </div>
                        <div class="buttons mt-1">
                            <a class="btn btn-sm btn-primary btn-upload-form">
                                <div class="line-center">
                                    <i class="fa-solid fa-arrow-up-from-bracket"></i>
                                    <span>Tải lên</span>
                                </div>
                            </a>
                        </div>
                    </div>
                    <div class="bc-sub-style-bar">
                      <div class="bc-sub-style-row">
                        <div class="bc-sub-style-label">Màu chữ phụ đề</div>
                        <div class="bc-sub-swatches bc-sub-text-colors">
                          ${arrayColor
                            .map(
                              (item) =>
                                `<button type="button" class="bc-swatch" data-sub-color="${item.color}" title="${item.label}" aria-label="${item.label}" style="background:${item.color};"></button>`
                            )
                            .join('')}
                        </div>
                      </div>
                      <div class="bc-sub-style-row">
                        <div class="bc-sub-style-label">Màu nền phụ đề</div>
                        <div class="bc-sub-swatches bc-sub-bg-colors">
                          <button type="button" class="bc-swatch bc-swatch-none" data-sub-bg="none" title="Trong suốt" aria-label="Trong suốt">∅</button>
                          ${arrayBackground
                            .slice(0, 8)
                            .map(
                              (item) =>
                                `<button type="button" class="bc-swatch" data-sub-bg="${item.background}" title="${item.label}" aria-label="${item.label}" style="background:${item.background};"></button>`
                            )
                            .join('')}
                        </div>
                      </div>
                      <div class="bc-sub-style-row">
                        <div class="bc-sub-style-label">Độ trong nền</div>
                        <div class="bc-sub-swatches bc-sub-bg-opacity">
                          ${[0, 25, 50, 75, 100]
                            .map(
                              (op) =>
                                `<button type="button" class="bc-swatch-op" data-sub-bg-opacity="${op}" aria-label="Độ nền ${op}%">${op}%</button>`
                            )
                            .join('')}
                        </div>
                        </div>
                    </div>
                  </ul>
                 
                 <div class="item-btn item-pip jw-float-player" data-bs-toggle="tooltip" data-bs-custom-class="custom-tooltip" data-bs-placement="top" data-bs-title="Xem dạng cửa sổ">
                   <div class="line-center">
                     <div class="inc-icon">
                       <svg width="98" height="98" viewBox="0 0 98 98" fill="none" xmlns="http://www.w3.org/2000/svg">
                         <path d="M4.08334 14.1667C4.08334 10.853 6.76964 8.16675 10.0833 8.16675H75.6667C78.9804 8.16675 81.6667 10.853 81.6667 14.1667V35.6251C81.6667 37.374 80.2489 38.7917 78.5 38.7918V38.7918V38.7918C76.8432 38.7918 75.5 37.4486 75.5 35.7918V26.5V20.5C75.5 17.1863 72.8137 14.5 69.5 14.5L17 14.5C13.6863 14.5 11 17.1863 11 20.5V56.5C11 59.8137 13.6863 62.5 17 62.5L21 62.5C22.933 62.5 24.5 64.067 24.5 66V66V66C24.5 67.887 22.9703 69.4167 21.0833 69.4167H10.0833C6.76963 69.4167 4.08334 66.7305 4.08334 63.4167V14.1667Z" fill="currentColor"></path>
                         <path fill-rule="evenodd" clip-rule="evenodd" d="M36.75 53.0833C36.75 50.8282 38.5782 49 40.8333 49H89.8333C92.0885 49 93.9167 50.8282 93.9167 53.0833V85.75C93.9167 88.0052 92.0885 89.8333 89.8333 89.8333H40.8333C38.5782 89.8333 36.75 88.0052 36.75 85.75V53.0833ZM49 57.1667C46.7448 57.1667 44.9167 58.9948 44.9167 61.25V77.5833C44.9167 79.8385 46.7448 81.6667 49 81.6667H81.6667C83.9218 81.6667 85.75 79.8385 85.75 77.5833V61.25C85.75 58.9948 83.9218 57.1667 81.6667 57.1667H49Z" fill="currentColor"></path>
                         <path d="M40.8333 53.0833H89.8333V85.75H40.8333V53.0833Z" fill="currentColor">
                         </path>
                       </svg>

                     </div>
                     <span>PiP</span>
                   </div>
                 </div>
                 <div class="item-btn item-setup" data-bs-toggle="dropdown" data-bs-auto-close="outside" aria-expanded="false">
                   <div class="line-center" data-bs-toggle="tooltip" data-bs-custom-class="custom-tooltip" data-bs-placement="top">
                     <div class="inc-icon icon-quality">

                       <svg width="40" height="40" viewBox="0 0 40 40" fill="none" xmlns="http://www.w3.org/2000/svg">
                         <path d="M35.2488 14.8255V25.1732C35.2488 26.8355 34.3618 28.3712 32.9218 29.203L23.9623 34.376C22.5222 35.208 20.7482 35.208 19.3082 34.376L10.3469 29.203C8.90852 28.3712 8.02148 26.8355 8.02148 25.1732V14.8255C8.02148 13.1633 8.90852 11.6276 10.3469 10.7974L19.3082 5.62271C20.7482 4.79243 22.5222 4.79243 23.9623 5.62271L32.9218 10.7974C34.3618 11.6276 35.2488 13.1633 35.2488 14.8255Z" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"></path>
                         <path d="M21.6335 24.6114C24.181 24.6114 26.2453 22.5471 26.2453 19.9994C26.2453 17.4518 24.181 15.3875 21.6335 15.3875C19.0858 15.3875 17.0215 17.4518 17.0215 19.9994C17.0215 22.5471 19.0858 24.6114 21.6335 24.6114Z" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"></path>
                       </svg>
                       <span class="q-play">Auto</span>
                     </div>
                     <span>Cài đặt</span>
                   </div>
                 </div>
                 <ul class="dropdown-menu player-dm">
                   <div class="content-slide">
                     <div class="dropdown-title">
                       <span class="s-title">Cài đặt</span>
                     </div>
                     <div class="cs-list">
                       <a id="toggle-quality" class="cs-item line-center">
                         <div class="csi-title">Chất lượng</div>
                         <div class="csi-current line-center">
                           <span class="jw-title-quality">Auto (1080P)</span>
                           <i class="fa-solid fa-angle-right"></i>
                         </div>
                       </a>
                       <a id="toggle-caption" class="cs-item line-center">
                         <div class="csi-title">Phụ đề</div>
                         <div class="csi-current line-center">
                           <span>Tuỳ chỉnh</span>
                           <i class="fa-solid fa-angle-right"></i>
                         </div>
                       </a>
                       <a id="toggle-speed" class="cs-item line-center">
                         <div class="csi-title">Tốc độ</div>
                         <div class="csi-current line-center">
                           <span class="jw-speed-text">1x</span>
                           <i class="fa-solid fa-angle-right"></i>
                         </div>
                       </a>
                       <a id="toggle-player-color" class="cs-item line-center">
                         <div class="csi-title">Màu player</div>
                         <div class="csi-current line-center">
                           <span class="jw-player-color-text">${savedPlayerColor.toUpperCase()}</span>
                           <i class="fa-solid fa-angle-right"></i>
                         </div>
                       </a>
                       <a id="toggle-intro-skip" class="cs-item line-center">
                         <div class="csi-title">Bỏ qua giới thiệu</div>
                         <div class="csi-current line-center">
                           <span class="jw-intro-skip-text">${savedIntroSkip === 0 ? 'Tắt' : bcFormatSkipTime(savedIntroSkip)}</span>
                           <i class="fa-solid fa-angle-right"></i>
                         </div>
                       </a>
                     </div>
                   </div>
                   <div id="sub-intro-skip" class="sub-slide level-1" style="display: none;">
                     <div class="dropdown-title">
                       <span class="s-title sub-back line-center">
                         <i class="fa-solid fa-angle-left"></i>
                         Bỏ qua giới thiệu
                       </span>
                     </div>
                     <div class="cs-list jw-intro-skip-menu">
                       ${introSkipMenuHtml}
                     </div>
                   </div>
                   <div id="sub-player-color" class="sub-slide level-1" style="display: none;">
                     <div class="dropdown-title">
                       <span class="s-title sub-back line-center">
                         <i class="fa-solid fa-angle-left"></i>
                         Màu player
                       </span>
                     </div>
                     <div class="cs-list jw-player-color-menu">
                       ${playerColorMenuHtml}
                       <div class="cs-item line-center bc-player-color-custom">
                         <div class="csi-title">Tuỳ chọn</div>
                         <input type="color" id="bc-player-color-input" value="${savedPlayerColor}" title="Chọn màu" />
                       </div>
                     </div>
                   </div>
                   <div id="sub-quality" class="sub-slide level-1" style="display: none;">
                     <div class="dropdown-title">
                       <span class="s-title sub-back line-center">
                         <i class="fa-solid fa-angle-left"></i>
                         Chất lượng
                       </span>
                     </div>
                     <div class="cs-list jw-quality-menu">
                     </div>
                   </div>
                   <div id="sub-speed" class="sub-slide level-1" style="display: none;">
                     <div class="dropdown-title">
                       <span class="s-title sub-back line-center">
                         <i class="fa-solid fa-angle-left"></i>
                         Tốc độ
                       </span>
                     </div>
                     <div class="cs-list jw-playback-rate">
                       <a class="cs-item line-center" data="0.25">
                         <div class="csi-title">0.25x</div>
                         <i class="fa-solid fa-check"></i>
                       </a>
                       <a class="cs-item line-center" data="0.5">
                         <div class="csi-title">0.5x</div>
                         <i class="fa-solid fa-check"></i>
                       </a>
                       <a class="cs-item line-center active" data="1">
                         <div class="csi-title">1x</div>
                         <i class="fa-solid fa-check"></i>
                       </a>
                       <a class="cs-item line-center" data="1.25">
                         <div class="csi-title">1.25x</div>
                         <i class="fa-solid fa-check"></i>
                       </a>
                       <a class="cs-item line-center" data="1.5">
                         <div class="csi-title">1.5x</div>
                         <i class="fa-solid fa-check"></i>
                       </a>
                       <a class="cs-item line-center" data="2">
                         <div class="csi-title">2x</div>
                         <i class="fa-solid fa-check"></i>
                       </a>
                     </div>
                   </div>


                   <div id="sub-caption" class="sub-slide level-1" style="display: none;">
                     <div class="dropdown-title">
                       <span class="s-title sub-back line-center">
                         <i class="fa-solid fa-angle-left"></i>
                         Tuỳ chỉnh
                       </span>
                     </div>
                     <div class="cs-list jw-subtitle-setting-menu">
                       <div class="csl-primary">
                         <div class="dropdown-title py-1">
                           <span class="s-title small">Phụ đề chính</span>
                         </div>
                         <a id="toggle-font" class="cs-item line-center" data-type="color">
                           <div class="csi-title">Màu chữ</div>
                           <div class="csi-current line-center">
                             <div class="csi-color" style="background-color: ${colorValue};"></div>
                             <span>${colorLabel}</span>
                             <i class="fa-solid fa-angle-right"></i>
                           </div>
                         </a>
                         <a id="toggle-size" class="cs-item line-center" data-type="fontSize">
                           <div class="csi-title">Cỡ chữ</div>
                           <div class="csi-current line-center">
                             <span>${fontSize}</span>
                             <i class="fa-solid fa-angle-right"></i>
                           </div>
                         </a>
                         <a id="toggle-opacity-font" class="cs-item line-center" data-type="fontOpacity">
                           <div class="csi-title">Độ trong</div>
                           <div class="csi-current line-center">
                             <span>${fontOpacity}</span>
                             <i class="fa-solid fa-angle-right"></i>
                           </div>
                         </a>
                         <a id="toggle-font-family" class="cs-item line-center" data-type="fontFamily">
                           <div class="csi-title">Font chữ</div>
                           <div class="csi-current line-center">
                             <span>${fontFamily}</span>
                             <i class="fa-solid fa-angle-right"></i>
                           </div>
                         </a>
                         <a id="toggle-border-font" class="cs-item line-center" data-type="edgeStyle">
                           <div class="csi-title">Viền chữ</div>
                           <div class="csi-current line-center">
                             <span>${edgeStyle === 'none' ? 'Không viền' : edgeStyle === 'raised' ? 'Bo viền' : 'Đổ bóng'}</span>
                             <i class="fa-solid fa-angle-right"></i>
                           </div>
                         </a>
                         <a id="toggle-background" class="cs-item line-center" data-type="backgroundColor">
                           <div class="csi-title">Màu nền</div>
                           <div class="csi-current line-center">
                             <div class="csi-color" style="background-color: ${colorValue1};"></div>
                             <span>${colorLabel1}</span>
                             <i class="fa-solid fa-angle-right"></i>
                           </div>
                         </a>
                         <a id="toggle-opacity-background" class="cs-item line-center" data-type="backgroundOpacity">
                           <div class="csi-title">Độ trong nền</div>
                           <div class="csi-current line-center">
                             <span>${backgroundOpacity}</span>
                             <i class="fa-solid fa-angle-right"></i>
                           </div>
                         </a>
                       </div>
                       <div class="csl-secondary">
                         <hr>
                         <div class="dropdown-title py-1">
                           <span class="s-title small">Song ngữ</span>
                         </div>
                         <a class="cs-item line-center" data-type="color-sub" id="toggle-color-sub">
                           <div class="csi-title">Màu chữ</div>
                           <div class="csi-current line-center">
                             <div class="csi-color" style="background-color: ${colorValueSub};"></div>
                             <span>${colorLabelSub}</span>
                             <i class="fa-solid fa-angle-right"></i>
                           </div>
                         </a>
                         <a class="cs-item line-center" data-type="fontSize-sub" id="toggle-size-sub">
                           <div class="csi-title">Cỡ chữ</div>
                           <div class="csi-current line-center">
                             <span>${currentConfigSub.size}%</span>
                             <i class="fa-solid fa-angle-right"></i>
                           </div>
                         </a>
                         <a class="cs-item line-center" data-type="fontOpacity-sub" id="toggle-opacity-sub">
                           <div class="csi-title">Độ trong</div>
                           <div class="csi-current line-center">
                             <span>${currentConfigSub.opacity}%</span>
                             <i class="fa-solid fa-angle-right"></i>
                           </div>
                         </a>
                         <a class="cs-item line-center" data-type="fontFamily-sub" id="toggle-font-family-sub">
                           <div class="csi-title">Font chữ</div>
                           <div class="csi-current line-center">
                             <span>${currentConfigSub.font}</span>
                             <i class="fa-solid fa-angle-right"></i>
                           </div>
                         </a>
                       </div>
                     </div>
                   </div>
                 </ul>
                 <div class="item-btn item-max" data-bs-title="Phóng to (iOS: chỉnh phụ đề trước khi full)">
                   <div class="line-center">
                     <div class="inc-icon">
                       <svg width="128" height="128" viewBox="0 0 128 128" fill="none" xmlns="http://www.w3.org/2000/svg">
                         <path d="M18.73 55C21.3421 55 23.4601 53.1121 23.4601 50.5L23.4601 27.4601L48 27.4601C50.6121 27.4601 53 25.3421 53 22.7301C53 20.118 50.6121 18 48 18L18.73 18C16.118 18 14 20.118 14 22.73L14 50.5C14 53.1121 16.118 55 18.73 55Z" fill="currentColor"></path>
                         <path d="M53.9997 105.27C53.9997 102.658 51.6118 100.54 48.9997 100.54L23.4601 100.54L23.4601 78C23.4601 75.3879 21.3421 73 18.73 73C16.118 73 14 75.3879 14 78L14 105.27C14 107.882 16.118 110 18.73 110L48.9997 110C51.6118 110 53.9997 107.882 53.9997 105.27Z" fill="currentColor"></path>
                         <path d="M74 22.73C74 25.3421 76.3879 27.4601 79 27.4601L104.54 27.46L104.54 50C104.54 52.6121 106.658 55 109.27 55C111.882 55 114 52.6121 114 50L114 22.73C114 20.118 111.882 18 109.27 18L79 18C76.3879 18 74 20.118 74 22.73Z" fill="currentColor"></path>
                         <path d="M109.27 72C106.658 72 104.54 74.3879 104.54 77V100.54L80 100.54C77.3879 100.54 75 102.658 75 105.27C75 107.882 77.3879 110 80 110L109.27 110C111.882 110 114 107.882 114 105.27V77C114 74.3879 111.882 72 109.27 72Z" fill="currentColor"></path>
                       </svg>
                     </div>
                     <span>Phóng to</span>
                   </div>
                 </div>
                 <div class="item-btn item-min d-none" data-bs-title="Thu nhỏ">
                   <div class="line-center">
                     <div class="inc-icon">
                       <svg width="128" height="128" viewBox="0 0 128 128" fill="none" xmlns="http://www.w3.org/2000/svg">
                         <path d="M79.73 111C82.3421 111 84.4601 108.112 84.4601 105.5L84.4601 84.4601L109 84.4601C111.612 84.4601 114 82.3421 114 79.73C114 77.118 111.612 75 109 75L79.73 75C77.118 75 75 77.118 75 79.73L75 105.5C75 108.112 77.118 111 79.73 111Z" fill="currentColor"></path>
                         <path d="M114 48.27C114 45.6579 111.612 43.5399 109 43.5399L83.4601 43.5399L83.4601 23C83.4601 20.3879 81.3421 18 78.73 18C76.118 18 74 20.3879 74 23L74 48.27C74 50.882 76.118 53 78.73 53L109 53C111.612 53 114 50.882 114 48.27Z" fill="currentColor"></path>
                         <path d="M14 79.73C14 82.3421 16.3879 84.46 19 84.46L44.5396 84.46L44.5396 105.5C44.5396 108.112 46.6576 110.5 49.2697 110.5C51.8818 110.5 53.9997 108.112 53.9997 105.5L53.9997 79.73C53.9997 77.118 51.8818 75 49.2697 75L19 75C16.3879 75 14 77.118 14 79.73Z" fill="currentColor"></path>
                         <path d="M48.27 18C45.6579 18 43.5399 20.3879 43.5399 23V44.5396L19 44.5396C16.3879 44.5396 14 46.6576 14 49.2697C14 51.8818 16.3879 53.9997 19 53.9997L48.27 53.9997C50.882 53.9997 53 51.8818 53 49.2697L53 23C53 20.3879 50.882 18 48.27 18Z" fill="currentColor"></path>
                       </svg>
                     </div>
                     <span>Thu nhỏ</span>
                   </div>
                 </div>
               </div>
             </div>`);
  bcEnsureSkipIntroUI();
  bcSyncSubStyleBar();
  bcInjectCenterSkipButtons();
  setTimeout(bcInjectCenterSkipButtons, 400);
  setTimeout(bcInjectCenterSkipButtons, 1200);
  setTimeout(bcInjectCenterSkipButtons, 2500);
  $(window).off('resize.bcCenterSkip').on('resize.bcCenterSkip', function () {
    const $p = $('.jwplayer').first();
    if (!$p.length) return;
    $p.toggleClass('bc-mobile-center-skip', bcIsMobilePlayerLayout());
    bcInjectCenterSkipButtons();
  });
}

let lastTimeUpdate = 0;
let lastStorageUpdate = 0;
let lastMessageUpdate = 0;
let storageTimeout = null;
let lastSkipUpdate = 0;

playerInstance.on('bufferChange', function (e) {
  try {
    var buf =
      e && typeof e.bufferPercent === 'number'
        ? e.bufferPercent
        : typeof playerInstance.getBuffer === 'function'
          ? playerInstance.getBuffer()
          : 0;
    var pct = Math.min(96, 55 + Math.max(0, Number(buf) || 0) * 0.4);
    if (typeof window.bcSetPlayerLoad === 'function') window.bcSetPlayerLoad(pct);
    window.dispatchEvent(new CustomEvent('bc-player-load', { detail: { percent: pct } }));
  } catch (err) {}
});

playerInstance.once('firstFrame', function () {
  try {
    if (typeof window.bcSetPlayerLoad === 'function') window.bcSetPlayerLoad(100);
    if (typeof window.bcHidePlayerLoad === 'function') window.bcHidePlayerLoad();
  } catch (e) {}
});

playerInstance.on('autostartNotAllowed', function () {
  try {
    if (typeof window.bcHidePlayerLoad === 'function') window.bcHidePlayerLoad();
  } catch (e) {}
});

playerInstance.on('time', function (e) {
  var current = playerInstance.getPosition();
  var duration = playerInstance.getDuration();
  var remaining = duration - current;
  var now = Date.now();

  var format =
    jwplayer.utils && jwplayer.utils.timeFormat
      ? jwplayer.utils.timeFormat
      : function (s) {
          s = Math.max(0, Math.floor(s));
          var m = Math.floor(s / 60);
          var sec = s % 60;
          return m + ':' + (sec < 10 ? '0' : '') + sec;
        };

  if (now - lastTimeUpdate > 250) {
    $('.jw-text-elapsed').text(format(current));
    $('.jw-text-duration').text(format(duration));
    $('.jw-text-countdown').text('-' + format(remaining));
    lastTimeUpdate = now;
    bcUpdateSkipIntroButton(current, duration);
    bcUpdateTopTicker(current);
  }

  if (typeof Storage !== 'undefined' && now - lastStorageUpdate > 5000) {
    clearTimeout(storageTimeout);
    storageTimeout = setTimeout(() => {
      try {
        localStorage.setItem(resumeData, current);
        lastStorageUpdate = now;
      } catch (error) {
        console.warn('Không thể lưu vào localStorage:', error);
      }
    }, 100);
  }

  updateDualSubtitles();
});

$(document).on('click', '.jw-btn-play', function () {
  if (playerInstance.getState() === 'playing') {
    playerInstance.pause();
  } else {
    playerInstance.play();
  }
});

playerInstance.on('setupError', function (event) {
  alert('Setup error:', event);
});

playerInstance.on('error', function (event) {
  $('#rp-player').html(`<div class='denied-box'>
        <div class='denied-icon'><img src='/assets/images/denied.gif' /></div>
        <div class='text'>${event.message}</div>     
      </div>`);
});

function initializeTooltips() {
  const tooltipTriggerList = document.querySelectorAll(
    '[data-bs-toggle="tooltip"]'
  );
  [...tooltipTriggerList].map(
    tooltipTriggerEl => new bootstrap.Tooltip(tooltipTriggerEl)
  );
}

let bcCenterSkipLock = false;

$(document).on('click', '.skip-10-prev', function (e) {
  if (bcCenterSkipLock && e.originalEvent && !e.isTrigger) return;
  e.preventDefault();
  e.stopPropagation();
  const currentTime = playerInstance.getPosition();
  playerInstance.seek(Math.max(0, currentTime - 10));
});

$(document).on('click', '.skip-10-next', function (e) {
  if (bcCenterSkipLock && e.originalEvent && !e.isTrigger) return;
  e.preventDefault();
  e.stopPropagation();
  const currentTime = playerInstance.getPosition();
  const duration = playerInstance.getDuration();
  playerInstance.seek(Math.min(duration, currentTime + 10));
});

$(document).on('touchend', '.bc-display-skip', function (e) {
  e.preventDefault();
  e.stopPropagation();
  bcCenterSkipLock = true;
  setTimeout(function () {
    bcCenterSkipLock = false;
  }, 450);
  $(this).trigger('click');
});

let isMuted = false;
let isDragging = false;

playerInstance.on('volume', function (e) {
  const volume = e.volume;
  $('.iv-load').css('width', volume + '%');

  if (volume === 0) {
    $('.btn-muted').addClass('fa-volume-mute');
    $('.btn-muted').removeClass('fa-volume-high');
  } else {
    $('.btn-muted').addClass('fa-volume-high');
    $('.btn-muted').removeClass('fa-volume-mute');
  }
});

function updateVolume(x) {
  const rect = $('#volume')[0].getBoundingClientRect();
  let volume = (x - rect.left) / rect.width;

  volume = Math.max(0, Math.min(1, volume));

  $('.iv-load').css('width', volume * 100 + '%');

  playerInstance.setVolume(volume * 100);

  if (volume === 0) {
    isMuted = true;
    $('.btn-muted').addClass('fa-volume-mute');
    $('.btn-muted').removeClass('fa-volume-high');
  } else {
    isMuted = false;
    $('.btn-muted').addClass('fa-volume-high');
    $('.btn-muted').removeClass('fa-volume-mute');
  }
}

$(document).on('mousedown', '#volume', function (e) {
  isDragging = true;
  updateVolume(e.clientX);
});

$(document).on('mousemove', function (e) {
  if (isDragging) {
    updateVolume(e.clientX);
  }
});

$(document).on('mouseup', function (e) {
  isDragging = false;
});

$(document).on('click', '#volume', function (e) {
  updateVolume(e.clientX);
});

$(document).on('click', '.btn-muted', function () {
  isMuted = !isMuted;
  if (isMuted) {
    playerInstance.setVolume(0);
    $('.iv-load').css('width', '0%');
    $('.btn-muted').addClass('fa-volume-mute');
    $('.btn-muted').removeClass('fa-volume-high');
  } else {
    playerInstance.setVolume(100);
    $('.iv-load').css('width', '100%');
    $('.btn-muted').addClass('fa-volume-high');
    $('.btn-muted').removeClass('fa-volume-mute');
  }
});

let bcFsGestureLock = false;
function bcFsArmGestureLock() {
  bcFsGestureLock = true;
  setTimeout(function () {
    bcFsGestureLock = false;
  }, 450);
}

$(document).on('click', '.item-max', function (e) {
  if (bcFsGestureLock && e.originalEvent && !e.isTrigger) return;
  e.preventDefault();
  e.stopPropagation();
  const container = playerInstance.getContainer
    ? playerInstance.getContainer()
    : document.getElementById('rp-player');
  const root = document.getElementById('rp-player') || container;
  const video = bcGetPlayerVideo();
  const afterEnter = function () {
  $('.item-max').addClass('d-none');
  $('.item-min').removeClass('d-none');
    setTimeout(bcAfterFullscreenUiChange, 80);
  };

  const tryIosNativeFs = function () {
    if (!bcIsIosLikeDevice() || !video) return false;
    try {
      if (bcCssFullscreenActive) bcExitCssFullscreen();
    } catch (err) {}
    // Áp phụ đề/màu/cỡ vào TextTrack trước khi vào native FS
    try {
      bcSyncNativeCueCss();
      if (bcSubtitleOverlayActive()) {
        bcRefreshNativeFsCues();
      }
    } catch (err) {}
    if (typeof video.webkitEnterFullscreen === 'function') {
      try {
        video.webkitEnterFullscreen();
        return true;
      } catch (err) {}
    }
    return false;
  };

  const tryJwFs = function () {
    try {
      playerInstance.setFullscreen(true);
      return true;
    } catch (err) {
      return false;
    }
  };

  // iOS: native video FS = full thật, không thanh URL Safari
  // (Menu phụ đề/màu chỉ dùng được khi chưa full — chỉnh trước rồi full.)
  if (bcIsIosLikeDevice()) {
    if (tryIosNativeFs()) {
      afterEnter();
      return;
    }
    bcEnterCssFullscreen();
    afterEnter();
    return;
  }

  const fsTarget = container || root || document.documentElement;
  const req =
    fsTarget &&
    (fsTarget.requestFullscreen ||
      fsTarget.webkitRequestFullscreen ||
      fsTarget.webkitRequestFullScreen ||
      fsTarget.msRequestFullscreen);

  if (req) {
    try {
      const p = req.call(fsTarget);
      if (p && typeof p.then === 'function') {
        p.then(afterEnter).catch(function () {
          if (tryJwFs()) afterEnter();
          else {
            bcEnterCssFullscreen();
            afterEnter();
          }
        });
      } else {
        afterEnter();
      }
      return;
    } catch (err) {
      /* fall through */
    }
  }

  if (tryJwFs()) {
    afterEnter();
    return;
  }

  bcEnterCssFullscreen();
  afterEnter();
});

// Touch: tránh tooltip/ghost-click nuốt lần chạm trên mobile
$(document).on('touchend', '.item-max', function (e) {
  e.preventDefault();
  e.stopPropagation();
  bcFsArmGestureLock();
  $(this).trigger('click');
});

$(document).on('click', '.item-min', function (e) {
  if (bcFsGestureLock && e.originalEvent && !e.isTrigger) return;
  e.preventDefault();
  e.stopPropagation();
  bcExitCssFullscreen();
  const video = bcGetPlayerVideo();
  if (video && typeof video.webkitExitFullscreen === 'function') {
    try {
      video.webkitExitFullscreen();
    } catch (err) {}
  }
  if (document.fullscreenElement || document.webkitFullscreenElement) {
    const exit =
      document.exitFullscreen ||
      document.webkitExitFullscreen ||
      document.msExitFullscreen;
    if (exit) {
      try {
        exit.call(document);
      } catch (err) {}
    }
  }
  try {
  playerInstance.setFullscreen(false);
  } catch (err) {}
  $('.item-max').removeClass('d-none');
  $('.item-min').addClass('d-none');
  setTimeout(bcAfterFullscreenUiChange, 80);
});

$(document).on('touchend', '.item-min', function (e) {
  e.preventDefault();
  e.stopPropagation();
  bcFsArmGestureLock();
  $(this).trigger('click');
});

playerInstance.on('fullscreen', function (event) {
  if (event.fullscreen) {
    $('.item-max').addClass('d-none');
    $('.item-min').removeClass('d-none');
  } else {
    if (!bcCssFullscreenActive) {
    $('.item-max').removeClass('d-none');
    $('.item-min').addClass('d-none');
  }
  }
  setTimeout(bcAfterFullscreenUiChange, 50);
});

document.addEventListener('fullscreenchange', function () {
  setTimeout(bcAfterFullscreenUiChange, 30);
});
document.addEventListener('webkitfullscreenchange', function () {
  setTimeout(bcAfterFullscreenUiChange, 30);
});
function bcResyncNativeCueAfterRotate() {
  try {
    bcSyncNativeCueCss();
    if (bcSubtitleOverlayActive() && bcIsNativeVideoFullscreen()) {
      bcRefreshNativeFsCues();
      const pack = bcEnsureNativeFsTrack();
      if (pack && pack.track) {
        try {
          pack.track.mode = 'showing';
        } catch (e) {}
      }
    }
  } catch (e) {}
}

window.addEventListener('orientationchange', function () {
  // iOS cập nhật screen/inner* trễ — sync nhiều nhịp
  [80, 200, 400, 700, 1100].forEach(function (ms) {
    setTimeout(function () {
      try {
        if (bcIsNativeVideoFullscreen()) {
          bcResyncNativeCueAfterRotate();
          return;
        }
      } catch (e) {}
      if (bcCssFullscreenActive || bcSubtitleOverlayActive()) {
        bcAfterFullscreenUiChange();
        bcSyncNativeCueCss();
      }
    }, ms);
  });
});

try {
  if (screen.orientation && screen.orientation.addEventListener) {
    screen.orientation.addEventListener('change', function () {
      setTimeout(bcResyncNativeCueAfterRotate, 100);
      setTimeout(bcResyncNativeCueAfterRotate, 500);
    });
  }
} catch (e) {}

window.addEventListener('resize', function () {
  clearTimeout(window.__bcFsResizeT);
  window.__bcFsResizeT = setTimeout(function () {
    try {
      if (bcIsNativeVideoFullscreen()) {
        bcResyncNativeCueAfterRotate();
        return;
      }
    } catch (e) {}
    if (
      (bcCssFullscreenActive || bcIsFullscreenLayout()) &&
      bcSubtitleOverlayActive()
    ) {
      bcMountDualOverlayHost();
      updateDualSubtitles();
      bcSyncNativeCueCss();
    }
  }, 120);
});

try {
  if (window.visualViewport) {
    window.visualViewport.addEventListener('resize', function () {
      if (bcIsNativeVideoFullscreen()) {
        clearTimeout(window.__bcVvCueT);
        window.__bcVvCueT = setTimeout(bcResyncNativeCueAfterRotate, 100);
      }
    });
  }
} catch (e) {}

$(document).on('click', '.item-pip', function () {
  if (
    document.pictureInPictureEnabled ||
    document.webkitPictureInPictureEnabled
  ) {
    const videoElement = playerInstance.getContainer().querySelector('video');

    if (document.pictureInPictureElement) {
      document.exitPictureInPicture().catch(error => {
        console.error('Lỗi khi thoát PiP:', error);
      });
    } else {
      videoElement.requestPictureInPicture().catch(error => {
        console.error('Lỗi khi bật PiP:', error);
      });
    }
  } else {
    alert('Trình duyệt của bạn không hỗ trợ chế độ Picture-in-Picture');
  }
});

$(document).on('click', '#toggle-speed', function () {
  bcShowPlayerSlide('#sub-speed');
});

$(document).on('click', '#toggle-player-color', function () {
  bcShowPlayerSlide('#sub-player-color');
});

$(document).on('click', '#toggle-intro-skip', function () {
  bcShowPlayerSlide('#sub-intro-skip');
});

$(document).on('click', '#sub-intro-skip .cs-item[data-intro-skip]', function (e) {
  e.preventDefault();
  e.stopPropagation();
  bcSaveIntroSkipSec($(this).attr('data-intro-skip'));
  const duration = playerInstance.getDuration();
  const current = playerInstance.getPosition();
  bcUpdateSkipIntroButton(current, duration);
});

$(document).on('click', '.bc-skip-intro', function (e) {
  e.preventDefault();
  e.stopPropagation();
  const introSec = bcGetIntroSkipSec();
  const duration = playerInstance.getDuration() || 0;
  if (introSec > 0 && duration > introSec) {
    playerInstance.seek(introSec);
    try {
      playerInstance.play();
    } catch (err) {}
  }
  introSkipped = true;
  $('#rp-player > .skip-buttons').hide().attr('aria-hidden', 'true');
});

$(document).on('click', '#sub-player-color .cs-item[data-chrome-color]', function (e) {
  e.preventDefault();
  e.stopPropagation();
  const color = $(this).attr('data-chrome-color');
  bcSavePlayerChromeColor(color);
});

$(document).on('input change', '#bc-player-color-input', function (e) {
  e.stopPropagation();
  bcSavePlayerChromeColor(this.value);
});

$(document).on('click', '.bc-player-color-custom', function (e) {
  e.stopPropagation();
});

$(document).on('click', '.sub-back', function () {
  const $currentSlide = $(this).closest('.sub-slide');
  let parentSlide;

  if ($currentSlide.hasClass('level-2')) {
    parentSlide = $('#sub-caption');
  } else {
    parentSlide = $('.content-slide');
  }

  bcBackPlayerSlide($currentSlide, parentSlide);
});

$(document).on('click', '#toggle-quality', function () {
  bcShowPlayerSlide('#sub-quality');
});

$(document).on('click', '#toggle-caption', function () {
  bcShowPlayerSlide('#sub-caption');
});

$(document).on('click', '#sub-speed .cs-item', function () {
  const speed = parseFloat($(this).attr('data'));
  if (isNaN(speed) || speed <= 0) {
    return;
  }

  try {
    playerInstance.setPlaybackRate(speed);

    $('.jw-playback-rate .cs-item').removeClass('active');
    $(this).addClass('active');

    $('.jw-speed-text').text(speed + 'x');

    $('#sub-speed').hide();
    $('.content-slide').show();
  } catch (error) {
    console.error('Lỗi khi set tốc độ:', error);
  }
});

playerInstance.on('levels', function (e) {
  const levels = e.levels;
  const currentLevel = -1;

  $('.jw-quality-menu').empty();

  const sortedLevels = [...levels].sort(
    (a, b) => (b.height || 0) - (a.height || 0)
  );

  sortedLevels.forEach((level, sortedIndex) => {
    if (typeof level.height !== 'undefined') {
      const originalIndex = levels.findIndex(l => l === level);
      const isActive = originalIndex === currentLevel;
      const qualityLabel = formatQualityLabel(level.height);

      $('.jw-quality-menu').append(`
        <a class="cs-item line-center ${isActive ? 'active' : ''}" data-level="${originalIndex}">
            <div class="csi-title">${qualityLabel}</div>
            <i class="fa-solid fa-check"></i>
        </a>
    `);
    }
  });

  $('.jw-title-quality').text('Auto');
  $('.q-play').text('Auto');
});

function updateQualityText(currentLevel, levels) {
  let qualityText = 'Auto';

  if (currentLevel === -1) {
    const visualQuality = playerInstance.getVisualQuality();
    if (visualQuality && visualQuality.level && visualQuality.level.height) {
      qualityText =
        'Auto (' + formatQualityTitle(visualQuality.level.height) + ')';
    } else {
      const activeLevel = levels.find(
        level => level.bitrate === visualQuality?.reason?.bitrate
      );
      if (activeLevel) {
        qualityText = 'Auto (' + formatQualityTitle(activeLevel.height) + ')';
      }
    }
  } else if (currentLevel >= 0 && levels[currentLevel]) {
    const level = levels[currentLevel];
    qualityText = formatQualityTitle(level.height);
  }

  $('.jw-title-quality').text(qualityText);
  $('.q-play').text(qualityText);
}

function formatQualityLabel(height) {
  if (!height) return 'Auto';

  const qualityMap = {
    2160: '4K',
    1440: '2K',
    1080: 'FHD 1080p',
    720: 'HD 720p',
    480: '480p',
    360: '360p',
    240: '240p',
    144: '144p',
  };

  return qualityMap[height] || height + 'p';
}

function formatQualityTitle(height) {
  if (!height) return 'Auto';

  const qualityMap = {
    2160: '4K',
    1440: '2K',
    1080: 'FHD',
    720: 'HD',
    480: '480p',
    360: '360p',
    240: '240p',
    144: '144p',
  };

  return qualityMap[height] || height + 'p';
}

playerInstance.on('visualQuality', function (e) {
  const currentLevel = playerInstance.getCurrentQuality();
  if (currentLevel === -1) {
    const visualHeight = e.level.height;
    let autoText = 'Auto';
    if (visualHeight) {
      autoText = 'Auto (' + formatQualityLabel(visualHeight) + ')';
      $('.jw-quality-menu .cs-item[data-level="-1"] .csi-title').text(autoText);
    }
    $('.jw-title-quality').text(autoText);
    $('.q-play').text(autoText);
  }
});

playerInstance.on('levelsChanged', function (e) {
  const currentLevel = e.currentQuality;
  const levels = playerInstance.getQualityLevels();

  $('.jw-quality-menu .cs-item').removeClass('active');
  $(`.jw-quality-menu .cs-item[data-level="${currentLevel}"]`).addClass(
    'active'
  );

  updateQualityText(currentLevel, levels);
});

$(document).on('click', '.jw-quality-menu .cs-item', function () {
  const level = parseInt($(this).data('level'));

  playerInstance.setCurrentQuality(level);

  $('.jw-quality-menu .cs-item').removeClass('active');
  $(this).addClass('active');

  if (level === -1) {
    let autoText = 'Auto';
    const visualQuality =
      playerInstance.getVisualQuality && playerInstance.getVisualQuality();
    if (visualQuality && visualQuality.level && visualQuality.level.height) {
      autoText =
        'Auto (' + formatQualityTitle(visualQuality.level.height) + ')';
    }
    $('.jw-title-quality').text(autoText);
    $('.q-play').text('Auto');
  } else {
    const levels = playerInstance.getQualityLevels();
    updateQualityText(level, levels);
  }

  $('#sub-quality').hide();
  $('.content-slide').show();
});


playerInstance.on('captionsList', function (e) {
  const captions = e.tracks;

  subtitleTracks = sortPlayerSubtitles(playerOptions.subtitles);
  $('.jw-main-caption-menu').empty();
  $('.jw-sub-caption-menu').empty();

  if (captions.length === 0) {
    $('#sub-off').click();
    return;
  }

  let defaultTrackIndex = captions.findIndex((track) => track.id === 'default');
  if (defaultTrackIndex < 0) {
    defaultTrackIndex = captions.findIndex((t) => /tiếng việt/i.test(t.label || ''));
  }
  if (defaultTrackIndex < 0) {
    defaultTrackIndex = captions.findIndex(
      (t, i) => i > 0 && t.label && t.label !== 'None' && t.label !== 'Off'
    );
  }
  if (defaultTrackIndex > 0) {
    playerInstance.setCurrentCaptions(defaultTrackIndex);
  }

  $('.jw-main-caption-menu').addClass('active');
  $('#sub-on').addClass('active');

  $('.p_b-right .item-sub').removeClass('d-none');

  captions.forEach((track, index) => {
    if (track.label && track.label !== 'None' && track.label !== 'Off') {
      const isMainActive = index === (defaultTrackIndex > 0 ? defaultTrackIndex : playerInstance.getCurrentCaptions());
      $('.jw-main-caption-menu').append(`
        <a class="dropdown-item ${isMainActive ? 'active' : ''}" href="#" data="${index}" label="${track.label}">
            <span class="s-title">${track.label}</span>
            <div class="w-check"><i class="fa-solid fa-check"></i></div>
        </a>
      `);

      $('.jw-sub-caption-menu').append(`
        <a class="dropdown-item" href="#" data="${index}" label="${track.label}">
            <span class="s-title">${track.label}</span>
            <div class="w-check"><i class="fa-solid fa-check"></i></div>
        </a>
      `);
    }
  });

  // Mặc định 1 ngôn ngữ qua overlay (Việt/Anh/Trung) — không phụ thuộc JW caption engine
  setTimeout(function () {
    bcSetSingleSubtitleOverlay(true).catch(function (e) {
      console.warn('[sub] single overlay init:', e);
    });
  }, 0);
});

$(document).on(
  'click',
  '.jw-main-caption-menu.active .dropdown-item',
  async function () {
    const trackIndex = parseInt($(this).attr('data'));

    $('.jw-main-caption-menu .dropdown-item').removeClass('active');
    $(this).addClass('active');

    if ($('#sub-dual').hasClass('active')) {
      // Keep JW captions off in dual — overlay owns both lines
      try {
        playerInstance.setCurrentCaptions(0);
      } catch (e) {}
      await bcLoadPrimaryCuesFromSelection();
      updateDualSubtitles();
    } else if ($('#sub-on').hasClass('active') || singleSubtitleOverlay) {
      // Một ngôn ngữ cũng qua overlay để VTT Việt luôn hiện
      await bcSetSingleSubtitleOverlay(true);
    } else {
      playerInstance.setCurrentCaptions(trackIndex);
    }
  }
);

$(document).on('click', '.jw-audio-menu .dropdown-item', function (e) {
  e.preventDefault();
  $('.jw-audio-menu .dropdown-item').removeClass('active');
  $(this).addClass('active');

  const label = $(this).attr('label') || $(this).find('.s-title').text() || 'Audio';
  $('.jw-audio-label').text(
    String(label)
      .replace(/^[^\wÀ-ỹ]+/u, '')
      .trim()
      .slice(0, 18) || 'Audio'
  );

  // HLS multi-audio trong cùng stream (Youku)
  const audioIndexAttr = $(this).attr('data-audio-index');
  if (audioIndexAttr != null && audioIndexAttr !== '') {
    const idx = parseInt(audioIndexAttr, 10);
    if (Number.isFinite(idx) && playerInstance) {
      try {
        if (typeof playerInstance.setCurrentAudio === 'function') {
          playerInstance.setCurrentAudio(idx);
        } else if (typeof playerInstance.setCurrentAudioTrack === 'function') {
          playerInstance.setCurrentAudioTrack(idx);
        }
      } catch (err) {
        console.warn('[audio] setCurrentAudio failed:', err);
      }
    }
    return;
  }

  // ViCDN sibling: load master URL khác
  const encData = $(this).attr('data');
  if (!encData) return;
  const link = hexXorDecrypt(encData, 'mySecretKey2024');
  const currentTime = playerInstance.getPosition() || 0;

  playerInstance.once('playlistItem', function () {
    setTimeout(function () {
      playerInstance.seek(currentTime);
      playerInstance.play();
    }, 300);
  });

  playerInstance.load({
    file: link,
    type: 'application/x-mpegURL',
    autostart: true,
  });
});

playerInstance.on('complete', function () {
  if (typeof Storage !== 'undefined') {
    localStorage.removeItem(resumeData);
  } else {
    console.log('Your browser is too old!');
  }
});

$(document).on('click', '#toggle-font', function () {
  if ($('.sub-color').length == 0) {
    $('.player-dm:has(.content-slide)')
      .append(`<div id="sub-color" class="sub-slide level-2 sub-color" style="display: none;">
      <div class="dropdown-title">
        <span class="s-title sub-back line-center">
          <i class="fa-solid fa-angle-left"></i>
          Phụ đề chính / Màu chữ
        </span>
      </div>
      <div class="cs-list jw-playback-rate">
        ${arrayColor.map(item => renderItemColor(item.color, item.label, 'color')).join('')}
      </div>
    </div>`);
  }

  bcShowPlayerSlide('#sub-color');
});

$(document).on('click', '#toggle-color-sub', function () {
  if ($('.sub-color-sub').length == 0) {
    $('.player-dm:has(.content-slide)')
      .append(`<div id="sub-color-sub" class="sub-slide level-2 sub-color-sub" style="display: none;">
      <div class="dropdown-title">
        <span class="s-title sub-back line-center">
          <i class="fa-solid fa-angle-left"></i>
          Song ngữ / Màu chữ
        </span>
      </div>
      <div class="cs-list jw-playback-rate">
        ${arrayColor.map(item => renderItemColor(item.color, item.label, 'color', 'white', currentConfigSub)).join('')}
      </div>
    </div>`);
  }

  bcShowPlayerSlide('#sub-color-sub');
});

$(document).on('click', '.sub-color-sub .cs-item', function () {
  const color = $(this).attr('data');

  currentConfigSub.color = color;
  const spanLang = $('span[lang="su"]');
  spanLang.css('color', color);
  if (bcSubtitleOverlayActive()) updateDualSubtitles();

  $('.sub-color-sub .cs-item').removeClass('active');
  $(`.sub-color-sub .cs-item[data="${color}"]`).addClass('active');

  $('a[data-type="color-sub"] .csi-current').html(
    `<div class="csi-color" style="background-color: ${color};"></div><span>${bcColorLabel(color)}</span><i class="fa-solid fa-angle-right"></i>`
  );

  bcSwapPlayerSlide($('#sub-color-sub'), $('#sub-caption'));

  $('#video_pop .player-dm').css('display', 'none');
});

$(document).on('click', '.bc-sub-text-colors .bc-swatch', function (e) {
  e.preventDefault();
  e.stopPropagation();
  const color = $(this).attr('data-sub-color');
  if (!color) return;
  bcSetCaptionsStyle({ color: color });
});

$(document).on('click', '.bc-sub-bg-colors .bc-swatch', function (e) {
  e.preventDefault();
  e.stopPropagation();
  const bg = $(this).attr('data-sub-bg');
  if (!bg) return;
  if (bg === 'none' || bg === 'transparent') {
    bcSetCaptionsStyle(
      { backgroundOpacity: 0 },
      { autoBgOpacity: false }
    );
    return;
  }
  bcSetCaptionsStyle({ backgroundColor: bg });
});

$(document).on('click', '.bc-sub-bg-opacity .bc-swatch-op', function (e) {
  e.preventDefault();
  e.stopPropagation();
  const opacity = parseInt($(this).attr('data-sub-bg-opacity'), 10);
  if (!Number.isFinite(opacity)) return;
  bcSetCaptionsStyle(
    { backgroundOpacity: opacity },
    { autoBgOpacity: false }
  );
});

$(document).on('click', '.sub-color .cs-item', function () {
  const color = $(this).attr('data');
  bcSetCaptionsStyle({ color: color });

  $('.sub-color .cs-item').removeClass('active');
  $(`.sub-color .cs-item[data="${color}"]`).addClass('active');

  bcSwapPlayerSlide($('#sub-color'), $('#sub-caption'));

  $('#video_pop .player-dm').css('display', 'none');
});

$(document).on('click', '#toggle-size', function () {
  const listHtml = bcCaptionSizeOptions()
    .map((item) => renderItemFont(item.size, item.label, 'fontSize'))
    .join('');
  let $pane = $('#sub-size');
  if (!$pane.length) {
    $('.player-dm:has(.content-slide)').append(`<div id="sub-size" class="sub-slide level-2 sub-size" style="display: none;">
      <div class="dropdown-title">
        <span class="s-title sub-back line-center">
          <i class="fa-solid fa-angle-left"></i>
          Phụ đề chính / Cỡ chữ
        </span>
      </div>
      <div class="cs-list jw-playback-rate"></div>
    </div>`);
    $pane = $('#sub-size');
  }
  $pane.find('.cs-list').html(listHtml);

  bcShowPlayerSlide('#sub-size');
});

$(document).on('click', '#toggle-size-sub', function () {
  if ($('#sub-size-sub').length == 0) {
    $('.player-dm:has(.content-slide)')
      .append(`<div id="sub-size-sub" class="sub-slide level-2 sub-size-sub" style="display: none;">
      <div class="dropdown-title">
        <span class="s-title sub-back line-center">
          <i class="fa-solid fa-angle-left"></i>
          Song ngữ / Cỡ chữ
        </span>
      </div>
      <div class="cs-list jw-playback-rate">
        ${arraySizeFont.map(item => renderItemFont(item.size, item.label, 'size', currentConfigSub)).join('')}
      </div>
    </div>`);
  }

  bcShowPlayerSlide('#sub-size-sub');
});

$(document).on('click', '.sub-size .cs-item', function () {
  const size = $(this).attr('data');
  bcSetCaptionsStyle({ fontSize: parseInt(size, 10) || size });

  $('.sub-size .cs-item').removeClass('active');
  $(`.sub-size .cs-item[data="${size}"]`).addClass('active');

  $('a[data-type="fontSize"] .csi-current span').text(
    (bcCaptionSizeOptions().find(item => String(item.size) === String(size)) || {}).label || size + 'pt'
  );

  bcSwapPlayerSlide($('#sub-size'), $('#sub-caption'));

  $('#video_pop .player-dm').css('display', 'none');
});

$(document).on('click', '.sub-size-sub .cs-item', function () {
  const size = $(this).attr('data');

  currentConfigSub.size = size;
  const spanLang = $('span[lang="su"]');
  spanLang.css('font-size', size + '%');
  if (bcSubtitleOverlayActive()) updateDualSubtitles();

  $('.sub-size-sub .cs-item').removeClass('active');
  $(`.sub-size-sub .cs-item[data="${size}"]`).addClass('active');

  $('a[data-type="fontSize-sub"] .csi-current span').text(
    arraySizeFont.find(item => item.size === size).label
  );

  bcSwapPlayerSlide($('#sub-size-sub'), $('#sub-caption'));

  $('#video_pop .player-dm').css('display', 'none');
});

$(document).on('click', '#toggle-opacity-font', function () {
  if ($('#sub-opacity-font').length == 0) {
    $('.player-dm:has(.content-slide)')
      .append(`<div id="sub-opacity-font" class="sub-slide level-2 sub-opacity-font" style="display: none;">
      <div class="dropdown-title">
        <span class="s-title sub-back line-center">
          <i class="fa-solid fa-angle-left"></i>
          Phụ đề chính / Độ trong
        </span>
      </div>
      <div class="cs-list jw-playback-rate">
        ${arrayOpacity.map(item => renderItemFont(item.opacity, item.label, 'fontOpacity')).join('')}
      </div>
    </div>`);
  }

  bcShowPlayerSlide('#sub-opacity-font');
});

$(document).on('click', '#toggle-opacity-sub', function () {
  if ($('#sub-opacity-font-sub').length == 0) {
    $('.player-dm:has(.content-slide)')
      .append(`<div id="sub-opacity-font-sub" class="sub-slide level-2 sub-opacity-font-sub" style="display: none;">
      <div class="dropdown-title">
        <span class="s-title sub-back line-center">
          <i class="fa-solid fa-angle-left"></i>
          Song ngữ / Độ trong
        </span>
      </div>
      <div class="cs-list jw-playback-rate">
        ${arrayOpacity.map(item => renderItemFont(item.opacity, item.label, 'opacity', currentConfigSub)).join('')}
      </div>
    </div>`);
  }

  bcShowPlayerSlide('#sub-opacity-font-sub');
});

$(document).on('click', '.sub-opacity-font .cs-item', function () {
  const opacity = $(this).attr('data');
  bcSetCaptionsStyle({ fontOpacity: parseInt(opacity, 10) });

  $('.sub-opacity-font .cs-item').removeClass('active');
  $(`.sub-opacity-font .cs-item[data="${opacity}"]`).addClass('active');

  $('a[data-type="fontOpacity"] .csi-current span').text(
    (arrayOpacity.find(item => item.opacity === opacity) || {}).label ||
      opacity + '%'
  );

  bcSwapPlayerSlide($('#sub-opacity-font'), $('#sub-caption'));

  $('#video_pop .player-dm').css('display', 'none');
});

$(document).on('click', '.sub-opacity-font-sub .cs-item', function () {
  const opacity = $(this).attr('data');

  currentConfigSub.opacity = opacity;
  const spanLang = $('span[lang="su"]');
  spanLang.css('opacity', opacity + '%');
  if (bcSubtitleOverlayActive()) updateDualSubtitles();

  $('.sub-opacity-font-sub .cs-item').removeClass('active');
  $(`.sub-opacity-font-sub .cs-item[data="${opacity}"]`).addClass('active');

  $('a[data-type="fontOpacity-sub"] .csi-current span').text(
    (arrayOpacity.find(item => item.opacity === opacity) || {}).label ||
      opacity + '%'
  );

  bcSwapPlayerSlide($('#sub-opacity-font-sub'), $('#sub-caption'));

  $('#video_pop .player-dm').css('display', 'none');
});

$(document).on('click', '#toggle-font-family', function () {
  const currentFont = playerInstance.getConfig().captions.fontFamily || 'Arial';
  if ($('#sub-font-family').length == 0) {
    $('.player-dm:has(.content-slide)')
      .append(`<div id="sub-font-family" class="sub-slide level-2 sub-font-family" style="display: none;">
      <div class="dropdown-title">
        <span class="s-title sub-back line-center">
          <i class="fa-solid fa-angle-left"></i>
          Phụ đề chính / Font chữ
        </span>
      </div>
      <div class="cs-list jw-playback-rate">
        ${arrayFont
          .map(
            item => `
          <a class="cs-item line-center ${currentFont === item.font ? 'active' : ''}" data="${item.font}">
            <div class="csi-title">${item.label}</div>
            <i class="fa-solid fa-check"></i>
          </a>
        `
          )
          .join('')}
      </div>
    </div>`);
  }

  bcShowPlayerSlide('#sub-font-family');
});

$(document).on('click', '#toggle-font-family-sub', function () {
  const currentFont = currentConfigSub.font || 'Arial';
  if ($('#sub-font-family-sub').length == 0) {
    $('.player-dm:has(.content-slide)')
      .append(`<div id="sub-font-family-sub" class="sub-slide level-2 sub-font-family-sub" style="display: none;">
      <div class="dropdown-title">
        <span class="s-title sub-back line-center">
          <i class="fa-solid fa-angle-left"></i>
          Song ngữ / Font chữ
        </span>
      </div>
      <div class="cs-list jw-playback-rate">
        ${arrayFont
          .map(
            item => `
          <a class="cs-item line-center ${currentFont === item.font ? 'active' : ''}" data="${item.font}">
            <div class="csi-title">${item.label}</div>
            <i class="fa-solid fa-check"></i>
          </a>
        `
          )
          .join('')}
      </div>
    </div>`);
  }

  bcShowPlayerSlide('#sub-font-family-sub');
});

$(document).on('click', '.sub-font-family .cs-item', function () {
  const font = $(this).attr('data');

  const currentCaptions = playerInstance.getConfig().captions;

  playerInstance.setCaptions({
    ...currentCaptions,
    fontFamily: font,
  });
  bcSaveCaptionStyle({ fontFamily: font });
  if (bcSubtitleOverlayActive()) updateDualSubtitles();

  $('.sub-font-family .cs-item').removeClass('active');
  $(`.sub-font-family .cs-item[data="${font}"]`).addClass('active');

  $('a[data-type="fontFamily"] .csi-current span').text(
    (arrayFont.find(item => item.font === font) || {}).label || font
  );

  bcSwapPlayerSlide($('#sub-font-family'), $('#sub-caption'));

  $('#video_pop .player-dm').css('display', 'none');
});

$(document).on('click', '.sub-font-family-sub .cs-item', function () {
  const font = $(this).attr('data');

  currentConfigSub.font = font;
  const spanLang = $('span[lang="su"]');
  spanLang.css('font-family', font);
  if (bcSubtitleOverlayActive()) updateDualSubtitles();

  $('.sub-font-family-sub .cs-item').removeClass('active');
  $(`.sub-font-family-sub .cs-item[data="${font}"]`).addClass('active');

  $('a[data-type="fontFamily-sub"] .csi-current span').text(
    (arrayFont.find(item => item.font === font) || {}).label || font
  );

  bcSwapPlayerSlide($('#sub-font-family-sub'), $('#sub-caption'));

  $('#video_pop .player-dm').css('display', 'none');
});

$(document).on('click', '#toggle-border-font', function () {
  const currentBorder = playerInstance.getConfig().captions.edgeStyle || 'none';
  if ($('#sub-border-font').length == 0) {
    $('.player-dm:has(.content-slide)')
      .append(`<div id="sub-border-font" class="sub-slide level-2 sub-border-font" style="display: none;">
      <div class="dropdown-title">
        <span class="s-title sub-back line-center">
          <i class="fa-solid fa-angle-left"></i>
          Phụ đề chính / Viền chữ
        </span>
      </div>
      <div class="cs-list jw-playback-rate">
        ${renderItemBorder()}
      </div>
    </div>`);
  }

  bcShowPlayerSlide('#sub-border-font');
});

$(document).on('click', '.sub-border-font .cs-item', function () {
  const border = $(this).attr('data');
  bcSetCaptionsStyle({ edgeStyle: border });

  $('.sub-border-font .cs-item').removeClass('active');
  $(`.sub-border-font .cs-item[data="${border}"]`).addClass('active');

  $('a[data-type="edgeStyle"] .csi-current span').text(
    border === 'none'
      ? 'Không viền'
      : border === 'raised'
        ? 'Bo viền'
        : 'Đổ bóng'
  );

  bcSwapPlayerSlide($('#sub-border-font'), $('#sub-caption'));

  $('#video_pop .player-dm').css('display', 'none');
});

$(document).on('click', '#toggle-background', function () {
  if ($('#sub-background').length == 0) {
    $('.player-dm:has(.content-slide)')
      .append(`<div id="sub-background" class="sub-slide level-2 sub-background" style="display: none;">
      <div class="dropdown-title">
        <span class="s-title sub-back line-center">
          <i class="fa-solid fa-angle-left"></i>
          Phụ đề chính / Màu nền
        </span>
      </div>
      <div class="cs-list jw-playback-rate">
        ${arrayBackground.map(item => renderItemColor(item.background, item.label, 'backgroundColor', '#000000')).join('')}
      </div>
    </div>`);
  }

  bcShowPlayerSlide('#sub-background');
});

$(document).on('click', '.sub-background .cs-item', function () {
  const background = $(this).attr('data');
  bcSetCaptionsStyle({ backgroundColor: background });

  $('.sub-background .cs-item').removeClass('active');
  $(`.sub-background .cs-item[data="${background}"]`).addClass('active');

  bcSwapPlayerSlide($('#sub-background'), $('#sub-caption'));

  $('#video_pop .player-dm').css('display', 'none');
});

$(document).on('click', '#toggle-opacity-background', function () {
  if ($('#sub-opacity-background').length == 0) {
    $('.player-dm:has(.content-slide)')
      .append(`<div id="sub-opacity-background" class="sub-slide level-2 sub-opacity-background" style="display: none;">
      <div class="dropdown-title">
        <span class="s-title sub-back line-center">
          <i class="fa-solid fa-angle-left"></i>
          Phụ đề chính / Độ trong Nền
        </span>
      </div>
      <div class="cs-list jw-playback-rate">
        ${arrayOpacity.map(item => renderItemFont(item.opacity, item.label, 'backgroundOpacity')).join('')}
      </div>
    </div>`);
  }

  bcShowPlayerSlide('#sub-opacity-background');
});

$(document).on('click', '.sub-opacity-background .cs-item', function () {
  const opacity = $(this).attr('data');
  bcSetCaptionsStyle(
    { backgroundOpacity: parseInt(opacity, 10) },
    { autoBgOpacity: false }
  );

  $('.sub-opacity-background .cs-item').removeClass('active');
  $(`.sub-opacity-background .cs-item[data="${opacity}"]`).addClass('active');

  bcSwapPlayerSlide($('#sub-opacity-background'), $('#sub-caption'));

  $('#video_pop .player-dm').css('display', 'none');
});

$(document).on('click', '#toggle-subs', function () {
  const caps = bcGetLiveCaptions();
  playerInstance.pause();

  const color = caps.color || 'white';
  const size = (caps.fontSize || bcDefaultCaptionFontSize()) + 'pt';
  const opacity = (caps.fontOpacity || 100) + '%';
  const border = caps.edgeStyle || 'none';
  const background = caps.backgroundColor || '#000000';
  const backgroundOpacity = (caps.backgroundOpacity || 0) + '%';
  const fontFamily = caps.fontFamily || 'Arial';
  const colorLabel = bcColorLabel(color);
  const bgLabel = bcBackgroundLabel(background);
  const subColorLabel = bcColorLabel(currentConfigSub.color);

  if ($('#video_pop').length == 0) {
    $('#rp-player').append(`<div id="video_pop">
                <div class="pop-mask"></div>
                <div class="pop-center pop-sub">
                  <div class="pc-title w-100">Tuỳ chỉnh phụ đề</div>
                  <div class="cs-dual">
                    <div class="csl-primary">
                      <div class="dropdown-title py-1 mb-2">
                        <span class="s-title small">Phụ đề chính</span>
                      </div>
                      <div class="cs-list jw-main-sub-setting">
                      <a class="cs-item line-center" data-type="color" data-title="Màu chữ">
                          <div class="csi-title">Màu chữ</div>
                          <div class="csi-current line-center">
                            <div class="csi-color" style="background-color: ${color};"></div>
                            <span>${colorLabel}</span>
                            <i class="fa-solid fa-angle-right"></i>
                          </div>
                        </a><a class="cs-item line-center" data-type="fontSize" data-title="Cỡ chữ">
                          <div class="csi-title">Cỡ chữ</div>
                          <div class="csi-current line-center">
                            <span>${size}</span>
                            <i class="fa-solid fa-angle-right"></i>
                          </div>
                        </a>
                        <a class="cs-item line-center" data-type="fontOpacity" data-value="${opacity}" data-title="Độ trong">
                          <div class="csi-title">Độ trong</div>
                          <div class="csi-current line-center">
                            <span>${opacity}</span>
                            <i class="fa-solid fa-angle-right"></i>
                          </div>
                        </a><a class="cs-item line-center" data-type="edgeStyle" data-value="${border}" data-title="Viền chữ">
                          <div class="csi-title">Viền chữ</div>
                          <div class="csi-current line-center">
                            <span>${border === 'none' ? 'Không viền' : border === 'raised' ? 'Bo viền' : 'Đổ bóng'}</span>
                            <i class="fa-solid fa-angle-right"></i>
                          </div>
                        </a><a class="cs-item line-center" data-type="backgroundColor" data-value="${background}" data-title="Màu nền">
                          <div class="csi-title">Màu nền</div>
                          <div class="csi-current line-center">
                            <div class="csi-color" style="background-color: ${background};"></div>
                            <span>${bgLabel}</span>
                            <i class="fa-solid fa-angle-right"></i>
                          </div>
                        </a><a class="cs-item line-center" data-type="backgroundOpacity" data-value="${backgroundOpacity}" data-title="Độ trong Nền">
                          <div class="csi-title">Độ trong Nền</div>
                          <div class="csi-current line-center">
                            <span>${backgroundOpacity}</span>
                            <i class="fa-solid fa-angle-right"></i>
                          </div>
                        </a><a class="cs-item line-center" data-type="fontFamily" data-value="${fontFamily}" data-title="Font chữ">
                          <div class="csi-title">Font chữ</div>
                          <div class="csi-current line-center">
                            <span>${fontFamily}</span>
                            <i class="fa-solid fa-angle-right"></i>
                          </div>
                        </a></div>
                    </div>
                    <div class="csl-secondary">
                      <div class="dropdown-title py-1 mb-2">
                        <span class="s-title small">Song ngữ</span>
                      </div>
                      <div class="cs-list jw-sub-sub-setting">
                      <a id="toggle-color-sub" class="cs-item line-center" data-type="color-sub" data-title="Màu chữ Song ngữ">
                          <div class="csi-title">Màu chữ</div>
                          <div class="csi-current line-center">
                            <div class="csi-color" style="background-color: ${currentConfigSub.color};"></div>
                            <span>${subColorLabel}</span>
                            <i class="fa-solid fa-angle-right"></i>
                          </div>
                        </a><a id="toggle-size-sub" class="cs-item line-center" data-type="fontSize-sub" data-title="Cỡ chữ Song ngữ">
                          <div class="csi-title">Cỡ chữ</div>
                          <div class="csi-current line-center">
                            <span>${currentConfigSub.size}%</span>
                            <i class="fa-solid fa-angle-right"></i>
                          </div>
                        </a><a class="cs-item line-center" data-type="fontOpacity-sub" data-title="Độ trong Song ngữ">
                          <div class="csi-title">Độ trong</div>
                          <div class="csi-current line-center">
                            <span>${currentConfigSub.opacity}%</span>
                            <i class="fa-solid fa-angle-right"></i>
                          </div>
                        </a>
                        <a class="cs-item line-center" data-type="fontFamily-sub" data-title="Font chữ Song ngữ">
                          <div class="csi-title">Font chữ</div>
                          <div class="csi-current line-center">
                            <span>${currentConfigSub.font}</span>
                            <i class="fa-solid fa-angle-right"></i>
                          </div>
                        </a></div>
                    </div>
                  </div>
                  <div class="pop-buttons w-100 mt-3">
                    <a id="close-pop-sub" class="btn btn-block w-100 btn-light">Chọn xong</a>
                  </div>
                </div>
                <div class="player-dm level-2" style="display: none;">
                  <div class="sub-slide level-2 absolute-menu">
                    <div class="dropdown-title">
                      <span class="s-title back-level line-center small">
                        <i class="fa-solid fa-angle-left"></i>
                        <spa class="sub-menu-title"></spa>
                      </span>
      
                    </div>
                    <div class="cs-list sub-menu-list-item">
                    </div>
                  </div>
                </div>
              </div>`);
  }
});

$(document).on('click', '#close-pop-sub', function () {
  $('#video_pop').remove();
  playerInstance.play();
});

$(document).on('click', '#video_pop .cs-item[data-type]', function (e) {
  const mouseX = e.pageX;
  const mouseY = e.pageY;
  const title = $(this).data('title');
  const currentTitle = $('#video_pop .player-dm .sub-menu-title').text();
  const type = $(this).data('type');

  if (
    $('#video_pop .player-dm').css('display') == 'block' &&
    currentTitle == title
  ) {
    $('#video_pop .player-dm').css({
      display: 'none',
    });

    return;
  }

  $('#video_pop .player-dm').css({
    display: 'block',
    position: 'absolute',
    top: mouseY - 10,
    left: mouseX + 30,
    zIndex: 9999,
  });

  $('#video_pop .sub-slide').css({
    display: 'block',
  });

  $('#video_pop .sub-menu-list-item').css({
    display: 'block',
  });

  $('#video_pop .player-dm .sub-menu-title').text(title);

  switch (type) {
    case 'color':
      $('#video_pop .player-dm .sub-menu-list-item')
        .html(
          `
        ${arrayColor.map(item => renderItemColor(item.color, item.label, type)).join('')}
      `
        )
        .addClass('sub-color')
        .removeClass(
          'sub-size sub-opacity-font sub-border-font sub-background sub-opacity-background sub-font-family sub-color-sub sub-size-sub sub-opacity-font-sub sub-font-family-sub'
        );
      break;
    case 'fontSize':
      $('#video_pop .player-dm .sub-menu-list-item')
        .html(
          `${bcCaptionSizeOptions().map(item => renderItemFont(item.size, item.label, type)).join('')}`
        )
        .addClass('sub-size')
        .removeClass(
          'sub-color sub-opacity-font sub-border-font sub-background sub-opacity-background sub-font-family sub-color-sub sub-size-sub sub-opacity-font-sub sub-font-family-sub'
        );
      break;
    case 'fontOpacity':
      $('#video_pop .player-dm .sub-menu-list-item')
        .html(
          `${arrayOpacity.map(item => renderItemFont(item.opacity, item.label, type)).join('')}`
        )
        .addClass('sub-opacity-font')
        .removeClass(
          'sub-color sub-size sub-border-font sub-background sub-opacity-background sub-font-family sub-color-sub sub-size-sub sub-opacity-font-sub sub-font-family-sub'
        );
      break;
    case 'edgeStyle':
      $('#video_pop .player-dm .sub-menu-list-item').html(renderItemBorder());
      $('#video_pop .player-dm .sub-menu-list-item')
        .addClass('sub-border-font')
        .removeClass(
          'sub-color sub-size sub-opacity-font sub-background sub-opacity-background sub-font-family sub-color-sub sub-size-sub sub-opacity-font-sub sub-font-family-sub'
        );
      break;
    case 'backgroundColor':
      $('#video_pop .player-dm .sub-menu-list-item')
        .html(
          `${arrayBackground.map(item => renderItemColor(item.background, item.label, type, '#000000')).join('')}`
        )
        .addClass('sub-background')
        .removeClass(
          'sub-color sub-size sub-opacity-font sub-border-font sub-opacity-background sub-font-family sub-color-sub sub-size-sub sub-opacity-font-sub sub-font-family-sub'
        );
      break;
    case 'backgroundOpacity':
      $('#video_pop .player-dm .sub-menu-list-item')
        .html(
          `${arrayOpacity.map(item => renderItemFont(item.opacity, item.label, type)).join('')}`
        )
        .addClass('sub-opacity-background')
        .removeClass(
          'sub-color sub-size sub-opacity-font sub-border-font sub-background sub-font-family sub-color-sub sub-size-sub sub-opacity-font-sub sub-font-family-sub'
        );
      break;
    case 'fontFamily':
      $('#video_pop .player-dm .sub-menu-list-item')
        .html(
          `${arrayFont.map(item => renderItemFont(item.font, item.label, type)).join('')}`
        )
        .addClass('sub-font-family')
        .removeClass(
          'sub-color sub-size sub-opacity-font sub-border-font sub-background sub-opacity-background sub-color-sub sub-size-sub sub-opacity-font-sub sub-font-family-sub'
        );
      break;
    case 'color-sub':
      $('#video_pop .player-dm .sub-menu-list-item')
        .html(
          `${arrayColor.map(item => renderItemColor(item.color, item.label, 'color', 'white', currentConfigSub)).join('')}`
        )
        .addClass('sub-color-sub')
        .removeClass(
          'sub-size-sub sub-opacity-font-sub sub-border-font-sub sub-background-sub sub-opacity-background-sub sub-font-family-sub sub-color sub-opacity-font sub-border-font sub-background sub-opacity-background sub-font-family'
        );
      break;
    case 'fontSize-sub':
      $('#video_pop .player-dm .sub-menu-list-item')
        .html(
          `${arraySizeFont.map(item => renderItemFont(item.size, item.label, 'size', currentConfigSub)).join('')}`
        )
        .addClass('sub-size-sub')
        .removeClass(
          'sub-color-sub sub-opacity-font-sub sub-border-font-sub sub-background-sub sub-opacity-background-sub sub-font-family-sub sub-color sub-opacity-font sub-border-font sub-background sub-opacity-background sub-font-family'
        );
      break;
    case 'fontOpacity-sub':
      $('#video_pop .player-dm .sub-menu-list-item')
        .html(
          `${arrayOpacity.map(item => renderItemFont(item.opacity, item.label, 'opacity', currentConfigSub)).join('')}`
        )
        .addClass('sub-opacity-font-sub')
        .removeClass(
          'sub-color-sub sub-size-sub sub-border-font-sub sub-background-sub sub-opacity-background-sub sub-font-family-sub sub-color sub-opacity-font sub-border-font sub-background sub-opacity-background sub-font-family'
        );
      break;
    case 'fontFamily-sub':
      $('#video_pop .player-dm .sub-menu-list-item')
        .html(
          `${arrayFont.map(item => renderItemFont(item.font, item.label, 'font', currentConfigSub)).join('')}`
        )
        .addClass('sub-font-family-sub')
        .removeClass(
          'sub-color-sub sub-size-sub sub-opacity-font-sub sub-border-font-sub sub-background-sub sub-opacity-background-sub sub-color sub-opacity-font sub-border-font sub-background sub-opacity-background sub-font-family'
        );
      break;
  }
});

function renderItemColor(
  value,
  label,
  type,
  defaultValue = 'white',
  currentCaptions = null
) {
  const caps = currentCaptions || bcGetLiveCaptions();
  const current = caps[type] != null ? caps[type] : defaultValue;
  let active = '';
  if (type === 'color' || type === 'color-sub') {
    active =
      bcCaptionTextColorCss(value) === bcCaptionTextColorCss(current)
        ? 'active'
        : '';
  } else if (type === 'backgroundColor') {
    active =
      String(value || '').toLowerCase() === String(current || '').toLowerCase()
        ? 'active'
        : '';
  } else {
    active = value === current ? 'active' : '';
  }

  return `<a class="cs-item line-center ${active}" data-menu="mainMenu" data="${value}" data-label="${label}" data-key="${type}">
              <div class="csi-color" style="background-color: ${value};"></div>
              <div class="csi-title">${label}</div>
              <i class="fa-solid fa-check"></i>
            </a>`;
}

function renderItemFont(
  value,
  label,
  type,
  currentCaptions = null
) {
  const caps = currentCaptions || bcGetLiveCaptions();
  let v1 = value;
  let v2 = caps[type];
  if (!isNaN(v1) && !isNaN(v2)) {
    v1 = parseInt(v1, 10);
    v2 = parseInt(v2, 10);
  }

  const active = v1 === v2 ? 'active' : '';
  return `<a class="cs-item line-center ${active}" data-menu="mainMenu" data="${value}" data-label="${label}" data-key="${type}">
              <div class="csi-font">${label}</div>
              <i class="fa-solid fa-check"></i>
            </a>`;
}

function renderItemBorder() {
  const currentCaptions = playerInstance.getConfig().captions;
  const active = currentCaptions.edgeStyle === 'none' ? 'active' : '';
  const activeUniform = currentCaptions.edgeStyle === 'raised' ? 'active' : '';
  const activeShadow = currentCaptions.edgeStyle === 'uniform' ? 'active' : '';
  return `<a class="cs-item line-center ${active}" data-menu="mainMenu" data="none" data-label="Không viền" data-key="edgeStyle">
              <div class="csi-font">Không viền</div>
              <i class="fa-solid fa-check"></i>
            </a>
            <a class="cs-item line-center ${activeUniform}" data-menu="mainMenu" data="raised" data-label="Bo viền" data-key="edgeStyle">
              <div class="csi-font">Bo viền</div>
              <i class="fa-solid fa-check"></i>
            </a>
            <a class="cs-item line-center ${activeShadow}" data-menu="mainMenu" data="uniform" data-label="Đổ bóng" data-key="edgeStyle">
              <div class="csi-font">Đổ bóng</div>
              <i class="fa-solid fa-check"></i>
            </a>
            `;
}

function hexXorEncrypt(text, key) {
  let result = '';
  const s = String(text || '');
  for (let i = 0; i < s.length; i++) {
    const encrypted = s.charCodeAt(i) ^ key.charCodeAt(i % key.length);
    result += encrypted.toString(16).padStart(2, '0');
  }
  return result;
}

function hexXorDecrypt(encrypted, key) {
  let result = '';
  for (let i = 0; i < encrypted.length; i += 2) {
    const hexPair = encrypted.substr(i, 2);
    const charCode = parseInt(hexPair, 16);
    const keyChar = key.charCodeAt((i / 2) % key.length);
    const decrypted = charCode ^ keyChar;
    result += String.fromCharCode(decrypted);
  }
  return result;
}

/** Populate multi-audio menu: ViCDN sibling hashes HOẶC JW getAudioTracks (HLS multi-audio). */
function bcAudioTrackLabel(track, index) {
  if (!track) return `Audio ${index + 1}`;
  const lang = String(track.language || track.lang || '').toLowerCase();
  const name = String(track.name || track.label || '').trim();
  if (name) return name;
  if (lang === 'vie' || lang === 'vi' || lang.startsWith('vi')) return 'Tiếng Việt';
  if (lang === 'zho' || lang === 'zh' || lang === 'chi' || lang === 'cmn' || lang.startsWith('zh'))
    return 'Tiếng Trung';
  if (lang === 'eng' || lang === 'en' || lang.startsWith('en')) return 'Tiếng Anh';
  if (lang && lang !== 'und') return lang.toUpperCase();
  return `Audio ${index + 1}`;
}

function bcBuildAudioMenuFromJwTracks() {
  const $btn = $('.jw-audio-button');
  const $menu = $('.jw-audio-menu-list');
  if (!$menu.length || !playerInstance) return false;
  let tracks = [];
  try {
    tracks = playerInstance.getAudioTracks() || [];
  } catch (e) {
    return false;
  }
  if (!Array.isArray(tracks) || tracks.length < 2) {
    $btn.addClass('d-none');
    $menu.empty();
    return false;
  }
  $menu.empty();
  $btn.removeClass('d-none');
  let current = 0;
  try {
    current = playerInstance.getCurrentAudio() ?? 0;
  } catch (e) {
    current = 0;
  }
  const activeLabel = bcAudioTrackLabel(tracks[current], current);
  $('.jw-audio-label').text(
    String(activeLabel)
      .replace(/^[^\wÀ-ỹ]+/u, '')
      .trim()
      .slice(0, 18) || 'Audio'
  );
  tracks.forEach((track, index) => {
    const label = bcAudioTrackLabel(track, index);
    const isActive = index === current;
    $menu.append(`
      <a class="dropdown-item ${isActive ? 'active' : ''}" href="#" data-audio-index="${index}" label="${String(label).replace(/"/g, '&quot;')}">
        <span class="s-title">${label}</span>
        <div class="w-check"><i class="fa-solid fa-check"></i></div>
      </a>
    `);
  });
  return true;
}

function bcBuildAudioMenu() {
  const list = Array.isArray(playerOptions.audios) ? playerOptions.audios : [];
  const $btn = $('.jw-audio-button');
  const $menu = $('.jw-audio-menu-list');
  if (!$menu.length) return;

  // ViCDN / sibling hashes: load master khác
  if (list.length >= 2) {
    $menu.empty();
    $btn.removeClass('d-none');
    const active =
      list.find((a) => a.active) ||
      list.find((a) => a.hash && String(a.hash) === String(hash)) ||
      list[0];
    if (active?.label) {
      $('.jw-audio-label').text(
        String(active.label)
          .replace(/^[^\wÀ-ỹ]+/u, '')
          .trim()
          .slice(0, 18) || 'Audio'
      );
    }
    const originBase =
      typeof baseUrl !== 'undefined' ? baseUrl : window.location.origin;
    list.forEach((a) => {
      const url =
        a.url || (a.hash ? `${originBase}/stream/${a.hash}/master.m3u8` : '');
      if (!url) return;
      const enc = hexXorEncrypt(url, 'mySecretKey2024');
      const isActive = !!(
        a.active ||
        (active && a.hash && a.hash === active.hash)
      );
      $menu.append(`
      <a class="dropdown-item ${isActive ? 'active' : ''}" href="#" data="${enc}" data-hash="${a.hash || ''}" label="${String(a.label || a.key || 'Audio').replace(/"/g, '&quot;')}">
        <span class="s-title">${a.label || a.key || 'Audio'}</span>
        <div class="w-check"><i class="fa-solid fa-check"></i></div>
      </a>
    `);
    });
    return;
  }

  // HLS multi-audio trong cùng master (Youku, …)
  if (!bcBuildAudioMenuFromJwTracks()) {
    $btn.addClass('d-none');
    $menu.empty();
  }
}

