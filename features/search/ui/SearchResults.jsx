// features/search/ui/SearchResults.jsx
"use client";
import SnackCard from "@entities/snack/ui/SnackCard";
import styles from "@app/search/page.module.css";
import { useRouter } from "next/navigation";

export default function SearchResults({
  term, page, totalPages, items, avgMap, likesMap, likedSet, op = "and",
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

      <div className={styles.pager}>
        {page > 1 && <a href={makeHref(page - 1)}>이전</a>}
        <span>{page} / {totalPages}</span>
        {page < totalPages && <a href={makeHref(page + 1)}>다음</a>}
      </div>
    </>
  );
}
