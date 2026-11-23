import React, { useState, useEffect, useRef, useCallback } from 'react';
import { useNavigate, Link, NavLink, useLocation } from 'react-router-dom'; 
import { FaSearch, FaChevronDown, FaTimes, FaSpinner, FaBars, FaList, FaHistory, FaUser, FaHeart, FaSignOutAlt, FaCog, FaFilm, FaChartBar, FaGlobeAsia, FaLayerGroup } from 'react-icons/fa';
import { getMenuData, searchMovies } from '../../services/movieService';
import { useDebounce } from '../../hooks/useDebounce';
import { getRoleLabel } from '../../utils/roleLabel';
import { getCurrentUser, logout, getMe } from '../../services/authService';
import { LIST_ITEMS, POPULAR_GENRES, POPULAR_COUNTRIES, POPULAR_SEARCHES, HIDDEN_GENRE_SLUGS, HIDDEN_COUNTRY_SLUGS } from '../../config/menuRows';
import Logo from '../common/Logo';
import UserAvatar from '../common/UserAvatar';

const HISTORY_KEY = 'phimviethay_recent_searches';

const Header = () => {
    const navigate = useNavigate();
    const location = useLocation();
    const [isScrolled, setIsScrolled] = useState(false);
    // Giai đoạn 3 (H4): header ẩn khi cuộn xuống, hiện khi cuộn lên.
    const [hideHeader, setHideHeader] = useState(false);
    const [mobileMenuOpen, setMobileMenuOpen] = useState(false);
    const [activeMobileSubmenu, setActiveMobileSubmenu] = useState('');
    const [menuData, setMenuData] = useState({ theLoai: [], quocGia: [] });
    // Giai đoạn 3 (L8): trạng thái tải/lỗi của menu (trước đây lỗi thì menu trống im lặng).
    const [menuError, setMenuError] = useState(false);
    const [menuLoading, setMenuLoading] = useState(true);
    const [user, setUser] = useState(null);
    const [showSearch, setShowSearch] = useState(false);
    const [keyword, setKeyword] = useState('');
    const [results, setResults] = useState([]);
    const [searchTotal, setSearchTotal] = useState(0);
    const [activeResult, setActiveResult] = useState(-1);
    const [isSearching, setIsSearching] = useState(false);
    const [searchHistory, setSearchHistory] = useState(() => {
        try { return JSON.parse(localStorage.getItem(HISTORY_KEY) || '[]'); } catch (e) { return []; }
    });
    const debouncedKeyword = useDebounce(keyword, 500);
    const searchRef = useRef(null);
    const searchInputRef = useRef(null);

    // Giai đoạn 3 (H3): dropdown điều khiển bằng state (click/bàn phím/
    // trễ đóng) thay cho group-hover thuần — dùng được trên laptop cảm ứng.
    const [openMenu, setOpenMenu] = useState(null); // 'danh-sach' | 'the-loai' | 'quoc-gia' | 'user' | null
    const openTimerRef = useRef(null);
    const closeTimerRef = useRef(null);
    const menuPanelRefs = useRef({});
    const navRef = useRef(null);
    const userMenuRef = useRef(null);
    const lastScrollYRef = useRef(0);

    // Giai đoạn 3 (H6): tìm kiếm trong drawer mobile.
    const [drawerSearch, setDrawerSearch] = useState('');

    // UI 22/11/2026: mở ô tìm kiếm thì tự focus để gõ ngay (trước đây mở
    // ra nhưng không focus, phải bấm thêm 1 lần vào ô).
    useEffect(() => {
        if (showSearch && searchInputRef.current) searchInputRef.current.focus();
    }, [showSearch]);

    // Giai đoạn 3 (L8): tải menu có retry (trong getMenuData) + cache phiên;
    // lỗi thì hiện trạng thái lỗi + nút thử lại thay vì menu trống.
    const loadMenuData = useCallback(async () => {
        setMenuLoading(true);
        setMenuError(false);
        const menu = await getMenuData();
        if (menu) {
            setMenuData(menu);
            setMenuError(false);
        } else {
            setMenuError(true);
        }
        setMenuLoading(false);
    }, []);

    // Giai đoạn 3 (H4): chiều cao cố định h-16; ẩn khi cuộn xuống,
    // hiện khi cuộn lên; không ẩn khi đang mở menu/drawer.
    useEffect(() => {
        const handleScroll = () => {
            const y = window.scrollY;
            setIsScrolled(y > 20);
            const lastY = lastScrollYRef.current;
            if (y > lastY && y > 120 && !openMenu && !mobileMenuOpen) setHideHeader(true);
            else if (y < lastY || y <= 120) setHideHeader(false);
            lastScrollYRef.current = y;
        };
        window.addEventListener('scroll', handleScroll, { passive: true });
        return () => window.removeEventListener('scroll', handleScroll);
    }, [openMenu, mobileMenuOpen]);

    // Giai đoạn 3 (H5): Ctrl+K/Cmd+K mở tìm kiếm; Escape đóng menu/tìm kiếm.
    useEffect(() => {
        const onKey = (e) => {
            if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === 'k') {
                e.preventDefault();
                setShowSearch(true);
            }
            if (e.key === 'Escape') {
                setOpenMenu(null);
                setShowSearch(false);
            }
        };
        document.addEventListener('keydown', onKey);
        return () => document.removeEventListener('keydown', onKey);
    }, []);

    useEffect(() => {
        const handleClickOutside = (event) => {
            if (searchRef.current && !searchRef.current.contains(event.target)) setShowSearch(false);
            if (navRef.current && !navRef.current.contains(event.target)
                && userMenuRef.current && !userMenuRef.current.contains(event.target)) {
                setOpenMenu(null);
            }
        };
        
        const initHeaderData = async () => {
            await loadMenuData();

            let currentUser = getCurrentUser();
            const token = localStorage.getItem('token') || localStorage.getItem('accessToken');

            if (!currentUser && token) {
                try {
                    currentUser = await getMe();
                } catch (e) {
                   // Silent fail nếu lỗi
                }
            }
            setUser(currentUser);
        };
        
        document.addEventListener('mousedown', handleClickOutside);
        initHeaderData(); 

        return () => {
            document.removeEventListener('mousedown', handleClickOutside);
        };
    }, [loadMenuData]);

    useEffect(() => {
        setMobileMenuOpen(false);
        setOpenMenu(null);
        window.scrollTo(0, 0);
    }, [location]);

    useEffect(() => {
        const fetchApiSearch = async () => {
            if (!debouncedKeyword.trim()) { setResults([]); setSearchTotal(0); return; }
            setIsSearching(true);
            try {
                const data = await searchMovies(debouncedKeyword);
                setResults(data?.data?.items || []);
                setSearchTotal(data?.data?.params?.pagination?.totalItems || 0);
            } catch (e) { setResults([]); setSearchTotal(0); }
            setIsSearching(false);
        };
        fetchApiSearch();
    }, [debouncedKeyword]);

    useEffect(() => { setActiveResult(-1); }, [results]);

    // --- Giai đoạn 3 (H3): mở/đóng dropdown ---
    const clearMenuTimers = () => {
        if (openTimerRef.current) { clearTimeout(openTimerRef.current); openTimerRef.current = null; }
        if (closeTimerRef.current) { clearTimeout(closeTimerRef.current); closeTimerRef.current = null; }
    };
    const scheduleOpenMenu = (name) => {
        clearMenuTimers();
        openTimerRef.current = setTimeout(() => setOpenMenu(name), 150);
    };
    const scheduleCloseMenu = () => {
        clearMenuTimers();
        closeTimerRef.current = setTimeout(() => setOpenMenu(null), 200);
    };
    const toggleMenu = (name) => {
        clearMenuTimers();
        setOpenMenu(prev => (prev === name ? null : name));
    };
    // Fix nhanh 23/11/2026: click vào avatar chỉ MỞ dropdown user khi đang
    // đóng, KHÔNG toggle đóng khi đang mở (user trỏ vào thì mở, nhấn theo
    // thói quen thì click toggle làm nó mất). Đóng bằng: rời chuột (delay
    // 200ms như hiện tại), click ra ngoài, hoặc Escape. Chỉ dùng cho
    // dropdown user; các dropdown menu khác giữ nguyên toggleMenu.
    const openUserMenu = () => {
        clearMenuTimers();
        setOpenMenu(prev => (prev === 'user' ? prev : 'user'));
    };
    // Điều hướng bằng phím mũi tên trong menu đang mở; Escape đóng menu.
    // Không cướp phím khi đang gõ trong ô input của menu.
    const handleMenuKeyDown = (e) => {
        if (e.target && (e.target.tagName === 'INPUT' || e.target.tagName === 'TEXTAREA')) {
            if (e.key === 'Escape') setOpenMenu(null);
            return;
        }
        if (e.key === 'Escape') { setOpenMenu(null); return; }
        if (e.key !== 'ArrowDown' && e.key !== 'ArrowUp') return;
        if (!openMenu) return;
        const container = menuPanelRefs.current[openMenu];
        if (!container) return;
        const items = Array.from(container.querySelectorAll('a[href], button, input'));
        if (items.length === 0) return;
        e.preventDefault();
        const idx = items.indexOf(document.activeElement);
        const next = e.key === 'ArrowDown'
            ? items[(idx + 1) % items.length]
            : items[(idx - 1 + items.length) % items.length];
        next?.focus();
    };

    // --- Giai đoạn 3 (H5): lịch sử tìm kiếm + điều hướng kết quả ---
    const saveSearchHistory = (kw) => {
        const clean = (kw || '').trim();
        if (!clean) return;
        setSearchHistory(prev => {
            const next = [clean, ...prev.filter(x => x !== clean)].slice(0, 5);
            try { localStorage.setItem(HISTORY_KEY, JSON.stringify(next)); } catch (e) {}
            return next;
        });
    };
    const handleEnterSearch = (e) => {
        if (e) e.preventDefault();
        if (keyword.trim()) {
            saveSearchHistory(keyword);
            navigate(`/tim-kiem?keyword=${encodeURIComponent(keyword.trim())}`);
            setShowSearch(false);
        }
    };
    const openSearchResult = (movie) => {
        if (!movie) return;
        saveSearchHistory(movie.name);
        setShowSearch(false);
        setKeyword('');
        navigate(`/phim/${movie.slug}`);
    };
    const handleSearchKeyDown = (e) => {
        if (e.key === 'ArrowDown' || e.key === 'ArrowUp') {
            if (results.length === 0) return;
            e.preventDefault();
            e.stopPropagation();
            const max = results.length; // index = results.length là dòng "Xem tất cả"
            setActiveResult(prev => {
                if (e.key === 'ArrowDown') return prev >= max ? 0 : prev + 1;
                return prev <= 0 ? max : prev - 1;
            });
        } else if (e.key === 'Enter') {
            if (activeResult >= 0 && activeResult < results.length) {
                e.preventDefault();
                openSearchResult(results[activeResult]);
            }
            // activeResult = -1 hoặc = results.length: submit mặc định về trang tìm kiếm.
        }
    };
    const handleDrawerSearch = (e) => {
        e.preventDefault();
        if (drawerSearch.trim()) {
            saveSearchHistory(drawerSearch);
            setMobileMenuOpen(false);
            navigate(`/tim-kiem?keyword=${encodeURIComponent(drawerSearch.trim())}`);
        }
    };
    const toggleMobileSubmenu = (name) => setActiveMobileSubmenu(prev => prev === name ? '' : name);
    
    const handleLogout = () => { 
        logout(); 
        setUser(null); 
        setMobileMenuOpen(false); 
        navigate('/login'); 
    };

    // Giai đoạn 3 (L2/L3/L6): menu hiện đầy đủ 45 thể loại + 187 quốc gia
    // (đã bỏ slice ở Giai đoạn 2), ẩn slug trùng/rỗng của API.
    const visibleGenres = menuData.theLoai.filter(g => !HIDDEN_GENRE_SLUGS.includes(g.slug));
    const visibleCountries = menuData.quocGia.filter(c => !HIDDEN_COUNTRY_SLUGS.includes(c.slug));
    // Vòng sửa 4: gỡ ô tìm kiếm trong dropdown Thể loại/Quốc gia theo yêu
    // cầu user — danh sách dọc hiển thị đầy đủ, không lọc theo từ khóa nữa.

    // Giai đoạn 3 (H1): mục nào đang xem thì sáng + gạch đỏ (cả dropdown
    // theo nhóm route của nó).
    const isDanhSachActive = location.pathname.startsWith('/danh-sach');
    const isTheLoaiActive = location.pathname.startsWith('/the-loai');
    const isQuocGiaActive = location.pathname.startsWith('/quoc-gia');

    // Vòng sửa 3 — PHÁT HIỆN: đo thật bằng getComputedStyle cho thấy panel
    // menu và panel user TRƯỚC vòng 3 đã dùng ĐÚNG 1 class nền giống hệt
    // nhau (bg-[#111]/80 + backdrop-blur-xl + border-white/10, đều ra
    // rgba(17,17,17,0.8) + blur(24px)). Cảm giác panel menu "đặc/tối hơn"
    // không đến từ màu nền mà đến từ KÍCH THƯỚC + VỊ TRÍ: panel Thể loại/
    // Quốc gia 320×533px (gấp 2,3 lần diện tích panel user 256×289px),
    // bo góc nhỏ hơn (rounded-xl 12px so với rounded-2xl 16px của user)
    // và dính sát trigger (top=50, không có khe hở như pt-2 của user).
    // Vì vậy chỉ copy class cũ sang thì NHÌN VẪN Y NHƯ CŨ — để đạt mục
    // tiêu "mờ mờ như dropdown user", hạ CHUNG 1 kiểu nền duy nhất cho
    // mọi dropdown header (menu ×3, user, tìm kiếm) xuống bg-[#111]/60 +
    // backdrop-blur-2xl (blur mạnh hơn bù cho nền mờ hơn, vẫn đọc rõ chữ),
    // bo góc thống nhất rounded-2xl, panel menu thêm mt-2 (khe 8px như
    // pt-2 của user). Bên trong vẫn chỉ dùng nền trong suốt: dòng thường
    // trong suốt, hover bg-white/10, đang chọn bg-red-600/15, nút "Xem tất
    // cả" trong suốt + hover bg-white/10.
    const dropdownPanelBg = 'bg-[#111]/60 backdrop-blur-2xl border border-white/10 rounded-2xl shadow-2xl';
    const menuPanelClass = (name) => `absolute top-full left-0 mt-2 ${dropdownPanelBg} transition-all duration-200 ${openMenu === name ? 'opacity-100 visible translate-y-0' : 'opacity-0 invisible translate-y-2'}`;
    // Dòng dọc kiểu truyền thống (dùng chung cho Danh sách / Thể loại /
    // Quốc gia): thường trong suốt, hover mờ trắng, active đỏ mờ.
    const dropdownItemClass = (active) => `block px-4 py-2.5 text-sm transition-colors truncate ${active ? 'bg-red-600/15 text-white font-bold' : 'text-gray-300 hover:text-white hover:bg-white/10'}`;
    const triggerClass = (active) => `flex items-center gap-1 ${active ? 'text-white' : 'text-gray-300 hover:text-white'}`;
    const underlineClass = (active) => `absolute left-0 right-0 -bottom-0.5 h-0.5 bg-red-600 rounded-full origin-left transition-transform duration-300 ${active ? 'scale-x-100' : 'scale-x-0'}`;

    return (
        <>
            <header className={`fixed top-0 w-full z-[100] h-16 transition-transform duration-300 ${hideHeader ? '-translate-y-full' : 'translate-y-0'} ${isScrolled ? 'bg-[#0a0e17]/95 shadow-2xl border-b border-white/5' : 'bg-gradient-to-b from-black/80 to-transparent'}`}>
                <div className="w-full h-full px-4 md:px-8 container mx-auto flex items-center justify-between">
                    <div className="flex items-center gap-4 lg:gap-8">
                        <button className="lg:hidden text-white text-xl p-2 hover:bg-white/10 rounded-lg transition" onClick={() => setMobileMenuOpen(true)} aria-label="Mở menu">
                            <FaBars />
                        </button>
                        <Link to="/" className="block hover:opacity-90 transition transform hover:scale-105 duration-300">
                            <Logo />
                        </Link>
                        <ul ref={navRef} className="hidden lg:flex items-center gap-1 text-sm font-bold text-gray-300 h-full">
                            <li>
                                <NavLink to="/" end className={({ isActive }) => `relative px-4 py-2 rounded-lg transition block ${isActive ? 'text-white' : 'text-gray-300 hover:text-white hover:bg-white/5'}`}>
                                    {({ isActive }) => (<>Trang chủ<span className={underlineClass(isActive)} /></>)}
                                </NavLink>
                            </li>
                            <li className="relative px-3 py-2 cursor-pointer" onMouseEnter={() => scheduleOpenMenu('danh-sach')} onMouseLeave={scheduleCloseMenu} onKeyDown={handleMenuKeyDown}>
                                <button onClick={() => toggleMenu('danh-sach')} aria-expanded={openMenu === 'danh-sach'} aria-haspopup="true" className={`${triggerClass(isDanhSachActive || openMenu === 'danh-sach')} relative`}>
                                    Danh sách <FaChevronDown size={8} className={`transition-transform duration-200 ${openMenu === 'danh-sach' ? 'rotate-180' : ''}`} />
                                    <span className={underlineClass(isDanhSachActive)} />
                                </button>
                                <div ref={el => { menuPanelRefs.current['danh-sach'] = el; }} className={`${menuPanelClass('danh-sach')} w-48 overflow-hidden py-2`} onMouseEnter={clearMenuTimers} onMouseLeave={scheduleCloseMenu}>
                                    {LIST_ITEMS.map((item) => (<Link key={item.slug} to={`/danh-sach/${item.slug}`} className={dropdownItemClass(location.pathname === `/danh-sach/${item.slug}`)}>{item.name}</Link>))}
                                </div>
                            </li>
                            <li className="relative px-3 py-2 cursor-pointer" onMouseEnter={() => scheduleOpenMenu('the-loai')} onMouseLeave={scheduleCloseMenu} onKeyDown={handleMenuKeyDown}>
                                <button onClick={() => toggleMenu('the-loai')} aria-expanded={openMenu === 'the-loai'} aria-haspopup="true" className={`${triggerClass(isTheLoaiActive || openMenu === 'the-loai')} relative`}>
                                    Thể loại <FaChevronDown size={8} className={`transition-transform duration-200 ${openMenu === 'the-loai' ? 'rotate-180' : ''}`} />
                                    <span className={underlineClass(isTheLoaiActive)} />
                                </button>
                                <div ref={el => { menuPanelRefs.current['the-loai'] = el; }} className={`${menuPanelClass('the-loai')} w-64 max-w-[calc(100vw-2rem)] overflow-hidden py-2`} onMouseEnter={clearMenuTimers} onMouseLeave={scheduleCloseMenu}>
                                    {menuError ? (
                                        <div className="py-6 text-center">
                                            <p className="text-sm text-gray-400 mb-3">Không tải được danh sách thể loại.</p>
                                            <button onClick={loadMenuData} className="px-4 py-2 rounded-lg bg-red-600/70 text-white text-xs font-bold hover:bg-red-600/80 transition">Bấm để thử lại</button>
                                        </div>
                                    ) : menuLoading ? (
                                        <div className="py-6 flex items-center justify-center gap-2 text-sm text-gray-500"><FaSpinner className="animate-spin text-red-500" /> Đang tải...</div>
                                    ) : (
                                        <>
                                            <div className="max-h-[420px] overflow-y-auto custom-scrollbar">
                                                {visibleGenres.map((item) => (<Link key={item._id} to={`/the-loai/${item.slug}`} className={dropdownItemClass(location.pathname === `/the-loai/${item.slug}`)}>{item.name}</Link>))}
                                            </div>
                                            <div className="border-t border-white/10 mt-1 pt-1">
                                                <Link to="/danh-sach/phim-moi" className="block px-4 py-2.5 text-sm font-bold text-red-500 hover:text-red-400 hover:bg-white/10 transition text-center">Xem tất cả phim →</Link>
                                            </div>
                                        </>
                                    )}
                                </div>
                            </li>
                            <li className="relative px-3 py-2 cursor-pointer" onMouseEnter={() => scheduleOpenMenu('quoc-gia')} onMouseLeave={scheduleCloseMenu} onKeyDown={handleMenuKeyDown}>
                                <button onClick={() => toggleMenu('quoc-gia')} aria-expanded={openMenu === 'quoc-gia'} aria-haspopup="true" className={`${triggerClass(isQuocGiaActive || openMenu === 'quoc-gia')} relative`}>
                                    Quốc gia <FaChevronDown size={8} className={`transition-transform duration-200 ${openMenu === 'quoc-gia' ? 'rotate-180' : ''}`} />
                                    <span className={underlineClass(isQuocGiaActive)} />
                                </button>
                                <div ref={el => { menuPanelRefs.current['quoc-gia'] = el; }} className={`${menuPanelClass('quoc-gia')} w-64 max-w-[calc(100vw-2rem)] overflow-hidden py-2`} onMouseEnter={clearMenuTimers} onMouseLeave={scheduleCloseMenu}>
                                    {menuError ? (
                                        <div className="py-6 text-center">
                                            <p className="text-sm text-gray-400 mb-3">Không tải được danh sách quốc gia.</p>
                                            <button onClick={loadMenuData} className="px-4 py-2 rounded-lg bg-red-600/70 text-white text-xs font-bold hover:bg-red-600/80 transition">Bấm để thử lại</button>
                                        </div>
                                    ) : menuLoading ? (
                                        <div className="py-6 flex items-center justify-center gap-2 text-sm text-gray-500"><FaSpinner className="animate-spin text-red-500" /> Đang tải...</div>
                                    ) : (
                                        <>
                                            <div className="max-h-[420px] overflow-y-auto custom-scrollbar">
                                                {visibleCountries.map((item) => (<Link key={item._id} to={`/quoc-gia/${item.slug}`} className={dropdownItemClass(location.pathname === `/quoc-gia/${item.slug}`)}>{item.name}{item.slug === 'au-my' && (<span className="text-[10px] text-gray-500 ml-1">· Khu vực</span>)}</Link>))}
                                            </div>
                                            <div className="border-t border-white/10 mt-1 pt-1">
                                                <Link to="/danh-sach/phim-moi" className="block px-4 py-2.5 text-sm font-bold text-red-500 hover:text-red-400 hover:bg-white/10 transition text-center">Xem tất cả phim →</Link>
                                            </div>
                                        </>
                                    )}
                                </div>
                            </li>
                            <li>
                                <NavLink to="/watch-party" className={({ isActive }) => `ml-2 px-4 py-2 flex items-center gap-2 rounded-full border transition-all ${isActive ? 'border-red-500/60 bg-red-500/10 text-white' : 'border-white/15 bg-transparent text-gray-300 hover:text-white hover:border-white/30'}`}>
                                    <FaFilm className="text-xs" /> <span className="font-bold tracking-wide">Rạp Phim</span>
                                </NavLink>
                            </li>
                        </ul>
                    </div>

                    <div className="relative flex items-center gap-3 lg:gap-5" ref={searchRef}>
                        <div className="relative">
                        <div className={`relative flex items-center transition-all duration-300 ease-out ${showSearch ? 'w-[200px] sm:w-[300px] bg-[#1a1a1a] border-white/20' : 'w-10 bg-transparent border-transparent'} border rounded-full overflow-hidden h-10`}>
                            <button onClick={() => setShowSearch(!showSearch)} className={`absolute left-0 top-0 w-10 h-10 flex items-center justify-center text-gray-300 hover:text-white transition-colors z-10`} title="Tìm kiếm (Ctrl+K)" aria-label="Tìm kiếm"><FaSearch className="text-sm"/></button>
                            <form onSubmit={handleEnterSearch} className={`flex-1 pl-10 pr-20 h-full transition-opacity duration-200 ${showSearch ? 'opacity-100' : 'opacity-0'}`}><input ref={searchInputRef} type="text" placeholder="Tìm kiếm phim..." className="w-full h-full bg-transparent text-sm text-white placeholder-gray-500 outline-none" value={keyword} onChange={(e) => setKeyword(e.target.value)} onKeyDown={handleSearchKeyDown} /></form>
                            {showSearch && keyword.length === 0 && (<kbd className="absolute right-10 top-1/2 -translate-y-1/2 text-[10px] font-bold text-gray-500 bg-white/5 border border-white/10 rounded px-1.5 py-0.5 pointer-events-none">Ctrl K</kbd>)}
                            {showSearch && (<button onClick={() => { setShowSearch(false); setKeyword(''); setResults([]); }} className="absolute right-3 text-gray-500 hover:text-white transition">{isSearching ? <FaSpinner className="animate-spin text-red-500"/> : <FaTimes/>}</button>)}
                        </div>
                        {showSearch && (
                            <div className={`absolute left-0 top-full mt-3 w-full ${dropdownPanelBg} overflow-hidden animate-fade-in-up z-[110]`}>
                                {keyword.trim().length === 0 ? (
                                    <div className="p-4">
                                        <p className="text-[10px] font-bold text-gray-500 uppercase tracking-wider mb-2">Tìm kiếm phổ biến</p>
                                        <div className="flex flex-wrap gap-1.5">
                                            {POPULAR_SEARCHES.map(s => (<button key={s} onClick={() => setKeyword(s)} className="px-2.5 py-1 rounded-full bg-white/5 border border-white/10 text-xs font-bold text-gray-300 hover:text-white hover:border-red-500/60 transition">{s}</button>))}
                                        </div>
                                        {searchHistory.length > 0 && (<>
                                            <p className="text-[10px] font-bold text-gray-500 uppercase tracking-wider mt-4 mb-2">Tìm gần đây</p>
                                            <div className="flex flex-wrap gap-1.5">
                                                {searchHistory.map(s => (<button key={s} onClick={() => setKeyword(s)} className="px-2.5 py-1 rounded-full bg-white/5 border border-white/10 text-xs font-bold text-gray-300 hover:text-white hover:border-red-500/60 transition">{s}</button>))}
                                            </div>
                                        </>)}
                                        <p className="text-[10px] text-gray-600 mt-4">Phím tắt: Ctrl+K để tìm kiếm nhanh • ↑ ↓ để chọn, Enter để mở</p>
                                    </div>
                                ) : isSearching ? (
                                    <div className="p-4 flex items-center gap-2 text-sm text-gray-400"><FaSpinner className="animate-spin text-red-500" /> Đang tìm...</div>
                                ) : results.length > 0 ? (
                                    <div className="max-h-[60vh] overflow-y-auto custom-scrollbar">
                                        {results.slice(0, 5).map((movie, i) => (<Link key={movie._id} to={`/phim/${movie.slug}`} onClick={() => { saveSearchHistory(movie.name); setShowSearch(false); setKeyword(''); }} className={`flex items-center gap-3 p-3 hover:bg-white/5 transition border-b border-white/5 last:border-0 group ${activeResult === i ? 'bg-white/10' : ''}`}><img src={movie.thumb_url} alt="" className="w-10 h-14 object-cover rounded-md shadow-md group-hover:scale-105 transition-transform" /><div className="flex-1 min-w-0"><h4 className="text-sm font-bold text-white truncate group-hover:text-red-500 transition">{movie.name}</h4><p className="text-xs text-gray-500 truncate mt-0.5">{movie.origin_name} • {movie.year}</p></div></Link>))}
                                        <div onClick={handleEnterSearch} className={`p-3 text-center text-xs font-bold text-red-500 cursor-pointer hover:bg-white/5 transition uppercase tracking-wide ${activeResult === results.length ? 'bg-white/10' : ''}`}>Xem tất cả {searchTotal > 0 ? `${searchTotal} ` : ''}kết quả</div>
                                    </div>
                                ) : (
                                    <div className="p-4 text-center">
                                        <p className="text-sm text-gray-400">Không tìm thấy kết quả cho "{keyword}".</p>
                                        <button onClick={handleEnterSearch} className="mt-2 text-xs font-bold text-red-500 hover:text-red-400">Tìm "{keyword}" trên trang kết quả</button>
                                    </div>
                                )}
                            </div>
                        )}
                        </div>
                        {user ? (
                            <div className="relative cursor-pointer py-2" ref={userMenuRef} onMouseEnter={() => scheduleOpenMenu('user')} onMouseLeave={scheduleCloseMenu} onKeyDown={handleMenuKeyDown}>
                                <button onClick={openUserMenu} aria-expanded={openMenu === 'user'} aria-haspopup="true" className="flex items-center gap-2">
                                    <UserAvatar user={user} className="w-9 h-9 border border-white/10 hover:border-red-500 transition-colors" />
                                </button>
                                <div ref={el => { menuPanelRefs.current['user'] = el; }} className={`absolute top-full right-0 pt-2 w-64 z-50 transition-all duration-200 ${openMenu === 'user' ? 'opacity-100 visible translate-y-0' : 'opacity-0 invisible translate-y-2'}`} onMouseEnter={clearMenuTimers} onMouseLeave={scheduleCloseMenu}>
                                    <div className={`${dropdownPanelBg} overflow-hidden`}>
                                        <div className="p-3.5 flex gap-2.5 items-center border-b border-white/10">
                                            <UserAvatar user={user} className="w-9 h-9 border border-white/10 shrink-0" />
                                            <div className="min-w-0 flex-1">
                                                <p className="text-sm font-bold text-white truncate flex items-center gap-1.5 flex-wrap">{user.fullname || user.username}<span className="bg-red-600/80 text-white text-[9px] px-1.5 py-0.5 rounded-full font-bold shrink-0">{getRoleLabel(user.role)}</span></p>
                                                <p className="text-[11px] text-gray-400 truncate">{user.email}</p>
                                            </div>
                                        </div>
                                        <div className="p-1.5">
                                            {(user.role === 'admin' || user.role === 'super_admin') && (<Link to="/admin" className="flex items-center gap-2.5 px-3 py-2.5 text-sm text-yellow-500 hover:bg-white/10 hover:text-yellow-400 font-bold rounded-xl"><span className="w-7 h-7 rounded-full bg-yellow-500/10 flex items-center justify-center shrink-0"><FaChartBar size={15}/></span>Quản trị</Link>)}
                                            <Link to="/ho-so" className="flex items-center gap-2.5 px-3 py-2.5 text-sm text-gray-300 hover:bg-white/10 hover:text-white rounded-xl"><span className="w-7 h-7 rounded-full bg-white/5 flex items-center justify-center shrink-0"><FaUser size={15}/></span>Hồ sơ cá nhân</Link>
                                            <Link to="/tu-phim" className="flex items-center gap-2.5 px-3 py-2.5 text-sm text-gray-300 hover:bg-white/10 hover:text-white rounded-xl"><span className="w-7 h-7 rounded-full bg-red-500/10 text-red-500 flex items-center justify-center shrink-0"><FaHeart size={15}/></span>Tủ phim</Link>
                                            <Link to="/lich-su" className="flex items-center gap-2.5 px-3 py-2.5 text-sm text-gray-300 hover:bg-white/10 hover:text-white rounded-xl"><span className="w-7 h-7 rounded-full bg-blue-500/10 text-blue-400 flex items-center justify-center shrink-0"><FaHistory size={15}/></span>Lịch sử xem</Link>
                                        </div>
                                        <div className="border-t border-white/10 p-1.5"><button onClick={handleLogout} className="w-full flex items-center gap-2.5 px-3 py-2.5 text-sm text-red-500 hover:bg-red-500/10 font-bold rounded-xl"><span className="w-7 h-7 rounded-full bg-red-500/10 flex items-center justify-center shrink-0"><FaSignOutAlt size={15}/></span>Đăng xuất</button></div>
                                    </div>
                                </div>
                            </div>
                        ) : (<Link to="/login" className="hidden sm:inline-block bg-white/10 hover:bg-white/20 border border-white/10 text-white px-5 py-2 rounded-full text-xs font-bold transition-all hover:scale-105">Đăng nhập</Link>)}
                    </div>
                </div>
            </header>

            <div className={`fixed inset-0 bg-black/80 z-[150] transition-opacity duration-300 lg:hidden ${mobileMenuOpen ? 'opacity-100 visible' : 'opacity-0 invisible'}`} onClick={() => setMobileMenuOpen(false)} />
            <div className={`fixed top-0 left-0 w-[85%] max-w-[320px] h-full bg-[#0a0e17] z-[200] transform transition-transform duration-300 ease-out lg:hidden flex flex-col ${mobileMenuOpen ? 'translate-x-0' : '-translate-x-full'} shadow-2xl border-r border-white/5`}>
                <div className="p-6 border-b border-white/10 bg-gradient-to-r from-red-900/20 to-transparent">
                    <div className="flex justify-between items-center mb-6"><Logo /><button onClick={() => setMobileMenuOpen(false)} className="w-10 h-10 rounded-full bg-white/5 flex items-center justify-center text-gray-400 hover:text-white hover:bg-white/10 transition" aria-label="Đóng menu"><FaTimes size={16}/></button></div>
                    {user ? (<div className="flex items-center gap-3"><UserAvatar user={user} className="w-10 h-10 border border-white/20" /><div><p className="text-white font-bold text-sm truncate w-32">{user.fullname || user.username}</p><p className="text-[10px] text-gray-500 font-bold">{getRoleLabel(user.role)}</p></div></div>) : (<div className="grid grid-cols-2 gap-3"><Link to="/login" className="bg-red-600 text-white font-bold py-2 rounded-lg text-xs text-center">Đăng nhập</Link><Link to="/register" className="border border-white/20 text-white font-bold py-2 rounded-lg text-xs text-center">Đăng ký</Link></div>)}
                </div>
                <div className="flex-1 overflow-y-auto p-4 space-y-1 custom-scrollbar">
                    <form onSubmit={handleDrawerSearch} className="mb-3">
                        <div className="relative">
                            <FaSearch className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-500 text-xs" />
                            <input value={drawerSearch} onChange={(e) => setDrawerSearch(e.target.value)} placeholder="Tìm kiếm phim..." aria-label="Tìm kiếm phim" className="w-full bg-white/5 border border-white/10 rounded-lg pl-9 pr-3 py-2.5 text-sm text-white placeholder-gray-500 outline-none focus:border-red-500/60 transition" />
                        </div>
                    </form>
                    {user && (<div className="grid grid-cols-3 gap-2 mb-4 pb-4 border-b border-white/5"><Link to="/tu-phim" className="flex flex-col items-center gap-2 p-3 rounded-xl bg-white/5 hover:bg-white/10 transition"><FaHeart className="text-red-500 text-lg"/> <span className="text-[10px] font-bold text-gray-300">Yêu thích</span></Link><Link to="/lich-su" className="flex flex-col items-center gap-2 p-3 rounded-xl bg-white/5 hover:bg-white/10 transition"><FaHistory className="text-blue-400 text-lg"/> <span className="text-[10px] font-bold text-gray-300">Lịch sử</span></Link><Link to="/ho-so" className="flex flex-col items-center gap-2 p-3 rounded-xl bg-white/5 hover:bg-white/10 transition"><FaCog className="text-gray-400 text-lg"/> <span className="text-[10px] font-bold text-gray-300">Cài đặt</span></Link></div>)}
                    <Link to="/" className="flex items-center gap-3 py-3 px-4 rounded-lg bg-white/5 text-white font-bold border-l-4 border-red-600"><span className="w-5"><FaFilm/></span> Trang Chủ</Link>
                    <Link to="/watch-party" className="flex items-center gap-3 py-3 px-4 rounded-lg text-gray-300 hover:text-white hover:bg-white/5 transition font-medium"><span className="w-5"><FaFilm className="text-purple-500"/></span> Rạp Phim Online</Link>
                    <div className="py-2"><button onClick={() => toggleMobileSubmenu('danh-sach')} className="w-full flex justify-between items-center py-3 px-4 rounded-lg text-gray-300 hover:text-white hover:bg-white/5 transition font-medium"><div className="flex items-center gap-3"><span className="w-5"><FaList/></span> Danh Sách</div><FaChevronDown className={`text-xs transition-transform ${activeMobileSubmenu === 'danh-sach' ? 'rotate-180' : ''}`}/></button><div className={`overflow-hidden transition-all duration-300 ${activeMobileSubmenu === 'danh-sach' ? 'max-h-[500px]' : 'max-h-0'}`}><div className="bg-black/20 rounded-lg m-2 p-2 grid grid-cols-2 gap-2">{LIST_ITEMS.map(item => (<Link key={item.slug} to={`/danh-sach/${item.slug}`} className="text-xs text-gray-400 hover:text-white p-2 hover:bg-white/5 rounded block">{item.name}</Link>))}</div></div></div>
                    <div className="py-2"><button onClick={() => toggleMobileSubmenu('the-loai')} className="w-full flex justify-between items-center py-3 px-4 rounded-lg text-gray-300 hover:text-white hover:bg-white/5 transition font-medium"><div className="flex items-center gap-3"><span className="w-5"><FaLayerGroup/></span> Thể Loại</div><FaChevronDown className={`text-xs transition-transform ${activeMobileSubmenu === 'the-loai' ? 'rotate-180' : ''}`}/></button><div className={`overflow-hidden transition-all duration-300 ${activeMobileSubmenu === 'the-loai' ? 'max-h-[60vh] overflow-y-auto custom-scrollbar' : 'max-h-0'}`}><div className="bg-black/20 rounded-lg m-2 p-2 grid grid-cols-2 gap-2">{visibleGenres.map(item => (<Link key={item._id} to={`/the-loai/${item.slug}`} className="text-xs text-gray-400 hover:text-white p-2 hover:bg-white/5 rounded block truncate">{item.name}</Link>))}</div></div></div>
                    <div className="py-2"><button onClick={() => toggleMobileSubmenu('quoc-gia')} className="w-full flex justify-between items-center py-3 px-4 rounded-lg text-gray-300 hover:text-white hover:bg-white/5 transition font-medium"><div className="flex items-center gap-3"><span className="w-5"><FaGlobeAsia/></span> Quốc Gia</div><FaChevronDown className={`text-xs transition-transform ${activeMobileSubmenu === 'quoc-gia' ? 'rotate-180' : ''}`}/></button><div className={`overflow-hidden transition-all duration-300 ${activeMobileSubmenu === 'quoc-gia' ? 'max-h-[60vh] overflow-y-auto custom-scrollbar' : 'max-h-0'}`}><div className="bg-black/20 rounded-lg m-2 p-2 grid grid-cols-2 gap-2">{visibleCountries.map(item => (<Link key={item._id} to={`/quoc-gia/${item.slug}`} className="text-xs text-gray-400 hover:text-white p-2 hover:bg-white/5 rounded block truncate">{item.name}</Link>))}</div></div></div>
                    {!user && (
                        <div className="pt-4 mt-2 border-t border-white/10">
                            <p className="text-[10px] font-bold text-gray-500 uppercase tracking-wider mb-2 px-1">Phổ biến</p>
                            <div className="flex flex-wrap gap-1.5 px-1">
                                {POPULAR_COUNTRIES.map(chip => (<Link key={chip.slug} to={`/quoc-gia/${chip.slug}`} className="px-2.5 py-1 rounded-full bg-white/5 border border-white/10 text-xs font-bold text-gray-300 hover:text-white hover:border-red-500/60 transition">{chip.name}</Link>))}
                                {POPULAR_GENRES.slice(0, 3).map(chip => (<Link key={chip.slug} to={`/the-loai/${chip.slug}`} className="px-2.5 py-1 rounded-full bg-white/5 border border-white/10 text-xs font-bold text-gray-300 hover:text-white hover:border-red-500/60 transition">{chip.name}</Link>))}
                            </div>
                            <Link to="/danh-sach/phim-moi" className="mt-3 flex items-center gap-3 py-3 px-4 rounded-lg text-gray-300 hover:text-white hover:bg-white/5 transition font-medium"><span className="w-5"><FaFilm className="text-red-500"/></span> Phim Mới</Link>
                        </div>
                    )}
                </div>
                {user && (<div className="p-4 border-t border-white/5 bg-black/20"><button onClick={handleLogout} className="w-full flex items-center justify-center gap-2 bg-red-900/10 text-red-500 border border-red-900/30 py-3 rounded-xl font-bold hover:bg-red-900/30 transition text-sm"><FaSignOutAlt /> Đăng Xuất</button></div>)}
            </div>
        </>
    );
};

export default Header;
