/**
 * Pixel characters, in the same amber phosphor as everything else.
 *
 * A sprite is a 12x14 grid of shade codes, authored by hand:
 *   `.` transparent   `1` outline/dark   `2` base   `3` highlight
 *
 * Mouth and feet are patched in rather than drawn per frame, so a preset is one
 * matrix instead of four, and adding a character means adding two rows of hair.
 */
export const SPRITE_WIDTH = 12;
export const SPRITE_HEIGHT = 14;

/** Rows 0..8: head and shoulders, for the small avatars used inline. */
export const BUST_HEIGHT = 9;

export type Shade = '1' | '2' | '3';
export type MouthState = 'closed' | 'open' | 'wide';

type Preset = {
  id: string;
  label: string;
  /** Rows 0 and 1. */
  hair: [string, string];
  /** Fill used for the torso block. */
  torso: Shade;
};

export const SPRITE_PRESETS: Preset[] = [
  { id: 'curto', label: 'curto', hair: ['...111111...', '..11111111..'], torso: '3' },
  { id: 'chapeu', label: 'chapéu', hair: ['.1111111111.', '..11111111..'], torso: '2' },
  { id: 'moicano', label: 'moicano', hair: ['.....11.....', '..11111111..'], torso: '3' },
  { id: 'longo', label: 'longo', hair: ['...111111...', '.1111111111.'], torso: '2' },
  { id: 'careca', label: 'careca', hair: ['............', '...122221...'], torso: '3' },
  { id: 'gorro', label: 'gorro', hair: ['..11111111..', '..11111111..'], torso: '2' },
];

const MOUTH_FILL: Record<MouthState, string> = {
  closed: '2112',
  open: '1111',
  wide: '1111',
};

/** Row 6 only opens up on the widest mouth, which is what sells a shout. */
const CHIN: Record<MouthState, string> = {
  closed: '...122221...',
  open: '...122221...',
  wide: '...121121...',
};

const FEET = {
  together: '...11..11...',
  apart: '..11....11..',
} as const;

export type FootState = keyof typeof FEET;

function bodyRows(preset: Preset, mouth: MouthState, feet: FootState): string[] {
  const torso = preset.torso.repeat(4);

  return [
    preset.hair[0],
    preset.hair[1],
    '..12222221..',
    '..12122121..',
    '..12222221..',
    `..12${MOUTH_FILL[mouth]}21..`,
    CHIN[mouth],
    '....1221....',
    `..11${torso}11..`,
    `.121${torso}121.`,
    `.121${torso}121.`,
    `..11${torso}11..`,
    '...12..21...',
    FEET[feet],
  ];
}

/**
 * One SVG path per shade, with horizontal runs merged — a 12x14 grid drawn as
 * one <rect> per pixel would put ~100 nodes on screen per person, and the voice
 * strip can hold forty of them.
 */
function buildPaths(rows: string[]): Record<Shade, string> {
  const paths: Record<Shade, string> = { '1': '', '2': '', '3': '' };

  rows.forEach((row, y) => {
    let x = 0;

    while (x < row.length) {
      const shade = row[x];
      if (shade === '.') {
        x += 1;
        continue;
      }

      let run = 1;
      while (x + run < row.length && row[x + run] === shade) run += 1;

      paths[shade as Shade] += `M${x} ${y}h${run}v1h-${run}z`;
      x += run;
    }
  });

  return paths;
}

const cache = new Map<string, Record<Shade, string>>();

export function spritePaths(
  presetId: string,
  mouth: MouthState,
  feet: FootState,
): Record<Shade, string> {
  const key = `${presetId}|${mouth}|${feet}`;
  const hit = cache.get(key);
  if (hit) return hit;

  const preset = SPRITE_PRESETS.find((candidate) => candidate.id === presetId) ?? SPRITE_PRESETS[0];
  const paths = buildPaths(bodyRows(preset, mouth, feet));
  cache.set(key, paths);

  return paths;
}

/** Stable per person, so the same id always gets the same character. */
export function presetForSeed(seed: string): string {
  let hash = 0;
  for (const char of seed) {
    hash = (hash * 31 + char.charCodeAt(0)) >>> 0;
  }

  return SPRITE_PRESETS[hash % SPRITE_PRESETS.length].id;
}

/** Loudness to mouth opening. Thresholds match the speaking cutoff elsewhere. */
export function mouthForLevel(level: number, isMuted: boolean): MouthState {
  if (isMuted || level <= 0.12) return 'closed';
  return level > 0.38 ? 'wide' : 'open';
}
