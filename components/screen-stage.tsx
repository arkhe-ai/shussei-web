'use client';

import clsx from 'clsx';
import { useCallback, useEffect, useRef, useState } from 'react';
import { isTypingTarget } from '../lib/keyboard';
import type { MediaFeed } from '../lib/livekit';
import { CommandButton } from './ui/command-button';
import { LiveDot } from './ui/live-dot';
import { SignalLost } from './ui/signal-lost';

/**
 * `inline` is the panel inside the channel. `fullscreen` is the browser's own
 * fullscreen; `theater` is the fallback for when it refuses — inside an iframe
 * or under a permissions policy, `requestFullscreen()` rejects, and an expand
 * button that silently does nothing is worse than one that expands in-page.
 */
type StageMode = 'inline' | 'fullscreen' | 'theater';

export function ScreenStage({ feeds }: { feeds: MediaFeed[] }) {
  const containerRef = useRef<HTMLElement | null>(null);
  const [focusedId, setFocusedId] = useState<string | null>(null);
  const [mode, setMode] = useState<StageMode>('inline');

  // A single share is always the focus; there is no grid to choose from.
  const resolvedFocus =
    feeds.find((feed) => feed.id === focusedId) ?? (feeds.length === 1 ? feeds[0] : null);

  const isExpanded = mode !== 'inline';
  // Squarest arrangement that stays readable; past nine shares the tiles are
  // too small to tell apart anyway, so the column count stops growing.
  const gridColumns = Math.min(3, Math.ceil(Math.sqrt(feeds.length)));

  // Whoever was focused may have stopped sharing.
  useEffect(() => {
    if (focusedId && !feeds.some((feed) => feed.id === focusedId)) {
      setFocusedId(null);
    }
  }, [feeds, focusedId]);

  // Nothing left to show: never strand the user in an empty fullscreen.
  useEffect(() => {
    if (feeds.length > 0 || mode === 'inline') return;

    if (document.fullscreenElement) void document.exitFullscreen().catch(() => {});
    setMode('inline');
  }, [feeds.length, mode]);

  useEffect(() => {
    function handleChange() {
      if (!document.fullscreenElement) {
        // Covers Esc and the browser's own exit affordance.
        setMode((current) => (current === 'fullscreen' ? 'inline' : current));
      }
    }

    document.addEventListener('fullscreenchange', handleChange);
    return () => document.removeEventListener('fullscreenchange', handleChange);
  }, []);

  const toggleExpanded = useCallback(async () => {
    if (mode !== 'inline') {
      if (document.fullscreenElement) {
        await document.exitFullscreen().catch(() => {});
      }
      setMode('inline');
      return;
    }

    try {
      await containerRef.current?.requestFullscreen();
      setMode('fullscreen');
    } catch {
      setMode('theater');
    }
  }, [mode]);

  useEffect(() => {
    if (feeds.length === 0) return;

    function handleKeyDown(event: KeyboardEvent) {
      if (event.metaKey || event.ctrlKey || event.altKey) return;
      if (isTypingTarget(event.target)) return;

      const key = event.key.toLowerCase();

      if (key === 'f') {
        event.preventDefault();
        void toggleExpanded();
        return;
      }

      if (key === 'g' && feeds.length > 1) {
        event.preventDefault();
        setFocusedId((current) => (current ? null : feeds[0].id));
        return;
      }

      // 1..9 jumps straight to a share, the way the filmstrip is numbered.
      const index = Number(event.key) - 1;
      if (Number.isInteger(index) && index >= 0 && index < feeds.length) {
        event.preventDefault();
        setFocusedId(feeds[index].id);
      }
    }

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [feeds, toggleExpanded]);

  if (feeds.length === 0) return null;

  return (
    <section
      ref={containerRef}
      className={clsx(
        'border border-line bg-base-850',
        mode === 'theater' && 'fixed inset-0 z-[60] border-0',
        isExpanded && 'flex h-full flex-col',
      )}
    >
      <header className="flex shrink-0 flex-wrap items-center justify-between gap-3 border-b border-line px-3 py-1.5">
        <h2 className="flex items-center gap-2 text-[11px] uppercase tracking-[0.22em] text-amber-500 glow">
          <LiveDot active tone="danger" />
          transmissões
        </h2>

        <span className="flex items-center gap-2">
          <span className="text-[11px] text-content-muted">{feeds.length} ativa(s)</span>
          {feeds.length > 1 ? (
            <CommandButton
              hotkey="G"
              aria-pressed={resolvedFocus !== null}
              onClick={() => setFocusedId((current) => (current ? null : feeds[0].id))}
            >
              {resolvedFocus ? 'Ver todas' : 'Focar uma'}
            </CommandButton>
          ) : null}
          <CommandButton hotkey="F" aria-pressed={isExpanded} onClick={() => void toggleExpanded()}>
            {isExpanded ? 'Sair da tela cheia' : 'Tela cheia'}
          </CommandButton>
        </span>
      </header>

      {resolvedFocus ? (
        <div className={clsx('flex min-h-0 flex-col gap-2 p-3', isExpanded && 'flex-1')}>
          <ScreenFeed
            feed={resolvedFocus}
            fill={isExpanded}
            activateLabel={isExpanded ? 'sair da tela cheia de' : 'expandir'}
            onActivate={() => void toggleExpanded()}
          />

          {feeds.length > 1 ? (
            <ul className="flex shrink-0 gap-2 overflow-x-auto pb-1">
              {feeds.map((feed, index) => (
                <li key={feed.id} className="shrink-0">
                  <Thumbnail
                    feed={feed}
                    index={index + 1}
                    isActive={feed.id === resolvedFocus.id}
                    onSelect={() => setFocusedId(feed.id)}
                  />
                </li>
              ))}
            </ul>
          ) : null}
        </div>
      ) : (
        <div
          className={clsx(
            'grid gap-3 overflow-y-auto p-3',
            isExpanded ? 'min-h-0 flex-1 auto-rows-min place-content-center' : 'md:grid-cols-2',
          )}
          // Columns follow the number of shares, not the breakpoint: two people
          // sharing on a wide monitor should get half the window each, not two
          // thirds of it with an empty column left over.
          style={
            isExpanded
              ? { gridTemplateColumns: `repeat(${gridColumns}, minmax(0, 1fr))` }
              : undefined
          }
        >
          {feeds.map((feed, index) => (
            <ScreenFeed
              key={feed.id}
              feed={feed}
              index={index + 1}
              onActivate={() => setFocusedId(feed.id)}
            />
          ))}
        </div>
      )}
    </section>
  );
}

function ScreenFeed({
  feed,
  index,
  fill = false,
  activateLabel = 'focar',
  onActivate,
}: {
  feed: MediaFeed;
  index?: number;
  /** Take the height available instead of holding 16:9. */
  fill?: boolean;
  activateLabel?: string;
  onActivate?: () => void;
}) {
  const { videoRef, hasSignal } = useVideoFeed(feed);

  return (
    <figure
      className={clsx(
        'relative flex min-h-0 flex-col border border-line',
        fill && 'h-full min-h-0 flex-1',
      )}
    >
      <span
        className={clsx(
          'absolute left-2 top-2 z-30 flex items-center gap-1.5 border bg-base-950/80 px-1.5 py-0.5 text-[10px] uppercase tracking-wider',
          hasSignal ? 'border-danger-600 text-danger-500' : 'border-line text-content-muted',
        )}
      >
        <LiveDot active={hasSignal} tone={hasSignal ? 'danger' : 'muted'} />
        {hasSignal ? 'ao vivo' : 'congelado'}
      </span>

      {index ? (
        <span className="absolute right-2 top-2 z-30 border border-line bg-base-950/80 px-1 text-[10px] text-content-muted">
          {index}
        </span>
      ) : null}

      <button
        type="button"
        onClick={onActivate}
        aria-label={`${activateLabel} ${feed.participantName}`}
        className="focus-ring relative block min-h-0 flex-1 cursor-pointer"
      >
        <video
          ref={videoRef}
          autoPlay
          playsInline
          // The local preview must stay muted or it echoes back into the room.
          muted={feed.isLocal}
          className={clsx('w-full bg-base-950 object-contain', fill ? 'h-full' : 'aspect-video')}
        />
        {hasSignal ? null : <SignalLost />}
      </button>

      <figcaption className="shrink-0 border-t border-line px-2 py-1 text-[11px] text-content-muted">
        {feed.isLocal ? 'você (preview local)' : feed.participantName}
      </figcaption>
    </figure>
  );
}

function Thumbnail({
  feed,
  index,
  isActive,
  onSelect,
}: {
  feed: MediaFeed;
  index: number;
  isActive: boolean;
  onSelect: () => void;
}) {
  const { videoRef, hasSignal } = useVideoFeed(feed);

  return (
    <button
      type="button"
      onClick={onSelect}
      aria-current={isActive ? 'true' : undefined}
      aria-label={`ver ${feed.isLocal ? 'sua transmissão' : feed.participantName}`}
      className={clsx(
        'focus-ring relative block border transition-colors',
        isActive ? 'border-line-bright' : 'border-line hover:border-line-bright',
      )}
    >
      <span
        className={clsx(
          'absolute left-1 top-1 z-30 px-1 text-[9px] tabular-nums',
          isActive ? 'bg-amber-500 text-content-inverse' : 'bg-base-950/80 text-content-muted',
        )}
      >
        {index}
      </span>
      <video
        ref={videoRef}
        autoPlay
        playsInline
        muted={feed.isLocal}
        className="aspect-video w-[124px] bg-base-950 object-contain"
      />
      {hasSignal ? null : <SignalLost compact />}
      <span className="block max-w-[124px] truncate border-t border-line px-1 py-0.5 text-[10px] text-content-muted">
        {feed.isLocal ? 'você' : feed.participantName}
      </span>
    </button>
  );
}

/** Thumbnail used by the voice dock so the user can see the share is really up. */
export function ScreenPreview({ feed, className }: { feed: MediaFeed; className?: string }) {
  const { videoRef, hasSignal } = useVideoFeed(feed);

  return (
    <span className={clsx('relative inline-block border border-line', className)}>
      <span className="absolute left-1 top-1 z-30">
        <LiveDot active={hasSignal} tone={hasSignal ? 'danger' : 'muted'} />
      </span>
      <video
        ref={videoRef}
        autoPlay
        playsInline
        muted={feed.isLocal}
        className="aspect-video w-28 bg-base-950 object-contain"
      />
      {hasSignal ? null : <SignalLost compact />}
    </span>
  );
}

const WATCHDOG_MS = 700;
/** Three quiet samples ≈ 2s of a frozen picture before we call it lost. */
const STALE_SAMPLES = 3;

/**
 * Attaches the track and watches for a frozen picture.
 *
 * A dropped WebRTC video track does not fire `ended` on the element — the last
 * frame simply stays on screen forever, which reads as a working share of a
 * motionless window. Sampling `currentTime` is what actually distinguishes the
 * two: it stops advancing when frames stop arriving.
 */
function useVideoFeed(feed: MediaFeed) {
  const videoRef = useRef<HTMLVideoElement | null>(null);
  const [hasSignal, setHasSignal] = useState(true);

  // Read inside the effect so a new object describing the same track does not
  // re-run it. Belt and braces with `feedsChanged` upstream: this element must
  // not blink even if some future caller hands it fresh objects again.
  const feedRef = useRef(feed);
  feedRef.current = feed;

  useEffect(() => {
    const element = videoRef.current;
    if (!element) return;

    // Whatever attached has to be what detaches.
    const attached = feedRef.current;
    attached.attach(element);
    setHasSignal(true);

    let lastTime = -1;
    let staleCount = 0;

    const id = window.setInterval(() => {
      const current = element.currentTime;

      if (element.paused || current === lastTime) {
        staleCount += 1;
        if (staleCount >= STALE_SAMPLES) setHasSignal(false);
      } else {
        staleCount = 0;
        setHasSignal(true);
      }

      lastTime = current;
    }, WATCHDOG_MS);

    return () => {
      window.clearInterval(id);
      attached.detach(element);
    };
    // Keyed on the track, not on the object wrapping it.
  }, [feed.id]);

  return { videoRef, hasSignal };
}
