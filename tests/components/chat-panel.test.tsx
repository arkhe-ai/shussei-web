import { fireEvent, render, screen } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';
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

  it('ignores empty submissions', () => {
    const sendMessage = vi.fn();

    render(<ChatPanel channelId="general" messages={[]} onSend={sendMessage} />);

    fireEvent.change(screen.getByPlaceholderText(/escreva uma mensagem/i), {
      target: { value: '   ' },
    });
    fireEvent.submit(screen.getByRole('form', { name: /chat composer/i }));
    expect(sendMessage).not.toHaveBeenCalled();
  });
});
