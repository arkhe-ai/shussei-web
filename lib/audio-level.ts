export type LevelMeter = {
  /** Current loudness, 0..1. */
  level: () => number;
  stop: () => void;
};

/**
 * RMS meter over a live MediaStream. Used to drive the microphone indicator in
 * mock mode, where there is no LiveKit room reporting `audioLevel`.
 */
export function createLevelMeter(stream: MediaStream): LevelMeter {
  const AudioContextCtor =
    window.AudioContext ??
    (window as unknown as { webkitAudioContext?: typeof AudioContext }).webkitAudioContext;

  if (!AudioContextCtor) {
    return { level: () => 0, stop: () => {} };
  }

  const context = new AudioContextCtor();
  const source = context.createMediaStreamSource(stream);
  const analyser = context.createAnalyser();
  analyser.fftSize = 512;
  analyser.smoothingTimeConstant = 0.6;
  source.connect(analyser);

  const buffer = new Float32Array(analyser.fftSize);

  return {
    level() {
      analyser.getFloatTimeDomainData(buffer);

      let sum = 0;
      for (const sample of buffer) {
        sum += sample * sample;
      }

      const rms = Math.sqrt(sum / buffer.length);
      // Speech RMS sits around 0.02–0.2, so scale it up into a usable 0..1.
      return Math.min(1, rms * 6);
    },
    stop() {
      source.disconnect();
      void context.close();
    },
  };
}
