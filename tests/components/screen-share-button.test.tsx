import { fireEvent, render, screen } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';
import { ScreenShareButton } from '../../components/screen-share-button';

function clickShare() {
  fireEvent.click(screen.getByRole('button', { name: /compartilhar tela/i }));
}

describe('ScreenShareButton', () => {
  it('shows fallback copy when system audio is not available', async () => {
    const start = vi.fn().mockResolvedValue({ mode: 'screen-only' });

    render(<ScreenShareButton isSharing={false} onStart={start} onStop={vi.fn()} />);
    clickShare();

    expect(start).toHaveBeenCalled();
    expect(await screen.findByRole('status')).toHaveTextContent(/áudio do sistema/i);
  });

  it('stays quiet when system audio came through', async () => {
    const start = vi.fn().mockResolvedValue({ mode: 'screen+audio' });

    render(<ScreenShareButton isSharing={false} onStart={start} onStop={vi.fn()} />);
    clickShare();

    await vi.waitFor(() => expect(start).toHaveBeenCalled());
    expect(screen.queryByRole('status')).not.toBeInTheDocument();
  });

  it('says the picture is still up when only the audio was rejected', async () => {
    // The browser did hand over an audio track and the SFU refused it. That is
    // a different situation from a browser that never offered audio at all, and
    // the raw error is worth showing so it can be reported rather than guessed.
    const start = vi.fn().mockResolvedValue({
      mode: 'screen-only',
      audioError: 'PublishTrackError: failed to publish',
    });

    render(<ScreenShareButton isSharing={false} onStart={start} onStop={vi.fn()} />);
    clickShare();

    const notice = await screen.findByRole('status');
    expect(notice).toHaveTextContent(/imagem continua no ar/i);
    expect(notice).toHaveTextContent(/failed to publish/i);
  });

  it('shows the real error when the share fails outright', async () => {
    // This is the path that actually fired in the field, and it used to render
    // a bare "could not start" — nothing to diagnose with.
    const start = vi
      .fn()
      .mockRejectedValue(
        Object.assign(new Error("Failed to execute 'getDisplayMedia'"), { name: 'TypeError' }),
      );

    render(<ScreenShareButton isSharing={false} onStart={start} onStop={vi.fn()} />);
    clickShare();

    const notice = await screen.findByRole('status');
    expect(notice).toHaveTextContent(/não foi possível iniciar/i);
    expect(notice).toHaveTextContent(/TypeError/);
    expect(notice).toHaveTextContent(/getDisplayMedia/);
  });

  it('ignores a dismissed screen picker', async () => {
    const start = vi
      .fn()
      .mockRejectedValue(Object.assign(new Error('denied'), { name: 'NotAllowedError' }));

    render(<ScreenShareButton isSharing={false} onStart={start} onStop={vi.fn()} />);
    clickShare();

    await vi.waitFor(() => expect(start).toHaveBeenCalled());
    expect(screen.queryByRole('status')).not.toBeInTheDocument();
  });
});
