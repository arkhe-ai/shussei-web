import { act, fireEvent, render, screen } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { ScreenStage } from '../../components/screen-stage';
import { type MediaFeed, feedsChanged } from '../../lib/livekit';

function makeFeed(id: string, name: string, isLocal = false): MediaFeed {
  return {
    id,
    participantId: `u-${name}`,
    participantName: name,
    isLocal,
    attach: vi.fn(),
    detach: vi.fn(),
  };
}

/** Pretends frames are arriving, so the freeze watchdog stays quiet. */
function stubPlayingVideo() {
  let time = 0;
  Object.defineProperty(HTMLMediaElement.prototype, 'paused', {
    configurable: true,
    get: () => false,
  });
  Object.defineProperty(HTMLMediaElement.prototype, 'currentTime', {
    configurable: true,
    get: () => (time += 0.7),
    set: () => {},
  });
}

function stubFullscreen({ allowed }: { allowed: boolean }) {
  const request = vi.fn(() => (allowed ? Promise.resolve() : Promise.reject(new Error('denied'))));
  const exit = vi.fn(() => Promise.resolve());

  Object.defineProperty(Element.prototype, 'requestFullscreen', {
    configurable: true,
    writable: true,
    value: request,
  });
  Object.defineProperty(document, 'exitFullscreen', {
    configurable: true,
    writable: true,
    value: exit,
  });
  Object.defineProperty(document, 'fullscreenElement', {
    configurable: true,
    writable: true,
    value: null,
  });

  return { request, exit };
}

describe('ScreenStage', () => {
  beforeEach(() => {
    stubPlayingVideo();
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  it('shows nothing when nobody is sharing', () => {
    const { container } = render(<ScreenStage feeds={[]} />);

    expect(container).toBeEmptyDOMElement();
  });

  it('focuses a lone share without offering a layout choice', () => {
    render(<ScreenStage feeds={[makeFeed('t1', 'ana')]} />);

    expect(screen.queryByRole('button', { name: /focar uma/i })).not.toBeInTheDocument();
    expect(screen.getByRole('button', { name: /tela cheia/i })).toBeInTheDocument();
  });

  it('starts as a grid and focuses the one you pick', () => {
    render(<ScreenStage feeds={[makeFeed('t1', 'ana'), makeFeed('t2', 'caio')]} />);

    expect(screen.getByRole('button', { name: /focar uma/i })).toBeInTheDocument();

    fireEvent.click(screen.getByRole('button', { name: /focar caio/i }));

    // Focused view puts every share in the filmstrip underneath.
    expect(screen.getByRole('button', { name: /ver todas/i })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /ver ana/i })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /ver caio/i })).toHaveAttribute(
      'aria-current',
      'true',
    );
  });

  it('picks a share by its filmstrip number', () => {
    render(<ScreenStage feeds={[makeFeed('t1', 'ana'), makeFeed('t2', 'caio')]} />);

    fireEvent.keyDown(window, { key: '2' });

    expect(screen.getByRole('button', { name: /ver caio/i })).toHaveAttribute(
      'aria-current',
      'true',
    );
  });

  it('falls back to the grid when the focused person stops sharing', () => {
    const feeds = [makeFeed('t1', 'ana'), makeFeed('t2', 'caio')];
    const { rerender } = render(<ScreenStage feeds={feeds} />);

    fireEvent.click(screen.getByRole('button', { name: /focar caio/i }));
    expect(screen.getByRole('button', { name: /ver todas/i })).toBeInTheDocument();

    rerender(<ScreenStage feeds={[feeds[0]]} />);

    expect(screen.queryByRole('button', { name: /ver todas/i })).not.toBeInTheDocument();
  });
});

describe('ScreenStage fullscreen', () => {
  beforeEach(() => {
    stubPlayingVideo();
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  it('asks the browser for real fullscreen', async () => {
    const { request } = stubFullscreen({ allowed: true });
    render(<ScreenStage feeds={[makeFeed('t1', 'ana')]} />);

    await act(async () => {
      fireEvent.click(screen.getByRole('button', { name: /^tela cheia$/i }));
    });

    expect(request).toHaveBeenCalled();
    expect(screen.getByRole('button', { name: /^sair da tela cheia$/i })).toBeInTheDocument();
  });

  it('expands in-page when the browser refuses', async () => {
    // Inside an iframe or under a permissions policy `requestFullscreen()`
    // rejects; an expand button that silently does nothing is worse than one
    // that expands in place.
    const { request } = stubFullscreen({ allowed: false });
    const { container } = render(<ScreenStage feeds={[makeFeed('t1', 'ana')]} />);

    await act(async () => {
      fireEvent.click(screen.getByRole('button', { name: /^tela cheia$/i }));
    });

    expect(request).toHaveBeenCalled();
    expect(container.querySelector('section')?.className).toContain('fixed');
    expect(screen.getByRole('button', { name: /^sair da tela cheia$/i })).toBeInTheDocument();
  });

  it('never strands you in an empty fullscreen', async () => {
    stubFullscreen({ allowed: false });
    const { container, rerender } = render(<ScreenStage feeds={[makeFeed('t1', 'ana')]} />);

    await act(async () => {
      fireEvent.click(screen.getByRole('button', { name: /^tela cheia$/i }));
    });
    expect(container.querySelector('section')?.className).toContain('fixed');

    rerender(<ScreenStage feeds={[]} />);

    expect(container).toBeEmptyDOMElement();
  });
});

describe('feed re-attachment', () => {
  beforeEach(() => {
    stubPlayingVideo();
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  it('does not re-attach a track just because a new wrapper object arrived', () => {
    // `readScreenFeeds` mints fresh MediaFeed objects on every room event. Keyed
    // on object identity, the <video> detached and re-attached on every sync and
    // the picture blinked — that was the reported flicker.
    const first = makeFeed('t1', 'ana');
    const { rerender } = render(<ScreenStage feeds={[first]} />);

    expect(first.attach).toHaveBeenCalledTimes(1);

    const sameTrackNewObject = makeFeed('t1', 'ana');
    rerender(<ScreenStage feeds={[sameTrackNewObject]} />);
    rerender(<ScreenStage feeds={[makeFeed('t1', 'ana')]} />);

    expect(first.detach).not.toHaveBeenCalled();
    expect(sameTrackNewObject.attach).not.toHaveBeenCalled();
  });

  it('still swaps when the track behind it really changes', () => {
    const first = makeFeed('t1', 'ana');
    const { rerender } = render(<ScreenStage feeds={[first]} />);

    const replacement = makeFeed('t2', 'ana');
    rerender(<ScreenStage feeds={[replacement]} />);

    expect(first.detach).toHaveBeenCalledTimes(1);
    expect(replacement.attach).toHaveBeenCalledTimes(1);
  });
});

describe('feedsChanged', () => {
  it('ignores a fresh list describing the same tracks', () => {
    const before = [makeFeed('t1', 'ana'), makeFeed('t2', 'caio')];
    const after = [makeFeed('t1', 'ana'), makeFeed('t2', 'caio')];

    expect(feedsChanged(before, after)).toBe(false);
  });

  it('notices somebody starting or stopping a share', () => {
    const before = [makeFeed('t1', 'ana')];

    expect(feedsChanged(before, [])).toBe(true);
    expect(feedsChanged(before, [makeFeed('t1', 'ana'), makeFeed('t2', 'caio')])).toBe(true);
    expect(feedsChanged(before, [makeFeed('t9', 'ana')])).toBe(true);
  });

  it('notices a participant being renamed behind the same track', () => {
    expect(feedsChanged([makeFeed('t1', 'ana')], [makeFeed('t1', 'ana maria')])).toBe(true);
  });
});
