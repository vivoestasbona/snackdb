/// 오타 불허(strict) 비교용 정규화:
/// - trim
/// - NFC 정규화 (한글 자모 결합 케이스 방지)
/// - 소문자화 (영문/숫자 case 무시)
/// - 전각 -> 반각(ASCII) 변환
/// ※ 내부 공백/하이픈/구두점은 건드리지 않음(정확 일치가 원칙)
export function normalizeAnswerStrict(input) {
  if (typeof input !== 'string') return '';
  const trimmed = input.trim();
  // NFC normalize
  let s = trimmed.normalize('NFC').toLowerCase();

  // 전각(풀와이드) ASCII 범위만 반각으로 변환
  // '！'(FF01)~'～'(FF5E) -> '!'(21)~'~'(7E)
  s = s.replace(/[\uFF01-\uFF5E]/g, ch =>
    String.fromCharCode(ch.charCodeAt(0) - 0xFF00 + 0x20)
  );
  // 전각 공백(U+3000) -> 보통 공백
  s = s.replace(/\u3000/g, ' ');
  return s;
}

/// 정확 일치 판정(주정답 + 동의어 배열)
export function isExactAnswer(userInput, answerKey, acceptable = []) {
  const u = normalizeAnswerStrict(userInput);
  const key = normalizeAnswerStrict(answerKey);
  if (u === key) return true;
  for (const alt of acceptable) {
    if (u === normalizeAnswerStrict(alt)) return true;
  }
  return false;
}
