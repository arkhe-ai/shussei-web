import clsx from 'clsx';

/**
 * Analog snow for a feed that stopped delivering frames. Rendered over the
 * frozen <video> rather than replacing it, so playback resumes into place the
 * moment frames come back.
 */
export function SignalLost({
  className,
  compact = false,
}: {
  className?: string;
  compact?: boolean;
}) {
  return (
    <div
      role="status"
      className={clsx('snow absolute inset-0 z-20 flex items-center justify-center', className)}
    >
      <span
        className={clsx(
          'border border-danger-600 bg-base-950/85 uppercase tracking-[0.22em] text-danger-500',
          compact ? 'px-1 py-0.5 text-[8px]' : 'px-2 py-1 text-[11px]',
        )}
      >
        sem sinal
      </span>
    </div>
  );
}
