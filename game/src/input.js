// Keyboard and mouse, read as the game wants them: a held movement direction, a held dash,
// and edge-triggered action bits the screens consume once (confirm, pause, mute, card picks).
// Mouse positions are reported in the game's logical coordinates through the renderer's view,
// which the boot code hands in and the renderer keeps current every frame.

export const ACTION_CONFIRM = 1;
export const ACTION_PAUSE = 2;
export const ACTION_MUTE = 4;
export const ACTION_PICK1 = 8;
export const ACTION_PICK2 = 16;
export const ACTION_PICK3 = 32;

const HELD_KEYS = new Set([
  'arrowup', 'arrowdown', 'arrowleft', 'arrowright', ' ',
  'w', 'a', 's', 'd',
]);

export function createInput(canvas, view) {
  const keys = new Set();
  const mouse = { x: 0, y: 0, inside: false };
  let pending = 0;

  function toLogical(event) {
    const rect = canvas.getBoundingClientRect();
    const clientX = (event.clientX - rect.left) * (canvas.width / Math.max(1, rect.width));
    const clientY = (event.clientY - rect.top) * (canvas.height / Math.max(1, rect.height));
    mouse.x = (clientX - view.ox) / view.scale;
    mouse.y = (clientY - view.oy) / view.scale;
    mouse.inside = mouse.x >= 0 && mouse.y >= 0 && mouse.x <= 1280 && mouse.y <= 720;
  }

  window.addEventListener('keydown', (event) => {
    const key = event.key.toLowerCase();
    if (HELD_KEYS.has(key)) event.preventDefault();
    if (event.repeat) return;
    keys.add(key);
    if (key === 'enter' || key === ' ') pending |= ACTION_CONFIRM;
    else if (key === 'escape' || key === 'p') pending |= ACTION_PAUSE;
    else if (key === 'm') pending |= ACTION_MUTE;
    else if (key === '1') pending |= ACTION_PICK1;
    else if (key === '2') pending |= ACTION_PICK2;
    else if (key === '3') pending |= ACTION_PICK3;
  });
  window.addEventListener('keyup', (event) => {
    keys.delete(event.key.toLowerCase());
  });
  window.addEventListener('blur', () => keys.clear());
  canvas.addEventListener('pointermove', toLogical);
  canvas.addEventListener('pointerdown', (event) => {
    toLogical(event);
    pending |= ACTION_CONFIRM;
  });

  return {
    mouse,
    /** The held movement direction as a unit vector (diagonals are not faster). */
    direction() {
      let x = 0;
      let y = 0;
      if (keys.has('a') || keys.has('arrowleft')) x -= 1;
      if (keys.has('d') || keys.has('arrowright')) x += 1;
      if (keys.has('w') || keys.has('arrowup')) y -= 1;
      if (keys.has('s') || keys.has('arrowdown')) y += 1;
      if (x === 0 && y === 0) return { x: 0, y: 0 };
      const length = Math.hypot(x, y);
      return { x: x / length, y: y / length };
    },
    /** True while the dash key is held; the world dashes whenever its cooldown is ready. */
    dashHeld() {
      return keys.has(' ') || keys.has('shift');
    },
    /** The action bits pressed since the last call; reading them clears them. */
    takeActions() {
      const actions = pending;
      pending = 0;
      return actions;
    },
  };
}
