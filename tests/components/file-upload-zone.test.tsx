import { fireEvent, render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, expect, it, vi } from 'vitest';
import { FileUploadZone } from '../../components/file-upload-zone';
import { UploadQueue } from '../../components/upload-queue';
import type { UploadItem } from '../../hooks/use-upload-file';

function makeFile(name: string, type = 'image/png'): File {
  return new File(['x'], name, { type });
}

function item(overrides: Partial<UploadItem> = {}): UploadItem {
  return {
    id: 'up-1',
    name: 'print.png',
    sizeBytes: 2048,
    status: 'uploading',
    progress: 0.4,
    ...overrides,
  };
}

describe('FileUploadZone', () => {
  it('forwards every picked file at once', async () => {
    const onFiles = vi.fn();
    render(<FileUploadZone onFiles={onFiles} />);

    const input = screen.getByLabelText(/escolher arquivos/i);
    await userEvent.upload(input, [makeFile('a.png'), makeFile('b.png')]);

    expect(onFiles).toHaveBeenCalledTimes(1);
    expect(onFiles.mock.calls[0][0]).toHaveLength(2);
  });

  it('clears the input so the same file can be picked twice', async () => {
    const onFiles = vi.fn();
    render(<FileUploadZone onFiles={onFiles} />);

    const input = screen.getByLabelText(/escolher arquivos/i) as HTMLInputElement;
    await userEvent.upload(input, makeFile('a.png'));

    expect(input.value).toBe('');
  });

  it('accepts a drop', () => {
    const onFiles = vi.fn();
    const { container } = render(<FileUploadZone onFiles={onFiles} />);

    const zone = container.firstElementChild!;
    fireEvent.drop(zone, { dataTransfer: { files: [makeFile('solto.png')] } });

    expect(onFiles).toHaveBeenCalledWith([expect.objectContaining({ name: 'solto.png' })]);
  });

  it('ignores a drop while disabled', () => {
    const onFiles = vi.fn();
    const { container } = render(<FileUploadZone onFiles={onFiles} disabled />);

    fireEvent.drop(container.firstElementChild!, {
      dataTransfer: { files: [makeFile('solto.png')] },
    });

    expect(onFiles).not.toHaveBeenCalled();
    expect(screen.getByRole('button', { name: /enviar/i })).toBeDisabled();
  });

  it('says nothing on an empty drop', () => {
    const onFiles = vi.fn();
    const { container } = render(<FileUploadZone onFiles={onFiles} />);

    fireEvent.drop(container.firstElementChild!, { dataTransfer: { files: [] } });

    expect(onFiles).not.toHaveBeenCalled();
  });
});

describe('UploadQueue', () => {
  const handlers = {
    onCancel: vi.fn(),
    onRetry: vi.fn(),
    onRemove: vi.fn(),
    onClearFinished: vi.fn(),
  };

  it('renders nothing while the queue is empty', () => {
    const { container } = render(<UploadQueue items={[]} {...handlers} />);

    expect(container).toBeEmptyDOMElement();
  });

  it('reports progress and offers only a cancel while in flight', () => {
    render(<UploadQueue items={[item()]} {...handlers} />);

    expect(screen.getByRole('progressbar', { name: /envio de print\.png/i })).toHaveAttribute(
      'aria-valuenow',
      '40',
    );
    expect(screen.getByRole('button', { name: 'cancelar' })).toBeInTheDocument();
    expect(screen.queryByRole('button', { name: /tentar de novo/i })).not.toBeInTheDocument();
  });

  it('offers a retry and shows why it failed', async () => {
    render(
      <UploadQueue
        items={[item({ status: 'failed', error: 'arquivo grande demais', progress: 0 })]}
        {...handlers}
      />,
    );

    expect(screen.getByText('arquivo grande demais')).toBeInTheDocument();
    expect(screen.queryByRole('progressbar')).not.toBeInTheDocument();

    await userEvent.click(screen.getByRole('button', { name: /tentar de novo/i }));
    expect(handlers.onRetry).toHaveBeenCalledWith('up-1');
  });

  it('lets a cancelled upload be retried', async () => {
    render(<UploadQueue items={[item({ status: 'cancelled', progress: 0.2 })]} {...handlers} />);

    expect(screen.getByText('cancelado')).toBeInTheDocument();
    await userEvent.click(screen.getByRole('button', { name: /tentar de novo/i }));
    expect(handlers.onRetry).toHaveBeenCalledWith('up-1');
  });

  it('clears finished rows only when there are any', async () => {
    const { rerender } = render(<UploadQueue items={[item()]} {...handlers} />);
    expect(screen.queryByRole('button', { name: /limpar concluídos/i })).not.toBeInTheDocument();

    rerender(<UploadQueue items={[item({ status: 'done', progress: 1 })]} {...handlers} />);
    await userEvent.click(screen.getByRole('button', { name: /limpar concluídos/i }));

    expect(handlers.onClearFinished).toHaveBeenCalled();
  });
});
