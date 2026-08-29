'use client';

import type { ReactNode } from 'react';
import type { StoredFileDto } from '../../lib/types';
import { FileCard } from './file-card';

export function FileGrid({
  files,
  onOpen,
  renderActions,
}: {
  files: StoredFileDto[];
  onOpen: (file: StoredFileDto) => void;
  renderActions?: (file: StoredFileDto) => ReactNode;
}) {
  if (files.length === 0) return null;

  return (
    <ul
      aria-label="arquivos"
      className="grid grid-cols-[repeat(auto-fill,minmax(160px,1fr))] gap-2"
    >
      {files.map((file) => (
        <FileCard
          key={file.id}
          file={file}
          onOpen={onOpen}
          actions={renderActions?.(file)}
        />
      ))}
    </ul>
  );
}
