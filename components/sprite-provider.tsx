'use client';

import { type ReactNode, createContext, useCallback, useContext, useEffect, useState } from 'react';
import { apiFetch } from '../lib/api';
import { getAppSocket } from '../lib/socket';
import { presetForSeed } from '../lib/sprites';
import type { SpriteId, UserSprites } from '../lib/types';

type SpriteContextValue = {
  ownUserId: string | null;
  ownPresetId: SpriteId | null;
  userSprites: UserSprites;
  setOwnPresetId: (presetId: SpriteId) => void;
};

const SpriteContext = createContext<SpriteContextValue>({
  ownUserId: null,
  ownPresetId: null,
  userSprites: {},
  setOwnPresetId: () => {},
});

export function SpriteProvider({
  userId,
  ownPresetId: initialPresetId = null,
  userSprites = {},
  children,
}: {
  userId: string | null;
  ownPresetId?: SpriteId | null;
  userSprites?: UserSprites;
  children: ReactNode;
}) {
  const [ownPresetId, setOwnPresetIdState] = useState<SpriteId | null>(initialPresetId);
  const [sprites, setSprites] = useState<UserSprites>(userSprites);

  useEffect(() => setOwnPresetIdState(initialPresetId), [initialPresetId]);
  useEffect(() => setSprites(userSprites), [userSprites]);

  const setOwnPresetId = useCallback((presetId: SpriteId) => {
    setOwnPresetIdState(presetId);
    setSprites((current) => ({ ...current, ...(userId ? { [userId]: presetId } : {}) }));
    void apiFetch('/api/v1/auth/me', {
      method: 'PATCH',
      body: JSON.stringify({ spriteId: presetId }),
    }).then(() => {
      getAppSocket().emit('presence.sprite.changed', { spriteId: presetId });
    }).catch(() => {
      setOwnPresetIdState(initialPresetId);
      setSprites((current) => ({ ...current, ...(userId ? { [userId]: initialPresetId } : {}) }));
    });
  }, [initialPresetId, userId]);

  return (
    <SpriteContext.Provider value={{ ownUserId: userId, ownPresetId, userSprites: sprites, setOwnPresetId }}>
      {children}
    </SpriteContext.Provider>
  );
}

export function useSpriteChoice(): SpriteContextValue { return useContext(SpriteContext); }

export function usePresetFor(seed: string): string {
  const { userSprites } = useSpriteChoice();
  return userSprites[seed] ?? presetForSeed(seed);
}
