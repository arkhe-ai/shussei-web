'use client';

import { type ReactNode, useEffect, useRef } from 'react';

/**
 * A terminal box floating over the tube.
 *
 * Hand-rolled rather than `<dialog>`: `showModal()` is not implemented in the
 * jsdom version the suite runs on, and a dialog that cannot be tested is worse
 * than one that reimplements a focus ring.
 */
export function Modal({
  label,
  onClose,
  children,
  footer,
}: {
  label: string;
  onClose: () => void;
  children: ReactNode;
  footer?: ReactNode;
}) {
  const surface = useRef<HTMLDivElement>(null);

  useEffect(() => {
    function handleKeyDown(event: KeyboardEvent) {
      if (event.key !== 'Escape') return;
      // The shell binds single letters and space globally; nothing typed into a
      // modal should reach them.
      event.stopPropagation();
      onClose();
    }

    document.addEventListener('keydown', handleKeyDown);
    return () => document.removeEventListener('keydown', handleKeyDown);
  }, [onClose]);

  useEffect(() => {
    surface.current?.focus();
  }, []);

  return (
    <div
      // Above the scanline overlay, which sits at z-50.
      className="fixed inset-0 z-[60] flex items-center justify-center bg-base-950/85 p-6"
      onMouseDown={(event) => {
        if (event.target === event.currentTarget) onClose();
      }}
    >
      <div
        ref={surface}
        role="dialog"
        aria-modal="true"
        aria-label={label}
        tabIndex={-1}
        className="flex max-h-full w-full max-w-2xl flex-col border border-line-bright bg-base-850 outline-none"
      >
        <header className="flex shrink-0 items-center justify-between gap-3 border-b border-line px-3 py-1.5">
          <span className="text-[11px] uppercase tracking-[0.22em] text-amber-500 glow">
            {label}
          </span>
          <button
            type="button"
            onClick={onClose}
            aria-label="fechar"
            className="focus-ring text-[12px] text-content-muted transition-colors hover:text-amber-300"
          >
            [esc]
          </button>
        </header>

        <div className="min-h-0 flex-1 overflow-auto p-3">{children}</div>

        {footer ? (
          <footer className="flex shrink-0 flex-wrap items-center justify-end gap-2 border-t border-line px-3 py-2">
            {footer}
          </footer>
        ) : null}
      </div>
    </div>
  );
}
