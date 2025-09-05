// app/search/page.js
"use client";

import { useSearchParams } from "next/navigation";
import styles from "./page.module.css";
import { useSearchSnacks } from "@features/search/model/useSearchSnacks";
import SearchResults from "@features/search/ui/SearchResults";

const PAGE_SIZE = 20;

export default function SearchPage() {
  const sp = useSearchParams();
  const term = sp.get("q") ?? "";
  const page = Number(sp.get("page") ?? "1") || 1;
  const op = ((sp.get("op") ?? "and").toLowerCase() === "or") ? "or" : "and";
  const rawSort = (sp.get("sort") ?? "relevance").toLowerCase();
  const sort = ["name", "recent", "views"].includes(rawSort) ? "relevance" : rawSort;
  const order = (sp.get("order") ?? "desc").toLowerCase(); // asc|desc

  const { loading, items, totalPages, avgMap, likesMap, likedSet } =
    useSearchSnacks({ term, page, pageSize: PAGE_SIZE, operator: op, sort, order });


  return (
    <section className={styles.wrap}>
      <div className={styles.head}>
        <h1>검색 결과</h1>
        {term && <p>검색어: <strong>{term}</strong></p>}
      </div>

      {loading ? (
        <div className={styles.empty}>불러오는 중…</div>
      ) : (
        <SearchResults 
        term={term} 
        page={page} 
        totalPages={totalPages} 
        items={items}
        avgMap={avgMap} 
        likesMap={likesMap} 
        likedSet={likedSet} 
        sort={sort}
        order={order}
        />
      )}
    </section>
  );
}
