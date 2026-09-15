'use client';

import { useEffect, useId, useRef } from 'react';
import { CloseIcon } from './Icons';

type ModalProps = {
  open: boolean;
  onClose: () => void;
  title: string;
  closeLabel: string;
  children: React.ReactNode;
};

export function Modal({ open, onClose, title, closeLabel, children }: ModalProps) {
  const ref = useRef<HTMLDialogElement>(null);
  const titleId = useId();

  useEffect(() => {
    const dialog = ref.current;
    if (!dialog) return;
    if (open && !dialog.open) dialog.showModal();
    if (!open && dialog.open) dialog.close();
  }, [open]);

  return (
    <dialog
      ref={ref}
      className="modal m-auto w-[min(32rem,calc(100vw-2rem))] max-h-[calc(100dvh-2rem)] rounded-2xl border border-[var(--border)] bg-[var(--surface)] p-0 text-[var(--fg)] shadow-2xl"
      aria-labelledby={titleId}
      onClose={onClose}
      onClick={(e) => {
        // Clic en el fondo (fuera del contenido) cierra el modal.
        if (e.target === ref.current) onClose();
      }}
    >
      <div className="p-5 sm:p-6">
        <div className="mb-4 flex items-center justify-between gap-4">
          <h2 id={titleId} className="text-lg font-extrabold tracking-tight">
            {title}
          </h2>
          <button
            type="button"
            onClick={onClose}
            className="rounded-full p-1.5 text-[var(--muted)] hover:bg-[var(--accent-soft)] hover:text-[var(--fg)]"
            aria-label={closeLabel}
          >
            <CloseIcon className="size-5" />
          </button>
        </div>
        {children}
      </div>
    </dialog>
  );
}
