// Device capabilities, decided once at startup.
const mq = (q) => typeof matchMedia === 'function' && matchMedia(q).matches;

export const IS_TOUCH = mq('(pointer: coarse)') || (navigator.maxTouchPoints > 1 && mq('(hover: none)'));

/** Lighter rendering for phones/tablets. */
export const LITE = IS_TOUCH;
