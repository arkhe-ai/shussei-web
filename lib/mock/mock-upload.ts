import { ApiError } from '../api';
import type { StoredFileDto } from '../types';
import {
  MAX_UPLOAD_BYTES,
  UploadAbortedError,
  isAllowedType,
  type UploadHandle,
  type UploadHandlers,
} from '../upload';
import { mockSessionUser } from './data';
import { addFile, newFileId } from './mock-files';

/**
 * A filename containing this is rejected on purpose. Mock mode has no backend
 * to break, so without a deliberate failure the retry path could never be seen
 * by hand or exercised end to end.
 */
export const MOCK_FAILURE_MARKER = 'falha';

const TICKS = 8;
const TICK_MS = 40;

function previewUrl(file: File): string {
  // What a real session would render for a just-picked image. jsdom has no
  // implementation, so fall back to a marker that still reads as a URL.
  if (file.type.startsWith('image/') && typeof URL.createObjectURL === 'function') {
    try {
      return URL.createObjectURL(file);
    } catch {
      // fall through
    }
  }

  return `mock://files/${encodeURIComponent(file.name)}`;
}

/**
 * Simulated upload: progress in steps, cancellable mid-flight, and failing for
 * the size, type, and filename cases the real API would reject.
 */
export function mockUploadFile(
  channelId: string,
  folderId: string | null,
  file: File,
  handlers: UploadHandlers = {},
): UploadHandle {
  let timer: ReturnType<typeof setTimeout> | null = null;
  let settled = false;
  let abortUpload: (() => void) | null = null;

  const promise = new Promise<StoredFileDto>((resolve, reject) => {
    abortUpload = () => {
      if (settled) return;
      settled = true;
      if (timer) clearTimeout(timer);
      reject(new UploadAbortedError());
    };

    if (file.size > MAX_UPLOAD_BYTES) {
      settled = true;
      reject(new ApiError(413));
      return;
    }

    if (file.type && !isAllowedType(file.type)) {
      settled = true;
      reject(new ApiError(415));
      return;
    }

    let tick = 0;

    const step = () => {
      tick += 1;

      if (tick < TICKS) {
        handlers.onProgress?.(tick / TICKS);
        timer = setTimeout(step, TICK_MS);
        return;
      }

      if (file.name.toLowerCase().includes(MOCK_FAILURE_MARKER)) {
        settled = true;
        reject(new ApiError(500));
        return;
      }

      const stored: StoredFileDto = {
        id: newFileId(),
        channelId,
        folderId,
        originalName: file.name,
        mimeType: file.type || 'application/octet-stream',
        sizeBytes: file.size,
        createdByUserId: mockSessionUser.id,
        createdAt: new Date().toISOString(),
        downloadUrl: previewUrl(file),
      };

      settled = true;
      handlers.onProgress?.(1);
      resolve(addFile(stored));
    };

    timer = setTimeout(step, TICK_MS);
  });

  return {
    promise,
    abort() {
      abortUpload?.();
    },
  };
}
