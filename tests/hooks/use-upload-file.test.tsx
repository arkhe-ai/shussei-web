import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { act, renderHook, waitFor } from '@testing-library/react';
import type { ReactNode } from 'react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { useUploadFile } from '../../hooks/use-upload-file';

function makeFile(name: string, type: string, size = 12): File {
  const file = new File(['x'], name, { type });
  // Faking the size beats allocating 30MB of ArrayBuffer to test one branch.
  Object.defineProperty(file, 'size', { value: size });
  return file;
}

function wrapper(client: QueryClient) {
  return function Wrapper({ children }: { children: ReactNode }) {
    return <QueryClientProvider client={client}>{children}</QueryClientProvider>;
  };
}

describe('useUploadFile', () => {
  let client: QueryClient;
  let fetchSpy: ReturnType<typeof vi.fn>;
  let xhrSpy: ReturnType<typeof vi.fn>;

  beforeEach(() => {
    // Mock mode is the whole point of the dispatch in `lib/upload.ts`.
    vi.stubEnv('NEXT_PUBLIC_MOCK', '1');
    client = new QueryClient({ defaultOptions: { queries: { retry: false } } });

    fetchSpy = vi.fn();
    xhrSpy = vi.fn();
    vi.stubGlobal('fetch', fetchSpy);
    vi.stubGlobal('XMLHttpRequest', xhrSpy);
  });

  afterEach(() => {
    vi.unstubAllEnvs();
    vi.unstubAllGlobals();
    client.clear();
  });

  it('reports progress, finishes, and never reaches the network in mock mode', async () => {
    const { result } = renderHook(() => useUploadFile('text-geral', null), {
      wrapper: wrapper(client),
    });

    act(() => {
      result.current.upload(makeFile('print.png', 'image/png'));
    });

    expect(result.current.items).toHaveLength(1);
    expect(result.current.items[0].status).toBe('uploading');

    await waitFor(() => expect(result.current.items[0].status).toBe('done'));
    expect(result.current.items[0].progress).toBe(1);
    expect(result.current.items[0].result?.originalName).toBe('print.png');

    expect(fetchSpy).not.toHaveBeenCalled();
    expect(xhrSpy).not.toHaveBeenCalled();
  });

  it('invalidates the folder view once the file lands', async () => {
    const invalidate = vi.spyOn(client, 'invalidateQueries');

    const { result } = renderHook(() => useUploadFile('text-geral', 'folder-prints'), {
      wrapper: wrapper(client),
    });

    act(() => {
      result.current.upload(makeFile('outro.png', 'image/png'));
    });
    await waitFor(() => expect(result.current.items[0].status).toBe('done'));

    expect(invalidate).toHaveBeenCalledWith({ queryKey: ['file-contents', 'text-geral'] });
  });

  it('rejects an oversized file locally instead of starting an upload', async () => {
    const { result } = renderHook(() => useUploadFile('text-geral', null), {
      wrapper: wrapper(client),
    });

    act(() => {
      result.current.upload(makeFile('enorme.png', 'image/png', 30 * 1024 * 1024));
    });

    await waitFor(() => expect(result.current.items[0].status).toBe('failed'));
    expect(result.current.items[0].error).toMatch(/maior que/i);
    expect(result.current.items[0].progress).toBe(0);
  });

  it('rejects an unsupported type locally', async () => {
    const { result } = renderHook(() => useUploadFile('text-geral', null), {
      wrapper: wrapper(client),
    });

    act(() => {
      result.current.upload(makeFile('macro.exe', 'application/x-msdownload'));
    });

    await waitFor(() => expect(result.current.items[0].status).toBe('failed'));
    expect(result.current.items[0].error).toMatch(/não suportado/i);
  });

  it('cancels an upload in flight', async () => {
    const { result } = renderHook(() => useUploadFile('text-geral', null), {
      wrapper: wrapper(client),
    });

    let id = '';
    act(() => {
      id = result.current.upload(makeFile('lento.png', 'image/png'));
    });

    act(() => {
      result.current.cancel(id);
    });

    await waitFor(() => expect(result.current.items[0].status).toBe('cancelled'));
  });

  it('maps a server failure to a readable message and allows a retry', async () => {
    const { result } = renderHook(() => useUploadFile('text-geral', null), {
      wrapper: wrapper(client),
    });

    let id = '';
    act(() => {
      // The mock rejects any filename carrying the failure marker.
      id = result.current.upload(makeFile('falha.png', 'image/png'));
    });

    await waitFor(() => expect(result.current.items[0].status).toBe('failed'));
    expect(result.current.items[0].error).toMatch(/falha na api \(500\)/i);

    act(() => {
      result.current.retry(id);
    });

    expect(result.current.items[0].status).toBe('uploading');
    await waitFor(() => expect(result.current.items[0].status).toBe('failed'));
  });

  it('drops finished rows and keeps the ones still running', async () => {
    const { result } = renderHook(() => useUploadFile('text-geral', null), {
      wrapper: wrapper(client),
    });

    act(() => {
      result.current.upload(makeFile('ok.png', 'image/png'));
      result.current.upload(makeFile('gigante.png', 'image/png', 30 * 1024 * 1024));
    });

    await waitFor(() => {
      expect(result.current.items.every((item) => item.status !== 'uploading')).toBe(true);
    });

    act(() => {
      result.current.clearFinished();
    });

    expect(result.current.items).toHaveLength(0);
  });
});
