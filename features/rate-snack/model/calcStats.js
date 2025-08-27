// features/rate-snack/model/calcStats.js

import { STAT_KEYS as keys } from "@shared/lib/statLabels";

/**
 * 점수 rows 배열에서 평균값 계산
 * @param {Array<{tasty:number, value:number, plenty:number, clean:number, addictive:number}>} rows 
 */
export function calcAverageFromRows(rows) {
  if (!rows?.length) return null;

  const sum = rows.reduce(
    (a, r) => ({
      tasty: a.tasty + (r.tasty || 0),
      value: a.value + (r.value || 0),
      plenty: a.plenty + (r.plenty || 0),
      clean: a.clean + (r.clean || 0),
      addictive: a.addictive + (r.addictive || 0),
    }),
    { tasty: 0, value: 0, plenty: 0, clean: 0, addictive: 0 }
  );
  const n = rows.length;
  return {
    tasty: sum.tasty / n,
    value: sum.value / n,
    plenty: sum.plenty / n,
    clean: sum.clean / n,
    addictive: sum.addictive / n,
    count: n,
  };
}

/**
 * 전체 평균 평점(5항목 평균)
 */
export function calcOverall(values) {
  if (!values) return 0;
  const total = keys.reduce((s, k) => s + (values[k] || 0), 0);
  return total / keys.length;
}
