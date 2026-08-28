'use client';

import { useEffect, useRef, useState } from 'react';
import { prefersReducedMotion } from '../../lib/motion-prefs';

const GLYPHS = '▓▒░#$%&/\|<>[]{}=+*-_01';
const FRAME_MS = 34;

function scrambleTail(text: string, revealed: number): string {
  let output = text.slice(0, revealed);

  for (let index = revealed; index < text.length; index += 1) {
    // Spaces stay spaces, otherwise the word shape jumps around while decoding.
    output += text[index] === ' ' ? ' ' : GLYPHS[Math.floor(Math.random() * GLYPHS.length)];
  }

  return output;
}

/**
 * Decodes `text` left to right whenever it changes — the channel header
 * "retunes" on navigation. The first render is never animated: on mount there
 * is no previous value to decode from, and a page that scrambles its own labels
 * on load just looks broken.
 */
export function Scramble({
  text,
  durationMs = 300,
  className,
}: {
  text: string;
  durationMs?: number;
  className?: string;
}) {
  const [display, setDisplay] = useState(text);
  const previousRef = useRef(text);

  useEffect(() => {
    if (previousRef.current === text) return;
    previousRef.current = text;

    if (prefersReducedMotion()) {
      setDisplay(text);
      return;
    }

    const startedAt = Date.now();
    const id = window.setInterval(() => {
      const progress = Math.min(1, (Date.now() - startedAt) / durationMs);

      if (progress >= 1) {
        window.clearInterval(id);
        setDisplay(text);
        return;
      }

      setDisplay(scrambleTail(text, Math.floor(progress * text.length)));
    }, FRAME_MS);

    return () => window.clearInterval(id);
  }, [durationMs, text]);

  // A bare <span> carries no role, so aria-label on it is unreliable: the real
  // text goes to assistive tech in its own node while the glyphs churn.
  return (
    <span className={className}>
      <span className="sr-only">{text}</span>
      <span aria-hidden>{display}</span>
    </span>
  );
}
