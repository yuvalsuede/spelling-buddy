#!/usr/bin/env node
/**
 * The turnaround sweep — look at everything, not at the two angles I happened
 * to check.
 *
 * Structural tests keep passing while the picture is wrong, because "does not
 * throw" and "reads as a hat" are different claims. This renders the whole
 * matrix — every accessory, every combination, all the way round, top and
 * bottom — into contact sheets meant to be LOOKED AT before anything is
 * called finished.
 *
 *   node scripts/sweep.mjs                 all sheets → tests/sweep/
 *   node scripts/sweep.mjs turn cap        just one sheet, just one accessory
 */
import { writeFile, mkdir } from 'node:fs/promises';
import { Buddy, ACCESSORY_NAMES, THEMES, toSVG } from '../src/index.js';

const OUT = 'tests/sweep';
const sharp = (await import('sharp')).default;

const CELL = 190;
const DPR  = 96 / 72;   // sharp's default density is 72; cells render at 96
const argv = process.argv.slice(2);
const want = name => !argv.length || argv.includes(name);

/** One character, posed, as an SVG string. */
function pose({ yaw = 0, pitch = 0, theme = 'ink', wear = [], expression = 'happy' }) {
  const b = new Buddy({ theme, seed: 1, expression, autoLook: false, showTrail: false });
  b.wear(wear);
  b.face(yaw, pitch);
  b.s.expr = b.s.prevExpr = expression;
  b.settle();
  return toSVG(b, { width: CELL, height: CELL, padding: 0.06, background: '#FFFFFF' });
}

/**
 * A labelled grid, as one PNG.
 *
 * Every cell is rasterised on its own and then composited. Nesting the SVGs
 * into one document instead — which is what this did first — silently breaks
 * the sheet: each pose numbers its clip paths from `bc1`, so in a shared
 * document every cell resolves to the FIRST cell's clip and half the
 * accessories vanish. A contact sheet that invents its own bugs is worse than
 * no contact sheet, because it sends you to fix code that was already right.
 */
async function sheet(file, cells, cols, title) {
  const LAB = 20, HEAD = 34, GAP = 1;
  const rows = Math.ceil(cells.length / cols);
  const W = cols * (CELL + GAP) + GAP;
  const H = HEAD + rows * (CELL + LAB + GAP) + GAP;
  const esc = s => String(s).replace(/&/g, '&amp;').replace(/</g, '&lt;');

  const chrome = [`<rect width="${W}" height="${H}" fill="#FFFFFF"/>`,
    `<text x="${GAP + 6}" y="22" font-family="system-ui,sans-serif" font-size="14"` +
    ` font-weight="700" fill="#16161A">${esc(title)}</text>`];

  const layers = [];
  for (const [i, c] of cells.entries()) {
    const x = GAP + (i % cols) * (CELL + GAP);
    const y = HEAD + Math.floor(i / cols) * (CELL + LAB + GAP);
    chrome.push(`<rect x="${x}" y="${y}" width="${CELL}" height="${CELL + LAB}" fill="none" stroke="#E6E6EB"/>`);
    chrome.push(`<text x="${x + CELL / 2}" y="${y + CELL + 14}" text-anchor="middle"` +
      ` font-family="system-ui,sans-serif" font-size="11" fill="#6B6B78">${esc(c.label)}</text>`);
    layers.push({
      input: await sharp(Buffer.from(pose(c)), { density: 96 }).png().toBuffer(),
      left: Math.round(x * DPR), top: Math.round(y * DPR),
    });
  }

  const base = await sharp(Buffer.from(
    `<svg xmlns="http://www.w3.org/2000/svg" width="${W}" height="${H}" viewBox="0 0 ${W} ${H}">${chrome.join('')}</svg>`
  ), { density: 72 * DPR }).png().toBuffer();

  await mkdir(OUT, { recursive: true });
  await sharp(base).composite(layers).toFile(`${OUT}/${file}.png`);
  console.log(`${OUT}/${file}.png   ${Math.round(W * DPR)}\u00d7${Math.round(H * DPR)}  (${cells.length} cells)`);
}

/* ---------------------------------------------------------------- sheets */

const YAWS = [0, 30, 60, 90, 120, 150, 180, 210, 240, 270, 300, 330];
const PICK = argv.filter(a => ACCESSORY_NAMES.includes(a));
const LIST = PICK.length ? PICK : ACCESSORY_NAMES;

/* 1. THE TURN. One accessory per row, all the way round. This is the sheet
      that catches a hat that stops being worn when the head turns away. */
if (want('turn')) {
  const cells = [];
  for (const a of ['none', ...LIST])
    for (const yaw of YAWS)
      cells.push({ yaw, wear: a === 'none' ? [] : [a], label: `${a} · ${yaw}°` });
  await sheet('1-turn', cells, YAWS.length, 'Every accessory, all the way round — 0° is face-on, 180° is the back of the head');
}

/* 2. PITCH. Looking up and down, at three yaws, because a band that behaves
      head-on can still slide off the crown when the head tips. */
if (want('pitch')) {
  const cells = [];
  for (const a of LIST)
    for (const pitch of [-28, -14, 0, 14, 28])
      for (const yaw of [0, 55, 180])
        cells.push({ yaw, pitch, wear: [a], label: `${a} · ${yaw}°/${pitch}°` });
  await sheet('2-pitch', cells, 15, 'Pitch — nodding up and down at three yaws');
}

/* 3. TOGETHER. Two worn things must not occupy the same millimetre of skull. */
if (want('combo')) {
  const COMBOS = [['cap', 'headphones'], ['crown', 'glasses'], ['bow', 'glasses'],
                  ['headphones', 'glasses'], ['flower', 'headphones'], ['cap', 'glasses']];
  const cells = [];
  for (const c of COMBOS)
    for (const yaw of [0, 45, 90, 135, 180, 225, 270, 315])
      cells.push({ yaw, wear: c, label: `${c.join('+')} · ${yaw}°` });
  await sheet('3-combo', cells, 8, 'Worn together');
}

/* 4. SKINS. An accent that reads on ink can vanish on amber. */
if (want('skin')) {
  const names = Object.keys(THEMES);
  const cells = [];
  for (const a of LIST)
    for (const theme of names)
      cells.push({ theme, wear: [a], yaw: 25, label: `${a} · ${theme}` });
  await sheet('4-skin', cells, names.length, 'Every accessory on every skin, at three-quarter view');
}

/* 5. NEAR PROFILE. The half-degree neighbourhood where things pop rather than
      pass behind — sampled finely because that is where the failures live. */
if (want('edge')) {
  const cells = [];
  for (const a of LIST)
    for (const yaw of [70, 80, 85, 90, 95, 100, 110, 250, 260, 270, 280, 290])
      cells.push({ yaw, wear: [a], label: `${a} · ${yaw}°` });
  await sheet('5-edge', cells, 12, 'Near profile — where things pop instead of passing behind');
}
