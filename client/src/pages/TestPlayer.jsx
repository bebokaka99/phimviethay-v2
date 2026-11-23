import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import {
  FaPlay, FaList, FaHome, FaAngleRight, FaSearch, FaStar, FaClock, FaGlobe,
  FaSortAmountDown, FaSortAmountUp, FaChevronDown, FaChevronUp, FaArrowRight,
} from "react-icons/fa";
import MovieCard from "../components/movies/MovieCard";
import { SECTION_THEMES } from "../components/movies/MovieRow";
import { getMovieDetail, getMoviesBySlug, IMG_URL } from "../services/movieService";

// ============================================================================
// TRANG TEST RIÊNG — /test-player (CHỈ PHỤC VỤ TEST, không link từ menu/header)
// Mục đích: thử JWPlayer 8.9.3 (key lấy từ endpoint public /api/player-key,
// phương án (a) chốt 23/11/2026) có chơi được phim vsmov thật không, và có xóa
// được logo vsmov trên thanh trình chiếu không bằng cách tự làm player
// KHÔNG set logo.
//
// - File /public/jwplayer/jwplayer-8.9.3.js CHỈ PHỤC VỤ TRANG TEST này.
// - vsmov API chỉ trả link_embed, KHÔNG trả link_m3u8. Luồng chính gọi
//   GET /api/extract-m3u8?embed=<link_embed>.
// - Key: GET /api/player-key (public, không cần token). Chỉ fallback key
//   hardcode chia sẻ khi endpoint public lỗi / không trả key.
// - Giao diện chuẩn hóa theo WatchMovie.jsx: pt-24 dưới header fixed,
//   layout 2 cột (player 16:9 + sidebar chọn tập / phim tương tự), panel
//   "Thông tin test" thu gọn mặc định ở cuối trang.
// - KHÔNG dùng hls.js / ArtPlayer ở trang này. KHÔNG đụng player chính.
// ============================================================================

const API_BASE = import.meta.env.VITE_API_URL || "http://localhost:5000/api";

// KEY TEST CHIA SẺ từ repo vsphim — CHỈ fallback khi endpoint public lỗi.
// Production nên mua license riêng hoặc dùng hls.js.
const FALLBACK_TEST_KEY = "ITWMv7t88JGzI0xPwW8I0+LveiXX9SWbfdmt0ArUSyc=";

// Phim bộ mặc định để test đổi tập: "Học Tài Thi Hộ" (series, đang chiếu).
const DEFAULT_SLUG = "hoc-tai-thi-ho";

const EP_PAGE = 100; // Số tập render mỗi cửa sổ (như WatchMovie).
const epNumber = (ep) => {
  const m = String(ep?.name ?? "").match(/\d+/);
  return m ? parseInt(m[0], 10) : null;
};

const shortUrl = (u, n = 90) => (u && u.length > n ? u.slice(0, n) + "…" : u || "—");

export default function TestPlayer() {
  const navigate = useNavigate();
  const [slug, setSlug] = useState(DEFAULT_SLUG);
  const [movie, setMovie] = useState(null);
  const [episodes, setEpisodes] = useState([]); // [{ server_name, server_data: [...] }]
  const [currentEpisode, setCurrentEpisode] = useState(null);
  const [currentServer, setCurrentServer] = useState(0);
  const [loadingEps, setLoadingEps] = useState(false);
  const [epError, setEpError] = useState("");

  // --- Chọn tập: sắp xếp / tìm tập / render theo cửa sổ (pattern WatchMovie) ---
  const [epSort, setEpSort] = useState(() => {
    try { return localStorage.getItem("ep_sort_order") === "desc" ? "desc" : "asc"; } catch (e) { return "asc"; }
  });
  const [epWinStart, setEpWinStart] = useState(0);
  const [epWinCount, setEpWinCount] = useState(EP_PAGE);
  const [epQuery, setEpQuery] = useState("");
  const [epSearchMsg, setEpSearchMsg] = useState("");
  const epBtnRefs = useRef({});
  const [jumpSlug, setJumpSlug] = useState(null);

  const [relatedMovies, setRelatedMovies] = useState([]);
  const [relatedLoaded, setRelatedLoaded] = useState(false);

  const [scriptState, setScriptState] = useState("chưa tải"); // chưa tải | đang tải | đã tải | lỗi
  const [keySource, setKeySource] = useState("—");
  const [m3u8, setM3u8] = useState("");
  const [m3u8Source, setM3u8Source] = useState(""); // api | manual | —
  const [m3u8Error, setM3u8Error] = useState("");
  const [playerStatus, setPlayerStatus] = useState("chưa khởi tạo");
  const [jwError, setJwError] = useState("");
  const [logoVerdict, setLogoVerdict] = useState("CHƯA ĐÁNH GIÁ");
  const [log, setLog] = useState([]);
  const [showTestInfo, setShowTestInfo] = useState(false); // Panel test mặc định THU GỌN

  const playerRef = useRef(null);
  const scriptLoadedRef = useRef(false);
  const stateRef = useRef({ ready: false, state: null, errors: [] });
  const keyRef = useRef(null);
  const autoPlayedRef = useRef(false);

  const pushLog = useCallback((msg) => {
    setLog((prev) => [`${new Date().toLocaleTimeString("vi-VN")} — ${msg}`, ...prev].slice(0, 30));
  }, []);

  // Load JWPlayer 8.9.3 từ /public — inject động, chỉ 1 lần.
  useEffect(() => {
    if (scriptLoadedRef.current || window.jwplayer) {
      setScriptState("đã tải");
      return;
    }
    setScriptState("đang tải");
    const s = document.createElement("script");
    s.src = "/jwplayer/jwplayer-8.9.3.js";
    s.async = true;
    s.onload = () => {
      scriptLoadedRef.current = true;
      setScriptState("đã tải");
      pushLog("Đã tải jwplayer-8.9.3.js (bản test-only trong /public/jwplayer/)");
    };
    s.onerror = () => {
      setScriptState("lỗi");
      pushLog("LỖI tải /jwplayer/jwplayer-8.9.3.js");
    };
    document.body.appendChild(s);
  }, [pushLog]);

  // Lấy key từ endpoint PUBLIC GET /api/player-key (phương án (a)).
  // Không cần token, không gọi /api/admin/settings nữa.
  // Chỉ fallback key hardcode chia sẻ khi endpoint lỗi / 5xx / không trả key.
  const getLicenseKey = useCallback(async () => {
    if (keyRef.current) return keyRef.current;
    try {
      const res = await fetch(`${API_BASE}/player-key`);
      if (res.ok) {
        const data = await res.json();
        const key = data?.key || "";
        if (key) {
          keyRef.current = key;
          setKeySource("public endpoint (/api/player-key)");
          pushLog("Lấy key từ public endpoint /api/player-key");
          return key;
        }
        pushLog("GET /api/player-key trả 200 nhưng không có key (dùng key fallback hardcode)");
      } else {
        pushLog(`GET /api/player-key -> ${res.status} (dùng key fallback hardcode)`);
      }
    } catch (e) {
      pushLog(`GET /api/player-key lỗi: ${e.message} (dùng key fallback hardcode)`);
    }
    keyRef.current = FALLBACK_TEST_KEY;
    setKeySource("fallback hardcode");
    return FALLBACK_TEST_KEY;
  }, [pushLog]);

  // Tải chi tiết + danh sách tập của phim (giữ nguyên shape server như WatchMovie).
  const loadEpisodes = useCallback(async () => {
    const s = slug.trim();
    if (!s) return;
    setLoadingEps(true);
    setEpError("");
    setMovie(null);
    setEpisodes([]);
    setCurrentEpisode(null);
    setCurrentServer(0);
    setRelatedMovies([]);
    setRelatedLoaded(false);
    setM3u8("");
    setM3u8Source("");
    setM3u8Error("");
    setPlayerStatus("chưa khởi tạo");
    setJwError("");
    setEpWinStart(0);
    setEpWinCount(EP_PAGE);
    setEpSearchMsg("");
    autoPlayedRef.current = false;
    try {
      const data = await getMovieDetail(s);
      if (!data?.status || !data.movie) {
        setEpError(data?.msg || "Không tìm thấy phim");
        pushLog(`Tải tập thất bại: slug "${s}" — ${data?.msg || "không tìm thấy"}`);
        return;
      }
      setMovie(data.movie);
      const eps = (data.episodes || []).map((sv) => ({
        server_name: typeof sv.server_name === "string" ? sv.server_name.replace(/\s+/g, " ").trim() : (sv.server_name || "Vietsub"),
        server_data: (sv.server_data || []).filter((ep) => ep.link_embed),
      })).filter((sv) => sv.server_data.length > 0);
      setEpisodes(eps);
      const first = eps[0]?.server_data?.[0] || null;
      setCurrentEpisode(first);
      const total = eps.reduce((n, sv) => n + sv.server_data.length, 0);
      pushLog(`Tải tập OK: "${data.movie.name}" — ${total} tập có link_embed (${eps.length} server)`);
    } catch (e) {
      setEpError(e.message);
      pushLog(`Tải tập lỗi: ${e.message}`);
    } finally {
      setLoadingEps(false);
    }
  }, [slug, pushLog]);

  // Tải mặc định slug "hoc-tai-thi-ho" khi mở trang.
  useEffect(() => {
    loadEpisodes();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Phim tương tự: cùng thể loại đầu của phim đang xem (logic WatchMovie,
  // tối giản: fetch ngay khi có movie, lấy 6 phim).
  useEffect(() => {
    if (!movie || relatedLoaded) return;
    if (!movie.category?.[0]) return;
    setRelatedLoaded(true);
    const catSlug = movie.category[0].slug;
    const randomPage = Math.floor(Math.random() * 5) + 1;
    getMoviesBySlug(catSlug, randomPage, "the-loai").then((relatedData) => {
      if (relatedData?.data?.items) {
        setRelatedMovies(relatedData.data.items.filter((m) => m.slug !== movie.slug).sort(() => Math.random() - 0.5));
      }
    }).catch(() => {});
  }, [movie, relatedLoaded]);

  // Lấy m3u8 & phát tập đã chọn.
  const playEpisode = useCallback(async (ep) => {
    if (!ep) return;
    setM3u8("");
    setM3u8Source("");
    setM3u8Error("");
    setPlayerStatus("đang lấy m3u8…");
    setJwError("");

    let url = "";
    let source = "";
    try {
      const res = await fetch(
        `${API_BASE}/extract-m3u8?embed=${encodeURIComponent(ep.link_embed)}`
      );
      if (res.ok) {
        const data = await res.json();
        if (data?.m3u8) {
          url = data.m3u8;
          source = "api (/api/extract-m3u8)";
        }
      } else {
        pushLog(`GET /api/extract-m3u8 -> ${res.status} (fallback tay)`);
      }
    } catch (e) {
      pushLog(`GET /api/extract-m3u8 lỗi: ${e.message} (fallback tay)`);
    }

    // Fallback TẠM: suy ra m3u8 từ link_embed theo pattern trang embed vsmov
    // {origin}/stream/{hash}/master.m3u8 — đã kiểm chứng bằng curl (200).
    if (!url) {
      try {
        const u = new URL(ep.link_embed);
        const hash = u.pathname.split("/").filter(Boolean).pop();
        if (hash) {
          url = `${u.origin}/stream/${hash}/master.m3u8`;
          source = "manual — suy từ link_embed (endpoint chưa sẵn)";
          pushLog(`Fallback tay: m3u8 = ${url}`);
        }
      } catch (e) {
        setM3u8Error(`Không suy được m3u8 từ link_embed: ${e.message}`);
        setPlayerStatus("lỗi");
        return;
      }
    }

    if (!url) {
      setM3u8Error("Không lấy được m3u8 (endpoint trả lỗi và không suy ra được URL).");
      setPlayerStatus("lỗi");
      return;
    }

    setM3u8(url);
    setM3u8Source(source);

    if (!window.jwplayer) {
      setPlayerStatus("lỗi");
      setJwError("window.jwplayer chưa sẵn (script chưa tải xong).");
      return;
    }

    const key = await getLicenseKey();
    try {
      window.jwplayer.key = key;
    } catch (e) {
      pushLog(`Set jwplayer.key lỗi: ${e.message}`);
    }

    // Đổi tập khi player đã sẵn: dùng load() thay vì setup() lại.
    if (playerRef.current && stateRef.current.ready) {
      try {
        stateRef.current.m3u8 = url;
        playerRef.current.load({ file: url });
        playerRef.current.play();
        setPlayerStatus("đang phát");
        pushLog(`Đổi tập qua load(): ${ep.name} — ${shortUrl(url, 80)}`);
        return;
      } catch (e) {
        pushLog(`load() lỗi, setup() lại: ${e.message}`);
      }
    }

    // Khởi tạo lần đầu — KHÔNG set logo, KHÔNG set advertising (đây là điểm test).
    setPlayerStatus("đang khởi tạo player…");
    stateRef.current = { ready: false, state: null, errors: [], m3u8: url };
    window.__jwTest = stateRef.current;
    try {
      const player = window.jwplayer("test-player");
      playerRef.current = player;
      player.setup({
        file: url,
        width: "100%",
        aspectratio: "16:9",
        autostart: false,
        // Logo PhimVietHay tren thanh control-bar — y cong thuc vsmov
        // (theme-vsphim episode.blade.php: logo { file, link, position }).
        // Chi khac: file = logo cua web minh, link = trang chu,
        // position = "control-bar" (logo nam duoi thanh trinh chieu,
        // nhan vao ve trang chu). Khong dung logo vsmov.
        logo: {
          file: window.location.origin + "/logo.png",
          link: window.location.origin + "/",
          position: "control-bar",
        },
      });
      player.on("ready", () => {
        stateRef.current.ready = true;
        stateRef.current.state = player.getState?.() || "ready";
        setPlayerStatus("ready");
        pushLog(`JWPlayer ready — state: ${stateRef.current.state}`);
      });
      player.on("play", () => {
        stateRef.current.state = "playing";
        setPlayerStatus("đang phát");
      });
      player.on("pause", () => {
        stateRef.current.state = "paused";
        setPlayerStatus("tạm dừng");
      });
      player.on("error", (e) => {
        const msg = `JWPlayer error ${e?.code ?? "?"}: ${e?.message ?? ""}`;
        stateRef.current.errors.push(msg);
        setJwError(msg);
        setPlayerStatus("lỗi");
        pushLog(msg);
      });
      player.on("setupError", (e) => {
        const msg = `Setup error ${e?.code ?? "?"}: ${e?.message ?? ""}`;
        stateRef.current.errors.push(msg);
        setJwError(msg);
        setPlayerStatus("lỗi");
        pushLog(msg);
      });
      player.on("warning", (e) => {
        pushLog(`JWPlayer warning ${e?.code ?? ""}: ${e?.message ?? ""}`);
      });
    } catch (e) {
      setPlayerStatus("lỗi");
      setJwError(`setup() throw: ${e.message}`);
      pushLog(`setup() throw: ${e.message}`);
    }
  }, [getLicenseKey, pushLog]);

  // Tự phát tập đầu khi đã có tập + script JWPlayer đã tải (như WatchMovie
  // hiện iframe ngay khi mở trang).
  useEffect(() => {
    if (!currentEpisode || scriptState !== "đã tải" || autoPlayedRef.current) return;
    autoPlayedRef.current = true;
    playEpisode(currentEpisode);
  }, [currentEpisode, scriptState, playEpisode]);

  const handleChangeEpisode = (ep) => {
    setCurrentEpisode(ep);
    playEpisode(ep);
  };

  // --- Sắp xếp / tìm tập (pattern WatchMovie) ---
  const displayEpisodes = episodes[currentServer] ? episodes[currentServer] : episodes[0];
  const sortedEpisodes = useMemo(() => {
    const list = [...(displayEpisodes?.server_data || [])];
    list.sort((a, b) => {
      const na = epNumber(a), nb = epNumber(b);
      if (na !== null && nb !== null) return epSort === "asc" ? na - nb : nb - na;
      const cmp = String(a.name).localeCompare(String(b.name));
      return epSort === "asc" ? cmp : -cmp;
    });
    return list;
  }, [displayEpisodes, epSort]);
  const visibleEpisodes = sortedEpisodes.slice(epWinStart, epWinStart + epWinCount);

  useEffect(() => { try { localStorage.setItem("ep_sort_order", epSort); } catch (e) {} }, [epSort]);
  useEffect(() => { setEpWinStart(0); setEpWinCount(EP_PAGE); setEpSearchMsg(""); }, [currentServer, slug]);

  // Đảm bảo tập đang xem luôn nằm trong cửa sổ đã render + cuộn tới nó.
  useEffect(() => {
    if (!currentEpisode || sortedEpisodes.length === 0) return;
    const idx = sortedEpisodes.findIndex((e) => e.slug === currentEpisode.slug);
    if (idx === -1) return;
    if (idx < epWinStart || idx >= epWinStart + epWinCount) {
      setEpWinStart(Math.max(0, Math.floor(idx / EP_PAGE) * EP_PAGE));
      setEpWinCount(EP_PAGE);
    }
    setJumpSlug(currentEpisode.slug);
  }, [currentEpisode, sortedEpisodes]);

  useEffect(() => {
    if (!jumpSlug) return;
    const el = epBtnRefs.current[jumpSlug];
    if (el) {
      el.scrollIntoView({ behavior: "smooth", block: "nearest" });
      setJumpSlug(null);
    }
  }, [jumpSlug, epWinStart, epWinCount, sortedEpisodes]);

  const handleSearchEpisode = () => {
    const q = epQuery.trim();
    if (!q) { setEpSearchMsg(""); return; }
    const list = displayEpisodes?.server_data || [];
    const num = parseInt(q.replace(/\D/g, ""), 10);
    let found = null;
    if (!Number.isNaN(num)) found = list.find((e) => epNumber(e) === num);
    if (!found) found = list.find((e) => String(e.name).trim().toLowerCase() === q.toLowerCase());
    if (!found) { setEpSearchMsg(`Không tìm thấy tập "${q}"`); return; }
    setEpSearchMsg("");
    const idx = sortedEpisodes.findIndex((e) => e.slug === found.slug);
    if (idx < epWinStart || idx >= epWinStart + epWinCount) {
      setEpWinStart(Math.max(0, Math.floor(idx / EP_PAGE) * EP_PAGE));
      setEpWinCount(EP_PAGE);
    }
    setJumpSlug(found.slug);
    handleChangeEpisode(found);
  };

  // Đổi server giữ nguyên tập (theo tên tập).
  const handleChangeServer = (i) => {
    setCurrentServer(i);
    if (!movie || !currentEpisode) return;
    const newServerData = episodes[i]?.server_data || [];
    const found = newServerData.find((e) => e.name === currentEpisode.name) || newServerData[0];
    if (found && found.slug !== currentEpisode.slug) {
      setCurrentEpisode(found);
      playEpisode(found);
    }
  };

  const statusColor =
    playerStatus === "ready" || playerStatus === "đang phát"
      ? "#22c55e"
      : playerStatus === "lỗi"
        ? "#ef4444"
        : "#f59e0b";
  const ratingVal = Number(movie?.tmdb?.vote_average || movie?.vote_average || 0);
  const voteCount = movie?.tmdb?.vote_count || 0;
  const bgImage = movie ? `${IMG_URL}${movie.poster_url || movie.thumb_url}` : "";
  const catSlug = movie?.category?.[0]?.slug;
  const theme = SECTION_THEMES[catSlug] || SECTION_THEMES["default"];
  const bannerBg = relatedMovies[0]?.thumb_url || movie?.poster_url || movie?.thumb_url;

  return (
    <div className="min-h-screen font-sans transition-colors duration-700 text-white overflow-x-hidden selection:bg-[var(--accent)] selection:text-white">
      {/* Nền mờ poster phim (như WatchMovie) */}
      {movie && (
        <div className="fixed inset-0 z-0 pointer-events-none">
          <div className="absolute inset-0 bg-cover bg-center opacity-20 blur-[120px] scale-110 transition-all duration-1000" style={{ backgroundImage: `url(${bgImage})` }} />
          <div className="absolute inset-0 bg-gradient-to-b from-black/60 via-black/80 to-black z-10" />
        </div>
      )}

      {/* Khung chuẩn WatchMovie: pt-24 để không chồng lên header fixed h-16 */}
      <div className="relative z-50 pt-24 pb-12 container mx-auto px-0 md:px-4">
        {/* Breadcrumb */}
        <div className="flex items-center gap-2 text-xs md:text-sm text-gray-400 mb-4 px-4 md:px-0">
          <Link to="/" className="hover:text-[var(--accent)] transition-colors flex items-center gap-1"><FaHome /> Trang chủ</Link>
          <FaAngleRight className="text-gray-600 text-[10px]" />
          <span className="text-white font-medium line-clamp-1 text-[var(--accent)]">
            Test Player — JWPlayer 8.9.3{movie ? ` — ${movie.name}` : ""}
          </span>
        </div>

        {/* Nhập slug + tải tập */}
        <div className="flex gap-2 flex-wrap mb-4 px-4 md:px-0">
          <input
            value={slug}
            onChange={(e) => setSlug(e.target.value)}
            onKeyDown={(e) => e.key === "Enter" && loadEpisodes()}
            placeholder="slug phim, vd: hoc-tai-thi-ho"
            className="flex-1 min-w-[220px] bg-black/40 border border-white/10 rounded-lg px-3 py-2.5 text-sm text-white placeholder-gray-500 outline-none focus:border-[var(--accent)]"
          />
          <button
            onClick={loadEpisodes}
            disabled={loadingEps}
            className="px-5 py-2.5 rounded-lg bg-[var(--accent)] hover:bg-[var(--accent-hover)] text-white text-sm font-bold transition disabled:opacity-50"
          >
            {loadingEps ? "Đang tải…" : "Tải tập"}
          </button>
        </div>
        {epError && <p className="text-red-400 text-sm mb-4 px-4 md:px-0">Lỗi tải tập: {epError}</p>}

        <div className="flex flex-col lg:flex-row gap-6">
          {/* ===== CỘT CHÍNH: player + thông tin phim ===== */}
          <div className="w-full lg:w-[75%] transition-all duration-500">
            {/* Player JWPlayer 16:9 — đúng vị trí/kích thước iframe WatchMovie */}
            <div className="relative w-full aspect-video bg-black md:rounded-xl overflow-hidden shadow-[0_0_50px_rgba(220,38,38,0.15)] ring-1 ring-white/10 md:ring-red-500/20 z-20">
              <div id="test-player" className="w-full h-full" />
            </div>

            {/* Thanh dưới player: tập đang xem */}
            <div className="mt-0 md:mt-4 bg-gradient-to-r from-black/80 to-black/60 border-b md:border border-white/10 border-t-white/5 p-3 md:rounded-lg backdrop-blur-xl flex flex-wrap items-center justify-between gap-3 shadow-lg">
              <div className="flex items-center gap-2 text-[var(--accent)] font-bold drop-shadow-[0_0_10px_rgba(220,38,38,0.5)]">
                <FaPlay className="text-sm" />
                <span className="text-sm uppercase tracking-wide">
                  Tập: <span className="text-white ml-1">{currentEpisode?.name || "—"}</span>
                </span>
              </div>
              <span className="text-xs text-gray-400">
                JWPlayer 8.9.3 · key: {keySource === "—" ? "đang lấy…" : keySource}
              </span>
            </div>

            {/* Thông tin phim (như WatchMovie) */}
            {movie && (
              <div className="mt-8 px-4 md:px-0">
                <div className="bg-black/40 p-6 md:p-8 rounded-2xl border border-white/10 backdrop-blur-xl shadow-2xl relative overflow-hidden">
                  <div className="absolute top-0 right-0 -mt-20 -mr-20 w-64 h-64 bg-red-600/10 rounded-full blur-[80px] pointer-events-none"></div>
                  <h1 className="text-3xl md:text-4xl font-extrabold text-transparent bg-clip-text bg-gradient-to-r from-white to-gray-300 mb-4">{movie.name}</h1>
                  <div className="flex flex-wrap items-center gap-3 text-sm mb-5">
                    <span className="bg-gradient-to-r from-[var(--accent)] to-[var(--accent-hover)] text-white px-3 py-1 rounded-md font-bold text-xs shadow-lg shadow-red-900/20 uppercase tracking-wider">{movie.quality || "HD"}</span>
                    <span className="flex items-center gap-1 bg-yellow-500/20 text-yellow-500 px-3 py-1 rounded-md font-bold border border-yellow-500/20"><FaStar /> {ratingVal > 0 ? ratingVal.toFixed(1) : "N/A"} <span className="text-yellow-300/70 font-normal text-xs ml-1">({voteCount})</span></span>
                    <span className="flex items-center gap-1 text-gray-300 bg-white/5 px-3 py-1 rounded-md border border-white/10"><FaClock className="text-[var(--accent)]" /> {movie.time}</span>
                    <span className="text-gray-300 bg-white/5 px-3 py-1 rounded-md border border-white/10">{movie.year}</span>
                    <span className="flex items-center gap-1 text-gray-300 bg-white/5 px-3 py-1 rounded-md border border-white/10"><FaGlobe className="text-[var(--accent)]" /> {movie.country?.[0]?.name}</span>
                  </div>
                  <h2 className="text-base text-gray-400 italic mb-5 border-b border-white/5 pb-4 font-medium">{movie.origin_name}</h2>
                  <p className="text-gray-200 text-sm leading-relaxed line-clamp-4 md:line-clamp-none">{movie.content?.replace(/<[^>]*>?/gm, "")}</p>
                  <p className="mt-4 text-xs text-gray-500">
                    Thể loại: {(movie.category || []).map((c) => c.name).join(", ") || "—"}
                  </p>
                </div>
              </div>
            )}
          </div>

          {/* ===== SIDEBAR: chọn tập + phim tương tự ===== */}
          <div className="w-full lg:w-[28%] flex flex-col gap-6 px-4 md:px-0">
            {/* Panel chọn tập — như WatchMovie */}
            <div className="bg-black/40 backdrop-blur-xl rounded-2xl border border-white/10 overflow-hidden flex flex-col max-h-[500px] shadow-2xl">
              <div className="p-4 bg-white/5 border-b border-white/10 flex flex-col gap-3">
                <div className="flex justify-between items-center">
                  <h3 className="font-bold text-white flex items-center gap-2 text-sm uppercase tracking-wider"><FaList className="text-[var(--accent)]" /> Chọn Tập</h3>
                  <span className="text-xs text-gray-400 bg-white/10 px-2 py-0.5 rounded-full">{displayEpisodes?.server_data?.length || 0} tập</span>
                </div>
                <div className="flex gap-2">
                  <button
                    onClick={() => setEpSort(epSort === "asc" ? "desc" : "asc")}
                    title={epSort === "asc" ? "Đang xếp tăng dần 1 → N, bấm để đảo thành N → 1" : "Đang xếp giảm dần N → 1, bấm để đảo thành 1 → N"}
                    className="flex items-center gap-1 px-2.5 py-2 text-[11px] font-bold rounded-lg bg-white/5 border border-white/10 text-gray-200 hover:bg-white/10 hover:text-white transition whitespace-nowrap"
                  >
                    {epSort === "asc" ? <><FaSortAmountUp className="text-[var(--accent)]" /> 1 → N</> : <><FaSortAmountDown className="text-[var(--accent)]" /> N → 1</>}
                  </button>
                  <div className="flex flex-1 gap-1">
                    <input
                      type="text"
                      inputMode="numeric"
                      value={epQuery}
                      onChange={(e) => { setEpQuery(e.target.value); setEpSearchMsg(""); }}
                      onKeyDown={(e) => { if (e.key === "Enter") handleSearchEpisode(); }}
                      placeholder="Tìm tập... (VD: 2)"
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
                      <button key={i} onClick={() => handleChangeServer(i)} className={`px-3 py-1.5 text-[10px] font-bold rounded-md transition-all duration-300 flex-1 ${currentServer === i ? "bg-gradient-to-r from-[var(--accent)] to-[var(--accent-hover)] text-white shadow-md" : "text-gray-400 hover:bg-white/10 hover:text-white"}`}>{s.server_name}</button>
                    ))}
                  </div>
                )}
              </div>
              <div className="flex-1 overflow-y-auto custom-scrollbar p-3 bg-black/20">
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
                    return (
                      <button
                        key={`${ep.slug}-${idx}`}
                        ref={(el) => { if (el) epBtnRefs.current[ep.slug] = el; else delete epBtnRefs.current[ep.slug]; }}
                        onClick={() => handleChangeEpisode(ep)}
                        className={`relative h-10 rounded-lg text-xs font-bold transition-all duration-300 border overflow-hidden group ${isActive ? "bg-gradient-to-r from-[var(--accent)] to-[var(--accent-hover)] text-white border-[var(--accent)] shadow-[0_0_15px_rgba(220,38,38,0.4)] scale-105 z-10" : "bg-white/5 text-gray-300 border-white/10 hover:bg-white/10 hover:text-white hover:border-white/30"}`}
                      >
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
                {sortedEpisodes.length === 0 && !loadingEps && (
                  <p className="text-xs text-gray-500 text-center py-4">Chưa có tập nào.</p>
                )}
              </div>
            </div>

            {/* Phim tương tự — banner + lưới 2 cột, đúng MovieCard (như WatchMovie) */}
            <div className="bg-black/40 backdrop-blur-xl rounded-2xl border border-white/10 overflow-hidden shadow-2xl">
              <div
                onClick={() => { if (catSlug) navigate(`/the-loai/${catSlug}`); }}
                role="button"
                aria-label="Xem tất cả phim tương tự"
                className={`relative h-[150px] overflow-hidden cursor-pointer group/banner bg-[#0a0e17] ${catSlug ? "" : "cursor-default"}`}
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
          </div>
        </div>

        {/* ===== Panel "Thông tin test" — thu gọn mặc định, ở cuối trang ===== */}
        <div className="mt-8 px-4 md:px-0">
          <div className="bg-black/40 backdrop-blur-xl rounded-2xl border border-white/10 overflow-hidden">
            <button
              onClick={() => setShowTestInfo(!showTestInfo)}
              className="w-full flex items-center justify-between px-5 py-4 text-left hover:bg-white/5 transition"
            >
              <span className="font-bold text-sm uppercase tracking-wider flex items-center gap-2">
                <span className="w-2 h-2 rounded-full" style={{ background: statusColor }} />
                Thông tin test
                <span className="text-gray-400 font-normal normal-case tracking-normal">— trạng thái m3u8 / key / player / logo</span>
              </span>
              {showTestInfo ? <FaChevronUp className="text-gray-400" /> : <FaChevronDown className="text-gray-400" />}
            </button>
            {showTestInfo && (
              <div className="px-5 pb-5">
                <p className="text-xs text-gray-500 mb-4">
                  Trang test riêng (không link từ menu). Watermark VSbet nướng trong khung hình thì <b>không</b> xóa được — không phải mục tiêu test này.
                </p>
                <table className="w-full text-sm" style={{ borderCollapse: "collapse" }}>
                  <tbody>
                    <tr><td className="py-1.5 pr-2 text-gray-400 w-56">Script JWPlayer</td><td>{scriptState}</td></tr>
                    <tr><td className="py-1.5 pr-2 text-gray-400">Key nguồn</td><td>{keySource}</td></tr>
                    <tr><td className="py-1.5 pr-2 text-gray-400">m3u8</td><td>{m3u8 ? `ĐÃ LẤY (${m3u8Source})` : "chưa lấy"}</td></tr>
                    {m3u8 && (
                      <tr><td className="py-1.5 pr-2 text-gray-400">m3u8 URL</td><td className="break-all">{shortUrl(m3u8, 110)}</td></tr>
                    )}
                    {m3u8Error && (
                      <tr><td className="py-1.5 pr-2 text-gray-400">Lỗi m3u8</td><td className="text-red-400">{m3u8Error}</td></tr>
                    )}
                    <tr><td className="py-1.5 pr-2 text-gray-400">Player</td><td style={{ color: statusColor, fontWeight: 700 }}>{playerStatus}</td></tr>
                    {jwError && (
                      <tr><td className="py-1.5 pr-2 text-gray-400">Lỗi JWPlayer</td><td className="text-red-400">{jwError}</td></tr>
                    )}
                    <tr>
                      <td className="py-1.5 pr-2 text-gray-400">Logo vsmov trên thanh trình chiếu</td>
                      <td>
                        <b style={{ color: logoVerdict === "KHÔNG" ? "#22c55e" : logoVerdict === "CÓ" ? "#ef4444" : "#f59e0b" }}>
                          {logoVerdict}
                        </b>{" "}
                        <span className="text-[13px] text-gray-400">(đánh giá bằng mắt từ ảnh chụp)</span>{" "}
                        <button onClick={() => setLogoVerdict("CÓ")} className="ml-2 px-2.5 py-1 rounded-md border border-white/10 bg-white/5 text-white text-xs cursor-pointer">Có logo</button>
                        <button onClick={() => setLogoVerdict("KHÔNG")} className="ml-1.5 px-2.5 py-1 rounded-md border border-white/10 bg-white/5 text-white text-xs cursor-pointer">Không có logo</button>
                      </td>
                    </tr>
                  </tbody>
                </table>
                <h3 className="text-sm font-bold mt-4 mb-2">Log</h3>
                <pre className="bg-[#0b1220] border border-white/10 rounded-lg p-3 text-xs whitespace-pre-wrap break-words max-h-[220px] overflow-auto">
                  {log.length ? log.join("\n") : "(chưa có log)"}
                </pre>
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
