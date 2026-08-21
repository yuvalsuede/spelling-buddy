/**
 * Raster export — PNG stills, animation frames, sprite sheets, GIF/WebM.
 *
 * Node only. `sharp` (SVG rasterisation) and `ffmpeg` (video/GIF muxing) are
 * OPTIONAL: the SVG exporter above has zero dependencies, and everything here
 * degrades with a clear message rather than a stack trace if a tool is absent.
 *
 * Frames are produced by stepping the rig at a fixed timestep with a seeded
 * PRNG, so `export` twice gives byte-identical output — which is what makes
 * these safe to commit or diff in CI.
 */
import { Buddy } from '../core/buddy.js';
import { ACTIONS } from '../core/actions.js';
import { toSVG } from './svg.js';
import { DESIGN } from '../core/geometry.js';

let _sharp = null;
async function sharp() {
  if (_sharp) return _sharp;
  try { _sharp = (await import('sharp')).default; }
  catch { throw new Error('PNG export needs `sharp`. Install it (npm i sharp) or use the dependency-free SVG exporter.'); }
  return _sharp;
}

/** Rasterise one SVG string to a PNG buffer. */
export async function svgToPng(svg, { width = DESIGN, height = DESIGN, density = 2 } = {}) {
  const S = await sharp();
  return S(Buffer.from(svg), { density: 72 * density })
    .resize(width, height, { fit: 'contain', background: { r: 0, g: 0, b: 0, alpha: 0 } })
    .png()
    .toBuffer();
}

/**
 * Step an action and capture every frame as SVG.
 *
 * @returns {{svg:string, t:number}[]}
 */
export function actionFrames(action, {
  fps = 30, duration = null, theme = 'ink', seed = 1, expression = 'happy',
  size = DESIGN, background = null, settleFirst = 0.4, tailFrames = 6,
} = {}) {
  const b = new Buddy({ theme, seed, expression, autoLook: false, showTrail: true });
  b.face(0, 0);
  b.step(settleFirst, fps);                       // let the idle cycle start naturally

  const dur = duration ?? (ACTIONS[action]?.dur ?? 1.5);

  b.react(action);
  const frames = [];
  const dt = 1 / fps;
  const total = Math.ceil((dur + tailFrames * dt) * fps);
  for (let i = 0; i < total; i++) {
    frames.push({ t: i * dt, svg: toSVG(b, { width: size, height: size, background }) });
    b.update(dt);
  }
  return frames;
}

/** Compose an array of PNG buffers into one sprite-sheet PNG. */
export async function spriteSheet(pngBuffers, { cell = 160, cols = 8, background = null } = {}) {
  const S = await sharp();
  const rows = Math.ceil(pngBuffers.length / cols);
  const resized = await Promise.all(
    pngBuffers.map(b => S(b).resize(cell, cell, { fit: 'contain', background: { r: 0, g: 0, b: 0, alpha: 0 } }).png().toBuffer())
  );
  const composite = resized.map((input, i) => ({
    input, left: (i % cols) * cell, top: Math.floor(i / cols) * cell,
  }));
  return S({
    create: {
      width: cols * cell, height: rows * cell, channels: 4,
      background: background ?? { r: 0, g: 0, b: 0, alpha: 0 },
    },
  }).composite(composite).png().toBuffer();
}

/** Encode a PNG frame directory to GIF or WebM via ffmpeg. */
export async function encodeVideo(frameDir, outFile, { fps = 30, width = 320 } = {}) {
  const { execFile } = await import('node:child_process');
  const { promisify } = await import('node:util');
  const run = promisify(execFile);
  const isGif = outFile.endsWith('.gif');
  const args = isGif
    ? ['-y', '-framerate', String(fps), '-i', `${frameDir}/%04d.png`,
       '-vf', `scale=${width}:-1:flags=lanczos,split[a][b];[a]palettegen=stats_mode=diff[p];[b][p]paletteuse=dither=bayer`,
       '-loop', '0', outFile]
    : ['-y', '-framerate', String(fps), '-i', `${frameDir}/%04d.png`,
       '-c:v', 'libvpx-vp9', '-pix_fmt', 'yuva420p', '-b:v', '0', '-crf', '32', outFile];
  try { await run('ffmpeg', args); }
  catch (e) { throw new Error(`ffmpeg failed (is it installed?): ${e.message}`); }
  return outFile;
}
