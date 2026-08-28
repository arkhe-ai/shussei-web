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

describe('VoicePanel controls', () => {
  const base = {
    isConnected: true,
    isMuted: false,
    participants: [
      { id: 'u-you', name: 'voce' },
      { id: 'u-ana', name: 'ana' },
    ],
    currentUserId: 'u-you',
    onJoin: vi.fn(),
    onLeave: vi.fn(),
    onToggleMute: vi.fn(),
  };

  it('deafens and says what that means', () => {
    const onToggleDeafen = vi.fn();
    const { rerender } = render(<VoicePanel {...base} onToggleDeafen={onToggleDeafen} />);

    fireEvent.click(screen.getByRole('button', { name: /ensurdecer/i }));
    expect(onToggleDeafen).toHaveBeenCalled();

    rerender(<VoicePanel {...base} isDeafened onToggleDeafen={onToggleDeafen} />);
    expect(screen.getByRole('button', { name: /voltar a ouvir/i })).toBeInTheDocument();
    expect(screen.getByRole('status')).toHaveTextContent(/não ouve ninguém/i);
  });

  it('switches between open mic and push-to-talk', () => {
    const onTalkModeChange = vi.fn();
    const { rerender } = render(<VoicePanel {...base} onTalkModeChange={onTalkModeChange} />);

    fireEvent.click(screen.getByRole('button', { name: 'push-to-talk' }));
    expect(onTalkModeChange).toHaveBeenCalledWith('ptt');

    rerender(<VoicePanel {...base} talkMode="ptt" onTalkModeChange={onTalkModeChange} />);
    expect(screen.getByText(/segure espaço para falar/i)).toBeInTheDocument();
  });

  it('offers volume for other people and not for yourself', () => {
    render(<VoicePanel {...base} onVolumeChange={vi.fn()} />);

    expect(screen.getByRole('slider', { name: /volume de ana/i })).toBeInTheDocument();
    expect(screen.queryByRole('slider', { name: /volume de voce/i })).not.toBeInTheDocument();
  });

  it('reports the chosen volume back as a 0..1 gain', () => {
    const onVolumeChange = vi.fn();
    render(<VoicePanel {...base} volumes={{ 'u-ana': 1 }} onVolumeChange={onVolumeChange} />);

    fireEvent.click(screen.getByRole('button', { name: /diminuir volume de ana/i }));

    expect(onVolumeChange).toHaveBeenCalledWith('u-ana', 0.95);
  });

  it('drives the volume from the keyboard, not just the mouse', () => {
    // The control is a div, not an <input type="range">, so slider semantics
    // are ours to provide rather than the browser's.
    const onVolumeChange = vi.fn();
    render(<VoicePanel {...base} volumes={{ 'u-ana': 0.5 }} onVolumeChange={onVolumeChange} />);

    const slider = screen.getByRole('slider', { name: /volume de ana/i });
    expect(slider).toHaveAttribute('aria-valuenow', '50');

    fireEvent.keyDown(slider, { key: 'ArrowRight' });
    expect(onVolumeChange).toHaveBeenCalledWith('u-ana', 0.55);

    fireEvent.keyDown(slider, { key: 'Home' });
    expect(onVolumeChange).toHaveBeenCalledWith('u-ana', 0);

    fireEvent.keyDown(slider, { key: 'End' });
    expect(onVolumeChange).toHaveBeenCalledWith('u-ana', 1);
  });

  it('keeps the device picker behind a toggle', () => {
    render(<VoicePanel {...base} onSelectInput={vi.fn()} onSelectOutput={vi.fn()} />);

    expect(screen.queryByLabelText(/entrada/i)).not.toBeInTheDocument();
    fireEvent.click(screen.getByRole('button', { name: /dispositivos/i }));
    expect(screen.getByLabelText(/entrada/i)).toBeInTheDocument();
  });
});
