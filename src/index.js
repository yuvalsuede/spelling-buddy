/**
 * spelling-buddy — public entry point (browser + node safe).
 *
 * Node-only exporters live behind `spelling-buddy/export` so nothing in this
 * module reaches for `sharp`, `fs`, or `child_process`.
 */
export { Buddy } from './core/buddy.js';
export { mount } from './adapters/mount.js';
export { getSpellingBuddyElement, defineSpellingBuddy } from './adapters/webcomponent.js';

export { CanvasSurface } from './core/surface-canvas.js';
export { SVGSurface } from './core/surface-svg.js';

export { THEMES, TOKENS, resolveTheme, shadeFor, DEFAULT_THEME } from './core/theme.js';
export { EXPRESSIONS, EXPRESSION_NAMES } from './core/expressions.js';
export { ACTIONS, ACTION_NAMES } from './core/actions.js';
export { VISEMES, VISEME_NAMES, LETTER_VISEMES, blendViseme, drawViseme,
         wordToVisemes, lettersToVisemes } from './core/visemes.js';
export { G, DESIGN, project, faceProject } from './core/geometry.js';
export { isGradient, paintKey, vertical, sheen, mix, lighten, darken } from './core/paint.js';
export { GLYPHS, GLYPH_CHARS, METRICS, glyph, drawGlyph, drawWord, glyphBounds, glyphWidth } from './core/glyphs.js';
export { PHASES, PHASE_NAMES, applyPhase } from './core/phases.js';
export { flattenGlyph, glyphPath, penAt, drawTrace, scoreTrace, identifyTrace } from './core/trace.js';
export { render } from './core/renderer.js';
export * from './core/math.js';

// SVG export is dependency-free, so it ships in the main bundle too.
export { toSVG, poseSVG, turnaroundSVGs, expressionSVGs, sheetSVG, alphabetSVG } from './export/svg.js';
