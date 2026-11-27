// Controller tách URL m3u8 từ trang embed của vsmov.
// Bối cảnh: API vsmov CHỈ trả link_embed (field link_m3u8 luôn null),
// muốn có m3u8 phải fetch HTML trang embed rồi parse URL m3u8 trong
// cấu hình JWPlayer của trang đó.
// Cache in-memory 30 phút theo URL embed để tránh gọi lại vsmov liên tục,
// kèm header giả lập trình duyệt và cơ chế retry khi mạng chập chờn.
const BROWSER_HEADERS = {
    'User-Agent':
        'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/131.0.0.0 Safari/537.36',
    'Accept':
        'text/html,application/xhtml+xml,application/xml;q=0.9,image/avif,image/webp,image/apng,*/*;q=0.8',
    'Accept-Language': 'vi-VN,vi;q=0.9,en-US;q=0.8,en;q=0.7',
    'Sec-Ch-Ua': '"Google Chrome";v="131", "Chromium";v="131", "Not_A Brand";v="24"',
    'Sec-Ch-Ua-Mobile': '?0',
    'Sec-Ch-Ua-Platform': '"Windows"',
    'Sec-Fetch-Dest': 'iframe',
    'Sec-Fetch-Mode': 'navigate',
    'Sec-Fetch-Site': 'cross-site',
    'Upgrade-Insecure-Requests': '1',
    'Cache-Control': 'max-age=0'
};

const FETCH_TIMEOUT_MS = 10000;
const CACHE_TTL_MS = 30 * 60 * 1000; // 30 phút

// Cache in-memory: embedUrl -> { m3u8, subtitles, expiresAt }
const cache = new Map();

function pruneCache() {
    const now = Date.now();
    for (const [key, val] of cache.entries()) {
        if (!val || val.expiresAt <= now) {
            cache.delete(key);
        }
    }
    if (cache.size > 500) {
        const oldestKeys = Array.from(cache.keys()).slice(0, 100);
        for (const k of oldestKeys) cache.delete(k);
    }
}

// Host embed hợp lệ: host thực tế đo được 23/11/2026 là
// v10.streamvsmov.com (dạng v<so>.streamvsmov.com). Chấp nhận mọi
// subdomain của streamvsmov.com và vsmov.com.
function isAllowedEmbedHost(hostname) {
    const h = (hostname || '').toLowerCase();
    return (
        h === 'vsmov.com' ||
        h.endsWith('.vsmov.com') ||
        h === 'streamvsmov.com' ||
        h.endsWith('.streamvsmov.com')
    );
}

function unescapeUrl(u) {
    return u.replace(/\\\//g, '/').replace(/\\u0026/g, '&');
}

function isHttpUrl(u) {
    try {
        const parsed = new URL(u);
        return parsed.protocol === 'http:' || parsed.protocol === 'https:';
    } catch {
        return false;
    }
}

// Parse URL m3u8 trong HTML trang embed, thử lần lượt theo thứ tự ưu tiên.
function parseM3u8(html) {
    // (0) signedMasterUrl: khi enableSignedUrl=true, trang embed nhúng sẵn
    // URL m3u8 đã ký trong playerOptions (vd: signedMasterUrl: "https://...m3u8?token=...").
    const signed = html.match(/signedMasterUrl\s*:\s*["']([^"']+\.m3u8[^"']*)["']/i);
    if (signed && signed[1]) {
        const u = unescapeUrl(signed[1]);
        if (isHttpUrl(u)) return u;
    }

    // (a) "file":"...m3u8" (JSON JWPlayer config)
    const fileJson = html.match(/"file"\s*:\s*"([^"]+\.m3u8[^"]*)"/i);
    if (fileJson && fileJson[1]) {
        const u = unescapeUrl(fileJson[1]);
        if (isHttpUrl(u)) return u;
    }

    // (b) file: '...m3u8' (JS object literal, quote đơn)
    const fileJs = html.match(/file\s*:\s*'([^']+\.m3u8[^']*)'/i);
    if (fileJs && fileJs[1]) {
        const u = unescapeUrl(fileJs[1]);
        if (isHttpUrl(u)) return u;
    }

    // (c) sources:[{file:"...m3u8"...}]
    const sources = html.match(/sources\s*:\s*\[\s*\{\s*file\s*:\s*["']([^"']+\.m3u8[^"']*)["']/i);
    if (sources && sources[1]) {
        const u = unescapeUrl(sources[1]);
        if (isHttpUrl(u)) return u;
    }

    // (d) Cơ chế thực tế của trang embed vsmov (đo 23/11/2026):
    // playerSource = baseUrl + '/stream/' + videoHash + '/master.m3u8'
    // với baseUrl = "https://v10.streamvsmov.com", videoHash = UUID trong URL embed.
    const base = html.match(/const\s+baseUrl\s*=\s*["'](https?:\/\/[^"']+)["']/i);
    const hash = html.match(/const\s+videoHash\s*=\s*["']([0-9a-f-]{36})["']/i);
    if (base && hash) {
        const u = `${base[1].replace(/\/$/, '')}/stream/${hash[1]}/master.m3u8`;
        if (isHttpUrl(u)) return u;
    }

    // (e) Bất kỳ URL .m3u8 nào trong trang — ưu tiên URL có query/signature.
    const all = [...html.matchAll(/https?:\/\/[^\s"'<>\\]+\.m3u8[^\s"'<>\\]*/gi)]
        .map((m) => unescapeUrl(m[0]))
        .filter(isHttpUrl);
    if (all.length) {
        const signedOne = all.find((u) => u.includes('?'));
        return signedOne || all[0];
    }

    return null;
}

// Parse mảng phụ đề trong HTML trang embed (phát hiện 24/11/2026).
// Trang embed nhúng: subtitles: [{"name":"vie ...","type":"local",
// "url":"/video/<uuid>/subtitle/vie_....vtt","code":"vie"}, {...eng...}]
// URL trong đó là tương đối (bắt đầu /video/...) nên phải resolve theo
// origin của trang embed. File .vtt trả Access-Control-Allow-Origin: *
// (đo 24/11/2026, cả origin HTTP lẫn HTTPS đều được) nên JWPlayer tải
// được từ mọi domain — khác với segment video (chỉ cho HTTPS).
// Trả về [{ file (URL tuyệt đối), label, code }] hoặc [] nếu không có.
const SUBTITLE_LABELS = {
    vie: 'Tiếng Việt',
    eng: 'English',
    chi: 'Tiếng Trung',
    kor: 'Tiếng Hàn',
    jpn: 'Tiếng Nhật',
    tha: 'Tiếng Thái',
    ind: 'Tiếng Indo',
    fre: 'Tiếng Pháp',
    ger: 'Tiếng Đức',
    spa: 'Tiếng Tây Ban Nha',
    rus: 'Tiếng Nga',
};

function parseSubtitles(html, embedOrigin) {
    try {
        const m = html.match(/subtitles\s*:\s*(\[.*?\])\s*[,}\]]/s);
        if (!m || !m[1]) return [];
        const arr = JSON.parse(m[1]);
        if (!Array.isArray(arr)) return [];
        const out = [];
        for (const item of arr) {
            if (!item || typeof item.url !== 'string') continue;
            const rel = unescapeUrl(item.url);
            let file = rel;
            try {
                file = new URL(rel, embedOrigin).toString();
            } catch {
                if (!isHttpUrl(file)) continue;
            }
            if (!isHttpUrl(file)) continue;
            if (!/\.vtt(\?|$)/i.test(file)) continue;
            const code = String(item.code || '').toLowerCase();
            const label = SUBTITLE_LABELS[code] || (code ? code.toUpperCase() : 'Phụ đề');
            out.push({ file, label, code: code || undefined });
        }
        return out;
    } catch {
        return [];
    }
}

async function extractM3u8(req, res) {
    const embed = req.query.embed;

    if (!embed || typeof embed !== 'string') {
        return res.status(400).json({ error: 'Thiếu tham số embed' });
    }

    let embedUrl;
    try {
        embedUrl = new URL(embed);
    } catch {
        return res.status(400).json({ error: 'URL embed không hợp lệ' });
    }

    if (!isAllowedEmbedHost(embedUrl.hostname)) {
        return res.status(400).json({ error: 'URL embed không thuộc vsmov' });
    }

    // Cache 30 phút theo URL embed để giảm tải tối đa và chống nghẽn.
    const now = Date.now();
    const cached = cache.get(embed);
    if (cached && cached.expiresAt > now) {
        res.setHeader('Cache-Control', 'public, max-age=1800, stale-while-revalidate=300');
        return res.json({ m3u8: cached.m3u8, subtitles: cached.subtitles || [] });
    }
    cache.delete(embed);

    let html = null;
    const fetchHeaders = {
        ...BROWSER_HEADERS,
        'Referer': `${embedUrl.origin}/`,
    };

    // Retry tối đa 2 lần với backoff 400ms nếu vsmov phản hồi chậm hoặc lỗi mạng
    for (let attempt = 1; attempt <= 2; attempt++) {
        const controller = new AbortController();
        const timer = setTimeout(() => controller.abort(), FETCH_TIMEOUT_MS);
        try {
            const response = await fetch(embed, {
                headers: fetchHeaders,
                signal: controller.signal,
                redirect: 'follow',
            });
            if (response.ok) {
                html = await response.text();
                break;
            }
        } catch (err) {
            if (attempt === 2) {
                break;
            }
        } finally {
            clearTimeout(timer);
        }
        if (attempt === 1) {
            await new Promise((resolve) => setTimeout(resolve, 400));
        }
    }

    if (!html) {
        return res.status(404).json({ error: 'Không tách được m3u8' });
    }

    const m3u8 = parseM3u8(html);
    if (!m3u8) {
        return res.status(404).json({ error: 'Không tách được m3u8' });
    }

    // Phụ đề: tách mảng subtitles trong HTML trang embed (nếu có).
    // Không có sub thì trả [] — player vẫn chạy bình thường, chỉ không có track.
    const subtitles = parseSubtitles(html, embedUrl.origin);

    if (cache.size > 500) {
        pruneCache();
    }
    cache.set(embed, { m3u8, subtitles, expiresAt: now + CACHE_TTL_MS });

    res.setHeader('Cache-Control', 'public, max-age=1800, stale-while-revalidate=300');
    return res.json({ m3u8, subtitles });
}

module.exports = { extractM3u8 };
