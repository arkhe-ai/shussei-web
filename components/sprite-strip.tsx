'use client';

import clsx from 'clsx';
import type { CSSProperties } from 'react';
import { prefersReducedMotion } from '../lib/motion-prefs';
import { SPEAKING_THRESHOLD, hopHeightFor, presetForSeed } from '../lib/sprites';
import type { UserSprites, VoiceParticipant } from '../lib/types';
import { Sprite } from './ui/sprite';

const WALKER_PX = 30;
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
 * jumps in time with their real level, and their name appears. Silence is
 * motion, speech is stillness — the inversion is what makes the talker easy to
 * pick out of a crowd of forty.
 */
export function SpriteStrip({
  participants,
  userSprites = {},
  currentUserId,
  channelName,
}: {
  participants: VoiceParticipant[];
  userSprites?: UserSprites;
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
          userSprites={userSprites}
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
  userSprites,
  index,
  total,
  isSelf,
  isStatic,
}: {
  participant: VoiceParticipant;
  userSprites: UserSprites;
  index: number;
  total: number;
  isSelf: boolean;
  isStatic: boolean;
}) {
  const presetId = userSprites[participant.id] ?? presetForSeed(participant.id);

  const level = participant.audioLevel ?? 0;
  const isTalking = !participant.isMuted && level > SPEAKING_THRESHOLD;
  const hop = hopHeightFor(level, participant.isMuted ?? false);

  const hash = hashOf(participant.id);
  const duration = MIN_WALK_S + (hash % WALK_SPREAD_S);
  // A negative delay drops each character at a different point of the same
  // loop, so nobody marches in step with anybody else.
  const delay = -(hash % (duration * 10)) / 10;

  const track: CSSProperties = isStatic
    ? { left: `${(index / Math.max(1, total)) * 88 + 4}%` }
    : {
        animation: `sprite-walk ${duration}s ease-in-out ${delay}s infinite`,
        // The keyframe stops the walk a whole character short of the wall.
        ['--walker-size' as string]: `${WALKER_PX}px`,
      };

  const motion: CSSProperties | undefined = isStatic
    ? undefined
    : isTalking
      ? ({
          animation: 'sprite-hop 0.42s ease-in-out infinite',
          ['--sprite-hop']: `${hop}px`,
        } as never)
      : { animation: `sprite-bob ${(duration / 18).toFixed(2)}s ease-in-out infinite` };

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
      <span className="relative block" style={{ width: WALKER_PX }}>
        {isTalking ? (
          <span
            className={clsx(
              'absolute -top-[12px] left-1/2 -translate-x-1/2 whitespace-nowrap text-[9px] uppercase tracking-wider glow',
              isSelf ? 'text-amber-200' : 'text-amber-300',
            )}
          >
            {participant.name}
          </span>
        ) : null}

        {/* Only the character turns around; the label must not read mirrored. */}
        <span
          className="sprite-face block"
          style={
            isStatic
              ? undefined
              : { animation: `sprite-face ${duration}s steps(1) ${delay}s infinite` }
          }
        >
          {/* Separate element: the jump must survive `sprite-halted`. */}
          <span
            className="block origin-bottom"
            style={{ width: WALKER_PX, height: WALKER_PX, ...motion }}
          >
            <Sprite key={presetId} presetId={presetId} isDim={participant.isMuted} />
          </span>
        </span>
      </span>
    </span>
  );
}
