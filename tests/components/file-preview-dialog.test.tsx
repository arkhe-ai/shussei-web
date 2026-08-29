import { fireEvent, render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, expect, it, vi } from 'vitest';
import { FilePreviewDialog } from '../../components/file-browser/file-preview-dialog';
import { ApiError } from '../../lib/api';
import type { StoredFileDto } from '../../lib/types';

function file(overrides: Partial<StoredFileDto> = {}): StoredFileDto {
  return {
    id: 'file-1',
    channelId: 'text-geral',
    folderId: null,
    originalName: 'topologia.png',
    mimeType: 'image/png',
    sizeBytes: 48_120,
    createdByUserId: 'u-ana',
    createdAt: '2026-08-21T13:05:00.000Z',
    downloadUrl: '/api/v1/files/file-1',
    ...overrides,
  };
}

describe('FilePreviewDialog', () => {
  it('shows an image with its metadata and author', () => {
    render(
      <FilePreviewDialog file={file()} authorName="ana" onClose={vi.fn()} />,
    );

    expect(screen.getByAltText('topologia.png')).toHaveAttribute('src', '/files/file-1');
    expect(screen.getByText('47 KB')).toBeInTheDocument();
    expect(screen.getByText('ana')).toBeInTheDocument();
    expect(screen.getByRole('link', { name: /baixar/i })).toBeInTheDocument();
  });

  it('describes a file it will not embed instead of guessing', () => {
    render(
      <FilePreviewDialog
        file={file({ originalName: 'runbook.pdf', mimeType: 'application/pdf' })}
        onClose={vi.fn()}
      />,
    );

    expect(screen.queryByRole('img')).not.toBeInTheDocument();
    expect(screen.getByText('[PDF]')).toBeInTheDocument();
    expect(screen.getByText(/sem pré-visualização/i)).toBeInTheDocument();
    expect(screen.getByRole('link', { name: /baixar/i })).toBeInTheDocument();
  });

  it('says so when the image itself will not load', async () => {
    render(<FilePreviewDialog file={file()} onClose={vi.fn()} />);

    fireEvent.error(screen.getByAltText('topologia.png'));

    expect(await screen.findByText(/não foi possível carregar a imagem/i)).toBeInTheDocument();
  });

  it('closes on Escape', () => {
    const onClose = vi.fn();
    render(<FilePreviewDialog file={file()} onClose={onClose} />);

    fireEvent.keyDown(document, { key: 'Escape' });

    expect(onClose).toHaveBeenCalled();
  });

  it('deletes and then closes', async () => {
    const onClose = vi.fn();
    const onDelete = vi.fn().mockResolvedValue(undefined);
    render(<FilePreviewDialog file={file()} onClose={onClose} onDelete={onDelete} />);

    await userEvent.click(screen.getByRole('button', { name: /excluir/i }));

    expect(onDelete).toHaveBeenCalled();
    expect(onClose).toHaveBeenCalled();
  });

  it('stays open and reports a failed delete', async () => {
    const onClose = vi.fn();
    const onDelete = vi.fn().mockRejectedValue(new ApiError(403));
    render(<FilePreviewDialog file={file()} onClose={onClose} onDelete={onDelete} />);

    await userEvent.click(screen.getByRole('button', { name: /excluir/i }));

    expect(await screen.findByText(/sem permissão neste canal/i)).toBeInTheDocument();
    expect(onClose).not.toHaveBeenCalled();
  });

  it('omits the delete action when the caller does not offer one', () => {
    render(<FilePreviewDialog file={file()} onClose={vi.fn()} />);

    expect(screen.queryByRole('button', { name: /excluir/i })).not.toBeInTheDocument();
  });
});
