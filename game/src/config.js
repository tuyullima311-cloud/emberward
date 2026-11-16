// Emberward tuning: every number and colour that shapes the game lives here, so the world's
// rules never depend on the window size. The arena is a fixed 1280x720 logical field; the
// renderer scales it to fit the screen.

export const FIELD = { width: 1280, height: 720, wall: 26 };

/** The simulation's fixed step, in seconds: 60 updates a second whatever the display's rate. */
export const STEP = 1 / 60;

export const PLAYER = {
  radius: 15,
  speed: 252,
  hp: 100,
  dashSpeed: 880,
  dashTime: 0.16,
  dashCooldown: 1.6,
  grace: 0.45, // seconds of mercy after any hit lands
  pickup: 46, // base ember-shard magnet radius
  collect: 24, // distance at which a shard is gathered
};

/** The Hollow Star arrives at this time; killing it wins the game. */
export const BOSS_TIME = 240;
export const BOSS_WARN_AT = 232;

/** Enemy shapes: radius, speed, health, contact damage, ember value and score by kind. */
export const FOES = {
  shade: { radius: 16, speed: 74, hp: 22, damage: 10, xp: 1, score: 15 },
  skitter: { radius: 10, speed: 138, hp: 10, damage: 6, xp: 1, score: 10 },
  brute: { radius: 30, speed: 44, hp: 130, damage: 20, xp: 5, score: 60 },
  spitter: { radius: 15, speed: 62, hp: 30, damage: 8, xp: 2, score: 35, orbDamage: 12, orbSpeed: 168, range: 300 },
  star: { radius: 46, speed: 52, hp: 4200, damage: 25, xp: 40, score: 5000 },
};

/** Weapon tuning per level (index 0 is level 1). Damage is multiplied by the Might passive. */
export const WEAPONS = {
  lantern: {
    name: 'Lantern Bolts',
    max: 5,
    damage: [12, 17, 23, 30, 40],
    cooldown: [0.85, 0.76, 0.68, 0.6, 0.52],
    projectiles: [1, 1, 2, 2, 3],
    blurb: 'The lantern spits sparks at the nearest Hollow.',
  },
  wisps: {
    name: 'Orbit Wisps',
    max: 5,
    damage: [9, 13, 18, 24, 32],
    count: [2, 3, 3, 4, 5],
    radius: [86, 92, 100, 108, 118],
    blurb: 'Ember wisps circle you and burn what they touch.',
  },
  nova: {
    name: 'Dawn Nova',
    max: 5,
    damage: [16, 24, 34, 46, 62],
    cooldown: [3.4, 3.1, 2.8, 2.5, 2.2],
    radius: [132, 148, 164, 182, 202],
    blurb: 'A ring of dawnfire bursts outward and shoves the dark back.',
  },
  seekers: {
    name: 'Cinder Seekers',
    max: 5,
    damage: [20, 28, 38, 50, 66],
    cooldown: [2.3, 2.1, 1.95, 1.8, 1.6],
    count: [1, 2, 2, 3, 4],
    blurb: 'Hunting moths of cinder that chase the Hollow and burst.',
  },
};

/** Passive charms, three levels each. */
export const PASSIVES = {
  boots: { name: 'Swift Boots', max: 3, blurb: 'Move 8% faster with every level.' },
  might: { name: 'Kindled Might', max: 3, blurb: 'Every weapon burns 12% hotter per level.' },
  magnet: { name: 'Ember Charm', max: 3, blurb: 'Draws ember shards in from 35% farther per level.' },
  heart: { name: 'Warden Heart', max: 3, blurb: 'Gain 20 maximum health and mend 20 now.' },
};

/** Fallback rewards offered when every weapon and charm is maxed. */
export const FALLBACKS = {
  feast: { name: 'Ember Feast', blurb: 'Feast on the light: mend 35 health at once.' },
  cache: { name: 'Star Cache', blurb: 'A hoard of dawn: +250 score, here and now.' },
};

export const PALETTE = {
  night: '#070812',
  nightFar: '#0d1024',
  stone: '#141830',
  stoneLine: '#232a4d',
  text: '#f3ead8',
  muted: '#9aa3c0',
  ember: '#ffb347',
  emberCore: '#ffe3ae',
  emberDeep: '#ff7b39',
  cloak: '#2f5d8a',
  cloakDark: '#1d3a5c',
  shadeBody: '#17142b',
  shadeEye: '#b79cff',
  skitterEye: '#7ef0d4',
  bruteBody: '#26121c',
  bruteEye: '#ff6b5e',
  spitterEye: '#a5e36b',
  starCore: '#ff5470',
  shard: '#ffd98a',
  heart: '#ff7d9c',
  hurt: '#ff4757',
  panel: 'rgba(10, 12, 26, 0.82)',
  panelEdge: '#3a4470',
};

export const FONT = 'system-ui, -apple-system, "Segoe UI", sans-serif';

/** Where the best score is kept between visits (this browser only). */
export const BEST_KEY = 'emberward.best';
