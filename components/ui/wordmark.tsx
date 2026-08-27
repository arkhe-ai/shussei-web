import clsx from 'clsx';

const BANNER = [
  '█▀▀ █ █ █ █ █▀▀ █▀▀ █▀▀ █',
  '▀▀█ █▀█ █ █ ▀▀█ ▀▀█ █▀▀ █',
  '▀▀▀ ▀ ▀ ▀▀▀ ▀▀▀ ▀▀▀ ▀▀▀ ▀',
];

export function Wordmark({ className }: { className?: string }) {
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
