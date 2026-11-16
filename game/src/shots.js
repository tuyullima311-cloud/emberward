// The screenshot scenes behind ?shot=title|battle|boss|victory. Each plays the real rules
// forward from a fresh world, steered by a simple autopilot (flee what is close, dodge what
// is fired, gather embers when it is safe), so every frame is a true moment of the game and
// the same seed always gives the same frame. The boss scenes first hand the keeper a
// mid-game build, as four minutes of real play would have earned her.

import { BOSS_TIME, FIELD, STEP } from './config.js';
import { SCREEN_LEVELUP, SCREEN_OVER, SCREEN_PLAY, SCREEN_TITLE, SCREEN_WIN } from './render.js';

const TITLE_SECONDS = 6;
const BATTLE_TARGET = 78;
const BATTLE_LIMIT = 115;

/** How the autopilot steers: away from teeth and orbs, toward embers and mending. */
function autopilot(state) {
  const player = state.player;
  let x = 0;
  let y = 0;
  let danger = 0;
  for (const enemy of state.enemies) {
    const dx = player.x - enemy.x;
    const dy = player.y - enemy.y;
    const dist = Math.hypot(dx, dy) || 1;
    const reach = 190 + enemy.radius;
    if (dist < reach) {
      const weight = (1 - dist / reach) * (enemy.kind === 'star' ? 2.4 : 1.6);
      x += (dx / dist) * weight;
      y += (dy / dist) * weight;
      // Strafe sideways around the nearest teeth instead of backing into a wall.
      x += (-dy / dist) * weight * 0.65;
      y += (dx / dist) * weight * 0.65;
      if (dist < enemy.radius + 62) danger = Math.max(danger, 1);
    }
  }
  for (const orb of state.orbs) {
    const dx = player.x - orb.x;
    const dy = player.y - orb.y;
    const dist = Math.hypot(dx, dy) || 1;
    if (dist < 120) {
      x += (dx / dist) * (1 - dist / 120) * 2.2;
      y += (dy / dist) * (1 - dist / 120) * 2.2;
      if (dist < 52) danger = Math.max(danger, 1);
    }
  }
  // Mending first when hurt, embers when the coast is clear.
  let target = null;
  let targetDist = Infinity;
  const wantHeart = player.hp < player.maxHp * 0.55 && state.hearts.length > 0;
  const pool = wantHeart ? state.hearts : state.shards;
  for (const item of pool) {
    const dist = Math.hypot(item.x - player.x, item.y - player.y);
    if (dist < targetDist) {
      targetDist = dist;
      target = item;
    }
  }
  if (target && (wantHeart || danger === 0) && targetDist < 380) {
    x += ((target.x - player.x) / (targetDist || 1)) * 0.55;
    y += ((target.y - player.y) / (targetDist || 1)) * 0.55;
  }
  // Never hug a wall: the middle of the arena is breathing room.
  const edge = 150;
  if (player.x < edge) x += (edge - player.x) / edge;
  if (player.x > FIELD.width - edge) x -= (edge - (FIELD.width - player.x)) / edge;
  if (player.y < edge) y += (edge - player.y) / edge;
  if (player.y > FIELD.height - edge) y -= (edge - (FIELD.height - player.y)) / edge;
  const length = Math.hypot(x, y);
  if (length > 1) {
    x /= length;
    y /= length;
  }
  return { x, y, dash: danger > 0 };
}

/** Plays the world forward under the autopilot, taking boons as they come, until `until`. */
function play(world, seconds, until, takeBoons = true) {
  const state = world.state;
  let picks = 0;
  const steps = Math.round(seconds / STEP);
  for (let i = 0; i < steps; i += 1) {
    if (state.levelUpPending && takeBoons) {
      const weapons = state.choices.filter((choice) => choice.type === 'weapon');
      const choice = weapons.length > 0 ? weapons[picks % weapons.length] : state.choices[0];
      world.applyUpgrade(choice);
      picks += 1;
      continue;
    }
    world.step(STEP, autopilot(state));
    if (state.lost || state.won) break;
    if (until && until(state)) break;
  }
}

/** A build four honest minutes would earn: strong, varied, and short of maxed. */
function grantMidGameBuild(world) {
  const state = world.state;
  state.weapons.lantern.level = 4;
  state.weapons.wisps = { level: 3, angle: 0 };
  state.weapons.nova = { level: 3, timer: 1.1 };
  state.weapons.seekers = { level: 2, timer: 0.7 };
  state.passives = { boots: 1, might: 2, magnet: 1, heart: 1 };
  state.level = 11;
  state.player.maxHp = 120;
  state.player.hp = 120;
}

/**
 * Set `world` to the named scene and return the screen to draw over it and the best score
 * to show. Any other name is the title.
 */
export function stageShot(name, world) {
  const state = world.state;
  world.reset();
  if (name === 'battle') {
    // A keeper a minute and more into her night: wisps already won, the swarm thickening.
    state.weapons.wisps = { level: 2, angle: 0 };
    state.level = 3;
    play(world, BATTLE_LIMIT, (s) => s.time >= BATTLE_TARGET && s.enemies.length >= 7 && s.player.hp > s.player.maxHp * 0.45);
    if (state.levelUpPending) world.applyUpgrade(state.choices[0]);
    return { screen: state.lost ? SCREEN_OVER : SCREEN_PLAY, best: state.score };
  }
  if (name === 'boons') {
    // The moment a level lands: the world frozen, three boons on offer.
    play(world, 90, (s) => s.levelUpPending, false);
    return { screen: state.levelUpPending ? SCREEN_LEVELUP : SCREEN_PLAY, best: state.score };
  }
  if (name === 'boss' || name === 'victory') {
    grantMidGameBuild(world);
    state.time = BOSS_TIME - 4;
    play(world, 30, (s) => s.boss !== null && s.time > BOSS_TIME + 9);
    if (name === 'boss') {
      if (state.levelUpPending) world.applyUpgrade(state.choices[0]);
      return { screen: state.lost ? SCREEN_OVER : SCREEN_PLAY, best: state.score };
    }
    play(world, 240, (s) => s.won);
    return { screen: state.won ? SCREEN_WIN : SCREEN_PLAY, best: state.score };
  }
  for (let i = 0; i < TITLE_SECONDS / STEP; i += 1) {
    world.step(STEP, { x: 0, y: 0, dash: false }, true);
  }
  return { screen: SCREEN_TITLE, best: 0 };
}
