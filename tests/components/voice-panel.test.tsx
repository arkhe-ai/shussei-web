import { fireEvent, render, screen } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';
import { VoicePanel } from '../../components/voice-panel';

describe('VoicePanel', () => {
  it('joins the room and toggles mute', async () => {
    const join = vi.fn();
    const toggleMute = vi.fn();

    const { rerender } = render(
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

    rerender(
      <VoicePanel
        isConnected
        isMuted={false}
        participants={[{ id: 'u-1', name: 'Ana' }]}
        onJoin={join}
        onLeave={vi.fn()}
        onToggleMute={toggleMute}
      />,
    );

    fireEvent.click(screen.getByRole('button', { name: /mutar microfone/i }));
    expect(toggleMute).toHaveBeenCalled();
  });

  it('surfaces connection errors', () => {
    render(
      <VoicePanel
        isConnected={false}
        isMuted={false}
        participants={[]}
        onJoin={vi.fn()}
        onLeave={vi.fn()}
        onToggleMute={vi.fn()}
        error="Permissão de microfone negada."
      />,
    );

    expect(screen.getByRole('alert')).toHaveTextContent(/microfone negada/i);
  });
});
