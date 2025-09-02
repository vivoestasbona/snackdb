// app/layout.js
import "./globals.css";
import Navbar from "@widgets/navbar/ui/Navbar";

// ✅ 서버용 supabase 클라이언트 유틸 (프로젝트의 기존 경로/함수명에 맞게 사용)
import { getSupabaseServer } from "@shared/api/supabase/server";

export const metadata = {
  title: "SnackDB",
  description: "Snack database MVP",
  metadataBase: new URL(process.env.NEXT_PUBLIC_SITE_URL || "http://localhost:3000"),
};

export default async function RootLayout({ children }) {
  // 서버에서 쿠키 기반 세션을 읽어 초기 상태를 확정
  const supabase = getSupabaseServer?.();
  let initialUser = null;
  let initialProfile = null;

  if (supabase) {
    try {
      const { data: userRes } = await supabase.auth.getUser();
      const user = userRes?.user ?? null;

      if (user?.id) {
        const { data: prof, error } = await supabase
          .from("profiles")
          .select("role, display_name")
          .eq("id", user.id)
          .single();

        initialUser = { id: user.id, email: user.email ?? null };
        initialProfile = error ? null : prof ?? null;
      }
    } catch {
      // 서버에서 세션을 못 읽어도 조용히 계속 (초기값 null 유지)
    }
  }

  return (
    <html lang="ko">
      <body>
        {/* ✅ 서버에서 결정된 초기 상태를 네브바에 공급 */}
        <Navbar initialUser={initialUser} initialProfile={initialProfile} />
        <main className="container">{children}</main>
      </body>
    </html>
  );
}
