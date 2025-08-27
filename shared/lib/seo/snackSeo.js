// shared/lib/seo/snackSeo.js
import { STAT_SLASH } from "@shared/lib/statLabels";

function siteUrl() {
  return process.env.NEXT_PUBLIC_SITE_URL || "http://localhost:3000";
}

export function snackTitle(snack) {
  return `${snack.brand ? snack.brand + " " : ""}${snack.name} | SnackDB`;
}

export function snackDescription(snack) {
  return `${snack.brand || ""} ${snack.name}의 ${STAT_SLASH} 평가와 한줄평.`.trim();
}

export function snackImageUrl(snack) {
  if (!snack?.image_path) return undefined;
  return `${siteUrl()}/api/images/snack?path=${encodeURIComponent(snack.image_path)}`;
}

export function snackCanonical(snack) {
  return `${siteUrl()}/snacks/${encodeURIComponent(snack.slug)}`;
}

/** Next.js generateMetadata 반환 형태 */
export function snackMetadata(snack, avg) {
  const title = snackTitle(snack);
  const description = snackDescription(snack);
  const image = snackImageUrl(snack);
  const canonical = snackCanonical(snack);

  return {
    title,
    description,
    alternates: { canonical },
    openGraph: { title, description, images: image ? [image] : [] },
    twitter: { card: "summary_large_image", title, description, images: image ? [image] : [] },
  };
}

/** JSON-LD (Product + AggregateRating) */
export function snackJsonLd(snack, avg) {
  const img = snackImageUrl(snack);
  const base = {
    "@context": "https://schema.org",
    "@type": "Product",
    name: snack.name,
    brand: snack.brand || undefined,
    image: img || undefined,
  };
  if (avg) {
    const score =
      (avg.tasty + avg.value + avg.plenty + avg.clean + avg.addictive) / 5;
    base.aggregateRating = {
      "@type": "AggregateRating",
      ratingValue: Number.isFinite(score) ? score.toFixed(1) : undefined,
      reviewCount: avg.count,
    };
  }
  return base;
}
