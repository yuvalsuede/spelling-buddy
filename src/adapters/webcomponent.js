/**
 * Web Component adapter — <spelling-buddy>.
 *
 * For hosts with no build step, or non-React frameworks. Attributes mirror the
 * API; methods are exposed on the element itself.
 *
 *   <spelling-buddy theme="ink" size="240" expression="happy"></spelling-buddy>
 *   document.querySelector('spelling-buddy').react('correct');
 */
import { mount } from './mount.js';

/* The class is built lazily inside a factory rather than declared at module
   scope: `extends HTMLElement` evaluates at import time, which would throw the
   moment this module is pulled into Node (SSR, tests, the asset CLI). */
let _Element = null;

export function getSpellingBuddyElement() {
  if (_Element) return _Element;
  if (typeof HTMLElement === 'undefined')
    throw new Error('<spelling-buddy> requires a DOM. Import it only in the browser.');

  _Element = class SpellingBuddyElement extends HTMLElement {
  static observedAttributes = ['theme', 'size', 'expression', 'action', 'word', 'interactive', 'idle'];

    connectedCallback() {
      if (this._handle) return;
      const shadow = this.attachShadow({ mode: 'open' });
      const size = Number(this.getAttribute('size')) || 240;
      shadow.innerHTML = `<style>
        :host{display:inline-block;line-height:0}
        canvas{display:block;touch-action:none}
      </style><canvas></canvas>`;
      const canvas = shadow.querySelector('canvas');
      canvas.style.width = size + 'px';
      canvas.style.height = size + 'px';

      this._handle = mount(canvas, {
        theme: this.getAttribute('theme') || 'ink',
        size,
        interactive: this.getAttribute('interactive') !== 'false',
        idleActions: this.hasAttribute('idle'),
        expression: this.getAttribute('expression') || 'happy',
      });

      const b = this._handle.buddy;
      b.on('action:end', n => this.dispatchEvent(new CustomEvent('actionend', { detail: n })));
      b.on('spell:done', () => this.dispatchEvent(new CustomEvent('spelldone')));
      b.on('cue', c => this.dispatchEvent(new CustomEvent('cue', { detail: c })));
      b.on('trace:done', () => this.dispatchEvent(new CustomEvent('tracedone')));

      const a = this.getAttribute('action'); if (a) b.react(a);
      const w = this.getAttribute('word');   if (w) b.spell(w);
    }

    disconnectedCallback() { this._handle?.dispose(); this._handle = null; }

    attributeChangedCallback(name, _old, val) {
      const b = this._handle?.buddy;
      if (!b || val == null) return;
      if (name === 'theme')      b.setTheme(val);
      if (name === 'expression') b.express(val);
      if (name === 'action')     b.react(val);
      if (name === 'word')       b.spell(val);
      if (name === 'size') {
        const n = Number(val) || 240;
        const c = this.shadowRoot.querySelector('canvas');
        c.style.width = n + 'px'; c.style.height = n + 'px';
        this._handle.setSize(n);
      }
    }

    get buddy() { return this._handle?.buddy ?? null; }
    express(n)  { this.buddy?.express(n); return this; }
    react(n)    { this.buddy?.react(n); return this; }
    spell(w, o) { this.buddy?.spell(w, o); return this; }
    hold(c)     { this.buddy?.hold(c); return this; }
    face(y, p)  { this.buddy?.face(y, p); return this; }
    say(t, o)   { this.buddy?.say(t, o); return this; }
    sayLetters(w, o) { this.buddy?.sayLetters(w, o); return this; }
    viseme(v)   { this.buddy?.viseme(v); return this; }
    trace(c, o) { this.buddy?.trace(c, o); return this; }
  };

  return _Element;
}

/** Register <spelling-buddy>. Safe to call more than once. No-op outside a DOM. */
export function defineSpellingBuddy(tag = 'spelling-buddy') {
  if (typeof customElements === 'undefined') return null;
  if (!customElements.get(tag)) customElements.define(tag, getSpellingBuddyElement());
  return tag;
}
