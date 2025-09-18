// features/search/ui/SearchResults.jsx
"use client";
import SnackCard from "@entities/snack/ui/SnackCard";
import styles from "@app/search/page.module.css";
import { useRouter } from "next/navigation";
import Pager from "@shared/ui/Pager";

export default function SearchResults({
  term, page, totalPages, items, avgMap, likesMap, likedSet, op,
  sort = "relevance", order = "desc",
}) {
  const router = useRouter();

  if (!items?.length) {
    return <div className={styles.empty}>검색 결과가 없습니다.</div>;
  }

  // op(and|or) 유지 + 기본값은 쿼리스트링에서 생략
  const makeHref = (p) => {
    const usp = new URLSearchParams();
    if (term) usp.set("q", term);
    usp.set("page", String(p));
    if (op && op !== "and") usp.set("op", op);
    if (sort && sort !== "relevance") usp.set("sort", sort);
    if (order && order !== "desc") usp.set("order", order);
    return `/search?${usp.toString()}`;
  };

  function onChangeSort(e) {
    const v = e.target.value;
    const usp = new URLSearchParams();
    if (term) usp.set("q", term);
    usp.set("page", "1");
    if (op && op !== "and") usp.set("op", op);
    if (v && v !== "relevance") usp.set("sort", v);
    if (order && order !== "desc") usp.set("order", order);
    router.push(`/search?${usp.toString()}`);
  }

  function toggleOrder() {
    const newOrder = order === "desc" ? "asc" : "desc";
    const usp = new URLSearchParams();
    if (term) usp.set("q", term);
    usp.set("page", "1");
    if (op && op !== "and") usp.set("op", op);
    if (sort && sort !== "relevance") usp.set("sort", sort);
    if (newOrder && newOrder !== "desc") usp.set("order", newOrder);
    router.push(`/search?${usp.toString()}`);
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

      <Pager page={page} totalPages={totalPages} makeHref={makeHref} />
    </>
  );
}
