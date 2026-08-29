'use client';

import { Fragment } from 'react';
import type { FolderDto } from '../../lib/types';

/**
 * Root first, current folder last. The channel root is not a folder record, so
 * it is rendered from the channel name rather than from the trail.
 */
export function BreadcrumbBar({
  channelName,
  breadcrumbs,
  isLoading = false,
  onNavigate,
}: {
  channelName: string;
  breadcrumbs: FolderDto[];
  isLoading?: boolean;
  onNavigate: (folderId: string | null) => void;
}) {
  return (
    <nav aria-label="caminho" className="flex min-w-0 items-center gap-1 text-[12px]">
      <button
        type="button"
        onClick={() => onNavigate(null)}
        className="focus-ring shrink-0 text-amber-500 transition-colors hover:text-amber-300"
      >
        {`#${channelName}`}
      </button>

      {isLoading && breadcrumbs.length === 0 ? (
        <span className="text-content-muted">
          <span aria-hidden>/</span>
          <span className="animate-caret">_</span>
        </span>
      ) : null}

      {breadcrumbs.map((folder, index) => {
        const isCurrent = index === breadcrumbs.length - 1;

        return (
          <Fragment key={folder.id}>
            <span aria-hidden className="shrink-0 text-content-muted">
              /
            </span>
            {isCurrent ? (
              <span aria-current="page" className="truncate text-content-primary">
                {folder.name}
              </span>
            ) : (
              <button
                type="button"
                onClick={() => onNavigate(folder.id)}
                className="focus-ring truncate text-content-secondary transition-colors hover:text-amber-300"
              >
                {folder.name}
              </button>
            )}
          </Fragment>
        );
      })}
    </nav>
  );
}
