import React, { useState } from 'react';
import { Link } from 'react-router-dom';
import { Helmet } from 'react-helmet-async';
import {
    FaFilm,
    FaSearch,
    FaThList,
    FaGlobe,
    FaPlayCircle,
    FaHeart,
    FaHistory,
    FaUser,
    FaShieldAlt,
    FaEnvelope,
    FaQuestionCircle,
    FaChevronDown,
} from 'react-icons/fa';

// --- TÍNH NĂNG CHÍNH ---
const FEATURES = [
    {
        icon: FaSearch,
        title: 'Tìm kiếm nhanh',
        desc: 'Tìm phim theo tên, diễn viên hoặc từ khóa chỉ trong vài giây.',
    },
    {
        icon: FaThList,
        title: 'Thể loại đa dạng',
        desc: 'Hành động, tình cảm, kinh dị, hài hước, hoạt hình... đủ mọi thể loại cho mọi gu xem.',
    },
    {
        icon: FaGlobe,
        title: 'Phim nhiều quốc gia',
        desc: 'Phim Việt, Hàn, Trung, Âu Mỹ, Nhật Bản và nhiều quốc gia khác, cập nhật liên tục.',
    },
    {
        icon: FaPlayCircle,
        title: 'Xem phim HD Vietsub',
        desc: 'Chất lượng hình ảnh HD, phụ đề tiếng Việt đầy đủ, tải nhanh, xem mượt.',
    },
    {
        icon: FaHeart,
        title: 'Tủ phim yêu thích',
        desc: 'Lưu lại những bộ phim bạn thích để xem sau, đồng bộ theo tài khoản.',
    },
    {
        icon: FaHistory,
        title: 'Lịch sử xem phim',
        desc: 'Tự động ghi nhớ phim đã xem và tập đang xem dở để xem tiếp bất cứ lúc nào.',
    },
    {
        icon: FaUser,
        title: 'Tài khoản cá nhân',
        desc: 'Đăng ký tài khoản miễn phí để lưu tủ phim, lịch sử và tùy chỉnh giao diện theo ý thích.',
    },
];

// --- ẢNH CHỤP MÀN HÌNH THẬT (client/public/about/) ---
const SCREENSHOTS = [
    {
        src: '/about/search.png',
        alt: 'Trang tìm kiếm của PhimVietHay',
        caption: 'Trang tìm kiếm — nhập tên phim, diễn viên hoặc từ khóa để tìm ngay.',
    },
    {
        src: '/about/catalog.png',
        alt: 'Trang danh sách phim theo thể loại của PhimVietHay',
        caption: 'Trang danh sách phim theo thể loại, kèm bộ lọc tìm kiếm.',
    },
    {
        src: '/about/favorites.png',
        alt: 'Trang tủ phim yêu thích của PhimVietHay',
        caption: 'Tủ phim của tôi — lưu phim yêu thích để xem sau.',
    },
    {
        src: '/about/history.png',
        alt: 'Trang lịch sử xem phim của PhimVietHay',
        caption: 'Lịch sử xem — xem tiếp phim đang xem dở bất cứ lúc nào.',
    },
    {
        src: '/about/profile.png',
        alt: 'Trang hồ sơ cá nhân với mục tùy chỉnh giao diện của PhimVietHay',
        caption: 'Hồ sơ cá nhân — tùy chỉnh giao diện với nhiều bộ màu, lưu theo tài khoản.',
    },
];

// --- CÂU HỎI THƯỜNG GẶP ---
const FAQ = [
    {
        q: 'Xem phim trên PhimVietHay có mất phí không?',
        a: 'Không. Tất cả phim trên PhimVietHay đều xem miễn phí, không cần trả phí hay mua gói nào.',
    },
    {
        q: 'Có cần đăng ký tài khoản mới xem được phim không?',
        a: 'Không bắt buộc. Bạn có thể xem phim ngay mà không cần tài khoản. Nếu đăng ký tài khoản miễn phí, bạn sẽ lưu được tủ phim yêu thích, lịch sử xem và tùy chỉnh giao diện theo ý thích.',
    },
    {
        q: 'Phim trên web có Vietsub và chất lượng thế nào?',
        a: 'Phim có phụ đề tiếng Việt đầy đủ, chất lượng hình ảnh HD, tải nhanh và xem mượt ngay trên trình duyệt.',
    },
    {
        q: 'Xem phim trên điện thoại được không?',
        a: 'Được. Website hiển thị tốt trên điện thoại, máy tính bảng và máy tính — chỉ cần mở trình duyệt, không cần cài thêm ứng dụng.',
    },
    {
        q: 'Phim mới được cập nhật nhanh không?',
        a: 'Có. Website cập nhật liên tục các bộ phim mới nhất, phim chiếu rạp, phim bộ và TV shows từ nhiều quốc gia.',
    },
    {
        q: 'Gặp lỗi khi xem phim thì làm gì?',
        a: 'Hãy thử tải lại trang và kiểm tra kết nối mạng của bạn. Nếu vẫn lỗi, bạn có thể liên hệ với chúng tôi qua email hỗ trợ để được giúp đỡ.',
    },
];

// --- ẢNH MINH HỌA (dùng chung cho các mục) ---
const AboutShot = ({ src, alt, caption }) => (
    <figure className="mb-6 last:mb-0">
        <img
            src={src}
            alt={alt}
            loading="lazy"
            className="w-full h-auto rounded-xl border border-white/10"
        />
        {caption && <figcaption className="text-sm text-gray-400 text-center mt-2">{caption}</figcaption>}
    </figure>
);

// --- MAIN COMPONENT ---
const About = () => {
    const [openFaq, setOpenFaq] = useState(0);
    return (
        <div className="min-h-screen text-white font-sans pb-20 selection:bg-[var(--accent)] selection:text-white">
            <Helmet>
                <title>Giới Thiệu | PhimVietHay</title>
                <meta
                    name="description"
                    content="PhimVietHay - Website xem phim online HD Vietsub miễn phí, cập nhật nhanh các bộ phim mới nhất."
                />
            </Helmet>

            <div className="pt-28 px-4 md:px-12 container mx-auto max-w-5xl">
                {/* Header */}
                <div className="mb-10 border-b border-white/10 pb-6">
                    <h1 className="text-2xl md:text-3xl font-bold uppercase tracking-wide flex items-center gap-3">
                        <span className="text-[var(--accent)] border-l-4 border-[var(--accent)] pl-3">Giới Thiệu</span>
                    </h1>
                    <p className="text-gray-400 mt-4 leading-relaxed">
                        PhimVietHay là website xem phim online miễn phí dành cho khán giả Việt Nam.
                    </p>
                </div>

                {/* PhimVietHay là gì */}
                <section className="mb-12">
                    <h2 className="text-xl font-bold mb-4 flex items-center gap-2">
                        <FaFilm className="text-[var(--accent)]" /> PhimVietHay là gì?
                    </h2>
                    <div className="space-y-4 text-gray-300 leading-relaxed text-[15px]">
                        <p>
                            <span className="text-white font-bold">PhimVietHay</span> là website
                            xem phim trực tuyến chất lượng HD Vietsub hoàn toàn miễn phí. Chúng tôi
                            tổng hợp và cập nhật nhanh các bộ phim mới nhất, hot nhất: phim lẻ,
                            phim bộ, phim chiếu rạp, TV shows và hoạt hình từ nhiều quốc gia.
                        </p>
                        <p>
                            Bạn có thể xem phim ngay trên trình duyệt mà không cần cài đặt thêm
                            phần mềm. Chỉ cần mở website, chọn phim và thưởng thức — đơn giản,
                            nhanh chóng và không rườm rà.
                        </p>
                    </div>
                    <div className="mt-6">
                        <AboutShot
                            src="/about/home.png"
                            alt="Trang chủ PhimVietHay với thanh điều hướng và logo"
                            caption="Trang chủ PhimVietHay — thanh điều hướng với logo, menu Thể loại, Quốc gia và Rạp Phim."
                        />
                    </div>
                </section>

                {/* Tính năng chính */}
                <section className="mb-12">
                    <h2 className="text-xl font-bold mb-6 flex items-center gap-2">
                        <FaPlayCircle className="text-[var(--accent)]" /> Tính năng chính
                    </h2>
                    <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
                        {FEATURES.map((feature) => (
                            <div
                                key={feature.title}
                                className="bg-white/5 border border-white/5 rounded-2xl p-5 hover:border-[var(--accent)]/50 transition-colors"
                            >
                                <div className="w-11 h-11 rounded-xl bg-[var(--accent)]/15 text-[var(--accent)] flex items-center justify-center text-xl mb-4">
                                    <feature.icon />
                                </div>
                                <h3 className="font-bold mb-2">{feature.title}</h3>
                                <p className="text-sm text-gray-400 leading-relaxed">{feature.desc}</p>
                            </div>
                        ))}
                    </div>

                    {/* Ảnh chụp màn hình thật các trang chính */}
                    <h3 className="text-lg font-bold mt-8 mb-4">Xem trước giao diện</h3>
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                        {SCREENSHOTS.map((shot) => (
                            <AboutShot
                                key={shot.src}
                                src={shot.src}
                                alt={shot.alt}
                                caption={shot.caption}
                            />
                        ))}
                    </div>
                </section>

                {/* Lưu ý bản quyền */}
                <section className="mb-12">
                    <h2 className="text-xl font-bold mb-4 flex items-center gap-2">
                        <FaShieldAlt className="text-[var(--accent)]" /> Lưu ý về bản quyền
                    </h2>
                    <div className="rounded-xl border border-white/5 bg-white/[0.03] px-5 py-4">
                        <p className="text-sm text-gray-300 leading-relaxed">
                            Nội dung được tổng hợp từ các nguồn công khai. Chúng tôi không lưu trữ
                            bất kỳ tệp bản quyền nào trên máy chủ.
                        </p>
                        <p className="text-sm text-gray-400 leading-relaxed mt-3">
                            Nếu bạn là chủ sở hữu nội dung và cho rằng quyền lợi của mình bị ảnh
                            hưởng, vui lòng liên hệ với chúng tôi để được xử lý và gỡ bỏ nội dung
                            liên quan trong thời gian sớm nhất.
                        </p>
                    </div>
                </section>

                {/* Liên hệ */}
                <section className="mb-12">
                    <h2 className="text-xl font-bold mb-4 flex items-center gap-2">
                        <FaEnvelope className="text-[var(--accent)]" /> Liên hệ
                    </h2>
                    <p className="text-gray-300 leading-relaxed text-[15px]">
                        Mọi góp ý, báo lỗi hoặc yêu cầu hỗ trợ, bạn có thể liên hệ với chúng tôi
                        qua email hỗ trợ của website. Đội ngũ PhimVietHay luôn lắng nghe để mang
                        đến trải nghiệm xem phim tốt hơn mỗi ngày.
                    </p>
                </section>

                {/* Câu hỏi thường gặp */}
                <section className="mb-12">
                    <h2 className="text-xl font-bold mb-6 flex items-center gap-2">
                        <FaQuestionCircle className="text-[var(--accent)]" /> Câu hỏi thường gặp
                    </h2>
                    <div className="space-y-3">
                        {FAQ.map((item, index) => {
                            const open = openFaq === index;
                            return (
                                <div
                                    key={item.q}
                                    className="rounded-xl border border-white/5 bg-white/[0.03] overflow-hidden"
                                >
                                    <button
                                        type="button"
                                        onClick={() => setOpenFaq(open ? null : index)}
                                        aria-expanded={open}
                                        className="w-full flex items-center justify-between gap-3 px-5 py-4 text-left font-bold text-[15px] hover:text-[var(--accent)] transition-colors"
                                    >
                                        <span>{item.q}</span>
                                        <FaChevronDown
                                            className={`shrink-0 text-sm text-gray-400 transition-transform ${
                                                open ? 'rotate-180' : ''
                                            }`}
                                        />
                                    </button>
                                    {open && (
                                        <p className="px-5 pb-4 text-sm text-gray-300 leading-relaxed">
                                            {item.a}
                                        </p>
                                    )}
                                </div>
                            );
                        })}
                    </div>
                </section>

                {/* CTA */}
                <div className="text-center border-t border-white/10 pt-10">
                    <Link
                        to="/"
                        className="inline-block bg-[var(--accent)] px-8 py-3 rounded-full font-bold hover:bg-[var(--accent-hover)] transition text-white shadow-lg"
                    >
                        Xem phim ngay
                    </Link>
                </div>
            </div>
        </div>
    );
};

export default About;
