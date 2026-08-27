'use client';

import { useEffect, useRef } from 'react';
import type { MediaFeed } from '../lib/livekit';

/**
 * LiveKit hands over remote audio tracks but does not play them. One hidden
 * <audio> element per feed is what makes the room audible.
 */
export function RoomAudio({ feeds }: { feeds: MediaFeed[] }) {
  return (
    <div aria-hidden className="hidden">
      {feeds.map((feed) => (
        <AudioFeed key={feed.id} feed={feed} />
      ))}
    </div>
  );
}

function AudioFeed({ feed }: { feed: MediaFeed }) {
  const audioRef = useRef<HTMLAudioElement | null>(null);

  useEffect(() => {
    const element = audioRef.current;
    if (!element) return;

    feed.attach(element);
    return () => feed.detach(element);
  }, [feed]);

  return <audio ref={audioRef} autoPlay />;
}
