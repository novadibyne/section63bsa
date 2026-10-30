// The Legal Hashed mark: a navy tile with "#63" (a hash of Section 63) over a green digest bar, the hex blocks of a hash
// value. Shared by the logo in the app (components/brand/logo.tsx) and the icon generator (scripts/build-icons.mjs).
// The characters are outlines from Plus Jakarta Sans ExtraBold (SIL OFL 1.1), so they look the same where no font loads.

export const BRAND_NAVY = '#0d1b3e';
export const BRAND_GREEN = '#12a873';

/** Glyph outlines in font units (1000 per em, y up). */
const GLYPHS = {
  hash: 'M146 0 190 153H70V283H227L279 463H159V593H316L360 745H510L466 593H616L659 745H809L766 593H886V463H728L677 283H797V153H639L596 0H446L489 153H340L296 0ZM377 283H527L578 463H429Z',
  six: 'M302 -12Q225 -12 165.0 20.5Q105 53 71.0 109.0Q37 165 37 235Q37 270 44.0 305.0Q51 340 72.0 382.0Q93 424 135 478L342 745H527L276 424L251 459Q265 466 278.0 470.0Q291 474 303.5 476.0Q316 478 330 478Q399 478 452.5 447.0Q506 416 536.5 362.5Q567 309 567 242Q567 169 533.0 111.5Q499 54 439.5 21.0Q380 -12 302 -12ZM302 128Q333 128 357.5 142.0Q382 156 397.0 181.5Q412 207 412 240Q412 274 397.0 298.5Q382 323 357.5 337.0Q333 351 302 351Q272 351 247.0 337.0Q222 323 207.0 298.5Q192 274 192 240Q192 207 207.0 181.5Q222 156 247.0 142.0Q272 128 302 128Z',
  three: 'M292 -12Q230 -12 174.0 11.5Q118 35 79.0 78.0Q40 121 27 179L164 225Q181 177 214.0 152.5Q247 128 292 128Q329 128 355.5 142.0Q382 156 397.0 181.5Q412 207 412 241Q412 275 397.5 299.5Q383 324 356.5 337.5Q330 351 292 351Q270 351 248.0 346.0Q226 341 208 332L172 407L363 615H72V745H537V625L341 402L346 465Q413 465 462.5 437.5Q512 410 539.5 361.0Q567 312 567 247Q567 173 531.0 114.0Q495 55 433.0 21.5Q371 -12 292 -12Z',
};

/** Where each glyph sits in the 40 × 40 mark: left edge, baseline and scale. */
const SCALE = 0.0122;
const BASELINE = 23.05;
export const MARK_GLYPHS = [
  { d: GLYPHS.hash, x: 7.12, fill: BRAND_GREEN },
  { d: GLYPHS.six, x: 18.41, fill: '#ffffff' },
  { d: GLYPHS.three, x: 25.42, fill: '#ffffff' },
].map((g) => ({ ...g, transform: `translate(${g.x} ${BASELINE}) scale(${SCALE} ${-SCALE})` }));

/** The digest bar: [x, width] of each block. */
export const MARK_DIGEST: [number, number][] = [
  [7, 5],
  [13.5, 2.5],
  [17.5, 6],
  [25, 2.5],
  [29, 4],
];
export const DIGEST_Y = 28.6;
export const DIGEST_HEIGHT = 2;

/**
 * The mark as SVG markup. `tile: 'rounded'` is the app icon; `'square'` fills the whole canvas (for maskable and
 * Apple touch icons, which the system rounds itself), with the content shrunk by `scale` to stay in the safe area.
 */
export function markSvg({ tile = 'rounded', scale = 1 }: { tile?: 'rounded' | 'square'; scale?: number } = {}): string {
  const bg =
    tile === 'rounded'
      ? `<rect x="1" y="1" width="38" height="38" rx="11" fill="${BRAND_NAVY}"/>`
      : `<rect width="40" height="40" fill="${BRAND_NAVY}"/>`;
  const offset = (40 - 40 * scale) / 2;
  const glyphs = MARK_GLYPHS.map((g) => `<path transform="${g.transform}" d="${g.d}" fill="${g.fill}"/>`).join('');
  const digest = MARK_DIGEST.map(
    ([x, w]) => `<rect x="${x}" y="${DIGEST_Y}" width="${w}" height="${DIGEST_HEIGHT}" rx="1" fill="${BRAND_GREEN}"/>`,
  ).join('');
  return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 40 40">${bg}<g transform="translate(${offset} ${offset}) scale(${scale})">${glyphs}${digest}</g></svg>`;
}
