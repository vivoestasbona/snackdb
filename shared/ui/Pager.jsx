// shared/ui/Pager.jsx
"use client";

export default function Pager({
  page = 1,
  totalPages = 1,
  makeHref,
  boundaryCount = 1,
  siblingCount = 2,
  className = ""
}) {
  if (!totalPages || totalPages <= 1) return null;

  function getPageItems(current, total, { boundaryCount = 1, siblingCount = 2 } = {}) {
    const range = (s, e) => Array.from({ length: e - s + 1 }, (_, i) => s + i);
    const first = range(1, Math.min(boundaryCount, total));
    const last = total > boundaryCount ? range(Math.max(total - boundaryCount + 1, 1), total) : [];
    const start = Math.max(
      Math.min(current - siblingCount, total - boundaryCount - siblingCount * 2 - 1),
      boundaryCount + 1
    );
    const end = Math.min(
      Math.max(current + siblingCount, boundaryCount + siblingCount * 2 + 2),
      last.length ? last[0] - 1 : total
    );
    const middle = total <= boundaryCount * 2 + siblingCount * 2 + 2
      ? range(boundaryCount + 1, total - boundaryCount)
      : range(start, end);

    const items = [];
    items.push(...first);
    if (middle.length && first.length && middle[0] > first[first.length - 1] + 1) items.push('dots-left');
    items.push(...middle);
    if (middle.length && last.length && last[0] > middle[middle.length - 1] + 1) items.push('dots-right');
    items.push(...last);
    return items;
  }

  const pages = getPageItems(page, totalPages, { boundaryCount, siblingCount });

  const disabledPrev = page === 1;
  const disabledNext = page === totalPages;

  const safeHref = (p) => (makeHref ? makeHref(p) : `?page=${p}`);

  return (
    <nav className={`pagerNav ${className}`} aria-label="페이지">
      <ul className="pagerList">
        <li className={`pagerItem ${disabledPrev ? "isDisabled" : ""} isBoundary`}>
          <a aria-label="첫 페이지" href={disabledPrev ? undefined : safeHref(1)} tabIndex={disabledPrev ? -1 : 0}>«</a>
        </li>
        <li className={`pagerItem ${disabledPrev ? "isDisabled" : ""}`}>
          <a aria-label="이전 페이지" href={disabledPrev ? undefined : safeHref(page - 1)} tabIndex={disabledPrev ? -1 : 0}>‹</a>
        </li>

        {pages.map((p, i) => {
          if (p === 'dots-left' || p === 'dots-right') {
            return <li key={`d-${i}`} className="pagerItem isDots" aria-hidden>…</li>;
          }
          const isActive = p === page;
          return (
            <li key={p} className={`pagerItem ${isActive ? "isActive" : ""}`}>
              {isActive ? (
                <span aria-current="page">{p}</span>
              ) : (
                <a href={safeHref(p)} aria-label={`${p} 페이지`}>{p}</a>
              )}
            </li>
          );
        })}

        <li className={`pagerItem ${disabledNext ? "isDisabled" : ""}`}>
          <a aria-label="다음 페이지" href={disabledNext ? undefined : safeHref(page + 1)} tabIndex={disabledNext ? -1 : 0}>›</a>
        </li>
        <li className={`pagerItem ${disabledNext ? "isDisabled" : ""} isBoundary`}>
          <a aria-label="마지막 페이지" href={disabledNext ? undefined : safeHref(totalPages)} tabIndex={disabledNext ? -1 : 0}>»</a>
        </li>
      </ul>

      <style jsx>{`
        .pagerNav {
          margin-top: 16px;
          display: flex;
          justify-content: center;
        }
        .pagerList {
          display: flex;
          align-items: center;
          gap: 6px;
          padding: 0;
          margin: 0 auto;
          list-style: none;
        }
        .pagerItem a,
        .pagerItem span {
          min-width: 36px;
          height: 36px;
          padding: 0 10px;
          display: inline-flex;
          align-items: center;
          justify-content: center;
          border: 1px solid #ddd;
          border-radius: 8px;
          background: #fff;
          text-decoration: none;
          color: #111;
          font-size: 14px;
          line-height: 1;
        }
        .pagerItem a:hover { background: #f4f4f4; }
        .isActive > span,
        .pagerItem span[aria-current="page"] {
          border-color: #111;
          background: #111;
          color: #fff;
          font-weight: 700;
        }
        .isDisabled a {
          opacity: .45;
          pointer-events: none;
        }
        .isDots {
          min-width: 24px;
          height: 36px;
          color: #777;
          display: inline-flex;
          align-items: center;
          justify-content: center;
        }
        .pagerItem a:focus-visible {
          outline: 2px solid #000;
          outline-offset: 2px;
          border-radius: 6px;
        }
        @media (max-width: 480px) {
          .isBoundary { display: none; }
          .pagerItem a, .pagerItem span {
            min-width: 32px;
            height: 32px;
            border-radius: 6px;
            font-size: 13px;
          }
        }
      `}</style>
    </nav>
  );
}
