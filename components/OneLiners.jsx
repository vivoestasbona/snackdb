// components/OneLiners.jsx
"use client";
import { useEffect, useState, useCallback } from "react";
import { getSupabaseClient } from "@/lib/supabaseClient";
import ReviewLikeButton from "./ReviewLikeButton";
import ReviewControls from "./ReviewControls"; //  헤더에 배치할 버튼

const PAGE_SIZE = 7;
const FETCH_LIMIT = 70;

export default function OneLiners({ snackId }) {
  const sb = getSupabaseClient();

  const [uid, setUid] = useState(null);
  const [mine, setMine] = useState(null);
  const [rows, setRows] = useState([]);
  const [nickMap, setNickMap] = useState({});
  const [likesMap, setLikesMap] = useState({});
  const [likedMap, setLikedMap] = useState({});
  const [page, setPage] = useState(0);

  const load = useCallback(async () => {
    const { data: sess } = await sb.auth.getSession();
    const my = sess?.session?.user?.id || null;
    setUid(my);

    // 내 최신 한줄평 1건
    let myRow = null;
    if (my) {
      const { data: myRes } = await sb
        .from("snack_reviews")
        .select("id, body, created_at, user_id")
        .eq("snack_id", snackId)
        .eq("user_id", my)
        .order("created_at", { ascending: false })
        .limit(1)
        .maybeSingle();
      myRow = myRes || null;
    }
    setMine(myRow);

    // 다른 사람 한줄평
    let q = sb
      .from("snack_reviews")
      .select("id, body, created_at, user_id")
      .eq("snack_id", snackId)
      .order("created_at", { ascending: false })
      .limit(FETCH_LIMIT);
    if (myRow?.user_id) q = q.neq("user_id", myRow.user_id);

    const { data: others, error: errOthers } = await q;
    const list = errOthers ? [] : (others || []);
    setRows(list);
    setPage(0);

    // 표시 이름(profile_public)
    const userIds = [
      ...(myRow?.user_id ? [myRow.user_id] : []),
      ...Array.from(new Set(list.map((r) => r.user_id))),
    ];
    if (userIds.length > 0) {
      const { data: profs } = await sb
        .from("profile_public")
        .select("id, display_name")
        .in("id", userIds);
      const nm = {};
      profs?.forEach((p) => { nm[p.id] = p.display_name || "익명"; });
      setNickMap(nm);
    } else {
      setNickMap({});
    }

    // 좋아요 상태/카운트
    const reviewIds = [
      ...(myRow?.id ? [myRow.id] : []),
      ...list.map((r) => r.id),
    ];
    if (reviewIds.length > 0) {
      const { data: likesRows } = await sb
        .from("snack_review_likes")
        .select("review_id, user_id")
        .in("review_id", reviewIds);

      const countMap = {};
      const liked = {};
      likesRows?.forEach((row) => {
        countMap[row.review_id] = (countMap[row.review_id] || 0) + 1;
        if (my && row.user_id === my) liked[row.review_id] = true;
      });
      setLikesMap(countMap);
      setLikedMap(liked);
    } else {
      setLikesMap({});
      setLikedMap({});
    }
  }, [sb, snackId]);

  //  로그인/로그아웃 변화에 즉시 반응
  useEffect(() => {
    const { data: sub } = sb.auth.onAuthStateChange((_ev, session) => {
      if (!session) {
        // 막 로그아웃됨 → 표시만 먼저 정리
        setUid(null);
        setMine(null);
        setLikedMap({});
        // 그리고 목록/프로필/좋아요 집계 재조회
        load();
      } else {
        // 로그인됨 → 내 리뷰/좋아요 상태 포함해 다시 로드
        setUid(session.user.id);
        load();
      }
    });
    return () => sub?.subscription?.unsubscribe?.();
  }, [sb, load]);

  useEffect(() => {
    load();
    const handler = (e) => { if (e.detail?.snackId === snackId) load(); };
    window.addEventListener("snack:review-updated", handler);
    return () => window.removeEventListener("snack:review-updated", handler);
  }, [load, snackId]);

  // 페이지 계산
  const total = rows.length;
  const totalPages = Math.max(1, Math.ceil(total / PAGE_SIZE));
  const start = page * PAGE_SIZE;
  const visible = rows.slice(start, start + PAGE_SIZE);
  const canPrev = page > 0;
  const canNext = page < totalPages - 1;

  return (
    <div className="wrap">
      {/*  제목 좌측 / 버튼 우측 */}
      <div className="head">
        <h3>한줄평</h3>
        <div className="headActions">
          <ReviewControls snackId={snackId} />
        </div>
      </div>

      <div className="rows">
        {/* 내 한줄평 (은은한 단색 강조, 추천 버튼 없음) */}
        {mine && (
          <div className="row mine">
            <div className="author">{nickMap[mine.user_id] || "나"}</div>
            <div className="body">
              <p>{mine.body}</p>
            </div>
            <div className="actions">
              <ReviewLikeButton
                snackId={snackId}
                reviewId={mine.id}
                initialCount={likesMap[mine.id] || 0}
                initialLiked={!!likedMap[mine.id]}
                disabled={true}   // 내 글은 누를 수 없지만, 개수/상태는 보임
              />
            </div>
          </div>
        )}

        {/* 다른 사용자 한줄평 */}
        {(!rows || rows.length === 0) && !mine ? (
          <p className="empty">아직 한줄평이 없습니다.</p>
        ) : (
          <ul className="ul">
            {visible.map((r) => (
              <li key={r.id} className="row">
                <div className="author">{nickMap[r.user_id] || "익명"}</div>
                <div className="body">
                  <p>{r.body}</p>
                </div>
                <div className="actions">
                  {uid !== r.user_id && (
                    <ReviewLikeButton
                      snackId={snackId}
                      reviewId={r.id}
                      initialCount={likesMap[r.id] || 0}
                      initialLiked={!!likedMap[r.id]}
                    />
                  )}
                </div>
              </li>
            ))}
          </ul>
        )}
      </div>

      {/* 항상 보이는 페이저 */}
      <div className="pager" role="navigation" aria-label="한줄평 페이지 이동">
        <button
          className="arrow"
          onClick={() => setPage(0)}
          disabled={!canPrev}
          aria-label="처음으로"
        >
          «
        </button>
        <button
          className="arrow"
          onClick={() => setPage((p) => Math.max(0, p - 1))}
          disabled={!canPrev}
          aria-label="이전"
        >
          ‹
        </button>
        <span className="pageinfo">{Math.min(page + 1, totalPages)} / {totalPages}</span>
        <button
          className="arrow"
          onClick={() => setPage((p) => Math.min(totalPages - 1, p + 1))}
          disabled={!canNext}
          aria-label="다음"
        >
          ›
        </button>
        <button
          className="arrow"
          onClick={() => setPage(totalPages - 1)}
          disabled={!canNext}
          aria-label="끝으로"
        >
          »
        </button>
      </div>

      <style jsx>{`
        .wrap { margin-top:12px; }

        /*  헤더: 제목/버튼 좌우 배치 */
        .head {
          display:flex; align-items:center; justify-content:space-between;
          gap:12px; margin-bottom:8px;
        }
        .head h3 { margin:0; font-size:18px; }
        /* 버튼이 너무 커 보이면 살짝 줄이는 선택 스타일 */
        .headActions :global(button) { padding:6px 10px; }

        .empty { color:#666; }

        /* 가로선으로만 구분 */
        .rows { border-top:1px solid #eee; }
        .ul { list-style:none; margin:0; padding:0; }
        .row {
          display:flex; gap:10px; align-items:flex-start;
          padding:10px 0; border-bottom:1px solid #eee;
        }

        /* 닉네임: 굵게 X, 회색 */
        .author {
          min-width:72px; max-width:140px;
          color:#777; font-weight:400;
          word-break:break-word;
        }

        .body { flex:1; }
        .body p { margin:0; white-space:pre-wrap; }

        /* 내 한줄평: 은은한 단색 강조 */
        .mine { background: rgba(11,87,208,0.05); }

        .actions { display:flex; align-items:center; margin-left:8px; }

        .pager {
          margin-top:8px;
          display:flex; align-items:center; justify-content:center; gap:8px;
        }
        .arrow {
          padding:6px 10px; border:1px solid #ddd; border-radius:8px; background:#fff; cursor:pointer;
          color:#333;
        }
        .arrow:disabled {
          opacity:.45; cursor:default;
          color:#aaa; border-color:#eee; background:#fafafa;
        }
        .pageinfo { color:#666; font-size:13px; }
      `}</style>
    </div>
  );
}
