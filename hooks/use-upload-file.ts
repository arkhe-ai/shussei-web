'use client';

import { useQueryClient } from '@tanstack/react-query';
import { useCallback, useMemo, useRef, useState } from 'react';
import { describeFileError } from '../lib/files-api';
import { formatBytes } from '../lib/format';
import type { StoredFileDto } from '../lib/types';
import {
  MAX_UPLOAD_BYTES,
  UploadAbortedError,
  isAllowedType,
  uploadFile,
  type UploadHandle,
} from '../lib/upload';
import { fileKeys } from './use-files';

export type UploadStatus = 'uploading' | 'done' | 'cancelled' | 'failed';

export type UploadItem = {
  id: string;
  name: string;
  sizeBytes: number;
  status: UploadStatus;
  /** 0..1 */
  progress: number;
  error?: string;
  result?: StoredFileDto;
};

/**
 * Fast local feedback only. The backend re-checks both, and a file that passes
 * here can still come back 413 or 415 — that answer is the authoritative one.
 */
function clientSideRejection(file: File): string | null {
  if (file.size > MAX_UPLOAD_BYTES) {
    return `arquivo maior que ${formatBytes(MAX_UPLOAD_BYTES)}`;
  }
  if (file.type && !isAllowedType(file.type)) {
    return `tipo não suportado: ${file.type}`;
  }
  return null;
}

let counter = 0;
function nextItemId(): string {
  counter += 1;
  return `up-${counter}-${Math.random().toString(36).slice(2, 8)}`;
}

/**
 * Owns the upload queue for one folder.
 *
 * The queue is deliberately local state rather than server state: the `File`
 * objects it holds are transient, unserialisable, and meaningless to any other
 * screen. Only the finished `StoredFileDto` is worth a query invalidation.
 */
export function useUploadFile(
  channelId: string,
  folderId: string | null,
): {
  items: UploadItem[];
  isUploading: boolean;
  upload: (file: File, callbacks?: { onUploaded?: (file: StoredFileDto) => void }) => string;
  retry: (id: string) => void;
  cancel: (id: string) => void;
  remove: (id: string) => void;
  clearFinished: () => void;
} {
  const queryClient = useQueryClient();
  const [items, setItems] = useState<UploadItem[]>([]);
  const handles = useRef(new Map<string, UploadHandle>());
  const sources = useRef(new Map<string, File>());
  const listeners = useRef(new Map<string, (file: StoredFileDto) => void>());

  const patch = useCallback((id: string, next: Partial<UploadItem>) => {
    setItems((current) =>
      current.map((item) => (item.id === id ? { ...item, ...next } : item)),
    );
  }, []);

  const start = useCallback(
    (id: string, file: File) => {
      const rejection = clientSideRejection(file);
      if (rejection) {
        patch(id, { status: 'failed', progress: 0, error: rejection });
        return;
      }

      patch(id, { status: 'uploading', progress: 0, error: undefined });

      const handle = uploadFile(channelId, folderId, file, {
        onProgress: (ratio) => patch(id, { progress: ratio }),
      });
      handles.current.set(id, handle);

      handle.promise
        .then((stored) => {
          patch(id, { status: 'done', progress: 1, result: stored });
          void queryClient.invalidateQueries({ queryKey: fileKeys.channel(channelId) });
          listeners.current.get(id)?.(stored);
        })
        .catch((error: unknown) => {
          if (error instanceof UploadAbortedError) {
            patch(id, { status: 'cancelled' });
            return;
          }
          patch(id, { status: 'failed', error: describeFileError(error) });
        })
        .finally(() => {
          handles.current.delete(id);
        });
    },
    [channelId, folderId, patch, queryClient],
  );

  const upload = useCallback(
    (file: File, callbacks?: { onUploaded?: (file: StoredFileDto) => void }) => {
      const id = nextItemId();
      sources.current.set(id, file);
      if (callbacks?.onUploaded) listeners.current.set(id, callbacks.onUploaded);

      setItems((current) => [
        ...current,
        {
          id,
          name: file.name,
          sizeBytes: file.size,
          status: 'uploading',
          progress: 0,
        },
      ]);

      start(id, file);
      return id;
    },
    [start],
  );

  const retry = useCallback(
    (id: string) => {
      // A retry while the same item is still in flight would leave two handles
      // writing to one row and orphan the first.
      if (handles.current.has(id)) return;

      const file = sources.current.get(id);
      if (!file) return;

      start(id, file);
    },
    [start],
  );

  const cancel = useCallback((id: string) => {
    handles.current.get(id)?.abort();
  }, []);

  const remove = useCallback((id: string) => {
    handles.current.get(id)?.abort();
    handles.current.delete(id);
    sources.current.delete(id);
    listeners.current.delete(id);
    setItems((current) => current.filter((item) => item.id !== id));
  }, []);

  const clearFinished = useCallback(() => {
    setItems((current) => {
      for (const item of current) {
        if (item.status !== 'uploading') {
          sources.current.delete(item.id);
          listeners.current.delete(item.id);
        }
      }
      return current.filter((item) => item.status === 'uploading');
    });
  }, []);

  const isUploading = items.some((item) => item.status === 'uploading');

  return useMemo(
    () => ({ items, isUploading, upload, retry, cancel, remove, clearFinished }),
    [items, isUploading, upload, retry, cancel, remove, clearFinished],
  );
}
