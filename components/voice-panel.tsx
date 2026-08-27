'use client';

import clsx from 'clsx';
import type { ReactNode } from 'react';
import type { ConnectionQuality, MicStatus, VoiceParticipant } from '../lib/types';
import { LevelBars } from './mic-meter';
import { MicMeter } from './mic-meter';
import { CommandButton } from './ui/command-button';
import { LiveDot } from './ui/live-dot';

const qualityLabel: Record<ConnectionQuality, string> = {
  excellent: 'ótima',
  good: 'boa',
  poor: 'ruim',
  lost: 'perdida',
  unknown: '',
};

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
  micStatus = 'idle',
  micLevel = 0,
  micWarning = null,
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
  micStatus?: MicStatus;
  micLevel?: number;
  micWarning?: string | null;
  children?: ReactNode;
}) {
  const speakingCount = participants.filter((participant) => participant.isSpeaking).length;

  return (
    <section className="border border-line bg-base-850">
      <header className="flex items-center justify-between gap-3 border-b border-line px-3 py-1.5">
        <h2 className="flex items-center gap-2 text-[11px] uppercase tracking-[0.22em] text-amber-500 glow">
          <LiveDot active={isConnected && speakingCount > 0} filled={isConnected} tone="online" />
          {channelName ? `)) ${channelName}` : 'Voz'}
        </h2>
        <span className={clsx('text-[11px]', isConnected ? 'text-online' : 'text-content-muted')}>
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

        {isConnected ? (
          <div className="space-y-1 border-y border-line py-2">
            <MicMeter level={micLevel} status={micStatus} />
            {micWarning ? (
              <p role="status" className="text-[12px] text-warning-400">
                {micWarning}
              </p>
            ) : micStatus === 'live' ? (
              <p className="text-[11px] text-content-muted">
                <span className="text-amber-700">$</span> se as barras não se mexem quando você fala,
                o navegador está captando de outro dispositivo de entrada
              </p>
            ) : null}
          </div>
        ) : null}

        {error ? (
          <p role="alert" className="border border-danger-600 px-2 py-1 text-[12px] text-danger-500">
            {error}
          </p>
        ) : null}

        {participants.length > 0 ? (
          <ul className="space-y-1">
            {participants.map((participant) => (
              <li key={participant.id} className="flex items-center gap-2 text-[13px]">
                <LiveDot
                  active={Boolean(participant.isSpeaking)}
                  filled={!participant.isMuted}
                  tone={participant.isMuted ? 'muted' : 'online'}
                />
                <LevelBars level={participant.audioLevel ?? 0} isMuted={participant.isMuted} />
                <span
                  className={clsx(
                    participant.isSpeaking ? 'text-amber-200 glow' : 'text-content-secondary',
                  )}
                >
                  {participant.name}
                </span>
                {participant.isMuted ? <Chip>mudo</Chip> : null}
                {participant.isSharingScreen ? <Chip tone="accent">transmitindo</Chip> : null}
                {participant.connectionQuality && participant.connectionQuality !== 'unknown' ? (
                  <span
                    className={clsx(
                      'ml-auto text-[10px] uppercase tracking-wider',
                      participant.connectionQuality === 'excellent' ||
                        participant.connectionQuality === 'good'
                        ? 'text-content-muted'
                        : 'text-danger-500',
                    )}
                  >
                    rede {qualityLabel[participant.connectionQuality]}
                  </span>
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

function Chip({ children, tone = 'muted' }: { children: ReactNode; tone?: 'muted' | 'accent' }) {
  return (
    <span
      className={clsx(
        'border px-1 text-[10px] uppercase tracking-wider',
        tone === 'accent'
          ? 'border-amber-700 text-amber-400'
          : 'border-line text-content-muted',
      )}
    >
      {children}
    </span>
  );
}
