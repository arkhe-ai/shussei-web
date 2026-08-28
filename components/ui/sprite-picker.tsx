'use client';

import clsx from 'clsx';
import { useEffect, useRef, useState } from 'react';
import { SPRITE_PRESETS, presetForSeed } from '../../lib/sprites';
import type { SpriteId } from '../../lib/types';
import { useSpriteChoice } from '../sprite-provider';
import { Sprite } from './sprite';

/**
 * Picks your own character.
 *
 * Local only: the session DTO has nowhere to carry it, so other people still
 * see the one derived from your user id (see README, "Contract gaps").
 */
export function SpritePicker() {
  const { ownUserId, ownPresetId, setOwnPresetId } = useSpriteChoice();
  const [isOpen, setIsOpen] = useState(false);
  const rootRef = useRef<HTMLDivElement | null>(null);

  const current = ownPresetId ?? (ownUserId ? presetForSeed(ownUserId) : SPRITE_PRESETS[0].id);

  useEffect(() => {
    if (!isOpen) return;

    function handlePointerDown(event: MouseEvent) {
      if (!rootRef.current?.contains(event.target as Node)) setIsOpen(false);
    }

    function handleKeyDown(event: KeyboardEvent) {
      if (event.key === 'Escape') setIsOpen(false);
    }

    document.addEventListener('mousedown', handlePointerDown);
    document.addEventListener('keydown', handleKeyDown);
    return () => {
      document.removeEventListener('mousedown', handlePointerDown);
      document.removeEventListener('keydown', handleKeyDown);
    };
  }, [isOpen]);

  return (
    <div ref={rootRef} className="relative">
      <button
        type="button"
        aria-label="Escolher boneco"
        aria-expanded={isOpen}
        onClick={() => setIsOpen((open) => !open)}
        className="focus-ring flex items-center gap-1 text-[11px] text-content-muted transition-colors hover:text-amber-300"
      >
        <span className="block h-[18px] w-[18px]">
          <Sprite presetId={current} />
        </span>
        boneco
      </button>

      {isOpen ? (
        <div className="absolute bottom-full right-0 z-40 mb-1 w-max border border-line-bright bg-base-950 p-1.5">
          {/* Same 6x4 as the sheet, so the picker reads like the art it came from. */}
          <ul className="grid grid-cols-6 gap-1">
            {SPRITE_PRESETS.map((preset) => (
              <li key={preset.id}>
                <button
                  type="button"
                  aria-label={preset.label}
                  title={preset.label}
                  aria-pressed={preset.id === current}
                  onClick={() => {
                    setOwnPresetId(preset.id as SpriteId);
                    setIsOpen(false);
                  }}
                  className={clsx(
                    'focus-ring block border p-1 transition-colors',
                    preset.id === current
                      ? 'border-line-bright bg-base-800'
                      : 'border-transparent hover:border-line',
                  )}
                >
                  <span className="block h-[34px] w-[34px]">
                    <Sprite presetId={preset.id} />
                  </span>
                </button>
              </li>
            ))}
          </ul>
        </div>
      ) : null}
    </div>
  );
}
