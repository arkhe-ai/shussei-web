'use client';

import clsx from 'clsx';
import { useEffect, useState } from 'react';
import {
  type NotificationState,
  askNotificationPermission,
  isSoundEnabled,
  notificationState,
  playCue,
  setSoundEnabled,
} from '../../lib/notify';

/**
 * Notification blip on/off, plus the desktop-notification prompt.
 *
 * Both live behind one control because they answer the same question — "tell me
 * when something happens elsewhere" — and because the browser only accepts a
 * notification prompt from inside a user gesture, which this click provides.
 */
export function SoundToggle() {
  const [enabled, setEnabled] = useState(true);
  const [notifications, setNotifications] = useState<NotificationState>('unsupported');

  // localStorage and Notification are both unavailable during SSR.
  useEffect(() => {
    setEnabled(isSoundEnabled());
    setNotifications(notificationState());
  }, []);

  async function handleToggle() {
    const next = !enabled;
    setEnabled(next);
    setSoundEnabled(next);

    if (!next) return;

    // Play it back so the choice is audible, and take the gesture while we have it.
    playCue('message');
    if (notificationState() === 'default') {
      setNotifications(await askNotificationPermission());
    }
  }

  const isBlocked = notifications === 'denied';

  return (
    <button
      type="button"
      onClick={() => void handleToggle()}
      aria-pressed={enabled}
      title={
        isBlocked
          ? 'O navegador bloqueou as notificações deste site; o som continua funcionando.'
          : 'Blip e notificação quando chega mensagem em outro canal'
      }
      className={clsx(
        'focus-ring flex items-center gap-1 text-[11px] transition-colors',
        enabled ? 'text-content-secondary hover:text-amber-300' : 'text-content-muted',
      )}
    >
      <span aria-hidden className={clsx('text-[10px]', enabled && 'text-online glow')}>
        {enabled ? '●' : '○'}
      </span>
      som
      {enabled && isBlocked ? (
        <span aria-hidden className="text-content-muted">
          (sem popup)
        </span>
      ) : null}
    </button>
  );
}
