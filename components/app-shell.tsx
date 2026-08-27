'use client';

import { useRouter } from 'next/navigation';
import { useEffect } from 'react';
import { useAuth } from '../hooks/use-auth';
import { useChannels } from '../hooks/use-channels';
import { useChat } from '../hooks/use-chat';
import { useDirectory } from '../hooks/use-directory';
import { usePresence } from '../hooks/use-presence';
import type { ChannelDto } from '../lib/types';
import { ChannelSidebar } from './channel-sidebar';
import { ChatPanel } from './chat-panel';
import { PresenceList } from './presence-list';
import { KeyHint } from './ui/key-hint';
import { Panel } from './ui/panel';
import { StatusBar } from './ui/status-bar';

export function AppShell({ initialChannelId }: { initialChannelId: string }) {
  const router = useRouter();
  const { user, isLoading: isAuthLoading } = useAuth();
  const { channels, isLoading: areChannelsLoading } = useChannels();
  const { onlineUserIds, channelOccupancy, isConnected } = usePresence(user?.id ?? null);
  const usersById = useDirectory(user ? [user] : []);

  const activeChannel = channels.find((channel) => channel.id === initialChannelId) ?? null;
  const textChannelId = activeChannel?.type === 'text' ? activeChannel.id : null;
  const { messages, isLoading: isChatLoading, sendMessage } = useChat(textChannelId);

  useEffect(() => {
    if (!isAuthLoading && !user) {
      router.replace('/login');
    }
  }, [isAuthLoading, user, router]);

  // Arrow keys walk the channel list whenever focus is not inside a text field.
  useEffect(() => {
    function handleKeyDown(event: KeyboardEvent) {
      if (event.metaKey || event.ctrlKey || event.altKey) return;
      if (event.key !== 'ArrowDown' && event.key !== 'ArrowUp') return;

      const target = event.target as HTMLElement | null;
      if (
        target &&
        (target.tagName === 'INPUT' || target.tagName === 'TEXTAREA' || target.isContentEditable)
      ) {
        return;
      }

      if (channels.length === 0) return;
      event.preventDefault();

      const index = channels.findIndex((channel) => channel.id === initialChannelId);
      const delta = event.key === 'ArrowDown' ? 1 : -1;
      const next = channels[(index + delta + channels.length) % channels.length];
      router.push(`/channels/${next.id}`);
    }

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [channels, initialChannelId, router]);

  function handleSelect(channel: ChannelDto) {
    router.push(`/channels/${channel.id}`);
  }

  if (isAuthLoading || !user) {
    return <BootScreen />;
  }

  return (
    <div className="grid h-dvh grid-cols-[230px_1fr] overflow-hidden bg-base-900">
      <ChannelSidebar
        channels={channels}
        activeChannelId={activeChannel?.id ?? null}
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
              <Panel label={`)) ${activeChannel.name}`} right="canal de voz">
                <p className="text-[13px] text-content-secondary">
                  Canal de voz selecionado. Os controles de conexão entram na próxima etapa.
                </p>
              </Panel>
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

        <StatusBar
          userName={user.name}
          isConnected={isConnected}
          hints={
            <>
              <KeyHint keys="up/down">navegar canais</KeyHint>
              <KeyHint keys="enter">enviar</KeyHint>
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
