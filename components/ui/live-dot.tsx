import clsx from 'clsx';

type Tone = 'online' | 'danger' | 'muted' | 'accent';

const toneClass: Record<Tone, string> = {
  online: 'text-online',
  danger: 'text-danger-500',
  muted: 'text-content-muted',
  accent: 'text-amber-400',
};

/**
 * The blinking status dot. `active` drives the blink, so a steady dot means
 * "connected but idle" and a blinking one means "something is happening now".
 */
export function LiveDot({
  active = false,
  tone = 'online',
  filled = true,
  className,
}: {
  active?: boolean;
  tone?: Tone;
  filled?: boolean;
  className?: string;
}) {
  return (
    <span
      aria-hidden
      className={clsx(
        'text-[10px] leading-none',
        toneClass[tone],
        active && 'animate-blink glow',
        className,
      )}
    >
      {filled ? '●' : '○'}
    </span>
  );
}
