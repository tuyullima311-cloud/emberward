// A small seeded random generator (splitmix32): the same seed always deals the same night,
// which is what makes the screenshot scenes repeatable and a fair run reproducible.

export function createRandom(seed) {
  let state = seed >>> 0;
  return function random() {
    state = (state + 0x9e3779b9) >>> 0;
    let z = state;
    z = Math.imul(z ^ (z >>> 16), 0x21f0aad);
    z = Math.imul(z ^ (z >>> 15), 0x735a2d97);
    return ((z ^ (z >>> 15)) >>> 0) / 4294967296;
  };
}

/** A float in [min, max). */
export function range(random, min, max) {
  return min + random() * (max - min);
}

/** An integer in [min, max], both ends included. */
export function integer(random, min, max) {
  return min + Math.floor(random() * (max - min + 1));
}

/** One member of the list, chosen by the generator. */
export function pick(random, list) {
  return list[Math.floor(random() * list.length)];
}

/** Shuffles a copy of the list with the generator and returns it. */
export function shuffled(random, list) {
  const copy = list.slice();
  for (let i = copy.length - 1; i > 0; i -= 1) {
    const j = Math.floor(random() * (i + 1));
    const held = copy[i];
    copy[i] = copy[j];
    copy[j] = held;
  }
  return copy;
}
