import { ApiError } from '../api';
import type { FileAttachmentDto, FolderDto, StoredFileDto } from '../types';
import { mockFiles, mockFolders } from './data';

/**
 * The durable half of the API, in memory.
 *
 * Cloned from the seed at module load so mutations made by one screen — or one
 * test — do not travel back into the fixtures through the module graph.
 */
const folders: FolderDto[] = structuredClone(mockFolders);
const files: StoredFileDto[] = structuredClone(mockFiles);

function nextId(prefix: string): string {
  return `${prefix}-${Math.random().toString(36).slice(2, 10)}`;
}

function nowIso(): string {
  return new Date().toISOString();
}

export function listFolders(channelId: string, parentId: string | null): FolderDto[] {
  return folders.filter(
    (folder) => folder.channelId === channelId && folder.parentId === parentId,
  );
}

export function listFiles(channelId: string, folderId: string | null): StoredFileDto[] {
  return files.filter((file) => file.channelId === channelId && file.folderId === folderId);
}

export function getFolder(folderId: string): FolderDto {
  const folder = folders.find((candidate) => candidate.id === folderId);
  if (!folder) throw new ApiError(404);
  return folder;
}

export function getFile(fileId: string): StoredFileDto {
  const file = files.find((candidate) => candidate.id === fileId);
  if (!file) throw new ApiError(404);
  return file;
}

/** Root first, current folder last. The channel root has no entry of its own. */
export function getBreadcrumbs(folderId: string): FolderDto[] {
  const trail: FolderDto[] = [];

  let current: FolderDto | null = getFolder(folderId);
  while (current) {
    trail.unshift(current);
    current = current.parentId ? getFolder(current.parentId) : null;
  }

  return trail;
}

export function createFolder(
  channelId: string,
  parentId: string | null,
  name: string,
  createdByUserId: string,
): FolderDto {
  const trimmed = name.trim();
  if (!trimmed) throw new ApiError(422);

  const taken = listFolders(channelId, parentId).some(
    (folder) => folder.name.toLowerCase() === trimmed.toLowerCase(),
  );
  if (taken) throw new ApiError(409);

  const folder: FolderDto = {
    id: nextId('folder'),
    channelId,
    parentId,
    name: trimmed,
    createdByUserId,
    createdAt: nowIso(),
    updatedAt: nowIso(),
  };

  folders.push(folder);
  return folder;
}

export function updateFolder(
  folderId: string,
  patch: { name?: string; parentId?: string | null },
): FolderDto {
  const folder = getFolder(folderId);

  if (patch.name !== undefined) {
    const trimmed = patch.name.trim();
    if (!trimmed) throw new ApiError(422);

    const taken = listFolders(folder.channelId, folder.parentId).some(
      (sibling) => sibling.id !== folder.id && sibling.name.toLowerCase() === trimmed.toLowerCase(),
    );
    if (taken) throw new ApiError(409);

    folder.name = trimmed;
  }

  if (patch.parentId !== undefined) {
    // A folder cannot be moved inside itself or its own subtree; the real API
    // has to refuse this too or the tree stops being a tree.
    if (patch.parentId === folder.id) throw new ApiError(409);
    if (patch.parentId && descendantIds(folder.id).includes(patch.parentId)) {
      throw new ApiError(409);
    }
    folder.parentId = patch.parentId;
  }

  folder.updatedAt = nowIso();
  return folder;
}

function descendantIds(folderId: string): string[] {
  const direct = folders.filter((folder) => folder.parentId === folderId).map((f) => f.id);
  return direct.flatMap((id) => [id, ...descendantIds(id)]);
}

export function deleteFolder(folderId: string): void {
  const doomed = [getFolder(folderId).id, ...descendantIds(folderId)];

  for (const id of doomed) {
    const folderIndex = folders.findIndex((folder) => folder.id === id);
    if (folderIndex >= 0) folders.splice(folderIndex, 1);
  }

  for (let index = files.length - 1; index >= 0; index -= 1) {
    if (files[index].folderId && doomed.includes(files[index].folderId!)) {
      files.splice(index, 1);
    }
  }
}

export function addFile(file: StoredFileDto): StoredFileDto {
  files.push(file);
  return file;
}

export function updateFile(
  fileId: string,
  patch: { originalName?: string; folderId?: string | null },
): StoredFileDto {
  const file = getFile(fileId);

  if (patch.originalName !== undefined) {
    const trimmed = patch.originalName.trim();
    if (!trimmed) throw new ApiError(422);
    file.originalName = trimmed;
  }

  if (patch.folderId !== undefined) {
    if (patch.folderId) getFolder(patch.folderId);
    file.folderId = patch.folderId;
  }

  return file;
}

export function deleteFile(fileId: string): void {
  const index = files.findIndex((file) => file.id === getFile(fileId).id);
  files.splice(index, 1);
}

export function newFileId(): string {
  return nextId('file');
}

/**
 * How the API would replay a stored file inside a chat message: the narrow
 * shape a message carries, resolved from the durable record at send time.
 */
export function attachmentFor(fileId: string): FileAttachmentDto {
  const file = getFile(fileId);

  return {
    id: file.id,
    originalName: file.originalName,
    mimeType: file.mimeType,
    sizeBytes: file.sizeBytes,
    downloadUrl: file.downloadUrl,
  };
}
