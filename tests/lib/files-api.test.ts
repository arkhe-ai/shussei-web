import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { ApiError, apiFetch } from '../../lib/api';
import {
  createFolder,
  deleteFile,
  fetchFolderContents,
  fetchFolders,
  resolveDownloadUrl,
  updateFile,
} from '../../lib/files-api';

const BASE = 'http://localhost:3001';

function jsonResponse(body: unknown, status = 200): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { 'Content-Type': 'application/json' },
  });
}

function fetchMock() {
  const spy = vi.fn<typeof fetch>();
  vi.stubGlobal('fetch', spy);
  return spy;
}

function lastCall(spy: ReturnType<typeof fetchMock>) {
  const [url, init] = spy.mock.calls.at(-1)!;
  return { url: String(url), init: init as RequestInit };
}

describe('files-api', () => {
  let spy: ReturnType<typeof fetchMock>;

  beforeEach(() => {
    spy = fetchMock();
  });

  afterEach(() => {
    vi.unstubAllGlobals();
    vi.restoreAllMocks();
  });

  it('asks for the channel root with an explicit null scope', async () => {
    spy.mockResolvedValue(jsonResponse({ folders: [] }));

    await fetchFolders('text-geral', null);

    expect(lastCall(spy).url).toBe(`${BASE}/api/v1/channels/text-geral/folders?parentId=null`);
  });

  it('encodes ids that are not URL safe', async () => {
    spy.mockResolvedValue(jsonResponse({ folders: [] }));

    await fetchFolders('canal/estranho', 'pasta com espaço');

    expect(lastCall(spy).url).toBe(
      `${BASE}/api/v1/channels/canal%2Festranho/folders?parentId=pasta%20com%20espa%C3%A7o`,
    );
  });

  it('reads a folder view from three endpoints and skips the record at the root', async () => {
    spy.mockImplementation(async (input) => {
      const url = String(input);
      if (url.includes('/folders?')) return jsonResponse({ folders: [{ id: 'f-1' }] });
      if (url.includes('/files?')) return jsonResponse({ files: [{ id: 'file-1' }] });
      return jsonResponse({ folder: { id: 'f-parent' } });
    });

    const root = await fetchFolderContents('text-geral', null);

    expect(root.folder).toBeNull();
    expect(root.folders).toHaveLength(1);
    expect(root.files).toHaveLength(1);
    expect(spy).toHaveBeenCalledTimes(2);

    spy.mockClear();
    const nested = await fetchFolderContents('text-geral', 'f-parent');

    expect(nested.folder).toEqual({ id: 'f-parent' });
    expect(spy).toHaveBeenCalledTimes(3);
  });

  it('sends JSON mutations with the JSON content type', async () => {
    spy.mockResolvedValue(jsonResponse({ folder: { id: 'f-new' } }));

    await createFolder('text-geral', null, 'projetos');

    const { init } = lastCall(spy);
    expect(init.method).toBe('POST');
    expect(init.headers).toMatchObject({ 'Content-Type': 'application/json' });
    expect(JSON.parse(String(init.body))).toEqual({ parentId: null, name: 'projetos' });
  });

  it('lets the browser set the multipart boundary for FormData', async () => {
    spy.mockResolvedValue(jsonResponse({ file: { id: 'file-1' } }));

    const form = new FormData();
    form.append('file', new Blob(['x']), 'x.png');
    await apiFetch('/api/v1/channels/text-geral/files', { method: 'POST', body: form });

    expect(lastCall(spy).init.headers).not.toHaveProperty('Content-Type');
  });

  it('resolves a 204 delete instead of failing to parse an empty body', async () => {
    spy.mockResolvedValue(new Response(null, { status: 204 }));

    await expect(deleteFile('file-1')).resolves.toBeUndefined();
  });

  it('propagates the status so callers can tell 413 from 415', async () => {
    spy.mockResolvedValue(jsonResponse({ message: 'too large' }, 413));

    await expect(updateFile('file-1', { originalName: 'a' })).rejects.toMatchObject({
      name: 'ApiError',
      status: 413,
    });
    await expect(updateFile('file-1', { originalName: 'a' })).rejects.toBeInstanceOf(ApiError);
  });

  it('resolves relative download URLs against the API, not the client origin', () => {
    expect(resolveDownloadUrl('/api/v1/files/abc')).toBe(`${BASE}/api/v1/files/abc`);
    expect(resolveDownloadUrl('https://cdn.example.com/a.png')).toBe(
      'https://cdn.example.com/a.png',
    );
    expect(resolveDownloadUrl('data:image/png;base64,AAAA')).toBe('data:image/png;base64,AAAA');
  });
});
