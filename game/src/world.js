// The world: Emberward's whole simulation in one place. A lantern-keeper crosses a dark
// arena; the Hollow swarm in waves that thicken and harden as the night deepens; ember
// shards torn from the fallen feed the keeper's level, and every level offers a choice of
// weapons and charms. At four minutes the Hollow Star itself descends: kill it and dawn
// breaks (victory), or fall first (defeat). step() advances everything by one fixed tick
// and reports what happened as event bits and a queue of sound names for the boot code.

import { BOSS_TIME, BOSS_WARN_AT, FALLBACKS, FIELD, FOES, PASSIVES, PLAYER, WEAPONS } from './config.js';
import { range, shuffled } from './random.js';

export const EVENT_PLAYER_HIT = 1;
export const EVENT_LEVEL_UP = 2;
export const EVENT_GAME_OVER = 4;
export const EVENT_VICTORY = 8;
export const EVENT_BOSS_WARN = 16;

const ENEMY_CAP = 240;
const PARTICLE_CAP = 700;
const TEXT_CAP = 42;
const CRIT_CHANCE = 0.12;
const CRIT_MULTIPLIER = 1.8;

/** Experience needed to leave the given level: quick at first, then a longer climb. */
export function xpForLevel(level) {
  return Math.round(6 + (level - 1) * 5 + Math.pow(level - 1, 1.6) * 2);
}

/** Static facts about one upgrade id, for cards and the HUD. */
export function upgradeInfo(id) {
  if (WEAPONS[id]) return { name: WEAPONS[id].name, blurb: WEAPONS[id].blurb };
  if (PASSIVES[id]) return { name: PASSIVES[id].name, blurb: PASSIVES[id].blurb };
  return { name: FALLBACKS[id].name, blurb: FALLBACKS[id].blurb };
}

export function createWorld(random) {
  const state = {
    time: 0,
    score: 0,
    kills: 0,
    level: 1,
    xp: 0,
    xpNext: xpForLevel(1),
    pendingLevels: 0,
    levelUpPending: false,
    choices: [],
    player: null,
    weapons: {},
    passives: { boots: 0, might: 0, magnet: 0, heart: 0 },
    enemies: [],
    bolts: [],
    orbs: [],
    shards: [],
    hearts: [],
    particles: [],
    texts: [],
    sounds: [],
    boss: null,
    bossWarned: false,
    bossSpawned: false,
    won: false,
    lost: false,
    shake: 0,
    hurtFlash: 0,
    levelFlash: 0,
    spawnTimer: 0.7,
    ambientTimer: 0,
    pickupSoundAt: -1,
  };

  function reset() {
    state.time = 0;
    state.score = 0;
    state.kills = 0;
    state.level = 1;
    state.xp = 0;
    state.xpNext = xpForLevel(1);
    state.pendingLevels = 0;
    state.levelUpPending = false;
    state.choices = [];
    state.player = {
      x: FIELD.width / 2,
      y: FIELD.height / 2,
      vx: 0,
      vy: 0,
      hp: PLAYER.hp,
      maxHp: PLAYER.hp,
      face: 1,
      dashTime: 0,
      dashCd: 0,
      dashDx: 1,
      dashDy: 0,
      grace: 0,
    };
    state.weapons = { lantern: { level: 1, timer: 0.5 } };
    state.passives = { boots: 0, might: 0, magnet: 0, heart: 0 };
    state.enemies.length = 0;
    state.bolts.length = 0;
    state.orbs.length = 0;
    state.shards.length = 0;
    state.hearts.length = 0;
    state.particles.length = 0;
    state.texts.length = 0;
    state.sounds.length = 0;
    state.boss = null;
    state.bossWarned = false;
    state.bossSpawned = false;
    state.won = false;
    state.lost = false;
    state.shake = 0;
    state.hurtFlash = 0;
    state.levelFlash = 0;
    state.spawnTimer = 0.7;
    state.ambientTimer = 0;
    state.pickupSoundAt = -1;
  }

  function might() {
    return 1 + 0.12 * state.passives.might;
  }

  function magnetRadius() {
    return PLAYER.pickup * (1 + 0.35 * state.passives.magnet);
  }

  function burst(x, y, color, count, speed, size, life) {
    for (let i = 0; i < count; i += 1) {
      if (state.particles.length >= PARTICLE_CAP) return;
      const angle = random() * Math.PI * 2;
      const pace = range(random, speed * 0.25, speed);
      state.particles.push({
        kind: 'spark', x, y,
        vx: Math.cos(angle) * pace, vy: Math.sin(angle) * pace,
        life: range(random, life * 0.5, life), maxLife: life,
        size: range(random, size * 0.5, size), color,
      });
    }
  }

  function ring(x, y, color, maxRadius, seconds) {
    if (state.particles.length >= PARTICLE_CAP) return;
    state.particles.push({ kind: 'ring', x, y, radius: 12, maxRadius, life: seconds, maxLife: seconds, color });
  }

  function addText(x, y, str, color, size) {
    if (state.texts.length >= TEXT_CAP) return;
    state.texts.push({ x: x + range(random, -6, 6), y, str, color, size, life: 0.75, maxLife: 0.75 });
  }

  function spawnPosition() {
    const side = Math.floor(random() * 4);
    let x;
    let y;
    if (side === 0) { x = range(random, 40, FIELD.width - 40); y = 34; }
    else if (side === 1) { x = range(random, 40, FIELD.width - 40); y = FIELD.height - 34; }
    else if (side === 2) { x = 34; y = range(random, 40, FIELD.height - 40); }
    else { x = FIELD.width - 34; y = range(random, 40, FIELD.height - 40); }
    const dx = x - state.player.x;
    const dy = y - state.player.y;
    if (dx * dx + dy * dy < 260 * 260) {
      x = FIELD.width - x;
      y = FIELD.height - y;
    }
    return { x, y };
  }

  function spawnEnemy(kind, x, y, elite = false) {
    const base = FOES[kind];
    // The Star's bulk is its own; only the lesser Hollow harden as the night deepens.
    const hpMul = kind === 'star' ? 1 : (1 + state.time / 110) * (elite ? 6 : 1);
    const enemy = {
      kind, x, y, vx: 0, vy: 0,
      hp: Math.round(base.hp * hpMul),
      maxHp: Math.round(base.hp * hpMul),
      radius: base.radius * (elite ? 1.45 : 1),
      speed: base.speed * range(random, 0.88, 1.12) * (elite ? 0.85 : 1),
      damage: base.damage,
      xp: base.xp * (elite ? 5 : 1),
      score: base.score * (elite ? 4 : 1),
      elite,
      hitFlash: 0,
      atkCd: range(random, 0.1, 0.5),
      wispCd: 0,
      fireTimer: range(random, 1.2, 2.8),
      wobble: random() * Math.PI * 2,
      enterTime: 0,
      burstTimer: 4.2,
      spiralTimer: 1.4,
      spiralAngle: 0,
      summonTimer: 7,
    };
    state.enemies.push(enemy);
    return enemy;
  }

  function director(dt) {
    state.spawnTimer -= dt;
    if (state.spawnTimer > 0 || state.enemies.length >= ENEMY_CAP) return;
    state.spawnTimer = Math.max(0.3, 1.25 - state.time * 0.0038) * (state.bossSpawned ? 2.4 : 1);
    const t = state.time;
    let kind = 'shade';
    const roll = random();
    if (t > 95 && roll < 0.13) kind = 'spitter';
    else if (t > 45 && roll < 0.27) kind = 'brute';
    else if (t > 18 && roll < 0.56) kind = 'skitter';
    if (kind === 'brute' && state.enemies.filter((enemy) => enemy.kind === 'brute').length >= 6) kind = 'shade';
    const elite = t > 140 && kind !== 'skitter' && random() < 0.06;
    const pos = spawnPosition();
    spawnEnemy(kind, pos.x, pos.y, elite);
    if (kind === 'skitter') {
      const pack = 2 + Math.floor(random() * 3);
      for (let i = 0; i < pack; i += 1) {
        spawnEnemy('skitter', pos.x + range(random, -36, 36), pos.y + range(random, -36, 36), false);
      }
    }
    if (t > 150 && random() < 0.3) {
      const extra = spawnPosition();
      spawnEnemy('shade', extra.x, extra.y, false);
    }
  }

  function nearestEnemies(x, y, count) {
    const sorted = state.enemies.slice().sort((a, b) => {
      const da = (a.x - x) * (a.x - x) + (a.y - y) * (a.y - y);
      const db = (b.x - x) * (b.x - x) + (b.y - y) * (b.y - y);
      return da - db;
    });
    return sorted.slice(0, count);
  }

  function damageEnemy(enemy, raw, knockX = 0, knockY = 0) {
    if (enemy.enterTime > 0) return;
    const crit = random() < CRIT_CHANCE;
    const amount = raw * might() * (crit ? CRIT_MULTIPLIER : 1);
    enemy.hp -= amount;
    enemy.hitFlash = 1;
    if (enemy.kind !== 'star') {
      enemy.vx += knockX;
      enemy.vy += knockY;
    }
    addText(enemy.x, enemy.y - enemy.radius - 4, String(Math.round(amount)), crit ? '#ff9d5c' : '#ffe3ae', crit ? 21 : 15);
    if (enemy.hp <= 0) killEnemy(enemy);
    else state.sounds.push('hit');
  }

  function killEnemy(enemy) {
    enemy.dead = true;
    state.kills += 1;
    state.score += enemy.score;
    const color = enemy.kind === 'skitter' ? '#7ef0d4' : enemy.kind === 'brute' ? '#ff6b5e' : enemy.kind === 'spitter' ? '#a5e36b' : enemy.kind === 'star' ? '#ff5470' : '#b79cff';
    burst(enemy.x, enemy.y, color, enemy.kind === 'star' ? 90 : enemy.elite ? 26 : 12, 260, 3.4, 0.55);
    state.sounds.push('die');
    // Ember shards: the enemy's worth, in pieces a keeper can gather.
    let left = enemy.xp;
    while (left > 0) {
      const value = left >= 5 ? 5 : left;
      left -= value;
      state.shards.push({
        x: enemy.x + range(random, -14, 14), y: enemy.y + range(random, -14, 14),
        vx: range(random, -40, 40), vy: range(random, -40, 40), value, big: value >= 5,
      });
    }
    if ((enemy.kind === 'brute' && random() < 0.12) || (enemy.elite && random() < 0.35) || enemy.kind === 'star') {
      if (state.hearts.length < 3) state.hearts.push({ x: enemy.x, y: enemy.y, vx: 0, vy: 0 });
    }
    if (enemy.kind === 'star') {
      state.boss = null;
      state.won = true;
      state.shake = Math.max(state.shake, 15);
      ring(enemy.x, enemy.y, '#ffe3ae', 420, 0.9);
      state.sounds.push('win');
    }
  }

  function damagePlayer(amount) {
    const player = state.player;
    if (player.grace > 0 || player.dashTime > 0 || state.won || state.lost) return 0;
    player.hp -= amount;
    player.grace = PLAYER.grace;
    state.hurtFlash = 1;
    state.shake = Math.max(state.shake, 7);
    state.sounds.push('hurt');
    burst(player.x, player.y, '#ff4757', 10, 200, 3, 0.4);
    if (player.hp <= 0) {
      player.hp = 0;
      state.lost = true;
      burst(player.x, player.y, '#ffb347', 60, 320, 4, 0.9);
      ring(player.x, player.y, '#ffb347', 240, 0.7);
      state.shake = 16;
      state.sounds.push('lose');
      return EVENT_GAME_OVER;
    }
    return EVENT_PLAYER_HIT;
  }

  function fireWeapons(dt) {
    const player = state.player;
    const weapons = state.weapons;

    const lantern = weapons.lantern;
    if (lantern) {
      lantern.timer -= dt;
      if (lantern.timer <= 0 && state.enemies.length > 0) {
        const level = lantern.level - 1;
        lantern.timer = WEAPONS.lantern.cooldown[level];
        const targets = nearestEnemies(player.x, player.y, WEAPONS.lantern.projectiles[level]);
        targets.forEach((target, index) => {
          const angle = Math.atan2(target.y - player.y, target.x - player.x) + (index - (targets.length - 1) / 2) * 0.09;
          state.bolts.push({
            kind: 'bolt', x: player.x, y: player.y - 6,
            vx: Math.cos(angle) * 640, vy: Math.sin(angle) * 640,
            damage: WEAPONS.lantern.damage[level], radius: 5, life: 1.15, pierce: 0,
          });
        });
        if (targets.length > 0) state.sounds.push('shoot');
      }
    }

    const wisps = weapons.wisps;
    if (wisps) {
      wisps.angle = (wisps.angle || 0) + dt * 2.7;
      const level = wisps.level - 1;
      const positions = wispPositions(state);
      for (const pos of positions) {
        for (const enemy of state.enemies) {
          if (enemy.dead || enemy.wispCd > 0 || enemy.enterTime > 0) continue;
          const dx = enemy.x - pos.x;
          const dy = enemy.y - pos.y;
          if (dx * dx + dy * dy < (enemy.radius + 14) * (enemy.radius + 14)) {
            enemy.wispCd = 0.38;
            damageEnemy(enemy, WEAPONS.wisps.damage[level], dx * 2.2, dy * 2.2);
          }
        }
      }
    }

    const nova = weapons.nova;
    if (nova) {
      nova.timer -= dt;
      if (nova.timer <= 0 && state.enemies.length > 0) {
        const level = nova.level - 1;
        nova.timer = WEAPONS.nova.cooldown[level];
        const radius = WEAPONS.nova.radius[level];
        ring(player.x, player.y, '#ffb347', radius, 0.32);
        for (const enemy of state.enemies) {
          if (enemy.dead) continue;
          const dx = enemy.x - player.x;
          const dy = enemy.y - player.y;
          const dist = Math.hypot(dx, dy) || 1;
          if (dist < radius + enemy.radius) {
            damageEnemy(enemy, WEAPONS.nova.damage[level], (dx / dist) * 300, (dy / dist) * 300);
          }
        }
        state.sounds.push('nova');
      }
    }

    const seekers = weapons.seekers;
    if (seekers) {
      seekers.timer -= dt;
      if (seekers.timer <= 0 && state.enemies.length > 0) {
        const level = seekers.level - 1;
        seekers.timer = WEAPONS.seekers.cooldown[level];
        for (let i = 0; i < WEAPONS.seekers.count[level]; i += 1) {
          const angle = random() * Math.PI * 2;
          state.bolts.push({
            kind: 'seeker', x: player.x, y: player.y - 6,
            vx: Math.cos(angle) * 190, vy: Math.sin(angle) * 190,
            damage: WEAPONS.seekers.damage[level], radius: 6, life: 2.3, pierce: 0, target: null,
          });
        }
        state.sounds.push('seeker');
      }
    }
  }

  function explodeSeeker(bolt) {
    burst(bolt.x, bolt.y, '#ff7b39', 10, 220, 3, 0.4);
    ring(bolt.x, bolt.y, '#ff7b39', 48, 0.22);
    for (const enemy of state.enemies) {
      if (enemy.dead) continue;
      const dx = enemy.x - bolt.x;
      const dy = enemy.y - bolt.y;
      if (dx * dx + dy * dy < (48 + enemy.radius) * (48 + enemy.radius)) {
        damageEnemy(enemy, bolt.damage, dx * 1.4, dy * 1.4);
      }
    }
  }

  function updateBolts(dt) {
    const player = state.player;
    for (const bolt of state.bolts) {
      bolt.life -= dt;
      if (bolt.kind === 'seeker') {
        if (!bolt.target || bolt.target.dead) {
          const near = nearestEnemies(bolt.x, bolt.y, 1);
          bolt.target = near.length > 0 ? near[0] : null;
        }
        if (bolt.target) {
          const want = Math.atan2(bolt.target.y - bolt.y, bolt.target.x - bolt.x);
          const now = Math.atan2(bolt.vy, bolt.vx);
          let turn = want - now;
          while (turn > Math.PI) turn -= Math.PI * 2;
          while (turn < -Math.PI) turn += Math.PI * 2;
          const next = now + Math.max(-7 * dt, Math.min(7 * dt, turn));
          const speed = Math.min(430, Math.hypot(bolt.vx, bolt.vy) + 620 * dt);
          bolt.vx = Math.cos(next) * speed;
          bolt.vy = Math.sin(next) * speed;
        }
      }
      bolt.x += bolt.vx * dt;
      bolt.y += bolt.vy * dt;
      if (bolt.life <= 0 || bolt.x < -30 || bolt.x > FIELD.width + 30 || bolt.y < -30 || bolt.y > FIELD.height + 30) {
        bolt.dead = true;
        if (bolt.kind === 'seeker' && bolt.life <= 0) explodeSeeker(bolt);
        continue;
      }
      for (const enemy of state.enemies) {
        if (enemy.dead || enemy.enterTime > 0) continue;
        const dx = enemy.x - bolt.x;
        const dy = enemy.y - bolt.y;
        if (dx * dx + dy * dy < (enemy.radius + bolt.radius) * (enemy.radius + bolt.radius)) {
          if (bolt.kind === 'seeker') {
            bolt.dead = true;
            explodeSeeker(bolt);
          } else {
            damageEnemy(enemy, bolt.damage, bolt.vx * 0.14, bolt.vy * 0.14);
            burst(bolt.x, bolt.y, '#ffd98a', 4, 170, 2.4, 0.3);
            if (bolt.pierce > 0) bolt.pierce -= 1;
            else bolt.dead = true;
          }
          break;
        }
      }
    }
    state.bolts = state.bolts.filter((bolt) => !bolt.dead);
    void player;
  }

  function fireOrb(from, angle, speed, damage, color = '#ff7d9c') {
    state.orbs.push({
      x: from.x, y: from.y,
      vx: Math.cos(angle) * speed, vy: Math.sin(angle) * speed,
      damage, radius: 7, life: 5, color,
    });
  }

  function bossAttacks(enemy, dt) {
    const player = state.player;
    const phase2 = enemy.hp < enemy.maxHp * 0.55;
    enemy.burstTimer -= dt;
    if (enemy.burstTimer <= 0) {
      enemy.burstTimer = phase2 ? 4.4 : 5.4;
      const count = phase2 ? 18 : 14;
      const offset = random() * Math.PI * 2;
      for (let i = 0; i < count; i += 1) {
        fireOrb(enemy, offset + (i / count) * Math.PI * 2, 148, 14);
      }
    }
    if (phase2) {
      enemy.spiralTimer -= dt;
      if (enemy.spiralTimer <= 0) {
        enemy.spiralTimer = 0.85;
        enemy.spiralAngle += 0.42;
        for (let k = 0; k < 3; k += 1) {
          fireOrb(enemy, enemy.spiralAngle + k * 0.55, 172, 14);
        }
      }
    }
    enemy.summonTimer -= dt;
    if (enemy.summonTimer <= 0) {
      enemy.summonTimer = 9.5;
      for (let i = 0; i < 4; i += 1) {
        spawnEnemy('skitter', enemy.x + range(random, -70, 70), enemy.y + range(random, -70, 70), false);
      }
    }
    void player;
  }

  function updateEnemies(dt, ambient) {
    const player = state.player;
    let events = 0;
    for (const enemy of state.enemies) {
      if (enemy.dead) continue;
      enemy.hitFlash = Math.max(0, enemy.hitFlash - dt * 6);
      enemy.atkCd = Math.max(0, enemy.atkCd - dt);
      enemy.wispCd = Math.max(0, enemy.wispCd - dt);
      enemy.wobble += dt * 3;

      if (enemy.enterTime > 0) {
        enemy.enterTime -= dt;
        enemy.y += (185 - enemy.y) * Math.min(1, dt * 1.6);
        continue;
      }

      const dx = player.x - enemy.x;
      const dy = player.y - enemy.y;
      const dist = Math.hypot(dx, dy) || 1;
      let moveX = 0;
      let moveY = 0;

      if (ambient) {
        const angle = enemy.wobble * 0.35 + enemy.radius;
        moveX = Math.cos(angle) * 34;
        moveY = Math.sin(angle) * 34 + (dist > 300 ? (dy / dist) * 30 : 0);
      } else if (enemy.kind === 'spitter') {
        const rangeBand = FOES.spitter.range;
        if (dist > rangeBand) { moveX = (dx / dist) * enemy.speed; moveY = (dy / dist) * enemy.speed; }
        else if (dist < rangeBand - 80) { moveX = -(dx / dist) * enemy.speed; moveY = -(dy / dist) * enemy.speed; }
        else { moveX = Math.cos(enemy.wobble * 0.7) * 26; moveY = Math.sin(enemy.wobble * 0.7) * 26; }
        enemy.fireTimer -= dt;
        if (enemy.fireTimer <= 0 && dist < rangeBand + 70) {
          enemy.fireTimer = 2.6;
          fireOrb(enemy, Math.atan2(dy, dx), FOES.spitter.orbSpeed, FOES.spitter.orbDamage, '#a5e36b');
        }
      } else {
        moveX = (dx / dist) * enemy.speed;
        moveY = (dy / dist) * enemy.speed;
        if (enemy.kind === 'star') bossAttacks(enemy, dt);
      }

      enemy.vx += (moveX - enemy.vx) * Math.min(1, dt * 5);
      enemy.vy += (moveY - enemy.vy) * Math.min(1, dt * 5);
      enemy.x += enemy.vx * dt;
      enemy.y += enemy.vy * dt;
      enemy.x = Math.max(enemy.radius, Math.min(FIELD.width - enemy.radius, enemy.x));
      enemy.y = Math.max(enemy.radius, Math.min(FIELD.height - enemy.radius, enemy.y));

      if (!ambient && dist < enemy.radius + PLAYER.radius + 2 && enemy.atkCd <= 0) {
        enemy.atkCd = 0.7;
        events |= damagePlayer(enemy.damage);
      }
    }

    // The Hollow press on one another but never share one spot.
    const list = state.enemies;
    for (let i = 0; i < list.length; i += 1) {
      const a = list[i];
      if (a.dead) continue;
      for (let j = i + 1; j < list.length; j += 1) {
        const b = list[j];
        if (b.dead) continue;
        const dx = b.x - a.x;
        const dy = b.y - a.y;
        const min = (a.radius + b.radius) * 0.82;
        const d2 = dx * dx + dy * dy;
        if (d2 > 0.01 && d2 < min * min) {
          const d = Math.sqrt(d2);
          const push = ((min - d) / d) * 0.5;
          if (a.kind !== 'star') { a.x -= dx * push * 0.5; a.y -= dy * push * 0.5; }
          if (b.kind !== 'star') { b.x += dx * push * 0.5; b.y += dy * push * 0.5; }
        }
      }
    }

    state.enemies = state.enemies.filter((enemy) => !enemy.dead);
    return events;
  }

  function updateOrbs(dt) {
    const player = state.player;
    let events = 0;
    for (const orb of state.orbs) {
      orb.life -= dt;
      orb.x += orb.vx * dt;
      orb.y += orb.vy * dt;
      if (orb.life <= 0 || orb.x < -20 || orb.x > FIELD.width + 20 || orb.y < -20 || orb.y > FIELD.height + 20) {
        orb.dead = true;
        continue;
      }
      const dx = player.x - orb.x;
      const dy = player.y - orb.y;
      if (dx * dx + dy * dy < (orb.radius + PLAYER.radius) * (orb.radius + PLAYER.radius)) {
        orb.dead = true;
        events |= damagePlayer(orb.damage);
      }
    }
    state.orbs = state.orbs.filter((orb) => !orb.dead);
    return events;
  }

  function updatePickups(dt) {
    const player = state.player;
    const magnet = magnetRadius();
    for (const shard of state.shards) {
      const dx = player.x - shard.x;
      const dy = player.y - shard.y;
      const dist = Math.hypot(dx, dy) || 1;
      if (dist < magnet) {
        const pull = 560 * (1 - dist / (magnet * 1.6));
        shard.vx += (dx / dist) * pull * dt * 6;
        shard.vy += (dy / dist) * pull * dt * 6;
      }
      shard.vx *= 0.9;
      shard.vy *= 0.9;
      shard.x += shard.vx * dt;
      shard.y += shard.vy * dt;
      if (dist < PLAYER.collect) {
        shard.dead = true;
        state.xp += shard.value;
        if (state.time - state.pickupSoundAt > 0.055) {
          state.pickupSoundAt = state.time;
          state.sounds.push('pickup');
        }
      }
    }
    state.shards = state.shards.filter((shard) => !shard.dead);
    for (const heart of state.hearts) {
      const dx = player.x - heart.x;
      const dy = player.y - heart.y;
      const dist = Math.hypot(dx, dy) || 1;
      if (dist < magnet * 0.85) {
        heart.x += (dx / dist) * 300 * dt;
        heart.y += (dy / dist) * 300 * dt;
      }
      if (dist < PLAYER.collect + 4) {
        heart.dead = true;
        player.hp = Math.min(player.maxHp, player.hp + 25);
        addText(player.x, player.y - 30, '+25', '#ff7d9c', 19);
        state.sounds.push('pickup');
      }
    }
    state.hearts = state.hearts.filter((heart) => !heart.dead);
  }

  function updateParticles(dt) {
    for (const particle of state.particles) {
      particle.life -= dt;
      if (particle.kind === 'ring') {
        particle.radius += (particle.maxRadius - particle.radius) * Math.min(1, dt * 9);
      } else {
        particle.x += particle.vx * dt;
        particle.y += particle.vy * dt;
        particle.vx *= 0.92;
        particle.vy *= 0.92;
      }
    }
    state.particles = state.particles.filter((particle) => particle.life > 0);
    for (const text of state.texts) {
      text.life -= dt;
      text.y -= 44 * dt;
    }
    state.texts = state.texts.filter((text) => text.life > 0);
  }

  function rollChoices() {
    const pool = [];
    for (const id of Object.keys(WEAPONS)) {
      const owned = state.weapons[id];
      if (!owned || owned.level < WEAPONS[id].max) pool.push({ type: 'weapon', id });
    }
    for (const id of Object.keys(PASSIVES)) {
      if (state.passives[id] < PASSIVES[id].max) pool.push({ type: 'passive', id });
    }
    const chosen = shuffled(random, pool).slice(0, 3);
    const fillers = [{ type: 'reward', id: 'feast' }, { type: 'reward', id: 'cache' }];
    let fill = 0;
    while (chosen.length < 3) {
      chosen.push(fillers[fill % fillers.length]);
      fill += 1;
    }
    return chosen;
  }

  function applyUpgrade(choice) {
    const player = state.player;
    if (choice.type === 'weapon') {
      const owned = state.weapons[choice.id];
      if (owned) owned.level += 1;
      else if (choice.id === 'wisps') state.weapons.wisps = { level: 1, angle: 0 };
      else state.weapons[choice.id] = { level: 1, timer: 0.6 };
    } else if (choice.type === 'passive') {
      state.passives[choice.id] += 1;
      if (choice.id === 'heart') {
        player.maxHp += 20;
        player.hp = Math.min(player.maxHp, player.hp + 20);
      }
    } else if (choice.id === 'feast') {
      player.hp = Math.min(player.maxHp, player.hp + 35);
    } else if (choice.id === 'cache') {
      state.score += 250;
    }
    state.sounds.push('choose');
    state.pendingLevels = Math.max(0, state.pendingLevels - 1);
    if (state.pendingLevels > 0) state.choices = rollChoices();
    else {
      state.levelUpPending = false;
      state.choices = [];
    }
  }

  /** One-line account of what a choice grants, for the level-up cards. */
  function describeChoice(choice, forLevel) {
    const info = upgradeInfo(choice.id);
    if (choice.type === 'weapon') {
      const owned = state.weapons[choice.id];
      const level = owned ? owned.level + 1 : 1;
      const table = WEAPONS[choice.id];
      const i = level - 1;
      let stat;
      if (choice.id === 'lantern') stat = `Damage ${table.damage[i]} · every ${table.cooldown[i]}s · ${table.projectiles[i]} bolt${table.projectiles[i] > 1 ? 's' : ''}`;
      else if (choice.id === 'wisps') stat = `${table.count[i]} wisps · ${table.damage[i]} damage a touch`;
      else if (choice.id === 'nova') stat = `Damage ${table.damage[i]} · reach ${table.radius[i]} · every ${table.cooldown[i]}s`;
      else stat = `${table.count[i]} moth${table.count[i] > 1 ? 's' : ''} · ${table.damage[i]} damage a burst`;
      return { name: info.name, tag: owned ? `WEAPON — LEVEL ${level} OF ${table.max}` : 'NEW WEAPON', lines: [info.blurb, stat] };
    }
    if (choice.type === 'passive') {
      const level = state.passives[choice.id] + 1;
      return { name: info.name, tag: `CHARM — LEVEL ${level} OF ${PASSIVES[choice.id].max}`, lines: [info.blurb, ''] };
    }
    void forLevel;
    return { name: info.name, tag: 'REWARD', lines: [info.blurb, ''] };
  }

  function stepAmbient(dt) {
    state.time += dt;
    state.ambientTimer -= dt;
    if (state.ambientTimer <= 0 && state.enemies.length < 5) {
      state.ambientTimer = 1.4;
      const pos = spawnPosition();
      spawnEnemy('shade', pos.x, pos.y, false);
    }
    updateEnemies(dt, true);
    updateParticles(dt);
    // Slow ember motes rise through the dark behind the title.
    if (random() < 0.3 && state.particles.length < 200) {
      state.particles.push({
        kind: 'spark', x: range(random, 0, FIELD.width), y: FIELD.height + 6,
        vx: range(random, -8, 8), vy: range(random, -34, -18),
        life: range(random, 2, 4), maxLife: 4, size: range(random, 1.2, 2.6), color: '#ffb347',
      });
    }
    return 0;
  }

  function step(dt, control, ambient = false) {
    if (ambient) return stepAmbient(dt);
    let events = 0;
    const player = state.player;

    state.shake = Math.max(0, state.shake - dt * 26);
    state.hurtFlash = Math.max(0, state.hurtFlash - dt * 2.4);
    state.levelFlash = Math.max(0, state.levelFlash - dt * 1.8);

    if (state.lost || state.won) {
      updateParticles(dt);
      return events;
    }

    state.time += dt;

    if (!state.bossWarned && state.time >= BOSS_WARN_AT) {
      state.bossWarned = true;
      events |= EVENT_BOSS_WARN;
      state.sounds.push('bossWarn');
    }
    if (!state.bossSpawned && state.time >= BOSS_TIME) {
      state.bossSpawned = true;
      const boss = spawnEnemy('star', FIELD.width / 2, 90, false);
      boss.enterTime = 1.6;
      state.boss = boss;
    }

    // Movement and the dash: a short, invulnerable lunge on a cooldown.
    player.dashCd = Math.max(0, player.dashCd - dt);
    player.grace = Math.max(0, player.grace - dt);
    const moving = control.x !== 0 || control.y !== 0;
    if (moving) player.face = control.x !== 0 ? Math.sign(control.x) : player.face;
    if (control.dash && player.dashCd <= 0 && player.dashTime <= 0) {
      player.dashTime = PLAYER.dashTime;
      player.dashCd = PLAYER.dashCooldown;
      player.dashDx = moving ? control.x : player.face;
      player.dashDy = moving ? control.y : 0;
      const length = Math.hypot(player.dashDx, player.dashDy) || 1;
      player.dashDx /= length;
      player.dashDy /= length;
      state.sounds.push('dash');
    }
    if (player.dashTime > 0) {
      player.dashTime -= dt;
      player.vx = player.dashDx * PLAYER.dashSpeed;
      player.vy = player.dashDy * PLAYER.dashSpeed;
      if (state.particles.length < PARTICLE_CAP) {
        state.particles.push({
          kind: 'ghost', x: player.x, y: player.y, face: player.face,
          vx: 0, vy: 0, life: 0.28, maxLife: 0.28, size: PLAYER.radius, color: '#2f5d8a',
        });
      }
    } else {
      const speed = PLAYER.speed * (1 + 0.08 * state.passives.boots);
      player.vx = control.x * speed;
      player.vy = control.y * speed;
    }
    player.x = Math.max(FIELD.wall + PLAYER.radius, Math.min(FIELD.width - FIELD.wall - PLAYER.radius, player.x + player.vx * dt));
    player.y = Math.max(FIELD.wall + PLAYER.radius, Math.min(FIELD.height - FIELD.wall - PLAYER.radius, player.y + player.vy * dt));

    director(dt);
    fireWeapons(dt);
    updateBolts(dt);
    events |= updateEnemies(dt, false);
    events |= updateOrbs(dt);
    updatePickups(dt);
    updateParticles(dt);

    if (state.lost) events |= EVENT_GAME_OVER;
    if (state.won) events |= EVENT_VICTORY;

    while (state.xp >= state.xpNext) {
      state.xp -= state.xpNext;
      state.level += 1;
      state.xpNext = xpForLevel(state.level);
      state.pendingLevels += 1;
    }
    if (state.pendingLevels > 0 && !state.levelUpPending) {
      state.levelUpPending = true;
      state.choices = rollChoices();
      state.levelFlash = 1;
      events |= EVENT_LEVEL_UP;
      state.sounds.push('levelup');
      ring(player.x, player.y, '#ffe3ae', 120, 0.5);
    }
    return events;
  }

  reset();
  return { state, reset, step, applyUpgrade, describeChoice };
}

/** Where the orbit wisps are right now, shared by the world's touch and the renderer's eye. */
export function wispPositions(state) {
  const wisps = state.weapons.wisps;
  if (!wisps) return [];
  const level = wisps.level - 1;
  const count = WEAPONS.wisps.count[level];
  const radius = WEAPONS.wisps.radius[level];
  const positions = [];
  for (let i = 0; i < count; i += 1) {
    const angle = (wisps.angle || 0) + (i / count) * Math.PI * 2;
    positions.push({ x: state.player.x + Math.cos(angle) * radius, y: state.player.y + Math.sin(angle) * radius });
  }
  return positions;
}
