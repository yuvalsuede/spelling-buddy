#!/usr/bin/env node
/**
 * spelling-buddy asset CLI.
 *
 *   npx spelling-buddy svg     [--out dir] [--theme ink]
 *   npx spelling-buddy sheet   [--out file.svg] [--theme ink]
 *   npx spelling-buddy png     [--out dir] [--size 512] [--theme ink]
 *   npx spelling-buddy frames  --action correct [--fps 30] [--out dir]
 *   npx spelling-buddy sprite  --action correct [--cols 8] [--cell 160]
 *   npx spelling-buddy gif     --action correct [--fps 30] [--out file.gif]
 *   npx spelling-buddy all     [--out dir]
 *
 * `svg` and `sheet` need no dependencies at all.
 */
import { mkdir, writeFile, rm } from 'node:fs/promises';
import { join } from 'node:path';
import { Buddy } from '../core/buddy.js';
import { THEMES } from '../core/theme.js';
import { poseSVG, turnaroundSVGs, expressionSVGs, sheetSVG, alphabetSVG } from './svg.js';
import { actionFrames, svgToPng, spriteSheet, encodeVideo } from './raster.js';

/* --------------------------------------------------------------- arg parse */
const argv = process.argv.slice(2);
const cmd = argv[0];
const flag = (name, dflt) => {
  const i = argv.indexOf('--' + name);
  return i === -1 ? dflt : (argv[i + 1] ?? true);
};
const num = (name, dflt) => Number(flag(name, dflt));

let theme = flag('theme', 'ink');
const size  = num('size', 512);
const fps   = num('fps', 30);
const action = flag('action', 'correct');

const log = (...a) => console.log('·', ...a);

/** Set (or replace) a flag value in argv so sub-commands read it. */
function argvSet(name, value) {
  const i = argv.indexOf('--' + name);
  if (i === -1) argv.push('--' + name, value);
  else argv[i + 1] = value;
}

async function out(dir) { await mkdir(dir, { recursive: true }); return dir; }

/* ------------------------------------------------------------- sub commands */
const commands = {
  async svg() {
    const dir = await out(flag('out', 'assets/svg'));
    let n = 0;
    for (const { name, svg } of turnaroundSVGs({ theme, steps: num('steps', 8) })) {
      await writeFile(join(dir, name + '.svg'), svg); n++;
    }
    for (const { name, svg } of expressionSVGs({ theme })) {
      await writeFile(join(dir, name + '.svg'), svg); n++;
    }
    log(`${n} SVG files → ${dir}`);
  },

  async sheet() {
    const file = flag('out', 'assets/character-sheet.svg');
    await out(join(file, '..'));
    const poses = [
      ...Buddy.expressions.map(e => ({ expression: e, label: e })),
      ...[0, 45, 90, 135, 180, 225, 270, 315].map(y => ({ yaw: y, label: `${y}°` })),
      { expression: 'thinking', yaw: -32, hands: 'r', handLift: -0.22, handOut: -0.5, label: 'think' },
      { expression: 'proud', letter: 'A', hands: 'r', handLift: 0.8, label: 'hold A' },
      { expression: 'happy', yaw: 20, pitch: -12, label: 'look up' },
      { expression: 'excited', hands: true, handLift: 1.1, label: 'wave' },
      { expression: 'sleepy', pitch: 13, roll: -8, label: 'sleep' },
    ];
    await writeFile(file, sheetSVG(poses, { theme, cols: 4, cell: 200 }));
    log(`character sheet (${poses.length} poses) → ${file}`);
  },

  /* The specimen sheet. Every metric mistake is obvious here and invisible in
     a unit test, so this is the artifact to look at after touching a glyph. */
  async alphabet() {
    const file = flag('out', 'assets/alphabet.svg');
    await out(join(file, '..'));
    await writeFile(file, alphabetSVG());
    log(`alphabet specimen → ${file}`);
  },

  async png() {
    const dir = await out(flag('out', 'assets/png'));
    let n = 0;
    for (const name of Buddy.expressions) {
      const svg = poseSVG({ expression: name }, { theme });
      await writeFile(join(dir, `expr-${name}.png`), await svgToPng(svg, { width: size, height: size }));
      n++;
    }
    for (let i = 0; i < 8; i++) {
      const yaw = i * 45;
      const svg = poseSVG({ yaw }, { theme });
      await writeFile(join(dir, `turn-${yaw}.png`), await svgToPng(svg, { width: size, height: size }));
      n++;
    }
    log(`${n} PNGs at ${size}px → ${dir}`);
  },

  async frames() {
    const dir = await out(flag('out', `assets/frames/${action}`));
    const fr = actionFrames(action, { fps, theme, size: 320 });
    for (let i = 0; i < fr.length; i++) {
      await writeFile(join(dir, String(i).padStart(4, '0') + '.png'),
                      await svgToPng(fr[i].svg, { width: size, height: size }));
    }
    log(`${fr.length} frames of "${action}" @${fps}fps → ${dir}`);
    return { dir, count: fr.length };
  },

  async sprite() {
    const file = flag('out', `assets/sprite-${action}.png`);
    await out(join(file, '..'));
    const cell = num('cell', 160), cols = num('cols', 8);
    const fr = actionFrames(action, { fps: num('fps', 15), theme, size: 320 });
    const pngs = [];
    for (const f of fr) pngs.push(await svgToPng(f.svg, { width: cell * 2, height: cell * 2 }));
    await writeFile(file, await spriteSheet(pngs, { cell, cols }));
    log(`sprite sheet ${fr.length} frames, ${cols} cols × ${cell}px → ${file}`);
  },

  async gif() {
    const file = flag('out', `assets/${action}.gif`);
    await out(join(file, '..'));
    const tmp = await out('.buddy-tmp');
    const fr = actionFrames(action, { fps, theme, size: 320, background: '#FFFFFF' });
    for (let i = 0; i < fr.length; i++) {
      await writeFile(join(tmp, String(i).padStart(4, '0') + '.png'),
                      await svgToPng(fr[i].svg, { width: 320, height: 320 }));
    }
    await encodeVideo(tmp, file, { fps, width: num('width', 320) });
    await rm(tmp, { recursive: true, force: true });
    log(`GIF (${fr.length} frames) → ${file}`);
  },

  async all() {
    const root = flag('out', 'assets');
    const only = argv.includes('--theme') ? [theme] : Object.keys(THEMES);
    for (const t of only) {
      theme = t;                                   // read by svg()/sheet() below
      argvSet('out', `${root}/${t}/svg`);   await commands.svg();
      argvSet('out', `${root}/${t}/character-sheet.svg`); await commands.sheet();
    }
    argvSet('out', `${root}/alphabet.svg`); await commands.alphabet();
    log(`${only.length} theme(s) → ${root}/`);
    log('run `png`, `sprite` or `gif` for raster output');
  },

  help() {
    console.log(`
spelling-buddy asset CLI

  svg      per-pose SVG files (no dependencies)
  sheet    one SVG character sheet
  alphabet A–Z a–z 0–9 specimen on ruled paper
  png      rasterised stills                     [needs sharp]
  frames   PNG sequence for one action           [needs sharp]
  sprite   sprite-sheet PNG for one action       [needs sharp]
  gif      animated GIF for one action           [needs sharp + ffmpeg]
  all      svg + sheet + alphabet

Flags: --out --theme (${Object.keys(THEMES).join('|')}) --size --fps --action --cols --cell --steps
Actions: ${Buddy.actions.join(', ')}
Expressions: ${Buddy.expressions.join(', ')}
`);
  },
};

const fn = commands[cmd] || commands.help;
try { await fn(); }
catch (e) { console.error('✕', e.message); process.exit(1); }
