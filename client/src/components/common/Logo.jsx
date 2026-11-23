import React, { useState } from 'react';
// Import ảnh từ thư mục assets
import logoImg from '../../assets/logo.png';

const Logo = () => {
  // Giai đoạn 3 (H6): nếu ảnh logo lỗi thì hiện chữ fallback thay vì
  // để trống khoảng logo trên header/drawer.
  const [imgError, setImgError] = useState(false);
  return (
    <div className="cursor-pointer select-none group flex items-center gap-2">
      {!imgError ? (
        <img 
          src={logoImg} 
          alt="PhimVietHay Logo" 
          onError={() => setImgError(true)}
          // Class chỉnh kích thước:
          // h-10 (40px) trên mobile, h-12 (48px) trên máy tính
          // w-auto: Chiều rộng tự động theo tỉ lệ
          // object-contain: Đảm bảo ảnh không bị méo
          className="h-10 md:h-14 w-auto object-contain transition-transform duration-300 group-hover:scale-105 drop-shadow-lg"
        />
      ) : (
        <span className="text-xl md:text-2xl font-black tracking-tight text-white whitespace-nowrap">Phim<span className="text-[var(--accent)]">Viet</span>Hay</span>
      )}
    </div>
  );
};

export default Logo;