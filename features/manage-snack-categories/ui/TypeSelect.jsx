// features/manage-snack-categories/ui/TypeSelect.jsx
"use client";
import { useEffect } from "react";
import { useSnackTypes } from "@features/manage-snack-categories/model/useSnackTypes";

export default function TypeSelect({
  value,
  onChange,
  required = true,
  autoSelectFirst = true,
  disabled: forceDisabled = false,
  name = "type_id",
  id,
}) {
  const { types, loading } = useSnackTypes();
  const disabled = forceDisabled || loading || !types.length;

  // 목록 로드 후 자동 기본 선택 (빈값/NaN 모두 처리)
  useEffect(() => {
    if (!autoSelectFirst) return;
    const empty = value === "" || value == null || Number.isNaN(value);
    if (empty && types?.length) onChange?.(types[0].id);
  }, [autoSelectFirst, value, types, onChange]);

  // select는 문자열로 제어 (NaN → "")
  const normalizedValue =
    value == null || value === "" ? "" : String(value);

  return (
    <label>
      과자 종류*
      <select
        id={id}
        name={name}
        value={normalizedValue}
        onChange={(e) => {
          const v = e.target.value;
          onChange?.(v === "" ? "" : v);
        }}
        disabled={disabled}
        required={required}
      >
        {!autoSelectFirst && <option value="">선택하세요</option>}
        {types.map((t) => (
          <option key={t.id} value={String(t.id)}>
            {t.name}
          </option>
        ))}
      </select>
    </label>
  );
}
