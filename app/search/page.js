// app/search/page.js
"use client";

import { useEffect, useState } from "react";
import { useSearchParams } from "next/navigation";
import { getSupabaseClient } from "@shared/api/supabaseClient";
import LikeButton from "@features/like-snack/ui/LikeButton";
import styles from "./page.module.css";

const PAGE_SIZE = 20;

export default function SearchPage() {
  const sp = useSearchParams();                // ✅ Next 15 권장 방식
  const term = sp.get("q") ?? "";
  const page = Number(sp.get("page") ?? "1") || 1;

  const [items, setItems] = useState([]);
  const [likesMap, setLikesMap] = useState({});
  const [likedSet, setLikedSet] = useState(new Set());
  const [avgMap, setAvgMap] = useState({});
  const [totalPages, setTotalPages] = useState(1);

  useEffect(() => {
    let mounted = true;
    const client = getSupabaseClient();

    async function load() {
      // 1) snacks 목록
      let query = client
        .from("snacks")
        .select("id,name,brand,slug,image_path", { count: "exact" })
        .eq("is_public", true)
        .order("created_at", { ascending: false })
        .range((page - 1) * PAGE_SIZE, page * PAGE_SIZE - 1);

      if (term) {
        const like = `%${term}%`;
        query = query.or(`name.ilike.${like},brand.ilike.${like},slug.ilike.${like}`);
      }

      const { data, error, count: total } = await query;
      if (error) {
        console.error(error);
        return;
      }

      if (!mounted) return;
      setItems(data);
      setTotalPages(Math.max(1, Math.ceil((total || 0) / PAGE_SIZE)));

      if (!data?.length) return;
      const ids = data.map((s) => s.id);

      // 2) 좋아요 집계 + 내 좋아요
      const [{ data: sess }, { data: likeAgg, error: likeErr }, { data: myLikes, error: myLikeErr }] = await Promise.all([
        client.auth.getSession(),
        client.from("snack_likes_count").select("snack_id,likes_count").in("snack_id", ids),
        client.from("snack_likes").select("snack_id").in("snack_id", ids),
      ]);

      const lm = {};
      if (!likeErr && likeAgg?.length) {
        for (const r of likeAgg) {
          lm[r.snack_id] = r.likes_count || 0;
        }
      }
      const uid = sess?.session?.user?.id || null;
      const mySet = new Set(
        uid && !myLikeErr && myLikes?.length ? myLikes.map((r) => r.snack_id) : []
      );

      if (mounted) {
        setLikesMap(lm);
        setLikedSet(mySet);
      }

      // 3) 평균 점수 집계
      const { data: scoreAgg, error: scoreErr } = await client
        .from("snack_scores_avg")
        .select("snack_id,avg_tasty,avg_value,avg_plenty,avg_clean,avg_addictive,review_count")
        .in("snack_id", ids);

      const am = {};
      if (!scoreErr && scoreAgg?.length) {
        for (const r of scoreAgg) {
          const c = Number(r.review_count) || 0;
          if (c > 0) {
            const mean =
              ((Number(r.avg_tasty) || 0) +
                (Number(r.avg_value) || 0) +
                (Number(r.avg_plenty) || 0) +
                (Number(r.avg_clean) || 0) +
                (Number(r.avg_addictive) || 0)) /
              5;
            am[r.snack_id] = Number.isFinite(mean) ? +mean.toFixed(1) : undefined;
          }
        }
      }

      if (mounted) setAvgMap(am);
    }

    load();
    return () => {
      mounted = false;
    };
  }, [term, page]);

  return (
    <section className={styles.wrap}>
      <div className={styles.head}>
        <h1>검색 결과</h1>
        {term && (
          <p>
            검색어: <strong>{term}</strong>
          </p>
        )}
      </div>

      {items.length === 0 ? (
        <div className={styles.empty}>검색 결과가 없습니다.</div>
      ) : (
        <div className={styles.grid}>
          {items.map((it) => (
            <div key={it.id} className={styles.card}>
              <a href={`/snacks/${encodeURIComponent(it.slug)}?q=${encodeURIComponent(term)}&page=${page}`} className={styles.hitArea}>
                {it.image_path && (
                  <div className={styles.image}>
                    <img
                      src={`/api/images/snack?path=${encodeURIComponent(it.image_path)}`}
                      alt={it.name}
                      loading="lazy"
                      decoding="async"
                      onError={(e) => {
                        e.currentTarget.src = "/img/placeholder.png";
                      }}
                    />
                  </div>
                )}
                <header className={styles.header}>
                  <strong>{it.name}</strong>
                  {it.brand && <span className={styles.brand}>{it.brand}</span>}
                </header>
              </a>
              <div className={styles.metrics}>
                <span className={styles.avg}>{avgMap[it.id] ?? "-"}</span>
                <LikeButton
                  snackId={it.id}
                  initialCount={likesMap[it.id] || 0}
                  initiallyLiked={likedSet.has(it.id)}
                />
              </div>
            </div>
          ))}
        </div>
      )}

      <div className={styles.pager}>
        {page > 1 && (
          <a href={`/search?q=${encodeURIComponent(term)}&page=${page - 1}`}>이전</a>
        )}
        <span>
          {page} / {totalPages}
        </span>
        {page < totalPages && (
          <a href={`/search?q=${encodeURIComponent(term)}&page=${page + 1}`}>다음</a>
        )}
      </div>
    </section>
  );
}
