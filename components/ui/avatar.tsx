'use client';

import clsx from 'clsx';
import { hopHeightFor, presetForSeed } from '../../lib/sprites';
import { useSpriteChoice } from '../sprite-provider';
import { Sprite } from './sprite';

const sizeClass = {
  sm: 'h-[20px] w-[20px]',
  md: 'h-[28px] w-[28px]',
  lg: 'h-[44px] w-[44px]',
} as const;

export type AvatarSize = keyof typeof sizeClass;

/**
 * A person, as their chosen character.
 *
 * `level` (0..1) drives both the jump and a phosphor ring, so the avatar is a
 * meter and not a binary "is speaking" badge — it is the same number the level
 * bars render, which is why a flat mic stands still.
 */
export function Avatar({
  seed,
  name,
  size = 'sm',
  level = 0,
  isMuted = false,
  isOffline = false,
  className,
}: {
  /** Stable identity for the character; the user id wherever one is known. */
  seed: string;
  name: string;
  size?: AvatarSize;
  level?: number;
  isMuted?: boolean;
  isOffline?: boolean;
  className?: string;
}) {
  const { ownUserId, ownPresetId } = useSpriteChoice();

  const presetId = seed === ownUserId && ownPresetId ? ownPresetId : presetForSeed(seed);
  const clamped = isMuted || isOffline ? 0 : Math.max(0, Math.min(1, level));
  const hop = hopHeightFor(clamped, isMuted);

  return (
    <span
      title={name}
      className={clsx('relative inline-block shrink-0', sizeClass[size], className)}
      style={
        hop > 0
          ? {
              filter: `drop-shadow(0 0 ${(2 + clamped * 5).toFixed(1)}px color-mix(in srgb, var(--color-speaking) ${Math.round(
                35 + clamped * 45,
              )}%, transparent))`,
            }
          : undefined
      }
    >
      <span
        className="block h-full w-full origin-bottom"
        style={
          hop > 0
            ? ({
                animation: 'sprite-hop 0.42s ease-in-out infinite',
                '--sprite-hop': `${hop}px`,
              } as never)
            : undefined
        }
      >
        <Sprite presetId={presetId} isDim={isOffline || isMuted} />
      </span>
    </span>
  );
}
