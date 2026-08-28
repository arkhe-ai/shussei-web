'use client';

import { useEffect, useRef, useState } from 'react';
import { prefersReducedMotion } from '../lib/motion-prefs';
import { Wordmark } from './ui/wordmark';

const LINE_MS = 78;
const TAIL_MS = 140;

const BOOT_LINES: Array<[string, string]> = [
  ['verificando ambiente', 'ok'],
  ['sessao', 'restaurando'],
  ['transporte tempo real', 'socket.io /app'],
  ['midia', 'livekit + webrtc'],
  ['buffer efemero', 'redis ttl 1h'],
];

const LABEL_WIDTH = Math.max(...BOOT_LINES.map(([label]) => label.length)) + 2;

/**
 * POST-style boot log. It is the loading state, not a splash added on top of
 * one: `onDone` fires as soon as the last line lands, so nothing is delayed
 * beyond the log itself, and reduced motion skips straight to the end.
 */
export function BootSequence({ onDone }: { onDone?: () => void }) {
  const [visible, setVisible] = useState(0);
  const doneRef = useRef(onDone);
  doneRef.current = onDone;

  useEffect(() => {
    if (visible < BOOT_LINES.length && prefersReducedMotion()) {
      setVisible(BOOT_LINES.length);
      return;
    }

    if (visible >= BOOT_LINES.length) {
      const id = window.setTimeout(() => doneRef.current?.(), TAIL_MS);
      return () => window.clearTimeout(id);
    }

    const id = window.setTimeout(() => setVisible((current) => current + 1), LINE_MS);
    return () => window.clearTimeout(id);
  }, [visible]);

  return (
    <main
      role="status"
      aria-label="Iniciando"
      className="flex min-h-dvh flex-col items-center justify-center gap-5 p-6"
    >
      <Wordmark variant="compact" className="text-[11px] sm:text-[13px]" />

      <ul className="w-full max-w-[380px] space-y-0.5 text-[12px]">
        {BOOT_LINES.slice(0, visible).map(([label, value]) => (
          <li key={label} className="flex gap-2 text-content-muted">
            <span className="text-amber-700">$</span>
            <span className="whitespace-pre">
              {label}
              {'.'.repeat(Math.max(2, LABEL_WIDTH - label.length))}
            </span>
            <span className="text-content-secondary">{value}</span>
          </li>
        ))}
        {visible < BOOT_LINES.length ? (
          <li className="flex gap-2 text-content-muted">
            <span className="text-amber-700">$</span>
            <span className="animate-caret text-amber-500">_</span>
          </li>
        ) : null}
      </ul>
    </main>
  );
}
