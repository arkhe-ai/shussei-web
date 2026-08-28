'use client';

import type { MediaFeed } from '../livekit';

const WIDTH = 640;
const HEIGHT = 360;
const FPS = 10;

/**
 * A fake screen share, painted into a canvas and captured as a real
 * MediaStream.
 *
 * The stage — grid, focus, filmstrip, fullscreen, freeze detection — is
 * unbuildable without something to put on it, and neither `getDisplayMedia`
 * nor a LiveKit room is available while developing against the mock. A canvas
 * stream is a genuine video track, so every code path downstream is the real
 * one.
 */
export function createMockScreenFeed(
  participantId: string,
  participantName: string,
  seed: number,
): { feed: MediaFeed; stop: () => void } {
  const canvas = document.createElement('canvas');
  canvas.width = WIDTH;
  canvas.height = HEIGHT;

  const context = canvas.getContext('2d');
  const stream = canvas.captureStream(FPS);

  let frame = 0;
  const id = window.setInterval(() => {
    frame += 1;
    if (context) paint(context, participantName, seed, frame);
  }, 1000 / FPS);

  return {
    feed: {
      id: `mock-screen-${participantId}`,
      participantId,
      participantName,
      isLocal: false,
      attach: (element) => {
        element.srcObject = stream;
        element.play?.().catch(() => {});
      },
      detach: (element) => {
        element.srcObject = null;
      },
    },
    stop: () => {
      window.clearInterval(id);
      stream.getTracks().forEach((track) => track.stop());
    },
  };
}

function paint(
  context: CanvasRenderingContext2D,
  participantName: string,
  seed: number,
  frame: number,
): void {
  context.fillStyle = '#0a0705';
  context.fillRect(0, 0, WIDTH, HEIGHT);

  // Moving bars, so a frozen picture is obvious to the eye and to the watchdog.
  context.fillStyle = '#221a0f';
  for (let index = 0; index < 9; index += 1) {
    const x = ((frame * (2 + (seed % 3)) + index * 74) % (WIDTH + 74)) - 74;
    context.fillRect(x, 0, 34, HEIGHT);
  }

  context.strokeStyle = '#7d5718';
  context.lineWidth = 2;
  context.strokeRect(8, 8, WIDTH - 16, HEIGHT - 16);

  context.fillStyle = '#ffab3d';
  context.font = 'bold 30px ui-monospace, monospace';
  context.fillText(`tela de ${participantName}`, 34, 150);

  context.fillStyle = '#a3762f';
  context.font = '20px ui-monospace, monospace';
  context.fillText('transmissão simulada (modo mock)', 34, 186);
  context.fillText(`frame ${String(frame).padStart(5, '0')}`, 34, 216);
}
