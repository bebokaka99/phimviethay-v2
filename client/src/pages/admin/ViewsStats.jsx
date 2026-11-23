import React, { useCallback, useEffect, useState } from 'react';
import axios from 'axios';
import { FaEye, FaCalendarDay, FaCalendarWeek, FaCalendarAlt, FaRedo, FaSpinner, FaExclamationTriangle, FaTrophy } from 'react-icons/fa';

// Nhom C — Admin UI: thong ke luot xem.
// KHONG dung adminService.js (worker nhom B so huu file do):
// fetch truc tiep bang axios, theo dung pattern cua adminService.js.
const BASE_URL = import.meta.env.VITE_API_URL || 'http://localhost:5000/api';

const StatCard = ({ title, value, icon, color }) => (
    <div className="bg-[#161616] p-6 rounded-2xl border border-white/5 shadow-lg flex items-center gap-4 hover:bg-[#1f1f1f] transition-colors">
        <div className={`w-16 h-16 rounded-full flex items-center justify-center text-2xl ${color} bg-opacity-20`}>
            {icon}
        </div>
        <div>
            <p className="text-gray-400 text-xs font-bold uppercase tracking-wider mb-1">{title}</p>
            <h3 className="text-3xl font-black text-white">{value !== null && value !== undefined ? Number(value).toLocaleString() : '-'}</h3>
        </div>
    </div>
);

const ViewsStats = () => {
    const [stats, setStats] = useState(null);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState('');
    // Tab con cua bang Top 10: '7' = 7 ngay, '30' = 30 ngay
    const [range, setRange] = useState('7');

    const fetchStats = useCallback(async () => {
        setLoading(true);
        setError('');
        try {
            const token = localStorage.getItem('token');
            const res = await axios.get(`${BASE_URL}/admin/stats/views`, {
                headers: { Authorization: `Bearer ${token}` },
            });
            setStats(res.data || {});
        } catch (err) {
            console.error('ViewsStats Error:', err);
            setError(err.response?.data?.message || 'Không tải được dữ liệu lượt xem. Vui lòng thử lại.');
        } finally {
            setLoading(false);
        }
    }, []);

    useEffect(() => { fetchStats(); }, [fetchStats]);

    const topList = range === '7' ? (stats?.top7Days || []) : (stats?.top30Days || []);

    return (
        <div className="animate-fade-in">
            <div className="flex flex-col md:flex-row justify-between items-start md:items-center mb-8 gap-4">
                <h1 className="text-2xl md:text-3xl font-black text-white border-l-4 border-red-600 pl-4">Lượt Xem Phim</h1>
                <button
                    onClick={fetchStats}
                    disabled={loading}
                    className="flex items-center gap-2 bg-red-600 hover:bg-red-700 disabled:opacity-50 text-white px-4 py-2.5 rounded-xl font-bold text-sm transition shadow-lg shadow-red-900/30"
                >
                    <FaRedo className={loading ? 'animate-spin' : ''} /> Tải lại dữ liệu
                </button>
            </div>

            {loading && !stats ? (
                <div className="flex justify-center p-20"><FaSpinner className="animate-spin text-3xl text-gray-500" /></div>
            ) : error && !stats ? (
                <div className="bg-[#161616] border border-red-600/30 rounded-2xl p-8 text-center">
                    <FaExclamationTriangle className="text-red-500 text-3xl mx-auto mb-3" />
                    <p className="text-white font-bold mb-2">Không tải được dữ liệu</p>
                    <p className="text-gray-400 text-sm mb-6">{error}</p>
                    <button onClick={fetchStats} className="bg-red-600 hover:bg-red-700 text-white px-5 py-2.5 rounded-xl font-bold text-sm transition">
                        Thử lại
                    </button>
                </div>
            ) : (
                <>
                    {/* 3 the tong */}
                    <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                        <StatCard title="Hôm nay" value={stats?.today ?? 0} icon={<FaCalendarDay />} color="text-blue-500 bg-blue-500" />
                        <StatCard title="7 ngày qua" value={stats?.last7Days ?? 0} icon={<FaCalendarWeek />} color="text-green-500 bg-green-500" />
                        <StatCard title="30 ngày qua" value={stats?.last30Days ?? 0} icon={<FaCalendarAlt />} color="text-purple-500 bg-purple-500" />
                    </div>

                    {error && (
                        <p className="mt-4 text-sm text-yellow-400 flex items-center gap-2">
                            <FaExclamationTriangle /> {error} (đang hiển thị dữ liệu cũ)
                        </p>
                    )}

                    {/* Bang Top 10 */}
                    <div className="mt-10 bg-[#161616] rounded-2xl border border-white/10 overflow-hidden shadow-lg">
                        <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-3 p-5 border-b border-white/5">
                            <h2 className="text-lg font-black text-white flex items-center gap-2">
                                <FaTrophy className="text-yellow-500" /> Top 10 phim được xem nhiều nhất
                            </h2>
                            <div className="flex bg-white/5 rounded-xl p-1 border border-white/10">
                                <button
                                    onClick={() => setRange('7')}
                                    className={`px-4 py-2 rounded-lg text-sm font-bold transition ${range === '7' ? 'bg-red-600 text-white shadow-lg shadow-red-900/30' : 'text-gray-400 hover:text-white'}`}
                                >
                                    7 ngày
                                </button>
                                <button
                                    onClick={() => setRange('30')}
                                    className={`px-4 py-2 rounded-lg text-sm font-bold transition ${range === '30' ? 'bg-red-600 text-white shadow-lg shadow-red-900/30' : 'text-gray-400 hover:text-white'}`}
                                >
                                    30 ngày
                                </button>
                            </div>
                        </div>

                        <table className="w-full text-left text-sm text-gray-400">
                            <thead className="bg-white/5 text-white uppercase font-bold text-xs">
                                <tr>
                                    <th className="p-4 w-20 text-center">Hạng</th>
                                    <th className="p-4">Slug phim</th>
                                    <th className="p-4 w-32 text-right">Lượt xem</th>
                                </tr>
                            </thead>
                            <tbody className="divide-y divide-white/5">
                                {topList.length === 0 ? (
                                    <tr><td colSpan="3" className="p-10 text-center">Chưa có lượt xem nào trong khoảng thời gian này.</td></tr>
                                ) : (
                                    topList.slice(0, 10).map((item, idx) => (
                                        <tr key={item.slug || idx} className="hover:bg-white/5 transition">
                                            <td className="p-4 text-center">
                                                <span className={`inline-flex items-center justify-center w-8 h-8 rounded-full font-black text-sm ${idx === 0 ? 'bg-yellow-500/20 text-yellow-400' : idx === 1 ? 'bg-gray-300/20 text-gray-200' : idx === 2 ? 'bg-orange-500/20 text-orange-400' : 'bg-white/5 text-gray-400'}`}>
                                                    {idx + 1}
                                                </span>
                                            </td>
                                            <td className="p-4">
                                                <span className="font-bold text-white break-all flex items-center gap-2">
                                                    <FaEye className="text-red-500 shrink-0" /> {item.slug}
                                                </span>
                                            </td>
                                            <td className="p-4 text-right font-black text-white">{Number(item.views || 0).toLocaleString()}</td>
                                        </tr>
                                    ))
                                )}
                            </tbody>
                        </table>

                        <p className="px-5 py-4 text-xs text-gray-500 border-t border-white/5">
                            Chỉ hiển thị slug vì backend không lưu tên phim.
                        </p>
                    </div>
                </>
            )}
        </div>
    );
};

export default ViewsStats;
