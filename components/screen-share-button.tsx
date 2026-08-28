'use client';

import { useState } from 'react';
import type { ScreenShareResult } from '../lib/livekit';
import { CommandButton } from './ui/command-button';

const AUDIO_PUBLISH_NOTICE =
  'Sua tela está sendo transmitida, mas o áudio do sistema não foi junto. A imagem continua no ar.';

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

      // The picture is up either way; `audioError` means audio was actually
      // attempted and lost, which is a different story from a browser that
      // never offered it.
      setNotice(audioError ? `${AUDIO_PUBLISH_NOTICE} (${audioError})` : FALLBACK_NOTICE);
    } catch (cause) {
      const name = cause instanceof Error ? cause.name : '';
      // The user dismissing the picker is not an error worth reporting.
      if (name === 'NotAllowedError' || name === 'AbortError') return;

      // Never swallow this one: a bare "could not start" leaves nothing to
      // diagnose with, and this is the path that actually fires when a share
      // fails outright.
      console.error('[shussei] compartilhamento de tela falhou', cause);
      const detail = cause instanceof Error ? `${cause.name}: ${cause.message}` : String(cause);
      setNotice(`Não foi possível iniciar o compartilhamento de tela. (${detail})`);
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
