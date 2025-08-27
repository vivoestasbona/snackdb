// 어디서든 호출하면 Navbar가 로그인 모달을 열도록 신호를 보냅니다.
// entities/user/model/LoginPrompt.jsx
export function promptLogin(detail = {}) {
  if (typeof window === "undefined") return;

  // 1) 로깅 (fire-and-forget)
  try {
    const payload = {
      event: "prompt",
      from: detail.from,
      reason: detail.reason,
      snackId: detail.snackId,
      reviewId: detail.reviewId,
      path: window.location?.pathname || null,
    };
    const body = JSON.stringify(payload);
    if (navigator.sendBeacon) {
      navigator.sendBeacon("/api/metrics/login-prompt", new Blob([body], { type: "application/json" }));
    } else {
      fetch("/api/metrics/login-prompt", { method: "POST", headers: { "Content-Type": "application/json" }, body });
    }
    // 로그인 성공 로깅을 위해 출처 기억(선택)
    try { localStorage.setItem("lp_last_from", payload.from || ""); } catch {}
  } catch {}

  // 2) 실제 모달 오픈 (Navbar가 듣는 이벤트)
  window.dispatchEvent(new CustomEvent("app:login-prompt", { detail }));
}