import { apiFetch } from './api';
import { getApiBaseUrl } from './env';
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

/** Root to current, inclusive. The root itself has no entry. */
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

/** Where `POST` sends a new upload. Used by `lib/upload.ts`, which needs the raw URL for XHR. */
export function uploadPath(channelId: string): string {
  return channelPath(channelId, 'files');
}

/**
 * The backend may return an absolute URL or an API-relative path; a relative one
 * resolved by the browser would point at the *client's* origin, where no such
 * route exists.
 *
 * Whether the resulting URL authenticates at all is still open — see Backend
 * Pre-conditions in the plan. The session cookie is `SameSite=Lax`, so a bare
 * cross-subdomain image request carries no cookie and comes back 401 in
 * production while working locally, where client and API are same-site.
 */
export function resolveDownloadUrl(url: string): string {
  if (/^(?:https?:|data:|blob:)/i.test(url)) return url;
  return `${getApiBaseUrl()}${url.startsWith('/') ? '' : '/'}${url}`;
}

export function isImage(mimeType: string): boolean {
  return mimeType.startsWith('image/');
}
