'use client';

import clsx from 'clsx';
import type { KeyboardEvent, MouseEvent } from 'react';

const SEGMENTS = 10;
const STEP = 0.05;
const COARSE_STEP = 0.2;

function clamp(value: number): number {
  return Math.max(0, Math.min(1, Math.round(value * 100) / 100));
}

/**
 * Per-participant output gain, drawn like the rest of the terminal: bracketed
 * bar, `-` and `+` keys either side.
 *
 * A native <input type="range"> was the one control on screen with a rounded
 * thumb and a system accent, so it read as pasted in from another app. This
 * keeps the semantics — `role="slider"`, arrow keys, Home/End — and drops the
 * chrome.
 */
export function VolumeSlider({
  value,
  onChange,
  label,
}: {
  value: number;
  onChange: (value: number) => void;
  label: string;
}) {
  const current = clamp(value);
  const percent = Math.round(current * 100);
  const filled = Math.round(current * SEGMENTS);

  function handleKeyDown(event: KeyboardEvent<HTMLDivElement>) {
    const delta =
      event.key === 'ArrowRight' || event.key === 'ArrowUp'
        ? STEP
        : event.key === 'ArrowLeft' || event.key === 'ArrowDown'
          ? -STEP
          : event.key === 'PageUp'
            ? COARSE_STEP
            : event.key === 'PageDown'
              ? -COARSE_STEP
              : 0;

    if (delta !== 0) {
      event.preventDefault();
      onChange(clamp(current + delta));
      return;
    }

    if (event.key === 'Home') {
      event.preventDefault();
      onChange(0);
    } else if (event.key === 'End') {
      event.preventDefault();
      onChange(1);
    }
  }

  function handleClick(event: MouseEvent<HTMLDivElement>) {
    const bounds = event.currentTarget.getBoundingClientRect();
    if (bounds.width === 0) return;
    onChange(clamp((event.clientX - bounds.left) / bounds.width));
  }

  return (
    <span className="flex items-center gap-1">
      <Step label={`diminuir ${label}`} onClick={() => onChange(clamp(current - STEP))}>
        -
      </Step>

      <span aria-hidden className="text-[11px] text-content-muted">
        [
      </span>
      <div
        role="slider"
        aria-label={label}
        aria-valuemin={0}
        aria-valuemax={100}
        aria-valuenow={percent}
        aria-valuetext={`${percent}%`}
        tabIndex={0}
        onKeyDown={handleKeyDown}
        onClick={handleClick}
        className="focus-ring flex cursor-pointer items-center gap-[2px] py-1"
      >
        {Array.from({ length: SEGMENTS }).map((_, index) => (
          <span
            key={index}
            aria-hidden
            className={clsx(
              'h-[9px] w-[4px] transition-colors duration-75',
              index >= filled
                ? 'bg-base-600'
                : current > 1 - 1 / SEGMENTS && index === SEGMENTS - 1
                  ? 'bg-amber-300'
                  : 'bg-amber-500',
            )}
          />
        ))}
      </div>
      <span aria-hidden className="text-[11px] text-content-muted">
        ]
      </span>

      <Step label={`aumentar ${label}`} onClick={() => onChange(clamp(current + STEP))}>
        +
      </Step>

      <span className="w-[30px] shrink-0 text-right text-[10px] tabular-nums text-content-muted">
        {percent}%
      </span>
    </span>
  );
}

function Step({
  children,
  label,
  onClick,
}: {
  children: string;
  label: string;
  onClick: () => void;
}) {
  return (
    <button
      type="button"
      aria-label={label}
      onClick={onClick}
      className="focus-ring border border-line px-[5px] text-[11px] leading-[14px] text-content-muted transition-colors hover:border-line-bright hover:text-amber-300"
    >
      {children}
    </button>
  );
}
