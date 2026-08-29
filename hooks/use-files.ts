'use client';

import { useMutation, useQuery, useQueryClient, type QueryClient } from '@tanstack/react-query';
import {
  createFolder,
  deleteFile,
  deleteFolder,
  fetchBreadcrumbs,
  fetchFolderContents,
  updateFile,
  updateFolder,
} from '../lib/files-api';
import type { FolderContents, FolderDto, StoredFileDto } from '../lib/types';

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
  });

  return { breadcrumbs: query.data ?? [], isLoading: query.isLoading };
}

/**
 * The folder view and the breadcrumb trail are the only server state this
 * feature holds, and any of create/rename/move/delete can change both.
 */
function useFileInvalidation(channelId: string) {
  const queryClient = useQueryClient();

  return () => {
    void queryClient.invalidateQueries({ queryKey: fileKeys.channel(channelId) });
    void queryClient.invalidateQueries({ queryKey: ['file-breadcrumbs'] });
  };
}

type Snapshot = [readonly unknown[], FolderContents | undefined][];

/**
 * Optimism is limited to renaming on purpose.
 *
 * A rename is a new label on a row already on screen, so showing it early is
 * honest and rolling it back is one assignment. A move takes the row out of the
 * folder you are looking at and a delete can cascade — guessing at either
 * produces a view that has to be unpicked if the server disagrees, so both wait
 * for the refetch.
 */
function optimisticRename(
  queryClient: QueryClient,
  channelId: string,
  apply: (contents: FolderContents) => FolderContents,
): Snapshot {
  const snapshot = queryClient.getQueriesData<FolderContents>({
    queryKey: fileKeys.channel(channelId),
  });

  queryClient.setQueriesData<FolderContents>(
    { queryKey: fileKeys.channel(channelId) },
    (contents) => (contents ? apply(contents) : contents),
  );

  return snapshot;
}

function rollback(queryClient: QueryClient, snapshot: Snapshot | undefined) {
  snapshot?.forEach(([key, contents]) => queryClient.setQueryData(key, contents));
}

export function useCreateFolder(channelId: string, parentId: string | null) {
  const invalidate = useFileInvalidation(channelId);

  return useMutation({
    mutationFn: (name: string) => createFolder(channelId, parentId, name),
    onSuccess: invalidate,
  });
}

export function useUpdateFolder(channelId: string) {
  const queryClient = useQueryClient();
  const invalidate = useFileInvalidation(channelId);

  return useMutation({
    mutationFn: (input: { folderId: string; name?: string; parentId?: string | null }) =>
      updateFolder(input.folderId, { name: input.name, parentId: input.parentId }),
    onMutate: async (input) => {
      if (input.name === undefined) return { snapshot: undefined };

      await queryClient.cancelQueries({ queryKey: fileKeys.channel(channelId) });
      const snapshot = optimisticRename(queryClient, channelId, (contents) => ({
        ...contents,
        folders: contents.folders.map((folder) =>
          folder.id === input.folderId ? { ...folder, name: input.name! } : folder,
        ),
      }));

      return { snapshot };
    },
    onError: (_error, _input, context) => rollback(queryClient, context?.snapshot),
    onSettled: invalidate,
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
  const queryClient = useQueryClient();
  const invalidate = useFileInvalidation(channelId);

  return useMutation({
    mutationFn: (input: { fileId: string; originalName?: string; folderId?: string | null }) =>
      updateFile(input.fileId, { originalName: input.originalName, folderId: input.folderId }),
    onMutate: async (input) => {
      if (input.originalName === undefined) return { snapshot: undefined };

      await queryClient.cancelQueries({ queryKey: fileKeys.channel(channelId) });
      const snapshot = optimisticRename(queryClient, channelId, (contents) => ({
        ...contents,
        files: contents.files.map((file) =>
          file.id === input.fileId ? { ...file, originalName: input.originalName! } : file,
        ),
      }));

      return { snapshot };
    },
    onError: (_error, _input, context) => rollback(queryClient, context?.snapshot),
    onSettled: invalidate,
  });
}

export function useDeleteFile(channelId: string) {
  const invalidate = useFileInvalidation(channelId);

  return useMutation({
    mutationFn: (fileId: string) => deleteFile(fileId),
    onSuccess: invalidate,
  });
}
