// app/admin/layout.js
export const metadata = {
  title: "Admin • SnackDB",
};

export default function AdminLayout({ children }) {
  return children; // 필요시 여기서 관리자 공통 UI 래핑 가능
}
