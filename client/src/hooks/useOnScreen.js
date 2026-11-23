import { useState, useEffect } from 'react';

export default function useOnScreen(options) {
  const [node, setNode] = useState(null);
  const [visible, setVisible] = useState(false);

  useEffect(() => {
    if (!node) return;
    const observer = new IntersectionObserver(([entry]) => {
      // Khi thành phần xuất hiện trong màn hình
      if (entry.isIntersecting) {
        setVisible(true);
        // Ngắt theo dõi ngay sau khi đã hiện (chỉ load 1 lần)
        observer.unobserve(node);
      }
    }, options);

    observer.observe(node);

    return () => observer.disconnect();
  }, [node, options]);

  // Tra ve callback ref thay vi useRef: React goi lai setNode moi khi
  // phan tu mount/unmount, nen observer luon gan dung luc — quan trong
  // voi cac trang hien skeleton truoc (MovieDetail/WatchMovie): o lan
  // render dau ref chua ton tai, ban cu dung useRef + effect chay 1 lan
  // nen khong bao gio observe duoc phan tu render muon ve sau.
  // Cach dung khong doi: const [ref, visible] = useOnScreen(opts); <div ref={ref}>.
  return [setNode, visible];
}
