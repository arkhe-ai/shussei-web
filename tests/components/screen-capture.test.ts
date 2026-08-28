import { beforeEach, describe, expect, it, vi } from 'vitest';

const createLocalScreenTracks = vi.fn();

vi.mock('livekit-client', async (importOriginal) => ({
  ...(await importOriginal<typeof import('livekit-client')>()),
  createLocalScreenTracks,
}));

const { startScreenShare } = await import('../../lib/livekit');
const { Track } = await import('livekit-client');

function fakeTrack(kind: 'video' | 'audio') {
  return {
    kind: kind === 'video' ? Track.Kind.Video : Track.Kind.Audio,
    stop: vi.fn(),
    mediaStreamTrack: { addEventListener: vi.fn() },
  };
}

function fakeRoom(publishTrack = vi.fn().mockResolvedValue(undefined)) {
  return {
    room: {
      localParticipant: { publishTrack, getTrackPublication: vi.fn(), unpublishTrack: vi.fn() },
    } as never,
    publishTrack,
  };
}

function denied(name: string, message = 'nope') {
  return Object.assign(new Error(message), { name });
}

describe('startScreenShare capture ladder', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.spyOn(console, 'error').mockImplementation(() => {});
  });

  it('asks for system audio first', async () => {
    createLocalScreenTracks.mockResolvedValueOnce([fakeTrack('video'), fakeTrack('audio')]);
    const { room } = fakeRoom();

    const result = await startScreenShare(room);

    expect(createLocalScreenTracks).toHaveBeenCalledTimes(1);
    expect(createLocalScreenTracks).toHaveBeenCalledWith({ audio: true, systemAudio: 'include' });
    expect(result).toEqual({ mode: 'screen+audio' });
  });

  it('drops the Chrome-only option when the browser rejects the whole call', async () => {
    // `systemAudio` is Chrome-only, and a browser that does not know it rejects
    // getDisplayMedia before the picker opens — which is why one machine could
    // share with audio and another could not start a share at all.
    createLocalScreenTracks
      .mockRejectedValueOnce(denied('TypeError', "Failed to execute 'getDisplayMedia'"))
      .mockResolvedValueOnce([fakeTrack('video'), fakeTrack('audio')]);
    const { room } = fakeRoom();

    const result = await startScreenShare(room);

    expect(createLocalScreenTracks).toHaveBeenNthCalledWith(2, { audio: true });
    expect(result).toEqual({ mode: 'screen+audio' });
  });

  it('still shares the picture when audio is impossible, and says why', async () => {
    createLocalScreenTracks
      .mockRejectedValueOnce(denied('NotReadableError', 'no system audio'))
      .mockRejectedValueOnce(denied('NotReadableError', 'no system audio'))
      .mockResolvedValueOnce([fakeTrack('video')]);
    const { room, publishTrack } = fakeRoom();

    const result = await startScreenShare(room);

    expect(createLocalScreenTracks).toHaveBeenNthCalledWith(3, { audio: false });
    expect(publishTrack).toHaveBeenCalledTimes(1);
    expect(result.mode).toBe('screen-only');
    expect(result.audioError).toContain('NotReadableError');
  });

  it('never re-prompts after the user closes the picker', async () => {
    for (const name of ['NotAllowedError', 'AbortError']) {
      createLocalScreenTracks.mockReset();
      createLocalScreenTracks.mockRejectedValue(denied(name));
      const { room } = fakeRoom();

      await expect(startScreenShare(room)).rejects.toMatchObject({ name });
      expect(createLocalScreenTracks).toHaveBeenCalledTimes(1);
    }
  });

  it('keeps the picture up when only the audio publish is refused', async () => {
    const audio = fakeTrack('audio');
    createLocalScreenTracks.mockResolvedValueOnce([fakeTrack('video'), audio]);
    const publishTrack = vi
      .fn()
      .mockResolvedValueOnce(undefined)
      .mockRejectedValueOnce(denied('PublishTrackError', 'server said no'));
    const { room } = fakeRoom(publishTrack);

    const result = await startScreenShare(room);

    expect(result.mode).toBe('screen-only');
    expect(result.audioError).toContain('server said no');
    expect(audio.stop).toHaveBeenCalled();
  });
});
