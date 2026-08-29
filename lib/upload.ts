import { ApiError } from './api';
import { getApiBaseUrl, isMockMode } from './env';
import { uploadPath } from './files-api';
import type { StoredFileDto } from './types';

/**
 * Client-side limits. The backend re-checks both and its answer wins; these
 * exist so a 30MB drop fails in front of the user instead of after the upload.
 */
export const MAX_UPLOAD_BYTES = 25 * 1024 * 1024;

export const ALLOWED_UPLOAD_TYPES = [
  'image/',
  'video/',
  'audio/',
  'text/',
  'application/pdf',
  'application/zip',
  'application/json',
];

export function isAllowedType(mimeType: string): boolean {
  return ALLOWED_UPLOAD_TYPES.some((prefix) => mimeType.startsWith(prefix));
}

/** Thrown into the upload promise when the caller cancels; not a failure to report. */
export class UploadAbortedError extends Error {
  constructor() {
    super('upload_aborted');
    this.name = 'UploadAbortedError';
  }
}

export type UploadHandlers = {
  /** 0..1. Called only while the request body is still being sent. */
  onProgress?: (ratio: number) => void;
};

export type UploadHandle = {
  promise: Promise<StoredFileDto>;
  abort: () => void;
};

/**
 * The single entry point for uploads.
 *
 * `apiFetch` checks `isMockMode()` on its own, but reporting progress needs
 * `XMLHttpRequest.upload.onprogress`, which means going around `apiFetch` and
 * around that check with it. Without the dispatch below, mock mode would put
 * real requests on the wire for the one feature whose entire point is running
 * without a backend.
 */
export function uploadFile(
  channelId: string,
  folderId: string | null,
  file: File,
  handlers: UploadHandlers = {},
): UploadHandle {
  if (isMockMode()) {
    return deferred(async () => {
      const { mockUploadFile } = await import('./mock/mock-upload');
      return mockUploadFile(channelId, folderId, file, handlers);
    });
  }

  return xhrUpload(channelId, folderId, file, handlers);
}

/**
 * Bridges a handle that only exists after an await. A caller may cancel inside
 * that window, so the abort is remembered and replayed once the real handle
 * arrives rather than landing on a no-op.
 */
function deferred(open: () => Promise<UploadHandle>): UploadHandle {
  let handle: UploadHandle | null = null;
  let aborted = false;

  const promise = open().then((opened) => {
    handle = opened;
    if (aborted) opened.abort();
    return opened.promise;
  });

  return {
    promise,
    abort() {
      aborted = true;
      handle?.abort();
    },
  };
}

function xhrUpload(
  channelId: string,
  folderId: string | null,
  file: File,
  handlers: UploadHandlers,
): UploadHandle {
  const xhr = new XMLHttpRequest();

  const form = new FormData();
  form.append('file', file, file.name);
  // Absent rather than the string "null": multipart has no null, and an empty
  // field would arrive as one.
  if (folderId) form.append('folderId', folderId);

  const promise = new Promise<StoredFileDto>((resolve, reject) => {
    xhr.open('POST', `${getApiBaseUrl()}${uploadPath(channelId)}`);
    xhr.withCredentials = true;
    // No Content-Type is set: FormData has to write its own multipart boundary.

    xhr.upload.addEventListener('progress', (event) => {
      if (!event.lengthComputable) return;
      handlers.onProgress?.(event.loaded / event.total);
    });

    xhr.addEventListener('load', () => {
      if (xhr.status < 200 || xhr.status >= 300) {
        reject(new ApiError(xhr.status));
        return;
      }

      try {
        const parsed = JSON.parse(xhr.responseText) as { file: StoredFileDto };
        handlers.onProgress?.(1);
        resolve(parsed.file);
      } catch {
        reject(new ApiError(xhr.status));
      }
    });

    // Status 0 is the browser's own "there was no response at all" — offline,
    // DNS, CORS. Carried as a status so one error type covers every failure.
    xhr.addEventListener('error', () => reject(new ApiError(0)));
    xhr.addEventListener('timeout', () => reject(new ApiError(0)));
    xhr.addEventListener('abort', () => reject(new UploadAbortedError()));

    xhr.send(form);
  });

  return { promise, abort: () => xhr.abort() };
}
