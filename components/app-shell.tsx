'use client';

import clsx from 'clsx';
import { useRouter } from 'next/navigation';
import { useEffect, useMemo, useRef, useState } from 'react';
import { isFirstBoot, markBooted } from '../lib/boot-state';
import { isTypingTarget } from '../lib/keyboard';
import { useAudioDevices } from '../hooks/use-audio-devices';
import { useAuth } from '../hooks/use-auth';
import { useChannelActivity } from '../hooks/use-channel-activity';
import { useChannels } from '../hooks/use-channels';
import { useChat } from '../hooks/use-chat';
import { useDirectory } from '../hooks/use-directory';
import { usePresence } from '../hooks/use-presence';
import { useVoiceRoom } from '../hooks/use-voice-room';
import type { ChannelDto, VoiceParticipant } from '../lib/types';
import { BootSequence } from './boot-sequence';
import { ChannelSidebar } from './channel-sidebar';
import { ChatPanel } from './chat-panel';
import { MicMeter } from './mic-meter';
import { PresenceList } from './presence-list';
import { RoomAudio } from './room-audio';
import { ScreenShareButton } from './screen-share-button';
import { ScreenPreview, ScreenStage } from './screen-stage';
import { SpriteProvider } from './sprite-provider';
import { SpriteStrip } from './sprite-strip';
import { CommandButton } from './ui/command-button';
import { KeyHint } from './ui/key-hint';
import { LiveDot } from './ui/live-dot';
import { Panel } from './ui/panel';
import { StatusBar } from './ui/status-bar';
import { VoicePanel } from './voice-panel';

/** Long enough for the tear to register, short enough not to delay reading. */
const GLITCH_MS = 220;

export function AppShell({ initialChannelId }: { initialChannelId: string }) {
  const router = useRouter();
  // Evaluated once per mount; false for any remount after the first boot.
  const [isBooting, setIsBooting] = useState(isFirstBoot);
  const [playsIntro] = useState(isFirstBoot);
  const [isGlitching, setIsGlitching] = useState(false);

  const { user, isLoading: isAuthLoading } = useAuth();
  const { channels, isLoading: areChannelsLoading } = useChannels();
  const { onlineUserIds, channelOccupancy, isConnected } = usePresence(user?.id ?? null);
  const { usersById, isAvailable: isDirectoryAvailable } = useDirectory(user ? [user] : []);

  const activeChannel = channels.find((channel) => channel.id === initialChannelId) ?? null;
  const textChannelId = activeChannel?.type === 'text' ? activeChannel.id : null;
  const voiceChannelId = activeChannel?.type === 'voice' ? activeChannel.id : null;

  const { messages, isLoading: isChatLoading, sendMessage } = useChat(textChannelId);

  // LiveKit is the truth for who is actually publishing media; the presence
  // snapshot covers everyone the backend says is in the room.
  const occupancyParticipants: VoiceParticipant[] = (
    channelOccupancy[voiceChannelId ?? ''] ?? []
  ).map((userId) => ({ id: userId, name: usersById[userId]?.name ?? userId }));

  const voice = useVoiceRoom(voiceChannelId, {
    fallbackParticipants: occupancyParticipants,
    selfId: user?.id,
  });

  const { unreadByChannel, totalUnread } = useChannelActivity({
    activeChannelId: initialChannelId,
    currentUserId: user?.id ?? null,
    voiceChannelId: voice.connectedChannelId,
  });

  // Enumeration only returns labelled devices once a media permission is held.
  const { inputs, outputs } = useAudioDevices(voice.isConnected);

  const connectedChannel =
    channels.find((channel) => channel.id === voice.connectedChannelId) ?? null;

  /*
   * LiveKit cannot be wrong about the room you are standing in, so the sidebar
   * uses it for that one channel and the presence snapshot for every other.
   * Without this, a backend that never reports voice occupancy leaves the
   * sidebar empty even for the call you are in, and a quiet room looks exactly
   * like a broken one.
   *
   * Deliberately not fed back into `useVoiceRoom`: its fallback participants
   * come from the raw snapshot, and mixing the two would loop.
   */
  const sidebarOccupancy = useMemo(() => {
    const connected = voice.connectedChannelId;
    if (!connected) return channelOccupancy;

    const merged = new Set([
      ...(channelOccupancy[connected] ?? []),
      ...voice.participants.map((participant) => participant.id),
    ]);

    return { ...channelOccupancy, [connected]: [...merged] };
  }, [channelOccupancy, voice.connectedChannelId, voice.participants]);

  useEffect(() => {
    if (!isAuthLoading && !user) {
      router.replace('/login');
    }
  }, [isAuthLoading, user, router]);

  // The tab title is the only unread indicator that survives being in another window.
  useEffect(() => {
    document.title = totalUnread > 0 ? `(${totalUnread}) Shussei` : 'Shussei';
  }, [totalUnread]);

  // Retune the set on channel change. Skipped on first paint, where the CRT
  // power-on is already playing.
  const hasNavigatedRef = useRef(false);
  useEffect(() => {
    if (!hasNavigatedRef.current) {
      hasNavigatedRef.current = true;
      return;
    }

    setIsGlitching(true);
    const id = window.setTimeout(() => setIsGlitching(false), GLITCH_MS);
    return () => window.clearTimeout(id);
  }, [initialChannelId]);

  // Keyboard-first navigation: arrows walk channels, enter joins a voice
  // channel, M mutes, D deafens, S shares, X leaves, space is push-to-talk.
  // Ignored while typing.
  useEffect(() => {
    function handleKeyDown(event: KeyboardEvent) {
      if (event.metaKey || event.ctrlKey || event.altKey) return;
      if (isTypingTarget(event.target)) return;

      // Held keys repeat; push-to-talk must act on the first press only.
      if (event.code === 'Space' && voice.isConnected && voice.talkMode === 'ptt') {
        event.preventDefault();
        if (!event.repeat) voice.setPushToTalk(true);
        return;
      }

      if (event.key === 'ArrowDown' || event.key === 'ArrowUp') {
        if (channels.length === 0) return;
        event.preventDefault();

        const index = channels.findIndex((channel) => channel.id === initialChannelId);
        const delta = event.key === 'ArrowDown' ? 1 : -1;
        const next = channels[(index + delta + channels.length) % channels.length];
        router.push(`/channels/${next.id}`);
        return;
      }

      if (event.key === 'Enter' && voiceChannelId && !voice.isConnected) {
        event.preventDefault();
        void voice.join();
        return;
      }

      if (!voice.isConnected) return;

      const key = event.key.toLowerCase();

      if (key === 'm') {
        event.preventDefault();
        void voice.toggleMute();
        return;
      }

      if (key === 'd') {
        event.preventDefault();
        voice.toggleDeafen();
        return;
      }

      if (key === 'x') {
        event.preventDefault();
        void voice.leave();
        return;
      }

      if (key === 's') {
        event.preventDefault();
        void (voice.isSharingScreen ? voice.stopShare() : voice.startShare());
      }
    }

    function handleKeyUp(event: KeyboardEvent) {
      if (event.code !== 'Space') return;
      voice.setPushToTalk(false);
    }

    // Alt-tabbing while holding the key never delivers the keyup, which would
    // leave the microphone open on an unfocused window.
    function handleBlur() {
      voice.setPushToTalk(false);
    }

    window.addEventListener('keydown', handleKeyDown);
    window.addEventListener('keyup', handleKeyUp);
    window.addEventListener('blur', handleBlur);

    return () => {
      window.removeEventListener('keydown', handleKeyDown);
      window.removeEventListener('keyup', handleKeyUp);
      window.removeEventListener('blur', handleBlur);
    };
  }, [channels, initialChannelId, router, voice, voiceChannelId]);

  function handleSelect(channel: ChannelDto) {
    router.push(`/channels/${channel.id}`);
  }

  if (isAuthLoading || isBooting || !user) {
    return (
      <BootSequence
        onDone={() => {
          markBooted();
          setIsBooting(false);
        }}
      />
    );
  }

  const showVoiceDock =
    voice.isConnected && connectedChannel !== null && connectedChannel.id !== activeChannel?.id;

  return (
    <SpriteProvider userId={user.id}>
      <div
        className={clsx(
          'grid h-dvh grid-cols-[230px_1fr] overflow-hidden bg-base-900',
          playsIntro && 'crt-on',
        )}
      >
        <ChannelSidebar
          channels={channels}
          activeChannelId={activeChannel?.id ?? null}
          connectedVoiceChannelId={voice.connectedChannelId}
          channelOccupancy={sidebarOccupancy}
          usersById={usersById}
          unreadByChannel={unreadByChannel}
          isLoading={areChannelsLoading}
          onSelect={handleSelect}
        />

        <div className="flex min-h-0 flex-col">
          <div className="flex min-h-0 flex-1">
            <main
              className={clsx('flex min-h-0 flex-1 flex-col gap-3 p-3', isGlitching && 'glitch')}
            >
              {!activeChannel && !areChannelsLoading ? (
                <Panel label="erro" right="exit 404">
                  <p className="text-[13px] text-content-secondary">
                    Canal <span className="text-amber-300">{initialChannelId}</span> não existe ou
                    foi removido.
                  </p>
                </Panel>
              ) : null}

              {activeChannel?.type === 'text' ? (
                <ChatPanel
                  channelId={activeChannel.id}
                  channelName={activeChannel.name}
                  messages={messages}
                  onSend={sendMessage}
                  isLoading={isChatLoading}
                  currentUserId={user.id}
                  disabled={!isConnected}
                />
              ) : null}

              {activeChannel?.type === 'voice' ? (
                <>
                  <VoicePanel
                    channelName={activeChannel.name}
                    isConnected={voice.isConnected}
                    isConnecting={voice.isConnecting}
                    isMuted={voice.isMuted}
                    isDeafened={voice.isDeafened}
                    participants={voice.participants}
                    error={voice.error}
                    micStatus={voice.micStatus}
                    micLevel={voice.micLevel}
                    micWarning={voice.micWarning}
                    talkMode={voice.talkMode}
                    isPushHeld={voice.isTransmitting && voice.talkMode === 'ptt'}
                    inputs={inputs}
                    outputs={outputs}
                    inputDeviceId={voice.inputDeviceId}
                    outputDeviceId={voice.outputDeviceId}
                    volumes={voice.volumes}
                    currentUserId={user.id}
                    onJoin={voice.join}
                    onLeave={voice.leave}
                    onToggleMute={voice.toggleMute}
                    onToggleDeafen={voice.toggleDeafen}
                    onTalkModeChange={voice.setTalkMode}
                    onSelectInput={(deviceId) => void voice.selectInputDevice(deviceId)}
                    onSelectOutput={voice.selectOutputDevice}
                    onVolumeChange={voice.setParticipantVolume}
                  >
                    <ScreenShareButton
                      isSharing={voice.isSharingScreen}
                      onStart={voice.startShare}
                      onStop={voice.stopShare}
                    />
                  </VoicePanel>
                  <div className="min-h-0 flex-1 overflow-y-auto">
                    <ScreenStage feeds={voice.screenFeeds} />
                  </div>
                </>
              ) : null}
            </main>

            <PresenceList
              usersById={usersById}
              onlineUserIds={onlineUserIds}
              channelOccupancy={sidebarOccupancy}
              channels={channels}
              currentUserId={user.id}
              isDirectoryAvailable={isDirectoryAvailable}
            />
          </div>

          {voice.isConnected ? (
            <SpriteStrip
              participants={voice.participants}
              currentUserId={user.id}
              channelName={connectedChannel?.name}
            />
          ) : null}

          {showVoiceDock ? (
            <div className="flex shrink-0 flex-wrap items-center gap-3 border-t border-line bg-base-850 px-3 py-1.5">
              {voice.screenFeeds.length > 0 ? <ScreenPreview feed={voice.screenFeeds[0]} /> : null}
              <span className="flex items-center gap-2 text-[11px] text-online glow">
                <LiveDot active={voice.isTransmitting && voice.micLevel > 0.12} />
                {`)) ${connectedChannel.name}`}
              </span>
              <MicMeter level={voice.micLevel} status={voice.micStatus} segments={8} />
              <div className="ml-auto flex gap-2">
                <CommandButton hotkey="M" onClick={() => void voice.toggleMute()}>
                  {voice.isMuted ? 'Ativar' : 'Mutar'}
                </CommandButton>
                <CommandButton
                  hotkey="D"
                  tone={voice.isDeafened ? 'danger' : 'default'}
                  onClick={voice.toggleDeafen}
                >
                  {voice.isDeafened ? 'Ouvir' : 'Ensurdecer'}
                </CommandButton>
                <CommandButton hotkey="X" tone="danger" onClick={() => void voice.leave()}>
                  Desconectar
                </CommandButton>
              </div>
            </div>
          ) : null}

          <StatusBar
            userName={user.name}
            isConnected={isConnected}
            hints={
              <>
                <KeyHint keys="up/down">navegar canais</KeyHint>
                {activeChannel?.type === 'text' ? <KeyHint keys="enter">enviar</KeyHint> : null}
                {voiceChannelId && !voice.isConnected ? (
                  <KeyHint keys="enter">entrar na voz</KeyHint>
                ) : null}
                {voice.isConnected ? <KeyHint keys="M">mutar</KeyHint> : null}
                {voice.isConnected ? <KeyHint keys="D">ensurdecer</KeyHint> : null}
                {voice.isConnected && voice.talkMode === 'ptt' ? (
                  <KeyHint keys="espaço">falar</KeyHint>
                ) : null}
                {voice.isConnected && voiceChannelId ? (
                  <KeyHint keys="S">compartilhar tela</KeyHint>
                ) : null}
                {voice.screenFeeds.length > 0 ? <KeyHint keys="F">tela cheia</KeyHint> : null}
                {voice.screenFeeds.length > 1 ? <KeyHint keys="G">grade/foco</KeyHint> : null}
                {voice.isConnected ? <KeyHint keys="X">sair da voz</KeyHint> : null}
              </>
            }
          />
        </div>

        <RoomAudio
          feeds={voice.audioFeeds}
          volumes={voice.volumes}
          outputDeviceId={voice.outputDeviceId}
          isDeafened={voice.isDeafened}
        />
      </div>
    </SpriteProvider>
  );
}
