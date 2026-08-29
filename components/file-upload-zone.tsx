'use client';

import clsx from 'clsx';
import { type DragEvent, useRef, useState } from 'react';
import { formatBytes } from '../lib/format';
import { MAX_UPLOAD_BYTES } from '../lib/upload';

/**
 * Picker and drop target for the same act.
 *
 * The input is hidden but real: it is what makes the control keyboard-operable
 * and what a screen reader announces. The visible button only forwards to it.
 */
export function FileUploadZone({
  onFiles,
  disabled = false,
}: {
  onFiles: (files: File[]) => void;
  disabled?: boolean;
}) {
  const input = useRef<HTMLInputElement>(null);
  const [isOver, setIsOver] = useState(false);

  function emit(list: FileList | null) {
    const files = Array.from(list ?? []);
    if (files.length > 0) onFiles(files);
  }

  function handleDrop(event: DragEvent<HTMLDivElement>) {
    event.preventDefault();
    setIsOver(false);
    if (disabled) return;
    emit(event.dataTransfer.files);
  }

  return (
    <div
      onDragOver={(event) => {
        event.preventDefault();
        if (!disabled) setIsOver(true);
      }}
      onDragLeave={() => setIsOver(false)}
      onDrop={handleDrop}
      className={clsx(
        'flex items-center gap-2 border border-dashed px-2 py-1.5 transition-colors',
        isOver ? 'border-amber-500 bg-base-800' : 'border-line',
        disabled && 'opacity-40',
      )}
    >
      <input
        ref={input}
        type="file"
        multiple
        className="sr-only"
        aria-label="escolher arquivos para enviar"
        disabled={disabled}
        onChange={(event) => {
          emit(event.target.files);
          // Without this, picking the same file twice in a row is a no-op:
          // the value never changes, so `change` never fires again.
          event.target.value = '';
        }}
      />

      <button
        type="button"
        disabled={disabled}
        onClick={() => input.current?.click()}
        className="focus-ring border border-line px-2 py-0.5 text-[12px] text-content-secondary transition-colors hover:border-line-bright hover:text-amber-300 disabled:cursor-not-allowed"
      >
        [+] Enviar
      </button>

      <span className="text-[11px] text-content-muted">
        {isOver ? 'solte para enviar' : `arraste aqui · até ${formatBytes(MAX_UPLOAD_BYTES)}`}
      </span>
    </div>
  );
}
