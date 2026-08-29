'use client';

import { useRouter, useSearchParams } from 'next/navigation';
import { useCallback, useMemo, useState } from 'react';
import {
  useBreadcrumbs,
  useCreateFolder,
  useDeleteFile,
  useDeleteFolder,
  useFolderContents,
  useUpdateFile,
  useUpdateFolder,
} from '../../hooks/use-files';
import { ApiError } from '../../lib/api';
import { describeFileError } from '../../lib/files-api';
import type { SessionUser, StoredFileDto } from '../../lib/types';
import { CommandButton } from '../ui/command-button';
import { Scramble } from '../ui/scramble';
import { BreadcrumbBar } from './breadcrumb-bar';
import { FileActions, type MoveTarget } from './file-actions';
import { FileGrid } from './file-grid';
import { FilePreviewDialog } from './file-preview-dialog';
import { FolderGrid } from './folder-grid';
import { NewFolderDialog } from './new-folder-dialog';

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
  usersById = {},
}: {
  channelId: string;
  channelName: string;
  usersById?: Record<string, SessionUser>;
}) {
  const router = useRouter();
  const searchParams = useSearchParams();
  const folderId = searchParams.get('pasta');

  const { folder, folders, files, isLoading, error } = useFolderContents(channelId, folderId);
  const { breadcrumbs, isLoading: isTrailLoading } = useBreadcrumbs(folderId);

  const createFolder = useCreateFolder(channelId, folderId);
  const updateFolder = useUpdateFolder(channelId);
  const removeFolder = useDeleteFolder(channelId);
  const updateFile = useUpdateFile(channelId);
  const removeFile = useDeleteFile(channelId);

  const [isCreating, setIsCreating] = useState(false);
  const [preview, setPreview] = useState<StoredFileDto | null>(null);

  const goTo = useCallback(
    (next: string | null) => {
      const base = `/channels/${channelId}/files`;
      router.push(next ? `${base}?pasta=${encodeURIComponent(next)}` : base);
    },
    [channelId, router],
  );

  /*
   * Somewhere to move things without a full tree picker: out to the root, up to
   * the parent, or down into a folder already on screen. Anything further is a
   * navigation away and then a move, which is the same number of decisions.
   */
  const moveTargets = useMemo<MoveTarget[]>(() => {
    const targets: MoveTarget[] = [];

    if (folderId !== null) {
      targets.push({ id: null, label: `#${channelName} (raiz)` });

      const parent = breadcrumbs[breadcrumbs.length - 2];
      if (parent) targets.push({ id: parent.id, label: `.. ${parent.name}` });
    }

    for (const child of folders) targets.push({ id: child.id, label: child.name });

    return targets;
  }, [breadcrumbs, channelName, folderId, folders]);

  const status = error instanceof ApiError ? error.status : null;

  /*
   * A folder id pasted from another channel still resolves — it is a real
   * folder — but rendering its contents here would file them under the wrong
   * channel and let someone read across a boundary the sidebar implies.
   */
  const isMismatched = folder !== null && folder.channelId !== channelId;
  const isEmpty =
    !isLoading && !error && !isMismatched && folders.length === 0 && files.length === 0;
  const isBrowsable = !isLoading && !error && !isMismatched;

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

        <div className="ml-auto flex items-center gap-2">
          <CommandButton hotkey="N" disabled={!isBrowsable} onClick={() => setIsCreating(true)}>
            Nova pasta
          </CommandButton>
        </div>
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

        {isBrowsable ? (
          <div className="flex flex-col gap-3">
            <FolderGrid
              folders={folders}
              onOpen={goTo}
              renderActions={(target) => (
                <FileActions
                  kind="pasta"
                  name={target.name}
                  moveTargets={moveTargets.filter((option) => option.id !== target.id)}
                  onRename={(name) =>
                    updateFolder.mutateAsync({ folderId: target.id, name })
                  }
                  onMove={(parentId) =>
                    updateFolder.mutateAsync({ folderId: target.id, parentId })
                  }
                  onDelete={() => removeFolder.mutateAsync(target.id)}
                />
              )}
            />

            <FileGrid
              files={files}
              onOpen={setPreview}
              renderActions={(target) => (
                <FileActions
                  kind="arquivo"
                  name={target.originalName}
                  downloadUrl={target.downloadUrl}
                  moveTargets={moveTargets}
                  onRename={(originalName) =>
                    updateFile.mutateAsync({ fileId: target.id, originalName })
                  }
                  onMove={(destination) =>
                    updateFile.mutateAsync({ fileId: target.id, folderId: destination })
                  }
                  onDelete={() => removeFile.mutateAsync(target.id)}
                />
              )}
            />
          </div>
        ) : null}
      </div>

      {isCreating ? (
        <NewFolderDialog
          siblingNames={folders.map((sibling) => sibling.name)}
          onCreate={(name) => createFolder.mutateAsync(name)}
          onClose={() => setIsCreating(false)}
        />
      ) : null}

      {preview ? (
        <FilePreviewDialog
          file={preview}
          authorName={usersById[preview.createdByUserId]?.name}
          onClose={() => setPreview(null)}
          onDelete={() => removeFile.mutateAsync(preview.id)}
        />
      ) : null}
    </section>
  );
}
