# Shussei Web Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Build the `arkhe-ai/shussei-web` Next.js client that authenticates users, renders channels, shows ephemeral chat and presence, and connects to LiveKit rooms for voice and screen sharing.

**Architecture:** The web app is a Next.js App Router application that talks to the NestJS backend over HTTP and Socket.IO, keeping app state in React Query and lightweight local stores. LiveKit client SDK handles media room transport, while the app shell owns auth gating, channel navigation, chat, presence, and browser-specific screen sharing UX.

**Tech Stack:** Next.js, React, TypeScript, Tailwind CSS, Socket.IO client, TanStack Query, LiveKit client SDK, Vitest, React Testing Library, Playwright smoke test

**Spec:** `/home/matumoto/docs/superpowers/specs/2026-08-27-private-discord-mvp-design.md`

## Global Constraints

- Web application
- Single private organization/community
- Up to 100 total users
- Roughly 20–40 concurrent users in voice
- Google OAuth login
- Access control by backend-maintained allowlist
- Channel list with text and voice channels
- Ephemeral text chat delivered in real time
- User presence indicators
- Voice calls in channels
- Screen sharing
- System audio sharing when browser/OS support exists
- Self-hosted deployment
- no tenant routing
- no organization switching
- no permanent history
- low perceived latency is a core requirement
- official support target: Chrome desktop and Edge desktop
- other browsers are best-effort only for the MVP
- system audio sharing may not be available everywhere
- graceful handling of reconnects is required

---

## Planned File Structure

### Repository root: `shussei-web/`

- `package.json` — dependency manifest and scripts
- `next.config.ts` — Next config
- `tsconfig.json` — TypeScript config
- `.env.example` — frontend environment variables
- `app/layout.tsx` — root layout and providers
- `app/page.tsx` — redirects based on auth state
- `app/login/page.tsx` — login screen with Google CTA and browser support note
- `app/access-denied/page.tsx` — unauthorized message
- `app/channels/[channelId]/page.tsx` — main channel page
- `app/globals.css` — global styles
- `components/app-shell.tsx` — sidebar + main layout
- `components/channel-sidebar.tsx` — text and voice channel list
- `components/presence-list.tsx` — online users and voice occupancy
- `components/chat-panel.tsx` — message list and composer
- `components/voice-panel.tsx` — join voice, mute, disconnect
- `components/screen-share-button.tsx` — start/stop screen sharing with compatibility fallback
- `components/browser-support-note.tsx` — Chromium recommendation banner
- `lib/api.ts` — typed backend HTTP client
- `lib/auth.ts` — auth redirects and `getCurrentUser`
- `lib/socket.ts` — Socket.IO singleton and event bindings
- `lib/livekit.ts` — room connect/disconnect and track publishing helpers
- `lib/types.ts` — shared frontend DTOs matching backend contracts
- `hooks/use-auth.ts` — current user query
- `hooks/use-channels.ts` — channels query
- `hooks/use-chat.ts` — ephemeral message query and socket subscription
- `hooks/use-presence.ts` — presence snapshot and change subscription
- `hooks/use-voice-room.ts` — room connection and participant state
- `tests/components/chat-panel.test.tsx` — chat panel test
- `tests/components/voice-panel.test.tsx` — voice panel test
- `tests/e2e/login.spec.ts` — browser smoke test

## Backend Contracts This Repo Consumes

### REST
- `GET ${NEXT_PUBLIC_API_BASE_URL}/api/v1/auth/me` → `{ user: SessionUser | null }`
- `GET ${NEXT_PUBLIC_API_BASE_URL}/api/v1/channels` → `{ channels: ChannelDto[] }`
- `GET ${NEXT_PUBLIC_API_BASE_URL}/api/v1/channels/:channelId/messages` → `{ messages: EphemeralMessage[] }`
- `POST ${NEXT_PUBLIC_API_BASE_URL}/api/v1/channels/:channelId/voice-token` → `{ token: string; roomName: string; wsUrl: string }`

### Socket.IO namespace `/app`
Client emits:
- `presence.identify` with payload `{ userId: string }`
- `chat.send` with payload `{ channelId: string; body: string }`
- `voice.join` with payload `{ channelId: string }`
- `voice.leave` with payload `{ channelId: string }`

Server emits:
- `presence.snapshot` with payload `{ onlineUserIds: string[]; channelOccupancy: Record<string, string[]> }`
- `presence.changed` with payload `{ userId: string; status: 'online' | 'offline'; channelId: string | null }`
- `chat.message` with payload `EphemeralMessage`
- `chat.recent` with payload `{ channelId: string; messages: EphemeralMessage[] }`

### Shared DTOs
```ts
export type SessionUser = {
  id: string;
  email: string;
  name: string;
  avatarUrl: string | null;
};

export type ChannelDto = {
  id: string;
  name: string;
  type: 'text' | 'voice';
  position: number;
};

export type EphemeralMessage = {
  id: string;
  channelId: string;
  author: SessionUser;
  body: string;
  sentAt: string;
};
```

### Task 1: Bootstrap the Next.js app shell and typed API client

**Files:**
- Create: `shussei-web/package.json`
- Create: `shussei-web/next.config.ts`
- Create: `shussei-web/tsconfig.json`
- Create: `shussei-web/.env.example`
- Create: `shussei-web/app/layout.tsx`
- Create: `shussei-web/app/page.tsx`
- Create: `shussei-web/app/globals.css`
- Create: `shussei-web/lib/types.ts`
- Create: `shussei-web/lib/api.ts`
- Create: `shussei-web/tests/components/smoke.test.tsx`

**Interfaces:**
- Consumes: none
- Produces: `apiFetch<T>(path: string, init?: RequestInit): Promise<T>`, `SessionUser`, `ChannelDto`, `EphemeralMessage`

- [x] **Step 1: Write the failing API client test**

```ts
import { describe, expect, it, vi } from 'vitest';
import { apiFetch } from '../../lib/api';

describe('apiFetch', () => {
  it('prefixes requests with NEXT_PUBLIC_API_BASE_URL', async () => {
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue({ ok: true, json: async () => ({ ok: true }) }));
    vi.stubEnv('NEXT_PUBLIC_API_BASE_URL', 'http://localhost:3001');

    await apiFetch('/api/v1/health');

    expect(fetch).toHaveBeenCalledWith('http://localhost:3001/api/v1/health', expect.any(Object));
  });
});
```

- [x] **Step 2: Run the test to verify it fails**

Run: `npm test -- tests/components/smoke.test.tsx`
Expected: FAIL with `Cannot find module '../../lib/api'`

- [x] **Step 3: Create the app shell, DTOs, and API client**

```ts
// lib/types.ts
export type SessionUser = {
  id: string;
  email: string;
  name: string;
  avatarUrl: string | null;
};

export type ChannelDto = {
  id: string;
  name: string;
  type: 'text' | 'voice';
  position: number;
};

export type EphemeralMessage = {
  id: string;
  channelId: string;
  author: SessionUser;
  body: string;
  sentAt: string;
};
```

```ts
// lib/api.ts
export async function apiFetch<T>(path: string, init?: RequestInit): Promise<T> {
  const baseUrl = process.env.NEXT_PUBLIC_API_BASE_URL;
  const response = await fetch(`${baseUrl}${path}`, {
    ...init,
    credentials: 'include',
    headers: {
      'Content-Type': 'application/json',
      ...(init?.headers ?? {}),
    },
  });

  if (!response.ok) {
    throw new Error(`api_error:${response.status}`);
  }

  return response.json() as Promise<T>;
}
```

```tsx
// app/page.tsx
import { redirect } from 'next/navigation';

export default function HomePage() {
  redirect('/login');
}
```

- [x] **Step 4: Re-run the test and verify it passes**

Run: `npm test -- tests/components/smoke.test.tsx`
Expected: PASS

- [x] **Step 5: Commit**

```bash
git add package.json next.config.ts tsconfig.json .env.example app lib tests
git commit -m "feat(web): bootstrap next app shell"
```

### Task 2: Add auth gating, login page, and access denied page

**Files:**
- Create: `shussei-web/lib/auth.ts`
- Create: `shussei-web/hooks/use-auth.ts`
- Create: `shussei-web/components/browser-support-note.tsx`
- Create: `shussei-web/app/login/page.tsx`
- Create: `shussei-web/app/access-denied/page.tsx`
- Create: `shussei-web/tests/components/login-page.test.tsx`
- Modify: `shussei-web/app/layout.tsx`

**Interfaces:**
- Consumes: `apiFetch<{ user: SessionUser | null }>`
- Produces: `getCurrentUser(): Promise<SessionUser | null>`, `buildGoogleLoginUrl(): string`, `useAuth(): { user: SessionUser | null; isLoading: boolean }`

- [x] **Step 1: Write the failing login page test**

```tsx
import { render, screen } from '@testing-library/react';
import LoginPage from '../../app/login/page';

describe('LoginPage', () => {
  it('shows the Google login call to action and browser support note', () => {
    render(<LoginPage />);

    expect(screen.getByRole('link', { name: /entrar com google/i })).toHaveAttribute(
      'href',
      'http://localhost:3001/api/v1/auth/google',
    );
    expect(screen.getByText(/chrome/i)).toBeInTheDocument();
  });
});
```

- [x] **Step 2: Run the test to verify it fails**

Run: `npm test -- tests/components/login-page.test.tsx`
Expected: FAIL with missing `app/login/page`

- [x] **Step 3: Implement auth helpers and login UI**

```ts
// lib/auth.ts
import { apiFetch } from './api';
import type { SessionUser } from './types';

export function buildGoogleLoginUrl() {
  return `${process.env.NEXT_PUBLIC_API_BASE_URL}/api/v1/auth/google`;
}

export async function getCurrentUser(): Promise<SessionUser | null> {
  const data = await apiFetch<{ user: SessionUser | null }>('/api/v1/auth/me');
  return data.user;
}
```

```tsx
// components/browser-support-note.tsx
export function BrowserSupportNote() {
  return (
    <p>
      Suporte oficial neste MVP: Chrome e Edge no desktop. Outros navegadores funcionam em best effort.
    </p>
  );
}
```

```tsx
// app/login/page.tsx
import { BrowserSupportNote } from '../../components/browser-support-note';
import { buildGoogleLoginUrl } from '../../lib/auth';

export default function LoginPage() {
  return (
    <main>
      <h1>Shussei</h1>
      <a href={buildGoogleLoginUrl()}>Entrar com Google</a>
      <BrowserSupportNote />
    </main>
  );
}
```

- [x] **Step 4: Add `useAuth` and the access denied page, then re-run tests**

```ts
// hooks/use-auth.ts
'use client';

import { useQuery } from '@tanstack/react-query';
import { getCurrentUser } from '../lib/auth';

export function useAuth() {
  const query = useQuery({ queryKey: ['auth', 'me'], queryFn: getCurrentUser });
  return { user: query.data ?? null, isLoading: query.isLoading };
}
```

```tsx
// app/access-denied/page.tsx
export default function AccessDeniedPage() {
  return (
    <main>
      <h1>Acesso não liberado</h1>
      <p>Seu e-mail não está na lista de acesso do Shussei.</p>
    </main>
  );
}
```

Run: `npm test -- tests/components/login-page.test.tsx`
Expected: PASS

- [x] **Step 5: Commit**

```bash
git add app/login app/access-denied components lib hooks app/layout.tsx tests/components/login-page.test.tsx
git commit -m "feat(web): add auth entry flow"
```

### Task 3: Add the channel shell, presence hooks, and ephemeral text chat UI

**Files:**
- Create: `shussei-web/components/app-shell.tsx`
- Create: `shussei-web/components/channel-sidebar.tsx`
- Create: `shussei-web/components/presence-list.tsx`
- Create: `shussei-web/components/chat-panel.tsx`
- Create: `shussei-web/hooks/use-channels.ts`
- Create: `shussei-web/hooks/use-chat.ts`
- Create: `shussei-web/hooks/use-presence.ts`
- Create: `shussei-web/lib/socket.ts`
- Create: `shussei-web/app/channels/[channelId]/page.tsx`
- Create: `shussei-web/tests/components/chat-panel.test.tsx`

**Interfaces:**
- Consumes: `/api/v1/channels`, `/api/v1/channels/:channelId/messages`, Socket.IO events `presence.snapshot`, `presence.changed`, `chat.message`
- Produces: `useChannels(): { channels: ChannelDto[]; isLoading: boolean }`, `useChat(channelId: string): { messages: EphemeralMessage[]; sendMessage(body: string): void }`, `usePresence(userId: string): { onlineUserIds: string[]; channelOccupancy: Record<string, string[]> }`

- [x] **Step 1: Write the failing chat panel test**

```tsx
import { fireEvent, render, screen } from '@testing-library/react';
import { ChatPanel } from '../../components/chat-panel';

describe('ChatPanel', () => {
  it('renders recent messages and sends new ones', () => {
    const sendMessage = vi.fn();

    render(
      <ChatPanel
        channelId="general"
        messages={[
          {
            id: 'm-1',
            channelId: 'general',
            body: 'hello team',
            sentAt: '2026-08-27T12:00:00.000Z',
            author: { id: 'u-1', email: 'a@a.com', name: 'Ana', avatarUrl: null },
          },
        ]}
        onSend={sendMessage}
      />,
    );

    expect(screen.getByText('hello team')).toBeInTheDocument();
    fireEvent.change(screen.getByPlaceholderText(/escreva uma mensagem/i), {
      target: { value: 'new message' },
    });
    fireEvent.submit(screen.getByRole('form', { name: /chat composer/i }));
    expect(sendMessage).toHaveBeenCalledWith('new message');
  });
});
```

- [x] **Step 2: Run the test to verify it fails**

Run: `npm test -- tests/components/chat-panel.test.tsx`
Expected: FAIL with missing `components/chat-panel`

- [x] **Step 3: Implement the Socket.IO client, hooks, and chat panel**

```ts
// lib/socket.ts
import { io, Socket } from 'socket.io-client';

let socket: Socket | null = null;

export function getAppSocket() {
  if (!socket) {
    socket = io(`${process.env.NEXT_PUBLIC_API_BASE_URL}/app`, {
      withCredentials: true,
      transports: ['websocket'],
    });
  }

  return socket;
}
```

```ts
// hooks/use-chat.ts
'use client';

import { useEffect, useMemo, useState } from 'react';
import { apiFetch } from '../lib/api';
import { getAppSocket } from '../lib/socket';
import type { EphemeralMessage } from '../lib/types';

export function useChat(channelId: string) {
  const [messages, setMessages] = useState<EphemeralMessage[]>([]);

  useEffect(() => {
    apiFetch<{ messages: EphemeralMessage[] }>(`/api/v1/channels/${channelId}/messages`).then((data) => {
      setMessages(data.messages);
    });

    const socket = getAppSocket();
    const handler = (message: EphemeralMessage) => {
      if (message.channelId === channelId) {
        setMessages((current) => [...current, message]);
      }
    };

    socket.on('chat.message', handler);
    return () => {
      socket.off('chat.message', handler);
    };
  }, [channelId]);

  return useMemo(
    () => ({
      messages,
      sendMessage: (body: string) => getAppSocket().emit('chat.send', { channelId, body }),
    }),
    [channelId, messages],
  );
}
```

```tsx
// components/chat-panel.tsx
'use client';

import { FormEvent, useState } from 'react';
import type { EphemeralMessage } from '../lib/types';

export function ChatPanel({
  channelId,
  messages,
  onSend,
}: {
  channelId: string;
  messages: EphemeralMessage[];
  onSend: (body: string) => void;
}) {
  const [body, setBody] = useState('');

  function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!body.trim()) return;
    onSend(body.trim());
    setBody('');
  }

  return (
    <section>
      <ul>
        {messages.map((message) => (
          <li key={message.id}>{message.body}</li>
        ))}
      </ul>
      <form aria-label="chat composer" onSubmit={handleSubmit}>
        <input
          placeholder="Escreva uma mensagem"
          value={body}
          onChange={(event) => setBody(event.target.value)}
        />
        <button type="submit">Enviar</button>
      </form>
    </section>
  );
}
```

- [x] **Step 4: Add the channel page composition and re-run tests**

```tsx
// app/channels/[channelId]/page.tsx
import { AppShell } from '../../../components/app-shell';

export default async function ChannelPage({ params }: { params: Promise<{ channelId: string }> }) {
  const { channelId } = await params;
  return <AppShell initialChannelId={channelId} />;
}
```

Run: `npm test -- tests/components/chat-panel.test.tsx`
Expected: PASS

- [x] **Step 5: Commit**

```bash
git add app/channels components hooks lib tests/components/chat-panel.test.tsx
git commit -m "feat(web): add channels and chat shell"
```

### Task 4: Add voice room join/mute UI with LiveKit client helpers

**Files:**
- Create: `shussei-web/lib/livekit.ts`
- Create: `shussei-web/hooks/use-voice-room.ts`
- Create: `shussei-web/components/voice-panel.tsx`
- Create: `shussei-web/tests/components/voice-panel.test.tsx`
- Modify: `shussei-web/components/app-shell.tsx`

**Interfaces:**
- Consumes: `POST /api/v1/channels/:channelId/voice-token`, `voice.join`, `voice.leave`
- Produces: `connectToVoiceRoom(channelId: string): Promise<{ roomName: string }>`, `useVoiceRoom(channelId: string): { isConnected: boolean; isMuted: boolean; join(): Promise<void>; leave(): Promise<void>; toggleMute(): Promise<void> }`

- [x] **Step 1: Write the failing voice panel test**

```tsx
import { fireEvent, render, screen } from '@testing-library/react';
import { VoicePanel } from '../../components/voice-panel';

describe('VoicePanel', () => {
  it('joins the room and toggles mute', async () => {
    const join = vi.fn();
    const toggleMute = vi.fn();

    render(
      <VoicePanel
        isConnected={false}
        isMuted={false}
        participants={[{ id: 'u-1', name: 'Ana' }]}
        onJoin={join}
        onLeave={vi.fn()}
        onToggleMute={toggleMute}
      />,
    );

    fireEvent.click(screen.getByRole('button', { name: /entrar no canal de voz/i }));
    expect(join).toHaveBeenCalled();
  });
});
```

- [x] **Step 2: Run the test to verify it fails**

Run: `npm test -- tests/components/voice-panel.test.tsx`
Expected: FAIL with missing `components/voice-panel`

- [x] **Step 3: Implement LiveKit connection helpers and `VoicePanel`**

```ts
// lib/livekit.ts
import { Room, RoomEvent, createLocalAudioTrack } from 'livekit-client';
import { apiFetch } from './api';

export async function connectToVoiceRoom(channelId: string) {
  const { token, wsUrl, roomName } = await apiFetch<{ token: string; wsUrl: string; roomName: string }>(
    `/api/v1/channels/${channelId}/voice-token`,
    { method: 'POST' },
  );

  const room = new Room();
  await room.connect(wsUrl, token);
  const audioTrack = await createLocalAudioTrack();
  await room.localParticipant.publishTrack(audioTrack);

  return { room, roomName };
}

export async function setMicrophoneEnabled(room: Room, enabled: boolean) {
  await room.localParticipant.setMicrophoneEnabled(enabled);
}
```

```tsx
// components/voice-panel.tsx
'use client';

export function VoicePanel({
  isConnected,
  isMuted,
  participants,
  onJoin,
  onLeave,
  onToggleMute,
}: {
  isConnected: boolean;
  isMuted: boolean;
  participants: Array<{ id: string; name: string }>;
  onJoin: () => Promise<void> | void;
  onLeave: () => Promise<void> | void;
  onToggleMute: () => Promise<void> | void;
}) {
  return (
    <section>
      <h2>Voz</h2>
      {!isConnected ? (
        <button onClick={() => void onJoin()}>Entrar no canal de voz</button>
      ) : (
        <>
          <button onClick={() => void onLeave()}>Sair do canal</button>
          <button onClick={() => void onToggleMute()}>{isMuted ? 'Ativar microfone' : 'Mutar microfone'}</button>
        </>
      )}
      <ul>
        {participants.map((participant) => (
          <li key={participant.id}>{participant.name}</li>
        ))}
      </ul>
    </section>
  );
}
```

- [x] **Step 4: Implement `useVoiceRoom` and re-run tests**

```ts
// hooks/use-voice-room.ts
'use client';

import { Room } from 'livekit-client';
import { useState } from 'react';
import { getAppSocket } from '../lib/socket';
import { connectToVoiceRoom, setMicrophoneEnabled } from '../lib/livekit';

export function useVoiceRoom(channelId: string) {
  const [room, setRoom] = useState<Room | null>(null);
  const [isMuted, setIsMuted] = useState(false);

  return {
    isConnected: room !== null,
    isMuted,
    participants: [],
    async join() {
      const connection = await connectToVoiceRoom(channelId);
      setRoom(connection.room);
      getAppSocket().emit('voice.join', { channelId });
    },
    async leave() {
      room?.disconnect();
      setRoom(null);
      getAppSocket().emit('voice.leave', { channelId });
    },
    async toggleMute() {
      if (!room) return;
      await setMicrophoneEnabled(room, isMuted);
      setIsMuted((current) => !current);
    },
  };
}
```

Run: `npm test -- tests/components/voice-panel.test.tsx`
Expected: PASS

- [x] **Step 5: Commit**

```bash
git add components/voice-panel.tsx hooks/use-voice-room.ts lib/livekit.ts components/app-shell.tsx tests/components/voice-panel.test.tsx
git commit -m "feat(web): add voice room controls"
```

### Task 5: Add screen sharing controls, reconnect UX, and a browser smoke test

**Files:**
- Create: `shussei-web/components/screen-share-button.tsx`
- Create: `shussei-web/tests/components/screen-share-button.test.tsx`
- Create: `shussei-web/tests/e2e/login.spec.ts`
- Modify: `shussei-web/lib/livekit.ts`
- Modify: `shussei-web/hooks/use-voice-room.ts`
- Modify: `shussei-web/components/voice-panel.tsx`

**Interfaces:**
- Consumes: connected `Room` from `useVoiceRoom`
- Produces: `startScreenShare(room: Room): Promise<'screen+audio' | 'screen-only'>`, `stopScreenShare(room: Room): Promise<void>`

- [x] **Step 1: Write the failing screen-share button test**

```tsx
import { fireEvent, render, screen } from '@testing-library/react';
import { ScreenShareButton } from '../../components/screen-share-button';

describe('ScreenShareButton', () => {
  it('shows fallback copy when system audio is not available', () => {
    const start = vi.fn().mockResolvedValue('screen-only');

    render(<ScreenShareButton isSharing={false} onStart={start} onStop={vi.fn()} />);
    fireEvent.click(screen.getByRole('button', { name: /compartilhar tela/i }));

    expect(start).toHaveBeenCalled();
  });
});
```

- [x] **Step 2: Run the test to verify it fails**

Run: `npm test -- tests/components/screen-share-button.test.tsx`
Expected: FAIL with missing `components/screen-share-button`

- [x] **Step 3: Implement screen share helpers and UI**

```ts
// lib/livekit.ts
import { LocalVideoTrack, Room, Track } from 'livekit-client';

export async function startScreenShare(room: Room) {
  const stream = await navigator.mediaDevices.getDisplayMedia({
    video: true,
    audio: true,
  });

  const videoTrack = stream.getVideoTracks()[0];
  const audioTrack = stream.getAudioTracks()[0] ?? null;

  await room.localParticipant.publishTrack(new LocalVideoTrack(videoTrack));
  if (audioTrack) {
    await room.localParticipant.publishTrack(audioTrack as any);
    return 'screen+audio' as const;
  }

  return 'screen-only' as const;
}

export async function stopScreenShare(room: Room) {
  room.localParticipant.videoTrackPublications.forEach((publication) => publication.track?.stop());
}
```

```tsx
// components/screen-share-button.tsx
'use client';

import { useState } from 'react';

export function ScreenShareButton({
  isSharing,
  onStart,
  onStop,
}: {
  isSharing: boolean;
  onStart: () => Promise<'screen+audio' | 'screen-only'>;
  onStop: () => Promise<void>;
}) {
  const [notice, setNotice] = useState<string | null>(null);

  async function handleStart() {
    const mode = await onStart();
    if (mode === 'screen-only') {
      setNotice('Seu navegador compartilhou apenas a tela, sem áudio do sistema.');
    }
  }

  return (
    <div>
      {isSharing ? (
        <button onClick={() => void onStop()}>Parar compartilhamento</button>
      ) : (
        <button onClick={() => void handleStart()}>Compartilhar tela</button>
      )}
      {notice ? <p>{notice}</p> : null}
    </div>
  );
}
```

- [x] **Step 4: Add a Playwright smoke test and run the suite**

```ts
import { test, expect } from '@playwright/test';

test('login page renders the Google CTA', async ({ page }) => {
  await page.goto('/login');
  await expect(page.getByRole('link', { name: 'Entrar com Google' })).toBeVisible();
});
```

Run: `npm test && npx playwright test tests/e2e/login.spec.ts`
Expected: PASS

- [x] **Step 5: Commit**

```bash
git add components/screen-share-button.tsx lib/livekit.ts hooks/use-voice-room.ts components/voice-panel.tsx tests/e2e/login.spec.ts
git commit -m "feat(web): add screen sharing ux"
```

## Spec Coverage Check

- Login with Google and private access framing: Task 2
- Channel list with text and voice navigation: Task 3
- Ephemeral text chat with recent-message recovery: Task 3
- Presence display and reconnect-ready socket flow: Task 3
- Voice channel join, mute, and participant shell: Task 4
- Screen sharing and system-audio fallback messaging: Task 5
- Chrome/Edge desktop support note: Task 2

## Placeholder Scan

Search after writing for red-flag placeholder phrases in `/home/matumoto/docs/superpowers/plans/2026-08-27-shussei-web.md`.
Expected: no matches.
