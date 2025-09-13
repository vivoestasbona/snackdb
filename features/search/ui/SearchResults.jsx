// features/search/ui/SearchResults.jsx
"use client";
import SnackCard from "@entities/snack/ui/SnackCard";
import styles from "@app/search/page.module.css";
import { useRouter } from "next/navigation";

export default function SearchResults({
  term, page, totalPages, items, avgMap, likesMap, likedSet, op,
  sort = "relevance", order = "desc",
}) {
  const router = useRouter();

   if (!items?.length) {
    return <div className={styles.empty}>검색 결과가 없습니다.</div>;
  }

  // op(and|or)를 항상 보존하는 헬퍼
  const makeHref = (p) =>
    `/search?q=${encodeURIComponent(term || "")}&page=${p}&op=${op === "or" ? "or" : "and"}&sort=${encodeURIComponent(sort)}&order=${order}`;

  function onChangeSort(e) {
    const v = e.target.value; // relevance|likes|avg|tasty|value|plenty|clean|addictive|comments
    const url = `/search?q=${encodeURIComponent(term || "")}&page=1&op=${op}&sort=${encodeURIComponent(v)}&order=${order}`;
    router.push(url);
  }

  function toggleOrder() {
    const newOrder = order === "desc" ? "asc" : "desc";
    const url = `/search?q=${encodeURIComponent(term || "")}&page=1&op=${op}&sort=${encodeURIComponent(sort)}&order=${newOrder}`;
    router.push(url);
  }

  function getPageItems(current, total, { boundaryCount = 1, siblingCount = 1 } = {}) {
    const range = (s, e) => Array.from({ length: e - s + 1 }, (_, i) => s + i);
    const first = range(1, Math.min(boundaryCount, total));
    const last = total > boundaryCount ? range(Math.max(total - boundaryCount + 1, 1), total) : [];
    const start = Math.max(
      Math.min(current - siblingCount, total - boundaryCount - siblingCount * 2 - 1),
      boundaryCount + 1
    );
    const end = Math.min(
      Math.max(current + siblingCount, boundaryCount + siblingCount * 2 + 2),
      last.length ? last[0] - 1 : total
    );

    const middle = total <= boundaryCount * 2 + siblingCount * 2 + 2
      ? range(boundaryCount + 1, total - boundaryCount)
      : range(start, end);

    const items = [];
    // first
    items.push(...first);
    // left dots
    if (middle.length && first.length && middle[0] > first[first.length - 1] + 1) items.push('dots-left');
    // middle
    items.push(...middle);
    // right dots
    if (middle.length && last.length && last[0] > middle[middle.length - 1] + 1) items.push('dots-right');
    // last
    items.push(...last);
    return items;
  }

  const pages = getPageItems(page, totalPages, { boundaryCount: 1, siblingCount: 2 });

  return (
    <>
      <div className={styles.toolbarRight}>
        <label>
          정렬:&nbsp;
          <select value={sort} onChange={onChangeSort}>
            <option value="relevance">정확도순</option>
            <option value="likes">좋아요순</option>
            <option value="comments">한줄평 많은 순</option>
            <option value="avg">전체 평균 점수순</option>
            <option value="tasty">맛 점수순</option>
            <option value="value">가격 만족도 점수순</option>
            <option value="plenty">양 만족도 점수순</option>
            <option value="clean">깔끔함 점수순</option>
            <option value="addictive">중독성 점수순</option>
          </select>
        </label>
        
        <button className={styles.orderBtn} onClick={toggleOrder}>
          {order === "desc" ? "↓" : "↑"}
        </button>
      </div>

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

      <nav className={styles.pagerNav} aria-label="검색 결과 페이지">
        <ul className={styles.pagerList}>
          {/* 처음/이전 */}
          <li className={`${styles.pagerItem} ${page === 1 ? styles.isDisabled : ""} ${styles.isBoundary}`}>
            <a aria-label="첫 페이지" href={page === 1 ? undefined : makeHref(1)} tabIndex={page === 1 ? -1 : 0}>«</a>
          </li>
          <li className={`${styles.pagerItem} ${page === 1 ? styles.isDisabled : ""}`}>
            <a aria-label="이전 페이지" href={page === 1 ? undefined : makeHref(page - 1)} tabIndex={page === 1 ? -1 : 0}>‹</a>
          </li>

          {/* 번호 + … */}
          {pages.map((p, i) => {
            if (p === 'dots-left' || p === 'dots-right') {
              return <li key={`d-${i}`} className={`${styles.pagerItem} ${styles.isDots}`} aria-hidden>…</li>;
            }
            const isActive = p === page;
            return (
              <li key={p} className={`${styles.pagerItem} ${isActive ? styles.isActive : ""}`}>
                {isActive ? (
                  <span aria-current="page">{p}</span>
                ) : (
                  <a href={makeHref(p)} aria-label={`${p} 페이지`}>{p}</a>
                )}
              </li>
            );
          })}

          {/* 다음/마지막 */}
          <li className={`${styles.pagerItem} ${page === totalPages ? styles.isDisabled : ""}`}>
            <a aria-label="다음 페이지" href={page === totalPages ? undefined : makeHref(page + 1)} tabIndex={page === totalPages ? -1 : 0}>›</a>
          </li>
          <li className={`${styles.pagerItem} ${page === totalPages ? styles.isDisabled : ""} ${styles.isBoundary}`}>
            <a aria-label="마지막 페이지" href={page === totalPages ? undefined : makeHref(totalPages)} tabIndex={page === totalPages ? -1 : 0}>»</a>
          </li>
        </ul>
      </nav>
    </>
  );
}
