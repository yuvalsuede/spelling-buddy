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
export { G, DESIGN, project, faceProject, SHAPES, applyShape, FRINGES, FRINGE_NAMES,
         EARS, EAR_NAMES, BUILD_NAMES, createGeometry } from './core/geometry.js';
export { CAST, CAST_NAMES, AXES, resolveCharacter, distance, tooClose } from './core/cast.js';
export { isGradient, paintKey, vertical, sheen, mix, lighten, darken, formLight } from './core/paint.js';
export { GLYPHS, GLYPH_CHARS, METRICS, glyph, drawGlyph, drawWord, glyphBounds, glyphWidth } from './core/glyphs.js';
export { PHASES, PHASE_NAMES, applyPhase } from './core/phases.js';
export { ACCESSORIES, ACCESSORY_NAMES, ACCESSORY_META, PASSES, conflictsWith,
         drawAccessories } from './core/accessories.js';

/* The prop system. `wear()` needs none of this — it is here for reading the
   catalogue (what exists, what it covers, what it clashes with) and for
   authoring new items against the same framework the built-in seventy-five
   use. The drawing primitives live under `src/props/` and are imported from
   there directly; only the registry surface is re-exported. */
export { defineProp, getProp, propIds, propConflicts, checkLoadout,
         OCCUPANCY, VISIBILITY } from './props/registry.js';
export { ROLES, palette } from './props/materials.js';
export { flattenGlyph, glyphPath, penAt, drawTrace, scoreTrace, identifyTrace } from './core/trace.js';
export { render } from './core/renderer.js';
export * from './core/math.js';

// SVG export is dependency-free, so it ships in the main bundle too.
export { toSVG, poseSVG, turnaroundSVGs, expressionSVGs, sheetSVG, alphabetSVG,
         idPrefixFor } from './export/svg.js';
