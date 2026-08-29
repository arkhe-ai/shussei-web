'use client';

import clsx from 'clsx';
import { AnimatePresence, motion } from 'motion/react';
import { type FormEvent, useEffect, useRef, useState } from 'react';
import { useUploadFile } from '../hooks/use-upload-file';
import { formatBytes } from '../lib/format';
import type { EphemeralMessage, FileAttachmentDto, StoredFileDto } from '../lib/types';
import { ChatAttachment } from './chat-attachment';
import { FileUploadZone } from './file-upload-zone';
import { UploadQueue } from './upload-queue';
import { Avatar } from './ui/avatar';
import { KeyHint } from './ui/key-hint';
import { Scramble } from './ui/scramble';
import { Typewriter } from './ui/typewriter';

/** A message older than this was recovered from the buffer, not just said. */
const LIVE_WINDOW_MS = 10_000;

function formatTime(iso: string): string {
  const date = new Date(iso);
  if (Number.isNaN(date.getTime())) return '--:--';
  return date.toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' });
}

function isRenderableAttachment(
  attachment: FileAttachmentDto | null | undefined,
): attachment is FileAttachmentDto {
  return Boolean(
    attachment &&
      typeof attachment.id === 'string' &&
      typeof attachment.originalName === 'string' &&
      typeof attachment.mimeType === 'string' &&
      typeof attachment.sizeBytes === 'number',
  );
}

export function ChatPanel({
  channelId,
  channelName,
  messages,
  onSend,
  isLoading = false,
  currentUserId,
  disabled = false,
}: {
  channelId: string;
  channelName?: string;
  messages: EphemeralMessage[];
  onSend: (body: string, fileIds: string[]) => void;
  isLoading?: boolean;
  currentUserId?: string;
  disabled?: boolean;
}) {
  const [body, setBody] = useState('');
  const listRef = useRef<HTMLDivElement | null>(null);

  /*
   * Attachments are uploaded before they are announced: the file becomes
   * durable through REST, and only its id travels over the socket. Nothing
   * binary, Base64 or blob-shaped is ever emitted.
   *
   * They land at the channel root rather than in a folder, because the composer
   * has no folder context and inventing one would put files somewhere the
   * sender never chose.
   */
  const uploads = useUploadFile(channelId, null);
  const [pending, setPending] = useState<StoredFileDto[]>([]);

  /*
   * Decided once per message id and then remembered, so a re-render never
   * restarts a half-typed line. Age is the test rather than "arrived after
   * mount": the recovered buffer also arrives after mount, and replaying an
   * hour of it as if it were being typed would misrepresent when it was said.
   */
  const typedRef = useRef(new Map<string, boolean>());

  function shouldType(message: EphemeralMessage): boolean {
    const remembered = typedRef.current.get(message.id);
    if (remembered !== undefined) return remembered;

    const age = Date.now() - new Date(message.sentAt).getTime();
    const isLive = Number.isFinite(age) && age >= 0 && age < LIVE_WINDOW_MS;
    typedRef.current.set(message.id, isLive);
    return isLive;
  }

  useEffect(() => {
    const list = listRef.current;
    if (!list) return;
    list.scrollTop = list.scrollHeight;
  }, [messages.length, channelId]);

  // Switching channels must not carry a half-composed attachment across.
  useEffect(() => {
    setPending([]);
  }, [channelId]);

  const hasContent = body.trim().length > 0 || pending.length > 0;
  const canSend = hasContent && !disabled && !uploads.isUploading;

  function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    // An empty line with nothing attached is not a message.
    if (!canSend) return;

    onSend(
      body.trim(),
      pending.map((file) => file.id),
    );
    setBody('');
    setPending([]);
    uploads.clearFinished();
  }

  return (
    <section className="flex min-h-0 flex-1 flex-col border border-line bg-base-850">
      <header className="flex shrink-0 items-center justify-between gap-3 border-b border-line px-3 py-1.5">
        <Scramble
          text={`#${channelName ?? channelId}`}
          className="text-[11px] uppercase tracking-[0.22em] text-amber-500 glow"
        />
        <span className="text-[11px] text-content-muted">
          buffer efêmero · últimas 100 mensagens · ttl 1h
        </span>
      </header>

      <div ref={listRef} className="min-h-0 flex-1 overflow-y-auto px-3 py-2">
        {isLoading ? (
          <p className="text-[12px] text-content-muted">
            <span className="text-amber-700">$</span> lendo buffer do canal
            <span className="animate-caret">_</span>
          </p>
        ) : null}

        {!isLoading && messages.length === 0 ? (
          <p className="text-[12px] text-content-muted">
            <span className="text-amber-700">$</span> buffer vazio — nada foi dito nas últimas horas
          </p>
        ) : null}

        <ul className="space-y-0.5">
          <AnimatePresence initial={false}>
            {messages.map((message) => (
              <motion.li
                key={message.id}
                initial={{ opacity: 0, x: -4 }}
                animate={{ opacity: 1, x: 0 }}
                transition={{ duration: 0.16, ease: 'easeOut' }}
                className="grid grid-cols-[auto_auto_1fr] items-baseline gap-x-2 py-[1px] hover:bg-base-800"
              >
                <time
                  dateTime={message.sentAt}
                  className="text-[11px] tabular-nums text-content-muted"
                >
                  {formatTime(message.sentAt)}
                </time>
                <span
                  className={clsx(
                    'flex items-center gap-1.5 text-[13px]',
                    message.author.id === currentUserId
                      ? 'text-amber-300 glow'
                      : 'text-content-secondary',
                  )}
                >
                  <Avatar seed={message.author.id} name={message.author.name} size="sm" />
                  &lt;{message.author.name}&gt;
                </span>
                <div className="min-w-0">
                  {message.body ? (
                    <p className="whitespace-pre-wrap break-words text-[13px] text-content-primary">
                      <Typewriter text={message.body} animate={shouldType(message)} />
                    </p>
                  ) : null}
                  {message.attachments
                    ?.filter(isRenderableAttachment)
                    .map((attachment) => (
                      <ChatAttachment key={attachment.id} attachment={attachment} />
                    ))}
                </div>
              </motion.li>
            ))}
          </AnimatePresence>
        </ul>
      </div>

      {uploads.items.length > 0 || pending.length > 0 ? (
        <div className="flex shrink-0 flex-col gap-1 border-t border-line px-3 py-1.5">
          <UploadQueue
            items={uploads.items}
            onCancel={uploads.cancel}
            onRetry={uploads.retry}
            onRemove={uploads.remove}
            onClearFinished={uploads.clearFinished}
          />

          {pending.length > 0 ? (
            <ul aria-label="anexos prontos" className="flex flex-wrap gap-1">
              {pending.map((file) => (
                <li
                  key={file.id}
                  className="flex items-center gap-1 border border-line bg-base-900 px-1.5 py-0.5"
                >
                  <span className="max-w-[180px] truncate text-[11px] text-content-primary">
                    {file.originalName}
                  </span>
                  <span className="text-[11px] tabular-nums text-content-muted">
                    {formatBytes(file.sizeBytes)}
                  </span>
                  <button
                    type="button"
                    aria-label={`remover anexo ${file.originalName}`}
                    onClick={() =>
                      setPending((current) => current.filter((item) => item.id !== file.id))
                    }
                    className="focus-ring text-[11px] text-content-muted transition-colors hover:text-danger-500"
                  >
                    x
                  </button>
                </li>
              ))}
            </ul>
          ) : null}
        </div>
      ) : null}

      <form
        aria-label="chat composer"
        onSubmit={handleSubmit}
        className="flex shrink-0 items-center gap-2 border-t border-line px-3 py-2"
      >
        <span aria-hidden className="text-amber-600">
          &gt;
        </span>
        <input
          className="focus-ring min-w-0 flex-1 bg-transparent text-[13px] text-content-primary outline-none placeholder:text-content-muted"
          placeholder="Escreva uma mensagem"
          value={body}
          maxLength={2000}
          autoComplete="off"
          disabled={disabled}
          onChange={(event) => setBody(event.target.value)}
        />
        <FileUploadZone
          variant="inline"
          disabled={disabled}
          onFiles={(picked) =>
            picked.forEach((file) =>
              uploads.upload(file, {
                onUploaded: (stored) => setPending((current) => [...current, stored]),
              }),
            )
          }
        />
        <button
          type="submit"
          disabled={!canSend}
          className="focus-ring border border-line px-2 py-0.5 text-[12px] text-content-secondary transition-colors hover:border-line-bright hover:text-amber-300 disabled:opacity-40"
        >
          Enviar
        </button>
        <KeyHint keys="⏎">enviar</KeyHint>
      </form>
    </section>
  );
}
