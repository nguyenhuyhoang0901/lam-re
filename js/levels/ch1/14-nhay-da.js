/* js/levels/ch1/14-nhay-da.js — Ải 14: Nhảy đá qua sông */
(function(){
'use strict';
const LR = window.LR;
const Sound = LR.Sound;
const {clamp} = LR.util;

const CHARACTER_CONFIG = { width: 46, height: 52 };
const PHYSICS = {
  gravity: 1180,
  minJumpDist: 85,
  maxJumpDist: 480,
  maxChargeTime: 0.92,
  sweetSpotRadius: 9,
  edgeSnapTolerance: 13
};
const BASE_STONE_WIDTH = 90;
const WIN_SCORE = 10;   // chỉ dùng để chấm "qua ải" khi rơi — KHÔNG hiện trong HUD

let gs = null, player = null;
let stones = [], particles = [], floatingTexts = [], clouds = [];
let orientationOverlay = null;

/* ---- Charge sound: oscillator LIÊN TỤC (giống bản gốc) ---- */
let chargeOsc = null, chargeGain = null;

function startChargeSound() {
  stopChargeSound();
  try {
    Sound.init();
    const a = Sound.audio();
    if (!a) return;
    chargeOsc = a.ctx.createOscillator();
    chargeGain = a.ctx.createGain();
    chargeOsc.type = 'triangle';
    chargeOsc.frequency.setValueAtTime(180, a.ctx.currentTime);
    chargeGain.gain.setValueAtTime(0.0001, a.ctx.currentTime);
    chargeGain.gain.exponentialRampToValueAtTime(0.06, a.ctx.currentTime + 0.05);
    chargeOsc.connect(chargeGain);
    chargeGain.connect(a.out);
    chargeOsc.start();
  } catch(e) { chargeOsc = null; chargeGain = null; }
}
function updateChargeSound(ratio) {
  if (!chargeOsc) return;
  try {
    const a = Sound.audio();
    if (!a) return;
    chargeOsc.frequency.setTargetAtTime(180 + ratio * 480, a.ctx.currentTime, 0.02);
  } catch(e) {}
}
function stopChargeSound() {
  if (chargeOsc) {
    try { chargeOsc.stop(); chargeOsc.disconnect(); } catch(e) {}
    chargeOsc = null;
  }
  if (chargeGain) {
    try { chargeGain.disconnect(); } catch(e) {}
    chargeGain = null;
  }
}

/* ---- Orientation ---- */
function isPortraitNarrow() {
  return window.innerHeight > window.innerWidth && window.innerWidth < 900;
}
function createOrientationOverlay() {
  if (orientationOverlay) return orientationOverlay;
  orientationOverlay = document.createElement('div');
  orientationOverlay.id = 'lr14-portrait-overlay';
  orientationOverlay.innerHTML =
    '<div style="position:fixed;inset:0;z-index:999999;background:rgba(2,6,23,0.97);' +
    'display:flex;flex-direction:column;align-items:center;justify-content:center;padding:24px;' +
    'text-align:center;color:#f8fafc;font-family:\'Be Vietnam Pro\',sans-serif;">' +
      '<div style="width:76px;height:76px;margin-bottom:20px;border-radius:18px;background:#0f172a;' +
      'border:1px solid #1e293b;display:flex;align-items:center;justify-content:center;">' +
        '<svg width="36" height="36" fill="none" stroke="#22d3ee" stroke-width="2" viewBox="0 0 24 24" ' +
        'style="animation:lr14Rotate 2.5s ease-in-out infinite;">' +
          '<rect x="5" y="2" width="14" height="20" rx="2" ry="2"></rect>' +
          '<line x1="12" y1="18" x2="12.01" y2="18"></line></svg>' +
      '</div>' +
      '<h2 style="font-size:20px;font-weight:800;margin:0 0 8px 0;">XOAY NGANG MÀN HÌNH</h2>' +
      '<p style="font-size:13px;color:#94a3b8;max-width:280px;margin:0;">Ải này cần xoay ngang điện thoại để chơi.</p>' +
    '</div>' +
    '<style>@keyframes lr14Rotate{0%,10%{transform:rotate(0)}40%,60%{transform:rotate(-90deg)}90%,100%{transform:rotate(0)}}</style>';
  document.body.appendChild(orientationOverlay);
  return orientationOverlay;
}
function updateOrientationOverlay() {
  if (!orientationOverlay) return;
  orientationOverlay.style.display = isPortraitNarrow() ? 'block' : 'none';
}
function removeOrientationOverlay() {
  if (orientationOverlay && orientationOverlay.parentNode) orientationOverlay.parentNode.removeChild(orientationOverlay);
  orientationOverlay = null;
}

/* ---- World ---- */
function initClouds() {
  clouds = [];
  for (let i = 0; i < 10; i++) {
    clouds.push({
      x: Math.random() * 1400, y: 30 + Math.random() * 220,
      w: 80 + Math.random() * 100, speed: 6 + Math.random() * 12,
      alpha: 0.08 + Math.random() * 0.14
    });
  }
}
function getBaseGroundY() {
  const G = LR.G, h = G.H, top = G.top || 0;
  const minY = top + 80;
  const maxY = Math.max(minY, h - 60);
  return Math.max(minY, Math.min(maxY, h * 0.72));
}
function createStone(x, width, isFirst) {
  const baseY = getBaseGroundY();
  const yOffset = isFirst ? 0 : (Math.random() * 70 - 35);
  return {
    x, y: baseY + yOffset, baseY: baseY + yOffset, yOffset,
    w: width, h: 48 + Math.random() * 24,
    bobPhase: Math.random() * Math.PI * 2,
    depressY: 0, crystalCollected: false
  };
}
function placePlayerOnStone(stone) {
  player.x = stone.x; player.y = stone.y;
  player.vx = 0; player.vy = 0; player.state = 'IDLE';
  player.chargeTime = 0;
  player.scaleX = 1; player.scaleY = 1; player.rotation = 0;
  player.climbProgress = 0; player.climbStartX = 0; player.climbTargetX = 0;
}
function spawnNextStone() {
  const last = stones[stones.length - 1];
  const dist = 170 + Math.random() * 275;
  stones.push(createStone(last.x + dist, 46 + Math.random() * 58, false));
  if (stones.length > 5) stones.shift();
}
function reset() {
  stopChargeSound();
  gs = { score: 0, combo: 1, maxCombo: 1, cameraX: 0, targetCameraX: 0, time: 0 };
  player = {
    x: 110, y: 0, vx: 0, vy: 0, state: 'IDLE',
    chargeTime: 0, chargeDir: 1,
    scaleX: 1, scaleY: 1, rotation: 0,
    climbProgress: 0, climbStartX: 0, climbTargetX: 0
  };
  stones = []; particles = []; floatingTexts = [];
  stones.push(createStone(115, BASE_STONE_WIDTH, true));
  spawnNextStone();
  placePlayerOnStone(stones[0]);
  gs.cameraX = stones[0].x - 115;
  gs.targetCameraX = gs.cameraX;
  updateHUD();
}
function getChargeRatio() { return clamp(player.chargeTime / PHYSICS.maxChargeTime, 0, 1); }
function calculateJumpVelocities(ratio) {
  const targetDist = PHYSICS.minJumpDist + ratio * (PHYSICS.maxJumpDist - PHYSICS.minJumpDist);
  const next = stones[1];
  const flightTime = 0.42 + ratio * 0.36;
  const vx = targetDist / flightTime;
  const deltaY = next ? (next.baseY - player.y) : 0;
  const vy = (deltaY - 0.5 * PHYSICS.gravity * flightTime * flightTime) / flightTime;
  return { vx, vy, targetDist, flightTime };
}
function updateHUD() {
  LR.G.hud.set([
    { l: 'Điểm', v: gs.score },
    { l: 'Combo', v: 'x' + gs.combo }
  ]);
}

/* ---- Input ---- */
function startCharging() {
  if (isPortraitNarrow()) return;
  if (player.state !== 'IDLE') return;
  Sound.init();               // ← FIX: đảm bảo AudioContext sẵn sàng cho bàn phím
  player.state = 'CHARGING';
  player.chargeTime = 0;
  player.chargeDir = 1;
  startChargeSound();         // ← FIX: bắt đầu oscillator liên tục
}
function releaseJump() {
  stopChargeSound();          // ← FIX: tắt tiếng tích lực ngay lập tức
  if (player.state !== 'CHARGING') return;
  if (LR.G.state !== 'play' || isPortraitNarrow()) {
    player.state = 'IDLE';
    player.chargeTime = 0;
    if (stones[0]) stones[0].depressY = 0;
    player.scaleX = 1; player.scaleY = 1;
    return;
  }
  const ratio = getChargeRatio();
  const { vx, vy } = calculateJumpVelocities(ratio);
  player.vx = vx; player.vy = vy; player.state = 'JUMPING';
  player.scaleX = 0.78; player.scaleY = 1.28;
  if (stones[0]) stones[0].depressY = 0;
  spawnParticles(player.x, player.y, '#38bdf8', 12, 120);
  Sound.sfx.zip();
}
function onKeyDown(e) {
  if (e.code !== 'Space' || LR.G.state !== 'play') return;
  e.preventDefault(); startCharging();
}
function onKeyUp(e) {
  if (e.code !== 'Space') return;
  e.preventDefault(); releaseJump();
}
function onVisibility() {
  if (document.hidden) stopChargeSound();
}

/* ---- Update ---- */
function update(dt) {
  if (isPortraitNarrow()) return;
  gs.time += dt;
  clouds.forEach(c => {
    c.x -= c.speed * dt;
    if (c.x + c.w < 0) c.x = LR.G.W + 60;
  });
  gs.cameraX += (gs.targetCameraX - gs.cameraX) * Math.min(1, dt * 7.5);

  stones.forEach((s, idx) => {
    if (idx === 0 && (player.state === 'IDLE' || player.state === 'CHARGING')) {
      s.y = s.baseY + s.depressY;
    } else {
      s.y = s.baseY + Math.sin(gs.time * 2.2 + s.bobPhase) * 3.5;
    }
  });

  if (player.state === 'IDLE') {
    player.y = stones[0].y;
    player.scaleX += (1 - player.scaleX) * Math.min(1, dt * 14);
    player.scaleY += (1 - player.scaleY) * Math.min(1, dt * 14);
  } else if (player.state === 'CHARGING') {
    player.chargeTime += dt * player.chargeDir;
    if (player.chargeTime >= PHYSICS.maxChargeTime) {
      player.chargeTime = PHYSICS.maxChargeTime; player.chargeDir = -1;
    } else if (player.chargeTime <= 0.05 && player.chargeDir === -1) {
      player.chargeTime = 0.05; player.chargeDir = 1;
    }
    const ratio = getChargeRatio();
    updateChargeSound(ratio);   // ← FIX: pitch bám theo lực tích tụ mỗi frame
    player.scaleY = 1 - ratio * 0.36;
    player.scaleX = 1 + ratio * 0.28;
    stones[0].depressY = ratio * 9;
    player.y = stones[0].y;
    if (Math.random() < 0.35 + ratio * 0.5) {
      const color = ratio > 0.75 ? '#f43f5e' : (ratio > 0.4 ? '#fbbf24' : '#38bdf8');
      particles.push({
        x: player.x + (Math.random() - 0.5) * 34, y: player.y - 2,
        vx: (Math.random() - 0.5) * 30, vy: -30 - Math.random() * 50,
        radius: 2 + Math.random() * 2.5, color, alpha: 1, life: 0.35
      });
    }
  } else if (player.state === 'JUMPING') {
    const prevY = player.y;
    player.x += player.vx * dt; player.y += player.vy * dt;
    player.vy += PHYSICS.gravity * dt;
    player.scaleX += (1 - player.scaleX) * Math.min(1, dt * 8);
    player.scaleY += (1 - player.scaleY) * Math.min(1, dt * 8);
    if (player.vy > 0) checkLanding(prevY);
  } else if (player.state === 'CLIMBING') {
    player.climbProgress += dt * 4.2;
    if (player.climbProgress >= 1) {
      player.x = player.climbTargetX;
      completeSuccessfulJump(stones[1], false, true);
    } else {
      player.x = player.climbStartX + (player.climbTargetX - player.climbStartX) * player.climbProgress;
      player.y = stones[1].y + Math.sin((1 - player.climbProgress) * Math.PI) * 8;
    }
  } else if (player.state === 'FALLING') {
    player.x += player.vx * dt; player.y += player.vy * dt;
    player.vy += PHYSICS.gravity * dt;
    player.rotation += 5 * dt;
    if (player.y > LR.G.H + 120) handleMiss();
  }

  for (let i = particles.length - 1; i >= 0; i--) {
    const p = particles[i];
    p.x += p.vx * dt; p.y += p.vy * dt;
    p.life -= dt; p.alpha = Math.max(0, p.life * 2.5);
    if (p.life <= 0) particles.splice(i, 1);
  }
  for (let i = floatingTexts.length - 1; i >= 0; i--) {
    const ft = floatingTexts[i];
    ft.y -= 38 * dt; ft.life -= dt;
    if (ft.life <= 0) floatingTexts.splice(i, 1);
  }
}

function checkLanding(prevY) {
  for (let i = 1; i >= 0; i--) {
    const stone = stones[i];
    if (!stone) continue;
    const halfW = stone.w / 2;
    const leftEdge = stone.x - halfW, rightEdge = stone.x + halfW;
    if (prevY <= stone.y + 8 && player.y >= stone.y - 4) {
      if (player.x >= leftEdge && player.x <= rightEdge) {
        player.y = stone.y;
        player.vx = 0; player.vy = 0;
        player.scaleX = 1.28; player.scaleY = 0.74;
        if (i === 0) {
          player.state = 'IDLE';
          spawnFloatingText(player.x, player.y - 45, "CHƯA QUA ĐÁ!", "#94a3b8");
          Sound.sfx.thud();
        } else {
          completeSuccessfulJump(stone, Math.abs(player.x - stone.x) <= PHYSICS.sweetSpotRadius, false);
        }
        return;
      }
      if (i === 1) {
        const t = PHYSICS.edgeSnapTolerance;
        const nearLeft = player.x >= leftEdge - t && player.x < leftEdge;
        const nearRight = player.x > rightEdge && player.x <= rightEdge + t;
        if (nearLeft || nearRight) {
          player.state = 'CLIMBING';
          player.vx = 0; player.vy = 0;
          player.climbProgress = 0;
          player.climbStartX = player.x;
          player.climbTargetX = nearLeft ? (leftEdge + 10) : (rightEdge - 10);
          spawnFloatingText(player.x, player.y - 50, "BẤU MÉP! 😅", "#38bdf8");
          Sound.sfx.tick();
          return;
        }
      }
    }
  }
  const target = stones[1];
  if (target && player.y > target.y + 38) {
    player.state = 'FALLING';
    Sound.sfx.bad();
  }
}

function completeSuccessfulJump(targetStone, isSweet, wasEdgeSnap) {
  player.y = targetStone.y; player.state = 'IDLE';
  if (isSweet) {
    const pts = 2 * gs.combo;
    gs.score += pts;
    spawnFloatingText(player.x, player.y - 55, `HOÀN HẢO! +${pts} (x${gs.combo})`, "#fbbf24");
    spawnParticles(player.x, player.y, '#fbbf24', 24, 170);
    gs.combo++;
    if (gs.combo > gs.maxCombo) gs.maxCombo = gs.combo;
    targetStone.crystalCollected = true;
    Sound.sfx.combo(gs.combo);
  } else {
    gs.score += 1; gs.combo = 1;
    if (!wasEdgeSnap) {
      spawnFloatingText(player.x, player.y - 45, "+1", "#e2e8f0");
      spawnParticles(player.x, player.y, '#94a3b8', 10, 90);
      Sound.sfx.thud();
    }
  }
  updateHUD();
  stones.shift();
  spawnNextStone();
  gs.targetCameraX = stones[0].x - 115;
}

function handleMiss() {
  const won = gs.score >= WIN_SCORE;
  LR.G.finish({
    win: won,
    score: gs.score,
    stars: won ? (gs.score >= WIN_SCORE + 10 ? 3 : (gs.score >= WIN_SCORE + 5 ? 2 : 1)) : 0,
    title: won ? 'SANG SÔNG THÀNH CÔNG!' : 'RƠI XUỐNG VỰC!',
    msg: won ? 'Chàng rể đã vượt sông an toàn.' : 'Bạn đã trượt chân. Thử lại nhé!',
    rows: [['Điểm', gs.score], ['Combo cao nhất', 'x' + gs.maxCombo]]
  });
}

/* ---- Draw (đã sửa DPR) ---- */
function drawFloatingStone(ctx, stone, isTarget) {
  const x = stone.x - stone.w / 2, y = stone.y, w = stone.w, h = stone.h;
  ctx.save();
  const bodyGrad = ctx.createLinearGradient(x, y, x, y + h);
  bodyGrad.addColorStop(0, '#475569');
  bodyGrad.addColorStop(0.5, '#334155');
  bodyGrad.addColorStop(1, '#0f172a');
  ctx.fillStyle = bodyGrad;
  ctx.beginPath();
  ctx.moveTo(x + 4, y + 6); ctx.lineTo(x + w - 4, y + 6);
  ctx.lineTo(x + w - 10, y + h - 8);
  ctx.lineTo(x + w * 0.65, y + h + 6);
  ctx.lineTo(x + w * 0.32, y + h + 2);
  ctx.lineTo(x + 12, y + h - 10);
  ctx.closePath(); ctx.fill();
  ctx.strokeStyle = '#64748b'; ctx.lineWidth = 1.5; ctx.stroke();

  const topGrad = ctx.createLinearGradient(x, y, x + w, y);
  topGrad.addColorStop(0, '#38bdf8'); topGrad.addColorStop(0.5, '#818cf8'); topGrad.addColorStop(1, '#38bdf8');
  ctx.fillStyle = '#cbd5e1';
  ctx.beginPath(); ctx.roundRect(x, y, w, 10, 5); ctx.fill();
  ctx.fillStyle = topGrad;
  ctx.beginPath(); ctx.roundRect(x + 2, y + 1, w - 4, 5, 3); ctx.fill();

  if (isTarget) {
    ctx.fillStyle = 'rgba(56, 189, 248, 0.22)';
    ctx.fillRect(x - PHYSICS.edgeSnapTolerance, y, PHYSICS.edgeSnapTolerance, 5);
    ctx.fillRect(x + w, y, PHYSICS.edgeSnapTolerance, 5);
  }
  if (isTarget && !stone.crystalCollected) {
    const cx = stone.x;
    ctx.fillStyle = 'rgba(251, 191, 36, 0.35)';
    ctx.beginPath(); ctx.roundRect(cx - PHYSICS.sweetSpotRadius, y, PHYSICS.sweetSpotRadius * 2, 6, 3); ctx.fill();
    const hoverY = y - 10 + Math.sin(gs.time * 5) * 2.5;
    ctx.fillStyle = '#fbbf24';
    ctx.beginPath();
    ctx.moveTo(cx, hoverY - 7); ctx.lineTo(cx + 6, hoverY);
    ctx.lineTo(cx, hoverY + 7); ctx.lineTo(cx - 6, hoverY);
    ctx.closePath(); ctx.fill();
    ctx.strokeStyle = '#fef08a'; ctx.lineWidth = 1; ctx.stroke();
  }
  ctx.restore();
}

function drawCharacter(ctx) {
  ctx.save();
  let shakeX = 0, shakeY = 0;
  const ratio = player.state === 'CHARGING' ? getChargeRatio() : 0;
  if (ratio > 0.7) {
    const intensity = (ratio - 0.7) * 8;
    shakeX = (Math.random() - 0.5) * intensity;
    shakeY = (Math.random() - 0.5) * intensity;
  }
  ctx.translate(player.x + shakeX, player.y + shakeY);
  ctx.rotate(player.rotation);
  ctx.scale(player.scaleX, player.scaleY);
  const w = CHARACTER_CONFIG.width, h = CHARACTER_CONFIG.height;

  if (player.state === 'CHARGING') {
    const glow = ratio > 0.75 ? 'rgba(244, 63, 94, 0.45)' : (ratio > 0.4 ? 'rgba(251, 191, 36, 0.4)' : 'rgba(56, 189, 248, 0.35)');
    ctx.fillStyle = glow;
    ctx.beginPath(); ctx.arc(0, -h * 0.4, w * (0.55 + ratio * 0.25), 0, Math.PI * 2); ctx.fill();
  }

  let bodyColor = '#38bdf8', darkColor = '#0284c7';
  if (ratio > 0.75) { bodyColor = '#fb7185'; darkColor = '#e11d48'; }
  else if (ratio > 0.4) { bodyColor = '#fbbf24'; darkColor = '#d97706'; }

  const grad = ctx.createLinearGradient(0, -h, 0, 0);
  grad.addColorStop(0, bodyColor); grad.addColorStop(1, darkColor);
  ctx.fillStyle = grad;
  ctx.beginPath(); ctx.roundRect(-w * 0.42, -h * 0.86, w * 0.84, h * 0.86, [18, 18, 10, 10]); ctx.fill();
  ctx.strokeStyle = '#ffffff'; ctx.lineWidth = 2; ctx.stroke();

  ctx.fillStyle = '#ef4444';
  ctx.fillRect(-w * 0.43, -h * 0.66, w * 0.86, 6);
  ctx.beginPath();
  ctx.moveTo(-w * 0.42, -h * 0.63);
  ctx.lineTo(-w * 0.68, -h * 0.72 + Math.sin(gs.time * 12) * 4);
  ctx.lineTo(-w * 0.62, -h * 0.52 + Math.sin(gs.time * 12) * 4);
  ctx.closePath(); ctx.fill();

  ctx.fillStyle = '#0f172a';
  if (player.state === 'CHARGING' && ratio > 0.45) {
    ctx.strokeStyle = '#0f172a'; ctx.lineWidth = 2.5;
    ctx.beginPath();
    ctx.moveTo(0, -h * 0.48); ctx.lineTo(5, -h * 0.43); ctx.lineTo(0, -h * 0.38);
    ctx.moveTo(15, -h * 0.48); ctx.lineTo(10, -h * 0.43); ctx.lineTo(15, -h * 0.38);
    ctx.stroke();
  } else {
    ctx.beginPath();
    ctx.arc(3, -h * 0.43, 3.5, 0, Math.PI * 2);
    ctx.arc(13, -h * 0.43, 3.5, 0, Math.PI * 2);
    ctx.fill();
    ctx.fillStyle = '#ffffff';
    ctx.beginPath();
    ctx.arc(4, -h * 0.45, 1.3, 0, Math.PI * 2);
    ctx.arc(14, -h * 0.45, 1.3, 0, Math.PI * 2);
    ctx.fill();
  }
  ctx.restore();
}

function drawAimingAids(ctx) {
  if (player.state !== 'CHARGING') return;
  const { vx, vy, flightTime } = calculateJumpVelocities(getChargeRatio());
  const maxFraction = 0.36, numDots = 6;
  for (let i = 1; i <= numDots; i++) {
    const t = (i / numDots) * maxFraction * flightTime;
    const px = player.x + vx * t;
    const py = player.y + vy * t + 0.5 * PHYSICS.gravity * t * t;
    const alpha = 1 - (i / (numDots + 1)) * 0.75;
    ctx.fillStyle = `rgba(56, 189, 248, ${alpha})`;
    ctx.beginPath(); ctx.arc(px, py, Math.max(2.5, 5.5 - i * 0.45), 0, Math.PI * 2); ctx.fill();
  }
}

function drawChargeBar(ctx) {
  const G = LR.G;
  const ratio = player ? getChargeRatio() : 0;
  const barW = Math.min(230, G.W * 0.34), barH = 10;
  const x = 14, y = (G.top || 0) + 26;
  ctx.save();
  ctx.fillStyle = 'rgba(15, 23, 42, 0.82)';
  ctx.strokeStyle = '#334155'; ctx.lineWidth = 1;
  ctx.beginPath(); ctx.roundRect(x - 8, y - 16, barW + 16, barH + 24, 8); ctx.fill(); ctx.stroke();

  ctx.font = '700 9px "Be Vietnam Pro", sans-serif';
  ctx.textBaseline = 'top'; ctx.textAlign = 'left';
  ctx.fillStyle = '#cbd5e1'; ctx.fillText('LỰC TÍCH TỤ', x, y - 13);
  ctx.fillStyle = '#22d3ee'; ctx.textAlign = 'right';
  ctx.fillText(Math.round(ratio * 100) + '%', x + barW, y - 13);

  ctx.fillStyle = '#1e293b';
  ctx.beginPath(); ctx.roundRect(x, y, barW, barH, 5); ctx.fill();
  if (ratio > 0) {
    const grad = ctx.createLinearGradient(x, 0, x + barW, 0);
    grad.addColorStop(0, '#38bdf8');
    grad.addColorStop(0.5, '#fbbf24');
    grad.addColorStop(1, '#f43f5e');
    ctx.fillStyle = grad;
    ctx.beginPath(); ctx.roundRect(x, y, barW * ratio, barH, 5); ctx.fill();
  }
  ctx.restore();
}

function drawHint(ctx) {
  if (!player || player.state !== 'IDLE') return;
  const G = LR.G;
  const text = 'Chạm giữ hoặc giữ Space để tích lực nhảy';
  ctx.save();
  ctx.font = '600 11px "Be Vietnam Pro", sans-serif';
  const tw = ctx.measureText(text).width + 24, th = 22;
  const x = (G.W - tw) / 2, y = G.H - 34;
  ctx.fillStyle = 'rgba(15, 23, 42, 0.7)';
  ctx.strokeStyle = '#334155'; ctx.lineWidth = 1;
  ctx.beginPath(); ctx.roundRect(x, y, tw, th, 11); ctx.fill(); ctx.stroke();
  ctx.fillStyle = '#cbd5e1';
  ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
  ctx.fillText(text, G.W / 2, y + th / 2);
  ctx.restore();
}

function draw() {
  const G = LR.G, ctx = G.ctx;
  if (!ctx || !gs) return;

  // === FIX: đưa context về CSS-pixel coordinate system ===
  const dpr = G.dpr || 1;
  ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
  ctx.clearRect(0, 0, G.W, G.H);       // trong hệ toạ độ đã scale = full bitmap

  const W = G.W, H = G.H;
  const skyGrad = ctx.createLinearGradient(0, 0, 0, H);
  skyGrad.addColorStop(0, '#090d16');
  skyGrad.addColorStop(0.6, '#1e293b');
  skyGrad.addColorStop(1, '#0f172a');
  ctx.fillStyle = skyGrad; ctx.fillRect(0, 0, W, H);

  clouds.forEach(c => {
    ctx.fillStyle = `rgba(148, 163, 184, ${c.alpha})`;
    ctx.beginPath(); ctx.roundRect(c.x, c.y, c.w, 22, 11); ctx.fill();
  });

  ctx.save();
  ctx.translate(-gs.cameraX, 0);
  stones.forEach((s, i) => drawFloatingStone(ctx, s, i === 1));
  drawAimingAids(ctx);
  particles.forEach(p => {
    ctx.globalAlpha = p.alpha; ctx.fillStyle = p.color;
    ctx.beginPath(); ctx.arc(p.x, p.y, p.radius, 0, Math.PI * 2); ctx.fill();
  });
  ctx.globalAlpha = 1;
  drawCharacter(ctx);
  floatingTexts.forEach(ft => {
    ctx.save();
    ctx.font = '800 14px "Be Vietnam Pro", sans-serif';
    ctx.textAlign = 'center'; ctx.globalAlpha = Math.min(1, ft.life * 2);
    ctx.fillStyle = '#0f172a'; ctx.fillText(ft.text, ft.x + 1, ft.y + 1);
    ctx.fillStyle = ft.color; ctx.fillText(ft.text, ft.x, ft.y);
    ctx.restore();
  });
  ctx.restore();

  drawChargeBar(ctx);
  drawHint(ctx);
}

function spawnParticles(x, y, color, count, speed) {
  for (let i = 0; i < count; i++) {
    const angle = Math.random() * Math.PI * 2;
    const spd = 25 + Math.random() * speed;
    particles.push({
      x, y: y - 4,
      vx: Math.cos(angle) * spd, vy: Math.sin(angle) * spd - 40,
      radius: 2 + Math.random() * 3, color, alpha: 1,
      life: 0.4 + Math.random() * 0.25
    });
  }
}
function spawnFloatingText(x, y, text, color) {
  floatingTexts.push({ x, y, text, color, life: 1.1 });
}

/* ---- Mod ---- */
const mod = {
  enter() {
    stopChargeSound();
    reset();
    initClouds();
    createOrientationOverlay();
    updateOrientationOverlay();
    window.addEventListener('keydown', onKeyDown);
    window.addEventListener('keyup', onKeyUp);
    window.addEventListener('resize', updateOrientationOverlay);
    window.addEventListener('orientationchange', updateOrientationOverlay);
    document.addEventListener('visibilitychange', onVisibility);
  },
  exit() {
    stopChargeSound();
    window.removeEventListener('keydown', onKeyDown);
    window.removeEventListener('keyup', onKeyUp);
    window.removeEventListener('resize', updateOrientationOverlay);
    window.removeEventListener('orientationchange', updateOrientationOverlay);
    document.removeEventListener('visibilitychange', onVisibility);
    removeOrientationOverlay();
    const ctx = LR.G.ctx;
    if (ctx) ctx.setTransform(1, 0, 0, 1, 0, 0);
  },
  resize() {
    if (!stones || !player || !gs || !stones[0]) return;
    const groundY = getBaseGroundY();
    stones.forEach(s => { s.baseY = groundY + (s.yOffset || 0); s.y = s.baseY; });
    if (player.state === 'IDLE') { player.x = stones[0].x; player.y = stones[0].y; }
    gs.cameraX = stones[0].x - 115;
    gs.targetCameraX = gs.cameraX;
    clouds.forEach(c => { if (c.x > LR.G.W) c.x = Math.random() * LR.G.W; });
    updateOrientationOverlay();
  },
  update(dt) { update(dt); },
  draw() { draw(); },
  pointerDown() { if (LR.G.state === 'play') startCharging(); },
  pointerUp() { releaseJump(); },
  legend(el) {
    el.innerHTML = '<p class="note" style="margin:8px 0 0">' +
      '💡 Nhảy vào tâm khối đá (chấm vàng) để được điểm hoàn hảo và tăng combo. ' +
      'Nhảy sát mép sẽ được bấu víu an toàn. Cần đạt <b>' + WIN_SCORE + ' điểm</b> khi rơi để qua ải.</p>';
  }
};

/* ---- Register ---- */
const LEVEL = {
  id: '14-nhay-da',
  title: 'Nhảy đá qua sông',
  desc: 'Chàng rể phải nhảy qua các khối đá trôi nổi để qua sông. Giữ để tích lực, nhả để nhảy!',
  rules: [
    'Giữ chuột/ngón tay (hoặc Space) để tích lực, nhả ra để nhảy',
    'Nhảy trúng tâm khối đá (chấm vàng) = điểm hoàn hảo, tăng combo',
    'Nhảy sát mép có thể bấu víu (an toàn, không mất mạng)',
    'Rơi xuống vực = kết thúc lượt chơi',
    'Đạt ' + WIN_SCORE + ' điểm để mở ải tiếp theo'
  ],
  status: 'ready',
  pad: false,
  actLabel: 'NHẢY',
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
