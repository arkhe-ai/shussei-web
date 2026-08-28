'use client';

import clsx from 'clsx';
import { prefersReducedMotion } from '../lib/motion-prefs';
import { mouthForLevel } from '../lib/sprites';
import type { VoiceParticipant } from '../lib/types';
import { usePresetFor } from './sprite-provider';
import { Sprite } from './ui/sprite';

const SPRITE_PX = 22;
const MIN_WALK_S = 13;
const WALK_SPREAD_S = 10;

function hashOf(value: string): number {
  let hash = 0;
  for (const char of value) {
    hash = (hash * 31 + char.charCodeAt(0)) >>> 0;
  }
  return hash;
}

/**
 * The room, as characters pacing along the bottom of the window.
 *
 * Everyone walks until they say something: a speaker stops where they are,
 * their mouth tracks their real level, and their name appears. Silence is
 * motion, speech is stillness — the inversion is what makes the talker easy to
 * pick out of a crowd of forty.
 */
export function SpriteStrip({
  participants,
  currentUserId,
  channelName,
}: {
  participants: VoiceParticipant[];
  currentUserId?: string;
  channelName?: string;
}) {
  if (participants.length === 0) return null;

  // With motion off, the walk would collapse to its end state and stack
  // everyone on the right edge; a plain row is the honest fallback.
  const isStatic = prefersReducedMotion();

  return (
    <div
      aria-hidden
      className="relative h-[58px] shrink-0 overflow-hidden border-t border-line bg-base-950"
    >
      <span className="pointer-events-none absolute left-3 top-1.5 text-[10px] uppercase tracking-[0.22em] text-content-muted">
        {channelName ? `)) ${channelName}` : 'sala'} · {participants.length}
      </span>

      {/* the floor they walk on */}
      <span className="pointer-events-none absolute inset-x-0 bottom-[7px] border-b border-line/50" />

      {participants.map((participant, index) => (
        <Walker
          key={participant.id}
          participant={participant}
          index={index}
          total={participants.length}
          isSelf={participant.id === currentUserId}
          isStatic={isStatic}
        />
      ))}
    </div>
  );
}

function Walker({
  participant,
  index,
  total,
  isSelf,
  isStatic,
}: {
  participant: VoiceParticipant;
  index: number;
  total: number;
  isSelf: boolean;
  isStatic: boolean;
}) {
  const presetId = usePresetFor(participant.id);

  const level = participant.audioLevel ?? 0;
  const isTalking = !participant.isMuted && level > 0.12;

  const hash = hashOf(participant.id);
  const duration = MIN_WALK_S + (hash % WALK_SPREAD_S);
  // A negative delay drops each character at a different point of the same
  // loop, so nobody marches in step with anybody else.
  const delay = -(hash % (duration * 10)) / 10;

  const track = isStatic
    ? { left: `${(index / Math.max(1, total)) * 88 + 4}%` }
    : { animation: `sprite-walk ${duration}s ease-in-out ${delay}s infinite` };

  return (
    <span
      className={clsx(
        'absolute bottom-[7px]',
        isStatic ? '' : 'inset-x-3',
        isTalking && 'sprite-halted',
      )}
      style={track}
    >
      {/*
       * Sized to the character on purpose. The travelling track above is as wide
       * as the strip, and anchoring to it meant `scaleX(-1)` flipped a
       * strip-wide box — throwing the sprite clean off the right edge on every
       * turn — and centred the name on the strip instead of on the person.
       */}
      <span className="relative block w-[22px]">
        {isTalking ? (
          <span
            className={clsx(
              'absolute -top-[13px] left-1/2 -translate-x-1/2 whitespace-nowrap text-[9px] uppercase tracking-wider glow',
              isSelf ? 'text-amber-200' : 'text-amber-300',
            )}
          >
            {participant.name}
          </span>
        ) : null}

        {/* Only the character turns around; the label must not read mirrored. */}
        <span
          className="block h-[34px] w-[22px]"
          style={
            isStatic
              ? undefined
              : { animation: `sprite-face ${duration}s steps(1) ${delay}s infinite` }
          }
        >
          <Sprite
            presetId={presetId}
            crop="full"
            mouth={mouthForLevel(level, participant.isMuted ?? false)}
            tone={participant.isMuted ? 'dim' : isTalking ? 'bright' : 'normal'}
            isWalking={!isStatic}
          />
        </span>
      </span>
    </span>
  );
}
