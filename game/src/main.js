// Boot and the one loop. Input is read every frame, the world advances in fixed 1/60 s
// steps (several in a slow frame, none in a fast one), the renderer paints what is there,
// and queued sound names become WebAudio. The game moves between six screens: title, play,
// the boon choice that pauses a run at each level, paused, defeat and dawn.
//
// ?seed=N fixes the night's pattern. ?shot=title|battle|boss|victory (with &seed=N) stages
// that scene instead of running the loop, paints it twice and sets window.__shotReady.

import { BEST_KEY, STEP } from './config.js';
import { createRandom } from './random.js';
import { createAudio } from './audio.js';
import { createWorld, EVENT_BOSS_WARN, EVENT_GAME_OVER, EVENT_LEVEL_UP, EVENT_VICTORY } from './world.js';
import {
  ACTION_CONFIRM, ACTION_MUTE, ACTION_PAUSE, ACTION_PICK1, ACTION_PICK2, ACTION_PICK3, createInput,
} from './input.js';
import {
  createRenderer, SCREEN_LEVELUP, SCREEN_OVER, SCREEN_PAUSED, SCREEN_PLAY, SCREEN_TITLE, SCREEN_WIN,
} from './render.js';
import { stageShot } from './shots.js';

/** The longest frame the loop catches up on; a longer stall (a hidden tab) is dropped. */
const MAX_FRAME = 0.25;

const params = new URLSearchParams(window.location.search);
const shot = params.get('shot');
const seedParam = Number.parseInt(params.get('seed') ?? '', 10);
const seed = Number.isInteger(seedParam) ? seedParam : Math.floor(Math.random() * 4294967296);

const canvas = document.getElementById('game');
const status = document.getElementById('status');
const world = createWorld(createRandom(seed));
const renderer = createRenderer(canvas);
const audio = createAudio();

function readBest() {
  try {
    return Number.parseInt(window.localStorage.getItem(BEST_KEY) ?? '0', 10) || 0;
  } catch {
    return 0;
  }
}

function saveBest(value) {
  try {
    window.localStorage.setItem(BEST_KEY, String(value));
  } catch {
    // Storage can be off (private windows): the best score then lasts this visit only.
  }
}

function runShot(name) {
  const scene = stageShot(name, world);
  let painted = 0;
  function paint() {
    renderer.draw(world.state, scene.screen, scene.best, { describeChoice: world.describeChoice, mouse: { x: -1, y: -1 } });
    painted += 1;
    if (painted < 2) requestAnimationFrame(paint);
    else window.__shotReady = true;
  }
  requestAnimationFrame(paint);
}

function runGame() {
  const input = createInput(canvas, renderer.view);
  let screen = SCREEN_TITLE;
  let best = readBest();
  let accumulator = 0;
  let last = performance.now();

  function announce(message) {
    status.textContent = message;
  }

  function drainSounds() {
    for (const name of world.state.sounds) {
      if (typeof audio[name] === 'function') audio[name]();
    }
    world.state.sounds.length = 0;
  }

  function startGame() {
    world.reset();
    accumulator = 0;
    screen = SCREEN_PLAY;
    audio.unlock();
    audio.startAmbient();
    announce('Playing. The Hollow are coming.');
  }

  function finishRun(wonGame) {
    screen = wonGame ? SCREEN_WIN : SCREEN_OVER;
    audio.stopAmbient();
    if (world.state.score > best) {
      best = world.state.score;
      saveBest(best);
    }
    announce(wonGame ? `Dawn breaks. Score ${world.state.score}.` : `The light goes out. Score ${world.state.score}. Best ${best}.`);
  }

  function pickChoice(index) {
    const choice = world.state.choices[index];
    if (!choice) return;
    world.applyUpgrade(choice);
    drainSounds();
    if (!world.state.levelUpPending) {
      screen = SCREEN_PLAY;
      announce(`Boon taken: ${choice.id}. Playing.`);
    }
  }

  function handleActions() {
    const actions = input.takeActions();
    if (actions & ACTION_MUTE) {
      audio.unlock();
      announce(audio.toggleMuted() ? 'Sound off.' : 'Sound on.');
    }
    if (screen === SCREEN_LEVELUP) {
      if (actions & ACTION_PICK1) pickChoice(0);
      else if (actions & ACTION_PICK2) pickChoice(1);
      else if (actions & ACTION_PICK3) pickChoice(2);
      else if (actions & ACTION_CONFIRM && input.mouse.inside) {
        const hit = renderer.cards.findIndex(
          (card) => input.mouse.x >= card.x && input.mouse.x <= card.x + card.width
            && input.mouse.y >= card.y && input.mouse.y <= card.y + card.height,
        );
        if (hit >= 0) pickChoice(hit);
      }
      return;
    }
    if (actions & ACTION_CONFIRM && (screen === SCREEN_TITLE || screen === SCREEN_OVER || screen === SCREEN_WIN)) {
      startGame();
    } else if (actions & ACTION_PAUSE && screen === SCREEN_PLAY) {
      screen = SCREEN_PAUSED;
      announce('Paused.');
    } else if (actions & (ACTION_PAUSE | ACTION_CONFIRM) && screen === SCREEN_PAUSED) {
      screen = SCREEN_PLAY;
      announce('Playing.');
    }
  }

  function step() {
    if (screen === SCREEN_TITLE) {
      world.step(STEP, { x: 0, y: 0, dash: false }, true);
      return;
    }
    const direction = input.direction();
    const events = world.step(STEP, { x: direction.x, y: direction.y, dash: input.dashHeld() });
    if (events & EVENT_BOSS_WARN) announce('The Hollow Star stirs.');
    if (events & EVENT_LEVEL_UP) {
      screen = SCREEN_LEVELUP;
      announce(`Level ${world.state.level}. Choose a boon.`);
    } else if (events & EVENT_VICTORY) finishRun(true);
    else if (events & EVENT_GAME_OVER) finishRun(false);
  }

  function frame(now) {
    requestAnimationFrame(frame);
    accumulator += Math.min((now - last) / 1000, MAX_FRAME);
    last = now;
    handleActions();
    if (screen === SCREEN_TITLE || screen === SCREEN_PLAY) {
      while (accumulator >= STEP && (screen === SCREEN_TITLE || screen === SCREEN_PLAY)) {
        step();
        accumulator -= STEP;
      }
    } else {
      accumulator = 0;
    }
    drainSounds();
    renderer.draw(world.state, screen, best, {
      muted: audio.muted,
      describeChoice: world.describeChoice,
      mouse: input.mouse,
    });
  }

  // Leaving the tab pauses a running game rather than letting the night run unseen.
  document.addEventListener('visibilitychange', () => {
    if (document.hidden && screen === SCREEN_PLAY) {
      screen = SCREEN_PAUSED;
      announce('Paused.');
    }
  });

  announce('Emberward. Press Enter or click to take up the lantern.');
  requestAnimationFrame(frame);
}

if (shot) runShot(shot);
else runGame();
