import React, { useState, useEffect } from 'react';

// Tối ưu ảnh 22/11/2026 (SỬA 22/11/2026 tối): BỎ images.weserv.nl.
// Đo thật: ảnh qua weserv TTFB 1,09s (kể cả khi đã cache) trong khi ảnh gốc
// vsmov chỉ 0,76s cho file 392KB — nút thắt là ĐỘ TRỄ mạng chứ không phải
// dung lượng file. vsmov là CDN Việt Nam (nhanh ở VN), còn weserv là proxy
// nước ngoài (trễ cao ở VN) nên poster tải qua weserv CHẬM HƠN và hay kẹt
// khi cuộn nhanh (người dùng báo 1 số phim không load được). Vì vậy dùng
// thẳng URL gốc vsmov + skeleton/fade-in; TMDB thì vẫn dùng size w342/w500.
export function getOptimizedImageUrl(url, width = 500) {
    if (!url) return '';
    if (url.includes('image.tmdb.org')) {
        const size = width <= 300 ? 'w342' : width <= 500 ? 'w500' : width <= 780 ? 'w780' : 'original';
        return url.replace(/\/t\/p\/[^/]+\//, `/t/p/${size}/`);
    }
    return url;
}

const OptimizedImage = ({ src, width = 500, alt = '', className = '', eager = false, fetchPriority, ...rest }) => {
    const optimized = getOptimizedImageUrl(src, width);
    const [current, setCurrent] = useState(optimized);
    const [loaded, setLoaded] = useState(false);
    const [usedFallback, setUsedFallback] = useState(false);

    useEffect(() => {
        setCurrent(getOptimizedImageUrl(src, width));
        setLoaded(false);
        setUsedFallback(false);
    }, [src, width]);

    return (
        <div className="relative w-full h-full">
            {!loaded && (
                <div className="absolute inset-0 bg-[#1a1a1a] animate-pulse pointer-events-none" aria-hidden="true" />
            )}
            <img
                {...rest}
                src={current}
                alt={alt}
                loading={eager ? 'eager' : 'lazy'}
                decoding="async"
                fetchPriority={fetchPriority}
                // SỬA 22/11/2026 tối (theo ý user): KHÔNG ẩn ảnh bằng opacity-0
                // cho đến khi tải xong nữa. Trước đây ảnh phải tải xong hết mới
                // hiện nên hero/poster chỉ thấy ô đen rất lâu; giờ ảnh hiện dần
                // theo kiểu gốc (tải tới đâu hiện tới đó), khung mờ chỉ làm nền
                // chờ phía sau. Giữ lại skeleton + tự về URL gốc khi lỗi.
                className={`relative ${className}`}
                onLoad={() => setLoaded(true)}
                onError={() => {
                    if (!usedFallback && current !== src) {
                        setUsedFallback(true);
                        setCurrent(src);
                    }
                }}
            />
        </div>
    );
};

export default OptimizedImage;
