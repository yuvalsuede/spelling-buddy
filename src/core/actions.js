/**
 * Special animations.
 *
 * Each action is a short declarative timeline over normalised progress `p`
 * (0→1). Actions never set positions directly — they inject impulses into the
 * springs and move spring *targets*. That's what keeps hand-authored beats and
 * physical settling from fighting each other.
 *
 * `B.once(at, fn, p)` fires a beat exactly once as p crosses `at`.
 */

export const ACTIONS = {

  /* ------------------------------------------------------ answer feedback */
  correct: {
    dur: 1.5,
    tags: ['feedback'],
    start(B) {
      const S = B.s, T = B.theme;
      B.cue('correct');
      B.express('proud');
      S.offVY = -70; S.squashVY = 3.4; S.squashVX = -2.6; S.sparkPop = 1;
      S.hand.l.lift = 1;  S.hand.r.lift = 1;
      S.hand.l.out  = 0.6; S.hand.r.out  = 0.6;
      S.hand.l.want = 1;  S.hand.r.want = 1;
      B.emit('confetti', 30, { y: -92, angle: -Math.PI / 2, spread: 1.15, drag: 0.975,
                                 spdMin: 210, spdMax: 470, grav: 700 });
      B.emit('star', 10, { y: -100, angle: -Math.PI / 2, spread: 0.9, drag: 0.97,
                           spdMin: 180, spdMax: 360, grav: 520, color: T.correct });
    },
    tick(B, p) {
      const S = B.s;
      S.hover = Math.max(0, Math.sin(Math.min(p / 0.55, 1) * Math.PI) * 46);
      S.yawTarget = Math.sin(p * Math.PI * 2) * 0.35;
      B.once(0.5, () => {
        S.sparkPop = 0.9;
        B.emit('sparkle', 10, { y: -70, spdMin: 60, spdMax: 170, grav: 280, color: B.theme.correct });
      }, p);
      S.hand.l.lift = 1;  S.hand.r.lift = 1;
      S.hand.l.out  = 0.6; S.hand.r.out  = 0.6;
      S.hand.l.want = 1;  S.hand.r.want = 1;
      S.hand.l.swing =  Math.sin(S.t * 14) * 0.4;
      S.hand.r.swing = -Math.sin(S.t * 14) * 0.4;
    },
    end(B) { B.express('happy'); B.s.yawTarget = 0; },
  },

  wrong: {
    dur: 1.1,
    tags: ['feedback'],
    start(B) {
      const S = B.s;
      B.cue('wrong');
      B.express('confused');
      S.offVX = 300; S.pitchTarget = 0.16;
      B.emit('drop', 3, { x: 34, y: -46, spdMin: 20, spdMax: 70, grav: 380,
                          color: B.theme.wrong, sizeMin: 5, sizeMax: 8 });
    },
    tick(B, p) {
      const S = B.s;
      S.yawTarget = Math.sin(p * Math.PI * 6) * 0.5;
      B.once(0.14, () => S.offVX = -520, p);
      B.once(0.34, () => S.offVX =  430, p);
      B.once(0.54, () => S.offVX = -250, p);
    },
    end(B) { B.express('thinking'); B.s.yawTarget = 0; B.s.pitchTarget = 0; },
  },

  nod: {
    dur: 0.9,
    tags: ['feedback'],
    start(B) { B.express('happy'); },
    tick(B, p) {
      const S = B.s;
      S.pitchTarget = Math.sin(p * Math.PI * 3) * 0.30;
      B.once(0.02, () => { S.offVY = 130; S.squashVY = -1.5; }, p);
      B.once(0.38, () => { S.offVY = 110; }, p);
    },
    end(B) { B.s.pitchTarget = 0; },
  },

  /* ------------------------------------------------------------- the turn */
  turnaround: {
    dur: 2.2,
    tags: ['turn'],
    start(B) {
      B.s.yawTarget = B.s.yaw + Math.PI * 2;
      B.s.hand.l.out = 0.4; B.s.hand.r.out = 0.4;
    },
    tick(B, p) {
      B.s.rollTarget = Math.sin(p * Math.PI * 2) * 0.10;
      B.s.hand.l.want = 1; B.s.hand.r.want = 1;
    },
    end(B) { B.s.yaw -= Math.PI * 2; B.s.yawTarget -= Math.PI * 2; B.s.rollTarget = 0; },
  },

  peek: {
    dur: 2.6,
    tags: ['turn'],
    start(B) { B.express('thinking'); B.s.yawTarget = 2.5; },
    tick(B, p) {
      const S = B.s;
      B.once(0.30, () => { S.yawTarget = 2.05; S.pitchTarget = -0.08; }, p);
      B.once(0.46, () => { B.express('surprised'); S.squashVX = 2.2; S.squashVY = -2.2; }, p);
      B.once(0.74, () => { S.yawTarget = 0; S.pitchTarget = 0; B.express('happy'); }, p);
    },
    end(B) { B.s.yawTarget = 0; },
  },

  lookAround: {
    dur: 2.8,
    tags: ['turn', 'idle'],
    start(B) { B.express('thinking'); },
    tick(B, p) {
      const S = B.s;
      B.once(0.05, () => { S.yawTarget = -0.95; S.pitchTarget =  0.05; }, p);
      B.once(0.34, () => { S.yawTarget =  1.05; }, p);
      B.once(0.62, () => { S.yawTarget = -0.35; S.pitchTarget = -0.18; B.express('confused'); }, p);
      B.once(0.86, () => { S.yawTarget =  0;    S.pitchTarget =  0; }, p);
    },
    end(B) { B.express('happy'); },
  },

  /* ------------------------------------------------------------- physical */
  jump: {
    dur: 1.25,
    tags: ['physical'],
    start(B) { B.express('excited'); },
    tick(B, p, dt) {
      const S = B.s;
      if (p < 0.20) {                                   // anticipation crouch
        S.squashY += (0.80 - S.squashY) * (1 - Math.pow(0.02, dt));
        S.squashX += (1.18 - S.squashX) * (1 - Math.pow(0.02, dt));
      }
      B.once(0.20, () => { S.squashVY = 5.5; S.squashVX = -4.2; }, p);
      if (p >= 0.20 && p < 0.82) {
        const q = (p - 0.20) / 0.62;
        S.hover = Math.sin(q * Math.PI) * 118;
        S.pitchTarget = -Math.sin(q * Math.PI) * 0.16;
      }
      B.once(0.82, () => {
        B.cue('land');
        S.squashVY = -6.5; S.squashVX = 5.0; S.pitchTarget = 0;
        B.emit('sparkle', 7, { y: 110, angle: -Math.PI / 2, spdMin: 60, spdMax: 150,
                               grav: 500, color: B.theme.bodyDeep });
      }, p);
    },
    end(B) { B.express('happy'); B.s.pitchTarget = 0; },
  },

  wave: {
    dur: 2.0,
    tags: ['social'],
    start(B) { B.express('happy'); B.s.yawTarget = 0.34; B.s.rollTarget = -0.08; },
    tick(B, p) {
      const S = B.s;
      const k = B.ramp(p, 0.18, 0.82);
      S.hand.r.lift  = k * 1.15;
      S.hand.r.out   = k * 0.45;
      S.hand.r.swing = Math.sin(S.t * 13) * 0.55 * k;
      S.hand.r.want  = k;
      B.once(0.10, () => { S.talk = 0.6; }, p);
    },
    end(B) { B.s.yawTarget = 0; B.s.rollTarget = 0; },
  },

  dance: {
    dur: 3.4,
    tags: ['social'],
    start(B) { B.express('excited'); },
    tick(B, p, dt) {
      const S = B.s, w = S.t * 5.2;
      S.yawTarget   = Math.sin(w) * 0.75;
      S.rollTarget  = Math.sin(w * 0.5) * 0.16;
      S.hover       = Math.abs(Math.sin(w)) * 26;
      S.hand.l.lift = 0.5 + Math.sin(w) * 0.5;
      S.hand.r.lift = 0.5 - Math.sin(w) * 0.5;
      S.hand.l.out  = 0.5; S.hand.r.out  = 0.5;
      S.hand.l.want = 1;   S.hand.r.want = 1;
      S.squashY += (1 + Math.sin(w * 2) * 0.05 - S.squashY) * (1 - Math.pow(0.05, dt));
      if (B.random() < dt * 7)
        B.emit('sparkle', 1, { y: B.random.range(-90, 20), spdMin: 20, spdMax: 80,
                               grav: -40, ttlMin: 0.7, ttlMax: 1.2, color: B.theme.spark });
    },
    end(B) { B.s.yawTarget = 0; B.s.rollTarget = 0; B.express('happy'); },
  },

  dizzy: {
    dur: 3.0,
    tags: ['physical'],
    start(B) { B.express('dizzy'); B.s.yawTarget = B.s.yaw + Math.PI * 4; },
    tick(B, p, dt) {
      const S = B.s;
      S.rollTarget = Math.sin(S.t * 7) * 0.20 * (1 - p);
      S.hover = Math.sin(S.t * 9) * 7 * (1 - p);
      if (B.random() < dt * 5)
        B.emit('star', 1, { y: -92, spdMin: 30, spdMax: 70, grav: -30,
                            color: '#FFC94A', ttlMin: 0.8, ttlMax: 1.3 });
    },
    end(B) {
      B.s.yaw -= Math.PI * 4; B.s.yawTarget = 0; B.s.rollTarget = 0;
      B.express('confused');
    },
  },

  sleep: {
    dur: 4.0,
    tags: ['idle'],
    start(B) { B.express('sleepy'); B.s.pitchTarget = 0.22; B.s.rollTarget = -0.14; },
    tick(B, p, dt) {
      const S = B.s;
      if (B.random() < dt * 1.8)
        B.emit('zzz', 1, { x: 44, y: -56, vx: 16, vy: -46, grav: -14, drag: 0.99,
                           sizeMin: 5, sizeMax: 9, ttlMin: 1.6, ttlMax: 2.4,
                           color: B.theme.bodyDeep });
      S.squashY += (1 + Math.sin(S.t * 1.1) * 0.035 - S.squashY) * (1 - Math.pow(0.05, dt));
    },
    end(B) { B.express('happy'); B.s.pitchTarget = 0; B.s.rollTarget = 0; },
  },

  think: {
    dur: 2.6,
    tags: ['idle'],
    start(B) { B.express('thinking'); B.s.yawTarget = -0.55; B.s.pitchTarget = -0.12; },
    tick(B, p, dt) {
      const S = B.s;
      const k = B.ramp(p, 0.2, 0.8);
      S.hand.r.lift  = -k * 0.22;      // down and in — resting on the chin
      S.hand.r.out   = -k * 0.50;
      S.hand.r.swing = Math.sin(S.t * 7) * 0.10 * k;
      S.hand.r.want  = k;
      if (B.random() < dt * 1.1)
        B.emit('sparkle', 1, { x: -52, y: -74, spdMin: 15, spdMax: 50, grav: -25,
                               color: B.theme.spark, ttlMin: 1, ttlMax: 1.6 });
    },
    end(B) { B.s.yawTarget = 0; B.s.pitchTarget = 0; },
  },

  pop: {
    dur: 0.55,
    tags: ['micro'],
    start(B) {
      B.cue('pop');
      B.s.squashVX = 4.6; B.s.squashVY = -4.6; B.s.sparkPop = 0.7;
      B.emit('sparkle', 5, { spdMin: 70, spdMax: 170, grav: 300, color: B.theme.bodyDeep });
    },
    tick() {},
    end() {},
  },
};

export const ACTION_NAMES = Object.keys(ACTIONS);
