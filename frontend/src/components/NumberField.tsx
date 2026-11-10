import { useEffect, useState } from "react";
import { useDraftError } from "../utils/useDraftError";
export function NumberField({
  label,
  value,
  onChange,
  min = 0,
  max = 60000,
}: {
  label: string;
  value: number;
  onChange: (n: number) => void;
  min?: number;
  max?: number;
}) {
  const [draft, setDraft] = useState(String(value));
  useEffect(() => setDraft(String(value)), [value]);
  const number = Number(draft);
  const error =
    draft.trim() === "" ||
    !Number.isFinite(number) ||
    !Number.isInteger(number) ||
    number < min ||
    number > max
      ? `Use um inteiro entre ${min} e ${max}.`
      : "";
  useDraftError(error);
  return (
    <label className="form-label">
      {label}
      <input
        className={`field w-28 ${error ? "invalid-field" : ""}`}
        type="number"
        min={min}
        max={max}
        value={draft}
        aria-invalid={!!error}
        onChange={(e) => {
          setDraft(e.target.value);
          const n = Number(e.target.value);
          if (e.target.value !== "" && Number.isInteger(n) && n >= min && n <= max) onChange(n);
        }}
      />
      {error && (
        <span className="binding-error" role="alert">
          {error}
        </span>
      )}
    </label>
  );
}
