import { render, screen } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { ConfigWarning } from '../../components/config-warning';

function setPageHost(hostname: string) {
  vi.stubGlobal('location', {
    hostname,
    origin: `http://${hostname}:3000`,
  });
}

afterEach(() => {
  vi.unstubAllEnvs();
  vi.unstubAllGlobals();
});

describe('ConfigWarning', () => {
  it('warns when the build ran without NEXT_PUBLIC_API_BASE_URL', async () => {
    vi.stubEnv('NEXT_PUBLIC_API_BASE_URL', '');
    setPageHost('localhost');

    render(<ConfigWarning />);

    expect(await screen.findByRole('alert')).toHaveTextContent(/NEXT_PUBLIC_API_BASE_URL/);
  });

  it('warns when the API points at localhost but the page is served from elsewhere', async () => {
    vi.stubEnv('NEXT_PUBLIC_API_BASE_URL', 'http://localhost:3001');
    setPageHost('100.102.91.4');

    render(<ConfigWarning />);

    const alert = await screen.findByRole('alert');
    expect(alert).toHaveTextContent(/100\.102\.91\.4/);
    // The fix command should carry the host the user actually reached.
    expect(alert).toHaveTextContent(/NEXT_PUBLIC_API_BASE_URL=http:\/\/100\.102\.91\.4:3001/);
  });

  it('stays quiet when the API host matches a real address', async () => {
    vi.stubEnv('NEXT_PUBLIC_API_BASE_URL', 'http://100.102.91.4:3001');
    setPageHost('100.102.91.4');

    render(<ConfigWarning />);

    expect(screen.queryByRole('alert')).not.toBeInTheDocument();
  });

  it('stays quiet for localhost development', async () => {
    vi.stubEnv('NEXT_PUBLIC_API_BASE_URL', 'http://localhost:3001');
    setPageHost('localhost');

    render(<ConfigWarning />);

    expect(screen.queryByRole('alert')).not.toBeInTheDocument();
  });

  it('stays quiet in mock mode', async () => {
    vi.stubEnv('NEXT_PUBLIC_API_BASE_URL', '');
    vi.stubEnv('NEXT_PUBLIC_MOCK', '1');
    setPageHost('100.102.91.4');

    render(<ConfigWarning />);

    expect(screen.queryByRole('alert')).not.toBeInTheDocument();
  });
});
