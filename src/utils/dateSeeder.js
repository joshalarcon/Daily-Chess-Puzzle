/**
 * dateSeeder.js
 *
 * Deterministically selects a puzzle index from the dataset using
 * the current calendar date as a seed. The same date always maps to
 * the same puzzle, and the puzzle changes at midnight local time.
 *
 * Algorithm:
 *   seed  = YYYYMMDD as an integer  (e.g. 20260831)
 *   index = mulberry32(seed) modulo PUZZLE_COUNT
 *
 * mulberry32 is a fast, well-distributed 32-bit PRNG that is fully
 * deterministic given the same seed — making it perfect for date-based
 * selection without any server dependency.
 */

const PUZZLE_COUNT = 100;

/**
 * mulberry32 — single-iteration 32-bit pseudo-random number generator.
 * Returns a float in [0, 1) from the given 32-bit integer seed.
 *
 * @param {number} seed - A 32-bit unsigned integer seed.
 * @returns {number} A float in [0, 1).
 */
function mulberry32(seed) {
  let t = (seed + 0x6d2b79f5) >>> 0;
  t = Math.imul(t ^ (t >>> 15), t | 1);
  t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
  return ((t ^ (t >>> 14)) >>> 0) / 0x100000000;
}

/**
 * Converts a Date object to a compact YYYYMMDD integer seed.
 *
 * @param {Date} date - The date to convert.
 * @returns {number} Integer seed, e.g. 20260831.
 */
export function dateToSeed(date) {
  const y = date.getFullYear();
  const m = date.getMonth() + 1; // 1–12
  const d = date.getDate();       // 1–31
  return y * 10000 + m * 100 + d;
}

/**
 * Returns the puzzle index (0–99) for a given date.
 * Defaults to today's local date when no argument is supplied.
 *
 * @param {Date} [date=new Date()] - Target date.
 * @returns {number} Puzzle index in range [0, PUZZLE_COUNT).
 */
export function getPuzzleIndexForDate(date = new Date()) {
  const seed = dateToSeed(date);
  const rand = mulberry32(seed);
  return Math.floor(rand * PUZZLE_COUNT);
}

/**
 * Returns today's puzzle index using the local calendar date.
 *
 * @returns {number} Puzzle index for today.
 */
export function getTodaysPuzzleIndex() {
  return getPuzzleIndexForDate(new Date());
}

/**
 * Formats a Date into a human-readable string for the UI header.
 * Example output: "Monday, August 31, 2026"
 *
 * @param {Date} [date=new Date()] - Target date.
 * @returns {string} Formatted date string.
 */
export function formatPuzzleDate(date = new Date()) {
  return date.toLocaleDateString("en-US", {
    weekday: "long",
    year: "numeric",
    month: "long",
    day: "numeric",
  });
}

/**
 * Returns milliseconds until the next midnight (local time).
 * Useful for scheduling an automatic puzzle refresh.
 *
 * @returns {number} Milliseconds until midnight.
 */
export function msUntilMidnight() {
  const now = new Date();
  const midnight = new Date(
    now.getFullYear(),
    now.getMonth(),
    now.getDate() + 1,
    0, 0, 0, 0
  );
  return midnight.getTime() - now.getTime();
}
