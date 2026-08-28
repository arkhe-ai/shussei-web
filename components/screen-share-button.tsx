'use client';

import { useState } from 'react';
import type { ScreenShareResult } from '../lib/livekit';
import { CommandButton } from './ui/command-button';

const AUDIO_PUBLISH_NOTICE =
  'Sua tela está sendo transmitida, mas o servidor recusou o áudio do sistema. A imagem continua no ar.';

const FALLBACK_NOTICE =
  'Compartilhando apenas a imagem: este navegador não entregou o áudio do sistema. Chrome/Edge no desktop, compartilhando uma aba ou a tela inteira, costumam permitir.';

export function ScreenShareButton({
  isSharing,
  onStart,
  onStop,
}: {
  isSharing: boolean;
  onStart: () => Promise<ScreenShareResult>;
  onStop: () => Promise<void>;
}) {
  const [notice, setNotice] = useState<string | null>(null);

  async function handleStart() {
    setNotice(null);

    try {
      const { mode, audioError } = await onStart();
      if (mode !== 'screen-only') return;

      // The browser handed over an audio track and publishing it failed: the
      // picture is up regardless, and the raw error is worth showing so it can
      // be reported rather than guessed at.
      setNotice(audioError ? `${AUDIO_PUBLISH_NOTICE} (${audioError})` : FALLBACK_NOTICE);
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
