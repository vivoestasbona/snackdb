// shared/ui/AdminTabs.jsx
"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";

export default function AdminTabs() {
  const pathname = usePathname();
  const isOn = (href) => pathname === href || pathname.startsWith(href + "/");

  // 기본 인터페이스를 과자별 보기로: /admin/requests
  const items = [
    { href: "/admin/snacks",            label: "과자 관리" },
    { href: "/admin/requests",          label: "수정요청 관리" },
  ];

  return (
    <nav className="adminTabs" aria-label="관리자 섹션">
      <ul className="tabList">
        {items.map((it) => (
          <li key={it.href} className={`tabItem ${isOn(it.href) ? "isActive" : ""}`}>
            {/* 전역 reset의 영향을 안 받도록 클래스 지정 */}
            <Link className="tabLink" href={it.href}>{it.label}</Link>
          </li>
        ))}
      </ul>

      <style jsx>{`
        .adminTabs { border-bottom:1px solid #eee; background:#fff; }
        .tabList { margin:0 auto; padding:10px 16px; max-width:1100px; display:flex; gap:8px; list-style:none; }

        /* 전역 a reset 우회: 명시 클래스에 스타일 직접 적용 */
        :global(.tabLink){
          display:inline-flex; align-items:center; height:32px; padding:0 12px;
          border-radius:8px; border:1px solid #ddd; background:#fafafa;
          text-decoration:none; color:#111; font-size:14px; line-height:1; cursor:pointer;
        }
        :global(.tabLink:hover){ background:#f4f4f4; }
        .isActive :global(.tabLink){ background:#111; color:#fff; border-color:#111; font-weight:700; }
      `}</style>
    </nav>
  );
}
