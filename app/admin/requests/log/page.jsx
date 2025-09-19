// app/admin/requests/log/page.jsx
"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { getSupabaseClient } from "@shared/api/supabaseClient";

export default function AdminRequestsLogPage() {
  const sb = getSupabaseClient();
  const [items, setItems] = useState([]);
  const [filterStatus, setFilterStatus] = useState("pending");
  const [loading, setLoading] = useState(true);
  const [userMap, setUserMap] = useState({});
  const [snackMap, setSnackMap] = useState({});

  async function load() {
    setLoading(true);
    try {
      let q = sb
        .from("snack_tag_requests")
        .select("id,snack_id,user_id,add_types,remove_types,add_flavors,remove_flavors,add_keywords,remove_keywords,note,status,created_at,processed_at,processed_by")
        .order("created_at", { ascending: false });
      if (filterStatus !== "all") q = q.eq("status", filterStatus);

      const { data, error } = await q;
      if (error) throw error;
      setItems(data || []);

      const uids = [...new Set((data || []).map(r => r.user_id).filter(Boolean))];
      const sids = [...new Set((data || []).map(r => r.snack_id).filter(Boolean))];

      if (uids.length) {
        const { data: profs } = await sb.from("profiles").select("id,display_name,warn_count").in("id", uids);
        const m = {}; (profs || []).forEach(p => { m[p.id] = { name: (p.display_name || "").trim() || null, warn_count: p.warn_count || 0 }; });
        setUserMap(m);
      }
      if (sids.length) {
        const { data: snacks } = await sb.from("snacks").select("id,name,slug").in("id", sids);
        const sm = Object.fromEntries((snacks || []).map(s => [s.id, s])); setSnackMap(sm);
      }
    } catch (e) {
      console.error("[REQUESTS/LOG] load error", e);
    } finally { setLoading(false); }
  }

  useEffect(() => { load(); /* eslint-disable-next-line */ }, [filterStatus]);

  async function setReqStatus(id, newStatus) {
    try {
      const { data: sess } = await sb.auth.getSession();
      const uid = sess?.session?.user?.id || null;
      await sb.from("snack_tag_requests").update({ status: newStatus, processed_by: uid, processed_at: new Date().toISOString() }).eq("id", id);
      load();
    } catch (e) {
      console.error("[REQUESTS] setReqStatus error", e);
      alert("상태 변경 중 오류가 발생했습니다.");
    }
  }

  async function approveAndApply(r) {
    if (r.status !== "pending") { alert("대기중 요청만 승인할 수 있습니다."); return; }
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
      if (!res.ok) { alert(`반영 실패 [${res.status}] ${payload?.error || text || "unknown"}`); return; }
      await setReqStatus(r.id, "approved");
      alert("승인 및 반영이 완료되었습니다.");
    } catch (e) {
      console.error(e); alert(`반영 중 예외: ${e.message}`);
    }
  }

  return (
    <section style={{ maxWidth: 1100, margin: "20px auto", padding: "0 16px" }}>
      <h1>정보 수정/추가 요청 — 로그</h1>
      <p style={{ color:"#666", margin:"6px 0 14px" }}>
        <Link href="/admin/requests" style={{ textDecoration:"none" }}>과자별 보기 →</Link>
      </p>

      <div style={{ display: "flex", gap: 8, alignItems: "center", margin: "12px 0" }}>
        <label>상태: </label>
        <select value={filterStatus} onChange={e => setFilterStatus(e.target.value)}>
          <option value="pending">대기중</option>
          <option value="approved">승인됨</option>
          <option value="rejected">거절됨</option>
          <option value="spam">스팸</option>
          <option value="all">전체</option>
        </select>
      </div>

      {loading ? (
        <p>불러오는 중…</p>
      ) : (
        <div style={{ display: "grid", gap: 12 }}>
          {items.map(r => {
            const snack = snackMap[r.snack_id];
            const prof = userMap[r.user_id] || {};
            const displayName = (prof.name && String(prof.name).trim()) || (r.user_id ? r.user_id.slice(0, 8) : "알수없음");
            const uidShort = r.user_id ? r.user_id.slice(0, 8) : "unknown";
            const warns = Number.isFinite(prof.warn_count) ? prof.warn_count : 0;
            const snackHref = snack?.slug ? `/snacks/${snack.slug}` : `/snacks/${r.snack_id}`;

            return (
              <article key={r.id} style={{ border: "1px solid #eee", borderRadius: 12, padding: 12 }}>
                <header style={{ display: "flex", justifyContent: "space-between", alignItems: "center", gap: 8 }}>
                  <div>
                    <strong>요청 #{r.id}{snack?.name ? ` · ${snack.name}` : ""}</strong>
                    <div style={{ color: "#666", fontSize: 13 }}>
                      {new Date(r.created_at).toLocaleString()}
                      {` · 요청자: ${displayName} (${uidShort}) · 경고 ${warns}회`}
                    </div>
                  </div>
                  <Link href={snackHref} style={{ textDecoration: "none" }}>사용자 상세 →</Link>
                </header>

                <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 12, marginTop: 8 }}>
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

                <footer style={{ display: "flex", gap: 8, marginTop: 12 }}>
                  <button onClick={() => approveAndApply(r)} disabled={r.status !== "pending"} title={r.status !== "pending" ? "대기중 상태에서만 승인 가능합니다" : ""}>승인 및 반영</button>
                  <button onClick={() => setReqStatus(r.id, "rejected")} disabled={r.status === "rejected"}>거절</button>
                  <button onClick={() => setReqStatus(r.id, "spam")}     disabled={r.status === "spam"}>스팸</button>
                  {r.status !== "pending" && <button onClick={() => setReqStatus(r.id, "pending")}>대기중으로 되돌리기</button>}
                </footer>
              </article>
            );
          })}
          {!items.length && <p style={{ color: "#666" }}>요청이 없습니다.</p>}
        </div>
      )}
    </section>
  );
}
