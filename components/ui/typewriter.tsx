'use client';

import { useEffect, useState } from 'react';
import { prefersReducedMotion } from '../../lib/motion-prefs';

const CHARS_PER_FRAME = 3;
const FRAME_MS = 16;

/**
 * Types `text` out on mount when `animate` is set. Callers decide what deserves
 * it: in chat only messages that arrive live are typed, while the recovered
 * buffer renders whole — replaying an hour of history as if it were being typed
 * would be both slow and a lie about when it was said.
 */
export function Typewriter({
  text,
  animate = false,
  className,
}: {
  text: string;
  animate?: boolean;
  className?: string;
}) {
  const [revealed, setRevealed] = useState(animate ? 0 : text.length);

  useEffect(() => {
    if (!animate) return;

    // Checked here rather than during render: the media query is unavailable on
    // the server and reading it in the initial state would desync hydration.
    if (prefersReducedMotion()) {
      setRevealed(text.length);
      return;
    }

    const id = window.setInterval(() => {
      setRevealed((current) => {
        const next = current + CHARS_PER_FRAME;
        if (next >= text.length) {
          window.clearInterval(id);
          return text.length;
        }
        return next;
      });
    }, FRAME_MS);

    return () => window.clearInterval(id);
    // `animate` is decided once per message id and never flips afterwards.
  }, [animate, text.length]);

  const isDone = revealed >= text.length;

  return (
    <span className={className}>
      {isDone ? text : text.slice(0, revealed)}
      {isDone ? null : (
        <span aria-hidden className="text-amber-500">
          &#9608;
        </span>
      )}
    </span>
  );
}
