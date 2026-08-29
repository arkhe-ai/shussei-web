import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { FileBrowser } from '../../components/file-browser/file-browser';
import { ApiError } from '../../lib/api';
import type { FolderDto, StoredFileDto } from '../../lib/types';

const push = vi.fn();
let searchParams = new URLSearchParams();

vi.mock('next/navigation', () => ({
  useRouter: () => ({ push }),
  useSearchParams: () => searchParams,
}));

const { fetchFolderContents, fetchBreadcrumbs } = vi.hoisted(() => ({
  fetchFolderContents: vi.fn(),
  fetchBreadcrumbs: vi.fn(),
}));

vi.mock('../../lib/files-api', async (importOriginal) => ({
  ...(await importOriginal<typeof import('../../lib/files-api')>()),
  fetchFolderContents,
  fetchBreadcrumbs,
}));

function folder(overrides: Partial<FolderDto> = {}): FolderDto {
  return {
    id: 'folder-infra',
    channelId: 'text-geral',
    parentId: null,
    name: 'infra',
    createdByUserId: 'u-ana',
    createdAt: '2026-08-20T10:00:00.000Z',
    updatedAt: '2026-08-20T10:00:00.000Z',
    ...overrides,
  };
}

function file(overrides: Partial<StoredFileDto> = {}): StoredFileDto {
  return {
    id: 'file-1',
    channelId: 'text-geral',
    folderId: null,
    originalName: 'topologia.png',
    mimeType: 'image/png',
    sizeBytes: 48_120,
    createdByUserId: 'u-ana',
    createdAt: '2026-08-21T10:00:00.000Z',
    downloadUrl: '/api/v1/files/file-1',
    ...overrides,
  };
}

function renderBrowser() {
  const client = new QueryClient({ defaultOptions: { queries: { retry: false } } });

  return render(
    <QueryClientProvider client={client}>
      <FileBrowser channelId="text-geral" channelName="geral" />
    </QueryClientProvider>,
  );
}

describe('FileBrowser', () => {
  beforeEach(() => {
    push.mockClear();
    searchParams = new URLSearchParams();
    fetchBreadcrumbs.mockResolvedValue([]);
    fetchFolderContents.mockResolvedValue({ folder: null, folders: [], files: [] });
  });

  afterEach(() => {
    vi.clearAllMocks();
  });

  it('lists folders and files at the channel root', async () => {
    fetchFolderContents.mockResolvedValue({
      folder: null,
      folders: [folder()],
      files: [
        file(),
        file({ id: 'file-2', originalName: 'runbook.pdf', mimeType: 'application/pdf' }),
      ],
    });

    renderBrowser();

    expect(await screen.findByText('infra')).toBeInTheDocument();
    expect(screen.getByText('topologia.png')).toBeInTheDocument();
    expect(screen.getByText('runbook.pdf')).toBeInTheDocument();
    expect(fetchFolderContents).toHaveBeenCalledWith('text-geral', null);
  });

  it('renders images as previews and other types as glyphs', async () => {
    fetchFolderContents.mockResolvedValue({
      folder: null,
      folders: [],
      files: [
        file(),
        file({ id: 'file-2', originalName: 'runbook.pdf', mimeType: 'application/pdf' }),
      ],
    });

    renderBrowser();

    const image = await screen.findByAltText('topologia.png');
    expect(image).toHaveAttribute('src', 'http://localhost:3001/api/v1/files/file-1');
    expect(screen.getByText('[PDF]')).toBeInTheDocument();
  });

  it('walks into a folder through the query string, staying on the same route', async () => {
    fetchFolderContents.mockResolvedValue({ folder: null, folders: [folder()], files: [] });

    renderBrowser();
    await userEvent.click(await screen.findByText('infra'));

    expect(push).toHaveBeenCalledWith('/channels/text-geral/files?pasta=folder-infra');
  });

  it('reads the folder from the query string and offers a way back to the root', async () => {
    searchParams = new URLSearchParams('pasta=folder-infra');
    fetchFolderContents.mockResolvedValue({ folder: folder(), folders: [], files: [] });
    fetchBreadcrumbs.mockResolvedValue([folder()]);

    renderBrowser();

    await waitFor(() =>
      expect(fetchFolderContents).toHaveBeenCalledWith('text-geral', 'folder-infra'),
    );
    await userEvent.click(await screen.findByRole('button', { name: '#geral' }));

    expect(push).toHaveBeenCalledWith('/channels/text-geral/files');
  });

  it('shows an empty folder as empty rather than as a failure', async () => {
    renderBrowser();

    expect(await screen.findByText(/pasta vazia/i)).toBeInTheDocument();
  });

  it('reports a denied channel without rendering a grid', async () => {
    fetchFolderContents.mockRejectedValue(new ApiError(403));

    renderBrowser();

    expect(await screen.findByText(/acesso negado/i)).toBeInTheDocument();
    expect(screen.queryByLabelText('arquivos')).not.toBeInTheDocument();
  });

  it('refuses to show a folder that belongs to another channel', async () => {
    searchParams = new URLSearchParams('pasta=folder-outro');
    fetchFolderContents.mockResolvedValue({
      folder: folder({ id: 'folder-outro', channelId: 'text-dev' }),
      folders: [],
      files: [file()],
    });

    renderBrowser();

    expect(await screen.findByText(/pertence a outro canal/i)).toBeInTheDocument();
    expect(screen.queryByText('topologia.png')).not.toBeInTheDocument();
  });

  it('falls back to a glyph when an image will not load', async () => {
    fetchFolderContents.mockResolvedValue({ folder: null, folders: [], files: [file()] });

    renderBrowser();
    const image = await screen.findByAltText('topologia.png');

    // jsdom never loads a real URL, so the error handler is reached the same way
    // an unauthorized or deleted file reaches it in production.
    fireEvent.error(image);

    expect(await screen.findByText(/pré-visualização indisponível/i)).toBeInTheDocument();
  });
});
