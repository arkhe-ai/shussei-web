import { fireEvent, render, screen } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';
import { ScreenShareButton } from '../../components/screen-share-button';

describe('ScreenShareButton', () => {
  it('shows fallback copy when system audio is not available', async () => {
    const start = vi.fn().mockResolvedValue('screen-only');

    render(<ScreenShareButton isSharing={false} onStart={start} onStop={vi.fn()} />);
    fireEvent.click(screen.getByRole('button', { name: /compartilhar tela/i }));

    expect(start).toHaveBeenCalled();
    expect(await screen.findByRole('status')).toHaveTextContent(/áudio do sistema/i);
  });

  it('stays quiet when system audio came through', async () => {
    const start = vi.fn().mockResolvedValue('screen+audio');

    render(<ScreenShareButton isSharing={false} onStart={start} onStop={vi.fn()} />);
    fireEvent.click(screen.getByRole('button', { name: /compartilhar tela/i }));

    await vi.waitFor(() => expect(start).toHaveBeenCalled());
    expect(screen.queryByRole('status')).not.toBeInTheDocument();
  });

  it('ignores a dismissed screen picker', async () => {
    const start = vi.fn().mockRejectedValue(Object.assign(new Error('denied'), { name: 'NotAllowedError' }));

    render(<ScreenShareButton isSharing={false} onStart={start} onStop={vi.fn()} />);
    fireEvent.click(screen.getByRole('button', { name: /compartilhar tela/i }));

    await vi.waitFor(() => expect(start).toHaveBeenCalled());
    expect(screen.queryByRole('status')).not.toBeInTheDocument();
  });
});
