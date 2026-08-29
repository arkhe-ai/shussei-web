'use client';

import { useRouter, useSearchParams } from 'next/navigation';
import { useCallback } from 'react';
import { useBreadcrumbs, useFolderContents } from '../../hooks/use-files';
import { ApiError } from '../../lib/api';
import { describeFileError } from '../../lib/files-api';
import type { StoredFileDto } from '../../lib/types';
import { CommandButton } from '../ui/command-button';
import { Scramble } from '../ui/scramble';
import { BreadcrumbBar } from './breadcrumb-bar';
import { FileGrid } from './file-grid';
import { FolderGrid } from './folder-grid';

/**
 * Durable per-channel storage.
 *
 * The current folder lives in the query string rather than in component state:
 * a folder is a place, and a place should survive a reload and be sendable to
 * somebody else. Navigation stays on this one route, so neither the shell nor
 * the LiveKit room is ever remounted by walking the tree.
 */
export function FileBrowser({
  channelId,
  channelName,
}: {
  channelId: string;
  channelName: string;
}) {
  const router = useRouter();
  const searchParams = useSearchParams();
  const folderId = searchParams.get('pasta');

  const { folder, folders, files, isLoading, error } = useFolderContents(channelId, folderId);
  const { breadcrumbs, isLoading: isTrailLoading } = useBreadcrumbs(folderId);

  const goTo = useCallback(
    (next: string | null) => {
      const base = `/channels/${channelId}/files`;
      router.push(next ? `${base}?pasta=${encodeURIComponent(next)}` : base);
    },
    [channelId, router],
  );

  const openFile = useCallback((file: StoredFileDto) => {
    // Replaced by the preview dialog in the next task; until then the file at
    // least has to be reachable.
    window.open(file.downloadUrl, '_blank', 'noopener,noreferrer');
  }, []);

  const status = error instanceof ApiError ? error.status : null;

  /*
   * A folder id pasted from another channel still resolves — it is a real
   * folder — but rendering its contents here would file them under the wrong
   * channel and let someone read across a boundary the sidebar implies.
   */
  const isMismatched = folder !== null && folder.channelId !== channelId;
  const isEmpty =
    !isLoading && !error && !isMismatched && folders.length === 0 && files.length === 0;

  return (
    <section className="flex min-h-0 flex-1 flex-col border border-line bg-base-850">
      <header className="flex shrink-0 items-center justify-between gap-3 border-b border-line px-3 py-1.5">
        <Scramble
          text={`arquivos:/${channelName}`}
          className="text-[11px] uppercase tracking-[0.22em] text-amber-500 glow"
        />
        <span className="text-[11px] text-content-muted">
          armazenamento durável · sobrevive ao buffer efêmero
        </span>
      </header>

      <div className="flex shrink-0 flex-wrap items-center gap-2 border-b border-line px-3 py-1.5">
        <BreadcrumbBar
          channelName={channelName}
          breadcrumbs={breadcrumbs}
          isLoading={isTrailLoading}
          onNavigate={goTo}
        />
      </div>

      <div className="min-h-0 flex-1 overflow-y-auto p-3">
        {isLoading ? (
          <p className="text-[12px] text-content-muted">
            <span className="text-amber-700">$</span> lendo diretório
            <span className="animate-caret">_</span>
          </p>
        ) : null}

        {status === 403 ? (
          <p className="text-[12px] text-danger-500">
            <span className="text-amber-700">$</span> acesso negado — você não participa deste canal
          </p>
        ) : null}

        {status !== null && status !== 403 ? (
          <div className="flex flex-col items-start gap-2">
            <p className="text-[12px] text-danger-500">
              <span className="text-amber-700">$</span> {describeFileError(error)}
            </p>
            <CommandButton onClick={() => goTo(null)}>Voltar à raiz</CommandButton>
          </div>
        ) : null}

        {isMismatched ? (
          <div className="flex flex-col items-start gap-2">
            <p className="text-[12px] text-danger-500">
              <span className="text-amber-700">$</span> esta pasta pertence a outro canal
            </p>
            <CommandButton onClick={() => goTo(null)}>Voltar à raiz</CommandButton>
          </div>
        ) : null}

        {isEmpty ? (
          <p className="text-[12px] text-content-muted">
            <span className="text-amber-700">$</span> pasta vazia — nada guardado aqui ainda
          </p>
        ) : null}

        {!isLoading && !error && !isMismatched ? (
          <div className="flex flex-col gap-3">
            <FolderGrid folders={folders} onOpen={goTo} />
            <FileGrid files={files} onOpen={openFile} />
          </div>
        ) : null}
      </div>
    </section>
  );
}
