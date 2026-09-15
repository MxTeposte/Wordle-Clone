'use client';

import { useCallback, useRef, useState } from 'react';

type Toast = { id: number; message: string };

export function useToasts() {
  const [toasts, setToasts] = useState<Toast[]>([]);
  const nextId = useRef(1);

  const show = useCallback((message: string, duration = 1800) => {
    const id = nextId.current++;
    setToasts((prev) => [{ id, message }, ...prev].slice(0, 3));
    if (duration > 0) {
      window.setTimeout(() => setToasts((prev) => prev.filter((t) => t.id !== id)), duration);
    }
  }, []);

  return { toasts, show };
}

export function ToastList({ toasts }: { toasts: Toast[] }) {
  return (
    <div
      className="pointer-events-none fixed inset-x-0 top-16 z-50 flex flex-col items-center gap-2 px-4"
      role="status"
      aria-live="polite"
    >
      {toasts.map((t) => (
        <div
          key={t.id}
          className="rounded-lg bg-[var(--fg)] px-4 py-2.5 text-sm font-bold text-[var(--bg)] shadow-lg"
        >
          {t.message}
        </div>
      ))}
    </div>
  );
}
