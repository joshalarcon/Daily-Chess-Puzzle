/**
 * PuzzleTimer.jsx
 *
 * Execution timer that starts when the puzzle loads and stops when
 * the puzzle is solved or a blunder occurs (per the current status).
 *
 * Features:
 *   — Counts up in MM:SS format
 *   — Pauses when status is "solved"
 *   — Colour shifts: green < 30s, yellow 30-90s, orange 90-180s, red > 180s
 *   — Shows a small pulse dot while running
 *   — Accessible via aria-label
 */

import { useEffect, useRef, useState } from "react";
import { STATUSES } from "../hooks/useChessPuzzle.js";

/* ── Colour thresholds (seconds) ─────────────────────────────────────────── */
function timerColour(seconds) {
  if (seconds < 30)  return "text-green-400";
  if (seconds < 90)  return "text-yellow-400";
  if (seconds < 180) return "text-orange-400";
  return "text-red-400";
}

/* ── Format seconds → "MM:SS" ───────────────────────────────────────────── */
function formatTime(totalSeconds) {
  const m = Math.floor(totalSeconds / 60);
  const s = totalSeconds % 60;
  return `${String(m).padStart(2, "0")}:${String(s).padStart(2, "0")}`;
}

/* ── Component ───────────────────────────────────────────────────────────── */
export default function PuzzleTimer({ status, puzzleId }) {
  const [elapsed, setElapsed] = useState(0);
  const intervalRef = useRef(null);
  const isSolved = status === STATUSES.SOLVED;

  /* Reset and restart timer whenever the puzzle changes (new puzzleId) */
  useEffect(() => {
    setElapsed(0);
  }, [puzzleId]);

  /* Start / stop the interval based on status */
  useEffect(() => {
    // Don't run while idle or already solved
    if (status === STATUSES.IDLE || isSolved) {
      if (intervalRef.current) {
        clearInterval(intervalRef.current);
        intervalRef.current = null;
      }
      return;
    }

    // Start ticking if not already running
    if (!intervalRef.current) {
      intervalRef.current = setInterval(() => {
        setElapsed((prev) => prev + 1);
      }, 1000);
    }

    return () => {
      if (intervalRef.current) {
        clearInterval(intervalRef.current);
        intervalRef.current = null;
      }
    };
  }, [status, isSolved]);

  const isRunning = !!intervalRef.current;
  const colour = isSolved ? "text-purple-400" : timerColour(elapsed);

  return (
    <div
      className="flex items-center gap-2"
      role="timer"
      aria-label={`Puzzle timer: ${formatTime(elapsed)}`}
      aria-live="off"
    >
      {/* Pulse dot — only shown while counting */}
      {isRunning && !isSolved && (
        <span
          className="inline-block w-2 h-2 rounded-full bg-current animate-pulse-slow"
          style={{ color: "inherit" }}
          aria-hidden="true"
        />
      )}

      {/* Solved check */}
      {isSolved && (
        <span className="text-purple-400 text-sm" aria-hidden="true">✓</span>
      )}

      {/* Time display */}
      <span
        className={[
          "font-mono text-lg font-semibold tabular-nums tracking-wider",
          "transition-colors duration-500",
          colour,
        ].join(" ")}
      >
        {formatTime(elapsed)}
      </span>
    </div>
  );
}
