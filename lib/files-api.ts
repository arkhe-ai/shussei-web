import { ApiError, apiFetch } from './api';
import type { FolderContents, FolderDto, StoredFileDto } from './types';

/**
 * The channel root has no folder id. The contract spells it on the wire as the
 * literal `null` rather than as an absent parameter, so "the root of this
 * channel" is never confused with "no filter applied".
 */
const ROOT_PARAM = 'null';

function scopeQuery(name: 'parentId' | 'folderId', folderId: string | null): string {
  return `?${name}=${encodeURIComponent(folderId ?? ROOT_PARAM)}`;
}

function channelPath(channelId: string, segment: 'folders' | 'files'): string {
  return `/api/v1/channels/${encodeURIComponent(channelId)}/${segment}`;
}

export async function fetchFolders(channelId: string, parentId: string | null): Promise<FolderDto[]> {
  const data = await apiFetch<{ folders: FolderDto[] }>(
    `${channelPath(channelId, 'folders')}${scopeQuery('parentId', parentId)}`,
  );
  return data.folders;
}

export async function fetchFiles(channelId: string, folderId: string | null): Promise<StoredFileDto[]> {
  const data = await apiFetch<{ files: StoredFileDto[] }>(
    `${channelPath(channelId, 'files')}${scopeQuery('folderId', folderId)}`,
  );
  return data.files;
}

export async function fetchFolder(folderId: string): Promise<FolderDto> {
  const data = await apiFetch<{ folder: FolderDto }>(
    `/api/v1/folders/${encodeURIComponent(folderId)}`,
  );
  return data.folder;
}

/** Root to current, inclusive. The channel root itself has no entry. */
export async function fetchBreadcrumbs(folderId: string): Promise<FolderDto[]> {
  const data = await apiFetch<{ breadcrumbs: FolderDto[] }>(
    `/api/v1/folders/${encodeURIComponent(folderId)}/breadcrumbs`,
  );
  return data.breadcrumbs;
}

/**
 * One folder view is three endpoints: its children, its files, and — below the
 * root — the folder record itself. Issued together so a slow leg does not
 * stagger the grid in.
 */
export async function fetchFolderContents(
  channelId: string,
  folderId: string | null,
): Promise<FolderContents> {
  const [folders, files, folder] = await Promise.all([
    fetchFolders(channelId, folderId),
    fetchFiles(channelId, folderId),
    folderId ? fetchFolder(folderId) : Promise.resolve(null),
  ]);

  return { folder, folders, files };
}

export async function createFolder(
  channelId: string,
  parentId: string | null,
  name: string,
): Promise<FolderDto> {
  const data = await apiFetch<{ folder: FolderDto }>(channelPath(channelId, 'folders'), {
    method: 'POST',
    body: JSON.stringify({ parentId, name }),
  });
  return data.folder;
}

export async function updateFolder(
  folderId: string,
  patch: { name?: string; parentId?: string | null },
): Promise<FolderDto> {
  const data = await apiFetch<{ folder: FolderDto }>(
    `/api/v1/folders/${encodeURIComponent(folderId)}`,
    { method: 'PATCH', body: JSON.stringify(patch) },
  );
  return data.folder;
}

export async function deleteFolder(folderId: string): Promise<void> {
  await apiFetch<void>(`/api/v1/folders/${encodeURIComponent(folderId)}`, { method: 'DELETE' });
}

/** Renames a file, moves it between folders, or moves it to the root with `null`. */
export async function updateFile(
  fileId: string,
  patch: { originalName?: string; folderId?: string | null },
): Promise<StoredFileDto> {
  const data = await apiFetch<{ file: StoredFileDto }>(
    `/api/v1/files/${encodeURIComponent(fileId)}`,
    { method: 'PATCH', body: JSON.stringify(patch) },
  );
  return data.file;
}

export async function deleteFile(fileId: string): Promise<void> {
  await apiFetch<void>(`/api/v1/files/${encodeURIComponent(fileId)}`, { method: 'DELETE' });
}

/**
 * Where `POST` sends a new upload. The destination folder is a query parameter,
 * never a multipart field: the body is the file and nothing else, and an absent
 * parameter means the channel root.
 *
 * Used by `lib/upload.ts`, which needs the raw path for XHR.
 */
export function uploadPath(channelId: string, folderId: string | null): string {
  const base = channelPath(channelId, 'files');
  return folderId ? `${base}?folderId=${encodeURIComponent(folderId)}` : base;
}

/**
 * Where the client points an `<img>` or a download link: always the same-origin
 * proxy at `app/api/files/[fileId]`, never the API directly.
 *
 * The session cookie is `SameSite=Lax`, so a cross-subdomain request for a file
 * carries no cookie and comes back 401 — in production only, since on localhost
 * client and API are same-site and the failure never appears.
 *
 * Mock mode is the exception: its files are inline data URIs with no server
 * behind them, so they are handed back untouched.
 */
export function fileUrl(file: { id: string; downloadUrl?: string }): string {
  if (file.downloadUrl && /^(?:data:|blob:|mock:)/i.test(file.downloadUrl)) {
    return file.downloadUrl;
  }

  return `/api/files/${encodeURIComponent(file.id)}`;
}

export function isImage(mimeType: string): boolean {
  return mimeType.startsWith('image/');
}

/**
 * One place where an API status becomes something a person can act on. The
 * generic fallback keeps the status visible, because "falha na api (500)" is
 * still more useful to report than "algo deu errado".
 */
export function describeFileError(error: unknown): string {
  if (!(error instanceof ApiError)) return 'falha inesperada';

  switch (error.status) {
    case 0:
      return 'sem conexão com a api';
    case 401:
      return 'sessão expirada — entre de novo';
    case 403:
      return 'sem permissão neste canal';
    case 404:
      return 'não encontrado — pode ter sido removido';
    case 409:
      return 'já existe um item com esse nome';
    case 413:
      return 'arquivo grande demais';
    case 415:
      return 'tipo de arquivo não suportado';
    case 422:
      return 'nome inválido';
    default:
      return `falha na api (${error.status})`;
  }
}
