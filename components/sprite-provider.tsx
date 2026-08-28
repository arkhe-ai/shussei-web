'use client';

import { type ReactNode, createContext, useCallback, useContext, useEffect, useState } from 'react';
import { PREF_SPRITE, readString, writeString } from '../lib/prefs';
import { SPRITE_PRESETS, presetForSeed } from '../lib/sprites';

type SpriteContextValue = {
  ownUserId: string | null;
  ownPresetId: string | null;
  setOwnPresetId: (presetId: string) => void;
};

const SpriteContext = createContext<SpriteContextValue>({
  ownUserId: null,
  ownPresetId: null,
  setOwnPresetId: () => {},
});

/**
 * Which character *you* picked.
 *
 * Everyone else's is derived from their user id, so it is stable without any
 * storage. Only your own is a choice, and it lives in `localStorage`: the
 * backend has no field to carry it, which means other people still see your
 * id-derived default (see README, "Contract gaps").
 */
export function SpriteProvider({
  userId,
  children,
}: {
  userId: string | null;
  children: ReactNode;
}) {
  const [ownPresetId, setOwnPresetIdState] = useState<string | null>(null);

  useEffect(() => {
    const stored = readString(PREF_SPRITE);
    const isKnown = SPRITE_PRESETS.some((preset) => preset.id === stored);
    setOwnPresetIdState(isKnown ? stored : null);
  }, []);

  const setOwnPresetId = useCallback((presetId: string) => {
    setOwnPresetIdState(presetId);
    writeString(PREF_SPRITE, presetId);
  }, []);

  return (
    <SpriteContext.Provider value={{ ownUserId: userId, ownPresetId, setOwnPresetId }}>
      {children}
    </SpriteContext.Provider>
  );
}

export function useSpriteChoice(): SpriteContextValue {
  return useContext(SpriteContext);
}

/** The character to draw for `seed`: your own choice, or their id-derived one. */
export function usePresetFor(seed: string): string {
  const { ownUserId, ownPresetId } = useSpriteChoice();

  if (seed === ownUserId && ownPresetId) return ownPresetId;
  return presetForSeed(seed);
}
