import { act, render, screen } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { ChatPanel } from '../../components/chat-panel';
import { Typewriter } from '../../components/ui/typewriter';
import type { EphemeralMessage } from '../../lib/types';

function message(id: string, body: string, sentAt: string): EphemeralMessage {
  return {
    id,
    channelId: 'general',
    body,
    sentAt,
    author: { id: 'u-1', email: 'a@a.com', name: 'Ana', avatarUrl: null },
  };
}

describe('Typewriter', () => {
  beforeEach(() => {
    vi.useFakeTimers();
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it('renders whole when not asked to animate', () => {
    render(<Typewriter text="mensagem inteira" />);

    expect(screen.getByText('mensagem inteira')).toBeInTheDocument();
  });

  it('reveals the text over time and always finishes', () => {
    const { container } = render(<Typewriter text="abcdefghijklmnop" animate />);

    expect(container.textContent).not.toContain('abcdefghijklmnop');

    act(() => {
      vi.advanceTimersByTime(200);
    });

    expect(container.textContent).toBe('abcdefghijklmnop');
  });
});

describe('ChatPanel typing', () => {
  beforeEach(() => {
    vi.useFakeTimers();
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it('types a message that just arrived', () => {
    const { container } = render(
      <ChatPanel
        channelId="general"
        messages={[message('m-live', 'acabou de chegar', new Date().toISOString())]}
        onSend={vi.fn()}
      />,
    );

    expect(container.textContent).not.toContain('acabou de chegar');

    act(() => {
      vi.advanceTimersByTime(200);
    });

    expect(screen.getByText('acabou de chegar')).toBeInTheDocument();
  });

  it('renders recovered buffer messages whole, never retyping history', () => {
    // An hour-old line from the Redis buffer is context, not something being
    // said right now — typing it out would misrepresent when it happened.
    const anHourAgo = new Date(Date.now() - 60 * 60_000).toISOString();

    render(
      <ChatPanel
        channelId="general"
        messages={[message('m-old', 'isso foi dito faz tempo', anHourAgo)]}
        onSend={vi.fn()}
      />,
    );

    expect(screen.getByText('isso foi dito faz tempo')).toBeInTheDocument();
  });
});
