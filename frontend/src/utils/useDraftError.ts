import { useEffect, useId } from "react";
import { useKeyboardStore } from "../store/useKeyboardStore";
export function useDraftError(error: string) {
  const id = useId(),
    setError = useKeyboardStore((s) => s.setDraftError);
  useEffect(() => {
    setError(id, error);
  }, [id, error, setError]);
  useEffect(() => () => setError(id, ""), [id, setError]);
}
