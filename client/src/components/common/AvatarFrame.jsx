import React from 'react';

const AvatarFrame = ({ frameId = 'default' }) => {
    if (!frameId || frameId === 'default') return null;

    // ViewBox 0 0 100 100, avatar tròn nằm ở tâm (50, 50) bán kính r = 38
    switch (frameId) {
        case 'bronze':
            return (
                <svg className="absolute inset-[-14%] w-[128%] h-[128%] pointer-events-none z-10 overflow-visible" viewBox="0 0 100 100" fill="none">
                    <defs>
                        <linearGradient id="bronzeGrad" x1="0%" y1="0%" x2="100%" y2="100%">
                            <stop offset="0%" stopColor="#d97706" />
                            <stop offset="50%" stopColor="#78350f" />
                            <stop offset="100%" stopColor="#b45309" />
                        </linearGradient>
                        <filter id="bronzeGlow" x="-20%" y="-20%" width="140%" height="140%">
                            <feDropShadow dx="0" dy="0" stdDeviation="1.5" floodColor="#b45309" floodOpacity="0.6" />
                        </filter>
                    </defs>
                    {/* Vòng kim loại đồng */}
                    <circle cx="50" cy="50" r="39.5" stroke="url(#bronzeGrad)" strokeWidth="3" filter="url(#bronzeGlow)" />
                    <circle cx="50" cy="50" r="42" stroke="#b45309" strokeWidth="0.8" strokeDasharray="3 3" opacity="0.8" />
                    {/* 4 Chốt rivet đồng cổ */}
                    <circle cx="50" cy="9.5" r="2.2" fill="#f59e0b" stroke="#78350f" strokeWidth="1" />
                    <circle cx="50" cy="90.5" r="2.2" fill="#f59e0b" stroke="#78350f" strokeWidth="1" />
                    <circle cx="9.5" cy="50" r="2.2" fill="#f59e0b" stroke="#78350f" strokeWidth="1" />
                    <circle cx="90.5" cy="50" r="2.2" fill="#f59e0b" stroke="#78350f" strokeWidth="1" />
                </svg>
            );

        case 'silver':
            return (
                <svg className="absolute inset-[-15%] w-[130%] h-[130%] pointer-events-none z-10 overflow-visible" viewBox="0 0 100 100" fill="none">
                    <defs>
                        <linearGradient id="silverGrad" x1="0%" y1="0%" x2="100%" y2="100%">
                            <stop offset="0%" stopColor="#ffffff" />
                            <stop offset="40%" stopColor="#94a3b8" />
                            <stop offset="70%" stopColor="#e2e8f0" />
                            <stop offset="100%" stopColor="#64748b" />
                        </linearGradient>
                        <filter id="silverGlow" x="-20%" y="-20%" width="140%" height="140%">
                            <feDropShadow dx="0" dy="0" stdDeviation="2" floodColor="#cbd5e1" floodOpacity="0.7" />
                        </filter>
                    </defs>
                    {/* Viền bạc ánh trăng */}
                    <circle cx="50" cy="50" r="39.5" stroke="url(#silverGrad)" strokeWidth="3.2" filter="url(#silverGlow)" />
                    {/* Cánh hoa nguyệt quế ôm dưới */}
                    <path d="M 22 68 C 24 78, 36 88, 50 89 C 64 88, 76 78, 78 68 C 72 73, 62 80, 50 80 C 38 80, 28 73, 22 68 Z" fill="url(#silverGrad)" opacity="0.85" />
                    {/* Ngôi sao bạc đỉnh đầu */}
                    <path d="M 50 4 L 52 9 L 57 10 L 53 13 L 54 18 L 50 15 L 46 18 L 47 13 L 43 10 L 48 9 Z" fill="#ffffff" filter="url(#silverGlow)" />
                </svg>
            );

        case 'gold':
            return (
                <svg className="absolute inset-[-18%] w-[136%] h-[136%] pointer-events-none z-10 overflow-visible" viewBox="0 0 100 100" fill="none">
                    <defs>
                        <linearGradient id="goldGrad" x1="0%" y1="0%" x2="100%" y2="100%">
                            <stop offset="0%" stopColor="#fef08a" />
                            <stop offset="25%" stopColor="#facc15" />
                            <stop offset="60%" stopColor="#eab308" />
                            <stop offset="100%" stopColor="#ca8a04" />
                        </linearGradient>
                        <filter id="goldGlow" x="-30%" y="-30%" width="160%" height="160%">
                            <feDropShadow dx="0" dy="0" stdDeviation="2.5" floodColor="#facc15" floodOpacity="0.8" />
                        </filter>
                    </defs>
                    {/* Vòng vàng kim rực rỡ */}
                    <circle cx="50" cy="50" r="39.5" stroke="url(#goldGrad)" strokeWidth="3.5" filter="url(#goldGlow)" />
                    <circle cx="50" cy="50" r="43" stroke="#fef08a" strokeWidth="0.8" strokeDasharray="2 4" opacity="0.8" />
                    {/* Vương miện hoàng gia trên đỉnh */}
                    <path 
                        d="M 38 15 L 41 5 L 46 11 L 50 2 L 54 11 L 59 5 L 62 15 Z" 
                        fill="url(#goldGrad)" 
                        stroke="#854d0e" 
                        strokeWidth="0.8"
                        filter="url(#goldGlow)"
                    />
                    {/* Viên ngọc trên đỉnh vương miện */}
                    <circle cx="50" cy="2" r="1.5" fill="#ef4444" />
                    <circle cx="41" cy="5" r="1.2" fill="#3b82f6" />
                    <circle cx="59" cy="5" r="1.2" fill="#3b82f6" />
                    {/* Dải nơ hoàng gia bên dưới */}
                    <path d="M 30 84 C 40 93, 60 93, 70 84 C 62 88, 38 88, 30 84 Z" fill="url(#goldGrad)" />
                </svg>
            );

        case 'emerald':
            return (
                <svg className="absolute inset-[-16%] w-[132%] h-[132%] pointer-events-none z-10 overflow-visible" viewBox="0 0 100 100" fill="none">
                    <defs>
                        <linearGradient id="emeraldGrad" x1="0%" y1="0%" x2="100%" y2="100%">
                            <stop offset="0%" stopColor="#6ee7b7" />
                            <stop offset="50%" stopColor="#10b981" />
                            <stop offset="100%" stopColor="#047857" />
                        </linearGradient>
                        <filter id="emeraldGlow" x="-20%" y="-20%" width="140%" height="140%">
                            <feDropShadow dx="0" dy="0" stdDeviation="2.5" floodColor="#34d399" floodOpacity="0.75" />
                        </filter>
                    </defs>
                    <circle cx="50" cy="50" r="39.5" stroke="url(#emeraldGrad)" strokeWidth="3.5" filter="url(#emeraldGlow)" />
                    {/* 4 Viên tinh thể ngọc phát sáng 4 góc */}
                    <polygon points="50,4 54,9 50,14 46,9" fill="#a7f3d0" stroke="#065f46" strokeWidth="0.8" filter="url(#emeraldGlow)" />
                    <polygon points="50,86 54,91 50,96 46,91" fill="#a7f3d0" stroke="#065f46" strokeWidth="0.8" filter="url(#emeraldGlow)" />
                    <polygon points="6,50 11,46 16,50 11,54" fill="#a7f3d0" stroke="#065f46" strokeWidth="0.8" filter="url(#emeraldGlow)" />
                    <polygon points="84,50 89,46 94,50 89,54" fill="#a7f3d0" stroke="#065f46" strokeWidth="0.8" filter="url(#emeraldGlow)" />
                </svg>
            );

        case 'cyberpunk':
            return (
                <svg className="absolute inset-[-16%] w-[132%] h-[132%] pointer-events-none z-10 overflow-visible" viewBox="0 0 100 100" fill="none">
                    <defs>
                        <linearGradient id="cyberGrad" x1="0%" y1="0%" x2="100%" y2="100%">
                            <stop offset="0%" stopColor="#06b6d4" />
                            <stop offset="50%" stopColor="#d946ef" />
                            <stop offset="100%" stopColor="#ec4899" />
                        </linearGradient>
                        <filter id="cyberGlow" x="-20%" y="-20%" width="140%" height="140%">
                            <feDropShadow dx="0" dy="0" stdDeviation="2" floodColor="#06b6d4" floodOpacity="0.8" />
                            <feDropShadow dx="0" dy="0" stdDeviation="3" floodColor="#d946ef" floodOpacity="0.6" />
                        </filter>
                    </defs>
                    {/* Vòng công nghệ HUD */}
                    <circle cx="50" cy="50" r="39.5" stroke="url(#cyberGrad)" strokeWidth="3" filter="url(#cyberGlow)" />
                    {/* 4 Góc vát Sci-Fi */}
                    <path d="M 20 28 L 20 20 L 28 20" stroke="#06b6d4" strokeWidth="2.5" strokeLinecap="square" filter="url(#cyberGlow)" />
                    <path d="M 80 28 L 80 20 L 72 20" stroke="#06b6d4" strokeWidth="2.5" strokeLinecap="square" filter="url(#cyberGlow)" />
                    <path d="M 20 72 L 20 80 L 28 80" stroke="#ec4899" strokeWidth="2.5" strokeLinecap="square" filter="url(#cyberGlow)" />
                    <path d="M 80 72 L 80 80 L 72 80" stroke="#ec4899" strokeWidth="2.5" strokeLinecap="square" filter="url(#cyberGlow)" />
                    {/* Vạch kẻ HUD */}
                    <line x1="50" y1="5" x2="50" y2="9" stroke="#06b6d4" strokeWidth="2" />
                    <line x1="50" y1="91" x2="50" y2="95" stroke="#ec4899" strokeWidth="2" />
                </svg>
            );

        case 'legend':
            return (
                <svg className="absolute inset-[-20%] w-[140%] h-[140%] pointer-events-none z-10 overflow-visible" viewBox="0 0 100 100" fill="none">
                    <defs>
                        <linearGradient id="fireGrad" x1="0%" y1="100%" x2="0%" y2="0%">
                            <stop offset="0%" stopColor="#7f1d1d" />
                            <stop offset="35%" stopColor="#dc2626" />
                            <stop offset="70%" stopColor="#f97316" />
                            <stop offset="100%" stopColor="#fde047" />
                        </linearGradient>
                        <filter id="fireGlow" x="-30%" y="-30%" width="160%" height="160%">
                            <feDropShadow dx="0" dy="0" stdDeviation="3" floodColor="#ef4444" floodOpacity="0.85" />
                        </filter>
                    </defs>
                    {/* Vòng lửa huyền thoại */}
                    <circle cx="50" cy="50" r="39.5" stroke="url(#fireGrad)" strokeWidth="3.5" filter="url(#fireGlow)" />
                    {/* Ngọn lửa cách điệu bùng cháy hai bên và đỉnh đầu */}
                    <path 
                        d="M 50 1 L 54 8 C 58 5, 62 10, 60 16 C 65 14, 69 19, 66 25 C 72 26, 75 32, 72 38" 
                        stroke="url(#fireGrad)" 
                        strokeWidth="2.5" 
                        strokeLinecap="round" 
                        filter="url(#fireGlow)" 
                    />
                    <path 
                        d="M 50 1 L 46 8 C 42 5, 38 10, 40 16 C 35 14, 31 19, 34 25 C 28 26, 25 32, 28 38" 
                        stroke="url(#fireGrad)" 
                        strokeWidth="2.5" 
                        strokeLinecap="round" 
                        filter="url(#fireGlow)" 
                    />
                    {/* Ngọn lửa bùng dưới đáy */}
                    <path 
                        d="M 38 82 C 44 92, 50 99, 50 99 C 50 99, 56 92, 62 82 C 55 86, 45 86, 38 82 Z" 
                        fill="url(#fireGrad)" 
                        filter="url(#fireGlow)" 
                    />
                </svg>
            );

        default:
            return null;
    }
};

export default AvatarFrame;
