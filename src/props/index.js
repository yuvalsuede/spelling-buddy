/**
 * The prop system.
 *
 * Importing this file registers the catalogue as a side effect — which is the
 * point: a prop that exists is a prop the manifest, the conflict rules and the
 * test suite can see, and there is exactly one list of them.
 */

import './catalogue/head-side.js';
import './catalogue/clips.js';
import './catalogue/headwear.js';
import './catalogue/hats.js';
import './catalogue/ears.js';
import './catalogue/neck.js';
import './catalogue/face.js';
import './catalogue/held.js';

export {
  defineProp, getProp, propIds, propConflicts, checkLoadout,
  PROPS, PASSES, OCCUPANCY, VISIBILITY,
} from './registry.js';
export { palette, ROLES, isReserved } from './materials.js';
export * from './shapes.js';
export * from './frames.js';
export { compileProp, WORN } from './compile.js';
