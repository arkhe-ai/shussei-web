'use client';

import { useState } from 'react';
import type { ScreenShareMode } from '../lib/types';
import { CommandButton } from './ui/command-button';

const FALLBACK_NOTICE =
  'Compartilhando apenas a imagem: este navegador não entregou o áudio do sistema. Chrome/Edge no desktop, compartilhando uma aba ou a tela inteira, costumam permitir.';

export function ScreenShareButton({
  isSharing,
  onStart,
  onStop,
}: {
  isSharing: boolean;
  onStart: () => Promise<ScreenShareMode>;
  onStop: () => Promise<void>;
}) {
  const [notice, setNotice] = useState<string | null>(null);

  async function handleStart() {
    setNotice(null);

    try {
      const mode = await onStart();
      if (mode === 'screen-only') {
        setNotice(FALLBACK_NOTICE);
      }
    } catch (cause) {
      const name = cause instanceof Error ? cause.name : '';
      // The user dismissing the picker is not an error worth reporting.
      if (name === 'NotAllowedError' || name === 'AbortError') return;
      setNotice('Não foi possível iniciar o compartilhamento de tela.');
    }
  }

  async function handleStop() {
    setNotice(null);
    await onStop();
  }

  return (
    <>
      {isSharing ? (
        <CommandButton hotkey="S" tone="danger" onClick={() => void handleStop()}>
          Parar compartilhamento
        </CommandButton>
      ) : (
        <CommandButton hotkey="S" onClick={() => void handleStart()}>
          Compartilhar tela
        </CommandButton>
      )}
      {notice ? (
        <p role="status" className="basis-full text-[12px] text-warning-400">
          {notice}
        </p>
      ) : null}
    </>
  );
}
