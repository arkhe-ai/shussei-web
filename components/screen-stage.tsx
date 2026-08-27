'use client';

import { useEffect, useRef } from 'react';
import type { MediaFeed } from '../lib/livekit';

/** Renders every screen share published in the room. */
export function ScreenStage({ feeds }: { feeds: MediaFeed[] }) {
  if (feeds.length === 0) return null;

  return (
    <section className="border border-line bg-base-850">
      <header className="flex items-center justify-between gap-3 border-b border-line px-3 py-1.5">
        <h2 className="text-[11px] uppercase tracking-[0.22em] text-amber-500 glow">
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
  const videoRef = useRef<HTMLVideoElement | null>(null);

  useEffect(() => {
    const element = videoRef.current;
    if (!element) return;

    feed.attach(element);
    return () => feed.detach(element);
  }, [feed]);

  return (
    <figure className="border border-line">
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
