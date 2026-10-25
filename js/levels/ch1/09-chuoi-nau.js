/* js/levels/ch1/18-tim-chuoi.js — Ải 18: Tìm Chuối, Tránh Chó */
(function(){
'use strict';
const LR = window.LR;
const Sound = LR.Sound;
const {clamp} = LR.util;

/* ================= CONFIG ================= */
// minPath: độ dài đường ngắn nhất tối thiểu (số bước)
// minTort: tỉ lệ tortuosity = path/manhattan tối thiểu (đường ngoằn ngoèo)
const LEVELS = [
  { w: 5, h: 5, dogs: 7,  memo: 5,  minPath: 5,  minTort: 1.3 },
  { w: 7, h: 5, dogs: 12, memo: 7,  minPath: 7,  minTort: 1.5 },
  { w: 6, h: 8, dogs: 17, memo: 9,  minPath: 9,  minTort: 1.7 },
  { w: 8, h: 6, dogs: 20, memo: 11, minPath: 11, minTort: 1.9 }
];
const LIVES = 3;
const MOVE_T = 0.1;
const GRAB_RADIUS = 1.5; // số ô quanh player được phép bắt đầu kéo
const INK = '#2a1a12';
const D4 = [[1,0],[-1,0],[0,1],[0,-1]];

/* ================= HELPERS ================= */
const rand = (a,b) => a + Math.random()*(b-a);
const hz = m => 440 * Math.pow(2, (m-69)/12);
const clamp2 = (v,a,b) => Math.max(a, Math.min(b, v));
const easeOutBack = t => { const c1 = 1.70158, c3 = c1 + 1; return 1 + c3 * Math.pow(t-1,3) + c1 * Math.pow(t-1,2); };
const fmtTime = s => { s = Math.floor(s); return Math.floor(s/60) + ':' + String(s%60).padStart(2,'0'); };
function shuffle(a) { for (let i = a.length-1; i > 0; i--) { const j = Math.floor(Math.random()*(i+1)); [a[i],a[j]]=[a[j],a[i]]; } return a; }

/* ================= SOUND ================= */
function sndClick()      { Sound.sfx.click(); }
function sndStep()       { Sound.tone('sine', 220, 160, 0.05, 0.08); Sound.noise(0.03, 0.08, 'bandpass', 900, 900, 0, 1); }
function sndBump()       { Sound.sfx.thud(); }
function sndPop(p, d)    { p = p||1; d = d||0; Sound.tone('sine', 420*p, 900*p, 0.09, 0.18, d); }
function sndWhoosh()     { Sound.noise(0.4, 0.2, 'bandpass', 300, 3000, 0, 0.8); }
function sndTick(strong) { Sound.tone('square', strong ? 1600 : 1200, strong ? 1600 : 1200, 0.04, 0.12); }
function sndBark(delay, p) {
  delay = delay||0; p = p||1;
  Sound.tone('sawtooth', 620*p, 240*p, 0.16, 0.26, delay);
  Sound.tone('square', 310*p, 120*p, 0.14, 0.07, delay);
  Sound.noise(0.12, 0.16, 'bandpass', 1400, 700, delay, 1.2);
}
function sndHurt()       { sndBark(0, 1); sndBark(0.2, 0.88); Sound.tone('triangle', 330, 130, 0.4, 0.16, 0.1); }
function sndFail()       { [67,64,60,55].forEach((m,i) => Sound.tone('triangle', hz(m), hz(m)*0.97, 0.26, 0.2, 0.15 + i*0.2)); }
function sndMunch()      { for (let i = 0; i < 3; i++) { Sound.noise(0.07, 0.25, 'lowpass', 900, 900, i*0.12, 1); Sound.tone('sine', 140, 90, 0.08, 0.18, i*0.12); } }
function sndBell(m, delay, v) {
  v = v||1; delay = delay||0;
  const f = hz(m);
  Sound.tone('sine', f, f, 0.6, 0.15*v, delay);
  Sound.tone('sine', f*2.01, f*2.01, 0.3, 0.05*v, delay);
}
function sndWin()     { [72,76,79,84].forEach((m,i) => sndBell(m, 0.45 + i*0.09)); }
function sndVictory() { [72,72,76,79,84,79,84,88].forEach((m,i) => sndBell(m, 0.1 + i*0.13, 1.1)); Sound.noise(1.2, 0.1, 'highpass', 4000, 4000, 0.5, 1); }
function sndCommit()  { Sound.tone('sine', 660, 880, 0.09, 0.12); Sound.tone('triangle', 440, 660, 0.12, 0.06, 0.02); }
function sndInvalid() { Sound.tone('triangle', 200, 140, 0.15, 0.15); }
function sndGrab()    { Sound.tone('sine', 520, 700, 0.06, 0.1); }

/* ================= STATE ================= */
let st = null;
let geo = null;

function createInitialState() {
  return {
    nW: 5, nH: 5,
    dogs: [], rank: [], start: 0, banana: 0,
    cx: 0, cy: 0,
    mv: null,
    dragging: false,
    grabPoint: null,
    targetCell: null,
    previewPath: null,
    path: null,
    nudge: null, face: 1,
    lives: LIVES, steps: 0, levelTime: 0,
    totalSteps: 0, totalTime: 0, totalLives: 0,
    li: 0,
    t: 0, memoT: 0, memoLeft: 0, lastTick: 99,
    hideT: 0, popT: 0, hurtT: 0, winT: 0, failT: 0,
    phase: 'memo',
    visited: [], revealed: [],
    shake: 0, parts: [],
    ovShown: false, hit: -1,
    msg: '', skipBtnRect: null,
    hintTimer: 0
  };
}

/* ================= MAP GENERATION ================= */
function bfsDist(src, dogs, W, H) {
  const dist = new Array(W*H).fill(-1), q = [src];
  dist[src] = 0;
  for (let h = 0; h < q.length; h++) {
    const cur = q[h], x = cur % W, y = (cur / W) | 0;
    for (const [dx, dy] of D4) {
      const nx = x+dx, ny = y+dy;
      if (nx < 0 || ny < 0 || nx >= W || ny >= H) continue;
      const j = ny*W + nx;
      if (dogs[j] || dist[j] >= 0) continue;
      dist[j] = dist[cur] + 1;
      q.push(j);
    }
  }
  return dist;
}

// Đặt chó theo cụm để tạo hành lang / vật cản có hình khối
function placeDogsClustered(L) {
  const W = L.w, H = L.h, N = W * H;
  const dogs = new Array(N).fill(false);
  const maxDogs = Math.min(L.dogs, N - 10);
  let placed = 0;
  let safety = 0;

  while (placed < maxDogs && safety < 400) {
    safety++;
    const useCluster = Math.random() < 0.6 && placed < maxDogs - 2;

    if (useCluster) {
      const cx = Math.floor(Math.random() * W);
      const cy = Math.floor(Math.random() * H);
      const shape = Math.random();

      if (shape < 0.5) {
        // Đoạn thẳng 2-4 ô
        const len = 2 + Math.floor(Math.random() * 3);
        const horiz = Math.random() < 0.5;
        for (let k = 0; k < len && placed < maxDogs; k++) {
          const x = horiz ? cx + k : cx;
          const y = horiz ? cy : cy + k;
          if (x >= 0 && x < W && y >= 0 && y < H && !dogs[y*W + x]) {
            dogs[y*W + x] = true; placed++;
          }
        }
      } else {
        // Cụm 2-3 ô kề cận
        const size = 2 + Math.floor(Math.random() * 2);
        for (let k = 0; k < size && placed < maxDogs; k++) {
          const dx = Math.floor(Math.random() * 3) - 1;
          const dy = Math.floor(Math.random() * 3) - 1;
          const x = cx + dx, y = cy + dy;
          if (x >= 0 && x < W && y >= 0 && y < H && !dogs[y*W + x]) {
            dogs[y*W + x] = true; placed++;
          }
        }
      }
    } else {
      const i = Math.floor(Math.random() * N);
      if (!dogs[i]) { dogs[i] = true; placed++; }
    }
  }

  return dogs;
}

function tryGenConfig(L) {
  const W = L.w, H = L.h, N = W * H;
  const dogs = placeDogsClustered(L);
  const free = [];
  for (let i = 0; i < N; i++) if (!dogs[i]) free.push(i);
  if (free.length < 8) return null;
  shuffle(free);

  let best = null, bestScore = -1;

  for (const s of free.slice(0, 12)) {
    const dist = bfsDist(s, dogs, W, H);
    const sx = s % W, sy = (s / W) | 0;

    for (const b of free) {
      if (b === s) continue;
      const d = dist[b];
      if (d < L.minPath) continue;

      const bx = b % W, by = (b / W) | 0;
      const manhattan = Math.abs(sx - bx) + Math.abs(sy - by);
      if (manhattan === 0) continue;
      const tort = d / manhattan;

      if (tort < L.minTort) continue;

      // Ưu tiên cấu hình có tortuosity cao + đường đủ dài
      const score = tort * 10 + d;
      if (score > bestScore) {
        bestScore = score;
        best = { dogs: dogs.slice(), start: s, banana: b };
      }
    }
  }

  return best;
}

function genLevel(L) {
  // Thử với tiêu chí đầy đủ
  for (let attempt = 0; attempt < 180; attempt++) {
    const cfg = tryGenConfig(L);
    if (cfg) {
      const order = shuffle(cfg.dogs.map((d, i) => d ? i : -1).filter(i => i >= 0));
      const rank = new Array(L.w*L.h).fill(0);
      order.forEach((i, k) => rank[i] = k);
      return { dogs: cfg.dogs, rank, start: cfg.start, banana: cfg.banana };
    }
  }

  // Nới lỏng tiêu chí
  const relaxed = {
    ...L,
    minPath: Math.max(4, Math.floor(L.minPath * 0.7)),
    minTort: Math.max(1.1, L.minTort * 0.7)
  };
  for (let attempt = 0; attempt < 150; attempt++) {
    const cfg = tryGenConfig(relaxed);
    if (cfg) {
      const order = shuffle(cfg.dogs.map((d, i) => d ? i : -1).filter(i => i >= 0));
      const rank = new Array(L.w*L.h).fill(0);
      order.forEach((i, k) => rank[i] = k);
      return { dogs: cfg.dogs, rank, start: cfg.start, banana: cfg.banana };
    }
  }

  // Fallback cuối
  const W = L.w, H = L.h, N = W * H;
  for (let attempt = 0; attempt < 300; attempt++) {
    const dogs = new Array(N).fill(false);
    let placed = 0;
    while (placed < L.dogs && placed < N - 6) {
      const i = Math.floor(Math.random() * N);
      if (!dogs[i]) { dogs[i] = true; placed++; }
    }
    const free = [];
    for (let i = 0; i < N; i++) if (!dogs[i]) free.push(i);
    shuffle(free);
    for (const s of free.slice(0, 10)) {
      const dist = bfsDist(s, dogs, W, H);
      const cand = free.filter(i => dist[i] >= 3);
      if (cand.length) {
        const b = cand[Math.floor(Math.random() * cand.length)];
        const order = shuffle(dogs.map((d, i) => d ? i : -1).filter(i => i >= 0));
        const rank = new Array(N).fill(0);
        order.forEach((i, k) => rank[i] = k);
        return { dogs, rank, start: s, banana: b };
      }
    }
  }

  const dogs = new Array(N).fill(false);
  const rank = new Array(N).fill(0);
  return { dogs, rank, start: 0, banana: N-1 };
}

/* ================= GAME FLOW ================= */
function startLevel(li) {
  st.li = li;
  const L = LEVELS[li];
  const gen = genLevel(L);
  st.nW = L.w;
  st.nH = L.h;
  st.dogs = gen.dogs;
  st.rank = gen.rank;
  st.start = gen.start;
  st.banana = gen.banana;
  st.cx = gen.start % L.w;
  st.cy = (gen.start / L.w) | 0;
  st.mv = null;
  st.dragging = false;
  st.grabPoint = null;
  st.targetCell = null;
  st.previewPath = null;
  st.path = null;
  st.nudge = null;
  st.face = 1;
  st.lives = LIVES;
  st.steps = 0;
  st.levelTime = 0;
  // KHÔNG đánh dấu start là visited → tránh lộ vị trí trong memo
  st.visited = new Array(L.w*L.h).fill(false);
  st.revealed = new Array(L.w*L.h).fill(0);
  st.memoT = 0;
  st.memoLeft = L.memo;
  st.lastTick = 99;
  st.hideT = 0;
  st.popT = 0;
  st.hurtT = 0;
  st.winT = 0;
  st.failT = 0;
  st.shake = 0;
  st.parts = [];
  st.ovShown = false;
  st.hit = -1;
  st.hintTimer = 0;
  st.phase = 'memo';
  computeLayout();
  for (let k = 0; k < Math.min(L.dogs, 10); k++) sndPop(0.8 + k*0.08, 0.05 + k*0.05);
  setMsg('👀 Ghi nhớ vị trí ' + L.dogs + ' chú chó! Sắp ẩn rồi…');
  updateHUD();
}

function endMemo() {
  if (st.phase !== 'memo') return;
  st.phase = 'hide';
  st.hideT = 0;
  sndWhoosh();
  setMsg('🐕 Chó trốn mất rồi…');
}

function beginPlay() {
  st.phase = 'play';
  st.popT = 0;
  // Đánh dấu start visited tại thời điểm bắt đầu chơi
  st.visited[st.cy * st.nW + st.cx] = true;
  sndPop(1.1); sndPop(1.5, 0.1);
  setMsg('👆 Chạm vào nhân vật rồi kéo để vẽ đường — nhả tay để đi!');
}

function doStep(nx, ny) {
  st.mv = { fx: st.cx, fy: st.cy, t: 0 };
  st.cx = nx;
  st.cy = ny;
  st.steps++;
  if (nx !== st.mv.fx) st.face = nx > st.mv.fx ? 1 : -1;
  sndStep();
}

function arrive() {
  const i = st.cy * st.nW + st.cx;
  if (st.dogs[i]) { hit(i); return; }
  st.visited[i] = true;
  if (i === st.banana) winLevel();
}

function hit(i) {
  st.revealed[i] = st.t;
  st.hit = i;
  st.lives--;
  st.phase = 'hurt';
  st.hurtT = 0;
  st.shake = 0.4;
  st.dragging = false;
  st.grabPoint = null;
  st.targetCell = null;
  st.previewPath = null;
  st.path = null;
  st.mv = null;
  sndHurt();
  setMsg('🐶 Gâu gâu! Bạn giẫm phải chó — mất 1 mạng!');
  const c = cellCenter(i);
  for (let k = 0; k < 10; k++) addPart(c.x, c.y, '#ef7a8a', 120);
  updateHUD();
}

function afterHurt() {
  if (st.lives > 0) {
    st.cx = st.start % st.nW;
    st.cy = (st.start / st.nW) | 0;
    st.mv = null;
    st.path = null;
    st.hit = -1;
    st.visited[st.cy * st.nW + st.cx] = true;
    st.phase = 'play';
    sndPop(0.9);
    setMsg('Quay lại điểm xuất phát. Còn ' + st.lives + ' mạng — nhớ các ô chó đã lộ!');
  } else {
    st.phase = 'fail';
    st.failT = 0;
    sndFail();
    setMsg('💔 Hết mạng! Chó lộ diện! Đang sang bản đồ mới…');
  }
}

function winLevel() {
  st.phase = 'win';
  st.winT = 0;
  st.path = null;
  st.previewPath = null;
  st.dragging = false;
  sndMunch();
  setTimeout(() => sndWin(), 300);
  const c = cellCenter(st.banana);
  for (let k = 0; k < 46; k++) {
    addPart(c.x, c.y, ['#f4d03f','#4f8a4b','#c2412d','#f2ecde'][k%4], 260, true);
  }
  setMsg('😋 Ngon quá! Tới nải chuối rồi!');
}

function onLevelWin() {
  st.totalSteps += st.steps;
  st.totalTime += st.levelTime;
  st.totalLives += st.lives;

  if (st.li === LEVELS.length - 1) {
    const avgLives = st.totalLives / LEVELS.length;
    const stars = avgLives >= 2.5 ? 3 : avgLives >= 1.5 ? 2 : 1;
    const score = Math.max(100, Math.floor(
      st.totalLives * 500 - st.totalSteps * 3 - st.totalTime * 5 + 5000
    ));
    sndVictory();
    LR.G.finish({
      win: true,
      score: score,
      stars: stars,
      title: 'CHINH PHỤC CẢ 4 CẤP!',
      msg: 'Bạn đã tìm thấy tất cả nải chuối và tránh được mọi chú chó!',
      rows: [
        ['Tổng bước', st.totalSteps],
        ['Tổng thời gian', fmtTime(st.totalTime)],
        ['Mạng còn lại', st.totalLives + '/' + (LEVELS.length * LIVES)],
        ['Điểm', score]
      ]
    });
  } else {
    sndWin();
    setMsg('🏆 Cấp ' + (st.li+1) + ' hoàn thành! Chuyển sang cấp ' + (st.li+2) + '…');
    const nextLi = st.li + 1;
    setTimeout(() => {
      if (st && st.phase === 'win' && st.li === nextLi - 1) startLevel(nextLi);
    }, 1500);
  }
}

/* ================= BFS PATH ================= */
function bfsPath(startIdx, endIdx) {
  const W = st.nW, H = st.nH;
  if (startIdx === endIdx) return [];
  const prev = new Map();
  const visited = new Set([startIdx]);
  const q = [startIdx];
  for (let h = 0; h < q.length; h++) {
    const cur = q[h];
    if (cur === endIdx) {
      const path = [];
      let c = cur;
      while (c !== startIdx) { path.unshift(c); c = prev.get(c); }
      return path;
    }
    const x = cur % W, y = (cur / W) | 0;
    for (const [dx, dy] of D4) {
      const nx = x + dx, ny = y + dy;
      if (nx < 0 || ny < 0 || nx >= W || ny >= H) continue;
      const ni = ny * W + nx;
      if (visited.has(ni)) continue;
      if (st.revealed[ni]) continue;
      visited.add(ni);
      prev.set(ni, cur);
      q.push(ni);
    }
  }
  return null;
}

function computePreviewPath() {
  if (!st.targetCell) { st.previewPath = null; return; }
  const startIdx = st.cy * st.nW + st.cx;
  const endIdx = st.targetCell.cy * st.nW + st.targetCell.cx;
  if (startIdx === endIdx) { st.previewPath = []; return; }
  st.previewPath = bfsPath(startIdx, endIdx);
}

function tryNextStep() {
  if (!st.path || st.path.length === 0) { st.path = null; return; }
  const nextIdx = st.path.shift();
  const nx = nextIdx % st.nW;
  const ny = (nextIdx / st.nW) | 0;
  doStep(nx, ny);
}

/* ================= LAYOUT ================= */
function computeLayout() {
  const G = LR.G;
  const W = G.W, H = G.H;
  const top = G.top || 0;
  const pad = 8;
  const availW = W - pad * 2;
  const availH = H - top - pad * 2 - 100;
  const cs = Math.max(10, Math.min(availW / st.nW, availH / st.nH));
  const boardW = cs * st.nW;
  const boardH = cs * st.nH;
  const bx = (W - boardW) / 2;
  const by = top + pad + Math.max(0, (availH - boardH) / 2);
  geo = { cs, bx, by, boardW, boardH };
}

function cellCenter(i) {
  const x = i % st.nW, y = (i / st.nW) | 0;
  return { x: geo.bx + (x + 0.5) * geo.cs, y: geo.by + (y + 0.5) * geo.cs };
}

function screenToCell(x, y) {
  if (!geo) return null;
  const cx = Math.floor((x - geo.bx) / geo.cs);
  const cy = Math.floor((y - geo.by) / geo.cs);
  if (cx < 0 || cy < 0 || cx >= st.nW || cy >= st.nH) return null;
  return { cx, cy };
}

function playerPos() {
  let fx = st.cx, fy = st.cy;
  if (st.mv) {
    const k = clamp2(st.mv.t / MOVE_T, 0, 1);
    fx = st.mv.fx + (st.cx - st.mv.fx) * k;
    fy = st.mv.fy + (st.cy - st.mv.fy) * k;
  }
  let nx = 0, ny = 0;
  if (st.nudge) {
    const k = Math.sin(clamp2(st.nudge.t / 0.14, 0, 1) * Math.PI);
    nx = st.nudge.dx * k * 0.12;
    ny = st.nudge.dy * k * 0.12;
  }
  return { x: geo.bx + (fx + 0.5 + nx) * geo.cs, y: geo.by + (fy + 0.5 + ny) * geo.cs };
}

/* ================= PARTICLES ================= */
function addPart(x, y, col, sp, grav) {
  const a = rand(0, 6.283), s = rand(0.3, 1) * sp;
  st.parts.push({
    x, y,
    vx: Math.cos(a) * s,
    vy: Math.sin(a) * s - (grav ? sp * 0.5 : 0),
    rot: rand(0, 6.283), vr: rand(-8, 8),
    t: 0, life: rand(0.7, 1.3),
    col, grav: !!grav, sz: rand(3, 6)
  });
}

/* ================= UPDATE ================= */
function update(dt) {
  if (!st || LR.G.state !== 'play') return;

  st.t += dt;
  if (st.shake > 0) st.shake = Math.max(0, st.shake - dt);
  if (st.nudge) {
    st.nudge.t += dt;
    if (st.nudge.t > 0.14) st.nudge = null;
  }
  if (st.hintTimer > 0) {
    st.hintTimer -= dt;
    if (st.hintTimer <= 0 && st.phase === 'play') {
      setMsg('👆 Chạm vào nhân vật rồi kéo để vẽ đường — nhả tay để đi!');
    }
  }

  for (let i = st.parts.length - 1; i >= 0; i--) {
    const p = st.parts[i];
    p.t += dt;
    p.x += p.vx * dt;
    p.y += p.vy * dt;
    p.vx *= 0.98;
    p.vy = p.vy * 0.98 + (p.grav ? 420 : 0) * dt;
    p.rot += p.vr * dt;
    if (p.t >= p.life) st.parts.splice(i, 1);
  }

  switch (st.phase) {
    case 'memo': {
      st.memoT += dt;
      st.memoLeft -= dt;
      const c = Math.ceil(st.memoLeft);
      if (st.memoLeft <= 3 && c < st.lastTick && c >= 1) {
        st.lastTick = c;
        sndTick(c === 1);
      }
      if (st.memoLeft <= 0) endMemo();
      break;
    }
    case 'hide':
      st.hideT += dt;
      if (st.hideT >= 0.6) beginPlay();
      break;
    case 'play':
      st.popT += dt;
      st.levelTime += dt;
      if (st.mv) {
        st.mv.t += dt;
        if (st.mv.t >= MOVE_T) {
          st.mv = null;
          arrive();
        }
      }
      // Chỉ đi khi: đã commit path VÀ không đang kéo
      if (st.phase === 'play' && !st.mv && !st.dragging && st.path) {
        tryNextStep();
      }
      break;
    case 'hurt':
      st.hurtT += dt;
      st.levelTime += dt;
      if (st.hurtT >= 1) afterHurt();
      break;
    case 'win':
      st.winT += dt;
      if (st.winT > 1.5 && !st.ovShown) {
        st.ovShown = true;
        onLevelWin();
      }
      break;
    case 'fail':
      st.failT += dt;
      if (st.failT > 2.5) startLevel(st.li);
      break;
  }
  updateHUD();
}

function updateHUD() {
  if (!st) return;
  const L = LEVELS[st.li];
  LR.G.hud.set([
    { l: 'Cấp', v: (st.li + 1) + '/' + LEVELS.length },
    { l: 'Mạng', v: '❤️'.repeat(Math.max(0, st.lives)) + '🖤'.repeat(LIVES - Math.max(0, st.lives)) },
    { l: 'Bước', v: st.steps }
  ]);
}

/* ================= RENDER ================= */
function roundRect(ctx, x, y, w, h, r) {
  if (ctx.roundRect) { ctx.beginPath(); ctx.roundRect(x, y, w, h, r); return; }
  ctx.beginPath();
  ctx.moveTo(x+r, y); ctx.lineTo(x+w-r, y); ctx.arcTo(x+w, y, x+w, y+r, r);
  ctx.lineTo(x+w, y+h-r); ctx.arcTo(x+w, y+h, x+w-r, y+h, r);
  ctx.lineTo(x+r, y+h); ctx.arcTo(x, y+h, x, y+h-r, r);
  ctx.lineTo(x, y+r); ctx.arcTo(x, y, x+r, y, r);
  ctx.closePath();
}
function ell(ctx, x, y, rx, ry, fill, lw, rot) {
  ctx.beginPath();
  ctx.ellipse(x, y, Math.max(0.1, rx), Math.max(0.1, ry), rot || 0, 0, 6.283);
  if (fill) { ctx.fillStyle = fill; ctx.fill(); }
  if (lw) { ctx.strokeStyle = INK; ctx.lineWidth = lw; ctx.stroke(); }
}
function hash(i) {
  let x = (i * 2654435761) >>> 0;
  x ^= x >>> 15;
  x = Math.imul(x, 2246822519) >>> 0;
  return ((x ^ (x >>> 13)) >>> 0) / 4294967296;
}

function dogScale(i) {
  if (st.revealed[i]) return easeOutBack(clamp2((st.t - st.revealed[i]) / 0.3, 0, 1));
  if (!st.dogs[i]) return 0;
  if (st.phase === 'memo') return easeOutBack(clamp2((st.memoT - Math.min(st.rank[i] * 0.05, 1.2)) / 0.35, 0, 1));
  if (st.phase === 'hide') { const k = clamp2(st.hideT / 0.45, 0, 1); return 1 - k * k; }
  if (st.phase === 'fail') return easeOutBack(clamp2((st.failT - 0.3 - Math.min(st.rank[i] * 0.04, 1)) / 0.3, 0, 1));
  return 0;
}

function drawDog(ctx, x, y, u, sc, angry) {
  if (sc <= 0.01) return;
  ctx.save();
  ctx.translate(x, y);
  ctx.scale(u * sc, u * sc);
  ctx.lineJoin = 'round';
  ell(ctx, -27, -14, 11, 20, '#8a5a3c', 2.4, 0.45);
  ell(ctx,  27, -14, 11, 20, '#8a5a3c', 2.4, -0.45);
  ell(ctx, 0, 0, 31, 29, '#d9a066', 2.6);
  ell(ctx, 0, 11, 19, 14, '#f3dcb8', 2);
  ell(ctx, -11, -7, 4.2, 4.6, INK);
  ell(ctx,  11, -7, 4.2, 4.6, INK);
  ell(ctx, -9.8, -8.4, 1.4, 1.4, '#fff');
  ell(ctx, 12.2, -8.4, 1.4, 1.4, '#fff');
  if (angry) {
    ctx.strokeStyle = INK; ctx.lineWidth = 3; ctx.lineCap = 'round';
    ctx.beginPath();
    ctx.moveTo(-18, -17); ctx.lineTo(-5, -12);
    ctx.moveTo(18, -17); ctx.lineTo(5, -12);
    ctx.stroke();
  }
  ell(ctx, 0, 4, 6.5, 4.8, INK);
  ctx.strokeStyle = INK; ctx.lineWidth = 2; ctx.lineCap = 'round';
  ctx.beginPath();
  ctx.moveTo(0, 8); ctx.lineTo(0, 13);
  if (angry) { ctx.moveTo(-8, 19); ctx.quadraticCurveTo(0, 12, 8, 19); }
  else       { ctx.moveTo(-8, 14); ctx.quadraticCurveTo(0, 21, 8, 14); }
  ctx.stroke();
  if (!angry) ell(ctx, 0, 21, 5.5, 7.5, '#ef7a8a', 1.8);
  ctx.restore();
}

function drawBanana(ctx, x, y, u, sc) {
  if (sc <= 0.01) return;
  ctx.save();
  ctx.translate(x, y + Math.sin(st.t * 3.2) * 3 * u);
  ctx.rotate(-0.45);
  const s = u * sc * 70;
  ctx.scale(s, s);
  ctx.lineJoin = 'round';
  ctx.fillStyle = 'rgba(0,0,0,.18)';
  ctx.beginPath(); ctx.ellipse(0.05, 0.62, 0.5, 0.09, 0, 0, 6.283); ctx.fill();
  ctx.beginPath();
  ctx.moveTo(-0.55, -0.2);
  ctx.quadraticCurveTo(0, 0.9, 0.55, -0.2);
  ctx.quadraticCurveTo(0, 0.35, -0.55, -0.2);
  ctx.closePath();
  ctx.fillStyle = '#f4d03f'; ctx.fill();
  ctx.strokeStyle = INK; ctx.lineWidth = 0.045; ctx.stroke();
  ctx.strokeStyle = 'rgba(255,255,255,.55)'; ctx.lineWidth = 0.04; ctx.lineCap = 'round';
  ctx.beginPath(); ctx.moveTo(-0.38, -0.02); ctx.quadraticCurveTo(0, 0.55, 0.38, -0.02); ctx.stroke();
  ctx.fillStyle = '#7a4a2b'; ctx.beginPath(); ctx.rect(-0.62, -0.34, 0.14, 0.2); ctx.fill();
  ctx.lineWidth = 0.04; ctx.strokeStyle = INK; ctx.stroke();
  ctx.fillStyle = INK; ctx.beginPath(); ctx.arc(0.56, -0.21, 0.045, 0, 6.283); ctx.fill();
  ctx.restore();
}

function drawPlayer(ctx, x, y, u, sc, dizzy, joy) {
  if (sc <= 0.01) return;
  const moving = st.mv ? Math.sin(clamp2(st.mv.t / MOVE_T, 0, 1) * Math.PI) * 9 : 0;
  const bob = (st.phase === 'win' ? -Math.abs(Math.sin(st.t * 9)) * 8 : Math.sin(st.t * 3) * 1.6) - moving;
  ctx.save();
  ctx.translate(x, y);
  ctx.scale(u * sc * 0.82 * st.face, u * sc * 0.82);
  ctx.lineJoin = 'round'; ctx.lineCap = 'round';
  ell(ctx, 0, 40, 22, 6, 'rgba(0,0,0,.2)');
  ctx.translate(0, bob);
  ctx.strokeStyle = INK; ctx.lineWidth = 4;
  ctx.beginPath();
  ctx.moveTo(-7, 24); ctx.lineTo(-7, 36);
  ctx.moveTo(7, 24);  ctx.lineTo(7, 36);
  ctx.stroke();
  roundRect(ctx, -16, -4, 32, 30, 8);
  ctx.fillStyle = '#c2412d'; ctx.fill();
  ctx.lineWidth = 2.6; ctx.stroke();
  ctx.fillStyle = '#e8b93c';
  for (let k = 0; k < 3; k++) { ctx.beginPath(); ctx.arc(0, 2 + k*8, 1.7, 0, 6.283); ctx.fill(); }
  ctx.strokeStyle = '#f0c48f'; ctx.lineWidth = 5;
  ctx.beginPath();
  if (joy) { ctx.moveTo(-14,2); ctx.lineTo(-22,-16); ctx.moveTo(14,2); ctx.lineTo(22,-16); }
  else     { ctx.moveTo(-14,4); ctx.lineTo(-20,16);  ctx.moveTo(14,4); ctx.lineTo(20,16); }
  ctx.stroke();
  ell(ctx, 0, -18, 17, 16, '#f0c48f', 2.6);
  ell(ctx, -9, -12, 3.4, 2.2, 'rgba(239,122,138,.6)');
  ell(ctx,  9, -12, 3.4, 2.2, 'rgba(239,122,138,.6)');
  if (dizzy) {
    ctx.strokeStyle = INK; ctx.lineWidth = 2;
    ctx.beginPath();
    ctx.moveTo(-10,-22); ctx.lineTo(-4,-16); ctx.moveTo(-4,-22); ctx.lineTo(-10,-16);
    ctx.moveTo(4,-22);   ctx.lineTo(10,-16); ctx.moveTo(10,-22);  ctx.lineTo(4,-16);
    ctx.stroke();
  } else {
    ctx.fillStyle = INK;
    ctx.beginPath(); ctx.arc(-6,-18,2.3,0,6.283); ctx.arc(6,-18,2.3,0,6.283); ctx.fill();
  }
  ctx.strokeStyle = INK; ctx.lineWidth = 2;
  ctx.beginPath();
  if (dizzy) { ctx.moveTo(-4,-8); ctx.quadraticCurveTo(0,-12,4,-8); }
  else       { ctx.moveTo(-5,-9); ctx.quadraticCurveTo(0,-4,5,-9); }
  ctx.stroke();
  ctx.beginPath();
  ctx.moveTo(0,-60); ctx.quadraticCurveTo(-8,-40,-36,-28);
  ctx.quadraticCurveTo(0,-20,36,-28); ctx.quadraticCurveTo(8,-40,0,-60);
  ctx.closePath();
  ctx.fillStyle = '#e8d29a'; ctx.fill();
  ctx.lineWidth = 2.6; ctx.strokeStyle = INK; ctx.stroke();
  ctx.lineWidth = 1.2; ctx.strokeStyle = 'rgba(122,74,43,.6)';
  for (const k of [-0.55,-0.2,0.2,0.55]) {
    ctx.beginPath(); ctx.moveTo(0,-58); ctx.lineTo(k*62,-27); ctx.stroke();
  }
  ctx.strokeStyle = '#c2412d'; ctx.lineWidth = 2;
  ctx.beginPath();
  ctx.moveTo(-15,-22); ctx.lineTo(-11,-8);
  ctx.moveTo(15,-22);  ctx.lineTo(11,-8);
  ctx.stroke();
  ctx.restore();
}

/* ---- HIỆU ỨNG ĐƯỜNG ĐI ---- */
function drawPathPreview(ctx) {
  if (!st.dragging || st.phase !== 'play') return;
  const cs = geo.cs;

  if (!st.previewPath) {
    if (st.targetCell) {
      // BFS thất bại: vẽ vòng đỏ + dấu X
      const c = cellCenter(st.targetCell.cy * st.nW + st.targetCell.cx);
      const pulse = 0.5 + 0.5 * Math.sin(st.t * 8);
      ctx.save();
      ctx.strokeStyle = 'rgba(200, 40, 30, ' + (0.5 + pulse * 0.4) + ')';
      ctx.lineWidth = Math.max(2, cs * 0.06);
      ctx.setLineDash([cs * 0.12, cs * 0.1]);
      ctx.beginPath();
      ctx.arc(c.x, c.y, cs * 0.34, 0, Math.PI * 2);
      ctx.stroke();
      ctx.setLineDash([]);
      ctx.strokeStyle = 'rgba(200, 40, 30, 0.85)';
      ctx.lineWidth = Math.max(2.5, cs * 0.07);
      ctx.lineCap = 'round';
      ctx.beginPath();
      ctx.moveTo(c.x - cs * 0.14, c.y - cs * 0.14);
      ctx.lineTo(c.x + cs * 0.14, c.y + cs * 0.14);
      ctx.moveTo(c.x + cs * 0.14, c.y - cs * 0.14);
      ctx.lineTo(c.x - cs * 0.14, c.y + cs * 0.14);
      ctx.stroke();
      ctx.restore();
    }
    return;
  }

  if (st.previewPath.length === 0) {
    // Target = ô hiện tại — không có đường, không vẽ
    return;
  }

  const startC = cellCenter(st.cy * st.nW + st.cx);

  // 1. Đường nét đứt từ player tới đích
  ctx.save();
  ctx.strokeStyle = 'rgba(255, 235, 100, 0.6)';
  ctx.lineWidth = Math.max(3, cs * 0.07);
  ctx.lineCap = 'round';
  ctx.lineJoin = 'round';
  ctx.setLineDash([cs * 0.14, cs * 0.12]);
  ctx.lineDashOffset = -st.t * 80;
  ctx.beginPath();
  ctx.moveTo(startC.x, startC.y);
  for (const idx of st.previewPath) {
    const c = cellCenter(idx);
    ctx.lineTo(c.x, c.y);
  }
  ctx.stroke();
  ctx.setLineDash([]);
  ctx.restore();

  // 2. Chấm flow ở từng ô
  for (let i = 0; i < st.previewPath.length; i++) {
    const c = cellCenter(st.previewPath[i]);
    const pulse = 0.65 + 0.35 * Math.sin(st.t * 8 - i * 0.6);
    ctx.save();
    const grad = ctx.createRadialGradient(c.x, c.y, 0, c.x, c.y, cs * 0.22);
    grad.addColorStop(0, 'rgba(255, 240, 120, ' + (0.55 * pulse) + ')');
    grad.addColorStop(1, 'rgba(255, 240, 120, 0)');
    ctx.fillStyle = grad;
    ctx.beginPath();
    ctx.arc(c.x, c.y, cs * 0.22, 0, Math.PI * 2);
    ctx.fill();
    ctx.fillStyle = 'rgba(255, 250, 180, ' + (0.9 * pulse) + ')';
    ctx.beginPath();
    ctx.arc(c.x, c.y, cs * 0.08 * pulse, 0, Math.PI * 2);
    ctx.fill();
    ctx.restore();
  }

  // 3. Vòng target đích
  const tc = cellCenter(st.previewPath[st.previewPath.length - 1]);
  ctx.save();
  const pulse = 0.5 + 0.5 * Math.sin(st.t * 6);
  ctx.strokeStyle = 'rgba(255, 200, 40, ' + (0.85 + pulse * 0.15) + ')';
  ctx.lineWidth = Math.max(2.5, cs * 0.06);
  ctx.beginPath();
  ctx.arc(tc.x, tc.y, cs * 0.32 + pulse * cs * 0.04, 0, Math.PI * 2);
  ctx.stroke();
  ctx.strokeStyle = 'rgba(255, 240, 150, 0.45)';
  ctx.lineWidth = Math.max(1.5, cs * 0.03);
  ctx.beginPath();
  ctx.arc(tc.x, tc.y, cs * 0.18, 0, Math.PI * 2);
  ctx.stroke();
  ctx.restore();
}

function drawWalkPath(ctx) {
  if (!st.path || st.path.length === 0 || st.dragging) return;
  const cs = geo.cs;
  ctx.save();
  for (let i = 0; i < st.path.length; i++) {
    const c = cellCenter(st.path[i]);
    const alpha = 0.45 * (1 - i / Math.max(1, st.path.length));
    ctx.fillStyle = 'rgba(255, 235, 100, ' + alpha + ')';
    ctx.beginPath();
    ctx.arc(c.x, c.y, cs * 0.07, 0, Math.PI * 2);
    ctx.fill();
  }
  ctx.restore();
}

function drawGrabIndicator(ctx) {
  if (!st.dragging || st.phase !== 'play') return;
  const p = playerPos();
  const cs = geo.cs;
  const pulse = 0.7 + 0.3 * Math.sin(st.t * 10);
  ctx.save();
  ctx.strokeStyle = 'rgba(255, 220, 60, 0.9)';
  ctx.lineWidth = 3;
  ctx.beginPath();
  ctx.arc(p.x, p.y, cs * 0.6 * pulse, 0, Math.PI * 2);
  ctx.stroke();
  // Mũi tên chỉ vào player
  ctx.strokeStyle = 'rgba(255, 220, 60, 0.6)';
  ctx.lineWidth = 2;
  for (let k = 0; k < 4; k++) {
    const a = st.t * 2 + k * Math.PI / 2;
    const r1 = cs * 0.75, r2 = cs * 0.9;
    ctx.beginPath();
    ctx.moveTo(p.x + Math.cos(a) * r1, p.y + Math.sin(a) * r1);
    ctx.lineTo(p.x + Math.cos(a) * r2, p.y + Math.sin(a) * r2);
    ctx.stroke();
  }
  ctx.restore();
}

function setMsg(t) { if (st) st.msg = t; }

function drawMessageArea(ctx) {
  const G = LR.G;
  const msgY = geo.by + geo.boardH + 18;
  ctx.font = '700 13px "Be Vietnam Pro", sans-serif';
  ctx.textAlign = 'center';
  ctx.textBaseline = 'top';
  ctx.fillStyle = INK;
  wrapText(ctx, st.msg || '', G.W / 2, msgY, G.W - 30, 18);

  if (st.phase === 'memo') {
    const barW = Math.min(280, G.W - 80);
    const barH = 10;
    const barX = (G.W - barW) / 2;
    const barY = msgY + 42;
    ctx.fillStyle = '#f2ecde';
    ctx.strokeStyle = INK;
    ctx.lineWidth = 2;
    roundRect(ctx, barX, barY, barW, barH, 5);
    ctx.fill(); ctx.stroke();
    const pct = clamp2(st.memoLeft / LEVELS[st.li].memo, 0, 1);
    ctx.fillStyle = '#2e9d4a';
    roundRect(ctx, barX, barY, barW * pct, barH, 5);
    ctx.fill();

    const btnW = 160, btnH = 42;
    const btnX = (G.W - btnW) / 2;
    const btnY = barY + barH + 12;
    st.skipBtnRect = { x: btnX, y: btnY, w: btnW, h: btnH };
    ctx.fillStyle = '#c2412d';
    ctx.strokeStyle = INK;
    ctx.lineWidth = 3;
    roundRect(ctx, btnX, btnY, btnW, btnH, 6);
    ctx.fill(); ctx.stroke();
    ctx.fillStyle = '#f2ecde';
    ctx.font = '700 14px "Be Vietnam Pro", sans-serif';
    ctx.textBaseline = 'middle';
    ctx.fillText('Đã nhớ rồi!', btnX + btnW/2, btnY + btnH/2);
  } else {
    st.skipBtnRect = null;
  }
}

function wrapText(ctx, text, cx, y, maxW, lh) {
  const words = text.split(' ');
  let line = '', curY = y;
  for (let i = 0; i < words.length; i++) {
    const test = line ? line + ' ' + words[i] : words[i];
    if (ctx.measureText(test).width > maxW && line) {
      ctx.fillText(line, cx, curY);
      curY += lh;
      line = words[i];
    } else line = test;
  }
  if (line) ctx.fillText(line, cx, curY);
}

function render() {
  const G = LR.G, ctx = G.ctx;
  if (!ctx || !st || !geo) return;
  const dpr = G.dpr || 1;
  ctx.setTransform(dpr, 0, 0, dpr, 0, 0);

  ctx.fillStyle = '#f2d5c8';
  ctx.fillRect(0, 0, G.W, G.H);
  const bgGrad = ctx.createRadialGradient(G.W/2, G.H*0.4, 0, G.W/2, G.H*0.4, Math.max(G.W, G.H) * 0.8);
  bgGrad.addColorStop(0, 'rgba(248,228,216,1)');
  bgGrad.addColorStop(0.6, 'rgba(242,213,200,1)');
  bgGrad.addColorStop(1, 'rgba(227,191,174,1)');
  ctx.fillStyle = bgGrad;
  ctx.fillRect(0, 0, G.W, G.H);

  let shX = 0, shY = 0;
  if (st.shake > 0) {
    shX = (Math.random()*2-1) * st.shake * 14;
    shY = (Math.random()*2-1) * st.shake * 14;
  }

  ctx.save();
  ctx.translate(shX, shY);

  const nW = st.nW, nH = st.nH;
  const cs = geo.cs;
  const bx = geo.bx, by = geo.by;

  roundRect(ctx, bx - 3, by - 3, geo.boardW + 6, geo.boardH + 6, 12);
  ctx.fillStyle = '#a8743a'; ctx.fill();
  ctx.lineWidth = 3; ctx.strokeStyle = INK; ctx.stroke();

  for (let i = 0; i < nW * nH; i++) {
    const cx = i % nW, cy = (i / nW) | 0;
    const x = bx + cx * cs, y = by + cy * cs;
    ctx.fillStyle = ((cx + cy) % 2) ? '#8cc45a' : '#9fd36b';
    ctx.fillRect(x, y, cs, cs);

    ctx.strokeStyle = '#5f9a3c';
    ctx.lineWidth = 1.4;
    ctx.lineCap = 'round';
    const u = cs / 100;
    for (let k = 0; k < 2; k++) {
      const tx = x + (0.18 + hash(i*7+k) * 0.64) * cs;
      const ty = y + (0.5 + hash(i*13+k) * 0.4) * cs;
      const s = (5 + hash(i+k*5) * 4) * u;
      ctx.beginPath();
      ctx.moveTo(tx - s*0.5, ty); ctx.lineTo(tx - s*0.3, ty - s);
      ctx.moveTo(tx, ty);         ctx.lineTo(tx, ty - s*1.3);
      ctx.moveTo(tx + s*0.5, ty); ctx.lineTo(tx + s*0.3, ty - s);
      ctx.stroke();
    }

    // Chỉ hiện trail visited khi đang chơi / hurt / win (không hiện lúc memo → tránh lộ start)
    if (st.visited[i] && (st.phase === 'play' || st.phase === 'hurt' || st.phase === 'win')) {
      ctx.fillStyle = 'rgba(255,244,170,.5)';
      ctx.fillRect(x, y, cs, cs);
      ell(ctx, x + cs*0.38, y + cs*0.62, 4*u, 6*u, 'rgba(122,92,40,.28)', 0, -0.2);
      ell(ctx, x + cs*0.6,  y + cs*0.42, 4*u, 6*u, 'rgba(122,92,40,.28)', 0, -0.2);
    }

    const ds = dogScale(i);
    if (ds > 0) {
      ctx.fill
