import { fireEvent, render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, expect, it, vi } from 'vitest';
import { FileActions } from '../../components/file-browser/file-actions';
import { ApiError } from '../../lib/api';

function renderActions(overrides: Partial<Parameters<typeof FileActions>[0]> = {}) {
  const props = {
    kind: 'arquivo' as const,
    name: 'topologia.png',
    downloadHref: '/api/files/file-1',
    moveTargets: [
      { id: null, label: '#geral (raiz)' },
      { id: 'folder-prints', label: 'prints' },
    ],
    onRename: vi.fn().mockResolvedValue(undefined),
    onMove: vi.fn().mockResolvedValue(undefined),
    onDelete: vi.fn().mockResolvedValue(undefined),
    ...overrides,
  };

  render(<FileActions {...props} />);
  return props;
}

describe('FileActions', () => {
  it('renames through a dialog', async () => {
    const props = renderActions();

    await userEvent.click(screen.getByRole('button', { name: 'renomear topologia.png' }));
    const input = screen.getByLabelText(/novo nome/i);
    await userEvent.clear(input);
    await userEvent.type(input, 'diagrama.png');
    await userEvent.click(screen.getByRole('button', { name: /^renomear$/i }));

    expect(props.onRename).toHaveBeenCalledWith('diagrama.png');
  });

  it('keeps the dialog open and explains a name conflict', async () => {
    const props = renderActions({ onRename: vi.fn().mockRejectedValue(new ApiError(409)) });

    await userEvent.click(screen.getByRole('button', { name: 'renomear topologia.png' }));
    const input = screen.getByLabelText(/novo nome/i);
    await userEvent.clear(input);
    await userEvent.type(input, 'runbook.pdf');
    await userEvent.click(screen.getByRole('button', { name: /^renomear$/i }));

    expect(props.onRename).toHaveBeenCalled();
    expect(await screen.findByText(/já existe um item com esse nome/i)).toBeInTheDocument();
    expect(screen.getByRole('dialog')).toBeInTheDocument();
  });

  it('refuses a rename that changes nothing', async () => {
    renderActions();

    await userEvent.click(screen.getByRole('button', { name: 'renomear topologia.png' }));

    expect(screen.getByRole('button', { name: /^renomear$/i })).toBeDisabled();
  });

  it('closes a dialog on Escape', async () => {
    renderActions();

    await userEvent.click(screen.getByRole('button', { name: 'renomear topologia.png' }));
    expect(screen.getByRole('dialog')).toBeInTheDocument();

    fireEvent.keyDown(document, { key: 'Escape' });

    expect(screen.queryByRole('dialog')).not.toBeInTheDocument();
  });

  it('asks before deleting', async () => {
    const props = renderActions();

    await userEvent.click(screen.getByRole('button', { name: 'excluir topologia.png' }));
    expect(props.onDelete).not.toHaveBeenCalled();

    await userEvent.click(screen.getByRole('button', { name: /^excluir$/i }));
    expect(props.onDelete).toHaveBeenCalled();
  });

  it('moves to the channel root when the root option is chosen', async () => {
    const props = renderActions();

    await userEvent.click(screen.getByRole('button', { name: 'mover topologia.png' }));
    await userEvent.selectOptions(screen.getByLabelText(/destino de/i), 'root');
    await userEvent.click(screen.getByRole('button', { name: /^mover$/i }));

    expect(props.onMove).toHaveBeenCalledWith(null);
  });

  it('offers a download through the same-origin proxy', () => {
    renderActions();

    expect(screen.getByRole('link', { name: 'baixar topologia.png' })).toHaveAttribute(
      'href',
      '/api/files/file-1',
    );
  });

  it('has no download action for a folder', () => {
    renderActions({ kind: 'pasta', name: 'infra', downloadHref: undefined });

    expect(screen.queryByRole('link', { name: /baixar/i })).not.toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'excluir infra' })).toBeInTheDocument();
  });
});
