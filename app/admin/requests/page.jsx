// app/admin/requests/page.jsx
"use client";

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { getSupabaseClient } from "@shared/api/supabaseClient";

export default function RequestsBySnackPage() {
  const sb = getSupabaseClient();
  const [items, setItems] = useState([]);
  const [loading, setLoading] = useState(true);

  const [filterStatus, setFilterStatus] = useState("pending"); // 기본: 대기중
  const [snackQuery, setSnackQuery] = useState("");

  const [userMap, setUserMap] = useState({});   // { user_id: { name, warn_count } }
  const [snackMap, setSnackMap] = useState({}); // { snack_id: { id, name, slug } }
  const [dupOnly, setDupOnly] = useState(false);

  async function load() {
    setLoading(true);
    try {
      // 1) 요청 목록
      let q = sb
        .from("snack_tag_requests")
        .select("id,snack_id,user_id,add_types,remove_types,add_flavors,remove_flavors,add_keywords,remove_keywords,note,status,created_at,processed_at,processed_by")
        .order("created_at", { ascending: false });
      if (filterStatus !== "all") q = q.eq("status", filterStatus);

      const { data, error } = await q;
      if (error) throw error;
      const list = data || [];
      setItems(list);

      // 2) 요청자/과자 메타
      const uids = [...new Set(list.map(r => r.user_id).filter(Boolean))];
      const sids = [...new Set(list.map(r => r.snack_id).filter(Boolean))];

      if (uids.length) {
        const sel = sb.from("profiles").select("id,display_name,warn_count");
        const { data: profs } = uids.length === 1 ? await sel.eq("id", uids[0]) : await sel.in("id", uids);
        const m = {};
        (profs || []).forEach(p => {
          m[p.id] = {
            name: (p.display_name && String(p.display_name).trim()) || null,
            warn_count: Number.isFinite(p.warn_count) ? p.warn_count : 0,
          };
        });
        setUserMap(m);
      } else setUserMap({});

      if (sids.length) {
        const { data: snacks } = await sb.from("snacks").select("id,name,slug").in("id", sids);
        const sm = Object.fromEntries((snacks || []).map(s => [s.id, s]));
        setSnackMap(sm);
      } else setSnackMap({});
    } catch (e) {
      console.error("[REQUESTS/BY-SNACK] load error", e);
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => { load(); /* eslint-disable-next-line */ }, [filterStatus]);

  // snack_id -> Request[]
  const groupedBySnack = useMemo(() => {
    const map = new Map();
    for (const r of items) {
      if (!map.has(r.snack_id)) map.set(r.snack_id, []);
      map.get(r.snack_id).push(r);
    }
    return map;
  }, [items]);

  // 집계용: Request 하나를 '필드 × 연산 × 값' 단위로 납작하게 펼침
  function flattenRequest(r) {
    const rows = [];
    const pushMany = (arr, field, op) => {
      (arr || []).forEach((value) => {
        rows.push({ field, op, value, req: r });
      });
    };
    pushMany(r.add_types, "type", "add");
    pushMany(r.remove_types, "type", "remove");
    pushMany(r.add_flavors, "flavor", "add");
    pushMany(r.remove_flavors, "flavor", "remove");
    pushMany(r.add_keywords, "keyword", "add");
    pushMany(r.remove_keywords, "keyword", "remove");
    return rows;
  }

  // snack별로 '필드×연산×값' 버킷 집계
  function buildBuckets(requests) {
    /** Map<bucketKey, { field, op, value, reqIds:Set, users:Set, latestAt:string }> */
    const buckets = new Map();
    for (const r of requests) {
      for (const row of flattenRequest(r)) {
        const key = `${row.field}|${row.op}|${row.value}`;
        if (!buckets.has(key)) {
          buckets.set(key, {
            field: row.field,
            op: row.op,
            value: row.value,
            reqIds: new Set(),
            users: new Set(),
            latestAt: r.created_at,
          });
        }
        const b = buckets.get(key);
        b.reqIds.add(r.id);
        if (r.user_id) b.users.add(r.user_id);
        if (!b.latestAt || new Date(r.created_at) > new Date(b.latestAt)) b.latestAt = r.created_at;
      }
    }
    // 충돌 감지: 같은 값인데 add/remove가 모두 존재하는 경우 표시
    /** Map<conflictKey(field|value), { add?:Bucket, remove?:Bucket }> */
    const conflicts = new Map();
    for (const [key, b] of buckets) {
      const base = `${b.field}|${b.value}`;
      const prev = conflicts.get(base) || {};
      prev[b.op] = b;
      conflicts.set(base, prev);
    }
    return { buckets, conflicts };
  }

  // 과자명/슬러그 검색 필터
  const visibleSnackIds = useMemo(() => {
    const ids = [...groupedBySnack.keys()];
    if (!snackQuery.trim()) return ids;
    const q = snackQuery.trim().toLowerCase();
    return ids.filter(id => {
      const s = snackMap[id];
      if (!s) return false;
      return (
        (s.name && s.name.toLowerCase().includes(q)) ||
        (s.slug && s.slug.toLowerCase().includes(q))
      );
    });
  }, [groupedBySnack, snackMap, snackQuery]);

  // 최신 요청 시간 기준 그룹 정렬
  const sortedSnackIds = useMemo(() => {
    return visibleSnackIds.sort((a, b) => {
      const la = (groupedBySnack.get(a) || [])[0]?.created_at || 0;
      const lb = (groupedBySnack.get(b) || [])[0]?.created_at || 0;
      return new Date(lb) - new Date(la);
    });
  }, [visibleSnackIds, groupedBySnack]);

  // 일괄 상태 변경
  async function bulkSetStatus(ids, status) {
    if (!ids?.length) return;
    try {
      const { data: sess } = await sb.auth.getSession();
      const uid = sess?.session?.user?.id || null;
      const { error } = await sb
        .from("snack_tag_requests")
        .update({ status, processed_by: uid, processed_at: new Date().toISOString() })
        .in("id", ids);
      if (error) throw error;
      await load();
    } catch (e) {
      console.error("bulk status failed", e);
      alert("일괄 처리 실패");
    }
  }

  // 수정 페이지 프리필 이동 (변경사항 1건을 쿼리로 넘김)
  function makeEditHref(snackId, bucket) {
    // 예시 쿼리스키마: /admin/snacks/:id/edit?prefill=flavor:add:달달
    // 에디터 화면에서 prefill 파서를 구현해 적용.
    const qp = new URLSearchParams();
    qp.set("prefill", `${bucket.field}:${bucket.op}:${bucket.value}`);
    return `/admin/snacks/${snackId}/edit?${qp.toString()}`;
  }

  // 개별 요청 카드 (기존 섹션 유지)
  function renderRequestItem(r) {
    const prof = userMap[r.user_id] || {};
    const displayName = (prof.name && String(prof.name).trim()) || (r.user_id ? r.user_id.slice(0, 8) : "알수없음");
    const uidShort = r.user_id ? r.user_id.slice(0, 8) : "unknown";
    const warns = Number.isFinite(prof.warn_count) ? prof.warn_count : 0;

    return (
      <article key={r.id} className="reqCard">
        <header className="reqHead">
          <b>요청 #{r.id}</b>
          <span className="meta">
            {new Date(r.created_at).toLocaleString()}
            {` · ${displayName} (${uidShort}) · 경고 ${warns}회`}
            {r.processed_at ? ` · 처리: ${new Date(r.processed_at).toLocaleString()}` : ""}
          </span>
        </header>
        <div className="reqGrid">
          <div>
            <div><b>추가 종류</b>: {r.add_types?.length ? r.add_types.join(", ") : "-"}</div>
            <div><b>삭제 종류</b>: {r.remove_types?.length ? r.remove_types.join(", ") : "-"}</div>
            <div><b>추가 맛</b>: {r.add_flavors?.length ? r.add_flavors.join(", ") : "-"}</div>
            <div><b>삭제 맛</b>: {r.remove_flavors?.length ? r.remove_flavors.join(", ") : "-"}</div>
          </div>
          <div>
            <div><b>추가 키워드</b>: {r.add_keywords?.length ? r.add_keywords.join(", ") : "-"}</div>
            <div><b>삭제 키워드</b>: {r.remove_keywords?.length ? r.remove_keywords.join(", ") : "-"}</div>
            <div style={{ marginTop: 8 }}><b>메모</b>: {r.note || "-"}</div>
          </div>
        </div>
      </article>
    );
  }

  return (
    <section style={{ maxWidth: 1100, margin: "20px auto", padding: "0 16px" }}>
      <h1>정보 수정/추가 요청 — 과자별 보기</h1>
      <p style={{ color:"#666", margin:"6px 0 14px" }}>
        <Link href="/admin/requests/log" style={{ textDecoration:"none" }}>로그 보기 →</Link>
      </p>

      <div className="toolbar">
        <label>상태:&nbsp;
          <select value={filterStatus} onChange={(e)=>setFilterStatus(e.target.value)}>
            <option value="pending">대기중</option>
            <option value="all">전체</option>
            <option value="approved">승인됨</option>
            <option value="rejected">거절됨</option>
            <option value="spam">스팸</option>
          </select>
        </label>
        <label className="dupToggle">
          <input
            type="checkbox"
            checked={dupOnly}
            onChange={(e) => setDupOnly(e.target.checked)}
          />
          일치 요청만 보기
        </label>
        <input
          className="searchInput"
          type="text"
          placeholder="과자명/슬러그 검색"
          value={snackQuery}
          onChange={(e)=>setSnackQuery(e.target.value)}
        />
      </div>

      {loading ? (
        <p>불러오는 중…</p>
      ) : (
        <>
          {!sortedSnackIds.length && <p style={{ color:"#666" }}>표시할 과자가 없습니다.</p>}
          <div className="groupList">
            {sortedSnackIds.map((sid) => {
              const snack = snackMap[sid] || { id: sid, name: "(이름없음)", slug: "" };
              const reqs = groupedBySnack.get(sid) || [];
              const { buckets, conflicts } = buildBuckets(reqs);

              // 집계 목록: 요청 많은 순
              let bucketList = [...buckets.values()].sort((a, b) => b.reqIds.size - a.reqIds.size);
              if (dupOnly) bucketList = bucketList.filter(b => b.reqIds.size >= 2);

              const userHref  = snack.slug ? `/snacks/${snack.slug}` : `/snacks/${sid}`;
              const adminHref = `/admin/snacks/${sid}/edit`; // 수정 페이지로 연결

              return (
                <details key={sid} open className="group">
                  <summary className="groupHead">
                    <div className="nameRow"><b>{snack.name}</b><span className="slug">/{snack.slug || sid}</span></div>
                    <div className="links">
                      <Link href={userHref}>사용자 상세 →</Link>
                      <Link href={adminHref} style={{ fontWeight:700 }}>수정 페이지 →</Link>
                    </div>
                  </summary>

                  {/* ── 중복요청 집계 패널 */}
                  <section className="rollup">
                    <h3 className="rollupTitle">중복 요청 집계</h3>
                    <div className="rollupList">
                      {bucketList.map((b) => {
                        const key = `${b.field}|${b.value}`;
                        const conflict = conflicts.get(key);
                        const hasOpposite = !!(conflict?.add && conflict?.remove);
                        const ids = [...b.reqIds];
                        const users = [...b.users];

                        return (
                          <div key={`${b.field}:${b.op}:${b.value}`} className={`rollupItem ${hasOpposite ? "isConflict" : ""}`}>
                            <div className="rollupMain">
                              <span className={`chip op-${b.op}`}>
                                {b.op === "add" ? "+" : "−"} {b.field === "flavor" ? "맛" : b.field === "type" ? "종류" : "키워드"}: <b>{b.value}</b>
                              </span>
                              <span className="count">× {ids.length}</span>
                              {hasOpposite && <span className="conflict">⚠ 상충 요청 존재</span>}
                            </div>
                            <div className="rollupMeta">
                              최근: {new Date(b.latestAt).toLocaleString()} · 참여 유저 {users.length}명
                            </div>
                            <div className="rollupActions">
                              <button onClick={() => bulkSetStatus(ids, "approved")} title="승인(상태만)">승인(상태만)</button>
                              <button onClick={() => bulkSetStatus(ids, "rejected")}>거절</button>
                              <button onClick={() => bulkSetStatus(ids, "spam")}>스팸</button>
                              <a className="applyLink" href={makeEditHref(sid, b)}>수정에서 반영</a>
                            </div>
                          </div>
                        );
                      })}
                      {!bucketList.length && <div className="muted">집계할 항목이 없습니다.</div>}
                    </div>
                  </section>

                  {/* ── 원래처럼 상태별 상세 목록도 유지 */}
                  {["pending","approved","rejected","spam"].map((st) => {
                    const arr = reqs.filter((r) => (r.status || "unknown") === st);
                    if (!arr.length) return null;

                    const label =
                      st === "pending" ? "상세 보기" :
                      st === "approved" ? "승인됨" :
                      st === "rejected" ? "거절됨" : "스팸";

                    return (
                      <details key={st} className="statusDetails">
                        <summary className="statusSummary">
                          <span className="chev" aria-hidden>▸</span>
                          <span className="label">{label}</span>
                          <span className="count" aria-label="요청 수">{arr.length}</span>
                        </summary>
                        <div className="reqList">
                          {arr.map(renderRequestItem)}
                        </div>
                      </details>
                    );
                  })}
                </details>
              );
            })}
          </div>
        </>
      )}

      <style jsx>{`
        .toolbar { display:flex; gap:8px; align-items:center; margin:12px 0 16px; }
        /* 체크박스 말고 검색창에만 적용 */
        .searchInput { flex:1; min-width:220px; padding:6px 10px; border:1px solid #ddd; border-radius:8px; }
        /* 체크박스와 라벨을 바짝 붙이기 */
        .dupToggle { margin-left:auto; display:inline-flex; align-items:center; gap:6px; cursor:pointer; line-height:1; }
        .dupToggle input[type="checkbox"] { width:16px; height:16px; margin:0; flex:0 0 auto; }
        .groupList { display:grid; gap:12px; }
        .group { border:1px solid #eee; border-radius:12px; padding:8px 12px; background:#fff; }
        .groupHead { display:grid; grid-template-columns: 1fr auto; gap:10px; align-items:center; cursor:pointer; }
        .nameRow { display:flex; align-items:center; gap:8px; }
        .slug { color:#666; font-size:13px; }
        .links { display:flex; gap:8px; }

        .rollup { margin:8px 0 4px; padding:10px; border:1px dashed #ddd; border-radius:10px; background:#fafafa; }
        .rollupTitle { margin:0 0 8px; font-size:14px; color:#222; }
        .rollupList { display:grid; gap:8px; }
        .rollupItem { border:1px solid #eee; border-radius:10px; background:#fff; padding:8px; }
        .rollupItem.isConflict { border-color:#f3b; }
        .rollupMain { display:flex; align-items:center; gap:8px; flex-wrap:wrap; }
        .chip { display:inline-flex; align-items:center; gap:6px; height:26px; padding:0 10px; border-radius:999px; border:1px solid #ddd; background:#fff; }
        .op-add { border-color:#0a7; }
        .op-remove { border-color:#a33; }
        .count { color:#444; font-size:13px; }
        .conflict { color:#a33; font-size:12px; }
        .rollupMeta { color:#666; font-size:12px; margin:4px 0 6px; }
        .rollupActions { display:flex; gap:8px; flex-wrap:wrap; }
        .applyLink { display:inline-flex; align-items:center; height:28px; padding:0 10px; border-radius:8px; border:1px solid #111; text-decoration:none; }
        .applyLink:hover { background:#111; color:#fff; }

        /* ── 접고/펴기 스타일 ───────────────────────── */
        .statusDetails {
          border: 1px solid #eee;
          border-radius: 10px;
          background: #fff;
          margin: 8px 0;
          overflow: hidden;
        }
        .statusSummary {
          display: flex;
          align-items: center;
          gap: 8px;
          padding: 8px 10px;
          cursor: pointer;
          list-style: none;
          user-select: none;
        }
        .statusSummary::-webkit-details-marker { display: none; }
        .chev {
          display: inline-block;
          transition: transform .15s ease;
        }
        .statusDetails[open] .chev {
          transform: rotate(90deg);
        }
        .statusSummary .label { font-weight: 600; }
        .statusSummary .count {
          margin-left: auto;
          display: inline-flex; align-items: center; justify-content: center;
          min-width: 22px; height: 20px; padding: 0 6px; border-radius: 999px;
          border: 1px solid #ddd; font-size: 12px; background: #f6f6f6; color:#333;
        }

        .statusTitle .count { display:inline-flex; align-items:center; justify-content:center; min-width:22px; height:20px; padding:0 6px; border-radius:999px; border:1px solid #ddd; font-size:12px; background:#f6f6f6; }
        .reqList { display:grid; gap:10px; }
        .reqCard { border:1px solid #eee; border-radius:10px; padding:10px; }
        .reqHead { display:flex; justify-content:space-between; align-items:center; gap:8px; }
        .reqHead .meta { color:#666; font-size:12px; }
        .reqGrid { display:grid; grid-template-columns:1fr 1fr; gap:12px; margin-top:6px; }

        @media (max-width: 600px) {
          .groupHead { grid-template-columns: 1fr; }
          .links { justify-content: flex-end; }
          .reqGrid { grid-template-columns:1fr; }
        }
      `}</style>
    </section>
  );
}
