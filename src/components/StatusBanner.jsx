/**
 * StatusBanner.jsx
 *
 * Displays a contextual status message based on the current game state.
 *
 * States and their visual treatment:
 *   idle      — neutral grey  "Loading puzzle…"
 *   yourTurn  — blue          "Your Turn  ♟  Find the best move"
 *   correct   — green         "✓ Correct!  Keep going…"
 *   opponent  — grey          "Opponent is thinking…"
 *   blunder   — red + shake   "✗ Blunder!  Try again"
 *   solved    — purple        "✦ Puzzle Solved!  Well done"
 *
 * Also renders the puzzle metadata row (theme, difficulty, rating badge).
 */

import { STATUSES } from "../hooks/useChessPuzzle.js";

/* ── Config map ──────────────────────────────────────────────────────────── */
const STATUS_CONFIG = {
  [STATUSES.IDLE]: {
    icon: "⏳",
    label: "Loading puzzle…",
    sub: "",
    bg: "bg-gray-800",
    border: "border-gray-600",
    text: "text-gray-300",
    badge: "bg-gray-700 text-gray-300",
  },
  [STATUSES.YOUR_TURN]: {
    icon: "♟",
    label: "Your Turn",
    sub: "Find the best move",
    bg: "bg-blue-950",
    border: "border-blue-500",
    text: "text-blue-300",
    badge: "bg-blue-900 text-blue-200",
  },
  [STATUSES.CORRECT]: {
    icon: "✓",
    label: "Correct!",
    sub: "Keep going…",
    bg: "bg-green-950",
    border: "border-green-500",
    text: "text-green-300",
    badge: "bg-green-900 text-green-200",
  },
  [STATUSES.OPPONENT]: {
    icon: "⏱",
    label: "Opponent is thinking…",
    sub: "",
    bg: "bg-gray-800",
    border: "border-gray-600",
    text: "text-gray-400",
    badge: "bg-gray-700 text-gray-300",
  },
  [STATUSES.BLUNDER]: {
    icon: "✗",
    label: "Blunder!",
    sub: "That's not the right move — try again",
    bg: "bg-red-950",
    border: "border-red-500",
    text: "text-red-300",
    badge: "bg-red-900 text-red-200",
  },
  [STATUSES.SOLVED]: {
    icon: "✦",
    label: "Puzzle Solved!",
    sub: "Excellent work",
    bg: "bg-purple-950",
    border: "border-purple-500",
    text: "text-purple-300",
    badge: "bg-purple-900 text-purple-200",
  },
};

/* ── Difficulty colour ───────────────────────────────────────────────────── */
const DIFFICULTY_COLOUR = {
  Beginner:     "text-green-400 bg-green-900/40",
  Intermediate: "text-yellow-400 bg-yellow-900/40",
  Advanced:     "text-orange-400 bg-orange-900/40",
  Expert:       "text-red-400 bg-red-900/40",
};

/* ── Component ───────────────────────────────────────────────────────────── */
export default function StatusBanner({ status, puzzle, progress, attempts }) {
  const cfg = STATUS_CONFIG[status] ?? STATUS_CONFIG[STATUSES.IDLE];
  const diffColour =
    DIFFICULTY_COLOUR[puzzle?.difficulty] ?? "text-gray-400 bg-gray-800";

  return (
    <div className="w-full space-y-2" role="status" aria-live="polite">

      {/* ── Main status pill ─────────────────────────────────────────── */}
      <div
        className={[
          "flex items-center gap-3 px-4 py-3 rounded-xl border",
          "transition-all duration-300 animate-slide-up",
          cfg.bg, cfg.border,
        ].join(" ")}
      >
        {/* Icon */}
        <span
          className={[
            "text-2xl leading-none shrink-0 w-8 text-center",
            status === STATUSES.SOLVED ? "animate-bounce" : "",
            status === STATUSES.BLUNDER ? "animate-shake" : "",
          ]
            .filter(Boolean)
            .join(" ")}
          aria-hidden="true"
        >
          {cfg.icon}
        </span>

        {/* Text block */}
        <div className="flex-1 min-w-0">
          <p className={`font-semibold text-base leading-tight ${cfg.text}`}>
            {cfg.label}
          </p>
          {cfg.sub && (
            <p className="text-sm text-gray-400 mt-0.5 leading-tight">
              {cfg.sub}
            </p>
          )}
        </div>

        {/* Attempts badge */}
        {attempts > 0 && status !== STATUSES.SOLVED && (
          <span
            className="shrink-0 text-xs font-mono px-2 py-0.5 rounded-full bg-red-900/50 text-red-300"
            title="Wrong attempts this puzzle"
          >
            {attempts} ✗
          </span>
        )}
      </div>

      {/* ── Puzzle metadata row ───────────────────────────────────────── */}
      {puzzle && (
        <div className="flex flex-wrap items-center gap-2 px-1">
          {/* Theme tag */}
          <span className="text-xs font-medium px-2.5 py-1 rounded-full bg-gray-800 text-gray-300 border border-gray-700">
            {puzzle.theme}
          </span>

          {/* Difficulty badge */}
          <span
            className={`text-xs font-semibold px-2.5 py-1 rounded-full border border-transparent ${diffColour}`}
          >
            {puzzle.difficulty}
          </span>

          {/* Rating */}
          <span className="text-xs font-mono text-gray-500 px-2 py-1">
            ≈ {puzzle.rating} Elo
          </span>

          {/* Spacer */}
          <span className="flex-1" />

          {/* Move progress */}
          {status !== STATUSES.IDLE && (
            <span className="text-xs font-mono text-gray-500">
              Move {progress}
            </span>
          )}
        </div>
      )}
    </div>
  );
}
