import React, { Suspense, lazy } from "react";
import { createBrowserRouter, Navigate } from "react-router-dom";
import { FaSpinner } from "react-icons/fa";

// Layouts (Load thường vì là khung sườn)
import MainLayout from "./components/layout/MainLayout";
import AdminLayout from "./components/admin/AdminLayout";

// --- LAZY LOADING PAGES (Tách bundle để load nhanh hơn) ---
const Home = lazy(() => import("./pages/Home"));
const MovieDetail = lazy(() => import("./pages/MovieDetail"));
const WatchMovie = lazy(() => import("./pages/WatchMovie"));
const SearchPage = lazy(() => import("./pages/SearchPage"));
const Catalog = lazy(() => import("./pages/Catalog"));
const About = lazy(() => import("./pages/About"));
const NotFound = lazy(() => import("./pages/NotFound"));

// Auth & User
const Login = lazy(() => import("./pages/Login"));
const Register = lazy(() => import("./pages/Register"));
const Profile = lazy(() => import("./pages/Profile"));
const Favorites = lazy(() => import("./pages/Favorites"));
const History = lazy(() => import("./pages/History"));

// Watch Party
const WatchParty = lazy(() => import("./pages/WatchParty"));
const WatchPartyLobby = lazy(() => import("./pages/WatchPartyLobby"));

// Admin
const Dashboard = lazy(() => import("./pages/admin/Dashboard"));
const Users = lazy(() => import("./pages/admin/Users"));
const Comments = lazy(() => import("./pages/admin/Comments"));
const Intros = lazy(() => import("./pages/admin/Intros"));
const PlayerSettings = lazy(() => import("./pages/admin/PlayerSettings"));
const ViewsStats = lazy(() => import("./pages/admin/ViewsStats"));

// --- UTILS ---

// 1. Loading Component khi chuyển trang
const LoadingFallback = () => (
  <div className="min-h-screen bg-[var(--bg)] flex items-center justify-center">
    <FaSpinner className="animate-spin text-4xl text-[var(--accent)]" />
  </div>
);

// 2. Wrapper để áp dụng Suspense cho Lazy Component
const Load = (Component) => (
  <Suspense fallback={<LoadingFallback />}>
    <Component />
  </Suspense>
);

// 3. Bảo vệ Route (Chặn truy cập trái phép)
const ProtectedRoute = ({ children, requireAdmin = false }) => {
  const userStr = localStorage.getItem("user");
  const user = userStr ? JSON.parse(userStr) : null;

  if (!user) {
    return <Navigate to="/login" replace />;
  }

  if (requireAdmin && user.role !== "admin" && user.role !== "super_admin") {
    return <Navigate to="/" replace />;
  }

  return children;
};

// --- ROUTER CONFIG ---
export const router = createBrowserRouter([
  {
    element: <MainLayout />,
    children: [
      { path: "/", element: Load(Home) },
      { path: "/phim/:slug", element: Load(MovieDetail) },
      { path: "/xem-phim/:slug", element: Load(WatchMovie) },

      // Watch Party
      { path: "/watch-party", element: Load(WatchPartyLobby) },
      { path: "/watch-party/:roomId", element: Load(WatchParty) },
      
      // Catalog & Search
      { path: "/tim-kiem", element: Load(SearchPage) },
      { path: "/the-loai/:slug", element: <Suspense fallback={<LoadingFallback />}><Catalog group="the-loai" /></Suspense> },
      { path: "/quoc-gia/:slug", element: <Suspense fallback={<LoadingFallback />}><Catalog group="quoc-gia" /></Suspense> },
      { path: "/danh-sach/:slug", element: <Suspense fallback={<LoadingFallback />}><Catalog group="danh-sach" /></Suspense> },

      // Các trang không có slug (fallback về danh sách)
      { path: "/the-loai", element: <Suspense fallback={<LoadingFallback />}><Catalog group="danh-sach" /></Suspense> },
      { path: "/quoc-gia", element: <Suspense fallback={<LoadingFallback />}><Catalog group="danh-sach" /></Suspense> },
      { path: "/danh-sach", element: <Suspense fallback={<LoadingFallback />}><Catalog group="danh-sach" /></Suspense> },

      // Trang tĩnh
      { path: "/gioi-thieu", element: Load(About) },

      // User Protected Routes
      { 
        path: "/ho-so", 
        element: <ProtectedRoute>{Load(Profile)}</ProtectedRoute> 
      },
      { 
        path: "/tu-phim", 
        element: <ProtectedRoute>{Load(Favorites)}</ProtectedRoute> 
      },
      { 
        path: "/lich-su", 
        element: <ProtectedRoute>{Load(History)}</ProtectedRoute> 
      },
    ],
    errorElement: Load(NotFound),
  },
  
  // Admin Routes (Được bảo vệ nghiêm ngặt)
  {
    path: "/admin",
    element: <ProtectedRoute requireAdmin={true}><AdminLayout /></ProtectedRoute>,
    children: [
      { index: true, element: Load(Dashboard) },
      { path: "users", element: Load(Users) },
      { path: "comments", element: Load(Comments) },
      { path: "intros", element: Load(Intros) },
      { path: "player", element: Load(PlayerSettings) },
      { path: "views", element: Load(ViewsStats) },
    ]
  },

  // Standalone Pages
  { path: "/login", element: Load(Login) },
  { path: "/register", element: Load(Register) },
]);