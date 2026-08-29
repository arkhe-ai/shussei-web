'use client';

import type { UploadItem as Item } from '../hooks/use-upload-file';
import { UploadItem } from './upload-item';

/**
 * The queue is only rendered while it has something to say. An empty upload
 * list is not a state worth a heading — the drop zone above it already says
 * what to do next.
 */
export function UploadQueue({
  items,
  onCancel,
  onRetry,
  onRemove,
  onClearFinished,
}: {
  items: Item[];
  onCancel: (id: string) => void;
  onRetry: (id: string) => void;
  onRemove: (id: string) => void;
  onClearFinished: () => void;
}) {
  if (items.length === 0) return null;

  const finished = items.filter((item) => item.status !== 'uploading').length;

  return (
    <section aria-label="envios" className="flex flex-col gap-1">
      <div className="flex items-center gap-2">
        <span className="text-[11px] uppercase tracking-[0.18em] text-amber-600">envios</span>
        {finished > 0 ? (
          <button
            type="button"
            onClick={onClearFinished}
            className="focus-ring ml-auto border border-line px-1 text-[11px] text-content-muted transition-colors hover:border-line-bright hover:text-amber-300"
          >
            limpar concluídos
          </button>
        ) : null}
      </div>

      <ul className="flex flex-col gap-1">
        {items.map((item) => (
          <UploadItem
            key={item.id}
            item={item}
            onCancel={onCancel}
            onRetry={onRetry}
            onRemove={onRemove}
          />
        ))}
      </ul>
    </section>
  );
}
