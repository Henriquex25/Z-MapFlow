import { useEffect, useState } from "react";
import { useKeyboardStore } from "../store/useKeyboardStore";
import { useDraftError } from "../utils/useDraftError";
import { validateProperty } from "../utils/bindingValidation";
export function ValidatedProperty({
  name,
  value,
  onChange,
  number = false,
  ariaLabel,
}: {
  name: string;
  value: string;
  onChange: (value: string) => void;
  number?: boolean;
  ariaLabel?: string;
}) {
  const project = useKeyboardStore((s) => s.project);
  const [draft, setDraft] = useState(value);
  useEffect(() => setDraft(value), [value]);
  const error = project ? validateProperty(name, draft, project) : "";
  useDraftError(error);
  return (
    <>
      <input
        className={`field ${error ? "invalid-field" : ""}`}
        aria-label={ariaLabel}
        aria-invalid={!!error}
        value={number ? draft.replace(/[<>()]/g, "") : draft}
        onChange={(e) => {
          const next = number ? `<(${e.target.value})>` : e.target.value;
          setDraft(next);
          if (!project || !validateProperty(name, next, project)) onChange(next);
        }}
      />
      {error && (
        <span className="binding-error" role="alert">
          {error}
        </span>
      )}
    </>
  );
}
