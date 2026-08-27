'use client';

import clsx from 'clsx';
import type { MicStatus } from '../lib/types';
import { LiveDot } from './ui/live-dot';

const SPEAKING_THRESHOLD = 0.12;

const statusLabel: Record<MicStatus, string> = {
  idle: 'desconectado',
  live: 'captando',
  muted: 'mudo',
  unavailable: 'sem microfone',
};

/**
 * Live VU meter for the local microphone. It reads the real capture level, so a
 * flat bar while unmuted means the mic really is not picking anything up.
 */
export function MicMeter({
  level,
  status,
  segments = 12,
  label = 'mic',
  className,
}: {
  level: number;
  status: MicStatus;
  segments?: number;
  label?: string;
  className?: string;
}) {
  const clamped = Math.max(0, Math.min(1, level));
  const filled = status === 'live' ? Math.round(clamped * segments) : 0;
  const isSpeaking = status === 'live' && clamped > SPEAKING_THRESHOLD;

  return (
    <div className={clsx('flex items-center gap-2', className)}>
      <LiveDot
        active={isSpeaking}
        filled={status !== 'idle'}
        tone={
          status === 'unavailable'
            ? 'danger'
            : status === 'muted'
              ? 'muted'
              : isSpeaking
                ? 'online'
                : 'accent'
        }
      />

      <span className="text-[11px] uppercase tracking-[0.18em] text-content-muted">{label}</span>

      <span
        role="meter"
        aria-label="nível do microfone"
        aria-valuemin={0}
        aria-valuemax={100}
        aria-valuenow={status === 'live' ? Math.round(clamped * 100) : 0}
        className="flex items-center gap-[2px]"
      >
        <span aria-hidden className="text-content-muted">
          [
        </span>
        {Array.from({ length: segments }).map((_, index) => (
          <span
            key={index}
            aria-hidden
            className={clsx(
              'h-3 w-[3px] transition-colors duration-75',
              index >= filled
                ? 'bg-base-600'
                : index > segments * 0.82
                  ? 'bg-danger-500'
                  : 'bg-amber-400',
            )}
          />
        ))}
        <span aria-hidden className="text-content-muted">
          ]
        </span>
      </span>

      <span
        className={clsx(
          'text-[11px]',
          status === 'unavailable'
            ? 'text-danger-500'
            : status === 'live'
              ? 'text-content-secondary'
              : 'text-content-muted',
        )}
      >
        {statusLabel[status]}
      </span>
    </div>
  );
}

/** Compact per-participant meter used inside the room list. */
export function LevelBars({
  level,
  isMuted = false,
  segments = 5,
}: {
  level: number;
  isMuted?: boolean;
  segments?: number;
}) {
  const clamped = isMuted ? 0 : Math.max(0, Math.min(1, level));
  const filled = Math.round(clamped * segments);

  return (
    <span aria-hidden className="flex items-center gap-[2px]">
      {Array.from({ length: segments }).map((_, index) => (
        <span
          key={index}
          className={clsx(
            'w-[3px] transition-all duration-75',
            index < filled ? 'bg-amber-400' : 'bg-base-600',
            index === 0 ? 'h-[4px]' : index === 1 ? 'h-[6px]' : index === 2 ? 'h-[8px]' : 'h-[10px]',
          )}
        />
      ))}
    </span>
  );
}
