// The renderer: everything Emberward looks like. A pre-painted night arena (stone, runes,
// star-ember speckle, vignette) sits under soft glow sprites and hand-drawn canvas figures —
// the hooded warden with her lantern, the wispy Hollow in four kinds, the Hollow Star — and
// the HUD and screens (title, boon choice, pause, defeat, dawn) are painted over the world,
// so every screenshot shows the game itself, never a menu pasted on top.

import { BOSS_TIME, FIELD, FONT, PALETTE, PLAYER } from './config.js';
import { createRandom } from './random.js';
import { wispPositions } from './world.js';

export const SCREEN_TITLE = 'title';
export const SCREEN_PLAY = 'play';
export const SCREEN_LEVELUP = 'levelup';
export const SCREEN_PAUSED = 'paused';
export const SCREEN_OVER = 'over';
export const SCREEN_WIN = 'win';

function makeGlow(color) {
  const size = 128;
  const canvas = document.createElement('canvas');
  canvas.width = size;
  canvas.height = size;
  const ctx = canvas.getContext('2d');
  const gradient = ctx.createRadialGradient(size / 2, size / 2, 0, size / 2, size / 2, size / 2);
  gradient.addColorStop(0, color);
  gradient.addColorStop(0.35, color + 'aa');
  gradient.addColorStop(1, color + '00');
  ctx.fillStyle = gradient;
  ctx.fillRect(0, 0, size, size);
  return canvas;
}

function makeBackground() {
  const canvas = document.createElement('canvas');
  canvas.width = FIELD.width;
  canvas.height = FIELD.height;
  const ctx = canvas.getContext('2d');
  const random = createRandom(1207);
  const gradient = ctx.createLinearGradient(0, 0, 0, FIELD.height);
  gradient.addColorStop(0, PALETTE.nightFar);
  gradient.addColorStop(1, PALETTE.night);
  ctx.fillStyle = gradient;
  ctx.fillRect(0, 0, FIELD.width, FIELD.height);

  // Worn stone: a faint tile grid and a few cracks.
  ctx.strokeStyle = 'rgba(120, 135, 200, 0.055)';
  ctx.lineWidth = 1;
  for (let x = 64; x < FIELD.width; x += 64) {
    ctx.beginPath(); ctx.moveTo(x, 0); ctx.lineTo(x, FIELD.height); ctx.stroke();
  }
  for (let y = 64; y < FIELD.height; y += 64) {
    ctx.beginPath(); ctx.moveTo(0, y); ctx.lineTo(FIELD.width, y); ctx.stroke();
  }
  ctx.strokeStyle = 'rgba(0, 0, 0, 0.16)';
  for (let i = 0; i < 26; i += 1) {
    let x = random() * FIELD.width;
    let y = random() * FIELD.height;
    ctx.beginPath();
    ctx.moveTo(x, y);
    for (let j = 0; j < 4; j += 1) {
      x += (random() - 0.5) * 46;
      y += (random() - 0.5) * 46;
      ctx.lineTo(x, y);
    }
    ctx.stroke();
  }

  // Fallen star-embers speckle the stone.
  for (let i = 0; i < 700; i += 1) {
    const x = random() * FIELD.width;
    const y = random() * FIELD.height;
    ctx.fillStyle = random() < 0.24 ? 'rgba(255, 179, 71, 0.13)' : 'rgba(200, 210, 255, 0.09)';
    ctx.beginPath();
    ctx.arc(x, y, random() * 1.5 + 0.4, 0, Math.PI * 2);
    ctx.fill();
  }

  // The warding circle at the arena's heart, and broken rings in two corners.
  function runeCircle(cx, cy, radius) {
    ctx.strokeStyle = 'rgba(122, 140, 220, 0.28)';
    ctx.lineWidth = 2;
    ctx.beginPath(); ctx.arc(cx, cy, radius, 0, Math.PI * 2); ctx.stroke();
    ctx.lineWidth = 1;
    ctx.beginPath(); ctx.arc(cx, cy, radius * 0.86, 0, Math.PI * 2); ctx.stroke();
    for (let i = 0; i < 12; i += 1) {
      const angle = (i / 12) * Math.PI * 2;
      ctx.beginPath();
      ctx.moveTo(cx + Math.cos(angle) * radius * 0.86, cy + Math.sin(angle) * radius * 0.86);
      ctx.lineTo(cx + Math.cos(angle) * radius, cy + Math.sin(angle) * radius);
      ctx.stroke();
    }
  }
  runeCircle(FIELD.width / 2, FIELD.height / 2, 168);
  runeCircle(86, 84, 120);
  runeCircle(FIELD.width - 86, FIELD.height - 84, 120);

  // The arena wall: a double ember-lit line.
  ctx.strokeStyle = 'rgba(255, 179, 71, 0.20)';
  ctx.lineWidth = 2;
  ctx.strokeRect(FIELD.wall, FIELD.wall, FIELD.width - FIELD.wall * 2, FIELD.height - FIELD.wall * 2);
  ctx.strokeStyle = 'rgba(122, 140, 220, 0.16)';
  ctx.lineWidth = 1;
  ctx.strokeRect(FIELD.wall - 7, FIELD.wall - 7, FIELD.width - (FIELD.wall - 7) * 2, FIELD.height - (FIELD.wall - 7) * 2);

  // Vignette: the dark leans in at the edges.
  const vignette = ctx.createRadialGradient(640, 360, 300, 640, 360, 780);
  vignette.addColorStop(0, 'rgba(0,0,0,0)');
  vignette.addColorStop(1, 'rgba(0,0,0,0.52)');
  ctx.fillStyle = vignette;
  ctx.fillRect(0, 0, FIELD.width, FIELD.height);
  return canvas;
}

export function formatTime(seconds) {
  const whole = Math.max(0, Math.floor(seconds));
  return `${Math.floor(whole / 60)}:${String(whole % 60).padStart(2, '0')}`;
}

export function createRenderer(canvas) {
  const ctx = canvas.getContext('2d');
  const view = { scale: 1, ox: 0, oy: 0 };
  const background = makeBackground();
  const glows = {
    amber: makeGlow('#ffb347'),
    pale: makeGlow('#ffe3ae'),
    violet: makeGlow('#8f7bff'),
    teal: makeGlow('#4fe3c1'),
    red: makeGlow('#ff4757'),
    green: makeGlow('#9be15d'),
    pink: makeGlow('#ff5470'),
  };
  let cards = [];
  // A cosmetic clock that runs even while the world is frozen (end screens, the boon
  // choice), so prompts can breathe there too.
  let clock = 0;
  let lastNow = performance.now();

  function fit() {
    const dpr = Math.min(2, window.devicePixelRatio || 1);
    const width = canvas.clientWidth || window.innerWidth;
    const height = canvas.clientHeight || window.innerHeight;
    canvas.width = Math.round(width * dpr);
    canvas.height = Math.round(height * dpr);
    const scale = Math.min(width / FIELD.width, height / FIELD.height);
    view.scale = scale * dpr;
    view.ox = ((width - FIELD.width * scale) / 2) * dpr;
    view.oy = ((height - FIELD.height * scale) / 2) * dpr;
    return { dpr, scale, ox: (width - FIELD.width * scale) / 2, oy: (height - FIELD.height * scale) / 2 };
  }

  function glow(sprite, x, y, radius, alpha) {
    ctx.globalAlpha = alpha;
    ctx.drawImage(sprite, x - radius, y - radius, radius * 2, radius * 2);
    ctx.globalAlpha = 1;
  }

  function roundedRect(x, y, width, height, radius) {
    ctx.beginPath();
    ctx.moveTo(x + radius, y);
    ctx.lineTo(x + width - radius, y);
    ctx.arcTo(x + width, y, x + width, y + radius, radius);
    ctx.lineTo(x + width, y + height - radius);
    ctx.arcTo(x + width, y + height, x + width - radius, y + height, radius);
    ctx.lineTo(x + radius, y + height);
    ctx.arcTo(x, y + height, x, y + height - radius, radius);
    ctx.lineTo(x, y + radius);
    ctx.arcTo(x, y, x + radius, y, radius);
    ctx.closePath();
  }

  function text(str, x, y, size, color, align = 'center', weight = 700, alpha = 1) {
    ctx.globalAlpha = alpha;
    ctx.font = `${weight} ${size}px ${FONT}`;
    ctx.textAlign = align;
    ctx.textBaseline = 'middle';
    ctx.fillStyle = color;
    ctx.fillText(str, x, y);
    ctx.globalAlpha = 1;
  }

  function wrapLines(str, size, maxWidth, weight = 400) {
    ctx.font = `${weight} ${size}px ${FONT}`;
    const words = str.split(' ');
    const lines = [];
    let line = '';
    for (const word of words) {
      const trial = line === '' ? word : `${line} ${word}`;
      if (ctx.measureText(trial).width > maxWidth && line !== '') {
        lines.push(line);
        line = word;
      } else line = trial;
    }
    if (line !== '') lines.push(line);
    return lines;
  }

  function drawShard(shard, time) {
    const bob = Math.sin(time * 4 + shard.x * 0.05) * 2;
    const size = shard.big ? 11 : 7;
    glow(glows.amber, shard.x, shard.y + bob, size * 2.6, 0.5);
    ctx.save();
    ctx.translate(shard.x, shard.y + bob);
    ctx.rotate(Math.PI / 4);
    ctx.fillStyle = PALETTE.shard;
    ctx.fillRect(-size / 2, -size / 2, size, size);
    ctx.fillStyle = '#fff6dd';
    ctx.fillRect(-size / 4, -size / 4, size / 2, size / 2);
    ctx.restore();
  }

  function drawHeart(heart, time) {
    const pulse = 1 + Math.sin(time * 5 + heart.x) * 0.12;
    glow(glows.pink, heart.x, heart.y, 26, 0.55);
    ctx.save();
    ctx.translate(heart.x, heart.y);
    ctx.scale(pulse, pulse);
    ctx.fillStyle = PALETTE.heart;
    ctx.beginPath();
    ctx.moveTo(0, 9);
    ctx.bezierCurveTo(-13, -2, -9, -12, 0, -6);
    ctx.bezierCurveTo(9, -12, 13, -2, 0, 9);
    ctx.fill();
    ctx.restore();
  }

  function drawEnemy(enemy, time) {
    const wobble = Math.sin(enemy.wobble * 2.1) * 0.08;
    const flash = enemy.hitFlash;
    ctx.save();
    ctx.translate(enemy.x, enemy.y);
    ctx.rotate(wobble);
    const body = enemy.kind === 'brute' ? PALETTE.bruteBody : PALETTE.shadeBody;
    ctx.fillStyle = flash > 0.4 ? '#e8e4ff' : body;
    ctx.beginPath();
    const points = enemy.kind === 'star' ? 14 : 9;
    for (let i = 0; i <= points; i += 1) {
      const angle = (i / points) * Math.PI * 2;
      const r = enemy.radius * (1 + Math.sin(angle * 3 + enemy.wobble * 3) * 0.09);
      const px = Math.cos(angle) * r;
      const py = Math.sin(angle) * r * 1.08;
      if (i === 0) ctx.moveTo(px, py);
      else ctx.lineTo(px, py);
    }
    ctx.closePath();
    ctx.fill();
    if (enemy.elite) {
      ctx.strokeStyle = PALETTE.ember;
      ctx.lineWidth = 2;
      ctx.beginPath();
      ctx.arc(0, 0, enemy.radius + 5, 0, Math.PI * 2);
      ctx.stroke();
    }
    ctx.restore();

    const eyeColor = enemy.kind === 'skitter' ? PALETTE.skitterEye : enemy.kind === 'brute' ? PALETTE.bruteEye : enemy.kind === 'spitter' ? PALETTE.spitterEye : PALETTE.shadeEye;
    if (enemy.kind === 'star') {
      glow(glows.pink, enemy.x, enemy.y, 74, 0.65 + Math.sin(time * 3) * 0.12);
      ctx.fillStyle = PALETTE.starCore;
      ctx.beginPath();
      ctx.arc(enemy.x, enemy.y, 15 + Math.sin(time * 3) * 2, 0, Math.PI * 2);
      ctx.fill();
      ctx.fillStyle = '#fff';
      ctx.beginPath();
      ctx.arc(enemy.x, enemy.y, 5, 0, Math.PI * 2);
      ctx.fill();
      // Crown shards wheel slowly about the Star.
      for (let i = 0; i < 6; i += 1) {
        const angle = time * 0.7 + (i / 6) * Math.PI * 2;
        const sx = enemy.x + Math.cos(angle) * (enemy.radius + 16);
        const sy = enemy.y + Math.sin(angle) * (enemy.radius + 16);
        ctx.save();
        ctx.translate(sx, sy);
        ctx.rotate(angle + Math.PI / 4);
        ctx.fillStyle = '#8f7bff';
        ctx.fillRect(-5, -5, 10, 10);
        ctx.restore();
      }
    } else {
      const eyeGlow = enemy.kind === 'skitter' ? glows.teal : enemy.kind === 'brute' ? glows.red : enemy.kind === 'spitter' ? glows.green : glows.violet;
      const spread = enemy.radius * 0.38;
      const lift = -enemy.radius * 0.12;
      const halo = enemy.kind === 'brute' ? 0.5 : 0.85;
      glow(eyeGlow, enemy.x - spread, enemy.y + lift, enemy.radius * halo, 0.38);
      glow(eyeGlow, enemy.x + spread, enemy.y + lift, enemy.radius * halo, 0.38);
      ctx.fillStyle = eyeColor;
      ctx.beginPath();
      ctx.arc(enemy.x - spread, enemy.y + lift, enemy.kind === 'brute' ? 4 : 2.8, 0, Math.PI * 2);
      ctx.arc(enemy.x + spread, enemy.y + lift, enemy.kind === 'brute' ? 4 : 2.8, 0, Math.PI * 2);
      ctx.fill();
      if (enemy.kind === 'spitter') {
        glow(glows.green, enemy.x, enemy.y + enemy.radius * 0.42, 14, 0.6);
      }
    }

    if (enemy.hp < enemy.maxHp && enemy.kind !== 'star') {
      const width = Math.max(26, enemy.radius * 1.5);
      const pct = Math.max(0, enemy.hp / enemy.maxHp);
      ctx.fillStyle = 'rgba(0,0,0,0.55)';
      ctx.fillRect(enemy.x - width / 2, enemy.y - enemy.radius - 13, width, 4);
      ctx.fillStyle = '#ff8fa3';
      ctx.fillRect(enemy.x - width / 2, enemy.y - enemy.radius - 13, width * pct, 4);
    }
  }

  function drawPlayer(state, time) {
    const player = state.player;
    const blink = player.grace > 0 && Math.floor(time * 18) % 2 === 0;
    glow(glows.amber, player.x, player.y, 118, 0.34);
    glow(glows.pale, player.x, player.y, 44, 0.5);
    ctx.save();
    ctx.translate(player.x, player.y);
    ctx.globalAlpha = blink ? 0.45 : 1;
    // Cloak: a hooded sweep of deep blue, hemmed darker.
    ctx.fillStyle = PALETTE.cloak;
    ctx.beginPath();
    ctx.moveTo(0, -17);
    ctx.bezierCurveTo(13, -14, 15, 4, 11, 17);
    ctx.bezierCurveTo(5, 21, -5, 21, -11, 17);
    ctx.bezierCurveTo(-15, 4, -13, -14, 0, -17);
    ctx.fill();
    ctx.fillStyle = PALETTE.cloakDark;
    ctx.beginPath();
    ctx.ellipse(0, 14.5, 10.5, 4.5, 0, 0, Math.PI * 2);
    ctx.fill();
    // Hood shadow and two warm eyes.
    ctx.fillStyle = '#0b0e1d';
    ctx.beginPath();
    ctx.ellipse(0, -8, 7.6, 6.4, 0, 0, Math.PI * 2);
    ctx.fill();
    ctx.fillStyle = PALETTE.emberCore;
    ctx.beginPath();
    ctx.arc(-2.8, -8, 1.5, 0, Math.PI * 2);
    ctx.arc(2.8, -8, 1.5, 0, Math.PI * 2);
    ctx.fill();
    ctx.restore();
    // The lantern itself, held toward the way she faces.
    const lx = player.x + player.face * 15;
    const ly = player.y + 3 + Math.sin(time * 2.4) * 1.4;
    glow(glows.amber, lx, ly, 30, 0.85);
    ctx.fillStyle = '#2a2118';
    ctx.fillRect(lx - 4.5, ly - 6, 9, 12);
    ctx.fillStyle = PALETTE.emberCore;
    ctx.beginPath();
    ctx.arc(lx, ly, 3.1, 0, Math.PI * 2);
    ctx.fill();
  }

  function drawWorld(state, time) {
    ctx.drawImage(background, 0, 0);
    for (const shard of state.shards) drawShard(shard, time);
    for (const heart of state.hearts) drawHeart(heart, time);
    for (const enemy of state.enemies) drawEnemy(enemy, time);
    for (const pos of wispPositions(state)) {
      glow(glows.amber, pos.x, pos.y, 26, 0.75);
      ctx.fillStyle = PALETTE.emberCore;
      ctx.beginPath();
      ctx.arc(pos.x, pos.y, 4.6, 0, Math.PI * 2);
      ctx.fill();
    }
    for (const bolt of state.bolts) {
      if (bolt.kind === 'seeker') {
        const flap = Math.sin(time * 26 + bolt.x * 0.1) * 0.5;
        glow(glows.amber, bolt.x, bolt.y, 20, 0.6);
        ctx.save();
        ctx.translate(bolt.x, bolt.y);
        ctx.rotate(Math.atan2(bolt.vy, bolt.vx));
        ctx.fillStyle = '#ff9d5c';
        ctx.beginPath();
        ctx.ellipse(-2, -5 - flap * 3, 6, 2.6, -0.5, 0, Math.PI * 2);
        ctx.ellipse(-2, 5 + flap * 3, 6, 2.6, 0.5, 0, Math.PI * 2);
        ctx.fill();
        ctx.fillStyle = PALETTE.emberCore;
        ctx.beginPath();
        ctx.arc(1, 0, 3, 0, Math.PI * 2);
        ctx.fill();
        ctx.restore();
      } else {
        const angle = Math.atan2(bolt.vy, bolt.vx);
        glow(glows.pale, bolt.x, bolt.y, 16, 0.7);
        ctx.strokeStyle = PALETTE.emberCore;
        ctx.lineWidth = 3;
        ctx.beginPath();
        ctx.moveTo(bolt.x - Math.cos(angle) * 11, bolt.y - Math.sin(angle) * 11);
        ctx.lineTo(bolt.x, bolt.y);
        ctx.stroke();
      }
    }
    for (const orb of state.orbs) {
      glow(orb.color === '#a5e36b' ? glows.green : glows.pink, orb.x, orb.y, 22, 0.75);
      ctx.fillStyle = orb.color || '#ff7d9c';
      ctx.beginPath();
      ctx.arc(orb.x, orb.y, orb.radius, 0, Math.PI * 2);
      ctx.fill();
      ctx.fillStyle = 'rgba(255,255,255,0.85)';
      ctx.beginPath();
      ctx.arc(orb.x, orb.y, 2.4, 0, Math.PI * 2);
      ctx.fill();
    }
    if (!state.lost) drawPlayer(state, time);
    for (const particle of state.particles) {
      const fade = Math.max(0, particle.life / particle.maxLife);
      if (particle.kind === 'ring') {
        ctx.globalAlpha = fade * 0.8;
        ctx.strokeStyle = particle.color;
        ctx.lineWidth = 3.5;
        ctx.beginPath();
        ctx.arc(particle.x, particle.y, particle.radius, 0, Math.PI * 2);
        ctx.stroke();
        ctx.globalAlpha = 1;
      } else if (particle.kind === 'ghost') {
        ctx.globalAlpha = fade * 0.4;
        ctx.fillStyle = particle.color;
        ctx.beginPath();
        ctx.ellipse(particle.x, particle.y, particle.size * 0.75, particle.size, 0, 0, Math.PI * 2);
        ctx.fill();
        ctx.globalAlpha = 1;
      } else {
        glow(glows.amber, particle.x, particle.y, particle.size * 3.2, fade * 0.55);
        ctx.globalAlpha = fade;
        ctx.fillStyle = particle.color;
        ctx.beginPath();
        ctx.arc(particle.x, particle.y, particle.size, 0, Math.PI * 2);
        ctx.fill();
        ctx.globalAlpha = 1;
      }
    }
    for (const floater of state.texts) {
      const fade = Math.max(0, floater.life / floater.maxLife);
      text(floater.str, floater.x, floater.y, floater.size, floater.color, 'center', 800, fade);
    }
    // The lantern's halo over everything, soft and warm.
    if (!state.lost) glow(glows.amber, state.player.x, state.player.y, 210, 0.13);
  }

  function bar(x, y, width, height, pct, fillStyle, backStyle = 'rgba(6,8,18,0.72)') {
    roundedRect(x, y, width, height, height / 2);
    ctx.fillStyle = backStyle;
    ctx.fill();
    if (pct > 0) {
      roundedRect(x, y, Math.max(height, width * Math.min(1, pct)), height, height / 2);
      ctx.fillStyle = fillStyle;
      ctx.fill();
    }
    roundedRect(x, y, width, height, height / 2);
    ctx.strokeStyle = 'rgba(220,228,255,0.25)';
    ctx.lineWidth = 1;
    ctx.stroke();
  }

  function drawHud(state, describeMuted) {
    const player = state.player;
    // Experience across the very top; level at its left.
    ctx.fillStyle = 'rgba(6,8,18,0.8)';
    ctx.fillRect(0, 0, FIELD.width, 10);
    ctx.fillStyle = PALETTE.ember;
    ctx.fillRect(0, 0, FIELD.width * Math.min(1, state.xp / state.xpNext), 10);
    text(`LV ${state.level}`, 16, 30, 17, PALETTE.emberCore, 'left', 800);

    // Health under the level.
    const hpPct = player.hp / player.maxHp;
    bar(16, 44, 238, 17, hpPct, hpPct > 0.32 ? '#ffb347' : '#ff4757');
    ctx.save();
    ctx.shadowColor = 'rgba(0,0,0,0.65)';
    ctx.shadowBlur = 3;
    text(`${Math.ceil(player.hp)} / ${player.maxHp}`, 135, 53, 13, '#fff6dd', 'center', 800);
    ctx.restore();

    // The clock, and the Star's appointment beneath it.
    text(formatTime(state.time), FIELD.width / 2, 34, 31, PALETTE.text, 'center', 800);
    if (state.boss) {
      text('THE HOLLOW STAR', FIELD.width / 2, 66, 13, '#ff8fa3', 'center', 800);
    } else if (state.bossWarned && !state.won && !state.lost) {
      const flash = 0.55 + Math.sin(state.time * 9) * 0.45;
      text('THE HOLLOW STAR STIRS…', FIELD.width / 2, 66, 15, '#ff5470', 'center', 800, flash);
    } else {
      text(`the Hollow Star falls at ${formatTime(BOSS_TIME)}`, FIELD.width / 2, 64, 13, PALETTE.muted, 'center', 500);
    }

    // Score and tally, right.
    text(`SCORE ${state.score.toLocaleString('en-US')}`, FIELD.width - 16, 30, 19, PALETTE.text, 'right', 800);
    text(`Hollow felled ${state.kills}`, FIELD.width - 16, 54, 14, PALETTE.muted, 'right', 500);

    // Weapons and charms, bottom left.
    let wx = 16;
    const wy = FIELD.height - 58;
    for (const id of Object.keys(state.weapons)) {
      const owned = state.weapons[id];
      roundedRect(wx, wy, 42, 42, 9);
      ctx.fillStyle = 'rgba(10,12,26,0.8)';
      ctx.fill();
      ctx.strokeStyle = PALETTE.panelEdge;
      ctx.stroke();
      drawIcon(id, wx + 21, wy + 17, 15);
      for (let i = 0; i < owned.level; i += 1) {
        ctx.fillStyle = PALETTE.ember;
        ctx.beginPath();
        ctx.arc(wx + 9 + i * 8, wy + 35, 2.2, 0, Math.PI * 2);
        ctx.fill();
      }
      wx += 50;
    }
    let cx = 16;
    const cy = FIELD.height - 100;
    for (const id of Object.keys(state.passives)) {
      const level = state.passives[id];
      if (level === 0) continue;
      roundedRect(cx, cy, 30, 30, 7);
      ctx.fillStyle = 'rgba(10,12,26,0.7)';
      ctx.fill();
      drawIcon(id, cx + 15, cy + 12, 10);
      text(`×${level}`, cx + 15, cy + 24, 9, PALETTE.emberCore, 'center', 800);
      cx += 36;
    }

    // Dash readiness, bottom right, and the sound state beneath it.
    const dashPct = 1 - state.player.dashCd / PLAYER.dashCooldown;
    text('DASH', FIELD.width - 116, FIELD.height - 52, 11, PALETTE.muted, 'left', 700);
    bar(FIELD.width - 116, FIELD.height - 44, 100, 9, dashPct, dashPct >= 1 ? '#7ef0d4' : '#3a4470');
    text(describeMuted ? 'M — SOUND OFF' : 'M — SOUND ON', FIELD.width - 16, FIELD.height - 18, 11, PALETTE.muted, 'right', 500);

    // The Star's health spans the bottom centre while it lives.
    if (state.boss) {
      const boss = state.boss;
      bar(FIELD.width / 2 - 260, FIELD.height - 40, 520, 13, Math.max(0, boss.hp / boss.maxHp), '#ff5470');
    }

    // Pain and triumph wash the edges.
    if (state.hurtFlash > 0) {
      const gradient = ctx.createRadialGradient(640, 360, 260, 640, 360, 720);
      gradient.addColorStop(0, 'rgba(255,40,60,0)');
      gradient.addColorStop(1, `rgba(255,40,60,${0.34 * state.hurtFlash})`);
      ctx.fillStyle = gradient;
      ctx.fillRect(0, 0, FIELD.width, FIELD.height);
    }
    if (state.levelFlash > 0) {
      const gradient = ctx.createRadialGradient(640, 360, 200, 640, 360, 720);
      gradient.addColorStop(0, `rgba(255,227,174,${0.16 * state.levelFlash})`);
      gradient.addColorStop(1, 'rgba(255,227,174,0)');
      ctx.fillStyle = gradient;
      ctx.fillRect(0, 0, FIELD.width, FIELD.height);
    }
    if (player.hp <= player.maxHp * 0.3 && !state.lost) {
      const pulse = 0.16 + Math.sin(state.time * 6) * 0.08;
      ctx.strokeStyle = `rgba(255,71,87,${pulse})`;
      ctx.lineWidth = 10;
      ctx.strokeRect(5, 5, FIELD.width - 10, FIELD.height - 10);
    }
  }

  function drawIcon(id, x, y, size) {
    ctx.save();
    ctx.translate(x, y);
    ctx.fillStyle = PALETTE.ember;
    ctx.strokeStyle = PALETTE.ember;
    if (id === 'lantern') {
      ctx.strokeStyle = PALETTE.emberCore;
      ctx.lineWidth = 1.6;
      ctx.strokeRect(-size * 0.32, -size * 0.42, size * 0.64, size * 0.84);
      ctx.fillStyle = PALETTE.emberCore;
      ctx.beginPath();
      ctx.arc(0, 0, size * 0.2, 0, Math.PI * 2);
      ctx.fill();
    } else if (id === 'wisps') {
      ctx.lineWidth = 1.4;
      ctx.beginPath();
      ctx.arc(0, 0, size * 0.62, 0, Math.PI * 2);
      ctx.stroke();
      for (let i = 0; i < 3; i += 1) {
        const angle = (i / 3) * Math.PI * 2;
        ctx.beginPath();
        ctx.arc(Math.cos(angle) * size * 0.62, Math.sin(angle) * size * 0.62, size * 0.16, 0, Math.PI * 2);
        ctx.fill();
      }
    } else if (id === 'nova') {
      ctx.lineWidth = 1.6;
      ctx.beginPath();
      ctx.arc(0, 0, size * 0.34, 0, Math.PI * 2);
      ctx.stroke();
      ctx.beginPath();
      ctx.arc(0, 0, size * 0.66, 0, Math.PI * 2);
      ctx.stroke();
      ctx.beginPath();
      ctx.arc(0, 0, size * 0.14, 0, Math.PI * 2);
      ctx.fill();
    } else if (id === 'seekers') {
      ctx.beginPath();
      ctx.ellipse(-size * 0.3, -size * 0.2, size * 0.42, size * 0.2, -0.5, 0, Math.PI * 2);
      ctx.ellipse(-size * 0.3, size * 0.2, size * 0.42, size * 0.2, 0.5, 0, Math.PI * 2);
      ctx.fill();
      ctx.fillStyle = PALETTE.emberCore;
      ctx.beginPath();
      ctx.arc(size * 0.18, 0, size * 0.2, 0, Math.PI * 2);
      ctx.fill();
    } else if (id === 'boots') {
      ctx.beginPath();
      ctx.moveTo(size * 0.15, -size * 0.7);
      ctx.lineTo(-size * 0.42, size * 0.12);
      ctx.lineTo(-size * 0.02, size * 0.12);
      ctx.lineTo(-size * 0.15, size * 0.7);
      ctx.lineTo(size * 0.42, -size * 0.12);
      ctx.lineTo(size * 0.02, -size * 0.12);
      ctx.closePath();
      ctx.fill();
    } else if (id === 'might') {
      ctx.beginPath();
      ctx.moveTo(0, -size * 0.72);
      ctx.bezierCurveTo(size * 0.55, -size * 0.1, size * 0.4, size * 0.45, 0, size * 0.68);
      ctx.bezierCurveTo(-size * 0.4, size * 0.45, -size * 0.55, -size * 0.1, 0, -size * 0.72);
      ctx.fill();
    } else if (id === 'magnet') {
      ctx.lineWidth = size * 0.3;
      ctx.beginPath();
      ctx.arc(0, -size * 0.08, size * 0.5, Math.PI * 0.15, Math.PI * 0.85, true);
      ctx.stroke();
      ctx.fillRect(-size * 0.65, -size * 0.62, size * 0.3, size * 0.34);
      ctx.fillRect(size * 0.35, -size * 0.62, size * 0.3, size * 0.34);
    } else if (id === 'heart' || id === 'feast') {
      ctx.beginPath();
      ctx.moveTo(0, size * 0.55);
      ctx.bezierCurveTo(-size * 0.95, -size * 0.1, -size * 0.6, -size * 0.72, 0, -size * 0.34);
      ctx.bezierCurveTo(size * 0.6, -size * 0.72, size * 0.95, -size * 0.1, 0, size * 0.55);
      ctx.fill();
      if (id === 'feast') {
        ctx.fillStyle = PALETTE.emberCore;
        ctx.fillRect(-size * 0.09, -size * 0.3, size * 0.18, size * 0.5);
        ctx.fillRect(-size * 0.25, -size * 0.14, size * 0.5, size * 0.18);
      }
    } else if (id === 'cache') {
      ctx.save();
      ctx.rotate(Math.PI / 4);
      ctx.fillRect(-size * 0.42, -size * 0.42, size * 0.84, size * 0.84);
      ctx.fillStyle = PALETTE.emberCore;
      ctx.fillRect(-size * 0.2, -size * 0.2, size * 0.4, size * 0.4);
      ctx.restore();
    }
    ctx.restore();
  }

  function dim(alpha) {
    ctx.fillStyle = `rgba(4, 5, 12, ${alpha})`;
    ctx.fillRect(0, 0, FIELD.width, FIELD.height);
  }

  function drawTitle(state, best) {
    dim(0.42);
    const cx = FIELD.width / 2;
    ctx.save();
    try { ctx.letterSpacing = '10px'; } catch { /* older engines: the title still reads */ }
    ctx.shadowColor = 'rgba(255, 179, 71, 0.55)';
    ctx.shadowBlur = 34;
    text('EMBERWARD', cx, 218, 96, PALETTE.text, 'center', 800);
    ctx.restore();
    ctx.save();
    try { ctx.letterSpacing = '14px'; } catch { /* as above */ }
    text('THE LAST LANTERN', cx, 282, 23, PALETTE.ember, 'center', 700);
    ctx.restore();
    text('The Hollow have swallowed every light in the valley but yours.', cx, 348, 20, PALETTE.text, 'center', 500);
    text('Grow your flame through their waves — and put out the Hollow Star before it puts out you.', cx, 380, 20, PALETTE.text, 'center', 500);

    const lines = [
      ['WASD / ARROWS', 'walk the dark'],
      ['SPACE', 'dash — untouchable mid-lunge'],
      ['GATHER EMBERS', 'level up, choose a boon'],
      ['1 · 2 · 3 / CLICK', 'take the boon'],
      ['P / M', 'pause / sound'],
    ];
    let y = 442;
    for (const [key, what] of lines) {
      text(key, cx - 26, y, 16, PALETTE.emberCore, 'right', 800);
      text(what, cx - 8, y, 16, PALETTE.muted, 'left', 500);
      y += 27;
    }
    const blink = 0.55 + Math.sin(clock * 3.2) * 0.45;
    text('PRESS ENTER OR CLICK TO TAKE UP THE LANTERN', cx, 622, 21, PALETTE.emberCore, 'center', 800, blink);
    if (best > 0) text(`Best score ${best.toLocaleString('en-US')}`, cx, 662, 15, PALETTE.muted, 'center', 500);
  }

  function drawLevelUp(state, describeChoice, mouse) {
    dim(0.62);
    const cx = FIELD.width / 2;
    text('THE FLAME GROWS', cx, 108, 40, PALETTE.text, 'center', 800);
    text(`Level ${state.level} — choose a boon`, cx, 148, 18, PALETTE.ember, 'center', 600);
    cards = [];
    const width = 302;
    const height = 356;
    const gap = 26;
    const startX = cx - (width * 3 + gap * 2) / 2;
    const y = 188;
    state.choices.forEach((choice, index) => {
      const x = startX + index * (width + gap);
      const hover = mouse && mouse.x >= x && mouse.x <= x + width && mouse.y >= y && mouse.y <= y + height;
      cards.push({ x, y, width, height, index });
      roundedRect(x, y, width, height, 16);
      ctx.fillStyle = hover ? 'rgba(24, 26, 48, 0.96)' : PALETTE.panel;
      ctx.fill();
      ctx.strokeStyle = hover ? PALETTE.ember : PALETTE.panelEdge;
      ctx.lineWidth = hover ? 2.5 : 1.5;
      ctx.stroke();
      drawIcon(choice.id, x + width / 2, y + 74, 44);
      const info = describeChoice(choice);
      text(info.name, x + width / 2, y + 140, 25, PALETTE.text, 'center', 800);
      text(info.tag, x + width / 2, y + 172, 13, PALETTE.ember, 'center', 700);
      let ly = y + 208;
      for (const line of wrapLines(info.lines[0], 15.5, width - 44, 400)) {
        text(line, x + width / 2, ly, 15.5, PALETTE.muted, 'center', 400);
        ly += 22;
      }
      if (info.lines[1]) {
        const statLines = wrapLines(info.lines[1], 14.5, width - 44, 600);
        let sy = y + height - 30 - (statLines.length - 1) * 20;
        for (const line of statLines) {
          text(line, x + width / 2, sy, 14.5, PALETTE.emberCore, 'center', 600);
          sy += 20;
        }
      }
      text(String(index + 1), x + width / 2, y + height - 66, 15, PALETTE.muted, 'center', 700);
    });
    text('Press 1 · 2 · 3 — or click a card', cx, 592, 15, PALETTE.muted, 'center', 500);
  }

  function statsRows(state, best) {
    return [
      ['SCORE', state.score.toLocaleString('en-US')],
      ['BEST', Math.max(best, state.score).toLocaleString('en-US')],
      ['TIME IN THE DARK', formatTime(state.time)],
      ['HOLLOW FELLED', String(state.kills)],
      ['LEVEL REACHED', String(state.level)],
    ];
  }

  function drawEnd(state, best, wonGame) {
    dim(wonGame ? 0.45 : 0.6);
    const cx = FIELD.width / 2;
    if (wonGame) {
      ctx.save();
      ctx.shadowColor = 'rgba(255, 179, 71, 0.6)';
      ctx.shadowBlur = 30;
      text('DAWN BREAKS', cx, 168, 66, PALETTE.emberCore, 'center', 800);
      ctx.restore();
      text('The Hollow Star is out, and one by one the valley lights its windows again.', cx, 224, 19, PALETTE.text, 'center', 500);
    } else {
      text('THE LIGHT GOES OUT', cx, 168, 58, '#ff8fa3', 'center', 800);
      text(`The dark keeps the valley — this time. You held it back for ${formatTime(state.time)}.`, cx, 224, 19, PALETTE.text, 'center', 500);
    }
    let y = 292;
    for (const [label, value] of statsRows(state, best)) {
      text(label, cx - 24, y, 17, PALETTE.muted, 'right', 700);
      text(value, cx + 4, y, 19, PALETTE.text, 'left', 800);
      y += 38;
    }
    const blink = 0.55 + Math.sin(clock * 3.2) * 0.45;
    text('PRESS ENTER OR CLICK TO TAKE UP THE LANTERN AGAIN', cx, 548, 19, PALETTE.emberCore, 'center', 800, blink);
  }

  function drawPaused() {
    dim(0.55);
    text('PAUSED', FIELD.width / 2, 320, 46, PALETTE.text, 'center', 800);
    text('Press P or Esc to walk on — M toggles the sound', FIELD.width / 2, 372, 17, PALETTE.muted, 'center', 500);
  }

  function draw(state, screen, best, extras = {}) {
    const now = performance.now();
    clock += Math.min(0.1, (now - lastNow) / 1000);
    lastNow = now;
    const placed = fit();
    ctx.setTransform(placed.dpr, 0, 0, placed.dpr, 0, 0);
    ctx.fillStyle = PALETTE.night;
    ctx.fillRect(0, 0, canvas.clientWidth || window.innerWidth, canvas.clientHeight || window.innerHeight);
    ctx.save();
    ctx.translate(placed.ox, placed.oy);
    ctx.scale(placed.scale, placed.scale);
    // Screen shake: the whole night judders, never the UI's readability for long.
    if (state.shake > 0.2 && screen === SCREEN_PLAY) {
      const amount = state.shake;
      ctx.translate((Math.random() - 0.5) * amount, (Math.random() - 0.5) * amount);
    }
    const time = state.time;
    drawWorld(state, time);
    if (screen !== SCREEN_TITLE) drawHud(state, extras.muted);
    if (screen === SCREEN_TITLE) drawTitle(state, best);
    else if (screen === SCREEN_LEVELUP) drawLevelUp(state, extras.describeChoice, extras.mouse);
    else if (screen === SCREEN_PAUSED) drawPaused();
    else if (screen === SCREEN_OVER) drawEnd(state, best, false);
    else if (screen === SCREEN_WIN) drawEnd(state, best, true);
    ctx.restore();
    return view;
  }

  return {
    draw,
    view,
    get cards() {
      return cards;
    },
  };
}
