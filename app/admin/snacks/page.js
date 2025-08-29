// app/admin/snacks/page.js
"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { getSupabaseClient } from "@shared/api/supabaseClient";

const PAGE_SIZE = 20;
const VIS_COL = "is_public"; // 공개/비공개 컬럼

export default function SnackListPage() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const q = searchParams?.get("q") || "";
  const page = Number(searchParams?.get("page") || 1);

  const sb = getSupabaseClient();

  const [authOK, setAuthOK] = useState(false);
  const [items, setItems] = useState([]);
  const [count, setCount] = useState(null);
  const [loading, setLoading] = useState(true);

  // 뷰 토글: 'list' | 'grid'
  const [view, setView] = useState("list");

  // 정렬: key = 'name' | 'created_at', dir = 'asc' | 'desc'
  const [sortKey, setSortKey] = useState("created_at");
  const [sortDir, setSortDir] = useState("desc");

  // 선택(체크박스)
  const [selected, setSelected] = useState(() => new Set());

  // 🔐 세션 가드
  useEffect(() => {
    let mounted = true;

    const resolve = async (session) => {
      if (!session) {
        router.replace("/");
      } else if (mounted) {
        setAuthOK(true);
      }
    };

    sb.auth.getSession().then(({ data }) => resolve(data?.session));
    const { data: sub } = sb.auth.onAuthStateChange((_e, session) => resolve(session));

    return () => sub?.subscription?.unsubscribe?.();
  }, [sb, router]);

  // 검색 or() 식
  const like = useMemo(() => {
    const s = q.trim();
    if (!s) return null;
    const pat = `%${s.replace(/[%_]/g, "\\$&")}%`;
    return `brand.ilike.${pat},name.ilike.${pat},slug.ilike.${pat}`;
  }, [q]);

  // 데이터 로드(+ 좋아요/평균 지표)
  const load = useCallback(async () => {
    if (!authOK) return;
    setLoading(true);

    // 1) 기본 목록
    let query = sb
      .from("snacks")
      .select(`id,name,brand,slug,image_path,created_at,${VIS_COL}`, { count: "exact" });

    if (like) query = query.or(like);

    if (sortKey === "name") {
      query = query.order("brand", { ascending: sortDir === "asc" }).order("name", { ascending: sortDir === "asc" });
    } else {
      query = query.order("created_at", { ascending: sortDir === "asc" });
    }

    const fromIdx = (page - 1) * PAGE_SIZE;
    const toIdx = fromIdx + PAGE_SIZE - 1;
    query = query.range(fromIdx, toIdx);

    const { data, error, count: c } = await query;
    if (error) {
      console.error("load snacks error", error?.message || error, error);
      setItems([]); setCount(0); setLoading(false);
      return;
    }

    const rows = (data || []).map((it) => ({
      ...it,
      signedUrl: it.image_path ? `/api/images/snack?path=${encodeURIComponent(it.image_path)}` : null,
    }));

    // 2) 지표(좋아요 수 + 평균 점수) - 현재 페이지 id만 대상으로 집계
    const ids = rows.map((r) => r.id);
    let likesMap = {};
    let avgMap = {};
    if (ids.length) {
      // 좋아요 수
      const { data: likeRows, error: likeErr } = await sb
        .from("snack_likes")
        .select("snack_id")
        .in("snack_id", ids);
      if (!likeErr && likeRows?.length) {
        for (const r of likeRows) {
          likesMap[r.snack_id] = (likesMap[r.snack_id] || 0) + 1;
        }
      }

      // 평균 점수 (레이더 5개 항목의 전체 평균)
      const { data: scoreRows, error: scoreErr } = await sb
        .from("snack_scores")
        .select("snack_id,tasty,value,plenty,clean,addictive")
        .in("snack_id", ids);
      if (!scoreErr && scoreRows?.length) {
        const sum5 = {}; // 합계
        const cnt = {};  // 개수
        for (const r of scoreRows) {
          sum5[r.snack_id] = (sum5[r.snack_id] || 0) + (r.tasty + r.value + r.plenty + r.clean + r.addictive);
          cnt[r.snack_id] = (cnt[r.snack_id] || 0) + 1;
        }
        for (const id of Object.keys(sum5)) {
          // (모든 항목 합계) / (5 * 표본 수)
          avgMap[id] = +(sum5[id] / (5 * cnt[id])).toFixed(1);
        }
      }
    }

    // 3) 지표 주입
    const withMetrics = rows.map((it) => ({
      ...it,
      likesCount: likesMap[it.id] || 0,
      avgScore: avgMap[it.id] ?? null,
    }));

    setItems(withMetrics);
    setCount(typeof c === "number" ? c : withMetrics.length);
    setSelected(new Set());
    setLoading(false);
  }, [authOK, sb, like, page, sortKey, sortDir]);

  useEffect(() => { load(); }, [load]);

  // 검색/페이지 이동
  function onSearchSubmit(e) {
    e.preventDefault();
    const input = e.currentTarget.querySelector("input[name='q']");
    const nextQ = (input?.value || "").trim();
    const params = new URLSearchParams();
    if (nextQ) params.set("q", nextQ);
    params.set("page", "1");
    router.push(`/admin/snacks?${params.toString()}`);
  }
  function gotoPage(next) {
    const params = new URLSearchParams();
    if (q) params.set("q", q);
    params.set("page", String(next));
    router.push(`/admin/snacks?${params.toString()}`);
  }

  // 정렬 헤더
  function toggleSort(key) {
    if (key === sortKey) setSortDir((d) => (d === "asc" ? "desc" : "asc"));
    else { setSortKey(key); setSortDir(key === "name" ? "asc" : "desc"); }
  }

  // 체크박스
  function toggleOne(id) {
    setSelected((set) => { const next = new Set(set); next.has(id) ? next.delete(id) : next.add(id); return next; });
  }
  function toggleAll() {
    selected.size === items.length ? setSelected(new Set()) : setSelected(new Set(items.map((it) => it.id)));
  }
  const selectedCount = selected.size;

  // 일괄 삭제
  async function bulkDelete() {
    if (!selectedCount) return;
    if (!confirm(`선택한 ${selectedCount}개 과자를 삭제할까요? 이 작업은 되돌릴 수 없습니다.`)) return;
    const ids = Array.from(selected);
    const { error } = await sb.from("snacks").delete().in("id", ids);
    if (error) { alert("삭제 중 오류가 발생했습니다."); console.error(error); return; }
    await load();
  }

  // 일괄 공개/비공개
  async function bulkSetVisibility(nextPublic) {
    if (!selectedCount) return;
    const verb = nextPublic ? "공개" : "비공개";
    if (!confirm(`선택한 ${selectedCount}개 과자를 ${verb}로 설정할까요?`)) return;
    const ids = Array.from(selected);
    const { error } = await sb.from("snacks").update({ [VIS_COL]: nextPublic }).in("id", ids);
    if (error) { alert(`${verb} 설정 중 오류가 발생했습니다.`); console.error(error); return; }
    await load();
  }

  // 개별 공개/비공개 토글
  async function updateOneVisibility(sb, items, setItems, id, nextPublic) {
    // 낙관적 업데이트
    setItems(prev => prev.map(r => (r.id === id ? { ...r, is_public: nextPublic } : r)));
    const { error } = await sb.from("snacks").update({ is_public: nextPublic }).eq("id", id);
    if (error) {
      alert("변경 실패: " + (error.message || ""));
      // 롤백
      setItems(prev => prev.map(r => (r.id === id ? { ...r, is_public: !nextPublic } : r)));
    }
  }


  if (!authOK) return null;

  return (
    <section className="wrap">
      <div className="head">
        <h1>과자 관리</h1>
        <div className="actions">
          <form onSubmit={onSearchSubmit} className="search">
            <input name="q" defaultValue={q} placeholder="브랜드/이름/슬러그 검색" />
            <button type="submit">검색</button>
          </form>
          <Link className="create" href="/admin/snacks/new">+ 등록</Link>
        </div>
      </div>

      {/* 뷰 토글 + 일괄 작업 */}
      <div className="toolbar">
        <div className="left">
          <div className="seg">
            <button className={view==="list" ? "on":""} onClick={()=>setView("list")}>리스트</button>
            <button className={view==="grid" ? "on":""} onClick={()=>setView("grid")}>카드</button>
          </div>
          <div className="meta">총 {count ?? items.length}개</div>
        </div>
        <div className="bulk">
          <span>선택: {selectedCount}개</span>
          <button onClick={() => bulkSetVisibility(true)} disabled={selectedCount===0}>공개</button>
          <button onClick={() => bulkSetVisibility(false)} disabled={selectedCount===0}>비공개</button>
          <button onClick={bulkDelete} disabled={selectedCount===0}>삭제</button>
        </div>
      </div>

      {loading ? (
        <div className="loading">불러오는 중…</div>
      ) : (
        <>
          {view === "list" ? (
            <table className="list">
              <thead>
                <tr>
                  <th style={{ width: 36 }}>
                    <input
                      type="checkbox"
                      checked={items.length > 0 && selected.size === items.length}
                      onChange={toggleAll}
                      aria-label="현재 페이지 모두 선택"
                    />
                  </th>
                  <th style={{ width: 64 }}>이미지</th>
                  <th className="th-sort" onClick={() => toggleSort("name")}>
                    브랜드 / 이름 {sortKey==="name" && <SortIcon dir={sortDir} />}
                  </th>
                  <th style={{ width: 90 }}>공개</th>
                  <th style={{ width: 120 }}>지표</th>{/* ❤️ + 평균 */}
                  <th className="th-sort" style={{ width: 160 }} onClick={() => toggleSort("created_at")}>
                    생성일 {sortKey==="created_at" && <SortIcon dir={sortDir} />}
                  </th>
                  <th style={{ width: 160 }}>액션</th>
                </tr>
              </thead>
              <tbody>
                {items.map((it, i) => {
                  const checked = selected.has(it.id);
                  const visible = !!it[VIS_COL];
                  return (
                    <tr key={it.id} className={!visible ? "row-hidden" : ""}>
                      <td>
                        <input type="checkbox" checked={checked} onChange={() => toggleOne(it.id)} aria-label={`${i+1}번째 항목 선택`} />
                      </td>
                      <td>
                        {it.signedUrl ? (
                          <img className="img" src={it.signedUrl} alt="" width={48} height={48} />
                        ) : (<div className="img ph" />)}
                      </td>
                      <td>
                        <div className="name"><b>{it.brand}</b> {it.name}</div>
                        {it.slug && <div className="sub">{it.slug}</div>}
                      </td>
                      <td>
                       <label className="toggle">
                        <input
                          type="checkbox"
                          checked={visible}
                          onChange={() => updateOneVisibility(sb, items, setItems, it.id, !visible)}
                        />
                        <span />
                      </label>
                     </td>
                      <td>
                        <div className="metrics">
                          <span className="avg" title="전체 평균 점수">{it.avgScore ?? "-"}</span>
                          <button className="pill" type="button" tabIndex={-1} aria-label={`좋아요 ${it.likesCount}개`}>❤️ {it.likesCount}</button>
                          </div>
                      </td>
                      <td>{new Date(it.created_at).toLocaleDateString()}</td>
                      <td>
                        <Link href={`/admin/snacks/${it.id}/edit`}>수정</Link>
                        {it.slug && (
                          <>
                            {" · "}
                            <Link href={`/snacks/${encodeURIComponent(it.slug)}?preview=1`} target="_blank">보기</Link>
                          </>
                        )}
                      </td>
                    </tr>
                  );
                })}
                {items.length === 0 && (
                  <tr><td colSpan={7} style={{ textAlign:"center", color:"#777" }}>검색 결과가 없습니다.</td></tr>
                )}
              </tbody>
            </table>
          ) : (
            <div className="grid">
              {items.map((it) => {
                const visible = !!it[VIS_COL];
                return (
                  <div className={`card ${!visible ? "card-hidden" : ""}`} key={it.id}>
                    <div className="thumb">
                      {it.signedUrl ? <img src={it.signedUrl} alt="" width={160} height={160} /> : <div className="ph" />}
                    </div>
                    <div className="info">
                      <div className="title"><b>{it.brand}</b> {it.name}</div>
                      {it.slug && <div className="slug">{it.slug}</div>}
                      <div className="when">{new Date(it.created_at).toLocaleDateString()}</div>
                    </div>
                    <div className="ops">
                      <Link href={`/admin/snacks/${it.id}/edit`}>수정</Link>
                      {it.slug && (
                        <>
                          {" · "}
                          <Link href={`/snacks/${encodeURIComponent(it.slug)}?preview=1`} target="_blank">보기</Link>
                        </>
                      )}
                    </div>
                    {/* ❤️ + 평균 → 카드 우하단 */}
                    <div className="metrics metrics-card" title="좋아요 · 평균 점수">
                      <span className="avg">{it.avgScore ?? "-"}</span>
                      <button className="pill" type="button" tabIndex={-1} aria-label={`좋아요 ${it.likesCount}개`}>❤️ {it.likesCount}</button>
                      </div>
                    {!visible && <div className="badge off card-badge">비공개</div>}
                  </div>
                );
              })}
              {items.length === 0 && <div className="empty">검색 결과가 없습니다.</div>}
            </div>
          )}

          <div className="pager">
            <button onClick={() => gotoPage(Math.max(1, page - 1))} disabled={page <= 1}>이전</button>
            <span>{page}</span>
            <button
              onClick={() => gotoPage(page + 1)}
              disabled={count != null ? page * PAGE_SIZE >= count : items.length < PAGE_SIZE}
            >다음</button>
          </div>
        </>
      )}

      <style jsx>{`
        .wrap { padding: 16px; }
        .head { display:flex; justify-content:space-between; align-items:center; gap:12px; margin-bottom:8px; }
        .head h1 { margin:0; font-size:20px; }
        .actions { display:flex; gap:8px; align-items:center; }
        .search { display:flex; gap:6px; }
        .search input { width:260px; padding:8px 10px; border:1px solid #ddd; border-radius:6px; }
        .search button { padding:8px 12px; border:1px solid #ddd; border-radius:6px; background:#fff; cursor:pointer; }
        .create { padding:8px 12px; border:1px solid #ddd; border-radius:6px; background:#f8f8f8; }

        .toolbar{display:flex;justify-content:space-between;align-items:center;margin:10px 0 12px;}
        .left{display:flex;align-items:center;gap:10px;}
        .seg{display:inline-flex;border:1px solid #ddd;border-radius:8px;overflow:hidden}
        .seg button{padding:6px 10px;background:#fff;border:0;cursor:pointer}
        .seg button.on{background:#f5f5f5}
        .meta{color:#666; font-size:13px;}
        .bulk{display:flex;align-items:center;gap:8px;}
        .bulk button{padding:6px 10px;border:1px solid #ddd;border-radius:8px;background:#fff;cursor:pointer}
        .bulk span{color:#666; font-size:13px; margin-right:4px;}

        .loading { padding:24px; color: #555; }

        .grid { display:grid; grid-template-columns: repeat(auto-fill, minmax(260px, 1fr)); gap:16px; }
        .card { position:relative; border:1px solid #eee; border-radius:10px; background:#fff; padding:10px; display:grid; gap:8px; }
        .card-hidden { opacity: .55; }
        .thumb { width:100%; height:160px; background:#f6f6f6; border:1px solid #eee; border-radius:8px; display:flex; align-items:center; justify-content:center; overflow:hidden; }
        .thumb img { width:160px; height:160px; object-fit:cover; border-radius:8px; }
        .thumb .ph { width:160px; height:160px; background:#f0f0f0; border-radius:8px; }
        .info .title { white-space:nowrap; overflow:hidden; text-overflow:ellipsis; }
        .info .slug { font-size:12px; color:#777; }
        .when { font-size:12px; color:#777; }
        .ops { font-size:14px; }

        .badge { display:inline-block; padding:2px 6px; border-radius:6px; font-size:12px; border:1px solid #ddd; background:#fff; }
        .badge.ok { border-color:#cde; color:#236; }
        .badge.off { border-color:#eee; color:#777; background:#fafafa; }
        .card-badge { position:absolute; top:10px; left:10px; }

        .list{width:100%;border-collapse:collapse}
        .list th,.list td{padding:8px 10px;border-bottom:1px solid #eee;vertical-align:middle}
        .list tbody tr:hover{background:#fafafa}
        .row-hidden{opacity:.55;}
        .name{max-width:420px;white-space:nowrap;overflow:hidden;text-overflow:ellipsis}
        .sub{font-size:12px;color:#777}
        .img{width:48px;height:48px;object-fit:cover;border-radius:6px;background:#f3f3f3;border:1px solid #eee}
        .img.ph{display:block}
        .th-sort{cursor:pointer; user-select:none;}
        .th-sort:hover{background:#fafafa}

        /* ❤️ + 평균 지표 UI */
        .metrics{display:inline-flex; align-items:center; gap:8px; justify-content:flex-end;}
        .metrics .pill{border:1px solid #ddd; background:#fff; border-radius:999px; padding:4px 10px; font-size:13px; cursor:default;}
        .metrics .avg{font-weight:600; min-width:2.2em; text-align:right;}

        .metrics-card{ position:absolute; right:10px; bottom:10px; }

        .pager { margin-top:12px; display:flex; gap:10px; align-items:center; justify-content:center; }
        .pager button { padding:8px 12px; border:1px solid #ddd; border-radius:8px; background:#f8f8f8; }
        .toggle{position:relative;display:inline-block;width:44px;height:24px}
        .toggle input{display:none}
        .toggle span{position:absolute;inset:0;background:#ddd;border-radius:999px;transition:.2s;cursor:pointer}
        .toggle span::after{content:"";position:absolute;height:18px;width:18px;left:3px;top:3px;background:#fff;border-radius:50%;transition:.2s;box-shadow:0 1px 2px rgba(0,0,0,.1)}
        .toggle input:checked + span{background:#4a8}
        .toggle input:checked + span::after{transform:translateX(20px)}
      `}</style>
    </section>
  );
}

function SortIcon({ dir }) {
  return <span aria-hidden style={{ marginLeft: 6, fontSize: 12, color: "#888" }}>{dir === "asc" ? "▲" : "▼"}</span>;
}
