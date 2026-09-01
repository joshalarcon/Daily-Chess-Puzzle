/**
 * uciUtils.js
 *
 * Utility functions for working with UCI move notation and
 * converting engine output into human-readable move strings.
 */

import { Chess } from "chess.js";

/**
 * Converts a UCI move string (e.g. "e2e4", "e1g1", "e7e8q") into a
 * chess.js move object { from, to, promotion }.
 *
 * @param {string} uci - UCI move string.
 * @returns {{ from: string, to: string, promotion?: string }}
 */
export function uciToMoveObject(uci) {
  if (!uci || uci.length < 4) return null;
  const from = uci.slice(0, 2);
  const to = uci.slice(2, 4);
  const promotion = uci.length === 5 ? uci[4] : undefined;
  return promotion ? { from, to, promotion } : { from, to };
}

/**
 * Converts a sequence of UCI moves starting from a given FEN into
 * an array of Standard Algebraic Notation (SAN) strings.
 *
 * Returns as many SAN strings as could be applied before an illegal
 * move was encountered.
 *
 * @param {string} fen       - Starting position as FEN.
 * @param {string[]} uciMoves - Array of UCI move strings.
 * @returns {string[]} Array of SAN strings.
 */
export function uciSequenceToSan(fen, uciMoves) {
  if (!fen || !uciMoves?.length) return [];

  let game;
  try {
    game = new Chess(fen);
  } catch {
    return [];
  }

  const sanMoves = [];
  for (const uci of uciMoves) {
    const moveObj = uciToMoveObject(uci);
    if (!moveObj) break;
    try {
      const result = game.move(moveObj);
      if (!result) break;
      sanMoves.push(result.san);
    } catch {
      break;
    }
  }
  return sanMoves;
}

/**
 * Formats a centipawn score into a human-readable string.
 *
 *   +1.25  — White is ahead by 1.25 pawns
 *   -0.50  — Black is ahead by 0.50 pawns
 *   M3     — Mate in 3
 *   M-2    — Black has mate in 2
 *
 * @param {number | null} score - Centipawn score (positive = White advantage).
 * @param {number | null} mate  - Mate distance (positive = White wins).
 * @returns {string}
 */
export function formatScore(score, mate) {
  if (mate !== null && mate !== undefined) {
    return mate > 0 ? `M${mate}` : `M${mate}`;
  }
  if (score !== null && score !== undefined) {
    const pawns = (score / 100).toFixed(2);
    return score >= 0 ? `+${pawns}` : `${pawns}`;
  }
  return "—";
}

/**
 * Returns a CSS colour class based on a centipawn score.
 * Used to colour the engine evaluation badge.
 *
 * @param {number | null} score
 * @param {number | null} mate
 * @returns {string} Tailwind text colour class.
 */
export function scoreColourClass(score, mate) {
  if (mate !== null && mate !== undefined) {
    return mate > 0 ? "text-purple-400" : "text-red-400";
  }
  if (score === null || score === undefined) return "text-gray-400";
  if (score > 100) return "text-green-400";
  if (score < -100) return "text-red-400";
  return "text-yellow-400";
}

/**
 * Converts a UCI move string to a human-readable arrow description.
 * e.g. "e2e4" → "e2 → e4"
 *
 * @param {string} uci
 * @returns {string}
 */
export function uciToArrow(uci) {
  if (!uci || uci.length < 4) return uci ?? "";
  return `${uci.slice(0, 2)} → ${uci.slice(2, 4)}`;
}

/**
 * Validates that a UCI string looks syntactically correct.
 *
 * @param {string} uci
 * @returns {boolean}
 */
export function isValidUci(uci) {
  return /^[a-h][1-8][a-h][1-8][qrbn]?$/.test(uci ?? "");
}
