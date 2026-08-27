import { render, screen } from '@testing-library/react';
import { describe, expect, it } from 'vitest';
import { MicMeter } from '../../components/mic-meter';

describe('MicMeter', () => {
  it('reports the live capture level', () => {
    render(<MicMeter level={0.5} status="live" />);

    const meter = screen.getByRole('meter', { name: /nível do microfone/i });
    expect(meter).toHaveAttribute('aria-valuenow', '50');
    expect(screen.getByText('captando')).toBeInTheDocument();
  });

  it('reads zero while muted, whatever the incoming level is', () => {
    render(<MicMeter level={0.9} status="muted" />);

    expect(screen.getByRole('meter')).toHaveAttribute('aria-valuenow', '0');
    expect(screen.getByText('mudo')).toBeInTheDocument();
  });

  it('flags a microphone the browser never handed over', () => {
    render(<MicMeter level={0} status="unavailable" />);

    expect(screen.getByText('sem microfone')).toBeInTheDocument();
  });
});
