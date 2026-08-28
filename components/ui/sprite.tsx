import clsx from 'clsx';
import type { CSSProperties } from 'react';
import {
  SHEET_COLUMNS,
  SHEET_ROWS,
  SPRITE_SHEET,
  presetIndex,
  spriteBackgroundPosition,
} from '../../lib/sprites';

/**
 * One character, cut out of the shared sheet by background-position.
 *
 * A single request for all 24, cached once, and switching character is a style
 * change rather than a new image.
 */
export function Sprite({
  presetId,
  isDim = false,
  className,
  style,
}: {
  presetId: string;
  /** Offline or muted: still recognisable, visibly not participating. */
  isDim?: boolean;
  className?: string;
  style?: CSSProperties;
}) {
  return (
    <span
      aria-hidden
      className={clsx(
        'block h-full w-full bg-no-repeat',
        isDim && 'opacity-45 grayscale-[0.5]',
        className,
      )}
      style={{
        backgroundImage: `url(${SPRITE_SHEET})`,
        backgroundSize: `${SHEET_COLUMNS * 100}% ${SHEET_ROWS * 100}%`,
        backgroundPosition: spriteBackgroundPosition(presetIndex(presetId)),
        // The art is small and blocky; smoothing it turns it to mush.
        imageRendering: 'pixelated',
        ...style,
      }}
    />
  );
}
