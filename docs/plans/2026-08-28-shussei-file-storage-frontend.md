# Shussei File Storage Frontend Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add a channel file browser and photo/file attachments to the Shussei web client while preserving the existing ephemeral chat, CRT visual language, and voice dock behavior.

**Architecture:** The frontend consumes REST endpoints for durable folders/files and Socket.IO only for chat messages containing attachment metadata. TanStack Query owns folder/file server state; local component state owns the upload queue and preview dialog. Files are uploaded through `FormData`, never Base64 or Socket.IO, and the backend remains authoritative for validation and authorization. The file browser has its own URL at `/channels/:channelId/files`, but that segment renders *through* the persistent channel shell — `app/channels/layout.tsx` reads the active layout segment and swaps the main pane — because that shell is what keeps the LiveKit room alive across navigation.

**Tech Stack:** Next.js App Router, React 19, TypeScript, Tailwind CSS v4, TanStack Query 5, Socket.IO client, Vitest, React Testing Library, Playwright

**Spec:** Reviewed storage-module requirements from the Shussei file-system plan; the decisions and invariants in this document are authoritative for the frontend. The backend counterpart does not exist yet — see Backend Pre-conditions.

## Backend Pre-conditions

None of the REST endpoints below exist in `shussei-api` today: there is no storage module, no `Folder` or `StoredFile` Prisma model, and no upload handling. Tasks 1–5 and 7 can be built and verified entirely in mock mode without any of this. Task 6 and the live-mode half of Task 8 cannot, and each item below is a contract the backend must settle first.

- [ ] **The storage module exists** — the folders/files REST surface, persistence, and per-channel authorization.
- [x] **Download URL authentication is decided — solved on the client.** The session cookie is `httpOnly; SameSite=Lax` (`auth.service.ts`, `getSessionCookieOptions`). With the client on `app.*` and the API on `api.*`, an image request to `api.../files/:id` is cross-site and the cookie is **not** sent, so every image breaks in production while continuing to work on `localhost:3000` against `localhost:3001`, which is same-site and hides the problem in development. Settled as the same-origin Next proxy: `app/api/files/[fileId]/route.ts` forwards the cookie, so the browser request never leaves this origin and no cookie policy has to change. What the backend still owes is the endpoint behind it — `GET`/`HEAD /api/v1/files/:fileId` serving bytes, honouring `Range`, and answering 200/206/401/404/416. `API_INTERNAL_URL` addresses the API from inside the Next container.
- [ ] **`chat.send` accepts `fileIds`.** The gateway currently binds `{ channelId, body }` and silently drops unknown fields, so attachments sent today would vanish with no error surfaced anywhere.
- [ ] **`EphemeralMessage` carries attachments.** The client type now has the field; the API's `ChatService` still does not, so an attachment sent through a real server arrives on a message that has nowhere to put it.
- [ ] **The Redis buffer preserves attachment metadata**, either by serialising it into the stored message or by re-hydrating it in `listRecent`. Without this, recovered messages lose their attachments and the corresponding acceptance criterion cannot hold — it is backend behaviour the frontend can only consume.

## Global Constraints

- Files and folders are scoped to the active channel.
- The file browser has its own URL so it is deep-linkable and the back button works, but it renders inside the existing channel shell rather than as a sibling page that would remount it.
- Durable files can outlive ephemeral chat messages.
- Uploads use `FormData`; do not set `Content-Type` manually when sending it.
- The backend is the authority for size, MIME, authorization, and file lifecycle checks.
- The MVP previews original images and does not require generated thumbnails.
- Existing Socket.IO chat behavior and text-only messages remain compatible.
- Existing voice state must survive navigation between text/voice channels **and between chat and the file browser** as currently designed.
- Every network path honours `isMockMode()`, including the progress-capable upload path that bypasses `apiFetch`.
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

The existing `EphemeralMessage` in `lib/types.ts` gains attachments. The field is optional so
text-only messages and entries already sitting in the Redis buffer keep type-checking:

```ts
type EphemeralMessage = {
  id: string;
  channelId: string;
  author: SessionUser;
  body: string;
  sentAt: string;
  attachments?: FileAttachmentDto[];
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

Chat payload sent over `chat.send`. This is outbound only; the inbound `chat.message` carries
resolved `attachments`, not `fileIds`:

```ts
{ channelId: string; body: string; fileIds?: string[] }
```

Uploads put the destination folder in the query string, never in the multipart body — the body
carries only the file, and an absent `folderId` means the channel root:

```text
POST /api/v1/channels/:channelId/files?folderId=<uuid>   → into a folder
POST /api/v1/channels/:channelId/files                   → into the channel root
```

Every read is addressed through the client's own origin, which proxies to the API:

```text
<img src="/api/files/:fileId">  →  Next route handler  →  GET /api/v1/files/:fileId
```

## Planned File Structure

- `lib/types.ts` — folder, file, attachment, and chat contract types.
- `lib/api.ts` — JSON API helper plus multipart upload helper that omits JSON content type; tolerates empty bodies.
- `lib/files-api.ts` — typed file/folder REST functions and download URL helpers.
- `lib/upload.ts` — single progress-capable upload entry point that dispatches to mock or XHR.
- `lib/mock/mock-upload.ts` — simulated progress, cancellation, and retryable failures.
- `lib/mock/data.ts` — mock folders/files/attachments.
- `lib/mock/mock-api.ts` — mock file REST behavior.
- `lib/mock/mock-socket.ts` — mock attachment chat payloads.
- `hooks/use-files.ts` — current folder query and mutations.
- `hooks/use-upload-file.ts` — upload queue/progress/retry lifecycle.
- `hooks/use-chat.ts` — optional attachment IDs on send and attachment message parsing.
- `app/channels/layout.tsx` — reads the active layout segment and selects the shell view.
- `app/channels/[channelId]/files/page.tsx` — route resolution only; renders `null`.
- `components/app-shell.tsx` — `view` prop swapping the main pane; files navigation affordance.
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
- `tests/lib/files-api.test.ts` — URL, header, and error mapping tests.
- `tests/components/file-browser.test.tsx` — navigation and state tests.
- `tests/components/file-upload-zone.test.tsx` — selection, validation, progress tests.
- `tests/components/chat-attachment.test.tsx` — attachment rendering tests.
- `tests/hooks/use-upload-file.test.ts` — upload lifecycle tests.
- `tests/e2e/files.spec.ts` — browser flow for files and chat attachments.

`vitest.config.ts` already includes `tests/**/*.test.{ts,tsx}`, so the new `tests/lib` and
`tests/hooks` directories need no configuration change.

## Tasks

### Task 1: Add typed contracts and multipart API primitives

**Files:**
- Modify: `lib/types.ts`
- Modify: `lib/api.ts`
- Create: `lib/files-api.ts`
- Create: `tests/lib/files-api.test.ts`

- [x] Add the folder, file, attachment, and folder-content types, including nullable root IDs and numeric byte sizes.
- [x] Extend `EphemeralMessage` with an optional `attachments` array so text-only messages and already-buffered entries keep type-checking.
- [x] Add typed functions for list content, breadcrumbs, create/update/delete folder, upload, update/delete file, and download URL creation.
- [x] Ensure JSON requests keep the existing `Content-Type: application/json` behavior while `FormData` requests omit that header so the browser creates the multipart boundary.
- [x] Make `apiFetch` tolerate an empty response body. It currently ends in an unconditional `return response.json()`, so a `204 No Content` from `DELETE /folders/:id` or `DELETE /files/:id` throws a `SyntaxError` rather than resolving or raising `ApiError`.
- [x] Preserve API error status codes for `401`, `403`, `404`, `409`, `413`, and `415` so components can show specific messages.
- [x] Test URL encoding, root `null` query parameters, JSON headers, multipart headers, `204`/empty-body responses, and error propagation.
- [x] Commit: `feat(web): add file storage contracts`

### Task 2: Add folder/file queries and upload lifecycle hooks

**Files:**
- Create: `lib/upload.ts`
- Create: `lib/mock/mock-upload.ts`
- Create: `hooks/use-files.ts`
- Create: `hooks/use-upload-file.ts`
- Create: `tests/hooks/use-upload-file.test.ts`
- Modify: existing query provider only if needed for testable invalidation

**Interfaces:**
- `uploadFile(channelId: string, folderId: string | null, file: File, handlers)` returns `{ promise, abort }`.
- `useFolderContents(channelId: string, folderId: string | null)` returns `{ folder, folders, files, isLoading, error }`.
- `useBreadcrumbs(folderId: string | null)` returns `{ breadcrumbs, isLoading }`.
- `useCreateFolder(channelId: string, parentId: string | null)` exposes `mutateAsync(name: string)`.
- `useUploadFile(channelId: string, folderId: string | null)` exposes `upload(file: File, callbacks?)` with progress, cancel, retry, and status.

- [x] Route every upload through a single `lib/upload.ts` entry point that checks `isMockMode()` **before** touching the network. `apiFetch` performs that check internally, but a progress-capable upload bypasses `apiFetch` entirely, so without an explicit check mock mode would issue real network requests.
- [x] Use TanStack Query keys that include channel and folder IDs, for example `['file-contents', channelId, folderId]`.
- [x] Invalidate the active folder and breadcrumb-related queries after create, upload, rename, move, and delete.
- [x] Keep upload queue state local to the feature; do not put transient `File` objects in URL state or Socket.IO state.
- [x] Use `XMLHttpRequest` or an equivalent progress-capable browser API for upload progress; use `fetch` only if progress is not claimed.
- [x] Implement cancellation with `AbortController`/XHR abort and retry as a new upload attempt.
- [x] Test success, progress, cancel, retry, API failure mapping, query invalidation, and that mock mode never reaches the network.
- [x] Commit: `feat(web): add file queries and upload state`

### Task 3: Build the file browser route and navigation UI

**Files:**
- Modify: `app/channels/layout.tsx`
- Modify: `components/app-shell.tsx`
- Create: `app/channels/[channelId]/files/page.tsx`
- Create: `components/file-browser/file-browser.tsx`
- Create: `components/file-browser/breadcrumb-bar.tsx`
- Create: `components/file-browser/folder-grid.tsx`
- Create: `components/file-browser/file-grid.tsx`
- Create: `components/file-browser/file-card.tsx`
- Create: `tests/components/file-browser.test.tsx`
- Modify: existing shell tests if the `AppShell` signature change reaches them

- [x] Make `app/channels/layout.tsx` read `useSelectedLayoutSegment()` and pass `view: 'chat' | 'files'` to `AppShell`. The layout currently returns `<AppShell initialChannelId={channelId} />` and **discards `children`**, so a new page segment under `[channelId]` renders nothing at all — the user navigates to `/files` and still sees the chat.
- [x] Give `AppShell` a `view` prop that swaps only the `<main>` content, leaving the sidebar, presence list, sprite strip, voice dock, and `RoomAudio` mounted. Do not move the shell out of the layout: it lives there specifically so switching segments does not tear down the LiveKit room.
- [x] `app/channels/[channelId]/files/page.tsx` renders `null`, matching `[channelId]/page.tsx` — it exists only so the route resolves.
- [x] Render breadcrumbs, immediate child folders, immediate files, toolbar, loading skeleton, empty state, error state, and access-denied state.
- [x] Navigate nested folders through a query parameter on the same route, so neither the shell nor the voice connection is ever remounted.
- [x] Show image thumbnails using the download strategy agreed in Backend Pre-conditions, and type-specific icons for non-image files.
- [x] Format bytes and dates consistently; never display the physical storage path.
- [x] Add an "arquivos" navigation affordance from the active text channel and a way back to chat; keep it keyboard-reachable without colliding with the existing arrow/M/D/S/X/space bindings in `AppShell`.
- [x] Test root/nested navigation, empty folder, loading/error states, image vs generic file rendering, channel mismatch handling, and that switching to the files view leaves the voice dock mounted.
- [x] Commit: `feat(web): add channel file browser`

### Task 4: Add folder/file actions and preview dialog

**Files:**
- Create: `components/file-browser/new-folder-dialog.tsx`
- Create: `components/file-browser/file-actions.tsx`
- Create: `components/file-browser/file-preview-dialog.tsx`
- Modify: `hooks/use-files.ts`
- Test: `tests/components/file-actions.test.tsx`, `tests/components/file-preview-dialog.test.tsx`

- [x] Add create-folder dialog with trim, non-empty, duplicate-name, pending, and server-error states.
- [x] Add file/folder actions for rename, move, download, and delete; use confirmation for destructive actions.
- [x] Keep optimistic updates limited to rename/move; refetch after server completion and roll back on failure.
- [x] Preview images in a dialog with name, size, author/date when available, download, delete, close button, and `Escape` handling.
- [x] Route preview and download through the agreed authenticated download strategy; a broken or unauthorized image must render a visible failure state rather than a silent blank.
- [x] For non-previewable types, show metadata and a download action instead of embedding arbitrary content.
- [x] Test keyboard close, delete confirmation, rename conflict, download link, image preview, image load failure, generic file fallback, and mutation errors.
- [x] Commit: `feat(web): add file actions and previews`

### Task 5: Add drag/drop upload and visible queue

**Files:**
- Create: `components/file-upload-zone.tsx`
- Create: `components/upload-queue.tsx`
- Create: `components/upload-item.tsx`
- Modify: `components/file-browser/file-browser.tsx`
- Create: `tests/components/file-upload-zone.test.tsx`

- [x] Support picker and drag/drop, multiple files, keyboard activation, and `aria-label`/focus-visible states.
- [x] Perform client-side size/type checks for fast feedback while treating backend responses as authoritative.
- [x] Render each item as queued, uploading with progress, completed, cancelled, or failed with retry.
- [x] Refresh the active folder after success and expose the returned file metadata to the parent.
- [x] Prevent accidental duplicate submission while retaining an explicit retry action.
- [x] Test file selection, drop, invalid size/type, multiple files, progress, cancel, retry, and empty queue.
- [x] Commit: `feat(web): add file upload queue`

### Task 6: Integrate attachments into ephemeral chat

Blocked on the `chat.send`, `EphemeralMessage`, and Redis buffer items in Backend Pre-conditions.
Build against mock mode; the live path cannot be verified until those land.

**Files:**
- Modify: `components/chat-panel.tsx`
- Create: `components/chat-attachment.tsx`
- Modify: `hooks/use-chat.ts`
- Modify: `components/app-shell.tsx`
- Modify: `lib/types.ts`
- Modify: `lib/socket.ts` only if event typing requires it
- Create: `tests/components/chat-attachment.test.tsx`
- Modify: `tests/components/chat-panel.test.tsx`

- [x] Widen `ChatPanel`'s `onSend` from `(body: string) => void` to carry attachment IDs, and update the `AppShell` call site that passes `sendMessage` straight through.
- [x] Relax the composer's `if (!body.trim()) return` guard so an attachment-only message can be sent, while an empty message with no completed attachment is still rejected.
- [x] Add an attachment picker/drop action to the composer without changing text-only behavior.
- [x] Upload selected files through REST first, show pending/completed/failed items, then send `fileIds` with `chat.send`.
- [x] Do not emit binary data, Base64, filesystem paths, or arbitrary client URLs through Socket.IO.
- [x] Render image attachments as clickable previews and generic attachments as cards with name, size, and download action.
- [x] Note that `useChat` holds messages in local `useState` rather than TanStack Query, unlike `use-auth`/`use-channels`/`use-directory`; there is no query to invalidate here, so incoming attachments must flow through the existing `chat.message`/`chat.recent` handlers and the `appendUnique` dedupe.
- [x] Preserve normal disabled/offline behavior, and make the composer clear only after the socket send succeeds according to the existing client semantics; failed uploads remain retryable.
- [x] Test text-only messages, attachment-only messages, text plus attachments, failed upload, image rendering, generic file rendering, and deduplication of incoming messages.
- [x] Commit: `feat(web): add chat file attachments`

### Task 7: Extend mock mode and app navigation

**Files:**
- Modify: `lib/mock/data.ts`
- Modify: `lib/mock/mock-api.ts`
- Modify: `lib/mock/mock-upload.ts`
- Modify: `lib/mock/mock-socket.ts`
- Modify: `components/app-shell.tsx`
- Modify: mock tests and fixtures

- [x] Add deterministic mock folders, files, image URLs, and attachment messages.
- [x] Simulate upload progress, cancellation, retryable failures, folder mutations, and file deletion through the `lib/upload.ts` dispatch established in Task 2.
- [x] Use inline data URIs or files under `public/` for mock images so mock mode needs no backend and no external host.
- [x] Make mock chat echo attachment metadata through the same event shape as the real socket.
- [x] Confirm navigation between channel chat and the files view keeps voice state, using the segment-driven shell from Task 3.
- [x] Test the complete feature with `NEXT_PUBLIC_MOCK=1` and verify no backend request is required.
- [x] Commit: `test(web): cover file storage in mock mode`

### Task 8: Add end-to-end coverage and regression gates

**Files:**
- Create: `tests/e2e/files.spec.ts`
- Modify: `playwright.config.ts` only if fixtures need the existing setup
- Modify: `README.md` with the new backend contract and local storage assumptions

- [x] Add a Playwright flow for opening channel files, creating a folder, uploading an image, previewing it, returning to chat, and sending it as an attachment. The existing config already boots `npm run dev` with `NEXT_PUBLIC_MOCK=1`, so this runs without a backend.
- [x] Cover API errors for oversized/unsupported uploads, deleted files, and unauthorized channels through visible UI states.
- [x] Run `npm run typecheck`, `npm test`, `npm run build`, and `npm run test:e2e` with mock mode where appropriate.
- [x] Verify existing chat, channel navigation, unread indicators, and voice-dock behavior remain unchanged — in particular that the arrow-key channel walk and the dock survive a trip through the files view.
- [x] Commit: `test(web): verify file storage flows`

## Acceptance Criteria

- A user can navigate the active channel's root and nested folders.
- A user can create, rename, move, and delete folders subject to backend permissions.
- A user can upload one or more images/files with visible progress and retry.
- Images preview in the browser; generic files expose a safe download action.
- A user can attach uploaded files to an ephemeral chat message without sending binary data through Socket.IO.
- Navigating between chat and the file browser never drops an active voice connection or unmounts the voice dock.
- The whole feature is exercisable with `NEXT_PUBLIC_MOCK=1` and no backend running.
- All loading, empty, failure, and permission states are visible and accessible.
- The existing CRT styling, text chat, unread tracking, and persistent voice dock continue to work.

Backend-dependent, verifiable only once the pre-conditions land:

- File attachments remain represented after a chat message is recovered from Redis, until the file itself is deleted.
- Image previews authenticate correctly when the client and API are on different subdomains.
