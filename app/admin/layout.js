// app/admin/layout.js
import { redirect } from "next/navigation";
import { cookies } from "next/headers";
import { createServerClient } from "@supabase/ssr";
import AdminTabs from "@shared/ui/AdminTabs";

export const metadata = { title: "Admin • SnackDB" };

export default async function AdminLayout({ children }) {
  const cookieStore = await cookies();
  const supabase = createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY,
    {
      cookies: {
        get: (name) => cookieStore.get(name)?.value,
        set: async (name, value, options) => cookieStore.set({ name, value, ...options }),
        remove: async (name, options) => cookieStore.set({ name, value: "", ...options }),
      },
    }
  );

  // 1) 로그인 확인
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) {
    // NOTE: /login 페이지가 없다면 홈으로 보냅니다.
    redirect("/"); // 필요하면 "/?showLogin=1"
  }

  // 2) 관리자 권한 확인
  const { data: prof } = await supabase
    .from("profiles")
    .select("role")
    .eq("id", user.id)
    .maybeSingle();

  if (prof?.role !== "admin") {
    redirect("/403");
  }

  return (
    <>
      <AdminTabs />
      <div style={{ maxWidth: 1100, margin: "0 auto", padding: "0 16px" }}>
        {children}
      </div>
    </>
  );
}
