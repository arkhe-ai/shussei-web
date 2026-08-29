'use client';

import type { ReactNode } from 'react';
import { formatDateTime } from '../../lib/format';
import type { FolderDto } from '../../lib/types';

export function FolderGrid({
  folders,
  onOpen,
  renderActions,
}: {
  folders: FolderDto[];
  onOpen: (folderId: string) => void;
  renderActions?: (folder: FolderDto) => ReactNode;
}) {
  if (folders.length === 0) return null;

  return (
    <ul
      aria-label="pastas"
      className="grid grid-cols-[repeat(auto-fill,minmax(160px,1fr))] gap-2"
    >
      {folders.map((folder) => (
        <li
          key={folder.id}
          className="group relative border border-line bg-base-900 transition-colors hover:border-line-bright"
        >
          <button
            type="button"
            onClick={() => onOpen(folder.id)}
            className="focus-ring flex w-full min-w-0 items-start gap-2 px-2 py-2 text-left"
          >
            <span aria-hidden className="shrink-0 text-[12px] leading-5 text-amber-600">
              [DIR]
            </span>
            <span className="flex min-w-0 flex-1 flex-col">
              <span className="truncate text-[12px] text-content-primary" title={folder.name}>
                {folder.name}
              </span>
              <span className="truncate text-[11px] tabular-nums text-content-muted">
                {formatDateTime(folder.updatedAt)}
              </span>
            </span>
          </button>

          {/*
            Lifted out of the row rather than sitting in it: inline, the three
            controls claimed half of a 196px card even at zero opacity, and the
            folder name truncated to "inf…" to make room for buttons nobody was
            looking at. Anchored to the bottom edge so what they cover on hover
            is the timestamp, not the name.
          */}
          {renderActions ? (
            <span className="absolute bottom-1 right-1 bg-base-900 opacity-0 transition-opacity focus-within:opacity-100 group-hover:opacity-100">
              {renderActions(folder)}
            </span>
          ) : null}
        </li>
      ))}
    </ul>
  );
}
