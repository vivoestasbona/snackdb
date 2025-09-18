// features/manage-snack-categories/ui/FlavorChipsSelector.jsx
"use client";
import { useSnackFlavors } from "@features/manage-snack-categories/model/useSnackFlavors";

export default function FlavorChipsSelector({ value = [], onChange }) {
  const { flavors, loading } = useSnackFlavors();

  const toggle = (id) => {
    if (!onChange) return;
    onChange(value.includes(id) ? value.filter(v => v !== id) : [...value, id]);
  };

  return (
    <fieldset className="fieldset">
      <legend>맛(복수 선택 가능)</legend>
      {loading ? (
        <p>맛 목록 불러오는 중…</p>
      ) : !flavors.length ? (
        <p>등록된 맛이 없습니다.</p>
      ) : (
        <div className="chips">
          {flavors.map(f => (
            <label key={f.id} className="chip">
              <input
                type="checkbox"
                checked={value.includes(f.id)}
                onChange={() => toggle(f.id)}
              />
              <span>{f.name}</span>
            </label>
          ))}
        </div>
      )}

      <style jsx>{`
        .fieldset { display:grid; gap:8px; }
        .chips { display:flex; flex-wrap:wrap; gap:8px; }
        .chip { display:inline-flex; align-items:center; gap:6px; padding:6px 10px; border:1px solid #ddd; border-radius:999px; }
      `}</style>
    </fieldset>
  );
}
