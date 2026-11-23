// Controller tách URL m3u8 từ trang embed của vsmov (23/11/2026).
// Bối cảnh: API vsmov CHỈ trả link_embed (field link_m3u8 luôn null),
// muốn có m3u8 phải fetch HTML trang embed rồi parse URL m3u8 trong
// cấu hình JWPlayer của trang đó. m3u8 có ký, hết hạn nhanh nên
// KHÔNG lưu DB — chỉ cache in-memory tối đa 5 phút theo URL embed.
const USER_AGENT =
    'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36';

const FETCH_TIMEOUT_MS = 10000;
const CACHE_TTL_MS = 5 * 60 * 1000;

// Cache in-memory: embedUrl -> { m3u8, expiresAt }
const cache = new Map();

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

    // Cache 5 phút theo URL embed (m3u8 hết hạn nhanh nên không cache lâu hơn).
    const now = Date.now();
    const cached = cache.get(embed);
    if (cached && cached.expiresAt > now) {
        return res.json({ m3u8: cached.m3u8 });
    }
    cache.delete(embed);

    let html;
    try {
        const controller = new AbortController();
        const timer = setTimeout(() => controller.abort(), FETCH_TIMEOUT_MS);
        let response;
        try {
            response = await fetch(embed, {
                headers: { 'User-Agent': USER_AGENT },
                signal: controller.signal,
                redirect: 'follow',
            });
        } finally {
            clearTimeout(timer);
        }
        if (!response.ok) {
            return res.status(404).json({ error: 'Không tách được m3u8' });
        }
        html = await response.text();
    } catch (err) {
        if (err && err.name === 'AbortError') {
            return res.status(404).json({ error: 'Không tách được m3u8' });
        }
        return res.status(404).json({ error: 'Không tách được m3u8' });
    }

    const m3u8 = parseM3u8(html);
    if (!m3u8) {
        return res.status(404).json({ error: 'Không tách được m3u8' });
    }

    cache.set(embed, { m3u8, expiresAt: now + CACHE_TTL_MS });
    return res.json({ m3u8 });
}

module.exports = { extractM3u8 };
