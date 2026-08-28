'use client';

import { useEffect, useRef } from 'react';
import { applySinkId } from '../lib/audio-devices';
import type { MediaFeed } from '../lib/livekit';

/**
 * LiveKit hands over remote audio tracks but does not play them. One hidden
 * <audio> element per feed is what makes the room audible — and what gives the
 * app somewhere to apply per-participant volume, the chosen output device, and
 * deafen.
 */
export function RoomAudio({
  feeds,
  volumes = {},
  outputDeviceId,
  isDeafened = false,
}: {
  feeds: MediaFeed[];
  volumes?: Record<string, number>;
  outputDeviceId?: string;
  isDeafened?: boolean;
}) {
  return (
    <div aria-hidden className="hidden">
      {feeds.map((feed) => (
        <AudioFeed
          key={feed.id}
          feed={feed}
          volume={volumes[feed.participantId] ?? 1}
          outputDeviceId={outputDeviceId}
          isDeafened={isDeafened}
        />
      ))}
    </div>
  );
}

function AudioFeed({
  feed,
  volume,
  outputDeviceId,
  isDeafened,
}: {
  feed: MediaFeed;
  volume: number;
  outputDeviceId?: string;
  isDeafened: boolean;
}) {
  const audioRef = useRef<HTMLAudioElement | null>(null);

  // Same reason as the video elements: re-attaching a live audio track because
  // a new wrapper object arrived produces an audible gap.
  const feedRef = useRef(feed);
  feedRef.current = feed;

  useEffect(() => {
    const element = audioRef.current;
    if (!element) return;

    const attached = feedRef.current;
    attached.attach(element);
    return () => attached.detach(element);
  }, [feed.id]);

  // Deafen mutes rather than unsubscribes: the track keeps flowing, so
  // undeafening is instant instead of renegotiating with the SFU.
  useEffect(() => {
    const element = audioRef.current;
    if (!element) return;

    element.volume = Math.max(0, Math.min(1, volume));
    element.muted = isDeafened;
  }, [isDeafened, volume]);

  useEffect(() => {
    const element = audioRef.current;
    if (!element || !outputDeviceId) return;

    void applySinkId(element, outputDeviceId);
  }, [outputDeviceId]);

  return <audio ref={audioRef} autoPlay />;
}
