'use client';

import { useState } from 'react';
import { describeFileError, isImage, resolveDownloadUrl } from '../../lib/files-api';
import { formatBytes, formatDateTime } from '../../lib/format';
import type { StoredFileDto } from '../../lib/types';
import { CommandButton, CommandLink } from '../ui/command-button';
import { Modal } from '../ui/modal';
import { fileGlyph } from './file-card';

/**
 * Images are shown; everything else is described.
 *
 * Embedding an arbitrary uploaded file — a PDF, an HTML page — would run
 * somebody else's content inside the app's own origin story. A download link
 * hands that decision back to the browser, which is equipped to make it.
 */
export function FilePreviewDialog({
  file,
  authorName,
  onClose,
  onDelete,
}: {
  file: StoredFileDto;
  authorName?: string;
  onClose: () => void;
  onDelete?: () => Promise<unknown>;
}) {
  const [imageFailed, setImageFailed] = useState(false);
  const [isDeleting, setIsDeleting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const showsImage = isImage(file.mimeType) && !imageFailed;
  const href = resolveDownloadUrl(file.downloadUrl);

  async function handleDelete() {
    if (!onDelete) return;

    setIsDeleting(true);
    setError(null);

    try {
      await onDelete();
      onClose();
    } catch (failure) {
      setError(describeFileError(failure));
    } finally {
      setIsDeleting(false);
    }
  }

  return (
    <Modal
      label={file.originalName}
      onClose={onClose}
      footer={
        <>
          {error ? <span className="mr-auto text-[11px] text-danger-500">{error}</span> : null}
          <CommandLink href={href} target="_blank" rel="noopener noreferrer">
            Baixar
          </CommandLink>
          {onDelete ? (
            <CommandButton tone="danger" disabled={isDeleting} onClick={() => void handleDelete()}>
              {isDeleting ? 'Excluindo…' : 'Excluir'}
            </CommandButton>
          ) : null}
          <CommandButton onClick={onClose}>Fechar</CommandButton>
        </>
      }
    >
      <div className="flex flex-col gap-3">
        <div className="flex min-h-[180px] items-center justify-center border border-line bg-base-950 p-2">
          {showsImage ? (
            // eslint-disable-next-line @next/next/no-img-element -- the file is
            // served by the API on another origin; next/image would need a
            // remote pattern per deployment for no benefit here.
            <img
              src={href}
              alt={file.originalName}
              onError={() => setImageFailed(true)}
              className="max-h-[60vh] max-w-full object-contain"
            />
          ) : (
            <div className="flex flex-col items-center gap-1">
              <span className="text-[16px] tracking-[0.2em] text-amber-700">
                [{imageFailed ? 'X' : fileGlyph(file.mimeType)}]
              </span>
              <span className="text-[11px] text-content-muted">
                {imageFailed
                  ? 'não foi possível carregar a imagem'
                  : 'sem pré-visualização para este tipo'}
              </span>
            </div>
          )}
        </div>

        <dl className="grid grid-cols-[auto_1fr] gap-x-3 gap-y-0.5 text-[12px]">
          <dt className="text-content-muted">tipo</dt>
          <dd className="text-content-secondary">{file.mimeType}</dd>

          <dt className="text-content-muted">tamanho</dt>
          <dd className="tabular-nums text-content-secondary">{formatBytes(file.sizeBytes)}</dd>

          <dt className="text-content-muted">enviado</dt>
          <dd className="tabular-nums text-content-secondary">{formatDateTime(file.createdAt)}</dd>

          {authorName ? (
            <>
              <dt className="text-content-muted">por</dt>
              <dd className="text-content-secondary">{authorName}</dd>
            </>
          ) : null}
        </dl>
      </div>
    </Modal>
  );
}
