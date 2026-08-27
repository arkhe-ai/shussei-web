'use client';

import { useRouter } from 'next/navigation';
import { useEffect } from 'react';
import { useAuth } from '../hooks/use-auth';
import { useChannels } from '../hooks/use-channels';
import { useChat } from '../hooks/use-chat';
import { useDirectory } from '../hooks/use-directory';
import { usePresence } from '../hooks/use-presence';
import { useVoiceRoom } from '../hooks/use-voice-room';
import type { ChannelDto, VoiceParticipant } from '../lib/types';
import { ChannelSidebar } from './channel-sidebar';
import { ChatPanel } from './chat-panel';
import { PresenceList } from './presence-list';
import { CommandButton } from './ui/command-button';
import { KeyHint } from './ui/key-hint';
import { Panel } from './ui/panel';
import { StatusBar } from './ui/status-bar';
import { VoicePanel } from './voice-panel';

export function AppShell({ initialChannelId }: { initialChannelId: string }) {
  const router = useRouter();
  const { user, isLoading: isAuthLoading } = useAuth();
  const { channels, isLoading: areChannelsLoading } = useChannels();
  const { onlineUserIds, channelOccupancy, isConnected } = usePresence(user?.id ?? null);
  const usersById = useDirectory(user ? [user] : []);

  const activeChannel = channels.find((channel) => channel.id === initialChannelId) ?? null;
  const textChannelId = activeChannel?.type === 'text' ? activeChannel.id : null;
  const voiceChannelId = activeChannel?.type === 'voice' ? activeChannel.id : null;

  const { messages, isLoading: isChatLoading, sendMessage } = useChat(textChannelId);
  const voice = useVoiceRoom(voiceChannelId);

  const connectedChannel =
    channels.find((channel) => channel.id === voice.connectedChannelId) ?? null;

  // LiveKit is the truth for who is actually publishing media; the presence
  // snapshot covers everyone the backend says is in the room.
  const occupancyParticipants: VoiceParticipant[] = (
    channelOccupancy[voiceChannelId ?? ''] ?? []
  ).map((userId) => ({ id: userId, name: usersById[userId]?.name ?? userId }));
  const voiceParticipants =
    voice.participants.length > 0 ? voice.participants : occupancyParticipants;

  useEffect(() => {
    if (!isAuthLoading && !user) {
      router.replace('/login');
    }
  }, [isAuthLoading, user, router]);

  // Keyboard-first navigation: arrows walk channels, enter joins a voice
  // channel, M toggles the microphone. Ignored while typing.
  useEffect(() => {
    function handleKeyDown(event: KeyboardEvent) {
      if (event.metaKey || event.ctrlKey || event.altKey) return;

      const target = event.target as HTMLElement | null;
      if (
        target &&
        (target.tagName === 'INPUT' || target.tagName === 'TEXTAREA' || target.isContentEditable)
      ) {
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

      if ((event.key === 'm' || event.key === 'M') && voice.isConnected) {
        event.preventDefault();
        void voice.toggleMute();
      }
    }

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [channels, initialChannelId, router, voice, voiceChannelId]);

  function handleSelect(channel: ChannelDto) {
    router.push(`/channels/${channel.id}`);
  }

  if (isAuthLoading || !user) {
    return <BootScreen />;
  }

  const showVoiceDock =
    voice.isConnected && connectedChannel !== null && connectedChannel.id !== activeChannel?.id;

  return (
    <div className="grid h-dvh grid-cols-[230px_1fr] overflow-hidden bg-base-900">
      <ChannelSidebar
        channels={channels}
        activeChannelId={activeChannel?.id ?? null}
        connectedVoiceChannelId={voice.connectedChannelId}
        channelOccupancy={channelOccupancy}
        usersById={usersById}
        isLoading={areChannelsLoading}
        onSelect={handleSelect}
      />

      <div className="flex min-h-0 flex-col">
        <div className="flex min-h-0 flex-1">
          <main className="flex min-h-0 flex-1 flex-col gap-3 p-3">
            {!activeChannel && !areChannelsLoading ? (
              <Panel label="erro" right="exit 404">
                <p className="text-[13px] text-content-secondary">
                  Canal <span className="text-amber-300">{initialChannelId}</span> não existe ou foi
                  removido.
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
              <VoicePanel
                channelName={activeChannel.name}
                isConnected={voice.isConnected}
                isConnecting={voice.isConnecting}
                isMuted={voice.isMuted}
                participants={voiceParticipants}
                error={voice.error}
                onJoin={voice.join}
                onLeave={voice.leave}
                onToggleMute={voice.toggleMute}
              />
            ) : null}
          </main>

          <PresenceList
            usersById={usersById}
            onlineUserIds={onlineUserIds}
            channelOccupancy={channelOccupancy}
            channels={channels}
            currentUserId={user.id}
          />
        </div>

        {showVoiceDock ? (
          <div className="flex shrink-0 flex-wrap items-center gap-3 border-t border-line bg-base-850 px-3 py-1.5">
            <span className="text-[11px] text-online glow">
              {`)) ${connectedChannel.name}`}
            </span>
            <span className="text-[11px] text-content-muted">
              {voice.isMuted ? 'microfone mudo' : 'microfone ativo'}
            </span>
            <div className="ml-auto flex gap-2">
              <CommandButton hotkey="M" onClick={() => void voice.toggleMute()}>
                {voice.isMuted ? 'Ativar' : 'Mutar'}
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
            </>
          }
        />
      </div>
    </div>
  );
}

function BootScreen() {
  return (
    <main className="flex min-h-dvh items-center justify-center p-6">
      <p className="text-[13px] text-content-muted">
        <span className="text-amber-700">$</span> restaurando sessão
        <span className="animate-caret text-amber-500">_</span>
      </p>
    </main>
  );
}
