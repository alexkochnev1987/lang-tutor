"use client";

import { useRef, useState } from "react";
import { saveLessonSession } from "@/lib/data/store";
import type { LessonSessionRow } from "@/lib/data/types";

export function useSaveLessonResult() {
  const [status, setStatus] = useState<"idle" | "saving" | "error">("idle");
  const pending = useRef(false);
  const payload = useRef<LessonSessionRow | null>(null);

  async function save(result: Omit<LessonSessionRow, "id">): Promise<boolean> {
    if (pending.current) return false;
    pending.current = true;
    setStatus("saving");
    const session = payload.current ?? { ...result, id: crypto.randomUUID() };
    payload.current = session;
    try {
      const saved = await saveLessonSession(session);
      setStatus(saved ? "idle" : "error");
      if (saved) payload.current = null;
      return saved;
    } finally {
      pending.current = false;
    }
  }

  return { status, save };
}
