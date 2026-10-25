/* js/levels/ch1/17-ne-bong-den.js — Ải 17: Né bóng đen (Red Dot Survivor) */
(function(){
'use strict';
const LR = window.LR;
const Sound = LR.Sound;
const {clamp} = LR.util;

/* ================= CONFIG ================= */
const WIN_TIME = 60;   // sống sót 60 giây để qua ải
const BLACK = [15, 23, 42];  // #0F172A

let st = null;

/* ================= OBSTACLES ================= */
class SweepingWallObstacle {
  constructor(axis, dir, gapCenter, gapSize, speed, warnDur, worldW, worldH) {
    this.axis = axis; this.dir = dir;
    this.gapCenter = gapCenter;
    this.gapSize = Math.max(gapSize, 34);
    this.speed = speed; this.warnDuration = warnDur;
    this.worldW = worldW; this.worldH = worldH;
    this.timer = 0; this.thickness = 9.5;
    const travelBound = axis === 'vertical' ? worldH : worldW;
    this.pos = -dir * (travelBound + this.thickness);
    this.activated = false; this.dead = false; this.nearMissAwarded = false;
  }
  update(dt, worldW, worldH) {
    this.worldW = worldW; this.worldH = worldH;
    this.timer += dt;
    const bound = this.axis === 'vertical' ? this.worldH : this.worldW;
    if (this.timer >= this.warnDuration) {
      if (!this.activated) { this.activated = true; sfxActivate(); }
      this.pos += this.dir * this.speed * dt;
      if (Math.abs(this.pos) > bound + this.thickness + 18) this.dead = true;
    }
  }
  getSegments() {
    const segs = [];
    const gMin = this.gapCenter - this.gapSize * 0.5;
    const gMax = this.gapCenter + this.gapSize * 0.5;
    const spanBound = this.axis === 'vertical' ? this.worldW : this.worldH;
    if (this.axis === 'vertical') {
      if (gMin > -spanBound) {
        const w = (gMin + spanBound) * 0.5;
        segs.push({ cx: -spanBound + w, cy: this.pos, hw: w, hh: this.thickness });
      }
      if (gMax < spanBound) {
        const w = (spanBound - gMax) * 0.5;
        segs.push({ cx: gMax + w, cy: this.pos, hw: w, hh: this.thickness });
      }
    } else {
      if (gMin > -spanBound) {
        const h = (gMin + spanBound) * 0.5;
        segs.push({ cx: this.pos, cy: -spanBound + h, hw: this.thickness, hh: h });
      }
      if (gMax < spanBound) {
        const h = (spanBound - gMax) * 0.5;
        segs.push({ cx: this.pos, cy: gMax + h, hw: this.thickness, hh: h });
      }
    }
    return segs;
  }
  checkCollision(px, py, pr) {
    if (!this.activated) return { hit: false, minDist: 999 };
    let minDist = 999;
    for (const s of this.getSegments()) {
      const dx = Math.max(Math.abs(px - s.cx) - s.hw, 0);
      const dy = Math.max(Math.abs(py - s.cy) - s.hh, 0);
      const d = Math.hypot(dx, dy) - pr;
      if (d < minDist) minDist = d;
    }
    return { hit: minDist < 0, minDist };
  }
}

class LaserBlockObstacle {
  constructor(cx, cy, hw, hh, warnDur, activeDur, angle) {
    this.cx = cx; this.cy = cy; this.hw = hw; this.hh = hh;
    this.angle = angle || 0;
    this.warnDuration = warnDur; this.activeDuration = activeDur;
    this.timer = 0; this.activated = false; this.dead = false;
    this.nearMissAwarded = false;
  }
  update(dt) {
    this.timer += dt;
    if (!this.activated && this.timer >= this.warnDuration) {
      this.activated = true; sfxActivate();
    }
    if (this.timer >= this.warnDuration + this.activeDuration) this.dead = true;
  }
  checkCollision(px, py, pr) {
    if (!this.activated) return { hit: false, minDist: 999 };
    const remain = (this.warnDuration + this.activeDuration) - this.timer;
    // FIX #2: tắt va chạm cùng lúc với visual fade (0.15s khớp với fadeOut)
    if (remain < 0.15) return { hit: false, minDist: 999 };
    const dx = px - this.cx, dy = py - this.cy;
    const cos = Math.cos(-this.angle), sin = Math.sin(-this.angle);
    const lx = dx * cos - dy * sin;
    const ly = dx * sin + dy * cos;
    const qx = Math.max(Math.abs(lx) - this.hw, 0);
    const qy = Math.max(Math.abs(ly) - this.hh, 0);
    const d = Math.hypot(qx, qy) - pr;
    return { hit: d < 0, minDist: d };
  }
}

class ContractingRingObstacle {
  constructor(cx, cy, startR, shrinkSpeed, gapAngle, gapWidth, warnDur) {
    this.cx = cx; this.cy = cy;
    this.radius = startR; this.thickness = 9;
    this.shrinkSpeed = shrinkSpeed;
    this.gapAngle = gapAngle;
    this.gapHalfWidth = Math.max(gapWidth * 0.5, 0.48);
    this.rotationSpeed = (Math.random() > 0.5 ? 1 : -1) * 0.45;
    this.warnDuration = warnDur;
    this.timer = 0; this.activated = false; this.dead = false;
    this.nearMissAwarded = false;
  }
  update(dt) {
    this.timer += dt;
    if (this.timer >= this.warnDuration) {
      if (!this.activated) { this.activated = true; sfxActivate(); }
      this.radius -= this.shrinkSpeed * dt;
      this.gapAngle += this.rotationSpeed * dt;
      if (this.radius <= 12) this.dead = true;
    }
  }
  checkCollision(px, py, pr) {
    if (!this.activated) return { hit: false, minDist: 999 };
    const dx = px - this.cx, dy = py - this.cy;
    const dist = Math.hypot(dx, dy);
    const innerR = this.radius - this.thickness;
    const outerR = this.radius;
    const ang = Math.atan2(dy, dx);
    const diff = Math.abs(Math.atan2(Math.sin(ang - this.gapAngle), Math.cos(ang - this.gapAngle)));
    if (diff < this.gapHalfWidth - 0.05) return { hit: false, minDist: 999 };
    let radial;
    if (dist > outerR) radial = dist - outerR - pr;
    else if (dist < innerR) radial = innerR - dist - pr;
    else radial = -1;
    return { hit: radial < 0, minDist: radial };
  }
}

class BouncingOrbObstacle {
  constructor(x, y, vx, vy, radius, warnDur, lifeDur) {
    this.x = x; this.y = y; this.vx = vx; this.vy = vy;
    this.radius = radius;
    this.warnDuration = warnDur; this.lifeDuration = lifeDur;
    this.timer = 0; this.activated = false; this.dead = false;
    this.nearMissAwarded = false;
  }
  update(dt, worldW, worldH) {
    this.timer += dt;
    if (this.timer >= this.warnDuration) {
      if (!this.activated) { this.activated = true; sfxActivate(); }
      this.x += this.vx * dt; this.y += this.vy * dt;
      const bx = worldW - this.radius, by = worldH - this.radius;
      if (this.x < -bx) { this.x = -bx; this.vx *= -1; }
      if (this.x > bx) { this.x = bx; this.vx *= -1; }
      if (this.y < -by) { this.y = -by; this.vy *= -1; }
      if (this.y > by) { this.y = by; this.vy *= -1; }
    }
    if (this.timer >= this.warnDuration + this.lifeDuration) this.dead = true;
  }
  checkCollision(px, py, pr) {
    if (!this.activated) return { hit: false, minDist: 999 };
    const remain = (this.warnDuration + this.lifeDuration) - this.timer;
    // FIX #3: tắt va chạm cùng lúc với visual scale-in
    if (remain < 0.2) return { hit: false, minDist: 999 };
    const d = Math.hypot(px - this.x, py - this.y) - (this.radius + pr);
    return { hit: d < 0, minDist: d };
  }
}

/* ================= SOUND HELPERS ================= */
function sfxStart() {
  [261.63, 329.63, 392.00, 523.25].forEach((f, i) => {
    Sound.tone('triangle', f, f, 0.25, 0.14, i * 0.055);
  });
}
function sfxWarning() {
  Sound.tone('sine', 660, 880, 0.14, 0.06);
}
function sfxActivate() {
  Sound.tone('triangle', 150, 42, 0.2, 0.22);
}
function sfxNearMiss(streak) {
  const base = Math.min(587.33 + streak * 65, 1480);
  Sound.tone('sine', base, base * 1.45, 0.18, 0.13);
}
let _heartbeatTimer = 0;
function sfxHeartbeat(dt, difficulty) {
  const interval = Math.max(0.32, 0.78 - difficulty * 0.06);
  _heartbeatTimer += dt;
  if (_heartbeatTimer >= interval) {
    _heartbeatTimer = 0;
    Sound.tone('sine', 65, 36, 0.1, 0.055);
  }
}
function sfxGameOver() {
  Sound.sfx.lose();
  Sound.tone('sawtooth', 190, 28, 0.6, 0.28);
  Sound.noise(0.35, 0.25, 'lowpass', 950, 300);
}

/* ================= SETUP ================= */
function reset() {
  _heartbeatTimer = 0;
  st = {
    worldW: 100, worldH: 100,
    mode: 'relative',
    player: {
      x: 0, y: 0, targetX: 0, targetY: 0,
      radius: 4.3, trail: []
    },
    keys: {},
    pointer: { active: false, lastX: null, lastY: null },
    obstacles: [],
    particles: [],
    floatingTexts: [],
    waveTimer: 0.6,
    waveName: 'Khởi Động',
    survivalTime: 0,
    bonusScore: 0,
    totalScore: 0,
    nearMissCount: 0,
    nearMissStreak: 1,
    maxStreak: 1,
    streakDecayTimer: 0,
    nearMissCooldown: 0,
    shakeTime: 0, shakeMagnitude: 0,
    bgFlash: 0,
    gameOver: false, finished: false
  };
  updateWorldSize();
}

function updateWorldSize() {
  const G = LR.G;
  if (G.W >= G.H) {
    st.worldH = 100;
    st.worldW = (G.W / G.H) * 100;
  } else {
    st.worldW = 100;
    st.worldH = (G.H / G.W) * 100;
  }
  const limitX = st.worldW - st.player.radius;
  const limitY = st.worldH - st.player.radius;
  st.player.x = clamp(st.player.x, -limitX, limitX);
  st.player.y = clamp(st.player.y, -limitY, limitY);
  st.player.targetX = clamp(st.player.targetX, -limitX, limitX);
  st.player.targetY = clamp(st.player.targetY, -limitY, limitY);
}

/* ================= WAVE DIRECTOR ================= */
function spawnLogicalPattern(diff) {
  const wW = st.worldW, wH = st.worldH;
  const px = st.player.x, py = st.player.y;
  sfxWarning();
  const choice = Math.floor(Math.random() * 5);

  if (choice === 0) {
    // Tường quét khe thoát
    st.waveName = 'Tường Quét Khe Thoát';
    const axis = Math.random() > 0.5 ? 'vertical' : 'horizontal';
    const dir = Math.random() > 0.5 ? 1 : -1;
    const spanBound = axis === 'vertical' ? wW : wH;
    const gapSize = Math.max(38, 56 - diff * 2.5);
    const maxGapOffset = Math.max(20, spanBound - gapSize * 0.65 - 12);
    const gapCenter = (Math.random() * 2 - 1) * maxGapOffset;
    const travelBound = axis === 'vertical' ? wH : wW;
    const speed = (78 + diff * 13) * Math.max(1, travelBound / 115);
    const warn = Math.max(0.65, 1.05 - diff * 0.05);
    st.obstacles.push(new SweepingWallObstacle(axis, dir, gapCenter, gapSize, speed, warn, wW, wH));
    if (diff > 1.2) {
      const shift = (Math.random() > 0.5 ? 1 : -1) * Math.min(55, maxGapOffset * 0.65);
      const secondGap = clamp(gapCenter + shift, -maxGapOffset, maxGapOffset);
      st.obstacles.push(new SweepingWallObstacle(axis, dir, secondGap, gapSize + 5, speed, warn + 0.75, wW, wH));
    }
    st.waveTimer = Math.max(1.55, 2.5 - diff * 0.14);
  }
  else if (choice === 1) {
    // Lưới ô cờ
    st.waveName = 'Lưới Ô Cờ';
    const cols = wW > wH * 1.25 ? 4 : 3;
    const rows = wH > wW * 1.25 ? 4 : 3;
    const cellW = (wW * 2) / cols, cellH = (wH * 2) / rows;
    const hw = cellW * 0.5 - 2.4, hh = cellH * 0.5 - 2.4;
    const safe = new Set();
    const sr = Math.floor(Math.random() * rows);
    const sc = Math.floor(Math.random() * cols);
    safe.add(sr + ',' + sc);
    safe.add(((sr + 1) % rows) + ',' + sc);
    safe.add(sr + ',' + ((sc + 1) % cols));
    const warn = Math.max(0.85, 1.25 - diff * 0.06);
    for (let r = 0; r < rows; r++)
      for (let c = 0; c < cols; c++)
        if (!safe.has(r + ',' + c))
          st.obstacles.push(new LaserBlockObstacle(-wW + cellW * (c + 0.5), -wH + cellH * (r + 0.5), hw, hh, warn, 0.95));
    st.waveTimer = Math.max(1.5, 2.3 - diff * 0.12);
  }
  else if (choice === 2) {
    // Vòng tròn thu hẹp
    st.waveName = 'Vòng Vây Khe Mở';
    const gapAngle = Math.random() * Math.PI * 2;
    const gapWidth = Math.max(1.05, 1.45 - diff * 0.05);
    const startR = Math.hypot(wW, wH) + 15;
    const shrinkSpeed = (58 + diff * 8) * (startR / 140);
    const warn = Math.max(0.7, 1.05 - diff * 0.05);
    const cx = clamp(px * 0.4 + (Math.random() - 0.5) * 30, -wW * 0.35, wW * 0.35);
    const cy = clamp(py * 0.4 + (Math.random() - 0.5) * 30, -wH * 0.35, wH * 0.35);
    st.obstacles.push(new ContractingRingObstacle(cx, cy, startR, shrinkSpeed, gapAngle, gapWidth, warn));
    st.waveTimer = Math.max(1.7, 2.55 - diff * 0.12);
  }
  else if (choice === 3) {
    // Hành lang laser
    st.waveName = 'Hành Lang Laser';
    const isV = Math.random() > 0.5;
    const span = isV ? wW : wH;
    const len = Math.hypot(wW, wH) + 20;
    const laneCount = Math.max(5, Math.round((span * 2) / 42));
    const step = (span * 2) / laneCount;
    const lanes = [];
    for (let i = 0; i < laneCount; i++) lanes.push(-span + step * (i + 0.5));
    lanes.sort(() => Math.random() - 0.5);
    const num = Math.min(laneCount - 2, 2 + Math.floor(diff * 0.65));
    const warn = Math.max(0.8, 1.15 - diff * 0.05);
    const tilt = diff > 2.0 && Math.random() > 0.6 ? (Math.random() - 0.5) * 0.35 : 0;
    for (let i = 0; i < num; i++) {
      const pos = lanes[i];
      if (isV) st.obstacles.push(new LaserBlockObstacle(pos, 0, step * 0.34, len, warn, 0.85, tilt));
      else st.obstacles.push(new LaserBlockObstacle(0, pos, len, step * 0.34, warn, 0.85, tilt));
    }
    st.waveTimer = Math.max(1.4, 2.15 - diff * 0.1);
  }
  else {
    // Quả cầu phản xạ
    st.waveName = 'Quả Cầu Đen Phản Xạ';
    const count = Math.min(5, 2 + Math.floor(diff * 0.6));
    const warn = Math.max(0.85, 1.2 - diff * 0.05);
    for (let i = 0; i < count; i++) {
      let ox = 0, oy = 0;
      for (let tries = 0; tries < 12; tries++) {
        ox = (Math.random() * 2 - 1) * (wW - 22);
        oy = (Math.random() * 2 - 1) * (wH - 22);
        if (Math.hypot(ox - px, oy - py) > 52) break;
      }
      const ang = Math.random() * Math.PI * 2;
      const spd = 65 + diff * 10;
      st.obstacles.push(new BouncingOrbObstacle(ox, oy, Math.cos(ang) * spd, Math.sin(ang) * spd, 10.5, warn, 4.5));
    }
    st.waveTimer = Math.max(1.7, 2.6 - diff * 0.12);
  }
}

/* ================= PLAYER ================= */
function setTargetFromScreen(x, y) {
  const G = LR.G;
  const scale = Math.min(G.W, G.H) / 200;
  const cx = G.W / 2, cy = G.H / 2;
  const wx = (x - cx) / scale;
  const wy = -(y - cy) / scale;
  const limitX = st.worldW - st.player.radius;
  const limitY = st.worldH - st.player.radius;
  st.player.targetX = clamp(wx, -limitX, limitX);
  st.player.targetY = clamp(wy, -limitY, limitY);
}

function applyRelativeDelta(dxPx, dyPx, sens) {
  const G = LR.G;
  const scale = Math.min(G.W, G.H) / 200;
  const dxW = dxPx / scale * sens;
  const dyW = -dyPx / scale * sens;
  const limitX = st.worldW - st.player.radius;
  const limitY = st.worldH - st.player.radius;
  st.player.targetX = clamp(st.player.targetX + dxW, -limitX, limitX);
  st.player.targetY = clamp(st.player.targetY + dyW, -limitY, limitY);
}

function updatePlayer(dt) {
  const p = st.player;
  let kx = 0, ky = 0;
  if (st.keys['KeyA'] || st.keys['ArrowLeft']) kx -= 1;
  if (st.keys['KeyD'] || st.keys['ArrowRight']) kx += 1;
  if (st.keys['KeyW'] || st.keys['ArrowUp']) ky += 1;
  if (st.keys['KeyS'] || st.keys['ArrowDown']) ky -= 1;
  const limitX = st.worldW - p.radius;
  const limitY = st.worldH - p.radius;
  if (kx !== 0 || ky !== 0) {
    const len = Math.hypot(kx, ky);
    const moveSpeed = 135;
    p.targetX = clamp(p.targetX + (kx / len) * moveSpeed * dt, -limitX, limitX);
    p.targetY = clamp(p.targetY + (ky / len) * moveSpeed * dt, -limitY, limitY);
  }
  const lerp = Math.min(1, dt * 24);
  p.x += (p.targetX - p.x) * lerp;
  p.y += (p.targetY - p.y) * lerp;
  p.x = clamp(p.x, -limitX, limitX);
  p.y = clamp(p.y, -limitY, limitY);
  p.trail.unshift({ x: p.x, y: p.y });
  if (p.trail.length > 12) p.trail.pop();
}

/* ================= EFFECTS ================= */
function spawnParticles(x, y, color, count) {
  for (let i = 0; i < count; i++) {
    const a = Math.random() * Math.PI * 2;
    const spd = 25 + Math.random() * 95;
    st.particles.push({
      x, y,
      vx: Math.cos(a) * spd, vy: Math.sin(a) * spd,
      size: 1.5 + Math.random() * 2.4,
      color: [color[0], color[1], color[2]],
      life: 0.45 + Math.random() * 0.35,
      maxLife: 0.8
    });
  }
}

/* ================= UPDATE ================= */
function update(dt) {
  if (!st) return;
  if (LR.G.state !== 'play') return;

  if (st.shakeTime > 0) st.shakeTime = Math.max(0, st.shakeTime - dt);
  if (st.bgFlash > 0) st.bgFlash = Math.max(0, st.bgFlash - dt * 3.5);

  for (let i = st.particles.length - 1; i >= 0; i--) {
    const p = st.particles[i];
    p.x += p.vx * dt; p.y += p.vy * dt;
    p.vx *= 0.94; p.vy *= 0.94;
    p.life -= dt;
    if (p.life <= 0) st.particles.splice(i, 1);
  }
  for (let i = st.floatingTexts.length - 1; i >= 0; i--) {
    const f = st.floatingTexts[i];
    f.life -= dt;
    if (f.life <= 0) st.floatingTexts.splice(i, 1);
  }

  if (st.gameOver) return;

  st.survivalTime += dt;
  const difficulty = Math.min(6, st.survivalTime / 12);
  sfxHeartbeat(dt, difficulty);

  if (st.nearMissCooldown > 0) st.nearMissCooldown -= dt;
  if (st.streakDecayTimer > 0) {
    st.streakDecayTimer -= dt;
    if (st.streakDecayTimer <= 0) st.nearMissStreak = 1;
  }

  updatePlayer(dt);

  st.waveTimer -= dt;
  if (st.waveTimer <= 0) spawnLogicalPattern(difficulty);

  for (let i = st.obstacles.length - 1; i >= 0; i--) {
    const obs = st.obstacles[i];
    obs.update(dt, st.worldW, st.worldH);
    const res = obs.checkCollision(st.player.x, st.player.y, st.player.radius * 0.85);
    if (res.hit) { triggerGameOver(); return; }

    if (res.minDist > 0 && res.minDist < 5.5 && !obs.nearMissAwarded && st.nearMissCooldown <= 0) {
      obs.nearMissAwarded = true;
      st.nearMissCooldown = 0.22;
      st.nearMissCount++;
      st.streakDecayTimer = 3.5;
      const gain = 25 * st.nearMissStreak;
      st.bonusScore += gain;
      st.nearMissStreak = Math.min(8, st.nearMissStreak + 1);
      if (st.nearMissStreak > st.maxStreak) st.maxStreak = st.nearMissStreak;
      sfxNearMiss(st.nearMissStreak);
      st.bgFlash = 0.45;
      spawnParticles(st.player.x, st.player.y, [239, 68, 68], 8);
      st.floatingTexts.push({
        x: st.player.x, y: st.player.y,
        text: 'SƯỢT QUA +' + gain,
        life: 0.85, maxLife: 0.85
      });
    }

    if (obs.dead) st.obstacles.splice(i, 1);
  }

  st.totalScore = Math.floor(st.survivalTime * 15) + st.bonusScore;
  updateHUD();
}

function triggerGameOver() {
  st.gameOver = true;
  st.shakeTime = 0.42;
  st.shakeMagnitude = 4.2;
  st.bgFlash = 1.0;
  spawnParticles(st.player.x, st.player.y, [239, 68, 68], 32);
  spawnParticles(st.player.x, st.player.y, BLACK, 20);
  sfxGameOver();
  setTimeout(() => finishLevel(), 420);
}

function finishLevel() {
  if (!st || st.finished) return;
  st.finished = true;
  const survived = st.survivalTime >= WIN_TIME;
  const stars = !survived ? 0
    : st.survivalTime >= 150 ? 3
    : st.survivalTime >= 100 ? 2
    : 1;
  const score = st.totalScore;
  const timeStr = st.survivalTime.toFixed(1) + 's';
  LR.G.finish({
    win: survived,
    score: score,
    stars: stars,
    title: survived ? 'SỐNG SÓT THÀNH CÔNG!' : 'VA CHẠM RỒI!',
    msg: survived
      ? 'Bạn đã sống sót qua cơn bão bóng đen!'
      : 'Cần sống sót ' + WIN_TIME + 's để qua ải. Lần này bạn cầm cự ' + timeStr + '.',
    rows: [
      ['Thời gian', timeStr],
      ['Sượt qua', st.nearMissCount + ' lần'],
      ['Chuỗi cao', 'x' + st.maxStreak],
      ['Điểm', score]
    ]
  });
}

function updateHUD() {
  if (!st) return;
  const stats = [
    { l: 'Điểm', v: st.totalScore },
    { l: 'Giây', v: Math.floor(st.survivalTime) }
  ];
  if (st.nearMissStreak > 1) stats.push({ l: 'Sượt', v: 'x' + st.nearMissStreak });
  LR.G.hud.set(stats);
}

/* ================= RENDER ================= */
function roundRectPath(ctx, x, y, w, h, r) {
  if (ctx.roundRect) { ctx.beginPath(); ctx.roundRect(x, y, w, h, r); return; }
  ctx.beginPath();
  ctx.moveTo(x + r, y);
  ctx.lineTo(x + w - r, y); ctx.arcTo(x + w, y, x + w, y + r, r);
  ctx.lineTo(x + w, y + h - r); ctx.arcTo(x + w, y + h, x + w - r, y + h, r);
  ctx.lineTo(x + r, y + h); ctx.arcTo(x, y + h, x, y + h - r, r);
  ctx.lineTo(x, y + r); ctx.arcTo(x, y, x + r, y, r);
  ctx.closePath();
}

function rgb(color, alpha) {
  return 'rgba(' + color[0] + ',' + color[1] + ',' + color[2] + ',' + (alpha == null ? 1 : alpha) + ')';
}

function drawGrid(ctx) {
  const wW = st.worldW, wH = st.worldH;
  ctx.strokeStyle = 'rgba(15,23,42,0.045)';
  ctx.lineWidth = 0.3;
  for (let x = 0; x <= wW; x += 50) {
    ctx.beginPath(); ctx.moveTo(x, -wH); ctx.lineTo(x, wH); ctx.stroke();
    if (x > 0) { ctx.beginPath(); ctx.moveTo(-x, -wH); ctx.lineTo(-x, wH); ctx.stroke(); }
  }
  for (let y = 0; y <= wH; y += 50) {
    ctx.beginPath(); ctx.moveTo(-wW, y); ctx.lineTo(wW, y); ctx.stroke();
    if (y > 0) { ctx.beginPath(); ctx.moveTo(-wW, -y); ctx.lineTo(wW, -y); ctx.stroke(); }
  }
}

function drawSweepingWall(ctx, obs) {
  const segs = obs.getSegments();
  if (!obs.activated) {
    const p = obs.timer / obs.warnDuration;
    const pulse = 0.12 + 0.15 * Math.sin(p * Math.PI * 6);
    const travelBound = obs.axis === 'vertical' ? obs.worldH : obs.worldW;
    const warnEdge = -obs.dir * (travelBound - 5);
    ctx.fillStyle = rgb([239, 68, 68], pulse + 0.18);
    for (const s of segs) {
      const wCx = obs.axis === 'vertical' ? s.cx : warnEdge;
      const wCy = obs.axis === 'vertical' ? warnEdge : s.cy;
      const wHw = obs.axis === 'vertical' ? s.hw : 5.0 * p;
      const wHh = obs.axis === 'vertical' ? 5.0 * p : s.hh;
      ctx.fillRect(wCx - wHw, wCy - wHh, wHw * 2, wHh * 2);
    }
  } else {
    ctx.fillStyle = rgb(BLACK);
    for (const s of segs) {
      ctx.fillRect(s.cx - s.hw, s.cy - s.hh, s.hw * 2, s.hh * 2);
    }
  }
}

function drawLaserBlock(ctx, obs) {
  if (!obs.activated) {
    const p = Math.min(1, obs.timer / obs.warnDuration);
    const alpha = 0.08 + 0.22 * p + 0.08 * Math.sin(p * Math.PI * 8);
    ctx.save();
    ctx.translate(obs.cx, obs.cy);
    ctx.rotate(obs.angle);
    ctx.fillStyle = rgb([15, 23, 42], alpha);
    ctx.fillRect(-obs.hw, -obs.hh, obs.hw * 2, obs.hh * 2);
    ctx.fillStyle = rgb([239, 68, 68], 0.22);
    ctx.fillRect(-obs.hw * p, -obs.hh * p, obs.hw * 2 * p, obs.hh * 2 * p);
    ctx.restore();
  } else {
    const remain = (obs.warnDuration + obs.activeDuration) - obs.timer;
    const fade = Math.min(1, remain / 0.15);
    ctx.save();
    ctx.translate(obs.cx, obs.cy);
    ctx.rotate(obs.angle);
    ctx.fillStyle = rgb(BLACK, fade);
    ctx.fillRect(-obs.hw * fade, -obs.hh * fade, obs.hw * 2 * fade, obs.hh * 2 * fade);
    ctx.restore();
  }
}

function drawContractingRing(ctx, obs) {
  const outerR = obs.radius;
  const innerR = outerR - obs.thickness;
  const midR = (outerR + innerR) / 2;
  const lineW = obs.thickness;
  ctx.strokeStyle = obs.activated
    ? rgb(BLACK)
    : rgb([239, 68, 68], 0.28 + 0.15 * (obs.timer / obs.warnDuration));
  ctx.lineWidth = lineW;
  ctx.lineCap = 'butt';
  ctx.beginPath();
  // FIX #1: khe hở phải khớp với checkCollision (gapAngle ± halfWidth).
  // Trước đây dùng -(gapAngle ± half) + anticlockwise=true → khe bị mirror → player thấy khe
  // ở phía đối diện collision thật.
  const startA = obs.gapAngle + obs.gapHalfWidth;
  const endA = obs.gapAngle + Math.PI * 2 - obs.gapHalfWidth;
  ctx.arc(obs.cx, obs.cy, midR, startA, endA, false);
  ctx.stroke();
}

function drawBouncingOrb(ctx, obs) {
  if (!obs.activated) {
    const p = obs.timer / obs.warnDuration;
    ctx.fillStyle = rgb(BLACK, 0.16);
    ctx.beginPath(); ctx.arc(obs.x, obs.y, obs.radius, 0, Math.PI * 2); ctx.fill();
    ctx.fillStyle = rgb([239, 68, 68], 0.32);
    ctx.beginPath(); ctx.arc(obs.x, obs.y, obs.radius * p, 0, Math.PI * 2); ctx.fill();
  } else {
    const remain = (obs.warnDuration + obs.lifeDuration) - obs.timer;
    const scale = Math.min(1, remain / 0.2);
    ctx.fillStyle = rgb(BLACK);
    ctx.beginPath(); ctx.arc(obs.x, obs.y, obs.radius * scale, 0, Math.PI * 2); ctx.fill();
  }
}

function drawObstacle(ctx, obs) {
  if (obs instanceof SweepingWallObstacle) drawSweepingWall(ctx, obs);
  else if (obs instanceof LaserBlockObstacle) drawLaserBlock(ctx, obs);
  else if (obs instanceof ContractingRingObstacle) drawContractingRing(ctx, obs);
  else if (obs instanceof BouncingOrbObstacle) drawBouncingOrb(ctx, obs);
}

function render() {
  const G = LR.G, ctx = G.ctx;
  if (!ctx || !st) return;
  const dpr = G.dpr || 1;
  ctx.setTransform(dpr, 0, 0, dpr, 0, 0);

  const flash = st.bgFlash;
  const r = Math.round((0.972 + flash * 0.025) * 255);
  const g = Math.round((0.980 - flash * 0.08) * 255);
  const b = Math.round((0.988 - flash * 0.08) * 255);
  ctx.fillStyle = 'rgb(' + r + ',' + g + ',' + b + ')';
  ctx.fillRect(0, 0, G.W, G.H);

  let sx = 0, sy = 0;
  if (st.shakeTime > 0) {
    sx = (Math.random() * 2 - 1) * st.shakeMagnitude;
    sy = (Math.random() * 2 - 1) * st.shakeMagnitude;
  }

  const scale = Math.min(G.W, G.H) / 200;
  const cx = G.W / 2, cy = G.H / 2;

  ctx.save();
  ctx.translate(cx + sx, cy + sy);
  ctx.scale(scale, -scale);

  drawGrid(ctx);

  for (const obs of st.obstacles) drawObstacle(ctx, obs);

  for (const p of st.particles) {
    const alpha = Math.max(0, p.life / p.maxLife);
    ctx.fillStyle = rgb(p.color, alpha);
    ctx.beginPath(); ctx.arc(p.x, p.y, p.size, 0, Math.PI * 2); ctx.fill();
  }

  if (!st.gameOver) {
    for (let i = st.player.trail.length - 1; i >= 1; i--) {
      const t = st.player.trail[i];
      const ratio = 1 - i / st.player.trail.length;
      ctx.fillStyle = rgb([239, 68, 68], ratio * 0.28);
      ctx.beginPath(); ctx.arc(t.x, t.y, st.player.radius * ratio * 0.85, 0, Math.PI * 2); ctx.fill();
    }
    const glowR = st.player.radius * 3.1;
    const grad = ctx.createRadialGradient(st.player.x, st.player.y, 0, st.player.x, st.player.y, glowR);
    grad.addColorStop(0, 'rgba(239,68,68,0.35)');
    grad.addColorStop(1, 'rgba(239,68,68,0)');
    ctx.fillStyle = grad;
    ctx.beginPath(); ctx.arc(st.player.x, st.player.y, glowR, 0, Math.PI * 2); ctx.fill();
    ctx.fillStyle = 'rgb(239,68,68)';
    ctx.beginPath(); ctx.arc(st.player.x, st.player.y, st.player.radius, 0, Math.PI * 2); ctx.fill();
    ctx.fillStyle = 'rgba(255,255,255,0.85)';
    ctx.beginPath(); ctx.arc(st.player.x, st.player.y, st.player.radius * 0.35, 0, Math.PI * 2); ctx.fill();
  }

  ctx.restore();

  for (const f of st.floatingTexts) {
    const alpha = Math.max(0, f.life / f.maxLife);
    const px = cx + f.x * scale;
    const py = cy - f.y * scale - (1 - alpha) * 40;
    ctx.save();
    ctx.globalAlpha = alpha;
    ctx.fillStyle = '#DC2626';
    ctx.strokeStyle = '#ffffff';
    ctx.lineWidth = 3;
    ctx.font = '900 14px "Be Vietnam Pro", sans-serif';
    ctx.textAlign = 'center';
    ctx.strokeText(f.text, px, py);
    ctx.fillText(f.text, px, py);
    ctx.restore();
  }
}

/* ================= INPUT ================= */
function onKeyDown(e) {
  if (!st || LR.G.state !== 'play') return;
  st.keys[e.code] = true;
  if (['KeyW', 'KeyA', 'KeyS', 'KeyD', 'ArrowUp', 'ArrowDown', 'ArrowLeft', 'ArrowRight'].includes(e.code)) {
    e.preventDefault();
  }
}
function onKeyUp(e) {
  if (!st) return;
  st.keys[e.code] = false;
}

function onPointerDown(x, y, e) {
  if (!st || LR.G.state !== 'play' || st.gameOver) return;
  Sound.init();
  st.pointer.active = true;
  const isTouch = e && (e.pointerType === 'touch' || e.pointerType === 'pen');
  if (isTouch || st.pointer.lastX === null) {
    st.pointer.lastX = x;
    st.pointer.lastY = y;
  }
  if (st.mode === 'direct') setTargetFromScreen(x, y);
}
function onPointerUp() {
  if (!st) return;
  st.pointer.active = false;
}
function onPointerMove(x, y, e) {
  if (!st || LR.G.state !== 'play' || st.gameOver) return;
  const isTouch = e && (e.pointerType === 'touch' || e.pointerType === 'pen');
  if (isTouch && !st.pointer.active) return;

  if (st.mode === 'direct') {
    setTargetFromScreen(x, y);
    st.pointer.lastX = x; st.pointer.lastY = y;
  } else {
    if (st.pointer.lastX === null) {
      st.pointer.lastX = x; st.pointer.lastY = y;
      return;
    }
    const dx = x - st.pointer.lastX;
    const dy = y - st.pointer.lastY;
    applyRelativeDelta(dx, dy, 1.15);
    st.pointer.lastX = x; st.pointer.lastY = y;
  }
}

/* ================= MOD ================= */
const mod = {
  enter(opts) {
    reset();
    st.mode = (opts && opts.mode) || 'relative';
    window.addEventListener('keydown', onKeyDown);
    window.addEventListener('keyup', onKeyUp);
    if (LR.G.cv) LR.G.cv.style.cursor = 'crosshair';
    Sound.init();
    sfxStart();
    spawnParticles(0, 0, [239, 68, 68], 18);
    updateHUD();
  },
  exit() {
    window.removeEventListener('keydown', onKeyDown);
    window.removeEventListener('keyup', onKeyUp);
    if (LR.G.cv) LR.G.cv.style.cursor = '';
    if (st) st.keys = {};
    st = null;
  },
  resize() {
    if (st) updateWorldSize();
  },
  update(dt) { update(dt); },
  draw() { render(); },
  pointerDown(x, y, e) { onPointerDown(x, y, e); },
  pointerUp(x, y, e) { onPointerUp(); },
  pointerMove(x, y, e) { onPointerMove(x, y, e); },
  legend(el) {
    el.innerHTML = '<p class="note" style="margin:8px 0 0">' +
      '💡 Sống sót <b>' + WIN_TIME + ' giây</b> để qua ải. ' +
      'Các khối đen luôn có <b>cảnh báo đỏ</b> trước khi kích hoạt. ' +
      'Lách sát mép để nhận <b>Sượt Qua +điểm</b> và tăng chuỗi combo (x8 tối đa)!</p>';
  }
};

/* ================= REGISTER ================= */
const LEVEL = {
  id: '17-ne-bong-den',
  title: 'Né bóng đen',
  desc: 'Điều khiển chấm đỏ né các khối đen đang quét tới. Sượt qua mép để nhân điểm. Sống sót 60 giây để qua ải!',
  rules: [
    'Di chuyển bằng WASD / Mũi tên, hoặc kéo chạm / chuột trên màn hình',
    'Khối đen có cảnh báo đỏ trước khi kích hoạt — quan sát kỹ!',
    'Sượt qua mép khối đen để nhận +điểm và tăng chuỗi combo',
    'Chuỗi combo giảm dần nếu 3.5 giây không sượt qua khối nào',
    'Va vào khối đen = thua cuộc',
    'Sống sót 60 giây để qua ải, 100s = 2 sao, 150s = 3 sao'
  ],
  status: 'ready',
  pad: false,
  actLabel: '',
  modes: [
    { id: 'relative', name: 'Kéo Chạm', sub: 'Tay không che chấm đỏ (khuyên dùng)' },
    { id: 'direct', name: 'Theo Chuột', sub: 'Chấm đỏ bám sát con trỏ / ngón tay' }
  ],
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
