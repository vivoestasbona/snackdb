// app/snacks/[slug]/page.jsx
export const dynamic = "force-dynamic";
export const revalidate = 0; // 안전하게 완전 SSR
import SnackDetailView from "@widgets/snack-preview/ui/SnackDetailView";
import AdminPreview from "@widgets/snack-preview/ui/AdminPreview";
import { getBySlugOrId } from "@entities/snack/model/getBySlugOrId";
import { snackMetadata, snackJsonLd } from "@shared/lib/seo/snackSeo";
import { redirect, notFound } from "next/navigation";
import { getSupabaseServer } from "@shared/api/supabase/server";

export async function generateMetadata({ params }) {
  const p = await params;
  const { slug: raw } = p ?? {};
  const slug = decodeURIComponent(String(raw)).normalize("NFC").toLowerCase();
  const { snack, avg } = await getBySlugOrId(slug);
  if (snack) return snackMetadata(snack, avg);

  // 히스토리에서 현재 slug 찾아 메타 생성
  const sb = await getSupabaseServer();
  const { data: hist } = await sb
    .from("snack_slug_history").select("snack_id").eq("old_slug", slug).single();
  if (hist?.snack_id) {
    const { data: cur } = await sb
      .from("snacks").select("slug").eq("id", hist.snack_id).single();
    if (cur?.slug) {
      const { snack: s2, avg: a2 } = await getBySlugOrId(cur.slug);
      if (s2) return snackMetadata(s2, a2);
    }
  }
  return { title: "SnackDB" };
}

export default async function Page({ params, searchParams }) {
  const p = await params; 
  const { slug: raw } = p ?? {};
  const slug = decodeURIComponent(String(raw)).normalize("NFC").toLowerCase();
  const sp = (await searchParams) ?? {};   
  const preview = sp.preview != null && sp.preview !== "0" && sp.preview !== "false";

  // ✅ 미리보기는 서버 조회 전에 바로 클라이언트 미리보기로
  if (preview) {
    return <AdminPreview slug={slug} />;
  }

  // 🔽 일반 공개 흐름만 서버에서 조회/리다이렉트 처리
  const { snack, avg, flavors, keywords } = await getBySlugOrId(slug);
  if (!snack) {
    const sb = await getSupabaseServer();
    const { data: hist, error: histErr } = await sb
      .from("snack_slug_history")
      .select("snack_id")
      .eq("old_slug", slug)
      .maybeSingle();
    if (!hist) {
      if (process.env.NODE_ENV !== "production") {
        console.warn("[slug-history miss]", { slug, histErr });
      }
      return notFound();
    }
    
    if (hist?.snack_id) {
      const { data: cur, error: curErr } = await sb
        .from("snacks")
        .select("slug")
        .eq("id", hist.snack_id)
        .single();
      if (process.env.NODE_ENV !== "production") {
        // 디버그는 개발에서만
        console.warn("[current-slug]", { cur, curErr });
      }
      if (cur?.slug) {
        const q = preview ? "?preview=1" : "";
        return redirect(`/snacks/${encodeURIComponent(cur.slug)}${q}`);
      }
    }
    return notFound();
  }

  // ✅ 정규 슬러그로 리다이렉트 (요청 slug와 실제 slug가 다르면)
  if (snack.slug && snack.slug !== slug) {
    return redirect(`/snacks/${encodeURIComponent(snack.slug)}${preview ? "?preview=1" : ""}`);
  }

  // ✅ 이제 미리보기 분기
  if (preview) {
    return <AdminPreview slug={snack.slug} />;
  }

  return (
    <SnackDetailView
      snack={snack}
      avg={avg}
      flavors={flavors}
      keywords={keywords}
      preview={false}
    />
  );
}
