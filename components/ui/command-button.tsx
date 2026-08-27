import clsx from 'clsx';
import type { ComponentProps, ReactNode } from 'react';

type Tone = 'default' | 'primary' | 'danger';

const toneClass: Record<Tone, string> = {
  default:
    'border-line text-content-secondary hover:border-line-bright hover:text-amber-300 hover:bg-base-800',
  primary:
    'border-amber-600 text-amber-300 hover:bg-amber-500 hover:text-content-inverse hover:border-amber-500',
  danger:
    'border-danger-600 text-danger-500 hover:bg-danger-500 hover:text-content-inverse hover:border-danger-500',
};

const base =
  'focus-ring inline-flex select-none items-center gap-2 border px-2.5 py-1 text-[13px] leading-tight transition-colors disabled:cursor-not-allowed disabled:opacity-40';

/**
 * `[K] Label` — the bracketed action control used across the app.
 * The bracket is decorative; the label carries the accessible name.
 */
export function CommandButton({
  hotkey,
  tone = 'default',
  className,
  children,
  ...props
}: ComponentProps<'button'> & { hotkey?: string; tone?: Tone; children: ReactNode }) {
  return (
    <button type="button" className={clsx(base, toneClass[tone], className)} {...props}>
      {hotkey ? <Bracket>{hotkey}</Bracket> : null}
      <span>{children}</span>
    </button>
  );
}

export function CommandLink({
  hotkey,
  tone = 'default',
  className,
  children,
  ...props
}: ComponentProps<'a'> & { hotkey?: string; tone?: Tone; children: ReactNode }) {
  return (
    <a className={clsx(base, toneClass[tone], className)} {...props}>
      {hotkey ? <Bracket>{hotkey}</Bracket> : null}
      <span>{children}</span>
    </a>
  );
}

function Bracket({ children }: { children: ReactNode }) {
  return (
    <span aria-hidden className="text-content-muted">
      [{children}]
    </span>
  );
}
