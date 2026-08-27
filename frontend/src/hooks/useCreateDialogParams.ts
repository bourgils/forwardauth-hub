import { useCallback } from "react";
import { useSearchParams } from "react-router-dom";

export function useCreateDialogParams() {
  const [searchParams, setSearchParams] = useSearchParams();
  const createOpen = searchParams.get("open") === "true" && searchParams.get("action") === "create";

  const openCreate = useCallback(() => {
    setSearchParams((current) => {
      const next = new URLSearchParams(current);
      next.set("open", "true");
      next.set("action", "create");
      return next;
    });
  }, [setSearchParams]);

  const closeCreate = useCallback(() => {
    setSearchParams((current) => {
      const next = new URLSearchParams(current);
      next.delete("open");
      next.delete("action");
      return next;
    }, { replace: true });
  }, [setSearchParams]);

  return { createOpen, openCreate, closeCreate };
}
