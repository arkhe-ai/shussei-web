import { fireEvent, render, screen } from '@testing-library/react';
import { describe, expect, it } from 'vitest';
import { ChatAttachment } from '../../components/chat-attachment';
import type { FileAttachmentDto } from '../../lib/types';

function attachment(overrides: Partial<FileAttachmentDto> = {}): FileAttachmentDto {
  return {
    id: 'file-1',
    originalName: 'print.png',
    mimeType: 'image/png',
    sizeBytes: 2048,
    downloadUrl: '/api/v1/files/file-1',
    ...overrides,
  };
}

describe('ChatAttachment', () => {
  it('shows an image as a preview linking to the file', () => {
    render(<ChatAttachment attachment={attachment()} />);

    const link = screen.getByRole('link');
    expect(link).toHaveAttribute('href', '/api/files/file-1');
    expect(screen.getByAltText('print.png')).toBeInTheDocument();
  });

  it('addresses the file by id, ignoring a thumbnail the MVP does not generate', () => {
    render(
      <ChatAttachment attachment={attachment({ thumbnailUrl: '/api/v1/files/file-1/thumb' })} />,
    );

    expect(screen.getByAltText('print.png')).toHaveAttribute('src', '/api/files/file-1');
    expect(screen.getByRole('link')).toHaveAttribute('href', '/api/files/file-1');
  });

  it('shows a named card with the size for anything not an image', () => {
    render(
      <ChatAttachment
        attachment={attachment({
          originalName: 'runbook.pdf',
          mimeType: 'application/pdf',
          sizeBytes: 1_284_400,
        })}
      />,
    );

    expect(screen.queryByRole('img')).not.toBeInTheDocument();
    expect(screen.getByText('runbook.pdf')).toBeInTheDocument();
    expect(screen.getByText('1.2 MB')).toBeInTheDocument();
    expect(screen.getByText('[PDF]')).toBeInTheDocument();
  });

  it('falls back to a card when the image will not load', async () => {
    render(<ChatAttachment attachment={attachment()} />);

    fireEvent.error(screen.getByAltText('print.png'));

    expect(await screen.findByText('print.png')).toBeInTheDocument();
    expect(screen.getByText('[X]')).toBeInTheDocument();
    expect(screen.queryByRole('img')).not.toBeInTheDocument();
  });

  it('opens in a new tab without leaking the referrer', () => {
    render(<ChatAttachment attachment={attachment()} />);

    const link = screen.getByRole('link');
    expect(link).toHaveAttribute('target', '_blank');
    expect(link).toHaveAttribute('rel', 'noopener noreferrer');
  });
});
