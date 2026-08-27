import { render, screen } from '@testing-library/react';
import { describe, expect, it } from 'vitest';
import LoginPage from '../../app/login/page';

describe('LoginPage', () => {
  it('shows the Google login call to action and browser support note', () => {
    render(<LoginPage />);

    expect(screen.getByRole('link', { name: /entrar com google/i })).toHaveAttribute(
      'href',
      'http://localhost:3001/api/v1/auth/google',
    );
    expect(screen.getByText(/chrome/i)).toBeInTheDocument();
  });
});
