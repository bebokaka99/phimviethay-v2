import React, { useState, useEffect } from 'react';
import MovieRow from './MovieRow';
import { getMoviesBySlug } from '../../services/movieService'; // Sửa lại đường dẫn import cho đúng thư mục của bạn
import useOnScreen from '../../hooks/useOnScreen'; // Import hook vừa tạo

const LazyMovieRow = ({ title, slug, type }) => {
    // ref: Gắn vào thẻ div bao ngoài
    // isVisible: True khi người dùng cuộn tới thẻ div này
    // rootMargin: '200px' -> Tải trước khi cuộn tới 200px cho mượt
    const [ref, isVisible] = useOnScreen({ rootMargin: '200px' });
    
    const [movies, setMovies] = useState([]);
    const [loading, setLoading] = useState(true);
    // Giai đoạn 3 (L9): đánh dấu đã tải xong để không gọi lại khi cuộn
    // ra/vào, và để phân biệt "đang tải" với "0 phim".
    const [fetched, setFetched] = useState(false);

    useEffect(() => {
        // Chỉ gọi API khi isVisible = true và chưa tải lần nào
        if (isVisible && !fetched) {
            const fetchData = async () => {
                try {
                    const res = await getMoviesBySlug(slug, 1, type);
                    if (res?.data?.items) {
                        setMovies(res.data.items);
                    }
                } catch (error) {
                    console.error(`Lỗi tải ${title}:`, error);
                } finally {
                    setLoading(false);
                    setFetched(true);
                }
            };
            fetchData();
        }
    }, [isVisible, slug, type, title, fetched]);

    // Giai đoạn 3 (L9): 3 trạng thái riêng — chưa cuộn tới (giữ chỗ),
    // đang tải (skeleton), 0 phim (ẩn hẳn hàng, không để skeleton chạy mãi).
    if (fetched && !loading && movies.length === 0) return null;

    return (
        // Div giữ chỗ (Placeholder)
        // Min-height & contentVisibility giúp tránh layout shift và tối ưu render
        <div ref={ref} className="min-h-[350px] transition-opacity duration-500" style={{ contentVisibility: 'auto', containIntrinsicSize: '0 380px' }}>
            {isVisible && !loading && movies.length > 0 ? (
                <MovieRow title={title} movies={movies} slug={slug} type={type} />
            ) : (
                // Skeleton đơn giản trong lúc chờ cuộn tới hoặc chờ API
                <div className="px-4 md:px-16 py-8 space-y-4 opacity-50">
                     <div className="h-8 w-48 bg-gray-800 rounded animate-pulse"/>
                     <div className="flex gap-4 overflow-hidden">
                        {[1,2,3,4,5].map(i => (
                            <div key={i} className="h-[280px] min-w-[200px] bg-gray-800 rounded-lg animate-pulse"/>
                        ))}
                     </div>
                </div>
            )}
        </div>
    );
};

export default LazyMovieRow;