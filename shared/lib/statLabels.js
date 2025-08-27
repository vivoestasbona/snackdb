// shared/lib/statLabel.js

// 평가 항목(키/라벨) 공용 상수
export const STAT_KEYS   = ["tasty", "value", "plenty", "clean", "addictive"];
export const STAT_LABELS = ["맛있음", "가격 만족도", "양많음", "깔끔함", "중독성"];

// ["키","라벨"] 형태 (폼/모달에서 map 사용)
export const STAT_FIELDS = STAT_KEYS.map((k, i) => [k, STAT_LABELS[i]]);

// SEO 등에서 "맛있음/가격 만족도/…/중독성" 처럼 쓰기 좋게
export const STAT_SLASH  = STAT_LABELS.join("/");
