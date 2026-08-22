/**
 * The prop registry.
 *
 * One place that knows every prop's id, slot, footprint, passes, z and checks
 * — WITHOUT running a draw function. That last part is the requirement: the
 * catalogue page, the conflict rules, the export manifest and the test suite
 * all need to read this, and none of them should have to render a character to
 * find out that a crown and a cap both want the top of the skull.
 *
 * `defineProp` validates on the way in. A registry that can hold a broken entry
 * is a registry that will, at seventy-five items, hold several.
 */

import { compileProp } from './compile.js';
import { ROLES } from './materials.js';
import { walkShape } from './shapes.js';

/** Physical footprint tokens. Two props conflict iff they share one. */
export const OCCUPANCY = [
  'skull.top', 'skull.band', 'skull.left', 'skull.right', 'skull.back',
  'face.eyes', 'face.mouth', 'ear.left', 'ear.right',
  'neck.ring', 'chest.front', 'back',
  'hand.left', 'hand.right',
];

/** The passes, in draw order. A prop declares which of them it draws in. */
export const PASSES = [
  'rearExternal',   // capes, backpacks, anything behind the whole character
  'headRear',       // the far side of things on the skull
  'bodyFront',      // collars, badges, aprons — over the body, under the face
  'headFront',      // the near side of things on the skull
  'faceFront',      // glasses and goggles — over the features
  'heldRear',       // a held thing, behind the near hand
  'heldFront',      // the part of it the hand does not cover
];

/**
 * Visibility policies.
 *
 * Today's suite requires every accessory to be visible at every angle, which
 * is right for a crown and wrong for a hair clip — forcing a clip to show
 * through the skull makes it float. Four honest answers:
 */
export const VISIBILITY = [
  'circumferential', // bands, hats: something of it shows at every angle
  'localized',       // clips, flowers: allowed to go fully behind the head
  'face',            // glasses: present exactly when the face is
  'paired',          // ears: at least the near one shows
];

export const PROPS = new Map();

const fail = (id, msg) => { throw new Error(`prop "${id}": ${msg}`); };

/**
 * Register one prop.
 *
 * Returns the compiled entry so a caller can draw it directly, but the point
 * of the call is the registration.
 */
export function defineProp(def) {
  const id = def.id;
  if (!id) throw new Error('a prop needs an id');
  if (PROPS.has(id)) fail(id, 'already defined');
  if (!def.slot) fail(id, 'needs a slot');

  const occupies = def.occupies || [];
  if (!occupies.length) fail(id, 'needs an occupancy footprint');
  for (const t of occupies) if (!OCCUPANCY.includes(t)) fail(id, `unknown occupancy token "${t}"`);

  const passes = def.passes || [];
  if (!passes.length) fail(id, 'needs at least one pass');
  for (const p of passes) if (!PASSES.includes(p)) fail(id, `unknown pass "${p}"`);

  const vis = def.checks?.visibility;
  if (vis && !VISIBILITY.includes(vis)) fail(id, `unknown visibility policy "${vis}"`);

  /* Every fill must be a material role. A raw hex inside a prop is how a
     catalogue ends up with one item that cannot be recoloured and one item
     that is accidentally the same green as a correct answer. */
  for (const part of def.parts || []) {
    if (!part.frame?.resolve) fail(id, 'every part needs a frame');
    const art = typeof part.art === 'function' ? null : part.art;
    walkShape(art, n => {
      for (const key of ['fill', 'stroke']) {
        const v = n[key];
        if (v == null || n.type === 'group') continue;
        if (!ROLES.includes(v)) fail(id, `${key} "${v}" is not a material role`);
      }
    });
    for (const [role, to] of Object.entries(part.material || {})) {
      const ok = typeof to === 'object'
        ? ROLES.includes(to.from || 'accent')
        : ROLES.includes(to);
      if (!ROLES.includes(role) || !ok) fail(id, `bad material mapping for ${role}`);
    }
  }

  const entry = {
    id,
    kind: def.kind || 'wearable',
    slot: def.slot,
    occupies,
    passes,
    z: def.z ?? 50,
    checks: { visibility: 'localized', minReadableSize: 48, contrastAgainst: 'body', ...def.checks },
    ...compileProp(def),
  };
  PROPS.set(id, entry);
  return entry;
}

export const getProp = id => PROPS.get(id);
export const propIds = () => [...PROPS.keys()];

/** What a prop conflicts with, from the footprints alone. */
export function propConflicts(id) {
  const mine = PROPS.get(id);
  if (!mine) return [];
  return propIds().filter(other => other !== id &&
    PROPS.get(other).occupies.some(t => mine.occupies.includes(t)));
}

/**
 * Whether a loadout is wearable at once.
 *
 * At most three worn plus one held, one item per hand. A conflicting loadout
 * is first-listed-wins at runtime — a page must not crash — and a hard error
 * in export and in tests, because a release asset must never be silently
 * generated with a crown inside a cap.
 */
export function checkLoadout(ids) {
  const problems = [];
  const taken = new Map();
  const worn = [];
  for (const id of ids) {
    const p = PROPS.get(id);
    if (!p) { problems.push(`unknown prop "${id}"`); continue; }
    if (p.kind === 'wearable') worn.push(id);
    for (const t of p.occupies) {
      if (taken.has(t)) problems.push(`${id} and ${taken.get(t)} both need ${t}`);
      else taken.set(t, id);
    }
  }
  if (worn.length > 3) problems.push(`${worn.length} worn items; the limit is three`);
  return problems;
}
