/**
 * Whether a key event came from somewhere the user is writing.
 *
 * Shared by every global shortcut handler: the app is keyboard-first, so a
 * single-letter binding that fired while someone was typing a message would
 * mute their microphone mid-sentence.
 */
export function isTypingTarget(target: EventTarget | null): boolean {
  const element = target as HTMLElement | null;
  if (!element) return false;

  return (
    element.tagName === 'INPUT' ||
    element.tagName === 'TEXTAREA' ||
    element.tagName === 'SELECT' ||
    element.isContentEditable
  );
}
