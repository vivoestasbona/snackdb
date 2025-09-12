// app/admin/requests/page.jsx
"use client";
import { useEffect, useState } from "react";
import Link from "next/link";
import { getSupabaseClient } from "@shared/api/supabaseClient";

export default function AdminRequestsPage() {
  const sb = getSupabaseClient();
  const [items, setItems] = useState([]);
  const [status, setStatus] = useState("pending"); // 필터
  const [loading, setLoading] = useState(true);

  async function load() {
    setLoading(true);
    const q = sb.from("snack_tag_requests")
      .select("id,snack_id,user_id,add_types,remove_types,add_flavors,remove_flavors,add_keywords,remove_keywords,note,status,created_at,processed_at,processed_by")
      .order("created_at", { ascending: false });
    if (status !== "all") q.eq("status", status);
    const { data, error } = await q;
    if (!error) setItems(data || []);
    setLoading(false);
  }

  useEffect(() => { load(); }, [status]);

  async function setReqStatus(id, newStatus) {
    const { data: sess } = await sb.auth.getSession();
    const uid = sess?.session?.user?.id || null;
    await sb.from("snack_tag_requests")
      .update({ status: newStatus, processed_by: uid, processed_at: new Date().toISOString() })
      .eq("id", id);
    load();
  }

  async function approveAndApply(r) {
  try {
    const { data: sess } = await sb.auth.getSession();
    const token = sess?.session?.access_token ?? "";

    const res = await fetch("/api/admin/requests/apply", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        ...(token ? { Authorization: `Bearer ${token}` } : {}),
      },
      body: JSON.stringify({ id: r.id }),
    });

    const text = await res.text();   // ← 본문 먼저 확보
    let data = null; try { data = JSON.parse(text); } catch {}

    if (!res.ok) {
      console.error("apply failed", res.status, data || text);
      alert(`반영 실패 [${res.status}] ${data?.error || text || "unknown"} ${data?.step ? `@${data.step}` : ""}`);
      return;
    }

    console.log("apply ok", data);
    await setReqStatus(r.id, "approved");
    alert("승인 및 반영이 완료되었습니다.");
  } catch (e) {
    console.error(e);
    alert(`반영 중 예외: ${e.message}`);
  }
}


  return (
    <section style={{maxWidth: 1100, margin: "20px auto", padding: "0 16px"}}>
      <h1>정보 수정/추가 요청</h1>

      <div style={{display:"flex", gap:8, alignItems:"center", margin:"12px 0"}}>
        <label>상태: </label>
        <select value={status} onChange={e=>setStatus(e.target.value)}>
          <option value="pending">대기중</option>
          <option value="approved">승인됨</option>
          <option value="rejected">거절됨</option>
          <option value="spam">스팸</option>
          <option value="all">전체</option>
        </select>
      </div>

      {loading ? <p>불러오는 중…</p> : (
        <div style={{display:"grid", gap:12}}>
          {items.map(r => (
            <article key={r.id} style={{border:"1px solid #eee", borderRadius:12, padding:12}}>
              <header style={{display:"flex", justifyContent:"space-between", alignItems:"center", gap:8}}>
                <div>
                  <strong>요청 #{r.id}</strong>
                  <div style={{color:"#666", fontSize:13}}>
                    {new Date(r.created_at).toLocaleString()} · snack_id: {r.snack_id}
                  </div>
                </div>
                <Link href={`/snacks/${r.snack_id}`} style={{textDecoration:"none"}}>상세 보기 →</Link>
              </header>

              <div style={{display:"grid", gridTemplateColumns:"1fr 1fr", gap:12, marginTop:8}}>
                <div>
                  <div><b>추가 종류</b>: {r.add_types?.join(", ") || "-"}</div>
                  <div><b>삭제 종류</b>: {r.remove_types?.join(", ") || "-"}</div>
                  <div><b>추가 맛</b>: {r.add_flavors?.join(", ") || "-"}</div>
                  <div><b>삭제 맛</b>: {r.remove_flavors?.join(", ") || "-"}</div>
                </div>
                <div>
                  <div><b>추가 키워드</b>: {r.add_keywords?.join(", ") || "-"}</div>
                  <div><b>삭제 키워드</b>: {r.remove_keywords?.join(", ") || "-"}</div>
                  <div style={{marginTop:8}}><b>메모</b>: {r.note || "-"}</div>
                </div>
              </div>

              <footer style={{display:"flex", gap:8, marginTop:12}}>
                <button onClick={()=>approveAndApply(r)}>승인 및 반영</button>
                <button onClick={()=>setReqStatus(r.id, "rejected")}>거절</button>
                <button onClick={()=>setReqStatus(r.id, "spam")}>스팸</button>
              </footer>
            </article>
          ))}
          {!items.length && <p style={{color:"#666"}}>요청이 없습니다.</p>}
        </div>
      )}
    </section>
  );
}
