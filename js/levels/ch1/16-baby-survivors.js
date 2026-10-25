/* js/levels/ch1/16-baby-survivors.js — Ải 16: Em Bé Đại Chiến Vi Khuẩn */
(function(){
'use strict';
const LR = window.LR;
const Sound = LR.Sound;
const {clamp} = LR.util;

/* ================= CONFIG ================= */
const WORLD_SIZE = 1600;
const WAVE_DURATION = 30;
const WIN_BOSS_WAVE = 3;   // thắng khi boss đợt 3 bị tiêu diệt

const WEAPON_DB = {
  milk: { id:'milk', name:'Súng Bình Sữa', icon:'🍼', type:'weapon',
    desc:'Bắn sữa tốc độ cao vào vi khuẩn gần nhất.',
    baseDamage:18, baseCd:0.35, speed:750, range:520 },
  syringe: { id:'syringe', name:'Kim Tiêm Vắc-Xin', icon:'💉', type:'weapon',
    desc:'Chùm ống tiêm kháng thể xuyên thấu.',
    baseDamage:14, baseCd:0.9, pellets:4, spread:0.45, speed:650, range:400 },
  bubble: { id:'bubble', name:'Bong Bóng Xà Phòng', icon:'🫧', type:'weapon',
    desc:'Bong bóng tự tìm vi khuẩn.',
    baseDamage:20, baseCd:0.55, speed:480, range:600, homing:true },
  pacifier: { id:'pacifier', name:'Khiên Núm Vú Xoay', icon:'👶', type:'weapon',
    desc:'Núm vú giả xoay quanh bé, nghiền vi khuẩn.',
    baseDamage:15, orbitRadius:90, orbitSpeed:4.2, count:2 },
  lightning: { id:'lightning', name:'Tia Chớp Vitamin C', icon:'🍋', type:'weapon',
    desc:'Sét giật dây chuyền giữa các mục tiêu.',
    baseDamage:26, baseCd:1.2, bounces:3, range:440 },
  powder: { id:'powder', name:'Bom Phấn Rôm', icon:'☁️', type:'weapon',
    desc:'Ném lọ phấn nổ diện rộng.',
    baseDamage:42, baseCd:1.6, speed:450, blastRadius:95 },
  aura: { id:'aura', name:'Vòng Khăn Ấm', icon:'🧼', type:'weapon',
    desc:'Vòng hơi ấm đốt cháy vi khuẩn lân cận.',
    baseDamage:10, baseCd:0.35, radius:110 },
  rattle: { id:'rattle', name:'Lục Lạc Bumerang', icon:'🪇', type:'weapon',
    desc:'Ném lục lạc bay xuyên quái rồi quay về.',
    baseDamage:22, baseCd:1.1, speed:520 }
};

const PASSIVE_DB = {
  atkSpeed: { id:'atkSpeed', name:'Sữa Siêu Tốc', icon:'⚡', type:'passive', desc:'+12% Tốc đánh.' },
  damageUp: { id:'damageUp', name:'Kháng Thể Mạnh', icon:'💪', type:'passive', desc:'+15% Sát thương.' },
  multishot: { id:'multishot', name:'Đồ Chơi Nhân Đôi', icon:'🎯', type:'passive', desc:'+1 Tia đạn.' },
  critChance: { id:'critChance', name:'Kính Hiển Vi', icon:'🔬', type:'passive', desc:'+8% Chí mạng & +20% Dmg chí mạng.' },
  moveSpeed: { id:'moveSpeed', name:'Tất Siêu Tốc', icon:'🧦', type:'passive', desc:'+10% Tốc chạy.' },
  maxHp: { id:'maxHp', name:'Tã Kim Cương', icon:'🧷', type:'passive', desc:'+30 Máu tối đa & +1.5 HP/s.' }
};

/* ================= STATE ================= */
let st = null;
let layout = null;

/* ================= HELPERS ================= */
function getViewScale() {
  const W = LR.G.W, H = LR.G.H;
  const minDim = Math.min(W, H);
  const isPortrait = H > W;
  if (minDim < 580) return isPortrait ? Math.max(0.68, W / 560) : Math.max(0.75, H / 500);
  return 1.0;
}
function removeFast(arr, i) {
  if (i < 0 || i >= arr.length) return;
  arr[i] = arr[arr.length - 1];
  arr.pop();
}
function computeLayout() {
  layout = { scale: getViewScale() };
}

/* ================= RESET ================= */
function reset() {
  st = {
    state: 'playing',
    time: 0,
    camera: { x: WORLD_SIZE/2, y: WORLD_SIZE/2 },
    wave: 1, waveTimer: WAVE_DURATION,
    spawnTimer: 0, crateTimer: 16,
    activeBoss: null,
    pendingWin: false, winTimer: 0,
    cardActive: false, cardChoices: [], cardRects: [], pendingLevelUps: 0,
    rerollCost: 20,
    keys: {},
    joystick: { active: false, pointerId: null, startX: 0, startY: 0, curX: 0, curY: 0, dx: 0, dy: 0 },
    enemies: [], projectiles: [], enemyProjectiles: [],
    gems: [], crates: [], particles: [], floatingTexts: [], lightningBolts: [],
    player: createPlayer()
  };
  st.player.weapons[st.player.startWeapon] = 1;
  spawnCrate();
  updateHUD();
}

function createPlayer() {
  return {
    x: WORLD_SIZE/2, y: WORLD_SIZE/2,
    vx: 0, vy: 0, radius: 20,
    hp: 110, maxHp: 110, hpRegen: 0.4,
    speed: 230, dmgMult: 1, atkSpeedMult: 1,
    critChance: 0.06, critDmg: 1.6, multishot: 0, xpMult: 1,
    level: 1, xp: 0, xpToNext: 22,
    kills: 0, goldEarned: 0,
    facingAngle: 0, walkAnim: 0, recoil: 0, hitFlash: 0,
    invulnTimer: 0, slowTimer: 0, slowFactor: 1,
    dashTimer: 0, dashCooldown: 0, dashMaxCd: 2.8, dashVx: 0, dashVy: 0,
    weapons: {}, passives: {}, cooldowns: {},
    orbitAngle: 0,
    startWeapon: 'milk'
  };
}

function updateHUD() {
  if (!st) return;
  const p = st.player;
  LR.G.hud.set([
    { l: 'Cấp', v: p.level },
    { l: 'Đợt', v: st.wave },
    { l: 'Diệt', v: p.kills }
  ]);
}

/* ================= SPAWN ================= */
function spawnCrate() {
  if (st.crates.length >= 3) return;
  const margin = 140;
  st.crates.push({
    x: margin + Math.random() * (WORLD_SIZE - margin*2),
    y: margin + Math.random() * (WORLD_SIZE - margin*2),
    radius: 20, hp: 35, hitFlash: 0
  });
}

function spawnEnemy(forcedType) {
  const p = st.player;
  const ang = Math.random() * Math.PI * 2;
  const effW = LR.G.W / layout.scale;
  const effH = LR.G.H / layout.scale;
  const dist = Math.max(effW, effH) * 0.54 + 65;
  let x = p.x + Math.cos(ang) * dist;
  let y = p.y + Math.sin(ang) * dist;
  x = clamp(x, 60, WORLD_SIZE - 60);
  y = clamp(y, 60, WORLD_SIZE - 60);

  const w = st.wave;
  let type = forcedType;
  if (!type) {
    const roll = Math.random();
    // Sprinter xuất hiện từ wave 2 (12%) — nhanh + làm chậm
    // Splitter từ wave 3 (12%) — chết tách đôi
    if (w >= 4 && roll < 0.10) type = 'sporebomb';
    else if (w >= 3 && roll < 0.28) type = 'splitter';
    else if (w >= 2 && roll < 0.42) type = 'sprinter';
    else if (w >= 3 && roll < 0.58) type = 'coronavirus';
    else if (w >= 2 && roll < 0.78) type = 'bacillus';
    else type = 'cocci';
  }

  const scaleHp = 1 + (w - 1) * 0.42;
  const scaleDmg = 1 + (w - 1) * 0.28;
  const scaleSpd = 1 + (w - 1) * 0.06;

  const base = { x, y, hitFlash: 0, isDead: false,
    animOffset: Math.random() * 10, scaleHp, scaleDmg };

  if (type === 'cocci') {
    st.enemies.push({ ...base, type, radius: 16,
      hp: 36*scaleHp, maxHp: 36*scaleHp,
      speed: (130 + Math.random()*25) * scaleSpd, damage: 14*scaleDmg,
      color: '#4ade80', coreColor: '#16a34a', xpValue: 4 });
  } else if (type === 'bacillus') {
    st.enemies.push({ ...base, type, radius: 22,
      hp: 110*scaleHp, maxHp: 110*scaleHp,
      speed: 98*scaleSpd, damage: 22*scaleDmg,
      color: '#a855f7', coreColor: '#6b21a8', xpValue: 9 });
  } else if (type === 'coronavirus') {
    st.enemies.push({ ...base, type, radius: 19,
      hp: 60*scaleHp, maxHp: 60*scaleHp,
      speed: 104*scaleSpd, damage: 18*scaleDmg,
      color: '#f43f5e', coreColor: '#9f1239', xpValue: 8,
      shootCd: 1.4 + Math.random()*0.8 });
  } else if (type === 'sporebomb') {
    st.enemies.push({ ...base, type, radius: 16,
      hp: 45*scaleHp, maxHp: 45*scaleHp,
      speed: 185*scaleSpd, damage: 38*scaleDmg,
      color: '#fb923c', coreColor: '#c2410c', xpValue: 10 });
  } else if (type === 'sprinter') {
    // ⭐ MỚI: Vi khuẩn chạy nhanh, chạm làm chậm bé
    st.enemies.push({ ...base, type, radius: 11,
      hp: 26*scaleHp, maxHp: 26*scaleHp,
      speed: 300*scaleSpd, damage: 8*scaleDmg,
      color: '#fde047', coreColor: '#a16207', xpValue: 5,
      trail: [] });
  } else if (type === 'splitter') {
    // ⭐ MỚI: Vi khuẩn tách đôi khi chết
    st.enemies.push({ ...base, type, radius: 20,
      hp: 70*scaleHp, maxHp: 70*scaleHp,
      speed: 105*scaleSpd, damage: 16*scaleDmg,
      color: '#f472b6', coreColor: '#9f1239', xpValue: 9,
      canSplit: true });
  } else if (type === 'boss') {
    const bossHp = 1350 * scaleHp;
    const boss = { ...base, type:'boss', name:'SIÊU VI KHUẨN ĐỢT ' + w,
      radius: 46, hp: bossHp, maxHp: bossHp,
      speed: 112*scaleSpd, damage: 36*scaleDmg,
      color: '#84cc16', coreColor: '#3f6212', xpValue: 100,
      skillCd: 2.6 };
    st.enemies.push(boss);
    st.activeBoss = boss;
    Sound.sfx.bad();
  }
}

/* ================= COMBAT ================= */
function findNearestEnemy(x, y, maxRange, exclude) {
  let best = null, bestDist = maxRange == null ? Infinity : maxRange;
  for (let i = 0; i < st.enemies.length; i++) {
    const e = st.enemies[i];
    if (!e || e.isDead) continue;
    if (exclude && exclude.indexOf(e) !== -1) continue;
    const d = Math.hypot(e.x - x, e.y - y);
    if (d < bestDist) { bestDist = d; best = e; }
  }
  return best;
}

function dealDamage(enemy, rawDmg, knockback, srcX, srcY) {
  if (!enemy || enemy.isDead) return;
  const p = st.player;
  const isCrit = Math.random() < p.critChance;
  const dmg = Math.max(1, Math.round(rawDmg * p.dmgMult * (isCrit ? p.critDmg : 1)));
  enemy.hp -= dmg;
  enemy.hitFlash = 0.1;

  if (knockback > 0 && enemy.type !== 'boss') {
    const a = Math.atan2(enemy.y - srcY, enemy.x - srcX);
    enemy.x += Math.cos(a) * knockback;
    enemy.y += Math.sin(a) * knockback;
  }

  if (st.floatingTexts.length < 30) {
    st.floatingTexts.push({
      x: enemy.x + (Math.random()-.5)*16, y: enemy.y - enemy.radius,
      text: isCrit ? '💥' + dmg + '!' : '' + dmg,
      color: isCrit ? '#fde047' : '#ffffff',
      size: isCrit ? 18 : 13,
      vy: -45, life: 0.5, maxLife: 0.5
    });
  }
  Sound.sfx.thud();

  if (enemy.hp <= 0) killEnemy(enemy);
}

function killEnemy(enemy) {
  if (!enemy || enemy.isDead) return;
  enemy.isDead = true;
  const idx = st.enemies.indexOf(enemy);
  if (idx !== -1) removeFast(st.enemies, idx);
  st.player.kills++;

  if (enemy.type === 'sporebomb') {
    createExplosion(enemy.x, enemy.y, 85, 34, true, '#fb923c');
  }

  // ⭐ MỚI: Splitter tách đôi khi chết
  if (enemy.type === 'splitter' && enemy.canSplit) {
    const w = st.wave;
    const scaleHp = 1 + (w - 1) * 0.42;
    const scaleDmg = 1 + (w - 1) * 0.28;
    for (let i = 0; i < 2; i++) {
      const ang = (i === 0 ? -Math.PI/3 : Math.PI/3);
      const off = 22;
      st.enemies.push({
        type: 'splitling',
        x: enemy.x + Math.cos(ang) * off,
        y: enemy.y + Math.sin(ang) * off,
        radius: 11,
        hp: 32*scaleHp, maxHp: 32*scaleHp,
        speed: 145, damage: 10*scaleDmg,
        color: '#fbcfe8', coreColor: '#9f1239',
        xpValue: 4,
        hitFlash: 0, isDead: false, canSplit: false,
        animOffset: Math.random() * 10, scaleHp, scaleDmg
      });
    }
    Sound.sfx.splat && Sound.sfx.splat();
  }

  const dropCount = enemy.type === 'boss' ? 8 : 1;
  for (let i = 0; i < dropCount; i++) {
    st.gems.push({
      x: enemy.x + (Math.random()-.5)*25,
      y: enemy.y + (Math.random()-.5)*25,
      kind: 'xp', value: Math.ceil(enemy.xpValue / dropCount),
      color: '#38bdf8', radius: 6
    });
  }
  if (Math.random() < 0.12 || enemy.type === 'boss') {
    const cnt = enemy.type === 'boss' ? 5 : 1;
    for (let i = 0; i < cnt; i++) {
      st.gems.push({
        x: enemy.x + (Math.random()-.5)*20,
        y: enemy.y + (Math.random()-.5)*20,
        kind: 'gold', value: 1,
        color: '#fbbf24', radius: 7
      });
    }
  }

  if (enemy === st.activeBoss) {
    st.activeBoss = null;
    st.pendingWin = true;
    st.winTimer = 1.0;
    Sound.sfx.win();
    spawnParticles(enemy.x, enemy.y, '#84cc16', 40, 300);
  }
}

function createExplosion(x, y, radius, dmg, hurtPlayer, color) {
  Sound.sfx.killBig && Sound.sfx.killBig();
  if (st.particles.length < 45) {
    st.particles.push({ x, y, vx:0, vy:0, color, size: radius,
      life: 0.25, maxLife: 0.25, isRing: true });
  }
  const snapshot = st.enemies.slice();
  for (let i = 0; i < snapshot.length; i++) {
    const e = snapshot[i];
    if (!e || e.isDead) continue;
    if (Math.hypot(e.x-x, e.y-y) <= radius + e.radius)
      dealDamage(e, dmg, 15, x, y);
  }
  if (hurtPlayer && st.player) {
    const p = st.player;
    if (Math.hypot(p.x-x, p.y-y) <= radius + p.radius) damagePlayer(24);
  }
}

function damagePlayer(amount) {
  const p = st.player;
  if (p.invulnTimer > 0 || st.state !== 'playing' || st.pendingWin) return;
  p.hp -= Math.round(amount);
  p.hitFlash = 0.2;
  p.invulnTimer = 0.45;
  Sound.sfx.hurtBig && Sound.sfx.hurtBig();
  if (st.floatingTexts.length < 30) {
    st.floatingTexts.push({
      x: p.x, y: p.y - 25, text: '-' + Math.round(amount),
      color: '#fb7185', size: 18, vy: -50, life: 0.6, maxLife: 0.6
    });
  }
  if (p.hp <= 0) { p.hp = 0; finishGame(false); }
}

/* ================= WEAPONS ================= */
function spawnProjectile(opts) {
  if (st.projectiles.length > 80) return;
  st.projectiles.push({
    x: opts.x, y: opts.y,
    vx: Math.cos(opts.angle) * opts.speed,
    vy: Math.sin(opts.angle) * opts.speed,
    angle: opts.angle, speed: opts.speed,
    damage: opts.damage, radius: opts.radius || 6,
    color: opts.color || '#fff',
    distTraveled: 0, maxRange: opts.range || 520,
    knockback: opts.knockback || 5,
    homing: opts.homing || false,
    isRocket: opts.isRocket || false,
    blastRadius: opts.blastRadius || 85,
    isBoomerang: opts.isBoomerang || false,
    timer: 0, pierce: opts.pierce || 1,
    hitList: (opts.pierce || 1) > 1 ? [] : null,
    renderStyle: opts.renderStyle || 'milk'
  });
}

function updateWeapons(dt) {
  const p = st.player;
  const nearest = findNearestEnemy(p.x, p.y, 650);
  if (nearest) p.facingAngle = Math.atan2(nearest.y - p.y, nearest.x - p.x);
  const aimAngle = p.facingAngle;

  for (const id in p.weapons) {
    const lv = p.weapons[id];
    const w = WEAPON_DB[id];
    if (id === 'pacifier') continue;
    p.cooldowns[id] -= dt * p.atkSpeedMult * (1 + (lv-1) * 0.08);
    if (p.cooldowns[id] > 0) continue;
    const dmg = w.baseDamage * (1 + (lv-1) * 0.28);

    if (id === 'milk') {
      if (!nearest) continue;
      p.cooldowns[id] = w.baseCd;
      const shots = 1 + p.multishot + Math.floor(lv/3);
      for (let i = 0; i < shots; i++) {
        const s = (i - (shots-1)/2) * 0.11;
        spawnProjectile({ x: p.x, y: p.y, angle: aimAngle + s, speed: w.speed,
          damage: dmg, radius: 6, color: '#ffffff', range: w.range,
          knockback: 7, renderStyle: 'milk' });
      }
      p.recoil = 5;
      Sound.sfx.zip && Sound.sfx.zip();
    } else if (id === 'syringe') {
      if (!nearest) continue;
      p.cooldowns[id] = w.baseCd;
      const pellets = w.pellets + p.multishot + lv;
      for (let i = 0; i < pellets; i++) {
        const off = (Math.random()-.5) * w.spread;
        spawnProjectile({ x: p.x, y: p.y, angle: aimAngle + off,
          speed: w.speed * (0.9 + Math.random()*0.2),
          damage: dmg, radius: 6, color: '#38bdf8', range: w.range,
          knockback: 14, pierce: 2, renderStyle: 'syringe' });
      }
      p.recoil = 7;
      Sound.sfx.zip && Sound.sfx.zip();
    } else if (id === 'bubble') {
      if (!nearest) continue;
      p.cooldowns[id] = w.baseCd;
      const bolts = 1 + p.multishot + Math.floor(lv/2);
      for (let i = 0; i < bolts; i++) {
        const s = (i - (bolts-1)/2) * 0.26;
        spawnProjectile({ x: p.x, y: p.y, angle: aimAngle + s,
          speed: w.speed, damage: dmg, radius: 9, color: '#f472b6',
          range: w.range, homing: true, knockback: 6, renderStyle: 'bubble' });
      }
      Sound.sfx.zip && Sound.sfx.zip();
    } else if (id === 'powder') {
      if (!nearest) continue;
      p.cooldowns[id] = w.baseCd;
      const cnt = 1 + Math.floor(p.multishot/2) + Math.floor(lv/3);
      for (let i = 0; i < cnt; i++) {
        const s = (i - (cnt-1)/2) * 0.22;
        spawnProjectile({ x: p.x, y: p.y, angle: aimAngle + s,
          speed: w.speed, damage: dmg, radius: 10, color: '#f8fafc',
          range: 640, isRocket: true,
          blastRadius: w.blastRadius + lv*12, homing: true,
          renderStyle: 'powder' });
      }
      p.recoil = 6;
      Sound.sfx.zip && Sound.sfx.zip();
    } else if (id === 'rattle') {
      p.cooldowns[id] = w.baseCd;
      const cnt = 1 + p.multishot + Math.floor(lv/2);
      for (let i = 0; i < cnt; i++) {
        const ang = aimAngle + (i * (Math.PI*2/cnt));
        spawnProjectile({ x: p.x, y: p.y, angle: ang,
          speed: w.speed, damage: dmg, radius: 12, color: '#a78bfa',
          range: 850, isBoomerang: true, pierce: 99, renderStyle: 'rattle' });
      }
      Sound.sfx.zip && Sound.sfx.zip();
    } else if (id === 'lightning') {
      const target = findNearestEnemy(p.x, p.y, w.range);
      if (!target) continue;
      p.cooldowns[id] = w.baseCd;
      const bounces = w.bounces + lv + p.multishot;
      const hitList = [];
      let cur = target, prevX = p.x, prevY = p.y;
      for (let b = 0; b < bounces && cur; b++) {
        hitList.push(cur);
        st.lightningBolts.push({ x1: prevX, y1: prevY, x2: cur.x, y2: cur.y, life: 0.16 });
        const nx = cur.x, ny = cur.y;
        dealDamage(cur, dmg, 4, prevX, prevY);
        prevX = nx; prevY = ny;
        cur = findNearestEnemy(prevX, prevY, 240, hitList);
      }
      Sound.sfx.zip && Sound.sfx.zip();
    } else if (id === 'aura') {
      p.cooldowns[id] = w.baseCd;
      const rad = w.radius + (lv-1) * 16;
      const snapshot = st.enemies.slice();
      for (let i = 0; i < snapshot.length; i++) {
        const e = snapshot[i];
        if (!e || e.isDead) continue;
        if (Math.hypot(e.x-p.x, e.y-p.y) <= rad + e.radius)
          dealDamage(e, dmg, 4, p.x, p.y);
      }
    }
  }

  if (p.weapons.pacifier) {
    const lv = p.weapons.pacifier;
    const w = WEAPON_DB.pacifier;
    const count = w.count + lv + p.multishot;
    const rad = w.orbitRadius + lv * 6;
    p.orbitAngle += dt * w.orbitSpeed * p.atkSpeedMult;
    for (let i = 0; i < count; i++) {
      const ang = p.orbitAngle + (i * Math.PI*2/count);
      const bx = p.x + Math.cos(ang) * rad;
      const by = p.y + Math.sin(ang) * rad;
      for (let j = st.enemies.length - 1; j >= 0; j--) {
        const e = st.enemies[j];
        if (!e || e.isDead) continue;
        if (Math.hypot(e.x-bx, e.y-by) <= e.radius + 15) {
          if (!e.pacifierHitCd || e.pacifierHitCd <= 0) {
            e.pacifierHitCd = 0.22;
            dealDamage(e, w.baseDamage * (1 + (lv-1)*0.25), 10, p.x, p.y);
          }
        }
      }
    }
  }
}

/* ================= XP / LEVEL UP ================= */
function gainXp(amount) {
  const p = st.player;
  p.xp += Math.round(amount * p.xpMult);
  while (p.xp >= p.xpToNext) {
    p.xp -= p.xpToNext;
    p.level++;
    p.xpToNext = Math.floor(22 + p.level*16 + Math.pow(p.level, 1.48)*4);
    st.pendingLevelUps++;
  }
  if (st.pendingLevelUps > 0 && !st.cardActive) triggerLevelUp();
  updateHUD();
}

function triggerLevelUp() {
  st.cardActive = true;
  st.state = 'levelup';
  st.cardChoices = generateCards();
  Sound.sfx.catchOk && Sound.sfx.catchOk();
}

function generateCards() {
  const p = st.player;
  const allKeys = Object.keys(WEAPON_DB).concat(Object.keys(PASSIVE_DB));
  const shuffled = allKeys.sort(() => Math.random() - 0.5).slice(0, 3);
  return shuffled.map(id => {
    const item = WEAPON_DB[id] || PASSIVE_DB[id];
    const curLv = p.weapons[id] || p.passives[id] || 0;
    const roll = Math.random();
    let rarity = 'common';
    if (roll > 0.92) rarity = 'legendary';
    else if (roll > 0.75) rarity = 'epic';
    else if (roll > 0.45) rarity = 'rare';
    return { id, item, curLv, rarity };
  });
}

function selectCard(idx) {
  const c = st.cardChoices[idx];
  if (!c) return;
  applyUpgrade(c.id);
  if (c.rarity === 'legendary') applyUpgrade(c.id);
  st.pendingLevelUps--;
  if (st.pendingLevelUps > 0) {
    st.cardChoices = generateCards();
  } else {
    st.cardActive = false;
    st.state = 'playing';
    st.cardChoices = [];
  }
  Sound.sfx.catchOk && Sound.sfx.catchOk();
  updateHUD();
}

function applyUpgrade(id) {
  const p = st.player;
  if (WEAPON_DB[id]) {
    p.weapons[id] = (p.weapons[id] || 0) + 1;
    if (!p.cooldowns[id]) p.cooldowns[id] = 0;
  } else if (PASSIVE_DB[id]) {
    p.passives[id] = (p.passives[id] || 0) + 1;
    if (id === 'atkSpeed') p.atkSpeedMult += 0.12;
    if (id === 'damageUp') p.dmgMult += 0.15;
    if (id === 'multishot') p.multishot += 1;
    if (id === 'critChance') { p.critChance += 0.08; p.critDmg += 0.20; }
    if (id === 'moveSpeed') { p.speed *= 1.10; p.dashMaxCd = Math.max(1.1, p.dashMaxCd*0.9); }
    if (id === 'maxHp') { p.maxHp += 30; p.hp = Math.min(p.maxHp, p.hp+30); p.hpRegen += 1.5; }
  }
}

/* ================= FINISH ================= */
function finishGame(win) {
  if (st.state === 'over') return;
  st.state = 'over';
  const p = st.player;
  const score = p.kills * 10 + p.level * 50;
  const stars = win ? (p.kills >= 200 ? 3 : p.kills >= 100 ? 2 : 1) : 0;
  LR.G.finish({
    win, score, stars,
    title: win ? 'CHIẾN THẮNG VI KHUẨN!' : 'EM BÉ BUỒN NGỦ!',
    msg: win ? 'Bé đã tiêu diệt siêu vi khuẩn và bảo vệ sức khỏe!' :
               'Đừng lo! Bé nghỉ ngơi rồi mai chiến đấu tiếp nhé.',
    rows: [
      ['Đợt đạt được', st.wave],
      ['Cấp độ', p.level],
      ['Vi khuẩn đã diệt', p.kills],
      ['Điểm', score]
    ]
  });
}

/* ================= PARTICLE HELPERS ================= */
function spawnParticles(x, y, color, count, speed) {
  for (let i = 0; i < count && st.particles.length < 60; i++) {
    const a = Math.random() * Math.PI * 2;
    const s = 40 + Math.random() * speed;
    st.particles.push({
      x, y, vx: Math.cos(a)*s, vy: Math.sin(a)*s,
      color, size: 2 + Math.random()*3, life: 0.4 + Math.random()*0.3, maxLife: 0.7
    });
  }
}

/* ================= UPDATE ================= */
function update(dt) {
  if (!st || st.state !== 'playing' || st.cardActive) return;
  const p = st.player;
  st.time += dt;

  if (st.pendingWin) {
    st.winTimer -= dt;
    if (st.winTimer <= 0) { finishGame(true); return; }
  }

  // Slow decay
  if (p.slowTimer > 0) {
    p.slowTimer -= dt;
    p.slowFactor = 0.55;
  } else {
    p.slowFactor = 1;
  }

  if (p.hp < p.maxHp) p.hp = Math.min(p.maxHp, p.hp + p.hpRegen * dt);
  if (p.hitFlash > 0) p.hitFlash -= dt;
  if (p.invulnTimer > 0) p.invulnTimer -= dt;
  if (p.recoil > 0) p.recoil = Math.max(0, p.recoil - dt * 35);
  if (p.dashCooldown > 0) p.dashCooldown = Math.max(0, p.dashCooldown - dt);

  // Input
  let moveX = 0, moveY = 0;
  if (st.keys['KeyW'] || st.keys['ArrowUp']) moveY -= 1;
  if (st.keys['KeyS'] || st.keys['ArrowDown']) moveY += 1;
  if (st.keys['KeyA'] || st.keys['ArrowLeft']) moveX -= 1;
  if (st.keys['KeyD'] || st.keys['ArrowRight']) moveX += 1;
  if (st.joystick.active) {
    moveX += st.joystick.dx;
    moveY += st.joystick.dy;
  }
  const len = Math.hypot(moveX, moveY);
  if (len > 1) { moveX /= len; moveY /= len; }

  if (p.dashTimer > 0) {
    p.dashTimer -= dt;
    p.x += p.dashVx * dt;
    p.y += p.dashVy * dt;
  } else {
    const effSpeed = p.speed * p.slowFactor;
    p.vx = moveX * effSpeed;
    p.vy = moveY * effSpeed;
    p.x += p.vx * dt;
    p.y += p.vy * dt;
    if (len > 0.1) p.walkAnim += dt * 14;
  }
  p.x = clamp(p.x, 40, WORLD_SIZE - 40);
  p.y = clamp(p.y, 40, WORLD_SIZE - 40);

  st.camera.x += (p.x - st.camera.x) * Math.min(1, dt * 10);
  st.camera.y += (p.y - st.camera.y) * Math.min(1, dt * 10);

  // Wave
  st.waveTimer -= dt;
  if (st.waveTimer <= 0) {
    st.wave++;
    st.waveTimer = Math.min(50, WAVE_DURATION + st.wave * 2);
    spawnCrate();
    if (st.wave % WIN_BOSS_WAVE === 0) spawnEnemy('boss');
  }

  const spawnInt = Math.max(0.18, 1.0 - st.wave * 0.08);
  st.spawnTimer += dt;
  if (st.spawnTimer >= spawnInt && st.enemies.length < 85) {
    st.spawnTimer = 0;
    const batch = 1 + Math.floor(st.wave / 2.2);
    for (let i = 0; i < batch; i++) spawnEnemy();
  }
  st.crateTimer -= dt;
  if (st.crateTimer <= 0) { st.crateTimer = 18; spawnCrate(); }

  updateWeapons(dt);

  // Projectiles
  for (let i = st.projectiles.length - 1; i >= 0; i--) {
    const proj = st.projectiles[i];
    proj.timer += dt;
    if (proj.homing) {
      const t = findNearestEnemy(proj.x, proj.y, 440);
      if (t) {
        const desired = Math.atan2(t.y - proj.y, t.x - proj.x);
        let diff = desired - proj.angle;
        while (diff < -Math.PI) diff += Math.PI*2;
        while (diff > Math.PI) diff -= Math.PI*2;
        proj.angle += diff * Math.min(1, dt * 7.5);
        proj.vx = Math.cos(proj.angle) * proj.speed;
        proj.vy = Math.sin(proj.angle) * proj.speed;
      }
    }
    if (proj.isBoomerang && proj.timer > 0.5) {
      const bA = Math.atan2(p.y - proj.y, p.x - proj.x);
      proj.vx = Math.cos(bA) * proj.speed * 1.15;
      proj.vy = Math.sin(bA) * proj.speed * 1.15;
      if (Math.hypot(p.x - proj.x, p.y - proj.y) < 25) {
        removeFast(st.projectiles, i); continue;
      }
    }
    proj.x += proj.vx * dt;
    proj.y += proj.vy * dt;
    proj.distTraveled += proj.speed * dt;

    for (let c = st.crates.length - 1; c >= 0; c--) {
      const cr = st.crates[c];
      if (Math.hypot(cr.x - proj.x, cr.y - proj.y) <= cr.radius + proj.radius) {
        cr.hp -= proj.damage;
        cr.hitFlash = 0.12;
        if (cr.hp <= 0) openCrate(cr, c);
        if (!proj.isBoomerang) proj.distTraveled = proj.maxRange + 10;
        break;
      }
    }

    for (let j = st.enemies.length - 1; j >= 0; j--) {
      const e = st.enemies[j];
      if (!e || e.isDead) continue;
      if (proj.hitList && proj.hitList.indexOf(e) !== -1) continue;
      if (Math.hypot(e.x - proj.x, e.y - proj.y) <= e.radius + proj.radius) {
        if (proj.hitList) proj.hitList.push(e);
        if (proj.isRocket) {
          createExplosion(proj.x, proj.y, proj.blastRadius, proj.damage, false, '#f8fafc');
          proj.pierce = 0;
        } else {
          dealDamage(e, proj.damage, proj.knockback, proj.x, proj.y);
          proj.pierce--;
        }
        if (proj.pierce <= 0) break;
      }
    }
    if (proj.pierce <= 0 || proj.distTraveled >= proj.maxRange) {
      removeFast(st.projectiles, i);
    }
  }

  // Enemy projectiles
  for (let i = st.enemyProjectiles.length - 1; i >= 0; i--) {
    const ep = st.enemyProjectiles[i];
    ep.x += ep.vx * dt; ep.y += ep.vy * dt;
    ep.life -= dt;
    if (Math.hypot(ep.x - p.x, ep.y - p.y) <= ep.radius + p.radius*0.75) {
      damagePlayer(ep.damage);
      removeFast(st.enemyProjectiles, i);
      continue;
    }
    if (ep.life <= 0) removeFast(st.enemyProjectiles, i);
  }

  // Enemies
  for (let i = st.enemies.length - 1; i >= 0; i--) {
    const e = st.enemies[i];
    if (!e || e.isDead) continue;
    if (e.hitFlash > 0) e.hitFlash -= dt;
    if (e.pacifierHitCd > 0) e.pacifierHitCd -= dt;

    const dx = p.x - e.x, dy = p.y - e.y;
    const dist = Math.hypot(dx, dy) || 1;

    if (e.type === 'sprinter') {
      // Trail
      e.trail = e.trail || [];
      e.trail.push({ x: e.x, y: e.y, life: 0.22 });
      if (e.trail.length > 4) e.trail.shift();
    }

    if (e.type === 'coronavirus') {
      if (dist > 230) {
        e.x += (dx/dist) * e.speed * dt;
        e.y += (dy/dist) * e.speed * dt;
      }
      e.shootCd -= dt;
      if (e.shootCd <= 0 && dist < 500) {
        e.shootCd = 2.1;
        if (st.enemyProjectiles.length < 110) {
          const a = Math.atan2(dy, dx);
          st.enemyProjectiles.push({
            x: e.x, y: e.y,
            vx: Math.cos(a) * 240, vy: Math.sin(a) * 240,
            radius: 8, damage: e.damage, life: 3.0
          });
        }
      }
    } else if (e.type === 'boss') {
      e.x += (dx/dist) * e.speed * dt;
      e.y += (dy/dist) * e.speed * dt;
      e.skillCd -= dt;
      if (e.skillCd <= 0) {
        e.skillCd = 2.8;
        for (let b = 0; b < 10; b++) {
          if (st.enemyProjectiles.length >= 110) break;
          const a = (b * Math.PI*2/10) + st.time;
          st.enemyProjectiles.push({
            x: e.x, y: e.y,
            vx: Math.cos(a) * 230, vy: Math.sin(a) * 230,
            radius: 9, damage: e.damage * 0.85, life: 3.5
          });
        }
      }
    } else {
      e.x += (dx/dist) * e.speed * dt;
      e.y += (dy/dist) * e.speed * dt;
    }

    // Contact with player
    if (dist <= e.radius + p.radius * 0.85) {
      if (e.type === 'sporebomb') {
        e.isDead = true;
        removeFast(st.enemies, i);
        createExplosion(e.x, e.y, 90, e.damage, true, '#fb923c');
        continue;
      } else if (e.type === 'sprinter') {
        // ⭐ MỚI: damage nhỏ + slow, áp dụng bất kể invuln
        p.slowTimer = Math.max(p.slowTimer, 2.2);
        if (p.invulnTimer <= 0) damagePlayer(e.damage);
      } else {
        damagePlayer(e.damage);
      }
    }
  }

  // Gems
  for (let i = st.gems.length - 1; i >= 0; i--) {
    const g = st.gems[i];
    if (!g) continue;
    const d = Math.hypot(p.x - g.x, p.y - g.y);
    if (d <= p.radius + g.radius + 4) {
      if (g.kind === 'xp') { Sound.sfx.catchOk && Sound.sfx.catchOk(); gainXp(g.value); }
      else if (g.kind === 'gold') { Sound.sfx.tick && Sound.sfx.tick(); p.goldEarned += g.value; }
      else if (g.kind === 'heal') {
        p.hp = Math.min(p.maxHp, p.hp + 40);
        st.floatingTexts.push({ x: p.x, y: p.y - 25, text: '+40 HP',
          color: '#4ade80', size: 16, vy: -45, life: 0.7, maxLife: 0.7 });
      } else if (g.kind === 'magnet') {
        let totalXp = 0;
        for (const gg of st.gems) if (gg.kind === 'xp') totalXp += gg.value;
        st.gems.length = 0;
        if (totalXp > 0) gainXp(totalXp);
      } else if (g.kind === 'bomb') {
        createExplosion(p.x, p.y, 340, 180 * p.dmgMult, false, '#2dd4bf');
      }
      removeFast(st.gems, i);
    }
  }

  // Particles
  for (let i = st.particles.length - 1; i >= 0; i--) {
    const pt = st.particles[i];
    pt.life -= dt;
    if (pt.vx || pt.vy) {
      pt.x += pt.vx * dt; pt.y += pt.vy * dt;
      pt.vx *= 0.94; pt.vy *= 0.94;
    }
    if (pt.life <= 0) removeFast(st.particles, i);
  }
  for (let i = st.lightningBolts.length - 1; i >= 0; i--) {
    st.lightningBolts[i].life -= dt;
    if (st.lightningBolts[i].life <= 0) removeFast(st.lightningBolts, i);
  }
  for (let i = st.floatingTexts.length - 1; i >= 0; i--) {
    const ft = st.floatingTexts[i];
    ft.y += ft.vy * dt;
    ft.life -= dt;
    if (ft.life <= 0) removeFast(st.floatingTexts, i);
  }
}

function openCrate(cr, idx) {
  removeFast(st.crates, idx);
  Sound.sfx.killBig && Sound.sfx.killBig();
  const roll = Math.random();
  let kind = 'heal', color = '#4ade80';
  if (roll < 0.35) { kind = 'magnet'; color = '#38bdf8'; }
  else if (roll < 0.70) { kind = 'bomb'; color = '#2dd4bf'; }
  st.gems.push({ x: cr.x, y: cr.y, kind, value: 1, color, radius: 12 });
}

/* ================= DRAW ================= */
function roundRect(ctx, x, y, w, h, r) {
  if (ctx.roundRect) { ctx.beginPath(); ctx.roundRect(x, y, w, h, r); return; }
  ctx.beginPath();
  ctx.moveTo(x+r, y); ctx.lineTo(x+w-r, y); ctx.quadraticCurveTo(x+w, y, x+w, y+r);
  ctx.lineTo(x+w, y+h-r); ctx.quadraticCurveTo(x+w, y+h, x+w-r, y+h);
  ctx.lineTo(x+r, y+h); ctx.quadraticCurveTo(x, y+h, x, y+h-r);
  ctx.lineTo(x, y+r); ctx.quadraticCurveTo(x, y, x+r, y);
  ctx.closePath();
}

function drawWorldBackground(ctx) {
  // Nền caro
  const tile = 64;
  const camX = st.camera.x, camY = st.camera.y;
  const s = layout.scale;
  const halfW = LR.G.W / (2*s), halfH = LR.G.H / (2*s);
  const left = camX - halfW - 64, right = camX + halfW + 64;
  const top = camY - halfH - 64, bottom = camY + halfH + 64;

  ctx.fillStyle = '#0a1d30';
  ctx.fillRect(left, top, right-left, bottom-top);
  ctx.fillStyle = '#0e243a';
  const startX = Math.floor(left / tile) * tile;
  const startY = Math.floor(top / tile) * tile;
  for (let x = startX; x < right; x += tile) {
    for (let y = startY; y < bottom; y += tile) {
      if (((x/tile) + (y/tile)) % 2 === 0) {
        ctx.fillRect(Math.max(x, left), Math.max(y, top),
          Math.min(tile, right - Math.max(x, left)),
          Math.min(tile, bottom - Math.max(y, top)));
      }
    }
  }

  // Viền thế giới
  ctx.strokeStyle = '#38bdf8';
  ctx.lineWidth = 6;
  ctx.strokeRect(0, 0, WORLD_SIZE, WORLD_SIZE);
}

function drawEnemy(ctx, e) {
  ctx.save();
  const squish = Math.sin(st.time * 9 + e.animOffset);
  ctx.translate(e.x, e.y);
  ctx.scale(1 + squish*0.06, 1 - squish*0.06);

  // Trail của sprinter
  if (e.type === 'sprinter' && e.trail) {
    for (let i = 0; i < e.trail.length; i++) {
      const t = e.trail[i];
      const a = t.life / 0.22 * 0.5;
      ctx.globalAlpha = a;
      ctx.fillStyle = '#fde047';
      ctx.beginPath();
      ctx.arc(t.x - e.x, t.y - e.y, e.radius * (0.5 + i * 0.1), 0, Math.PI*2);
      ctx.fill();
    }
    ctx.globalAlpha = 1;
  }

  // Shadow
  ctx.fillStyle = 'rgba(0,0,0,0.3)';
  ctx.beginPath();
  ctx.ellipse(0, e.radius*0.9, e.radius*0.8, e.radius*0.3, 0, 0, Math.PI*2);
  ctx.fill();

  // Spikes
  if (e.type === 'coronavirus' || e.type === 'boss' || e.type === 'sporebomb') {
    const spikes = e.type === 'boss' ? 12 : 8;
    ctx.strokeStyle = e.hitFlash > 0 ? '#ffffff' : e.color;
    ctx.lineWidth = e.type === 'boss' ? 4 : 2.5;
    for (let s = 0; s < spikes; s++) {
      const a = (s * Math.PI*2/spikes) + st.time * 1.5;
      const rOut = e.radius + (e.type === 'boss' ? 10 : 6);
      ctx.beginPath();
      ctx.moveTo(0, 0);
      ctx.lineTo(Math.cos(a)*rOut, Math.sin(a)*rOut);
      ctx.stroke();
      ctx.fillStyle = e.hitFlash > 0 ? '#ffffff' : '#fde047';
      ctx.beginPath();
      ctx.arc(Math.cos(a)*rOut, Math.sin(a)*rOut, e.type === 'boss' ? 4 : 2.5, 0, Math.PI*2);
      ctx.fill();
    }
  }

  // Body
  ctx.fillStyle = e.hitFlash > 0 ? '#ffffff' : e.color;
  ctx.strokeStyle = '#090d16';
  ctx.lineWidth = 2.5;
  ctx.beginPath();
  if (e.type === 'bacillus') {
    roundRect(ctx, -e.radius*1.15, -e.radius*0.8, e.radius*2.3, e.radius*1.6, 12);
  } else if (e.type === 'splitter') {
    // ⭐ Splitter: hình tròn có đường chia giữa
    ctx.arc(0, 0, e.radius, 0, Math.PI*2);
  } else if (e.type === 'splitling') {
    ctx.arc(0, 0, e.radius, 0, Math.PI*2);
  } else if (e.type === 'sprinter') {
    // Sprinter: oval dài theo hướng chạy
    ctx.ellipse(0, 0, e.radius * 1.5, e.radius * 0.85, 0, 0, Math.PI*2);
  } else {
    ctx.arc(0, 0, e.radius, 0, Math.PI*2);
  }
  ctx.fill();
  ctx.stroke();

  // Core
  if (e.hitFlash <= 0) {
    ctx.fillStyle = e.coreColor || 'rgba(0,0,0,0.25)';
    ctx.beginPath();
    ctx.arc(-e.radius*0.15, 2, e.radius*0.5, 0, Math.PI*2);
    ctx.fill();
  }

  // Splitter dividing line
  if (e.type === 'splitter') {
    ctx.strokeStyle = '#ffffff';
    ctx.lineWidth = 1.5;
    ctx.setLineDash([3, 3]);
    ctx.beginPath();
    ctx.moveTo(0, -e.radius*0.9);
    ctx.lineTo(0, e.radius*0.9);
    ctx.stroke();
    ctx.setLineDash([]);
  }

  // Eyes
  const p = st.player;
  const angToP = p ? Math.atan2(p.y - e.y, p.x - e.x) : 0;
  const ex = Math.cos(angToP) * (e.radius * 0.28);
  const ey = Math.sin(angToP) * (e.radius * 0.28);
  const eyeR = e.type === 'boss' ? 7 : 3.8;
  ctx.fillStyle = '#ffffff';
  ctx.beginPath();
  ctx.arc(ex - eyeR*1.2, ey - 2, eyeR, 0, Math.PI*2);
  ctx.arc(ex + eyeR*1.2, ey - 2, eyeR, 0, Math.PI*2);
  ctx.fill();
  ctx.fillStyle = '#090d16';
  ctx.beginPath();
  ctx.arc(ex - eyeR*1.1, ey - 2, eyeR*0.5, 0, Math.PI*2);
  ctx.arc(ex + eyeR*1.3, ey - 2, eyeR*0.5, 0, Math.PI*2);
  ctx.fill();

  // HP bar
  if (e.hp < e.maxHp && e.type !== 'boss') {
    const bw = e.radius * 1.8;
    ctx.fillStyle = 'rgba(15, 23, 42, 0.85)';
    ctx.fillRect(-bw/2, -e.radius - 10, bw, 4);
    ctx.fillStyle = '#4ade80';
    ctx.fillRect(-bw/2, -e.radius - 10, bw * (e.hp/e.maxHp), 4);
  }
  ctx.restore();
}

function drawPlayer(ctx) {
  const p = st.player;
  if (!p) return;

  // Pacifier orbit
  if (p.weapons.pacifier) {
    const lv = p.weapons.pacifier;
    const w = WEAPON_DB.pacifier;
    const count = w.count + lv + p.multishot;
    const rad = w.orbitRadius + lv * 6;
    for (let i = 0; i < count; i++) {
      const a = p.orbitAngle + (i * Math.PI*2/count);
      const bx = p.x + Math.cos(a) * rad;
      const by = p.y + Math.sin(a) * rad;
      ctx.save();
      ctx.translate(bx, by);
      ctx.rotate(a + Math.PI/2);
      ctx.fillStyle = '#fb7185';
      ctx.strokeStyle = '#ffffff';
      ctx.lineWidth = 1.8;
      ctx.beginPath();
      ctx.arc(0, -2, 10, 0, Math.PI*2);
      ctx.fill(); ctx.stroke();
      ctx.restore();
    }
  }

  ctx.save();
  const bob = Math.sin(p.walkAnim) * 2.8;
  ctx.translate(p.x, p.y + bob);

  if (p.invulnTimer > 0) {
    ctx.strokeStyle = '#f472b6';
    ctx.fillStyle = 'rgba(244,114,182,0.15)';
    ctx.lineWidth = 2.5;
    ctx.beginPath();
    ctx.arc(0, 0, p.radius + 8, 0, Math.PI*2);
    ctx.fill(); ctx.stroke();
  }

  // Slow indicator ⭐
  if (p.slowTimer > 0) {
    ctx.strokeStyle = '#38bdf8';
    ctx.lineWidth = 3;
    ctx.setLineDash([5, 5]);
    ctx.beginPath();
    ctx.arc(0, 0, p.radius + 12, 0, Math.PI*2);
    ctx.stroke();
    ctx.setLineDash([]);
  }

  // Shadow
  ctx.fillStyle = 'rgba(0,0,0,0.35)';
  ctx.beginPath();
  ctx.ellipse(0, p.radius*0.95, p.radius*0.85, p.radius*0.32, 0, 0, Math.PI*2);
  ctx.fill();

  // Body
  ctx.fillStyle = p.hitFlash > 0 ? '#ffffff' : '#fed7aa';
  ctx.strokeStyle = '#0f172a';
  ctx.lineWidth = 2.8;
  ctx.beginPath();
  ctx.arc(0, -2, p.radius*0.92, 0, Math.PI*2);
  ctx.fill(); ctx.stroke();

  // Cap (boy)
  ctx.fillStyle = '#38bdf8';
  ctx.beginPath();
  ctx.arc(0, -6, p.radius*0.9, Math.PI*1.1, -0.1);
  ctx.fill();
  ctx.fillStyle = '#0284c7';
  ctx.fillRect(-p.radius*0.8, -8, p.radius*1.6, 5);

  // Cheeks
  const lookX = Math.cos(p.facingAngle) * 3.5;
  const lookY = Math.sin(p.facingAngle) * 3.5;
  ctx.fillStyle = '#fb7185';
  ctx.globalAlpha = 0.65;
  ctx.beginPath();
  ctx.arc(lookX - 8, lookY + 3, 3.5, 0, Math.PI*2);
  ctx.arc(lookX + 8, lookY + 3, 3.5, 0, Math.PI*2);
  ctx.fill();
  ctx.globalAlpha = 1;

  // Eyes
  ctx.fillStyle = '#0f172a';
  ctx.beginPath();
  ctx.arc(lookX - 5.5, lookY - 2, 3.2, 0, Math.PI*2);
  ctx.arc(lookX + 5.5, lookY - 2, 3.2, 0, Math.PI*2);
  ctx.fill();

  // Pacifier
  ctx.fillStyle = '#0284c7';
  ctx.strokeStyle = '#ffffff';
  ctx.lineWidth = 1.2;
  ctx.beginPath();
  ctx.arc(lookX, lookY + 5, 4, 0, Math.PI*2);
  ctx.fill(); ctx.stroke();

  // Gun
  ctx.rotate(p.facingAngle);
  ctx.translate(p.radius - p.recoil, 5);
  ctx.fillStyle = '#ffffff';
  ctx.strokeStyle = '#38bdf8';
  ctx.lineWidth = 1.8;
  roundRect(ctx, 0, -4, 12, 8, 2.5);
  ctx.fill(); ctx.stroke();

  ctx.restore();
}

function drawGame(ctx) {
  const G = LR.G;
  const dpr = G.dpr || 1;
  ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
  ctx.clearRect(0, 0, G.W, G.H);
  if (!st) return;

  ctx.fillStyle = '#061320';
  ctx.fillRect(0, 0, G.W, G.H);

  const p = st.player;

  // World
  ctx.save();
  ctx.translate(G.W/2, G.H/2);
  ctx.scale(layout.scale, layout.scale);
  ctx.translate(-st.camera.x, -st.camera.y);

  drawWorldBackground(ctx);

  // Aura
  if (p.weapons.aura) {
    const lv = p.weapons.aura;
    const rad = WEAPON_DB.aura.radius + (lv-1) * 16;
    ctx.fillStyle = 'rgba(45, 212, 191, 0.1)';
    ctx.strokeStyle = 'rgba(56, 189, 248, 0.35)';
    ctx.lineWidth = 2;
    ctx.beginPath();
    ctx.arc(p.x, p.y, rad, 0, Math.PI*2);
    ctx.fill(); ctx.stroke();
  }

  // Crates
  for (const c of st.crates) {
    ctx.save();
    ctx.translate(c.x, c.y);
    ctx.fillStyle = c.hitFlash > 0 ? '#fecdd3' : '#f8fafc';
    ctx.strokeStyle = '#ef4444';
    ctx.lineWidth = 3;
    roundRect(ctx, -c.radius, -c.radius, c.radius*2, c.radius*2, 6);
    ctx.fill(); ctx.stroke();
    ctx.fillStyle = '#ef4444';
    ctx.fillRect(-3, -9, 6, 18);
    ctx.fillRect(-9, -3, 18, 6);
    ctx.restore();
  }

  // Gems
  for (const g of st.gems) {
    ctx.save();
    ctx.translate(g.x, g.y);
    if (g.kind === 'xp') {
      ctx.fillStyle = g.color;
      ctx.beginPath(); ctx.arc(0, 0, g.radius, 0, Math.PI*2); ctx.fill();
      ctx.fillStyle = '#ffffff';
      ctx.beginPath(); ctx.arc(-2, -2, g.radius*0.35, 0, Math.PI*2); ctx.fill();
    } else if (g.kind === 'gold') {
      ctx.fillStyle = '#fbbf24';
      ctx.strokeStyle = '#ffffff';
      ctx.lineWidth = 1.2;
      roundRect(ctx, -g.radius*1.1, -g.radius*0.6, g.radius*2.2, g.radius*1.2, 5);
      ctx.fill(); ctx.stroke();
    } else {
      ctx.fillStyle = g.color;
      ctx.beginPath(); ctx.arc(0, 0, g.radius, 0, Math.PI*2); ctx.fill();
      ctx.font = 'bold 13px sans-serif';
      ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
      ctx.fillText(g.kind === 'heal' ? '🍼' : g.kind === 'magnet' ? '🧲' : '🧼', 0, 1);
    }
    ctx.restore();
  }

  // Enemies
  for (const e of st.enemies) drawEnemy(ctx, e);

  // Player
  drawPlayer(ctx);

  // Player projectiles
  for (const proj of st.projectiles) {
    ctx.save();
    ctx.translate(proj.x, proj.y);
    if (proj.renderStyle === 'bubble') {
      ctx.fillStyle = 'rgba(244,114,182,0.35)';
      ctx.strokeStyle = '#f9a8d4';
      ctx.lineWidth = 2;
      ctx.beginPath(); ctx.arc(0, 0, proj.radius, 0, Math.PI*2);
      ctx.fill(); ctx.stroke();
    } else if (proj.renderStyle === 'syringe') {
      ctx.rotate(proj.angle);
      ctx.fillStyle = '#e0f2fe';
      ctx.strokeStyle = '#0284c7';
      ctx.lineWidth = 1.8;
      ctx.fillRect(-7, -2.5, 14, 5);
      ctx.strokeRect(-7, -2.5, 14, 5);
    } else if (proj.renderStyle === 'rattle') {
      ctx.rotate(st.time * 16);
      ctx.fillStyle = '#c084fc';
      ctx.beginPath();
      ctx.arc(-5, 0, 6, 0, Math.PI*2);
      ctx.arc(5, 0, 6, 0, Math.PI*2);
      ctx.fill();
    } else {
      ctx.fillStyle = proj.color;
      ctx.beginPath(); ctx.arc(0, 0, proj.radius, 0, Math.PI*2); ctx.fill();
    }
    ctx.restore();
  }

  // Enemy projectiles
  for (const ep of st.enemyProjectiles) {
    ctx.save();
    ctx.translate(ep.x, ep.y);
    ctx.fillStyle = '#3b0714';
    ctx.beginPath(); ctx.arc(0, 0, ep.radius + 2.5, 0, Math.PI*2); ctx.fill();
    ctx.fillStyle = '#ff1744';
    ctx.beginPath();
    const spikes = 6;
    for (let s = 0; s < spikes*2; s++) {
      const rad = s % 2 === 0 ? ep.radius + 3 : ep.radius - 2;
      const a = (s * Math.PI)/spikes + st.time*7;
      if (s === 0) ctx.moveTo(Math.cos(a)*rad, Math.sin(a)*rad);
      else ctx.lineTo(Math.cos(a)*rad, Math.sin(a)*rad);
    }
    ctx.closePath(); ctx.fill();
    ctx.fillStyle = '#ffffff';
    ctx.beginPath(); ctx.arc(0, 0, ep.radius*0.45, 0, Math.PI*2); ctx.fill();
    ctx.restore();
  }

  // Lightning
  for (const b of st.lightningBolts) {
    ctx.strokeStyle = '#fde047';
    ctx.lineWidth = 3;
    ctx.beginPath();
    ctx.moveTo(b.x1, b.y1);
    ctx.lineTo(b.x2, b.y2);
    ctx.stroke();
  }

  // Particles
  for (const pt of st.particles) {
    ctx.save();
    ctx.globalAlpha = Math.max(0, pt.life / pt.maxLife);
    if (pt.isRing) {
      ctx.strokeStyle = pt.color;
      ctx.lineWidth = 3;
      const prog = 1 - pt.life / pt.maxLife;
      ctx.beginPath(); ctx.arc(pt.x, pt.y, pt.size * prog, 0, Math.PI*2); ctx.stroke();
    } else {
      ctx.fillStyle = pt.color;
      ctx.beginPath(); ctx.arc(pt.x, pt.y, pt.size, 0, Math.PI*2); ctx.fill();
    }
    ctx.restore();
  }

  // Floating texts
  for (const ft of st.floatingTexts) {
    ctx.save();
    ctx.globalAlpha = Math.max(0, ft.life / ft.maxLife);
    ctx.font = '900 ' + ft.size + 'px "Be Vietnam Pro", sans-serif';
    ctx.textAlign = 'center';
    ctx.strokeStyle = '#020617'; ctx.lineWidth = 3;
    ctx.strokeText(ft.text, ft.x, ft.y);
    ctx.fillStyle = ft.color;
    ctx.fillText(ft.text, ft.x, ft.y);
    ctx.restore();
  }

  ctx.restore();

  // Screen-space HUD
  drawScreenHUD(ctx);
  drawJoystick(ctx);
  drawDashButton(ctx);

  if (st.cardActive) drawCards(ctx);
}

function drawScreenHUD(ctx) {
  const G = LR.G, W = G.W, H = G.H;
  const p = st.player;
  const topY = (G.top || 0) + 4;

  // HP bar (bottom-left)
  const hpW = Math.min(240, W * 0.42);
  const hpH = 14;
  const hpX = 12, hpY = H - hpH - 12;
  ctx.fillStyle = 'rgba(15, 23, 42, 0.85)';
  roundRect(ctx, hpX - 2, hpY - 2, hpW + 4, hpH + 4, 8);
  ctx.fill();
  ctx.fillStyle = '#1e293b';
  roundRect(ctx, hpX, hpY, hpW, hpH, 6);
  ctx.fill();
  const hpRatio = Math.max(0, p.hp / p.maxHp);
  const hpGrad = ctx.createLinearGradient(hpX, 0, hpX + hpW, 0);
  hpGrad.addColorStop(0, '#f43f5e');
  hpGrad.addColorStop(1, '#10b981');
  ctx.fillStyle = hpGrad;
  roundRect(ctx, hpX, hpY, hpW * hpRatio, hpH, 6);
  ctx.fill();
  ctx.fillStyle = '#fff';
  ctx.font = '700 10px "Be Vietnam Pro", sans-serif';
  ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
  ctx.fillText(Math.ceil(p.hp) + ' / ' + p.maxHp, hpX + hpW/2, hpY + hpH/2);

  // XP bar (top, below HUD)
  const xpW = Math.min(W - 24, 340);
  const xpH = 10;
  const xpX = (W - xpW) / 2, xpY = topY;
  ctx.fillStyle = 'rgba(15, 23, 42, 0.85)';
  roundRect(ctx, xpX - 2, xpY - 2, xpW + 4, xpH + 4, 6);
  ctx.fill();
  ctx.fillStyle = '#1e293b';
  roundRect(ctx, xpX, xpY, xpW, xpH, 4);
  ctx.fill();
  const xpGrad = ctx.createLinearGradient(xpX, 0, xpX + xpW, 0);
  xpGrad.addColorStop(0, '#f472b6');
  xpGrad.addColorStop(1, '#38bdf8');
  ctx.fillStyle = xpGrad;
  roundRect(ctx, xpX, xpY, xpW * Math.min(1, p.xp / p.xpToNext), xpH, 4);
  ctx.fill();
  ctx.fillStyle = '#fff';
  ctx.font = '800 8px "Be Vietnam Pro", sans-serif';
  ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
  ctx.fillText(p.xp + ' / ' + p.xpToNext + ' XP', xpX + xpW/2, xpY + xpH/2);

  // Wave + timer (top-right of xp bar row)
  const waveTxt = 'ĐỢT ' + st.wave + '  ·  ' + Math.max(0, Math.ceil(st.waveTimer)) + 's';
  ctx.font = '900 11px "Be Vietnam Pro", sans-serif';
  const wtw = ctx.measureText(waveTxt).width + 16;
  ctx.fillStyle = 'rgba(15, 23, 42, 0.85)';
  roundRect(ctx, W - wtw - 10, xpY - 1, wtw, xpH + 6, 6);
  ctx.fill();
  ctx.fillStyle = '#22d3ee';
  ctx.textAlign = 'center';
  ctx.fillText(waveTxt, W - wtw/2 - 10, xpY + xpH/2 + 2);

  // Boss bar
  if (st.activeBoss) {
    const bw = Math.min(360, W * 0.65), bh = 14;
    const bx = (W - bw)/2, by = topY + xpH + 12;
    ctx.fillStyle = 'rgba(15, 23, 42, 0.9)';
    roundRect(ctx, bx - 3, by - 3, bw + 6, bh + 6, 8);
    ctx.fill();
    ctx.fillStyle = '#1e293b';
    roundRect(ctx, bx, by, bw, bh, 6);
    ctx.fill();
    const boss = st.activeBoss;
    const bg = ctx.createLinearGradient(bx, 0, bx + bw, 0);
    bg.addColorStop(0, '#84cc16'); bg.addColorStop(1, '#22d3ee');
    ctx.fillStyle = bg;
    roundRect(ctx, bx, by, bw * Math.max(0, boss.hp / boss.maxHp), bh, 6);
    ctx.fill();
    ctx.fillStyle = '#fff';
    ctx.font = '900 9px "Be Vietnam Pro", sans-serif';
    ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
    ctx.fillText('🦠 ' + boss.name + '  ' + Math.ceil(boss.hp) + '/' + Math.ceil(boss.maxHp), W/2, by + bh/2);
  }

  // Equipped icons (bottom-right compact)
  const wx = W - 10;
  const icons = [];
  for (const [id, lv] of Object.entries(p.weapons)) {
    icons.push({ icon: WEAPON_DB[id].icon, lv, color: '#f472b6' });
  }
  for (const [id, lv] of Object.entries(p.passives)) {
    icons.push({ icon: PASSIVE_DB[id].icon, lv, color: '#22d3ee' });
  }
  const iconSize = 22, gap = 4;
  const cols = Math.min(6, icons.length);
  icons.forEach((it, i) => {
    const col = i % cols, row = Math.floor(i / cols);
    const x = wx - (col + 1) * (iconSize + gap) + gap;
    const y = H - 12 - (row + 1) * (iconSize + gap) + gap - 20;
    ctx.fillStyle = 'rgba(15, 23, 42, 0.85)';
    roundRect(ctx, x, y, iconSize, iconSize, 6);
    ctx.fill();
    ctx.strokeStyle = it.color;
    ctx.lineWidth = 1;
    roundRect(ctx, x, y, iconSize, iconSize, 6);
    ctx.stroke();
    ctx.font = '12px sans-serif';
    ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
    ctx.fillText(it.icon, x + iconSize/2, y + iconSize/2 - 2);
    ctx.fillStyle = it.color;
    ctx.font = '800 7px "Be Vietnam Pro", sans-serif';
    ctx.fillText(it.lv, x + iconSize - 3, y + iconSize - 3);
  });
}

function drawJoystick(ctx) {
  if (LR.G.state !== 'play') return;
  const j = st.joystick;
  if (j.active) {
    ctx.save();
    ctx.strokeStyle = 'rgba(244, 114, 182, 0.55)';
    ctx.fillStyle = 'rgba(15, 23, 42, 0.4)';
    ctx.lineWidth = 3;
    ctx.beginPath(); ctx.arc(j.startX, j.startY, 56, 0, Math.PI*2);
    ctx.fill(); ctx.stroke();
    ctx.fillStyle = 'rgba(244, 114, 182, 0.9)';
    ctx.strokeStyle = '#ffffff';
    ctx.lineWidth = 2.5;
    ctx.beginPath(); ctx.arc(j.curX, j.curY, 22, 0, Math.PI*2);
    ctx.fill(); ctx.stroke();
    ctx.restore();
  }
}

function drawDashButton(ctx) {
  if (LR.G.state !== 'play' || !layout) return;
  const G = LR.G;
  const bx = G.W - 60, by = G.H - 110;
  const p = st.player;
  const ready = p.dashCooldown <= 0 && p.dashTimer <= 0;

  ctx.save();
  ctx.fillStyle = ready ? 'rgba(236, 72, 153, 0.85)' : 'rgba(30, 41, 59, 0.85)';
  ctx.strokeStyle = ready ? '#fbcfe8' : '#475569';
  ctx.lineWidth = 3;
  ctx.beginPath();
  ctx.arc(bx, by, 32, 0, Math.PI*2);
  ctx.fill(); ctx.stroke();

  ctx.fillStyle = '#fff';
  ctx.font = '900 14px "Be Vietnam Pro", sans-serif';
  ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
  if (ready) {
    ctx.fillText('⚡', bx, by - 4);
    ctx.font = '800 8px "Be Vietnam Pro", sans-serif';
    ctx.fillText('DASH', bx, by + 14);
  } else {
    ctx.font = '900 12px "Be Vietnam Pro", sans-serif';
    ctx.fillText(p.dashCooldown.toFixed(1), bx, by);
  }
  ctx.restore();
}

function drawCards(ctx) {
  const G = LR.G, W = G.W, H = G.H;
  ctx.fillStyle = 'rgba(2, 6, 23, 0.88)';
  ctx.fillRect(0, 0, W, H);

  // Title
  ctx.fillStyle = '#fbbf24';
  ctx.font = '900 20px "Be Vietnam Pro", sans-serif';
  ctx.textAlign = 'center';
  ctx.textBaseline = 'top';
  ctx.fillText('🍼 EM BÉ LÊN CẤP!', W/2, 20);
  ctx.fillStyle = '#cbd5e1';
  ctx.font = '700 12px "Be Vietnam Pro", sans-serif';
  ctx.fillText('Chọn 1 trang bị để tiếp tục', W/2, 48);

  // Layout cards
  const isNarrow = W < 720;
  const cards = st.cardChoices;
  st.cardRects = [];
  const top = 80;
  const bottom = 20;

  if (isNarrow) {
    const cardW = W - 30;
    const cardH = (H - top - bottom - 20) / 3;
    cards.forEach((c, i) => {
      const x = 15, y = top + i * (cardH + 8);
      st.cardRects.push({ x, y, w: cardW, h: cardH });
      drawCardRect(ctx, c, x, y, cardW, cardH);
    });
  } else {
    const cardW = (W - 60) / 3;
    const cardH = H - top - bottom;
    cards.forEach((c, i) => {
      const x = 15 + i * (cardW + 15);
      const y = top;
      st.cardRects.push({ x, y, w: cardW, h: cardH });
      drawCardRect(ctx, c, x, y, cardW, cardH);
    });
  }
}

function drawCardRect(ctx, card, x, y, w, h) {
  const rarityColors = {
    common: { border: '#94a3b8', bg1: '#1e293b', bg2: '#0f172a' },
    rare: { border: '#38bdf8', bg1: '#0c4a6e', bg2: '#0f172a' },
    epic: { border: '#c084fc', bg1: '#4c1d95', bg2: '#0f172a' },
    legendary: { border: '#fbbf24', bg1: '#78350f', bg2: '#1c1917' }
  };
  const rc = rarityColors[card.rarity];
  const grd = ctx.createLinearGradient(x, y, x, y + h);
  grd.addColorStop(0, rc.bg1);
  grd.addColorStop(1, rc.bg2);
  ctx.fillStyle = grd;
  roundRect(ctx, x, y, w, h, 14);
  ctx.fill();
  ctx.strokeStyle = rc.border;
  ctx.lineWidth = 3;
  roundRect(ctx, x, y, w, h, 14);
  ctx.stroke();

  const pad = 14;
  // Icon circle
  const iconSize = Math.min(64, h * 0.28, w * 0.32);
  const icx = x + w/2;
  const icy = y + pad + iconSize/2;
  ctx.fillStyle = 'rgba(15, 23, 42, 0.9)';
  ctx.strokeStyle = rc.border;
  ctx.lineWidth = 2;
  ctx.beginPath(); ctx.arc(icx, icy, iconSize/2, 0, Math.PI*2);
  ctx.fill(); ctx.stroke();
  ctx.font = (iconSize*0.7) + 'px sans-serif';
  ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
  ctx.fillText(card.item.icon, icx, icy);

  // Rarity badge + level
  const badgeTxt = card.rarity.toUpperCase();
  ctx.font = '900 9px "Be Vietnam Pro", sans-serif';
  const bw = ctx.measureText(badgeTxt).width + 14;
  ctx.fillStyle = rc.border;
  roundRect(ctx, x + 10, y + 8, bw, 16, 8);
  ctx.fill();
  ctx.fillStyle = card.rarity === 'common' || card.rarity === 'epic' ? '#0f172a' : '#0f172a';
  ctx.textAlign = 'left'; ctx.textBaseline = 'middle';
  ctx.fillText(badgeTxt, x + 17, y + 16);

  const lvTxt = card.curLv === 0 ? 'MỚI' : 'Lv ' + card.curLv + '→' + (card.curLv + (card.rarity === 'legendary' ? 2 : 1));
  ctx.font = '900 10px "Be Vietnam Pro", sans-serif';
  ctx.fillStyle = '#fbbf24';
  ctx.textAlign = 'right';
  ctx.fillText(lvTxt, x + w - 10, y + 16);

  // Name
  ctx.fillStyle = '#ffffff';
  ctx.font = '900 14px "Be Vietnam Pro", sans-serif';
  ctx.textAlign = 'center'; ctx.textBaseline = 'top';
  ctx.fillText(card.item.name, x + w/2, icy + iconSize/2 + 8, w - 20);

  // Type
  ctx.font = '700 9px "Be Vietnam Pro", sans-serif';
  ctx.fillStyle = card.item.type === 'weapon' ? '#f9a8d4' : '#67e8f9';
  ctx.fillText(card.item.type === 'weapon' ? '🍼 VŨ KHÍ' : '🛡️ NỘI TẠI', x + w/2, icy + iconSize/2 + 28);

  // Desc
  ctx.fillStyle = '#cbd5e1';
  ctx.font = '600 11px "Be Vietnam Pro", sans-serif';
  const descY = icy + iconSize/2 + 46;
  wrapText(ctx, card.item.desc, x + w/2, descY, w - 20, 14);
}

function wrapText(ctx, text, cx, y, maxW, lh) {
  const words = text.split(' ');
  let line = '';
  let curY = y;
  ctx.textAlign = 'center';
  ctx.textBaseline = 'top';
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

/* ================= INPUT ================= */
function onKeyDown(e) {
  if (!st) return;
  st.keys[e.code] = true;
  if (e.code === 'Space' && LR.G.state === 'play' && !st.cardActive) {
    e.preventDefault();
    triggerDash();
  }
  if ((e.code === 'KeyW' || e.code === 'KeyA' || e.code === 'KeyS' || e.code === 'KeyD' ||
       e.code.startsWith('Arrow') || e.code === 'Space') && LR.G.state === 'play') {
    e.preventDefault();
  }
}
function onKeyUp(e) {
  if (!st) return;
  st.keys[e.code] = false;
}

function triggerDash() {
  const p = st.player;
  if (p.dashCooldown > 0 || p.dashTimer > 0) return;
  let dx = p.vx, dy = p.vy;
  if (Math.hypot(dx, dy) < 0.1) {
    dx = Math.cos(p.facingAngle);
    dy = Math.sin(p.facingAngle);
  } else {
    const l = Math.hypot(dx, dy);
    dx /= l; dy /= l;
  }
  p.dashVx = dx * p.speed * 2.8;
  p.dashVy = dy * p.speed * 2.8;
  p.dashTimer = 0.22;
  p.invulnTimer = 0.35;
  p.dashCooldown = p.dashMaxCd;
  Sound.sfx.zip && Sound.sfx.zip();
  for (let i = 0; i < 10; i++) {
    const ang = (i * Math.PI*2) / 10;
    spawnProjectile({
      x: p.x, y: p.y, angle: ang, speed: 540,
      damage: 15 * p.dmgMult, radius: 6, color: '#ffffff',
      range: 280, knockback: 18
    });
  }
}

function onPointerDown(x, y, e) {
  if (!st || LR.G.state !== 'play') return;
  Sound.init();

  // Card selection
  if (st.cardActive) {
    for (let i = 0; i < st.cardRects.length; i++) {
      const r = st.cardRects[i];
      if (x >= r.x && x <= r.x + r.w && y >= r.y && y <= r.y + r.h) {
        selectCard(i);
        return;
      }
    }
    return;
  }

  // Dash button
  const bx = LR.G.W - 60, by = LR.G.H - 110;
  if (Math.hypot(x - bx, y - by) <= 36) {
    triggerDash();
    return;
  }

  // Joystick start
  if (!st.joystick.active) {
    st.joystick.active = true;
    st.joystick.pointerId = e && e.pointerId != null ? e.pointerId : 'default';
    st.joystick.startX = x;
    st.joystick.startY = y;
    st.joystick.curX = x;
    st.joystick.curY = y;
    st.joystick.dx = 0;
    st.joystick.dy = 0;
  }
}

function onPointerMove(x, y) {
  if (!st || !st.joystick.active) return;
  const maxR = 56;
  let vx = x - st.joystick.startX;
  let vy = y - st.joystick.startY;
  const d = Math.hypot(vx, vy);
  if (d > maxR) { vx = (vx/d)*maxR; vy = (vy/d)*maxR; }
  st.joystick.curX = st.joystick.startX + vx;
  st.joystick.curY = st.joystick.startY + vy;
  st.joystick.dx = d > 4 ? vx / maxR : 0;
  st.joystick.dy = d > 4 ? vy / maxR : 0;
}

function onPointerUp() {
  if (!st) return;
  st.joystick.active = false;
  st.joystick.dx = 0;
  st.joystick.dy = 0;
}

/* ================= MOD ================= */
const mod = {
  enter() {
    reset();
    computeLayout();
    window.addEventListener('keydown', onKeyDown);
    window.addEventListener('keyup', onKeyUp);
  },
  exit() {
    window.removeEventListener('keydown', onKeyDown);
    window.removeEventListener('keyup', onKeyUp);
    if (st) { st.joystick.active = false; }
  },
  resize() { computeLayout(); },
  update(dt) { update(dt); },
  draw() { drawGame(LR.G.ctx); },
  pointerDown(x, y, e) { onPointerDown(x, y, e); },
  pointerUp(x, y, e) { onPointerUp(); },
  pointerMove(x, y, e) { onPointerMove(x, y); },
  legend(el) {
    el.innerHTML = '<p class="note" style="margin:8px 0 0">' +
      '💡 Di chuyển bằng <b>WASD / Mũi tên</b> hoặc <b>kéo chạm</b>. Nhấn <b>Space</b> hoặc nút ⚡ để lướt. ' +
      'Tiêu diệt <b>siêu vi khuẩn ở đợt ' + WIN_BOSS_WAVE + '</b> để giành chiến thắng! ' +
      '⚠️ Cẩn thận vi khuẩn <b>vàng</b> (làm chậm bé) và <b>hồng</b> (tách đôi khi chết).</p>';
  }
};

/* ================= REGISTER ================= */
const LEVEL = {
  id: '16-baby-survivors',
  title: 'Em bé đại chiến vi khuẩn',
  desc: 'Điều khiển bé Vũ tiêu diệt vi khuẩn! Di chuyển, bắn tự động, nhặt XP để lên cấp và chọn nâng cấp. Đánh bại siêu vi khuẩn đợt 3 để qua ải.',
  rules: [
    'Di chuyển: WASD / Phím mũi tên hoặc kéo chạm trên màn hình',
    'Vũ khí bắn tự động vào vi khuẩn gần nhất',
    'Nhặt XP để lên cấp → chọn nâng cấp vũ khí hoặc đề kháng',
    'Nhấn Space (hoặc nút ⚡) để lướt né đòn',
    '⚠️ Vi khuẩn VÀNG chạy nhanh, chạm sẽ làm CHẬM bé',
    '⚠️ Vi khuẩn HỒNG tách thành 2 con nhỏ hơn khi bị diệt',
    'Đánh bại Siêu Vi Khuẩn ở đợt ' + WIN_BOSS_WAVE + ' để qua ải'
  ],
  status: 'ready',
  pad: false,
  actLabel: 'LƯỚT',
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
