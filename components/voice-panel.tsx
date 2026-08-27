'use client';

import clsx from 'clsx';
import type { ReactNode } from 'react';
import type { VoiceParticipant } from '../lib/types';
import { CommandButton } from './ui/command-button';

export function VoicePanel({
  isConnected,
  isMuted,
  participants,
  onJoin,
  onLeave,
  onToggleMute,
  channelName,
  isConnecting = false,
  error = null,
  children,
}: {
  isConnected: boolean;
  isMuted: boolean;
  participants: VoiceParticipant[];
  onJoin: () => Promise<void> | void;
  onLeave: () => Promise<void> | void;
  onToggleMute: () => Promise<void> | void;
  channelName?: string;
  isConnecting?: boolean;
  error?: string | null;
  children?: ReactNode;
}) {
  return (
    <section className="border border-line bg-base-850">
      <header className="flex items-center justify-between gap-3 border-b border-line px-3 py-1.5">
        <h2 className="text-[11px] uppercase tracking-[0.22em] text-amber-500 glow">
          {channelName ? `)) ${channelName}` : 'Voz'}
        </h2>
        <span
          className={clsx(
            'text-[11px]',
            isConnected ? 'text-online' : 'text-content-muted',
          )}
        >
          {isConnecting
            ? 'conectando...'
            : isConnected
              ? `na sala - ${participants.length}`
              : 'desconectado'}
        </span>
      </header>

      <div className="space-y-3 p-3">
        <div className="flex flex-wrap items-center gap-2">
          {!isConnected ? (
            <CommandButton
              hotkey="enter"
              tone="primary"
              disabled={isConnecting}
              onClick={() => void onJoin()}
            >
              Entrar no canal de voz
            </CommandButton>
          ) : (
            <>
              <CommandButton hotkey="M" onClick={() => void onToggleMute()}>
                {isMuted ? 'Ativar microfone' : 'Mutar microfone'}
              </CommandButton>
              {children}
              <CommandButton hotkey="X" tone="danger" onClick={() => void onLeave()}>
                Sair do canal
              </CommandButton>
            </>
          )}
        </div>

        {error ? (
          <p role="alert" className="border border-danger-600 px-2 py-1 text-[12px] text-danger-500">
            {error}
          </p>
        ) : null}

        {participants.length > 0 ? (
          <ul className="space-y-0.5">
            {participants.map((participant) => (
              <li key={participant.id} className="flex items-center gap-2 text-[13px]">
                <span
                  className={clsx(
                    'text-[11px]',
                    participant.isSpeaking ? 'text-speaking glow' : 'text-content-muted',
                  )}
                >
                  {participant.isSpeaking ? '((*))' : '  *  '}
                </span>
                <span className="text-content-secondary">{participant.name}</span>
                {participant.isMuted ? (
                  <span className="text-[10px] uppercase tracking-wider text-content-muted">
                    mudo
                  </span>
                ) : null}
                {participant.isSharingScreen ? (
                  <span className="text-[10px] uppercase tracking-wider text-amber-500">tela</span>
                ) : null}
              </li>
            ))}
          </ul>
        ) : (
          <p className="text-[12px] text-content-muted">
            <span className="text-amber-700">$</span> ninguém neste canal ainda
          </p>
        )}
      </div>
    </section>
  );
}
