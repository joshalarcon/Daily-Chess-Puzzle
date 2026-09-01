/**
 * EngineHint.jsx
 *
 * Displays Stockfish engine analysis after the user makes a wrong move.
 *
 * Shows:
 *   — Engine "thinking" spinner while isAnalysing is true
 *   — Up to 3 principal variations with score, depth, and SAN move line
 *   — Best move call-out at the top
 *   — "Show hint" button (uses expectedMove from the puzzle solution)
 *   — Accessible with aria-live for screen readers
 *
 * Props:
 *   isAnalysing   {boolean}   — true while Stockfish is searching
 *   engineReady   {boolean}   — false until UCI handshake done
 *   lines         {Array}     — PV lines from useStockfish
 *   bestMove      {string}    — UCI best move string
 *   fen           {string}    — current position FEN
 *   expectedMove  {string}    — correct solution UCI move
 *   onShowHint    {Function}  — called when user clicks "Show hint"
 *   visible       {boolean}   — only render when status === blunder
 */

import { useMemo } from "react";
import { uciSequenceToSan, formatScore, scoreColourClass, uciToArrow } from "../utils/uciUtils.js";

/* ── Sub-components ──────────────────────────────────────────────────────── */

function Spinner() {
  return (
    <div className="flex items-center gap-2 text-gray-400 py-2" aria-live="polite">
      <svg
        className="w-4 h-4 animate-spin text-blue-400"
        xmlns="http://www.w3.org/2000/svg"
        fill="none"
        viewBox="0 0 24 24"
        aria-hidden="true"
      >
        <circle
          className="opacity-25"
          cx="12" cy="12" r="10"
          stroke="currentColor" strokeWidth="4"
        />
        <path
          className="opacity-75"
          fill="currentColor"
          d="M4 12a8 8 0 018-8v4a4 4 0 00-4 4H4z"
        />
      </svg>
      <span className="text-sm font-medium text-blue-300">
        Stockfish is calculating…
      </span>
    </div>
  );
}

function PVLine({ line, fen, rank }) {
  const sanMoves = useMemo(
    () => uciSequenceToSan(fen, line.pv ?? []),
    [fen, line.pv]
  );

  const scoreStr = formatScore(line.score, line.mate);
  const scoreClass = scoreColourClass(line.score, line.mate);

  const rankLabel = ["Best", "2nd", "3rd"][rank] ?? `${rank + 1}th`;
  const rankColour = rank === 0
    ? "border-blue-500 bg-blue-950/60"
    : "border-gray-700 bg-gray-900/40";

  return (
    <div className={`rounded-lg border px-3 py-2 ${rankColour}`}>
      <div className="flex items-center justify-between mb-1">
        {/* Rank label */}
        <span className="text-xs font-semibold text-gray-400 uppercase tracking-wide">
          {rankLabel} line
        </span>
        {/* Score + depth */}
        <div className="flex items-center gap-2">
          <span className={`font-mono text-sm font-bold ${scoreClass}`}>
            {scoreStr}
          </span>
          <span className="text-xs text-gray-600 font-mono">
            d{line.depth}
          </span>
        </div>
      </div>

      {/* SAN move sequence */}
      <p className="font-mono text-sm text-gray-200 leading-relaxed break-words">
        {sanMoves.length > 0
          ? sanMoves.slice(0, 6).join("  ")
          : line.pv?.slice(0, 4).join("  ") ?? "—"}
        {(sanMoves.length > 6 || (line.pv?.length ?? 0) > 4) && (
          <span className="text-gray-500"> …</span>
        )}
      </p>
    </div>
  );
}

/* ── Main component ──────────────────────────────────────────────────────── */
export default function EngineHint({
  visible,
  isAnalysing,
  engineReady,
  lines,
  bestMove,
  fen,
  expectedMove,
  onShowHint,
}) {
  if (!visible) return null;

  // Filter out empty slots from the lines array
  const validLines = (lines ?? []).filter(Boolean);

  return (
    <section
      className="w-full rounded-xl border border-gray-700 bg-gray-900/80
                 backdrop-blur-sm p-4 space-y-3 animate-slide-up"
      aria-label="Engine analysis"
      aria-live="polite"
    >
      {/* ── Header ────────────────────────────────────────────────────── */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          {/* Engine icon */}
          <span className="text-lg" aria-hidden="true">⚙</span>
          <h2 className="text-sm font-semibold text-gray-200">
            Stockfish 17 Analysis
          </h2>
          {/* Ready indicator */}
          <span
            className={[
              "inline-block w-2 h-2 rounded-full",
              engineReady ? "bg-green-400" : "bg-gray-600",
            ].join(" ")}
            title={engineReady ? "Engine ready" : "Engine loading"}
            aria-label={engineReady ? "Engine ready" : "Engine loading"}
          />
        </div>

        {/* Show hint button */}
        {expectedMove && typeof onShowHint === "function" && (
          <button
            onClick={onShowHint}
            className="text-xs px-3 py-1 rounded-full border border-yellow-600
                       text-yellow-400 hover:bg-yellow-900/40 transition-colors
                       focus:outline-none focus:ring-2 focus:ring-yellow-500"
          >
            💡 Show hint
          </button>
        )}
      </div>

      {/* ── Engine thinking spinner ────────────────────────────────────── */}
      {isAnalysing && <Spinner />}

      {/* ── Best move call-out ─────────────────────────────────────────── */}
      {!isAnalysing && bestMove && (
        <div className="flex items-center gap-2 px-3 py-2 rounded-lg
                        bg-blue-900/40 border border-blue-700">
          <span className="text-blue-400 text-sm font-semibold">Best move:</span>
          <span className="font-mono text-white text-sm">
            {uciToArrow(bestMove)}
          </span>
        </div>
      )}

      {/* ── PV lines ──────────────────────────────────────────────────── */}
      {!isAnalysing && validLines.length > 0 && (
        <div className="space-y-2">
          {validLines.slice(0, 3).map((line, i) => (
            <PVLine key={i} line={line} fen={fen} rank={i} />
          ))}
        </div>
      )}

      {/* ── No results yet ────────────────────────────────────────────── */}
      {!isAnalysing && validLines.length === 0 && !bestMove && (
        <p className="text-sm text-gray-500 italic">
          {engineReady
            ? "Awaiting position analysis…"
            : "Engine is initialising, please wait…"}
        </p>
      )}

      {/* ── Footer note ───────────────────────────────────────────────── */}
      <p className="text-xs text-gray-600 border-t border-gray-800 pt-2">
        Analysis triggered after incorrect move. Depth 18 · MultiPV 3
      </p>
    </section>
  );
}
