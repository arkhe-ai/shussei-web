'use client';

import { useState } from 'react';
import { fileUrl, isImage } from '../lib/files-api';
import { formatBytes } from '../lib/format';
import type { FileAttachmentDto } from '../lib/types';
import { fileGlyph } from './file-browser/file-card';

/**
 * A file referenced by a chat message.
 *
 * The message carries only metadata — never bytes, never a client-side blob
 * URL — so this renders from what the API resolved and links back to it. The
 * file is durable and the message is not: an attachment can outlive the line
 * that announced it, and vice versa.
 */
export function ChatAttachment({ attachment }: { attachment: FileAttachmentDto }) {
  const [imageFailed, setImageFailed] = useState(false);

  /*
   * One URL for both the preview and the link. `thumbnailUrl` is carried in the
   * contract but not used: the proxy addresses a file by id, and asking it for a
   * derived rendition would need a backend variant the MVP does not generate.
   */
  const href = fileUrl(attachment);
  const showsImage = isImage(attachment.mimeType) && !imageFailed;

  if (showsImage) {
    return (
      <a
        href={href}
        target="_blank"
        rel="noopener noreferrer"
        className="focus-ring mt-1 inline-block max-w-[280px] border border-line transition-colors hover:border-line-bright"
      >
        {/* eslint-disable-next-line @next/next/no-img-element -- served by the
            API on another origin; next/image would need a remote pattern per
            deployment and buys nothing for a chat thumbnail. */}
        <img
          src={href}
          alt={attachment.originalName}
          onError={() => setImageFailed(true)}
          className="block max-h-[180px] w-full object-contain"
        />
      </a>
    );
  }

  return (
    <a
      href={href}
      target="_blank"
      rel="noopener noreferrer"
      className="focus-ring mt-1 inline-flex max-w-full items-center gap-2 border border-line bg-base-900 px-2 py-1 transition-colors hover:border-line-bright"
    >
      <span aria-hidden className="shrink-0 text-[11px] text-amber-700">
        [{imageFailed ? 'X' : fileGlyph(attachment.mimeType)}]
      </span>
      <span className="min-w-0 truncate text-[12px] text-content-primary">
        {attachment.originalName}
      </span>
      <span className="shrink-0 text-[11px] tabular-nums text-content-muted">
        {formatBytes(attachment.sizeBytes)}
      </span>
    </a>
  );
}
