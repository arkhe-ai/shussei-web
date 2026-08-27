import clsx from 'clsx';

const BANNER = [
  '█▀▀ █ █ █ █ █▀▀ █▀▀ █▀▀ █',
  '▀▀█ █▀█ █ █ ▀▀█ ▀▀█ █▀▀ █',
  '▀▀▀ ▀ ▀ ▀▀▀ ▀▀▀ ▀▀▀ ▀▀▀ ▀',
];

export function Wordmark({
  className,
  variant = 'banner',
}: {
  className?: string;
  variant?: 'banner' | 'inline';
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
      {BANNER.join('\n')}
    </pre>
  );
}
