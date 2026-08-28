/**
 * Turns the authored 6x4 character sheet into the small sheet the app ships.
 *
 * The source is rendered art with anti-aliasing and a cream backdrop, not a
 * clean pixel grid — there is no block size to snap to (measured: no periodicity
 * locks). So the work is content-based: key out the background, find what every
 * character actually occupies, and put them all in one coordinate system so
 * they share a baseline and keep their relative sizes.
 *
 *   node scripts/build-sprites.mjs
 */
import { mkdir, writeFile } from 'node:fs/promises';
import sharp from 'sharp';

const SOURCE = 'assets/characters-source.png';
const OUT = 'public/sprites/characters.png';

const COLUMNS = 6;
const ROWS = 4;
/** Display tops out at 40px; this leaves headroom without shipping a poster. */
const CELL = 48;
/** How far from the border colour still counts as background. */
const TOLERANCE = 26;

function keyOutBackground(pixels, width, height) {
  const alpha = new Uint8Array(width * height).fill(255);
  const seen = new Uint8Array(width * height);
  const queue = [];

  const sample = (i) => [pixels[i * 3], pixels[i * 3 + 1], pixels[i * 3 + 2]];
  const [br, bg, bb] = sample(0);

  const isBackground = (i) => {
    const [r, g, b] = sample(i);
    return Math.abs(r - br) + Math.abs(g - bg) + Math.abs(b - bb) < TOLERANCE * 3;
  };

  for (let x = 0; x < width; x++) {
    queue.push(x, (height - 1) * width + x);
  }
  for (let y = 0; y < height; y++) {
    queue.push(y * width, y * width + width - 1);
  }

  // Flood fill from the border only. A plain colour key would punch holes in
  // the panda, the cleric's robe and the duck — their white is enclosed.
  while (queue.length > 0) {
    const index = queue.pop();
    if (seen[index] || !isBackground(index)) continue;
    seen[index] = 1;
    alpha[index] = 0;

    const x = index % width;
    const y = (index - x) / width;
    if (x > 0) queue.push(index - 1);
    if (x < width - 1) queue.push(index + 1);
    if (y > 0) queue.push(index - width);
    if (y < height - 1) queue.push(index + width);
  }

  const rgba = Buffer.alloc(width * height * 4);
  for (let i = 0; i < width * height; i++) {
    rgba[i * 4] = pixels[i * 3];
    rgba[i * 4 + 1] = pixels[i * 3 + 1];
    rgba[i * 4 + 2] = pixels[i * 3 + 2];
    rgba[i * 4 + 3] = alpha[i];
  }

  return rgba;
}

function boundingBox(rgba, width, height) {
  let minX = width,
    minY = height,
    maxX = -1,
    maxY = -1;

  for (let y = 0; y < height; y++) {
    for (let x = 0; x < width; x++) {
      if (rgba[(y * width + x) * 4 + 3] === 0) continue;
      if (x < minX) minX = x;
      if (x > maxX) maxX = x;
      if (y < minY) minY = y;
      if (y > maxY) maxY = y;
    }
  }

  return { minX, minY, maxX, maxY };
}

const source = sharp(SOURCE);
const { width, height } = await source.metadata();
const cellW = Math.round(width / COLUMNS);
const cellH = Math.round(height / ROWS);

const cells = [];
for (let row = 0; row < ROWS; row++) {
  for (let column = 0; column < COLUMNS; column++) {
    const { data } = await sharp(SOURCE)
      .extract({ left: column * cellW, top: row * cellH, width: cellW, height: cellH })
      .raw()
      .toBuffer({ resolveWithObject: true });

    const rgba = keyOutBackground(data, cellW, cellH);
    cells.push({ rgba, box: boundingBox(rgba, cellW, cellH) });
  }
}

// One coordinate system for all of them: relative heights survive, and the feet
// line up instead of every character floating at its own altitude.
const union = cells.reduce(
  (acc, { box }) => ({
    minX: Math.min(acc.minX, box.minX),
    minY: Math.min(acc.minY, box.minY),
    maxX: Math.max(acc.maxX, box.maxX),
    maxY: Math.max(acc.maxY, box.maxY),
  }),
  { minX: Infinity, minY: Infinity, maxX: -Infinity, maxY: -Infinity },
);

const cropW = union.maxX - union.minX + 1;
const cropH = union.maxY - union.minY + 1;
console.log(`celula fonte ${cellW}x${cellH} -> conteudo ${cropW}x${cropH}`);

const tiles = await Promise.all(
  cells.map(({ rgba }) =>
    sharp(rgba, { raw: { width: cellW, height: cellH, channels: 4 } })
      .extract({ left: union.minX, top: union.minY, width: cropW, height: cropH })
      .resize(CELL, CELL, { fit: 'contain', background: { r: 0, g: 0, b: 0, alpha: 0 } })
      .png()
      .toBuffer(),
  ),
);

await mkdir('public/sprites', { recursive: true });

const sheet = await sharp({
  create: {
    width: CELL * COLUMNS,
    height: CELL * ROWS,
    channels: 4,
    background: { r: 0, g: 0, b: 0, alpha: 0 },
  },
})
  .composite(
    tiles.map((input, index) => ({
      input,
      left: (index % COLUMNS) * CELL,
      top: Math.floor(index / COLUMNS) * CELL,
    })),
  )
  .png({ compressionLevel: 9, palette: true })
  .toBuffer();

await writeFile(OUT, sheet);
console.log(`${OUT}: ${CELL * COLUMNS}x${CELL * ROWS}, ${(sheet.length / 1024).toFixed(1)}KB`);
