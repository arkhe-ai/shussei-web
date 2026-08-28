import { render, screen } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { StatusBar } from '../../components/ui/status-bar';

describe('StatusBar', () => {
  beforeEach(() => {
    vi.stubEnv('NEXT_PUBLIC_API_BASE_URL', 'http://api.test');
    vi.stubEnv('NEXT_PUBLIC_MOCK', '');
  });

  it('offers a way out of the session', () => {
    render(<StatusBar hints={null} userName="ana" isConnected />);

    expect(screen.getByRole('link', { name: /sair/i })).toHaveAttribute(
      'href',
      'http://api.test/api/v1/auth/logout',
    );
  });

  it('separates connected from reconnecting', () => {
    const { rerender } = render(<StatusBar hints={null} isConnected />);
    expect(screen.getByText('conectado')).toBeInTheDocument();

    rerender(<StatusBar hints={null} isConnected={false} />);
    expect(screen.getByText('reconectando')).toBeInTheDocument();
  });

  it('exposes the notification blip as a toggle', () => {
    render(<StatusBar hints={null} isConnected />);

    expect(screen.getByRole('button', { name: /som/i })).toHaveAttribute('aria-pressed', 'true');
  });
});
