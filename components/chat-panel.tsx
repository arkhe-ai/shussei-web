'use client';

import clsx from 'clsx';
import { AnimatePresence, motion } from 'motion/react';
import { type FormEvent, useEffect, useRef, useState } from 'react';
import type { EphemeralMessage } from '../lib/types';
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
  onSend: (body: string) => void;
  isLoading?: boolean;
  currentUserId?: string;
  disabled?: boolean;
}) {
  const [body, setBody] = useState('');
  const listRef = useRef<HTMLDivElement | null>(null);

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

  function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!body.trim()) return;
    onSend(body.trim());
    setBody('');
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
                <p className="whitespace-pre-wrap break-words text-[13px] text-content-primary">
                  <Typewriter text={message.body} animate={shouldType(message)} />
                </p>
              </motion.li>
            ))}
          </AnimatePresence>
        </ul>
      </div>

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
        <button
          type="submit"
          disabled={disabled}
          className="focus-ring border border-line px-2 py-0.5 text-[12px] text-content-secondary transition-colors hover:border-line-bright hover:text-amber-300 disabled:opacity-40"
        >
          Enviar
        </button>
        <KeyHint keys="⏎">enviar</KeyHint>
      </form>
    </section>
  );
}
