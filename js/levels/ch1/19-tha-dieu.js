/* js/levels/ch1/19-tha-dieu.js — Ải 19: Thả Diều */
(function(){
'use strict';
const LR = window.LR;
const Sound = LR.Sound;
const {clamp} = LR.util;

/* ================= CONFIG ================= */
const METER = 10;
const ANCHOR_WY = 106;
const CHECKPOINT_H = 2500;
const V_REF = 167;
const CHECKPOINT_T = CHECKPOINT_H / V_REF;
const BASE_V = 62, MAX_V = 400, ACCEL = 140, BRAKE = 320, GRAV = 520;
const WIN_ALT = 500 * METER;    // 500m = đích
const STAR2_ALT = 800 * METER;
const STAR3_ALT = 1200 * METER;

const rand  = (a,b) => a + Math.random()*(b-a);
const lerp  = (a,b,t) => a + (b-a)*t;
const rgb   = (r,g,b) => `rgb(${r|0},${g|0},${b|0})`;
const hash  = n => { const s = Math.sin(n)*43758.5453; return s - Math.floor(s); };

/* ================= STATE ================= */
let st = null;
let W = 0, H = 0, DPR = 1;

/* Music state */
let musicBuilt = false;
let musicStopped = false;
let musicNodes = null;
let nextFluteT = 0;
let phraseIdx = 0;

const FLUTE_PHRASES = [
  [
    { f: 392.00, d: 1.0, a: 0.90 },
    { f: 440.00, d: 0.4, a: 0.85 },
    { f: 523.25, d: 1.5, a: 1.00, g: 440 },
    { f: 587.33, d: 0.4, a: 0.90 },
    { f: 523.25, d: 1.8, a: 0.95 },
    { f: 440.00, d: 0.5, a: 0.80 },
    { f: 392.00, d: 2.2, a: 0.90 }
  ],
  [
    { f: 659.25, d: 1.0, a: 0.90, g: 523 },
    { f: 587.33, d: 0.4, a: 0.85 },
    { f: 523.25, d: 0.9, a: 0.95 },
    { f: 587.33, d: 0.5, a: 0.85 },
    { f: 659.25, d: 1.0, a: 1.00 },
    { f: 783.99, d: 1.8, a: 1.00 },
    { f: 659.25, d: 0.7, a: 0.90 },
    { f: 587.33, d: 1.5, a: 0.90 }
  ],
  [
    { f: 783.99, d: 0.7, a: 0.95 },
    { f: 659.25, d: 0.5, a: 0.85 },
    { f: 587.33, d: 0.7, a: 0.90 },
    { f: 523.25, d: 1.0, a: 0.95 },
    { f: 440.00, d: 0.4, a: 0.80 },
    { f: 392.00, d: 2.4, a: 0.95 }
  ],
  [
    { f: 523.25, d: 0.5, a: 0.85 },
    { f: 587.33, d: 0.3, a: 0.80 },
    { f: 659.25, d: 0.5, a: 0.90 },
    { f: 783.99, d: 0.9, a: 1.00 },
    { f: 880.00, d: 1.4, a: 1.00, g: 784 },
    { f: 783.99, d: 0.5, a: 0.90 },
    { f: 659.25, d: 0.5, a: 0.85 },
    { f: 587.33, d: 0.9, a: 0.90 },
    { f: 523.25, d: 2.0, a: 0.95 }
  ]
];

/* ================= MUSIC (flute + drone + wind) ================= */
function buildMusic() {
  if (musicBuilt) return;
  const a = Sound.audio();
  if (!a) return;
  if (a.ctx.state !== 'running') return;
  musicBuilt = true;
  const ctx = a.ctx, out = a.out;

  const musicSub = ctx.createGain();
  musicSub.gain.value = 0.24;
  musicSub.connect(out);

  const drone = ctx.createOscillator();
  drone.type = 'sine';
  drone.frequency.value = 196.00;
  const droneG = ctx.createGain();
  droneG.gain.value = 0.05;
  const droneLfo = ctx.createOscillator();
  droneLfo.frequency.value = 0.09;
  const droneLfoG = ctx.createGain();
  droneLfoG.gain.value = 0.02;
  droneLfo.connect(droneLfoG);
  droneLfoG.connect(droneG.gain);
  drone.connect(droneG);
  droneG.connect(musicSub);
  drone.start();
  droneLfo.start();

  const wLen = Math.floor(ctx.sampleRate * 3);
  const wBuf = ctx.createBuffer(1, wLen, ctx.sampleRate);
  const wd = wBuf.getChannelData(0);
  for (let i = 0; i < wLen; i++) wd[i] = Math.random() * 2 - 1;
  const wind = ctx.createBufferSource();
  wind.buffer = wBuf;
  wind.loop = true;
  const wFilt = ctx.createBiquadFilter();
  wFilt.type = 'lowpass';
  wFilt.frequency.value = 260;
  const wG = ctx.createGain();
  wG.gain.value = 0.06;
  wind.connect(wFilt);
  wFilt.connect(wG);
  wG.connect(musicSub);
  wind.start();

  musicNodes = { musicSub, drone, droneLfo, wind, droneG, wG };
  nextFluteT = ctx.currentTime + 1.0;
  musicStopped = false;
}

function stopMusic() {
  if (!musicNodes) return;
  musicStopped = true;
  const a = Sound.audio();
  if (!a) return;
  try {
    musicNodes.musicSub.gain.cancelScheduledValues(a.ctx.currentTime);
    musicNodes.musicSub.gain.linearRampToValueAtTime(0, a.ctx.currentTime + 0.8);
  } catch(e){}
}

function destroyMusic() {
  if (!musicNodes) return;
  try { musicNodes.drone.stop(); } catch(e){}
  try { musicNodes.droneLfo.stop(); } catch(e){}
  try { musicNodes.wind.stop(); } catch(e){}
  try { musicNodes.drone.disconnect(); } catch(e){}
  try { musicNodes.droneLfo.disconnect(); } catch(e){}
  try { musicNodes.wind.disconnect(); } catch(e){}
  try { musicNodes.musicSub.disconnect(); } catch(e){}
  musicNodes = null;
  musicBuilt = false;
}

function playFluteNote(freq, startT, dur, opts) {
  const a = Sound.audio();
  if (!a || !musicNodes || musicStopped) return;
  opts = opts || {};
  const ctx = a.ctx;
  const velocity = opts.velocity ?? 0.9;
  const glideFrom = opts.glideFrom || null;
  const vibHz = opts.vibrato ?? 5.4;
  const vibCents = opts.vibDepth ?? 8;
  const attack = Math.min(0.09, dur * 0.18);
  const release = Math.min(0.35, dur * 0.45);
  const end = startT + dur;

  const osc = ctx.createOscillator();
  osc.type = 'triangle';
  if (glideFrom) {
    osc.frequency.setValueAtTime(glideFrom, startT);
    osc.frequency.exponentialRampToValueAtTime(freq, startT + Math.min(0.18, dur * 0.5));
  } else {
    osc.frequency.setValueAtTime(freq, startT);
  }
  const osc2 = ctx.createOscillator();
  osc2.type = 'sine';
  osc2.frequency.setValueAtTime(freq * 2, startT);
  const osc2G = ctx.createGain();
  osc2G.gain.value = 0.14;

  const vib = ctx.createOscillator();
  vib.type = 'sine';
  vib.frequency.value = vibHz;
  const vibG = ctx.createGain();
  vibG.gain.value = freq * (vibCents / 1200);
  vib.connect(vibG);
  vibG.connect(osc.frequency);
  vibG.connect(osc2.frequency);

  const breathLen = Math.ceil(ctx.sampleRate * (dur + 0.1));
  const buf = ctx.createBuffer(1, breathLen, ctx.sampleRate);
  const bd = buf.getChannelData(0);
  for (let i = 0; i < breathLen; i++) bd[i] = Math.random() * 2 - 1;
  const breath = ctx.createBufferSource();
  breath.buffer = buf;
  const bFilt = ctx.createBiquadFilter();
  bFilt.type = 'bandpass';
  bFilt.frequency.value = freq * 3.5;
  bFilt.Q.value = 1.6;
  const bG = ctx.createGain();
  bG.gain.value = 0.10 * velocity;

  const env = ctx.createGain();
  env.gain.setValueAtTime(0, startT);
  env.gain.linearRampToValueAtTime(0.20 * velocity, startT + attack);
  env.gain.setValueAtTime(0.20 * velocity, end - release);
  env.gain.linearRampToValueAtTime(0, end);

  osc.connect(env);
  osc2.connect(osc2G);
  osc2G.connect(env);
  breath.connect(bFilt);
  bFilt.connect(bG);
  bG.connect(env);
  env.connect(musicNodes.musicSub);

  const stopT = end + 0.08;
  osc.start(startT);    osc.stop(stopT);
  osc2.start(startT);   osc2.stop(stopT);
  vib.start(startT);    vib.stop(stopT);
  breath.start(startT); breath.stop(stopT);
}

function schedulePhrase() {
  const p = FLUTE_PHRASES[phraseIdx % FLUTE_PHRASES.length];
  phraseIdx++;
  let t = nextFluteT;
  for (const n of p) {
    playFluteNote(n.f, t, n.d, {
      velocity: n.a ?? 0.9,
      glideFrom: n.g,
      vibrato: 5.0 + Math.random() * 1.4,
      vibDepth: 6 + Math.random() * 5
    });
    t += n.d + 0.06;
  }
  nextFluteT = t + 1.4 + Math.random() * 2.2;
}

function updateMusic() {
  if (!musicBuilt || musicStopped) return;
  const a = Sound.audio();
  if (!a) return;
  if (a.ctx.currentTime + 3.0 >= nextFluteT) schedulePhrase();
}

/* ================= SFX ================= */
function sfxLaunch()  { Sound.noise(0.55, 0.20, 'bandpass', 400, 2600, 0, 4); }
function sfxGust()    { Sound.noise(0.88, 0.13, 'bandpass', 300, 900, 0, 1.8); }
function sfxSnap() {
  Sound.noise(0.18, 0.65, 'highpass', 1400, 1400, 0, 1);
  Sound.tone('sawtooth', 1200, 280, 0.12, 0.20);
}
function sfxChime() {
  [523.25, 659.25, 783.99, 1046.50].forEach((f, i) => {
    Sound.tone('sine', f, f, 0.95, 0.18, i * 0.055);
  });
}
function sfxCaw() {
  Sound.tone('sawtooth', 700, 340, 0.14, 0.28);
  Sound.tone('sawtooth', 340, 560, 0.06, 0.22, 0.14);
  Sound.tone('sawtooth', 560, 300, 0.06, 0.18, 0.20);
}
function sfxThump()   { Sound.tone('sine', 180, 55, 0.18, 0.42); }
function sfxGameOver() {
  [261.63, 196.00, 146.83].forEach((f, i) => {
    Sound.tone('sine', f, f, 1.4, 0.20, i * 0.22);
  });
}

/* ================= SETUP ================= */
function setupDims() {
  W = LR.G.W;
  H = LR.G.H;
  DPR = LR.G.dpr || 1;
}

const sy = wy => H - (wy - (st ? st.camY : 0));

function buildStars() {
  st.stars = [];
  const n = Math.min(220, Math.round(W * H / 9000));
  for (let i = 0; i < n; i++)
    st.stars.push({ x: Math.random() * W, y: Math.random() * (H + 200), r: rand(.6, 1.8), p: rand(0, 6.3) });
}

function newCloud(y) {
  return { x: rand(-140, W + 140), y, s: rand(.5, 1.35), sp: rand(4, 16), a: rand(.3, .7) };
}

/* ================= RESET ================= */
function reset() {
  st = {
    state: 'play',
    camY: -80, camShake: 0, time: 0, deathT: 0, maxAlt: 0,
    kite: { x: W / 2, wy: 40, v: 70, boost: 0, vx: 0, vy: 0, tilt: 0, spin: 0, inv: 0 },
    branches: [], crows: [], particles: [], clouds: [], stars: [], streaks: [],
    groundDeco: [],
    nextBranchY: 380, branchCx: W / 2,
    nextCrowT: rand(3.0, 4.5),
    gustT: rand(4, 8), gustDur: 0, gustDir: 1,
    pointerActive: false, keyActive: false, keys: { left: false, right: false },
    pointerX: W / 2,
    hintTimer: 6.5,
    nextCheckpoint: CHECKPOINT_H,
    timeLeft: CHECKPOINT_T,
    whyText: '',
    snapTail: null,
    finished: false,
    goalReached: false,
    goalBannerTimer: 0
  };
  buildStars();
  for (let i = 0; i < 12; i++) st.clouds.push(newCloud(rand(-260, H)));
  for (let i = 0; i < 11; i++)
    st.groundDeco.push({ x: rand(-20, W + 20), h: rand(110, 250), w: rand(24, 60), a: rand(.25, .55) });

  musicStopped = false;
  if (musicBuilt && musicNodes) {
    const a = Sound.audio();
    if (a) {
      try {
        musicNodes.musicSub.gain.cancelScheduledValues(a.ctx.currentTime);
        musicNodes.musicSub.gain.linearRampToValueAtTime(0.24, a.ctx.currentTime + 1.0);
        nextFluteT = a.ctx.currentTime + 1.0;
      } catch(e){}
    }
  }
  updateHUD();
}

function updateHUD() {
  if (!st) return;
  const m = Math.max(0, Math.floor(st.kite.wy / METER));
  const secs = Math.max(0, st.timeLeft);
  const items = [
    { l: 'Cao', v: m + 'm' },
    { l: 'Còn', v: secs.toFixed(1) + 's', w: secs < 5 }
  ];
  if (st.goalReached) items.push({ l: 'Đích', v: '✓' });
  LR.G.hud.set(items);
}

/* ================= BRANCHES ================= */
function pickGapWidth(diff) {
  const r = Math.random() * 100;
  let base;
  if      (r < 32) base = 0.21 - 0.045 * diff;
  else if (r < 70) base = 0.28 - 0.060 * diff;
  else             base = 0.37 - 0.085 * diff;
  return clamp(W * (base + rand(-0.012, 0.012)), 92, W * 0.60);
}

function subtractZones(lo, hi, zones) {
  zones = zones.slice().sort((a, b) => a[0] - b[0]);
  const out = [];
  let cur = lo;
  for (const z of zones) {
    const a = Math.max(lo, z[0]);
    const b = Math.min(hi, z[1]);
    if (a > cur) out.push([cur, a]);
    if (b > cur) cur = b;
  }
  if (hi > cur) out.push([cur, hi]);
  return out.filter(s => s[1] - s[0] > 1);
}

function randInSegs(segs) {
  let total = 0;
  for (const s of segs) total += s[1] - s[0];
  let p = Math.random() * total;
  for (const s of segs) {
    const w = s[1] - s[0];
    if (p <= w) return s[0] + p;
    p -= w;
  }
  const last = segs[segs.length - 1];
  return (last[0] + last[1]) * 0.5;
}

function spawnBranch(y) {
  const diff = clamp(y / 9000, 0, 1);
  const gapW = pickGapWidth(diff);
  const half = gapW * 0.5;
  const lo = half + 38;
  const hi = W - half - 38;
  if (hi - lo < 6) {
    st.branchCx = W / 2;
    st.branches.push({ y, cx: W / 2, gapW, seed: rand(0, 100), sway: rand(-1, 1) });
    return;
  }
  const range = hi - lo;
  const baseOff = range * (0.28 + 0.14 * diff);
  let c = null;
  for (let k = 1; k >= 0.2 && c === null; k -= 0.1) {
    const oP = baseOff * k;
    const oK = baseOff * k * 0.72;
    const segs = subtractZones(lo, hi, [
      [st.branchCx - oP, st.branchCx + oP],
      [st.kite.x - oK, st.kite.x + oK]
    ]);
    if (segs.length) c = randInSegs(segs);
  }
  if (c === null) c = (st.kite.x - lo > hi - st.kite.x) ? lo : hi;
  st.branchCx = c;
  st.branches.push({ y, cx: c, gapW, seed: rand(0, 100), sway: rand(-1, 1) });
}

function leaf(ctx, x, y, ang, len, col) {
  ctx.save();
  ctx.translate(x, y);
  ctx.rotate(ang);
  ctx.beginPath();
  ctx.moveTo(0, 0);
  ctx.quadraticCurveTo(len * 0.5, -len * 0.26, len, 0);
  ctx.quadraticCurveTo(len * 0.5, len * 0.26, 0, 0);
  ctx.fillStyle = col;
  ctx.fill();
  ctx.restore();
}

function drawBamboo(ctx, x0, x1, y, seed, sway) {
  if (x1 - x0 < 3) return;
  const amp = 6 * sway;
  const n = Math.max(2, Math.ceil((x1 - x0) / 62));
  const pts = [];
  for (let i = 0; i <= n; i++) {
    const t = i / n;
    pts.push([lerp(x0, x1, t), y + Math.sin(t * 2.4 + seed) * amp]);
  }
  ctx.lineCap = 'round';
  ctx.lineJoin = 'round';
  ctx.beginPath();
  ctx.moveTo(pts[0][0], pts[0][1]);
  for (let i = 1; i < pts.length; i++) ctx.lineTo(pts[i][0], pts[i][1]);
  ctx.strokeStyle = '#3c6620'; ctx.lineWidth = 15; ctx.stroke();
  ctx.strokeStyle = '#6ea336'; ctx.lineWidth = 11; ctx.stroke();
  ctx.strokeStyle = '#8dc44f'; ctx.lineWidth = 3.5; ctx.stroke();

  for (let i = 0; i < pts.length; i++) {
    const px = pts[i][0], py = pts[i][1];
    ctx.beginPath();
    ctx.arc(px, py, 6.5, 0, 7);
    ctx.fillStyle = 'rgba(58,96,32,.85)';
    ctx.fill();
    for (let k = 0; k < 2; k++) {
      const h1 = hash(seed * 7.1 + i * 3.13 + k * 13.7);
      const h2 = hash(seed * 11.3 + i * 5.31 + k * 2.9);
      const base = 0.4 + h1 * 0.85;
      const ang = (k === 0) ? base : Math.PI - base;
      const len = 24 + h2 * 28;
      leaf(ctx, px, py, ang, len, k === 0 ? '#5f9c33' : '#78b845');
    }
  }
}

function drawBranches(ctx) {
  for (const b of st.branches) {
    const y = sy(b.y);
    if (y < -170 || y > H + 170) continue;
    const gs = b.cx - b.gapW / 2;
    const ge = b.cx + b.gapW / 2;
    if (gs > 4) drawBamboo(ctx, 0, gs, y, b.seed, b.sway);
    if (ge < W - 4) drawBamboo(ctx, ge, W, y, b.seed + 3.7, b.sway);
  }
}

/* ================= CROWS ================= */
function makeCrow(spawnX, index) {
  const dx = Math.abs(st.kite.x - spawnX);
  const MIN_ETA = 1.6;
  const eta = Math.max(MIN_ETA, dx / 190);
  const climbRate = Math.min(350, st.kite.v + st.kite.boost);
  const predictWy = st.kite.wy + climbRate * eta * 0.8;
  const spawnWy = predictWy - climbRate * eta * 0.35 + index * (60 + Math.random() * 30);
  const vx = (st.kite.x - spawnX) / eta;
  const vy = (predictWy - spawnWy) / eta;
  st.crows.push({ x: spawnX, wy: spawnWy, vx, vy, ph: Math.random() * 10, ttl: eta + 2.5 });
}

function spawnCrowFlock() {
  const r = Math.random();
  const n = r < 0.40 ? 3 : (r < 0.70 ? 2 : 1);
  let dir;
  if (Math.random() < 0.7) dir = st.kite.x > W / 2 ? 1 : -1;
  else dir = st.kite.x > W / 2 ? -1 : 1;
  let spawnX = dir > 0 ? 15 : W - 15;
  if (Math.abs(st.kite.x - spawnX) < 180) spawnX = dir > 0 ? -160 : W + 160;
  for (let i = 0; i < n; i++) makeCrow(spawnX, i);
  sfxCaw();
}

function drawCrow(ctx, c) {
  const x = c.x, y = sy(c.wy);
  if (x < -120 || x > W + 120 || y < -140 || y > H + 140) return;
  const flap = Math.sin(c.ph);
  const f15 = flap * 15, f19 = flap * 19;
  const flip = c.vx >= 0 ? 1 : -1;
  ctx.save();
  ctx.translate(x, y);
  ctx.scale(flip, 1);
  ctx.fillStyle = '#1b1b22';
  ctx.beginPath();
  ctx.moveTo(0, -2);
  ctx.quadraticCurveTo(-16, -14 - f15, -35, -6 - f19);
  ctx.quadraticCurveTo(-16, -1, 0, 5);
  ctx.fill();
  ctx.beginPath();
  ctx.moveTo(0, -2);
  ctx.quadraticCurveTo(16, -14 + f15, 35, -6 + f19);
  ctx.quadraticCurveTo(16, -1, 0, 5);
  ctx.fill();
  ctx.beginPath(); ctx.ellipse(0, 0, 13, 8, 0, 0, 7); ctx.fill();
  ctx.beginPath(); ctx.arc(12, -3.5, 6.2, 0, 7); ctx.fill();
  ctx.fillStyle = '#c99a3a';
  ctx.beginPath();
  ctx.moveTo(16.5, -4.5); ctx.lineTo(26, -1.5); ctx.lineTo(16.5, 1.5);
  ctx.closePath(); ctx.fill();
  ctx.fillStyle = '#e8503a';
  ctx.beginPath(); ctx.arc(13.5, -5, 1.4, 0, 7); ctx.fill();
  ctx.restore();
}

function drawCrows(ctx) {
  for (const c of st.crows) drawCrow(ctx, c);
}

/* ================= PARTICLES ================= */
function burstW(wx, wy, n, col, spd) {
  spd = spd || 210;
  for (let i = 0; i < n; i++) {
    const a = rand(0, 6.3), s = rand(spd * 0.25, spd);
    st.particles.push({ x: wx, wy, vx: Math.cos(a) * s, vy: Math.sin(a) * s,
      life: rand(.5, 1.25), t: 0, col, r: rand(1.4, 3.6) });
  }
}

function drawParticles(ctx) {
  for (const p of st.particles) {
    const a = 1 - p.t / p.life;
    if (a <= 0) continue;
    ctx.globalAlpha = a;
    ctx.fillStyle = p.col;
    ctx.beginPath();
    ctx.arc(p.x, sy(p.wy), p.r * a + .7, 0, 7);
    ctx.fill();
  }
  ctx.globalAlpha = 1;
}

/* ================= SKY / GROUND ================= */
function drawSky(ctx) {
  const t = clamp((st.camY + 80) / 11000, 0, 1);
  const g = ctx.createLinearGradient(0, 0, 0, H);
  g.addColorStop(0,    rgb(lerp(96, 10, t), lerp(164, 26, t), lerp(224, 76, t)));
  g.addColorStop(0.55, rgb(lerp(152, 30, t), lerp(202, 68, t), lerp(240, 128, t)));
  g.addColorStop(1,    rgb(lerp(216, 88, t), lerp(238, 140, t), lerp(250, 192, t)));
  ctx.fillStyle = g;
  ctx.fillRect(0, 0, W, H);

  const sunA = 1 - t * 0.55;
  const sx0 = W * 0.78, sy0 = H * 0.14;
  const rg = ctx.createRadialGradient(sx0, sy0, 0, sx0, sy0, Math.max(W, H) * 0.45);
  rg.addColorStop(0,    `rgba(255,244,200,${0.55 * sunA})`);
  rg.addColorStop(0.25, `rgba(255,230,160,${0.15 * sunA})`);
  rg.addColorStop(1,    'rgba(255,230,160,0)');
  ctx.fillStyle = rg;
  ctx.fillRect(0, 0, W, H);

  if (t > 0.35) {
    const a = (t - 0.35) / 0.65;
    for (const s of st.stars) {
      const yy = ((s.y + st.camY * 0.06) % (H + 200) + (H + 200)) % (H + 200) - 100;
      const tw = 0.55 + 0.45 * Math.sin(st.time * 2 + s.p);
      ctx.globalAlpha = a * tw * 0.9;
      ctx.fillStyle = '#fff';
      ctx.beginPath(); ctx.arc(s.x, yy, s.r, 0, 7); ctx.fill();
    }
    ctx.globalAlpha = 1;
  }
}

function drawClouds(ctx) {
  const t = clamp(st.camY / 12000, 0, 1);
  for (const c of st.clouds) {
    if (c.y < -240 || c.y > H + 260) continue;
    ctx.save();
    ctx.translate(c.x, c.y);
    ctx.scale(c.s, c.s);
    ctx.globalAlpha = c.a * (1 - t * 0.6);
    ctx.fillStyle = '#ffffff';
    ctx.beginPath();
    ctx.arc(0, 0, 34, 0, 7);
    ctx.arc(38, 7, 26, 0, 7);
    ctx.arc(-38, 9, 24, 0, 7);
    ctx.arc(12, -19, 26, 0, 7);
    ctx.fill();
    ctx.restore();
  }
  ctx.globalAlpha = 1;
}

function drawGround(ctx) {
  const gy = sy(0);
  if (gy > H + 340) return;
  ctx.fillStyle = '#4e7f34';
  ctx.fillRect(0, gy, W, Math.max(0, H - gy) + 400);
  ctx.fillStyle = '#5f9440';
  ctx.fillRect(0, gy, W, 9);
}

function drawGroundDecor(ctx) {
  const gy = sy(0);
  if (gy > H + 340) return;
  for (const d of st.groundDeco) {
    ctx.globalAlpha = d.a;
    ctx.fillStyle = '#2f5c22';
    ctx.beginPath();
    ctx.moveTo(d.x, gy);
    ctx.quadraticCurveTo(d.x - d.w * 0.5, gy - d.h * 0.6, d.x, gy - d.h);
    ctx.quadraticCurveTo(d.x + d.w * 0.5, gy - d.h * 0.6, d.x + d.w * 0.18, gy);
    ctx.closePath();
    ctx.fill();
  }
  ctx.globalAlpha = 1;
  drawBoyBuffalo(ctx, W / 2, gy);
}

function drawBoyBuffalo(ctx, cx, gy) {
  if (gy > H + 240 || gy < -520) return;
  ctx.save();
  ctx.translate(cx, gy);
  ctx.globalAlpha = 0.16;
  ctx.fillStyle = '#000';
  ctx.beginPath(); ctx.ellipse(0, 0, 74, 12, 0, 0, 7); ctx.fill();
  ctx.globalAlpha = 1;
  const body = '#3b3b42', dark = '#2b2b32', horn = '#ded7c3';
  ctx.strokeStyle = dark; ctx.lineWidth = 8; ctx.lineCap = 'round';
  for (const lx of [-42, -24, 20, 38]) {
    ctx.beginPath(); ctx.moveTo(lx, -46); ctx.lineTo(lx + (lx > 0 ? 6 : -6), -2); ctx.stroke();
  }
  ctx.beginPath();
  ctx.moveTo(-56, -70);
  ctx.quadraticCurveTo(-82, -50, -76, -6);
  ctx.strokeStyle = dark; ctx.lineWidth = 4; ctx.stroke();
  ctx.fillStyle = body;
  ctx.beginPath(); ctx.ellipse(0, -62, 60, 32, 0, 0, 7); ctx.fill();
  ctx.beginPath();
  ctx.moveTo(46, -82);
  ctx.quadraticCurveTo(76, -88, 84, -70);
  ctx.quadraticCurveTo(90, -50, 72, -44);
  ctx.quadraticCurveTo(54, -42, 46, -58);
  ctx.closePath();
  ctx.fill();
  ctx.beginPath(); ctx.ellipse(88, -66, 20, 16, -0.18, 0, 7);
  ctx.fillStyle = dark; ctx.fill();
  ctx.beginPath(); ctx.ellipse(104, -60, 10, 8, 0, 0, 7);
  ctx.fillStyle = '#4a4a52'; ctx.fill();
  ctx.strokeStyle = horn; ctx.lineWidth = 6; ctx.lineCap = 'round';
  ctx.beginPath(); ctx.moveTo(80, -78); ctx.quadraticCurveTo(72, -106, 50, -100); ctx.stroke();
  ctx.beginPath(); ctx.moveTo(92, -80); ctx.quadraticCurveTo(102, -108, 124, -100); ctx.stroke();
  ctx.fillStyle = dark;
  ctx.beginPath(); ctx.ellipse(74, -74, 9, 5, -0.6, 0, 7); ctx.fill();
  const bx = -14, by = -96;
  ctx.strokeStyle = '#2f4a6e'; ctx.lineWidth = 7; ctx.lineCap = 'round';
  ctx.beginPath();
  ctx.moveTo(bx, by + 16); ctx.lineTo(bx + 17, by + 25); ctx.lineTo(bx + 17, by + 34);
  ctx.stroke();
  ctx.fillStyle = '#c9503a';
  ctx.beginPath(); ctx.ellipse(bx, by, 13, 17, 0, 0, 7); ctx.fill();
  ctx.strokeStyle = '#e0b48c'; ctx.lineWidth = 5;
  ctx.beginPath(); ctx.moveTo(bx + 6, by - 4); ctx.lineTo(bx + 26, by - 10); ctx.stroke();
  ctx.beginPath(); ctx.moveTo(bx - 5, by - 4); ctx.lineTo(bx + 9, by - 19); ctx.stroke();
  ctx.fillStyle = '#e6b98d';
  ctx.beginPath(); ctx.arc(bx + 2, by - 22, 11, 0, 7); ctx.fill();
  ctx.fillStyle = '#d9b06a';
  ctx.beginPath();
  ctx.moveTo(bx + 2, by - 47);
  ctx.lineTo(bx + 25, by - 18);
  ctx.lineTo(bx - 21, by - 18);
  ctx.closePath();
  ctx.fill();
  ctx.strokeStyle = '#b8904f'; ctx.lineWidth = 1.6; ctx.stroke();
  ctx.restore();
}

/* ================= CHECKPOINT ================= */
function drawCheckpoint(ctx) {
  if (st.state !== 'play') return;
  const y = sy(st.nextCheckpoint);
  if (y < -40 || y > H + 40) return;
  const pulse = 0.45 + 0.30 * Math.sin(st.time * 4);
  const grad = ctx.createLinearGradient(0, y - 22, 0, y + 22);
  grad.addColorStop(0,   'rgba(255,215,80,0)');
  grad.addColorStop(0.5, `rgba(255,215,80,${0.20 * pulse + 0.06})`);
  grad.addColorStop(1,   'rgba(255,215,80,0)');
  ctx.fillStyle = grad;
  ctx.fillRect(0, y - 22, W, 44);
  ctx.save();
  ctx.setLineDash([16, 10]);
  ctx.lineDashOffset = -st.time * 40;
  ctx.strokeStyle = `rgba(255,215,80,${pulse})`;
  ctx.lineWidth = 3;
  ctx.beginPath();
  ctx.moveTo(0, y); ctx.lineTo(W, y);
  ctx.stroke();
  ctx.restore();
  ctx.save();
  ctx.font = '600 12px "Be Vietnam Pro", sans-serif';
  ctx.fillStyle = `rgba(255,215,80,${0.6 + 0.3 * Math.sin(st.time * 4)})`;
  ctx.textAlign = 'left';
  ctx.textBaseline = 'middle';
  ctx.fillText(Math.floor(st.nextCheckpoint / METER) + ' m', 10, y - 12);
  ctx.restore();
}

/* ================= SNAP TAIL ================= */
function snapString() {
  const segLen = 12;
  const pts = [];
  for (let i = 0; i < 12; i++) {
    pts.push({ x: st.kite.x, y: st.kite.wy - i * segLen, vx: st.kite.vx * 0.4, vy: 0 });
  }
  st.snapTail = { pts, segLen, t: 0 };
}

function updateSnapTail(dt) {
  if (!st.snapTail) return;
  st.snapTail.t += dt;
  const pts = st.snapTail.pts;
  const segLen = st.snapTail.segLen;
  for (const p of pts) {
    p.vy -= 900 * dt;
    p.vx *= 0.965; p.vy *= 0.965;
    p.x += p.vx * dt; p.y += p.vy * dt;
  }
  let px = st.kite.x, py = st.kite.wy;
  for (const p of pts) {
    const dx = p.x - px, dy = p.y - py;
    const d = Math.hypot(dx, dy) || 0.01;
    p.x = px + dx / d * segLen;
    p.y = py + dy / d * segLen;
    px = p.x; py = p.y;
  }
}

function drawSnapTail(ctx) {
  if (!st.snapTail) return;
  const pts = st.snapTail.pts;
  ctx.lineCap = 'round'; ctx.lineJoin = 'round';
  let prevX = st.kite.x, prevY = sy(st.kite.wy);
  for (let i = 0; i < pts.length; i++) {
    const p = pts[i];
    const y = sy(p.y);
    const t = i / pts.length;
    ctx.strokeStyle = `rgba(255,235,190,${0.9 - t * 0.6})`;
    ctx.lineWidth = 2.4 * (1 - t * 0.7) + 0.6;
    ctx.beginPath();
    ctx.moveTo(prevX, prevY);
    ctx.lineTo(p.x, y);
    ctx.stroke();
    prevX = p.x; prevY = y;
  }
  if (pts.length > 0) {
    const last = pts[pts.length - 1];
    ctx.fillStyle = 'rgba(255,215,120,0.9)';
    ctx.beginPath(); ctx.arc(last.x, sy(last.y), 2.6, 0, 7); ctx.fill();
  }
}

/* ================= KITE ================= */
function drawKite(ctx) {
  const kx = st.kite.x, ky = sy(st.kite.wy);
  const ax = W * 0.5 + 12, ay = sy(ANCHOR_WY);

  if (st.state === 'play') {
    ctx.beginPath();
    ctx.moveTo(kx, ky);
    ctx.quadraticCurveTo((kx + ax) / 2 + 12, (ky + ay) / 2, ax, ay);
    ctx.strokeStyle = 'rgba(255,255,255,0.34)';
    ctx.lineWidth = 1.2;
    ctx.stroke();
  } else if (st.snapTail) {
    const t = Math.min(1, st.snapTail.t / 1.2);
    const sag = 30 + t * 90;
    ctx.beginPath();
    ctx.moveTo(ax, ay);
    ctx.quadraticCurveTo(ax - 20, ay + sag * 0.5, ax - 5, ay + sag);
    ctx.strokeStyle = `rgba(255,235,190,${0.5 - t * 0.35})`;
    ctx.lineWidth = 1.6;
    ctx.stroke();
  }

  ctx.save();
  ctx.translate(kx, ky);
  if (st.kite.inv > 0 && Math.floor(st.time * 22) % 2 === 0) ctx.globalAlpha = 0.35;
  ctx.beginPath();
  ctx.moveTo(0, 30);
  for (let i = 1; i <= 7; i++) {
    const t = i / 7;
    ctx.lineTo(Math.sin(st.time * 3.5 - i * 0.85) * 12 * t, 30 + t * 82);
  }
  ctx.strokeStyle = 'rgba(255,244,210,0.85)';
  ctx.lineWidth = 1.8;
  ctx.stroke();
  for (let i = 1; i <= 4; i++) {
    const t = i / 4.4;
    const bx2 = Math.sin(st.time * 3.5 - i * 0.85) * 12 * t;
    const by2 = 30 + t * 82;
    ctx.beginPath(); ctx.arc(bx2, by2, 3.8, 0, 7);
    ctx.fillStyle = '#ffd166'; ctx.fill();
  }
  ctx.rotate(st.kite.tilt + st.kite.spin);
  const s = 24;
  ctx.beginPath();
  ctx.moveTo(0, -s * 1.3); ctx.lineTo(s * 0.92, 0); ctx.lineTo(0, s * 1.35); ctx.lineTo(-s * 0.92, 0);
  ctx.closePath();
  const g = ctx.createLinearGradient(-s, -s, s, s);
  g.addColorStop(0,   '#ff7a4d');
  g.addColorStop(0.5, '#f0453a');
  g.addColorStop(1,   '#c92a2a');
  ctx.fillStyle = g; ctx.fill();
  ctx.strokeStyle = 'rgba(120,25,20,.85)'; ctx.lineWidth = 2; ctx.stroke();
  ctx.strokeStyle = 'rgba(96,58,26,.55)'; ctx.lineWidth = 2.5;
  ctx.beginPath();
  ctx.moveTo(0, -s * 1.3); ctx.lineTo(0, s * 1.35);
  ctx.moveTo(-s * 0.92, 0); ctx.lineTo(s * 0.92, 0);
  ctx.stroke();
  ctx.beginPath();
  ctx.moveTo(0, -s * 1.3); ctx.lineTo(s * 0.92, 0); ctx.lineTo(0, 0);
  ctx.closePath();
  ctx.fillStyle = 'rgba(255,255,255,.16)';
  ctx.fill();
  ctx.restore();

  if (st.state !== 'play') drawSnapTail(ctx);
}

function drawStreaks(ctx) {
  ctx.lineCap = 'round';
  for (const s of st.streaks) {
    ctx.globalAlpha = s.a;
    ctx.strokeStyle = '#ffffff';
    ctx.lineWidth = s.w;
    ctx.beginPath();
    ctx.moveTo(s.x, s.y);
    ctx.lineTo(s.x + s.len * Math.sign(s.spd), s.y);
    ctx.stroke();
  }
  ctx.globalAlpha = 1;
}

/* ================= COLLISION / DEATH ================= */
function hitBranch() {
  if (st.state !== 'play') return;
  st.state = 'dead';
  st.deathT = 0;
  st.whyText = 'Vướng cành tre';
  st.camShake = 20;
  st.kite.vy = st.kite.v * 0.35;
  st.kite.vx *= 0.5;
  burstW(st.kite.x, st.kite.wy, 32, '#e8503a', 250);
  burstW(st.kite.x, st.kite.wy, 14, '#ffd166', 180);
  snapString();
  sfxSnap();
  stopMusic();
}

function hitTimeout() {
  if (st.state !== 'play') return;
  st.state = 'dead';
  st.deathT = 0;
  st.whyText = 'Hết thời gian';
  st.camShake = 18;
  st.kite.vy = st.kite.v * 0.3;
  st.kite.vx *= 0.4;
  burstW(st.kite.x, st.kite.wy, 26, '#ff5a4d', 240);
  burstW(st.kite.x, st.kite.wy, 12, '#ffd166', 170);
  snapString();
  sfxSnap();
  sfxGameOver();
  stopMusic();
}

function hitCrow(c) {
  if (st.kite.inv > 0) return;
  st.kite.inv = 1.6;
  st.kite.v = Math.min(st.kite.v, 60);
  st.kite.boost = 0;
  const side = (st.kite.x < c.x ? -1 : 1);
  st.kite.x += side * 34;
  st.kite.vx = side * 500;
  st.camShake = 13;
  burstW(st.kite.x, st.kite.wy, 18, '#26262e', 220);
  c.vx = -c.vx * 1.3;
  c.vy *= -0.5;
  c.ttl = Math.min(c.ttl, 1.2);
  sfxCaw();
  sfxThump();
}

function finishGame() {
  if (!st || st.finished) return;
  st.finished = true;
  const m = Math.floor(st.maxAlt / METER);
  const win = m >= WIN_ALT / METER;
  const stars = m >= STAR3_ALT / METER ? 3 : m >= STAR2_ALT / METER ? 2 : m >= WIN_ALT / METER ? 1 : 0;
  LR.G.finish({
    win: win,
    score: m,
    stars: stars,
    title: win ? 'HẠ CÁNH AN TOÀN!' : 'ĐỨT DÂY RỒI!',
    msg: win
      ? `Diều đã chạm đích ${WIN_ALT / METER}m và hạ cánh an toàn!`
      : `${st.whyText || 'Gặp sự cố'} — Diều chỉ lên được ${m}m. Cần ${WIN_ALT / METER}m để qua ải.`,
    rows: [
      ['Độ cao', m + 'm'],
      ['Mục tiêu', (WIN_ALT / METER) + 'm'],
      ['Sao tối đa', m >= STAR3_ALT / METER ? '3★' : (m >= STAR2_ALT / METER ? '2★' : '1★')]
    ]
  });
}

/* ================= UPDATE ================= */
function update(dt) {
  if (!st || LR.G.state !== 'play') return;
  st.time += dt;

  if (!musicBuilt) buildMusic();
  updateMusic();

  if (st.hintTimer > 0) st.hintTimer -= dt;
  if (st.goalBannerTimer > 0) st.goalBannerTimer -= dt;

  const prevCam = st.camY;

  if (st.state === 'play') {
    st.timeLeft -= dt;
    if (st.timeLeft <= 0) { st.timeLeft = 0; hitTimeout(); }

    if (st.gustDur > 0) {
      st.gustDur -= dt;
      st.kite.boost = Math.min(330, st.kite.boost + 1100 * dt);
      if (Math.random() < dt * 55) {
        st.streaks.push({
          x: st.gustDir > 0 ? -180 : W + 180,
          y: rand(0, H),
          len: rand(80, 230),
          spd: rand(750, 1450) * st.gustDir,
          a: rand(.07, .22), w: rand(1, 2.4)
        });
      }
    } else {
      st.gustT -= dt;
      if (st.gustT <= 0) {
        st.gustDur = rand(1.1, 2.0);
        st.gustT = rand(5.5, 10);
        st.gustDir = Math.random() < .5 ? -1 : 1;
        sfxGust();
      }
    }
    st.kite.boost = Math.max(0, st.kite.boost - 300 * dt);

    // Keyboard input (chỉ khi có phím mũi tên)
    if (st.keys.left || st.keys.right) {
      st.keyActive = true;
      const dir = (st.keys.right ? 1 : 0) - (st.keys.left ? 1 : 0);
      st.pointerX = clamp(st.pointerX + dir * 2875 * dt, 0, W);
    } else {
      st.keyActive = false;
    }
    const holding = st.pointerActive || st.keyActive;

    if (holding) st.kite.v = Math.min(MAX_V, st.kite.v + ACCEL * dt);
    else         st.kite.v = Math.max(BASE_V, st.kite.v - BRAKE * dt);

    if (holding) {
      const dx = st.pointerX - st.kite.x;
      const desired = clamp(dx * 9, -1400, 1400);
      st.kite.vx += (desired - st.kite.vx) * Math.min(1, 15 * dt);
    } else {
      st.kite.vx *= Math.max(0, 1 - dt * 6);
    }
    if (st.gustDur > 0) st.kite.vx += st.gustDir * 120 * dt;
    st.kite.x += st.kite.vx * dt;

    if (st.kite.x < 26) { st.kite.x = 26; st.kite.vx *= -0.2; }
    if (st.kite.x > W - 26) { st.kite.x = W - 26; st.kite.vx *= -0.2; }

    st.kite.tilt = lerp(st.kite.tilt, clamp(st.kite.vx / 1400, -1, 1) * 0.5, Math.min(1, 12 * dt));
    st.kite.wy += (st.kite.v + st.kite.boost) * dt;
    if (st.kite.wy > st.maxAlt) st.maxAlt = st.kite.wy;
    if (st.kite.inv > 0) st.kite.inv -= dt;

    // Goal reached
    if (!st.goalReached && st.kite.wy >= WIN_ALT) {
      st.goalReached = true;
      st.goalBannerTimer = 2.2;
      sfxChime();
      burstW(st.kite.x, st.kite.wy, 40, '#ffd166', 300);
      burstW(st.kite.x, st.kite.wy, 20, '#5ee8ff', 260);
      st.camShake = 12;
    }

    // Checkpoint
    if (st.kite.wy >= st.nextCheckpoint) {
      st.nextCheckpoint += CHECKPOINT_H;
      st.timeLeft = CHECKPOINT_T;
      burstW(st.kite.x, st.kite.wy, 22, '#ffd166', 220);
      burstW(st.kite.x, st.kite.wy, 14, '#5ee8ff', 240);
      st.camShake = Math.max(st.camShake, 5);
      sfxChime();
    }

    const camTarget = Math.max(-80, st.kite.wy - H * 0.35);
    st.camY += (camTarget - st.camY) * Math.min(1, 4.5 * dt);

    while (st.nextBranchY < st.camY + H * 1.8) {
      spawnBranch(st.nextBranchY);
      const diff = clamp(st.nextBranchY / 9000, 0, 1);
      st.nextBranchY += rand(285, 385) - 105 * diff;
    }
    st.branches = st.branches.filter(b => b.y > st.camY - 420);

    for (const b of st.branches) {
      if (Math.abs(st.kite.wy - b.y) < 26) {
        const gs = b.cx - b.gapW / 2 + 10;
        const ge = b.cx + b.gapW / 2 - 10;
        if (st.kite.x < gs || st.kite.x > ge) { hitBranch(); break; }
      }
    }

    st.nextCrowT -= dt;
    if (st.nextCrowT <= 0 && st.state === 'play') {
      spawnCrowFlock();
      st.nextCrowT = rand(3.2, 6.0) - 1.8 * clamp(st.camY / 9000, 0, 1);
    }
    for (const c of st.crows) {
      c.x += c.vx * dt;
      c.wy += c.vy * dt;
      c.ph += dt * 10;
      c.ttl -= dt;
    }
    st.crows = st.crows.filter(c => c.ttl > 0 && c.x > -180 && c.x < W + 180);

    if (st.kite.inv <= 0) {
      for (const c of st.crows) {
        const ddx = c.x - st.kite.x;
        const ddy = (c.wy - st.kite.wy) * 1.15;
        if (ddx * ddx + ddy * ddy < 52 * 52) { hitCrow(c); break; }
      }
    }
  }
  else if (st.state === 'dead') {
    st.deathT += dt;
    st.kite.vy -= GRAV * dt;
    st.kite.wy += st.kite.vy * dt;
    st.kite.x += st.kite.vx * dt;
    st.kite.vx *= 0.985;
    st.kite.spin += dt * 7;
    updateSnapTail(dt);
    if (st.deathT > 1.55) finishGame();
  }

  st.camShake = Math.max(0, st.camShake - 70 * dt);

  const camDelta = st.camY - prevCam;
  for (const c of st.clouds) {
    c.y += camDelta * 0.55 + c.sp * dt * 0.12;
    c.x += c.sp * dt * 0.25;
    if (c.y > H + 260) {
      c.y -= (H + 520);
      c.x = rand(-140, W + 140);
      c.s = rand(.5, 1.35);
    }
    if (c.x > W + 200) c.x = -160;
  }

  for (const p of st.particles) {
    p.t += dt;
    p.x += p.vx * dt;
    p.wy += p.vy * dt;
    p.vy -= 260 * dt;
    p.vx *= 0.99;
  }
  st.particles = st.particles.filter(p => p.t < p.life);

  for (const s of st.streaks) s.x += s.spd * dt;
  st.streaks = st.streaks.filter(s => s.x > -400 && s.x < W + 400);

  updateHUD();
}

/* ================= DRAW ================= */
function drawTimerBar(ctx) {
  if (!st) return;
  const topY = (LR.G.top || 0) + 6;
  const barW = Math.min(180, W * 0.4);
  const barH = 6;
  const barX = (W - barW) / 2;
  const barY = topY;
  ctx.fillStyle = 'rgba(255,255,255,0.18)';
  ctx.beginPath();
  ctx.roundRect(barX, barY, barW, barH, 3);
  ctx.fill();
  const pct = Math.max(0, st.timeLeft / CHECKPOINT_T);
  const isLow = st.timeLeft < 5;
  const g = ctx.createLinearGradient(barX, 0, barX + barW, 0);
  if (isLow) {
    g.addColorStop(0, '#ff5a4d'); g.addColorStop(1, '#c92a2a');
  } else {
    g.addColorStop(0, '#ffd166'); g.addColorStop(1, '#f0a93b');
  }
  ctx.fillStyle = g;
  ctx.beginPath();
  ctx.roundRect(barX, barY, barW * pct, barH, 3);
  ctx.fill();
}

function drawHint(ctx) {
  if (!st || st.hintTimer <= 0) return;
  const alpha = Math.min(1, st.hintTimer / 0.6);
  const text = st.pointerActive || st.keyActive ? 'Buông tay — diều chậm dần' : 'Giữ chạm và kéo ngang';
  ctx.save();
  ctx.globalAlpha = alpha;
  ctx.font = '600 13px "Be Vietnam Pro", sans-serif';
  const tw = ctx.measureText(text).width;
  const pad = 20, bh = 32, bw = tw + pad * 2;
  const bx = (W - bw) / 2, by = H - 80;
  ctx.fillStyle = 'rgba(10, 30, 50, 0.5)';
  ctx.beginPath();
  ctx.roundRect(bx, by, bw, bh, bh / 2);
  ctx.fill();
  ctx.fillStyle = '#fff';
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';
  ctx.fillText(text, W / 2, by + bh / 2);
  ctx.restore();
}

function drawGoalBanner(ctx) {
  if (!st || st.goalBannerTimer <= 0) return;
  const alpha = Math.min(1, st.goalBannerTimer / 0.3);
  ctx.save();
  ctx.globalAlpha = alpha;
  ctx.font = '900 40px "Be Vietnam Pro", sans-serif';
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';
  ctx.strokeStyle = '#0a1e32';
  ctx.lineWidth = 5;
  ctx.fillStyle = '#ffd166';
  ctx.strokeText('🎯 ĐÍCH!', W / 2, H * 0.4);
  ctx.fillText('🎯 ĐÍCH!', W / 2, H * 0.4);
  ctx.font = '600 14px "Be Vietnam Pro", sans-serif';
  ctx.strokeStyle = '#0a1e32';
  ctx.fillStyle = '#ffffff';
  ctx.strokeText('Tiếp tục bay để nhận thêm sao!', W / 2, H * 0.4 + 40);
  ctx.fillText('Tiếp tục bay để nhận thêm sao!', W / 2, H * 0.4 + 40);
  ctx.restore();
}

function draw() {
  const ctx = LR.G.ctx;
  if (!ctx || !st) return;
  ctx.setTransform(DPR, 0, 0, DPR, 0, 0);
  ctx.clearRect(0, 0, W, H);

  drawSky(ctx);
  drawGround(ctx);

  ctx.save();
  if (st.camShake > 0.3) {
    ctx.translate(rand(-st.camShake, st.camShake) * 0.6, rand(-st.camShake, st.camShake) * 0.6);
  }
  drawClouds(ctx);
  drawGroundDecor(ctx);
  drawCheckpoint(ctx);
  drawBranches(ctx);
  drawCrows(ctx);
  drawKite(ctx);
  drawParticles(ctx);
  drawStreaks(ctx);
  ctx.restore();

  drawTimerBar(ctx);
  drawHint(ctx);
  drawGoalBanner(ctx);
}

/* ================= INPUT ================= */
function onKeyDown(e) {
  if (!st || LR.G.state !== 'play') return;
  Sound.init();
  if (e.code === 'ArrowLeft' || e.code === 'KeyA') {
    st.keys.left = true;
    e.preventDefault();
    if (st.hintTimer > 0) st.hintTimer = 0.6;
  }
  if (e.code === 'ArrowRight' || e.code === 'KeyD') {
    st.keys.right = true;
    e.preventDefault();
    if (st.hintTimer > 0) st.hintTimer = 0.6;
  }
}
function onKeyUp(e) {
  if (!st) return;
  if (e.code === 'ArrowLeft' || e.code === 'KeyA') st.keys.left = false;
  if (e.code === 'ArrowRight' || e.code === 'KeyD') st.keys.right = false;
}

/* ================= MOD ================= */
const mod = {
  enter() {
    setupDims();
    reset();
    Sound.init();
    window.addEventListener('keydown', onKeyDown);
    window.addEventListener('keyup', onKeyUp);
    sfxLaunch();
  },
  exit() {
    window.removeEventListener('keydown', onKeyDown);
    window.removeEventListener('keyup', onKeyUp);
    destroyMusic();
    st = null;
  },
  resize() {
    setupDims();
    if (!st) return;
    st.kite.x = clamp(st.kite.x, 26, W - 26);
    st.pointerX = clamp(st.pointerX, 0, W);
    buildStars();
  },
  update(dt) { update(dt); },
  draw() { draw(); },
  pointerDown(x, y, e) {
    if (!st) return;
    Sound.init();
    if (st.state !== 'play') return;
    st.pointerActive = true;
    st.pointerX = clamp(x, 0, W);
    if (st.hintTimer > 0) st.hintTimer = 0.6;
  },
  pointerMove(x, y, e) {
    if (!st || !st.pointerActive) return;
    st.pointerX = clamp(x, 0, W);
  },
  pointerUp() {
    if (!st) return;
    st.pointerActive = false;
  },
  legend(el) {
    el.innerHTML = '<p class="note" style="margin:8px 0 0">' +
      '🪁 <b>Giữ chạm</b> hoặc <b>giữ phím mũi tên</b> để diều bay lên. ' +
      'Buông tay, diều chậm dần. Tránh <b>cành tre</b> và <b>quạ đen</b>. ' +
      'Đồng hồ hết = thua. Cứ mỗi 250m qua một <b>checkpoint</b> reset thời gian. ' +
      'Đạt <b>500m</b> để qua ải, 800m/1200m để thêm sao.</p>';
  }
};

/* ================= REGISTER ================= */
const LEVEL = {
  id: '19-tha-dieu',
  title: 'Thả Diều',
  desc: 'Giữ chạm để diều bay lên, né cành tre và quạ đen. Qua checkpoint để thêm thời gian. Đạt 500m để qua ải!',
  rules: [
    'Giữ chạm hoặc giữ phím mũi tên để diều bay lên, buông ra để diều chậm dần',
    'Tránh <b>cành tre</b> — chạm là đứt dây',
    'Tránh <b>quạ đen</b> — chạm bị đẩy lùi và giảm tốc',
    'Đồng hồ chạy ngược — hết thời gian là thua',
    'Qua mỗi 250m có <b>checkpoint</b> để nạp lại thời gian',
    'Đạt <b>500m</b> để qua ải · 800m = 2 sao · 1200m = 3 sao'
  ],
  status: 'ready',
  pad: false,
  actLabel: 'BAY',
  mod
};

if (typeof LR.registerLevel === 'function') {
  LR.registerLevel('ch1', LEVEL);
} else {
  const ch = (LR.chapters || []).find(c => c.id === 'ch1');
  if (ch) {
    if (!ch.levels) ch.levels = [];
    const idx = ch.levels.findIndex(l => l && l.id === LEVEL.id);
    if (idx >= 0) ch.levels[idx] = LEVEL;
    else ch.levels.push(LEVEL);
  }
}
})();
