/**
 * The 24 characters, sliced out of one sheet.
 *
 * The art is authored elsewhere and processed by `scripts/build-sprites.mjs`
 * into `public/sprites/characters.png` — a 6x4 grid of square cells sharing one
 * coordinate system, so every character keeps its relative size and stands on
 * the same ground line.
 *
 * Slicing is done in percentages rather than pixels: the sheet's resolution is
 * a detail of the build script, and the grid is the only thing this file needs
 * to agree with it about.
 */
export const SPRITE_SHEET = '/sprites/characters.png';
export const SHEET_COLUMNS = 6;
export const SHEET_ROWS = 4;

export type SpritePreset = {
  id: string;
  label: string;
};

/** Row-major, matching the sheet. */
export const SPRITE_PRESETS: SpritePreset[] = [
  { id: 'aventureiro', label: 'aventureiro' },
  { id: 'aventureira', label: 'aventureira' },
  { id: 'dev', label: 'dev' },
  { id: 'mago', label: 'mago' },
  { id: 'cavaleiro', label: 'cavaleiro' },
  { id: 'arqueiro', label: 'arqueiro' },

  { id: 'gato', label: 'gato' },
  { id: 'cachorro', label: 'cachorro' },
  { id: 'raposa', label: 'raposa' },
  { id: 'sapo', label: 'sapo' },
  { id: 'robo', label: 'robô' },
  { id: 'pato', label: 'pato' },

  { id: 'alienigena', label: 'alienígena' },
  { id: 'dinossauro', label: 'dinossauro' },
  { id: 'feiticeiro', label: 'feiticeiro' },
  { id: 'panda', label: 'panda' },
  { id: 'panda-vermelho', label: 'panda-vermelho' },
  { id: 'androide', label: 'androide' },

  { id: 'paladino', label: 'paladino' },
  { id: 'bruxa', label: 'bruxa' },
  { id: 'cacador', label: 'caçador' },
  { id: 'clerigo', label: 'clérigo' },
  { id: 'diabinho', label: 'diabinho' },
  { id: 'mago-do-gelo', label: 'mago do gelo' },
];

/** Where to park the sheet so `index` is the visible cell. */
export function spriteBackgroundPosition(index: number): string {
  const safe = ((index % SPRITE_PRESETS.length) + SPRITE_PRESETS.length) % SPRITE_PRESETS.length;
  const column = safe % SHEET_COLUMNS;
  const row = Math.floor(safe / SHEET_COLUMNS);

  // With the sheet scaled to 600% x 400%, one step is 100/(n-1) percent.
  const x = (column / (SHEET_COLUMNS - 1)) * 100;
  const y = (row / (SHEET_ROWS - 1)) * 100;

  return `${x}% ${y}%`;
}

export function presetIndex(presetId: string): number {
  const index = SPRITE_PRESETS.findIndex((preset) => preset.id === presetId);
  return index === -1 ? 0 : index;
}

/** Stable per person, so the same id always gets the same character. */
export function presetForSeed(seed: string): string {
  let hash = 0;
  for (const char of seed) {
    hash = (hash * 31 + char.charCodeAt(0)) >>> 0;
  }

  return SPRITE_PRESETS[hash % SPRITE_PRESETS.length].id;
}

/**
 * How high the character jumps, in pixels, for a given loudness.
 *
 * The mouth used to open because the sprite was generated from a matrix this
 * file owned; drawn art cannot do that without a second frame per character.
 * Jumping keeps the property that mattered: it is a meter, not a badge, so the
 * same number that drives the level bars drives the height.
 */
export const SPEAKING_THRESHOLD = 0.12;

export function hopHeightFor(level: number, isMuted: boolean): number {
  if (isMuted || level <= SPEAKING_THRESHOLD) return 0;

  const scaled = (level - SPEAKING_THRESHOLD) / (1 - SPEAKING_THRESHOLD);
  return Number((2.5 + Math.min(1, scaled) * 6).toFixed(1));
}
