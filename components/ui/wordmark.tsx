import clsx from 'clsx';

/**
 * Block-capital banner, the way a terminal tool prints its own name on start.
 * `compact` is the three-row version used where vertical space is tight.
 */
const BANNER = [
  '███████ ██   ██ ██    ██ ███████ ███████ ███████ ██',
  '██      ██   ██ ██    ██ ██      ██      ██      ██',
  '███████ ███████ ██    ██ ███████ ███████ █████   ██',
  '     ██ ██   ██ ██    ██      ██      ██ ██      ██',
  '███████ ██   ██  ██████  ███████ ███████ ███████ ██',
];

const COMPACT_BANNER = [
  '█▀▀ █ █ █ █ █▀▀ █▀▀ █▀▀ █',
  '▀▀█ █▀█ █ █ ▀▀█ ▀▀█ █▀▀ █',
  '▀▀▀ ▀ ▀ ▀▀▀ ▀▀▀ ▀▀▀ ▀▀▀ ▀',
];

export function Wordmark({
  className,
  variant = 'banner',
}: {
  className?: string;
  variant?: 'banner' | 'compact' | 'inline';
}) {
  if (variant === 'inline') {
    return (
      <span
        className={clsx(
          'select-none text-[15px] uppercase tracking-[0.34em] text-amber-500 glow-strong',
          className,
        )}
      >
        Shussei
      </span>
    );
  }

  return (
    <pre
      aria-label="Shussei"
      role="img"
      className={clsx('select-none text-amber-500 glow-strong leading-[1.05]', className)}
    >
      {(variant === 'compact' ? COMPACT_BANNER : BANNER).join('\n')}
    </pre>
  );
}
