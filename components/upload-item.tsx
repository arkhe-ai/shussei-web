'use client';

import clsx from 'clsx';
import { formatBytes } from '../lib/format';
import type { UploadItem as Item } from '../hooks/use-upload-file';

const STATUS_LABEL: Record<Item['status'], string> = {
  uploading: 'enviando',
  done: 'ok',
  cancelled: 'cancelado',
  failed: 'falhou',
};

const STATUS_CLASS: Record<Item['status'], string> = {
  uploading: 'text-amber-400',
  done: 'text-online',
  cancelled: 'text-content-muted',
  failed: 'text-danger-500',
};

export function UploadItem({
  item,
  onCancel,
  onRetry,
  onRemove,
}: {
  item: Item;
  onCancel: (id: string) => void;
  onRetry: (id: string) => void;
  onRemove: (id: string) => void;
}) {
  const percent = Math.round(item.progress * 100);

  return (
    <li className="flex flex-col gap-1 border border-line bg-base-900 px-2 py-1.5">
      <div className="flex items-baseline gap-2">
        <span className="min-w-0 flex-1 truncate text-[12px] text-content-primary" title={item.name}>
          {item.name}
        </span>
        <span className="shrink-0 text-[11px] tabular-nums text-content-muted">
          {formatBytes(item.sizeBytes)}
        </span>
        <span className={clsx('shrink-0 text-[11px]', STATUS_CLASS[item.status])}>
          {STATUS_LABEL[item.status]}
        </span>
      </div>

      {item.status === 'uploading' ? (
        <div
          role="progressbar"
          aria-label={`envio de ${item.name}`}
          aria-valuemin={0}
          aria-valuemax={100}
          aria-valuenow={percent}
          className="h-1 w-full bg-base-700"
        >
          <div className="h-full bg-amber-500" style={{ width: `${percent}%` }} />
        </div>
      ) : null}

      {item.error ? <p className="text-[11px] text-danger-500">{item.error}</p> : null}

      <div className="flex items-center gap-1">
        {item.status === 'uploading' ? (
          <ItemAction onClick={() => onCancel(item.id)}>cancelar</ItemAction>
        ) : null}
        {item.status === 'failed' || item.status === 'cancelled' ? (
          <ItemAction onClick={() => onRetry(item.id)}>tentar de novo</ItemAction>
        ) : null}
        {item.status !== 'uploading' ? (
          <ItemAction onClick={() => onRemove(item.id)}>dispensar</ItemAction>
        ) : null}
      </div>
    </li>
  );
}

function ItemAction({ onClick, children }: { onClick: () => void; children: string }) {
  return (
    <button
      type="button"
      onClick={onClick}
      className="focus-ring border border-line px-1 text-[11px] text-content-muted transition-colors hover:border-line-bright hover:text-amber-300"
    >
      {children}
    </button>
  );
}
