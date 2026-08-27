'use client';

import clsx from 'clsx';
import { useEffect, useRef } from 'react';
import type { MediaFeed } from '../lib/livekit';
import { LiveDot } from './ui/live-dot';

/** Renders every screen share published in the room. */
export function ScreenStage({ feeds }: { feeds: MediaFeed[] }) {
  if (feeds.length === 0) return null;

  return (
    <section className="border border-line bg-base-850">
      <header className="flex items-center justify-between gap-3 border-b border-line px-3 py-1.5">
        <h2 className="flex items-center gap-2 text-[11px] uppercase tracking-[0.22em] text-amber-500 glow">
          <LiveDot active tone="danger" />
          transmissões
        </h2>
        <span className="text-[11px] text-content-muted">{feeds.length} ativa(s)</span>
      </header>
      <div className="grid gap-3 p-3 md:grid-cols-2">
        {feeds.map((feed) => (
          <ScreenFeed key={feed.id} feed={feed} />
        ))}
      </div>
    </section>
  );
}

function ScreenFeed({ feed }: { feed: MediaFeed }) {
  const videoRef = useVideoFeed(feed);

  return (
    <figure className="relative border border-line">
      <span className="absolute left-2 top-2 z-10 flex items-center gap-1.5 border border-danger-600 bg-base-950/80 px-1.5 py-0.5 text-[10px] uppercase tracking-wider text-danger-500">
        <LiveDot active tone="danger" />
        ao vivo
      </span>
      <video
        ref={videoRef}
        autoPlay
        playsInline
        // The local preview must stay muted or it echoes back into the room.
        muted={feed.isLocal}
        className="aspect-video w-full bg-base-950 object-contain"
      />
      <figcaption className="border-t border-line px-2 py-1 text-[11px] text-content-muted">
        {feed.isLocal ? 'você (preview local)' : feed.participantName}
      </figcaption>
    </figure>
  );
}

/** Thumbnail used by the voice dock so the user can see the share is really up. */
export function ScreenPreview({ feed, className }: { feed: MediaFeed; className?: string }) {
  const videoRef = useVideoFeed(feed);

  return (
    <span className={clsx('relative inline-block border border-line', className)}>
      <span className="absolute left-1 top-1 z-10">
        <LiveDot active tone="danger" />
      </span>
      <video
        ref={videoRef}
        autoPlay
        playsInline
        muted={feed.isLocal}
        className="aspect-video w-28 bg-base-950 object-contain"
      />
    </span>
  );
}

function useVideoFeed(feed: MediaFeed) {
  const videoRef = useRef<HTMLVideoElement | null>(null);

  useEffect(() => {
    const element = videoRef.current;
    if (!element) return;

    feed.attach(element);
    return () => feed.detach(element);
  }, [feed]);

  return videoRef;
}
