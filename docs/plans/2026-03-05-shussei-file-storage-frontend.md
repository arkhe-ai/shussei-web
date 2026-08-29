# Shussei File Storage Frontend Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add a channel file browser and photo/file attachments to the Shussei web client while preserving the existing ephemeral chat, CRT visual language, and voice dock behavior.

**Architecture:** The frontend consumes REST endpoints for durable folders/files and Socket.IO only for chat messages containing attachment metadata. TanStack Query owns folder/file server state; local component state owns the upload queue and preview dialog. Files are uploaded through `FormData`, never Base64 or Socket.IO, and the backend remains authoritative for validation and authorization.

**Tech Stack:** Next.js App Router, React 19, TypeScript, Tailwind CSS v4, TanStack Query 5, Socket.IO client, Vitest, React Testing Library, Playwright

**Spec:** Reviewed storage-module requirements from the Shussei file-system plan; the decisions and invariants in this document are authoritative for implementation.

## Global Constraints

- Files and folders are scoped to the active channel.
- The file browser is a dedicated route so the chat composer remains focused.
- Durable files can outlive ephemeral chat messages.
- Uploads use `FormData`; do not set `Content-Type` manually when sending it.
- The backend is the authority for size, MIME, authorization, and file lifecycle checks.
- The MVP previews original images and does not require generated thumbnails.
- Existing Socket.IO chat behavior and text-only messages remain compatible.
- Existing voice state must survive navigation between text/voice channels as currently designed.
- Loading, empty, error, upload-progress, retry, and permission states are visible.
- The existing terminal/CRT visual system and keyboard accessibility are preserved.
- Official browser support remains Chrome/Edge desktop; unsupported APIs receive a graceful message.

## Frontend Contracts

```ts
type FolderDto = {
  id: string;
  channelId: string;
  parentId: string | null;
  name: string;
  createdByUserId: string;
  createdAt: string;
  updatedAt: string;
};

type StoredFileDto = {
  id: string;
  channelId: string;
  folderId: string | null;
  originalName: string;
  mimeType: string;
  sizeBytes: number;
  createdByUserId: string;
  createdAt: string;
  downloadUrl: string;
};

type FileAttachmentDto = {
  id: string;
  originalName: string;
  mimeType: string;
  sizeBytes: number;
  downloadUrl: string;
  thumbnailUrl?: string;
};
```

REST paths consumed:

```text
GET    /api/v1/channels/:channelId/folders?parentId=<uuid|null>
POST   /api/v1/channels/:channelId/folders
GET    /api/v1/folders/:folderId
GET    /api/v1/folders/:folderId/breadcrumbs
PATCH  /api/v1/folders/:folderId
DELETE /api/v1/folders/:folderId
GET    /api/v1/channels/:channelId/files?folderId=<uuid|null>
POST   /api/v1/channels/:channelId/files
PATCH  /api/v1/files/:fileId
DELETE /api/v1/files/:fileId
GET/HEAD /api/v1/files/:fileId
```

Chat payload:

```ts
{ channelId: string; body: string; fileIds?: string[] }
```

## Planned File Structure

- `lib/types.ts` — folder, file, attachment, and chat contract types.
- `lib/api.ts` — JSON API helper plus multipart upload helper that omits JSON content type.
- `lib/files-api.ts` — typed file/folder REST functions and download URL helpers.
- `lib/mock/data.ts` — mock folders/files/attachments.
- `lib/mock/mock-api.ts` — mock file REST behavior and upload simulation.
- `lib/mock/mock-socket.ts` — mock attachment chat payloads.
- `hooks/use-files.ts` — current folder query and mutations.
- `hooks/use-upload-file.ts` — upload queue/progress/retry lifecycle.
- `hooks/use-chat.ts` — optional attachment IDs on send and attachment message parsing.
- `app/channels/[channelId]/files/page.tsx` — authenticated file browser route.
- `components/file-browser/file-browser.tsx` — browser composition and toolbar.
- `components/file-browser/breadcrumb-bar.tsx` — root/current path navigation.
- `components/file-browser/folder-grid.tsx` — folder cards and navigation.
- `components/file-browser/file-grid.tsx` — file cards and actions.
- `components/file-browser/file-card.tsx` — image/file representation.
- `components/file-browser/file-actions.tsx` — rename, move, download, delete actions.
- `components/file-browser/file-preview-dialog.tsx` — image/file preview modal.
- `components/file-browser/new-folder-dialog.tsx` — validated folder creation form.
- `components/file-upload-zone.tsx` — picker/drop target and client-side checks.
- `components/upload-queue.tsx` — progress, retry, cancel, and failure messages.
- `components/chat-panel.tsx` — attachment button, pending attachments, and rendered cards.
- `components/chat-attachment.tsx` — image preview/file attachment message card.
- `tests/components/file-browser.test.tsx` — navigation and state tests.
- `tests/components/file-upload-zone.test.tsx` — selection, validation, progress tests.
- `tests/components/chat-attachment.test.tsx` — attachment rendering tests.
- `tests/hooks/use-upload-file.test.ts` — upload lifecycle tests.
- `tests/e2e/files.spec.ts` — browser flow for files and chat attachments.

## Tasks

### Task 1: Add typed contracts and multipart API primitives

**Files:**
- Modify: `lib/types.ts`
- Modify: `lib/api.ts`
- Create: `lib/files-api.ts`
- Test: `tests/lib/files-api.test.ts`

- [ ] Add the folder, file, attachment, and folder-content types, including nullable root IDs and numeric byte sizes.
- [ ] Add typed functions for list content, breadcrumbs, create/update/delete folder, upload, update/delete file, and download URL creation.
- [ ] Ensure JSON requests keep the existing `Content-Type: application/json` behavior while `FormData` requests omit that header so the browser creates the multipart boundary.
- [ ] Preserve API error status codes for `401`, `403`, `404`, `409`, `413`, and `415` so components can show specific messages.
- [ ] Test URL encoding, root `null` query parameters, JSON headers, multipart headers, and error propagation.
- [ ] Commit: `feat(web): add file storage contracts`

### Task 2: Add folder/file queries and upload lifecycle hooks

**Files:**
- Create: `hooks/use-files.ts`
- Create: `hooks/use-upload-file.ts`
- Create: `tests/hooks/use-upload-file.test.ts`
- Modify: existing query provider only if needed for testable invalidation

**Interfaces:**
- `useFolderContents(channelId: string, folderId: string | null)` returns `{ folder, folders, files, isLoading, error }`.
- `useBreadcrumbs(folderId: string | null)` returns `{ breadcrumbs, isLoading }`.
- `useCreateFolder(channelId: string, parentId: string | null)` exposes `mutateAsync(name: string)`.
- `useUploadFile(channelId: string, folderId: string | null)` exposes `upload(file: File, callbacks?)` with progress, cancel, retry, and status.

- [ ] Use TanStack Query keys that include channel and folder IDs, for example `['file-contents', channelId, folderId]`.
- [ ] Invalidate the active folder and breadcrumb-related queries after create, upload, rename, move, and delete.
- [ ] Keep upload queue state local to the feature; do not put transient `File` objects in URL state or Socket.IO state.
- [ ] Use `XMLHttpRequest` or an equivalent progress-capable browser API for upload progress; use `fetch` only if progress is not claimed.
- [ ] Implement cancellation with `AbortController`/XHR abort and retry as a new upload attempt.
- [ ] Test success, progress, cancel, retry, API failure mapping, and query invalidation.
- [ ] Commit: `feat(web): add file queries and upload state`

### Task 3: Build the file browser route and navigation UI

**Files:**
- Create: `app/channels/[channelId]/files/page.tsx`
- Create: `components/file-browser/file-browser.tsx`
- Create: `components/file-browser/breadcrumb-bar.tsx`
- Create: `components/file-browser/folder-grid.tsx`
- Create: `components/file-browser/file-grid.tsx`
- Create: `components/file-browser/file-card.tsx`
- Create: `tests/components/file-browser.test.tsx`
- Modify: `components/app-shell.tsx` or channel header navigation

- [ ] Add a dedicated `/channels/:channelId/files` route using the existing auth/channel shell conventions.
- [ ] Render breadcrumbs, immediate child folders, immediate files, toolbar, loading skeleton, empty state, error state, and access-denied state.
- [ ] Navigate folders through URL state or route segments without losing the active voice connection.
- [ ] Show image thumbnails from the backend download URL and type-specific icons for non-image files.
- [ ] Format bytes and dates consistently; never display the physical storage path.
- [ ] Add an “arquivos” navigation affordance from the active text channel and a way back to chat.
- [ ] Test root/nested navigation, empty folder, loading/error states, image vs generic file rendering, and channel mismatch handling.
- [ ] Commit: `feat(web): add channel file browser`

### Task 4: Add folder/file actions and preview dialog

**Files:**
- Create: `components/file-browser/new-folder-dialog.tsx`
- Create: `components/file-browser/file-actions.tsx`
- Create: `components/file-browser/file-preview-dialog.tsx`
- Modify: `hooks/use-files.ts`
- Test: `tests/components/file-actions.test.tsx`, `tests/components/file-preview-dialog.test.tsx`

- [ ] Add create-folder dialog with trim, non-empty, duplicate-name, pending, and server-error states.
- [ ] Add file/folder actions for rename, move, download, and delete; use confirmation for destructive actions.
- [ ] Keep optimistic updates limited to rename/move; refetch after server completion and roll back on failure.
- [ ] Preview images in a dialog with name, size, author/date when available, download, delete, close button, and `Escape` handling.
- [ ] For non-previewable types, show metadata and a download action instead of embedding arbitrary content.
- [ ] Test keyboard close, delete confirmation, rename conflict, download link, image preview, generic file fallback, and mutation errors.
- [ ] Commit: `feat(web): add file actions and previews`

### Task 5: Add drag/drop upload and visible queue

**Files:**
- Create: `components/file-upload-zone.tsx`
- Create: `components/upload-queue.tsx`
- Create: `components/upload-item.tsx`
- Modify: `components/file-browser/file-browser.tsx`
- Create: `tests/components/file-upload-zone.test.tsx`

- [ ] Support picker and drag/drop, multiple files, keyboard activation, and `aria-label`/focus-visible states.
- [ ] Perform client-side size/type checks for fast feedback while treating backend responses as authoritative.
- [ ] Render each item as queued, uploading with progress, completed, cancelled, or failed with retry.
- [ ] Refresh the active folder after success and expose the returned file metadata to the parent.
- [ ] Prevent accidental duplicate submission while retaining an explicit retry action.
- [ ] Test file selection, drop, invalid size/type, multiple files, progress, cancel, retry, and empty queue.
- [ ] Commit: `feat(web): add file upload queue`

### Task 6: Integrate attachments into ephemeral chat

**Files:**
- Modify: `components/chat-panel.tsx`
- Create: `components/chat-attachment.tsx`
- Modify: `hooks/use-chat.ts`
- Modify: `lib/types.ts`
- Modify: `lib/socket.ts` only if event typing requires it
- Create: `tests/components/chat-attachment.test.tsx`
- Modify: existing chat panel tests

- [ ] Add an attachment picker/drop action to the composer without changing text-only behavior.
- [ ] Upload selected files through REST first, show pending/completed/failed items, then send `fileIds` with `chat.send`.
- [ ] Do not emit binary data, Base64, filesystem paths, or arbitrary client URLs through Socket.IO.
- [ ] Render image attachments as clickable previews and generic attachments as cards with name, size, and download action.
- [ ] Reject an empty message with no completed attachment and preserve normal disabled/offline behavior.
- [ ] Make the composer clear only after the socket send succeeds according to the existing client semantics; failed uploads remain retryable.
- [ ] Test text-only messages, attachment-only messages, text plus attachments, failed upload, image rendering, generic file rendering, and deduplication of incoming messages.
- [ ] Commit: `feat(web): add chat file attachments`

### Task 7: Extend mock mode and app navigation

**Files:**
- Modify: `lib/mock/data.ts`
- Modify: `lib/mock/mock-api.ts`
- Modify: `lib/mock/mock-socket.ts`
- Modify: `components/app-shell.tsx`
- Modify: mock tests and fixtures

- [ ] Add deterministic mock folders, files, image URLs, and attachment messages.
- [ ] Simulate upload progress, cancellation, retryable failures, folder mutations, and file deletion.
- [ ] Make mock chat echo attachment metadata through the same event shape as the real socket.
- [ ] Add navigation from channel chat to the dedicated files route and back without remounting voice state.
- [ ] Test the complete feature with `NEXT_PUBLIC_MOCK=1` and verify no backend request is required.
- [ ] Commit: `test(web): cover file storage in mock mode`

### Task 8: Add end-to-end coverage and regression gates

**Files:**
- Create: `tests/e2e/files.spec.ts`
- Modify: `playwright.config.ts` only if fixtures need the existing setup
- Modify: `README.md` with the new backend contract and local storage assumptions

- [ ] Add a Playwright flow for opening channel files, creating a folder, uploading an image, previewing it, returning to chat, and sending it as an attachment.
- [ ] Cover API errors for oversized/unsupported uploads, deleted files, and unauthorized channels through visible UI states.
- [ ] Run `npm run typecheck`, `npm test`, `npm run build`, and `npm run test:e2e` with mock mode where appropriate.
- [ ] Verify existing chat, channel navigation, unread indicators, and voice-dock behavior remain unchanged.
- [ ] Commit: `test(web): verify file storage flows`

## Acceptance Criteria

- A user can navigate the active channel's root and nested folders.
- A user can create, rename, move, and delete folders subject to backend permissions.
- A user can upload one or more images/files with visible progress and retry.
- Images preview in the browser; generic files expose a safe download action.
- A user can attach uploaded files to an ephemeral chat message without sending binary data through Socket.IO.
- File attachments remain represented after a chat message is recovered from Redis, until the file itself is deleted.
- All loading, empty, failure, and permission states are visible and accessible.
- The existing CRT styling, text chat, unread tracking, and persistent voice dock continue to work.
