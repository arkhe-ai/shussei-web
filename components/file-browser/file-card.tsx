'use client';

import clsx from 'clsx';
import { type ReactNode, useState } from 'react';
import { fileUrl, isImage } from '../../lib/files-api';
import { formatBytes, formatDateTime } from '../../lib/format';
import type { StoredFileDto } from '../../lib/types';

/** Terminal glyphs rather than icons: every other affordance here is text too. */
export function fileGlyph(mimeType: string): string {
  if (mimeType.startsWith('image/')) return 'IMG';
  if (mimeType.startsWith('video/')) return 'VID';
  if (mimeType.startsWith('audio/')) return 'SND';
  if (mimeType === 'application/pdf') return 'PDF';
  if (mimeType === 'application/zip') return 'ZIP';
  if (mimeType === 'application/json') return 'JSN';
  if (mimeType.startsWith('text/')) return 'TXT';
  return 'BIN';
}

export function FileCard({
  file,
  onOpen,
  actions,
}: {
  file: StoredFileDto;
  onOpen: (file: StoredFileDto) => void;
  actions?: ReactNode;
}) {
  const [imageFailed, setImageFailed] = useState(false);
  const showsImage = isImage(file.mimeType) && !imageFailed;

  return (
    <li className="group relative flex flex-col border border-line bg-base-900 transition-colors hover:border-line-bright">
      <button
        type="button"
        onClick={() => onOpen(file)}
        aria-label={`abrir ${file.originalName}`}
        className="focus-ring flex aspect-[4/3] w-full items-center justify-center overflow-hidden border-b border-line bg-base-950"
      >
        {showsImage ? (
          // eslint-disable-next-line @next/next/no-img-element -- durable files
          // come from the API on another origin; next/image would need a remote
          // pattern per deployment and buys nothing for a thumbnail grid.
          <img
            src={fileUrl(file)}
            alt={file.originalName}
            onError={() => setImageFailed(true)}
            className="h-full w-full object-cover"
          />
        ) : (
          <span
            className={clsx(
              'text-[13px] tracking-[0.18em]',
              imageFailed ? 'text-danger-500' : 'text-amber-700',
            )}
          >
            [{imageFailed ? 'X' : fileGlyph(file.mimeType)}]
          </span>
        )}
      </button>

      <div className="flex min-w-0 flex-col gap-0.5 px-2 py-1.5">
        <span className="truncate text-[12px] text-content-primary" title={file.originalName}>
          {file.originalName}
        </span>
        <span className="text-[11px] tabular-nums text-content-muted">
          {formatBytes(file.sizeBytes)} · {formatDateTime(file.createdAt)}
        </span>
        {imageFailed ? (
          <span className="text-[11px] text-danger-500">pré-visualização indisponível</span>
        ) : null}
      </div>

      {actions ? (
        <div className="absolute right-1 top-1 opacity-0 transition-opacity focus-within:opacity-100 group-hover:opacity-100">
          {actions}
        </div>
      ) : null}
    </li>
  );
}
