'use client';

import clsx from 'clsx';
import { type ReactNode, useState } from 'react';
import type { AudioDevice } from '../lib/audio-devices';
import { DEFAULT_DEVICE_ID } from '../lib/audio-devices';
import type { ConnectionQuality, MicStatus, TalkMode, VoiceParticipant } from '../lib/types';
import { DevicePicker } from './device-picker';
import { LevelBars, MicMeter } from './mic-meter';
import { Avatar } from './ui/avatar';
import { CommandButton } from './ui/command-button';
import { LiveDot } from './ui/live-dot';
import { VolumeSlider } from './ui/volume-slider';

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
  isDeafened = false,
  onToggleDeafen,
  talkMode = 'open',
  onTalkModeChange,
  isPushHeld = false,
  inputs = [],
  outputs = [],
  inputDeviceId = DEFAULT_DEVICE_ID,
  outputDeviceId = DEFAULT_DEVICE_ID,
  onSelectInput,
  onSelectOutput,
  volumes = {},
  onVolumeChange,
  currentUserId,
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
  isDeafened?: boolean;
  onToggleDeafen?: () => void;
  talkMode?: TalkMode;
  onTalkModeChange?: (mode: TalkMode) => void;
  isPushHeld?: boolean;
  inputs?: AudioDevice[];
  outputs?: AudioDevice[];
  inputDeviceId?: string;
  outputDeviceId?: string;
  onSelectInput?: (deviceId: string) => void;
  onSelectOutput?: (deviceId: string) => void;
  volumes?: Record<string, number>;
  onVolumeChange?: (participantId: string, volume: number) => void;
  currentUserId?: string;
  children?: ReactNode;
}) {
  const [showDevices, setShowDevices] = useState(false);
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
              {onToggleDeafen ? (
                <CommandButton
                  hotkey="D"
                  tone={isDeafened ? 'danger' : 'default'}
                  onClick={onToggleDeafen}
                >
                  {isDeafened ? 'Voltar a ouvir' : 'Ensurdecer'}
                </CommandButton>
              ) : null}
              {children}
              <CommandButton
                hotkey="C"
                aria-expanded={showDevices}
                onClick={() => setShowDevices((current) => !current)}
              >
                Dispositivos
              </CommandButton>
              <CommandButton hotkey="X" tone="danger" onClick={() => void onLeave()}>
                Sair do canal
              </CommandButton>
            </>
          )}
        </div>

        {isConnected && onTalkModeChange ? (
          <div className="flex flex-wrap items-center gap-2 text-[11px]">
            <span className="uppercase tracking-[0.18em] text-content-muted">modo</span>
            <ModeTab
              isActive={talkMode === 'open'}
              onClick={() => onTalkModeChange('open')}
              label="aberto"
            />
            <ModeTab
              isActive={talkMode === 'ptt'}
              onClick={() => onTalkModeChange('ptt')}
              label="push-to-talk"
            />
            {talkMode === 'ptt' ? (
              <span
                className={clsx(
                  'ml-1 border px-1.5 py-0.5 text-[10px] uppercase tracking-wider',
                  isPushHeld
                    ? 'border-line-bright text-amber-300 glow'
                    : 'border-line text-content-muted',
                )}
              >
                {isPushHeld ? 'transmitindo' : 'segure espaço para falar'}
              </span>
            ) : null}
          </div>
        ) : null}

        {isConnected && showDevices && onSelectInput && onSelectOutput ? (
          <DevicePicker
            inputs={inputs}
            outputs={outputs}
            inputDeviceId={inputDeviceId}
            outputDeviceId={outputDeviceId}
            onSelectInput={onSelectInput}
            onSelectOutput={onSelectOutput}
          />
        ) : null}

        {isConnected ? (
          <div className="space-y-1 border-y border-line py-2">
            <MicMeter level={micLevel} status={micStatus} />
            {isDeafened ? (
              <p role="status" className="text-[11px] text-danger-500">
                <span className="text-danger-600">!</span> ensurdecido — você não ouve ninguém e seu
                microfone está fechado
              </p>
            ) : micWarning ? (
              <p role="status" className="text-[12px] text-warning-400">
                {micWarning}
              </p>
            ) : micStatus === 'live' ? (
              <p className="text-[11px] text-content-muted">
                <span className="text-amber-700">$</span> se as barras não se mexem quando você
                fala, o navegador está captando de outro dispositivo de entrada
              </p>
            ) : null}
          </div>
        ) : null}

        {error ? (
          <p
            role="alert"
            className="border border-danger-600 px-2 py-1 text-[12px] text-danger-500"
          >
            {error}
          </p>
        ) : null}

        {participants.length > 0 ? (
          <ul className="space-y-1">
            {participants.map((participant) => {
              const isSelf = participant.id === currentUserId;
              const level = participant.audioLevel ?? 0;

              return (
                <li key={participant.id} className="flex items-center gap-2 text-[13px]">
                  <Avatar
                    seed={participant.id}
                    name={participant.name}
                    size="md"
                    level={level}
                    isMuted={participant.isMuted}
                  />
                  <LevelBars level={level} isMuted={participant.isMuted} />
                  <span
                    className={clsx(
                      'truncate',
                      participant.isSpeaking ? 'text-amber-200 glow' : 'text-content-secondary',
                    )}
                  >
                    {participant.name}
                  </span>
                  {isSelf ? <span className="text-[10px] text-content-muted">(voce)</span> : null}
                  {participant.isMuted ? <Chip>mudo</Chip> : null}
                  {participant.isSharingScreen ? <Chip tone="accent">transmitindo</Chip> : null}

                  <span className="ml-auto flex items-center gap-3">
                    {/* Volume is an output control, so it makes no sense on your own row. */}
                    {!isSelf && onVolumeChange ? (
                      <VolumeSlider
                        label={`volume de ${participant.name}`}
                        value={volumes[participant.id] ?? 1}
                        onChange={(value) => onVolumeChange(participant.id, value)}
                      />
                    ) : null}
                    {participant.connectionQuality &&
                    participant.connectionQuality !== 'unknown' ? (
                      <span
                        className={clsx(
                          'text-[10px] uppercase tracking-wider',
                          participant.connectionQuality === 'excellent' ||
                            participant.connectionQuality === 'good'
                            ? 'text-content-muted'
                            : 'text-danger-500',
                        )}
                      >
                        rede {qualityLabel[participant.connectionQuality]}
                      </span>
                    ) : null}
                  </span>
                </li>
              );
            })}
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

function ModeTab({
  label,
  isActive,
  onClick,
}: {
  label: string;
  isActive: boolean;
  onClick: () => void;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      aria-pressed={isActive}
      className={clsx(
        'focus-ring border px-1.5 py-0.5 text-[11px] transition-colors',
        isActive
          ? 'border-amber-600 bg-amber-500 text-content-inverse'
          : 'border-line text-content-muted hover:border-line-bright hover:text-amber-300',
      )}
    >
      {label}
    </button>
  );
}

function Chip({ children, tone = 'muted' }: { children: ReactNode; tone?: 'muted' | 'accent' }) {
  return (
    <span
      className={clsx(
        'shrink-0 border px-1 text-[10px] uppercase tracking-wider',
        tone === 'accent' ? 'border-amber-700 text-amber-400' : 'border-line text-content-muted',
      )}
    >
      {children}
    </span>
  );
}
