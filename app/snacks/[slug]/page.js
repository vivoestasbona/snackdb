export const dynamic = "force-dynamic";
export const revalidate = 0;

import AdminPreview from "@widgets/snack-preview/ui/AdminPreview";
import SnackDetailView from "@widgets/snack-preview/ui/SnackDetailView";
import { getBySlugOrId } from "@entities/snack/model/getBySlugOrId";
import { snackMetadata } from "@shared/lib/seo/snackSeo";
import { notFound } from "next/navigation";

export async function generateMetadata({ params }) {
  const { slug: raw } = await params;
  const slug = decodeURIComponent(String(raw)).normalize("NFC").toLowerCase();
  const { snack, avg } = await getBySlugOrId(slug);
  if (snack) return snackMetadata(snack, avg);
  return { title: "SnackDB" };
}

export default async function Page({ params, searchParams }) {
  const { slug: raw } = await params;
  const slug = decodeURIComponent(String(raw)).normalize("NFC").toLowerCase();
  const sp = (await searchParams) || {};
  const preview = sp.preview != null && sp.preview !== "0" && sp.preview !== "false";

  // ✅ 관리자 미리보기 라우트는 유지(SEO/권한 분리)
  if (preview) return <AdminPreview slug={slug} />;

  // ✅ 공개 상세: 데이터만 조회 → 공통 뷰로 렌더
  const { snack, avg, flavors, keywords } = await getBySlugOrId(slug);
  if (!snack) return notFound();

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
