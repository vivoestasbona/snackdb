// features/manage-snack-categories/ui/TypeSelect.jsx
"use client";
import { useEffect } from "react";
import { useSnackTypes } from "@features/manage-snack-categories/model/useSnackTypes";

export default function TypeSelect({
  value, onChange, required = true, autoSelectFirst = true, disabled: forceDisabled = false,
  name = "type_id", id
}) {
  const { types, loading } = useSnackTypes();

  // 목록이 로드되면 기본값 자동 선택(옵션)
  useEffect(() => {
    if (!autoSelectFirst) return;
    if (!value && types?.length) onChange?.(types[0].id);
  }, [autoSelectFirst, value, types, onChange]);

  const disabled = forceDisabled || loading || !types.length;

  return (
    <label>
      과자 종류*
      <select
        id={id}
        name={name}
        value={value ?? ""}
        onChange={(e)=>onChange?.(e.target.value ? Number(e.target.value) : "")}
        disabled={disabled}
        required={required}
      >
        {!autoSelectFirst && <option value="">선택하세요</option>}
        {types.map(t => (
          <option key={t.id} value={t.id}>{t.name}</option>
        ))}
      </select>
    </label>
  );
}
