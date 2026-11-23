// Nhãn hiển thị thân thiện cho role của user.
// Dùng ở dropdown header, mobile drawer, trang hồ sơ...
// (DB lưu dạng id: 'super_admin' | 'admin' | 'user',
//  UI hiển thị dạng tên: 'Super Admin' | 'Admin' | 'User'.)
const ROLE_LABELS = {
  super_admin: 'Super Admin',
  admin: 'Admin',
  user: 'User',
};

export function getRoleLabel(role) {
  if (!role) return '';
  const key = String(role).trim().toLowerCase();
  if (ROLE_LABELS[key]) return ROLE_LABELS[key];
  // Fallback: title-case giá trị thô, vd "super-admin" -> "Super Admin".
  return String(role)
    .replace(/[_-]+/g, ' ')
    .replace(/\b\w/g, (c) => c.toUpperCase());
}

export default getRoleLabel;
