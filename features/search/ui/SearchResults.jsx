// features/search/ui/SearchResults.jsx
"use client";
import SnackCard from "@entities/snack/ui/SnackCard";
import styles from "@app/search/page.module.css";

export default function SearchResults({ term, page, totalPages, items, avgMap, likesMap, likedSet }) {
  if (!items?.length) {
    return <div className={styles.empty}>검색 결과가 없습니다.</div>;
  }

  return (
    <>
      <div className={styles.grid}>
        {items.map((it) => (
          <SnackCard
            key={it.id}
            item={it}
            avg={avgMap[it.id]}
            likeCount={likesMap[it.id]}
            liked={likedSet?.has(it.id)}
            term={term}
            page={page}
          />
        ))}
      </div>

      <div className={styles.pager}>
        {page > 1 && (
          <a href={`/search?q=${encodeURIComponent(term || "")}&page=${page - 1}`}>이전</a>
        )}
        <span>{page} / {totalPages}</span>
        {page < totalPages && (
          <a href={`/search?q=${encodeURIComponent(term || "")}&page=${page + 1}`}>다음</a>
        )}
      </div>
    </>
  );
}
