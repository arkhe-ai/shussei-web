import clsx from 'clsx';
import type { CSSProperties } from 'react';
import {
  BUST_HEIGHT,
  type FootState,
  type MouthState,
  SPRITE_HEIGHT,
  SPRITE_WIDTH,
  spritePaths,
} from '../../lib/sprites';

export type SpriteTone = 'normal' | 'bright' | 'dim';

/**
 * Three shades per tone. Speaking brightens the whole character rather than
 * adding a badge — at 18px an outline change is the only thing that reads.
 */
const tonePalette: Record<SpriteTone, [string, string, string]> = {
  normal: ['var(--color-amber-800)', 'var(--color-amber-500)', 'var(--color-amber-300)'],
  bright: ['var(--color-amber-700)', 'var(--color-amber-200)', 'var(--color-amber-100)'],
  dim: ['var(--color-base-500)', 'var(--color-amber-800)', 'var(--color-amber-700)'],
};

export function Sprite({
  presetId,
  mouth = 'closed',
  feet = 'together',
  crop = 'bust',
  tone = 'normal',
  isWalking = false,
  className,
  style,
}: {
  presetId: string;
  mouth?: MouthState;
  feet?: FootState;
  /** `bust` crops to head and shoulders, which is all that reads inline. */
  crop?: 'bust' | 'full';
  tone?: SpriteTone;
  isWalking?: boolean;
  className?: string;
  style?: CSSProperties;
}) {
  const [dark, base, light] = tonePalette[tone];
  const height = crop === 'bust' ? BUST_HEIGHT : SPRITE_HEIGHT;

  return (
    <svg
      aria-hidden
      viewBox={`0 0 ${SPRITE_WIDTH} ${height}`}
      shapeRendering="crispEdges"
      className={clsx('block h-full w-full', className)}
      style={style}
    >
      {isWalking ? (
        <>
          <Frame
            presetId={presetId}
            mouth={mouth}
            feet="together"
            className="sprite-step-a"
            colors={[dark, base, light]}
          />
          <Frame
            presetId={presetId}
            mouth={mouth}
            feet="apart"
            className="sprite-step-b"
            colors={[dark, base, light]}
          />
        </>
      ) : (
        <Frame presetId={presetId} mouth={mouth} feet={feet} colors={[dark, base, light]} />
      )}
    </svg>
  );
}

function Frame({
  presetId,
  mouth,
  feet,
  colors,
  className,
}: {
  presetId: string;
  mouth: MouthState;
  feet: FootState;
  colors: [string, string, string];
  className?: string;
}) {
  const paths = spritePaths(presetId, mouth, feet);
  const [dark, base, light] = colors;

  return (
    <g className={className}>
      <path d={paths['1']} fill={dark} />
      <path d={paths['2']} fill={base} />
      <path d={paths['3']} fill={light} />
    </g>
  );
}
