import { render, screen } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { ConfigWarning } from '../../components/config-warning';

afterEach(() => {
  vi.unstubAllEnvs();
});

describe('ConfigWarning', () => {
  it('warns when the build ran without NEXT_PUBLIC_API_BASE_URL', () => {
    vi.stubEnv('NEXT_PUBLIC_API_BASE_URL', '');

    render(<ConfigWarning />);

    expect(screen.getByRole('alert')).toHaveTextContent(/NEXT_PUBLIC_API_BASE_URL/);
    expect(screen.getByRole('alert')).toHaveTextContent(/localhost:3001/);
  });

  it('stays out of the way once the URL is configured', () => {
    vi.stubEnv('NEXT_PUBLIC_API_BASE_URL', 'http://192.168.0.10:3001');

    render(<ConfigWarning />);

    expect(screen.queryByRole('alert')).not.toBeInTheDocument();
  });

  it('stays out of the way in mock mode', () => {
    vi.stubEnv('NEXT_PUBLIC_API_BASE_URL', '');
    vi.stubEnv('NEXT_PUBLIC_MOCK', '1');

    render(<ConfigWarning />);

    expect(screen.queryByRole('alert')).not.toBeInTheDocument();
  });
});
