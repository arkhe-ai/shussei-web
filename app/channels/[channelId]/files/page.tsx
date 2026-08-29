/**
 * The file browser is rendered by `app/channels/layout.tsx`, which reads the
 * active segment and tells `AppShell` to swap its main pane. Rendering it here
 * instead would remount the shell and drop any live voice connection with it.
 * This segment exists only so the route resolves.
 */
export default function ChannelFilesPage() {
  return null;
}
