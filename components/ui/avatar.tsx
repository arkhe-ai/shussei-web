'use client';

import clsx from 'clsx';
import { useSpriteChoice } from '../sprite-provider';
import { mouthForLevel, presetForSeed } from '../../lib/sprites';
import { Sprite } from './sprite';

const sizeClass = {
  sm: 'h-[20px] w-[18px]',
  md: 'h-[30px] w-[26px]',
  lg: 'h-[48px] w-[40px]',
} as const;

export type AvatarSize = keyof typeof sizeClass;

/**
 * A person, as a pixel character.
 *
 * `level` (0..1) drives both the mouth and a phosphor ring, so the avatar is a
 * meter and not a binary "is speaking" badge — it is the same number the level
 * bars render, which is why a flat mic shows a shut mouth.
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
  // Below this the ring is visual noise rather than information.
  const isRinging = clamped > 0.08;

  return (
    <span
      title={name}
      className={clsx('relative inline-block shrink-0', sizeClass[size], className)}
      style={
        isRinging
          ? {
              boxShadow: `0 0 ${(2 + clamped * 6).toFixed(1)}px color-mix(in srgb, var(--color-speaking) ${Math.round(
                30 + clamped * 45,
              )}%, transparent)`,
            }
          : undefined
      }
    >
      <Sprite
        presetId={presetId}
        mouth={mouthForLevel(clamped, isMuted)}
        tone={isOffline ? 'dim' : isRinging ? 'bright' : 'normal'}
      />
    </span>
  );
}
