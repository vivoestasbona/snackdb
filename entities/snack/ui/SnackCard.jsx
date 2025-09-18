// entities/snack/ui/SnackCard.jsx
"use client";
import LikeButton from "@features/like-snack/ui/LikeButton";
import styles from "@app/search/page.module.css"; // 기존 카드 스타일 재사용

export default function SnackCard({ item, avg, liked, likeCount, term, page }) {
  return (
    <div className={styles.card}>
      <a
        href={`/snacks/${encodeURIComponent(item.slug)}?q=${encodeURIComponent(term || "")}&page=${page || 1}`}
        className={styles.hitArea}
      >
        {item.image_path && (
          <div className={styles.image}>
            <img
              src={`/api/images/snack?path=${encodeURIComponent(item.image_path)}`}
              alt={item.name}
              loading="lazy"
              decoding="async"
              onError={(e) => {
                e.currentTarget.onerror = null;
                e.currentTarget.src =
                  "data:image/svg+xml;utf8,<svg xmlns='http://www.w3.org/2000/svg'/>";
              }}
            />
          </div>
        )}

        <header className={styles.header}>
          <div className={styles.title} title={item.name}>{item.name}</div>
          {item.brand && (
            <div className={styles.brandLine} title={item.brand}>{item.brand}</div>
          )}
        </header>

      </a>

      <div className={styles.metrics}>
        <span className={styles.avg}>{avg ?? "-"}</span>
        <LikeButton
          snackId={item.id}
          initialCount={likeCount || 0}
          initiallyLiked={!!liked}
        />
      </div>
    </div>
  );
}
