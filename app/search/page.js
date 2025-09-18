// app/search/page.js
"use client";

import { useSearchParams } from "next/navigation";
import styles from "./page.module.css";
import { useSearchSnacks } from "@features/search/model/useSearchSnacks";
import SearchResults from "@features/search/ui/SearchResults";

const PAGE_SIZE = 24;

export default function SearchPage() {
  const sp = useSearchParams();
  const term = sp.get("q") ?? "";
  const page = Number(sp.get("page") ?? "1") || 1;
  const op = ((sp.get("op") ?? "and").toLowerCase() === "or") ? "or" : "and";
  const rawSort = (sp.get("sort") ?? "relevance").toLowerCase();
  const order = (sp.get("order") ?? "desc").toLowerCase() === "asc" ? "asc" : "desc";
  const sort = ["relevance","likes","avg","tasty","value","plenty","clean","addictive","comments"].includes(rawSort)
    ? rawSort : "relevance";

  console.log("[DBG] /search params", { op, term, page, sort, order });

  const { loading, items, total, avgMap, likesMap, likedSet } = useSearchSnacks({
    term, page, pageSize: PAGE_SIZE, operator: op, sort, order
  });

  const totalPages = Math.max(1, Math.ceil((total || 0) / PAGE_SIZE));

  return (
    <section className={styles.search}>
      {loading ? (
        <div className={styles.loading}>Loading…</div>
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
          op={op}
        />
      )}
    </section>
  );
}
