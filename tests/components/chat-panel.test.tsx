import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { ChatPanel } from '../../components/chat-panel';
import type { EphemeralMessage } from '../../lib/types';

function renderPanel(props: Partial<Parameters<typeof ChatPanel>[0]> = {}) {
  const onSend = vi.fn();
  const client = new QueryClient({ defaultOptions: { queries: { retry: false } } });

  render(
    <QueryClientProvider client={client}>
      <ChatPanel channelId="general" messages={[]} onSend={onSend} {...props} />
    </QueryClientProvider>,
  );

  return { onSend };
}

function message(overrides: Partial<EphemeralMessage> = {}): EphemeralMessage {
  return {
    id: 'm-1',
    channelId: 'general',
    body: 'hello team',
    sentAt: '2026-08-27T12:00:00.000Z',
    author: { id: 'u-1', email: 'a@a.com', name: 'Ana', avatarUrl: null },
    ...overrides,
  };
}

describe('ChatPanel', () => {
  beforeEach(() => {
    // The composer uploads through `lib/upload.ts`; mock mode keeps that off
    // the network without stubbing the hook out of the test.
    vi.stubEnv('NEXT_PUBLIC_MOCK', '1');
  });

  afterEach(() => {
    vi.unstubAllEnvs();
  });

  it('renders recent messages and sends new ones', () => {
    const { onSend } = renderPanel({ messages: [message()] });

    expect(screen.getByText('hello team')).toBeInTheDocument();
    fireEvent.change(screen.getByPlaceholderText(/escreva uma mensagem/i), {
      target: { value: 'new message' },
    });
    fireEvent.submit(screen.getByRole('form', { name: /chat composer/i }));

    expect(onSend).toHaveBeenCalledWith('new message', []);
  });

  it('ignores empty submissions', () => {
    const { onSend } = renderPanel();

    fireEvent.change(screen.getByPlaceholderText(/escreva uma mensagem/i), {
      target: { value: '   ' },
    });
    fireEvent.submit(screen.getByRole('form', { name: /chat composer/i }));

    expect(onSend).not.toHaveBeenCalled();
  });

  it('ignores malformed attachment entries instead of crashing the chat', () => {
    renderPanel({
      messages: [message({ attachments: [undefined, null] as unknown as EphemeralMessage['attachments'] })],
    });

    expect(screen.getByText('hello team')).toBeInTheDocument();
  });

  it('renders an image attachment as a link to the file', () => {
    renderPanel({
      messages: [
        message({
          body: 'olha isso',
          attachments: [
            {
              id: 'file-1',
              originalName: 'print.png',
              mimeType: 'image/png',
              sizeBytes: 2048,
              downloadUrl: '/api/v1/files/file-1',
            },
          ],
        }),
      ],
    });

    expect(screen.getByText('olha isso')).toBeInTheDocument();
    expect(screen.getByAltText('print.png')).toBeInTheDocument();
  });

  it('renders a non-image attachment as a named card', () => {
    renderPanel({
      messages: [
        message({
          body: '',
          attachments: [
            {
              id: 'file-2',
              originalName: 'runbook.pdf',
              mimeType: 'application/pdf',
              sizeBytes: 1024,
              downloadUrl: '/api/v1/files/file-2',
            },
          ],
        }),
      ],
    });

    expect(screen.getByText('runbook.pdf')).toBeInTheDocument();
    expect(screen.getByText('[PDF]')).toBeInTheDocument();
    expect(screen.queryByRole('img')).not.toBeInTheDocument();
  });

  it('sends an attachment with no text at all', async () => {
    const { onSend } = renderPanel();

    await userEvent.upload(
      screen.getByLabelText(/escolher arquivos/i),
      new File(['x'], 'print.png', { type: 'image/png' }),
    );

    const chip = await screen.findByLabelText('anexos prontos');
    expect(chip).toHaveTextContent('print.png');

    fireEvent.submit(screen.getByRole('form', { name: /chat composer/i }));

    expect(onSend).toHaveBeenCalledTimes(1);
    expect(onSend.mock.calls[0][0]).toBe('');
    expect(onSend.mock.calls[0][1]).toHaveLength(1);
  });

  it('sends text and attachments together, then clears both', async () => {
    const { onSend } = renderPanel();

    await userEvent.upload(
      screen.getByLabelText(/escolher arquivos/i),
      new File(['x'], 'print.png', { type: 'image/png' }),
    );
    await screen.findByLabelText('anexos prontos');

    const input = screen.getByPlaceholderText(/escreva uma mensagem/i);
    await userEvent.type(input, 'segue o print');
    fireEvent.submit(screen.getByRole('form', { name: /chat composer/i }));

    expect(onSend.mock.calls[0][0]).toBe('segue o print');
    expect(onSend.mock.calls[0][1]).toHaveLength(1);
    expect(input).toHaveValue('');
    expect(screen.queryByLabelText('anexos prontos')).not.toBeInTheDocument();
  });

  it('holds the send while an upload is still running', async () => {
    renderPanel();

    await userEvent.upload(
      screen.getByLabelText(/escolher arquivos/i),
      new File(['x'], 'demorado.png', { type: 'image/png' }),
    );

    expect(screen.getByRole('button', { name: 'Enviar' })).toBeDisabled();
    await waitFor(() =>
      expect(screen.getByRole('button', { name: 'Enviar' })).not.toBeDisabled(),
    );
  });

  it('keeps a failed upload out of the message but leaves it retryable', async () => {
    const { onSend } = renderPanel();

    await userEvent.upload(
      screen.getByLabelText(/escolher arquivos/i),
      new File(['x'], 'falha.png', { type: 'image/png' }),
    );

    expect(await screen.findByText('falhou')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /tentar de novo/i })).toBeInTheDocument();
    expect(screen.queryByLabelText('anexos prontos')).not.toBeInTheDocument();

    await userEvent.type(screen.getByPlaceholderText(/escreva uma mensagem/i), 'vai sem anexo');
    fireEvent.submit(screen.getByRole('form', { name: /chat composer/i }));

    expect(onSend).toHaveBeenCalledWith('vai sem anexo', []);
  });

  it('drops a pending attachment when it is dismissed', async () => {
    const { onSend } = renderPanel();

    await userEvent.upload(
      screen.getByLabelText(/escolher arquivos/i),
      new File(['x'], 'print.png', { type: 'image/png' }),
    );
    await screen.findByLabelText('anexos prontos');

    await userEvent.click(screen.getByRole('button', { name: /remover anexo print\.png/i }));

    expect(screen.queryByLabelText('anexos prontos')).not.toBeInTheDocument();
    fireEvent.submit(screen.getByRole('form', { name: /chat composer/i }));
    expect(onSend).not.toHaveBeenCalled();
  });
});
