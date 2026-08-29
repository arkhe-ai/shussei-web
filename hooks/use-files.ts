'use client';

import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import {
  createFolder,
  deleteFile,
  deleteFolder,
  fetchBreadcrumbs,
  fetchFolderContents,
  updateFile,
  updateFolder,
} from '../lib/files-api';
import type { FolderDto, StoredFileDto } from '../lib/types';

export const fileKeys = {
  /** Prefixed by channel so invalidating one channel never refetches another. */
  contents: (channelId: string, folderId: string | null) =>
    ['file-contents', channelId, folderId] as const,
  channel: (channelId: string) => ['file-contents', channelId] as const,
  breadcrumbs: (folderId: string | null) => ['file-breadcrumbs', folderId] as const,
};

export function useFolderContents(
  channelId: string,
  folderId: string | null,
): {
  folder: FolderDto | null;
  folders: FolderDto[];
  files: StoredFileDto[];
  isLoading: boolean;
  error: unknown;
} {
  const query = useQuery({
    queryKey: fileKeys.contents(channelId, folderId),
    queryFn: () => fetchFolderContents(channelId, folderId),
  });

  return {
    folder: query.data?.folder ?? null,
    folders: query.data?.folders ?? [],
    files: query.data?.files ?? [],
    isLoading: query.isLoading,
    error: query.error,
  };
}

export function useBreadcrumbs(folderId: string | null): {
  breadcrumbs: FolderDto[];
  isLoading: boolean;
} {
  const query = useQuery({
    queryKey: fileKeys.breadcrumbs(folderId),
    // The channel root is a known empty trail, not a request.
    queryFn: () => (folderId ? fetchBreadcrumbs(folderId) : Promise.resolve([])),
    enabled: true,
  });

  return { breadcrumbs: query.data ?? [], isLoading: query.isLoading };
}

/**
 * Every mutation lands here: the folder view and the breadcrumb trail are the
 * only server state this feature holds, and any of rename/move/delete can
 * change both.
 */
function useFileInvalidation(channelId: string) {
  const queryClient = useQueryClient();

  return () => {
    void queryClient.invalidateQueries({ queryKey: fileKeys.channel(channelId) });
    void queryClient.invalidateQueries({ queryKey: ['file-breadcrumbs'] });
  };
}

export function useCreateFolder(channelId: string, parentId: string | null) {
  const invalidate = useFileInvalidation(channelId);

  return useMutation({
    mutationFn: (name: string) => createFolder(channelId, parentId, name),
    onSuccess: invalidate,
  });
}

export function useUpdateFolder(channelId: string) {
  const invalidate = useFileInvalidation(channelId);

  return useMutation({
    mutationFn: (input: { folderId: string; name?: string; parentId?: string | null }) =>
      updateFolder(input.folderId, { name: input.name, parentId: input.parentId }),
    onSuccess: invalidate,
  });
}

export function useDeleteFolder(channelId: string) {
  const invalidate = useFileInvalidation(channelId);

  return useMutation({
    mutationFn: (folderId: string) => deleteFolder(folderId),
    onSuccess: invalidate,
  });
}

export function useUpdateFile(channelId: string) {
  const invalidate = useFileInvalidation(channelId);

  return useMutation({
    mutationFn: (input: { fileId: string; originalName?: string; folderId?: string | null }) =>
      updateFile(input.fileId, { originalName: input.originalName, folderId: input.folderId }),
    onSuccess: invalidate,
  });
}

export function useDeleteFile(channelId: string) {
  const invalidate = useFileInvalidation(channelId);

  return useMutation({
    mutationFn: (fileId: string) => deleteFile(fileId),
    onSuccess: invalidate,
  });
}
