// app/search/page.js
"use client";

import { useEffect, useMemo, useState } from "react";
import { useSearchParams, useRouter } from "next/navigation";
import Link from "next/link";
import { getSupabaseClient } from "@shared/api/supabaseClient";
import { promptLogin } from "@entities/user/model/loginPrompt";

const PAGE_SIZE = 20;

export default function PublicSearchPage() {
  const router = useRouter();
  const params = useSearchParams();
  const q = params.get("q") || "";
  const page = Number(params.get("page") || 1);

  const [items, setItems] = useState([]);
  const [count, setCount] = useState(null);
  const [loading, setLoading] = useState(true);

  // 지표 상태(현재 페이지 한정)
  const [likesMap, setLikesMap] = useState({});      // { snackId: number }
  const [likedSet, setLikedSet] = useState(new Set()); // Set<snackId> (내가 좋아요)
  const [avgMap, setAvgMap] = useState({});          // { snackId: number|null }
  const [liking, setLiking]   = useState(null);

  const term = useMemo(() => q.trim(), [q]);

  useEffect(() => {
    let mounted = true;
    const client = getSupabaseClient();

    (async () => {
      setLoading(true);

      // 1) 공개 스낵 목록 (slug 포함)
      let query = client
        .from("snacks")
        .select("id,name,brand,image_path,slug,created_at", { count: "exact" });

      if (term) {
        const like = `%${term}%`;
        query = query.or(`name.ilike.${like},brand.ilike.${like},slug.ilike.${like}`);
      }

      query = query
        .eq("is_public", true)
        .order("created_at", { ascending: false })
        .range((page - 1) * PAGE_SIZE, page * PAGE_SIZE - 1);

      const { data, error, count: total } = await query;
      if (!mounted) return;

      if (error) {
        console.error("search load error", error?.message || error, error);
        setItems([]);
        setCount(0);
        setLikesMap({});
        setLikedSet(new Set());
        setAvgMap({});
        setLoading(false);
        return;
      }

      const mapped = (data || []).map((it) => ({
        ...it,
        imageUrl: it.image_path
          ? `/api/images/snack?path=${encodeURIComponent(it.image_path)}`
          : null,
      }));

      setItems(mapped);
      setCount(total ?? 0);

      // 2) 지표(좋아요 수/내가 좋아요, 평균 점수) – 현재 페이지 id만
      const ids = mapped.map((x) => x.id);
      if (ids.length === 0) {
        setLikesMap({}); setLikedSet(new Set()); setAvgMap({});
        setLoading(false);
        return;
      }

      // 2-1) 좋아요 집계 + 내가 좋아요
      const [{ data: sess }, { data: likeRows, error: likeErr }] = await Promise.all([
        client.auth.getSession(),
        client.from("snack_likes")
          .select("snack_id,user_id")
          .in("snack_id", ids)
      ]);

      if (!mounted) return;

      const lm = {};
      let mySet = new Set();
      if (!likeErr && likeRows?.length) {
        for (const r of likeRows) {
          lm[r.snack_id] = (lm[r.snack_id] || 0) + 1;
        }
        const uid = sess?.session?.user?.id || null;
        if (uid) {
          mySet = new Set(likeRows.filter(r => r.user_id === uid).map(r => r.snack_id));
        }
      }
      setLikesMap(lm);
      setLikedSet(mySet);

      // 2-2) 평균 점수 집계
      const { data: scoreRows, error: scoreErr } = await client
        .from("snack_scores")
        .select("snack_id,tasty,value,plenty,clean,addictive")
        .in("snack_id", ids);

      if (!mounted) return;

      const am = {};
      if (!scoreErr && scoreRows?.length) {
        const sum5 = {};
        const cnt = {};
        for (const r of scoreRows) {
          sum5[r.snack_id] = (sum5[r.snack_id] || 0) + (r.tasty + r.value + r.plenty + r.clean + r.addictive);
          cnt[r.snack_id] = (cnt[r.snack_id] || 0) + 1;
        }
        for (const id of Object.keys(sum5)) {
          am[id] = +(sum5[id] / (5 * cnt[id])).toFixed(1);
        }
      }
      setAvgMap(am);

      setLoading(false);
    })();

    return () => {
      mounted = false;
    };
  }, [term, page]);

  const totalPages = Math.max(1, Math.ceil((count ?? 0) / PAGE_SIZE));

  // 좋아요 토글 (검색 카드에서 즉시)
  async function toggleLike(e, snackId) {
    // 카드 링크 이동 방지
    e?.preventDefault?.();
    e?.stopPropagation?.();

    // 연타 방지: 같은 항목 처리 중이면 무시
    if (liking === snackId) return;
    setLiking(snackId);

    const sb = getSupabaseClient();
    const { data: sess } = await sb.auth.getSession();
    const uid = sess?.session?.user?.id;

    if (!uid) {
      promptLogin({ reason: "좋아요를 누르려면 로그인해주세요", from: "search:like", snackId });
      setLiking(null);
      return;
    }

    // 낙관적 업데이트
    const currentlyLiked = likedSet.has(snackId);
    const rollback = () => {
      // likedSet 롤백
      setLikedSet((prev) => {
        const next = new Set(prev);
        if (currentlyLiked) next.add(snackId);
        else next.delete(snackId);
        return next;
      });
      // likesMap 롤백
      setLikesMap((m) => ({
        ...m,
        [snackId]: Math.max(0, (m[snackId] || 0) + (currentlyLiked ? 1 : -1)),
      }));
    };

    // 낙관적 적용
    setLikedSet((prev) => {
      const next = new Set(prev);
      if (currentlyLiked) next.delete(snackId);
      else next.add(snackId);
      return next;
    });
    setLikesMap((m) => ({
      ...m,
      [snackId]: Math.max(0, (m[snackId] || 0) + (currentlyLiked ? -1 : 1)),
    }));

    try {
      if (currentlyLiked) {
        const { error } = await sb
          .from("snack_likes")
          .delete()
          .eq("snack_id", snackId)
          .eq("user_id", uid);
        if (error) {
          console.error("unlike error", error?.message || error, error);
          rollback();
        }
      } else {
        const { error } = await sb
          .from("snack_likes")
          .insert({ snack_id: snackId, user_id: uid });
        if (error) {
          console.error("like error", error?.message || error, error);
          rollback();
        }
      }
    } finally {
      setLiking(null);
    }
  }

  return (
    <section className="wrap">
      <div className="head">
        <h1>검색 결과</h1>
      </div>

      <div className="grid">
        {loading ? (
          <div className="skeleton">불러오는 중…</div>
        ) : items.length === 0 ? (
          <div className="empty">검색 결과가 없습니다.</div>
        ) : (
          items.map((it) => {
            const count = likesMap[it.id] || 0;
            const liked = likedSet.has(it.id);
            const avg = avgMap[it.id] ?? "-";
            return (
              <Link
                key={it.id}
                href={`/snacks/${encodeURIComponent(it.slug)}?q=${encodeURIComponent(q)}&page=${page}`}
                className="card"
                aria-label={`${it.name} 상세`}
              >
                {it.imageUrl && (
                  <div className="image">
                    <img src={it.imageUrl} alt={it.name} />
                  </div>
                )}
                <header>
                  <strong>{it.name}</strong>
                  {it.brand && <span className="brand">{it.brand}</span>}
                </header>

                {/* ❤️ + 평균 → 카드 우하단 */}
                <div className="metrics" title="좋아요 · 평균 점수">
                  <span className="avg">{avg}</span>
                  <button
                    type="button"
                    className={`pill like ${liked ? "on" : ""}`}
                    onClick={(e) => toggleLike(e, it.id)}
                    aria-pressed={liked}
                    data-busy={liking === it.id}
                    aria-label={`좋아요 ${count}개`}
                  >
                    ❤️ {count}
                  </button>
                </div>
              </Link>
            );
          })
        )}
      </div>

      <div className="pager">
        <button
          disabled={page <= 1}
          onClick={() =>
            router.replace(`/search?q=${encodeURIComponent(q)}&page=${page - 1}`)
          }
        >
          이전
        </button>
        <span>
          {page} / {totalPages}
        </span>
        <button
          disabled={page >= totalPages}
          onClick={() =>
            router.replace(`/search?q=${encodeURIComponent(q)}&page=${page + 1}`)
          }
        >
          다음
        </button>
      </div>

      <style jsx>{`
        .wrap { max-width: 1100px; margin:0 auto; padding:16px; }
        .head { display:flex; flex-direction:column; align-items:center; gap:10px; margin-bottom:12px; }
        h1 { margin:0; font-size:22px; text-align:center; }

        .grid {
          display: grid;
          grid-template-columns: repeat(auto-fill, minmax(240px, 280px));
          gap: 12px;
          justify-content: center;
        }
        :global(a.card) {
          position: relative; /* metrics 배치용 */
          display: grid;
          gap: 8px;
          border: 1px solid #eee;
          border-radius: 12px;
          padding: 12px;
          background: #fff;
          text-decoration: none !important;
          color: inherit !important;
          transition: background .15s ease, box-shadow .15s ease;
          cursor: pointer;
          max-width: 280px;
        }
        :global(a.card:hover) {
          background: #fafafa;
          box-shadow: 0 4px 12px rgba(0,0,0,.04);
        }
        .image {
          width: 100%;
          height: 160px;
          overflow: hidden;
          border-radius: 8px;
          border: 1px solid #eee;
          margin-bottom: 8px;
        }
        .image img {
          width: 100%;
          height: 100%;
          display: block;
          object-fit: cover;
        }
        header { display:flex; gap:8px; align-items:center; }
        .brand { color:#666; font-size:13px; }

        /* ❤️ + 평균 */
        .metrics {
          position: absolute;
          right: 12px;
          bottom: 12px;
          display: inline-flex;
          align-items: center;
          gap: 8px;
        }
        .pill {
          border: 1px solid #ddd;
          background: #fff;
          border-radius: 999px;
          padding: 4px 10px;
          font-size: 13px;
        }
        .metrics .pill.like { padding: 6px 12px; min-width: 44px; } /* 44px 터치 가이드 */
        .pill.like.on {
          border-color: #f3a1a1;
          background: #fff5f6;
        }
        .pill.like[data-busy="true"] {
          pointer-events: none;
          cursor: wait;
        }
        .avg { font-weight: 600; min-width: 2.2em; text-align: right; }

        .pager { margin-top:12px; display:flex; gap:10px; align-items:center; justify-content:center; }

        .skeleton, .empty { color:#777; padding:24px; text-align:center; }
      `}</style>
    </section>
  );
}
