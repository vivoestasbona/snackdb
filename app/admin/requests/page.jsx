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

  // snack_id -> array<Request>
  const grouped = useMemo(() => {
    const map = new Map();
    for (const r of items) {
      if (!map.has(r.snack_id)) map.set(r.snack_id, []);
      map.get(r.snack_id).push(r);
    }
    return map;
  }, [items]);

  // 과자명/슬러그 검색
  const groupSnackIds = useMemo(() => {
    const ids = [...grouped.keys()];
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
  }, [grouped, snackMap, snackQuery]);

  // 최신 요청 시간 기준 그룹 정렬
  const sortedSnackIds = useMemo(() => {
    return groupSnackIds.sort((a, b) => {
      const la = (grouped.get(a) || [])[0]?.created_at || 0;
      const lb = (grouped.get(b) || [])[0]?.created_at || 0;
      return new Date(lb) - new Date(la);
    });
  }, [groupSnackIds, grouped]);

  async function setReqStatus(reqId, status) {
    try {
      const { error } = await sb.from("snack_tag_requests").update({ status, processed_at: new Date().toISOString() }).eq("id", reqId);
      if (error) throw error;
      await load();
    } catch (e) {
      console.error("set status failed", e);
      alert("상태 변경 실패");
    }
  }

  async function approveAndApply(r) {
    if (r.status !== "pending") {
      alert("대기중 요청만 승인할 수 있습니다. 먼저 상태를 '대기중'으로 되돌린 뒤 승인하세요.");
      return;
    }
    try {
      const { data: sess } = await sb.auth.getSession();
      const token = sess?.session?.access_token ?? "";
      const res = await fetch("/api/admin/requests/apply", {
        method: "POST",
        headers: { "Content-Type": "application/json", ...(token ? { Authorization: `Bearer ${token}` } : {}) },
        body: JSON.stringify({ id: r.id }),
      });
      const text = await res.text();
      let payload = null; try { payload = JSON.parse(text); } catch {}
      if (!res.ok) {
        console.error("apply failed", res.status, payload || text);
        alert(`반영 실패 [${res.status}] ${payload?.error || text || "unknown"} ${payload?.step ? `@${payload.step}` : ""}`);
        return;
      }
      await load();
    } catch (e) {
      console.error("approveAndApply error", e);
      alert("승인/반영 실패");
    }
  }

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
        <footer className="reqActions">
          <button onClick={() => approveAndApply(r)} disabled={r.status !== "pending"} title={r.status !== "pending" ? "대기중 상태에서만 승인 가능합니다" : ""}>승인 및 반영</button>
          <button onClick={() => setReqStatus(r.id, "rejected")} disabled={r.status === "rejected"} title={r.status === "rejected" ? "이미 거절됨" : ""}>거절</button>
          <button onClick={() => setReqStatus(r.id, "spam")}     disabled={r.status === "spam"}     title={r.status === "spam" ? "이미 스팸 표시" : ""}>스팸</button>
          {r.status !== "pending" && (<button onClick={() => setReqStatus(r.id, "pending")}>대기중으로 되돌리기</button>)}
        </footer>
      </article>
    );
  }

  return (
    <section style={{ maxWidth: 1100, margin: "20px auto", padding: "0 16px" }}>
      <h1>정보 수정/추가 요청 — 과자별 보기</h1>
      <p style={{ color:"#666", margin:"6px 0 14px" }}>
        같은 과자 요청을 묶어서 처리하세요. &nbsp;
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
        <input placeholder="과자명/슬러그 검색" value={snackQuery} onChange={(e)=>setSnackQuery(e.target.value)} />
      </div>

      {loading ? (
        <p>불러오는 중…</p>
      ) : (
        <>
          {!sortedSnackIds.length && <p style={{ color:"#666" }}>표시할 과자가 없습니다.</p>}
          <div className="groupList">
            {sortedSnackIds.map((sid) => {
              const snack = snackMap[sid] || { id: sid, name: "(이름없음)", slug: "" };
              const list = grouped.get(sid) || [];
              const byStatus = list.reduce((acc, r) => { (acc[r.status || "unknown"] ||= []).push(r); return acc; }, {});
              const c = (k) => (byStatus[k] || []).length;

              const userHref  = snack.slug ? `/snacks/${snack.slug}` : `/snacks/${sid}`;
              const adminHref = `/admin/snacks/${sid}/edit`;

              return (
                <details key={sid} open className="group">
                  <summary className="groupHead">
                    <div className="nameRow"><b>{snack.name}</b><span className="slug">/{snack.slug || sid}</span></div>
                    <div className="badges">
                      <span className="b b-p">{c("pending")}</span>
                      <span className="b b-a">{c("approved")}</span>
                      <span className="b b-r">{c("rejected")}</span>
                      <span className="b b-s">{c("spam")}</span>
                    </div>
                    <div className="links">
                      <Link href={userHref}>사용자 상세 →</Link>
                      <Link href={adminHref} style={{ fontWeight:700 }}>수정 페이지 →</Link>
                    </div>
                  </summary>

                  {["pending","approved","rejected","spam"].map(st => {
                    const arr = byStatus[st] || [];
                    if (!arr.length) return null;
                    return (
                      <section key={st} className="statusSec">
                        <h3 className="statusTitle">
                          {st === "pending" ? "대기중" : st === "approved" ? "승인됨" : st === "rejected" ? "거절됨" : "스팸"}
                          <span className="count">{arr.length}</span>
                        </h3>
                        <div className="reqList">{arr.map(renderRequestItem)}</div>
                      </section>
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
        .toolbar input { flex:1; min-width:220px; padding:6px 10px; border:1px solid #ddd; border-radius:8px; }
        .groupList { display:grid; gap:12px; }
        .group { border:1px solid #eee; border-radius:12px; padding:8px 12px; background:#fff; }
        .groupHead { display:grid; grid-template-columns: 1fr auto auto; gap:10px; align-items:center; cursor:pointer; }
        .nameRow { display:flex; align-items:center; gap:8px; }
        .slug { color:#666; font-size:13px; }
        .badges { display:flex; gap:6px; }
        .b { display:inline-flex; align-items:center; justify-content:center; min-width:28px; height:24px; padding:0 6px; border-radius:999px; font-size:12px; border:1px solid #ddd; background:#fafafa; }
        .b-p { border-color:#333; } .b-a { border-color:#0a7; } .b-r { border-color:#a33; } .b-s { border-color:#c70; }
        .links { display:flex; gap:8px; }
        .statusSec { margin:10px 0 6px; }
        .statusTitle { display:flex; align-items:center; gap:6px; margin:10px 0 6px; font-size:14px; }
        .statusTitle .count { display:inline-flex; align-items:center; justify-content:center; min-width:22px; height:20px; padding:0 6px; border-radius:999px; border:1px solid #ddd; font-size:12px; background:#f6f6f6; }
        .reqList { display:grid; gap:10px; }
        .reqCard { border:1px solid #eee; border-radius:10px; padding:10px; }
        .reqHead { display:flex; justify-content:space-between; align-items:center; gap:8px; }
        .reqHead .meta { color:#666; font-size:12px; }
        .reqGrid { display:grid; grid-template-columns:1fr 1fr; gap:12px; margin-top:6px; }
        .reqActions { display:flex; gap:8px; margin-top:10px; }
        @media (max-width: 600px) { .groupHead { grid-template-columns: 1fr; } .links { justify-content: flex-end; } .reqGrid { grid-template-columns:1fr; } }
      `}</style>
    </section>
  );
}
