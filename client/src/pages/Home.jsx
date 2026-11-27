import React, { useEffect, useState, Suspense } from 'react'; // Import Suspense
import { Helmet } from 'react-helmet-async';
import HeroSection from '../components/movies/HeroSection';
import ContinueWatchingRow from '../components/movies/ContinueWatchingRow';
// Load Lazy Component để tách bundle
const LazyMovieRow = React.lazy(() => import('../components/movies/LazyMovieRow'));
import { HomeSkeleton, RowSkeleton } from '../components/common/Skeleton'; // Import thêm RowSkeleton
import { getHomeData } from '../services/movieService';
import { HOME_ROWS } from '../config/menuRows';
import { useTheme } from '../context/ThemeContext';

const Home = () => {
  const [loadingBanner, setLoadingBanner] = useState(true);
  const [bannerMovies, setBannerMovies] = useState([]);

  // Giai đoạn 3 (L10): hàng trang chủ lấy từ config chung với menu header
  // (client/src/config/menuRows.js) để không lệch slug nữa.
  const ROW_CONFIG = HOME_ROWS;

  // Nhóm D (Custom UI, 23/11/2026): ẩn/hiện hàng — đọc theme.hiddenRows
  // qua useTheme() (hợp đồng nhóm B); id hàng = slug trong HOME_ROWS,
  // khớp đúng với toggle ở Profile.jsx (nhóm C). Khi chưa có Provider
  // thì fallback [] (hiện đủ 7 hàng) thay vì crash.
  let themeApi = null;
  try { themeApi = useTheme(); } catch (e) { themeApi = null; }
  const hiddenRows = themeApi?.theme?.hiddenRows || [];
  const customRows = themeApi?.theme?.customRows;
  const visibleRows = Array.isArray(customRows) && customRows.length > 0
      ? customRows.filter((row) => row.enabled !== false)
      : ROW_CONFIG.filter((row) => !hiddenRows.includes(row.slug));

  useEffect(() => {
    const fetchPriorityData = async () => {
        try {
            const bannerData = await getHomeData();
            if (bannerData?.data?.items) {
                setBannerMovies(bannerData.data.items.slice(0, 8));
            }
        } catch (err) {
            console.error("Home Load Error:", err);
        } finally {
            setLoadingBanner(false);
        }
    };
    fetchPriorityData();
  }, []);

  if (loadingBanner) return <HomeSkeleton />;

  return (
    <div className="min-h-screen bg-phim-dark pb-20 overflow-x-hidden">
      <Helmet>
        <title>PhimVietHay - Xem Phim Online HD Vietsub</title>
        <meta name="description" content="Web xem phim miễn phí, chất lượng cao, cập nhật nhanh nhất." />
      </Helmet>

      {/* Banner Priority */}
      <HeroSection movies={bannerMovies} />
      
      {/* Lazy Load Rows */}
      <div className="relative z-10 px-0 space-y-2 md:space-y-4 pb-10 mt-8 md:mt-12 bg-gradient-to-b from-phim-dark/0 via-phim-dark to-phim-dark">
            {/* Hàng Tiếp Tục Xem (chỉ hiện cho user đã đăng nhập và có phim đang xem dở) */}
            <ContinueWatchingRow />

            {visibleRows.length === 0 ? (
                <div className="px-4 py-16 text-center">
                    <p className="text-gray-400 text-sm">Bạn đã ẩn tất cả các hàng — vào Hồ sơ &gt; Giao diện để hiện lại.</p>
                </div>
            ) : visibleRows.map((row, index) => (
                <Suspense key={index} fallback={<div className="h-40 bg-white/5 animate-pulse mx-4 rounded-xl"/>}>
                    <LazyMovieRow 
                        title={row.title} 
                        slug={row.slug} 
                        type={row.type} 
                    />
                </Suspense>
            ))}
      </div>
    </div>
  );
};

export default Home;