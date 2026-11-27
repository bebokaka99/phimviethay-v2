import React from 'react';
import { AVATAR_FRAMES } from '../../utils/levelUtils';
import AvatarFrame from './AvatarFrame';

const UserAvatar = ({ user, frame: propFrame, className = "w-10 h-10", fontSize = "text-sm" }) => {
    // Lấy tên hiển thị (Ưu tiên fullname, nếu không có lấy username)
    const name = user?.fullname || user?.username || "?";
    const frameId = propFrame || user?.current_frame || 'default';
    const frameObj = AVATAR_FRAMES.find(f => f.id === frameId) || AVATAR_FRAMES[0];
    const ringClass = frameObj?.ringClass || 'border border-white/10';
    
    const getInitials = (n) => {
        const parts = n.trim().split(' ');
        if (parts.length === 1) return parts[0].charAt(0).toUpperCase();
        return (parts[0].charAt(0) + parts[parts.length - 1].charAt(0)).toUpperCase();
    };

    const getColor = (n) => {
        const colors = [
            'bg-red-600', 'bg-blue-600', 'bg-green-600', 'bg-yellow-600', 
            'bg-purple-600', 'bg-pink-600', 'bg-indigo-600', 'bg-teal-600',
            'bg-orange-600', 'bg-cyan-600'
        ];
        let hash = 0;
        for (let i = 0; i < n.length; i++) hash = n.charCodeAt(i) + ((hash << 5) - hash);
        return colors[Math.abs(hash) % colors.length];
    };

    return (
        <div className={`relative inline-flex items-center justify-center shrink-0 ${className}`}>
            {/* 1. Nếu có link ảnh -> Hiển thị ảnh */}
            {user?.avatar && user.avatar.trim() !== "" ? (
                <img 
                    src={user.avatar} 
                    alt={name} 
                    className="w-full h-full rounded-full object-cover bg-gray-800 transition-all border border-white/10" 
                    onError={(e) => {
                        e.target.style.display = 'none';
                        e.target.nextSibling.style.display = 'flex';
                    }}
                />
            ) : null}

            {/* 2. Fallback nếu ảnh lỗi hoặc không có ảnh */}
            <div 
                className={`w-full h-full rounded-full flex items-center justify-center font-bold text-white shadow-md transition-all border border-white/10 ${getColor(name)}`}
                style={user?.avatar ? { display: 'none' } : {}}
            >
                <span className={fontSize}>{getInitials(name)}</span>
            </div>

            {/* 3. Lớp phủ Khung Avatar SVG Vector Nghệ Thuật */}
            <AvatarFrame frameId={frameId} />
        </div>
    );
};

export default UserAvatar;