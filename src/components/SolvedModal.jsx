/**
 * SolvedModal.jsx
 *
 * Celebratory pop-up shown when the user solves a puzzle.
 *
 * Displays:
 *   — Animated trophy + confetti dots
 *   — Puzzle title, difficulty badge, Elo rating
 *   — Stats: time taken, wrong attempts, hints used
 *   — Full solution in SAN notation
 *   — Share button (copies result to clipboard)
 *   — "Play Again" (retry same puzzle) + "Next Puzzle" (load a new one)
 *
 * Props
 *   isOpen      {boolean}
 *   puzzle      {object}    — puzzle data
 *   elapsed     {number}    — seconds taken to solve
 *   attempts    {number}    — wrong move count
 *   hintsUsed   {number}
 *   solution    {string[]}  — SAN moves
 *   onClose     {Function}  — dismiss modal
 *   onRetry     {Function}  — replay same puzzle
 *   onNext      {Function}  — load a different puzzle (random from dataset)
 */

import { useEffect, useRef } from "react";

/* ── Difficulty colour map ───────────────────────────────────────────────── */
const DIFF_STYLE = {
  Beginner:     { bg: "bg-green-900/50",  border: "border-green-700",  text: "text-green-400"  },
  Intermediate: { bg: "bg-yellow-900/50", border: "border-yellow-700", text: "text-yellow-400" },
  Advanced:     { bg: "bg-orange-900/50", border: "border-orange-700", text: "text-orange-400" },
  Expert:       { bg: "bg-red-900/50",    border: "border-red-700",    text: "text-red-400"    },
  Custom:       { bg: "bg-emerald-900/50",border: "border-emerald-700",text: "text-emerald-400"},
};

/* ── Format seconds → "1m 23s" or "45s" ─────────────────────────────────── */
function fmtTime(s) {
  if (!s && s !== 0) return "—";
  const m = Math.floor(s / 60);
  const sec = s % 60;
  return m > 0 ? `${m}m ${sec}s` : `${sec}s`;
}

/* ── Star rating based on attempts ──────────────────────────────────────── */
function starRating(attempts) {
  if (attempts === 0) return 3;
  if (attempts <= 2)  return 2;
  return 1;
}

/* ── Confetti dots (pure CSS, no library) ────────────────────────────────── */
const CONFETTI_COLOURS = [
  "bg-yellow-400", "bg-purple-400", "bg-blue-400",
  "bg-green-400",  "bg-pink-400",   "bg-orange-400",
];
function Confetti() {
  const dots = Array.from({ length: 18 }, (_, i) => ({
    colour: CONFETTI_COLOURS[i % CONFETTI_COLOURS.length],
    left:   `${5 + (i * 5.5) % 90}%`,
    delay:  `${(i * 0.07).toFixed(2)}s`,
    size:   i % 3 === 0 ? "w-2.5 h-2.5" : "w-1.5 h-1.5",
  }));

  return (
    <div className="absolute inset-x-0 top-0 h-20 overflow-hidden pointer-events-none"
         aria-hidden="true">
      {dots.map((d, i) => (
        <div
          key={i}
          className={[
            "absolute rounded-full opacity-0",
            d.colour, d.size,
            "animate-[confettiFall_1s_ease-out_forwards]",
          ].join(" ")}
          style={{ left: d.left, top: "-8px", animationDelay: d.delay }}
        />
      ))}
    </div>
  );
}

/* ── Stat cell ───────────────────────────────────────────────────────────── */
function StatBox({ label, value, sub, highlight }) {
  return (
    <div className={[
      "flex flex-col items-center justify-center rounded-xl px-3 py-3",
      "border text-center",
      highlight
        ? "bg-purple-900/30 border-purple-700"
        : "bg-gray-800/60 border-gray-700",
    ].join(" ")}>
      <p className={`text-2xl font-bold ${highlight ? "text-purple-300" : "text-white"}`}>
        {value}
      </p>
      <p className="text-xs text-gray-400 mt-0.5">{label}</p>
      {sub && <p className="text-[10px] text-gray-600 mt-0.5">{sub}</p>}
    </div>
  );
}

/* ── Component ───────────────────────────────────────────────────────────── */
export default function SolvedModal({
  isOpen,
  puzzle,
  elapsed,
  attempts,
  hintsUsed,
  solution,
  onClose,
  onRetry,
  onNext,
}) {
  const closeRef = useRef(null);

  /* Focus close button when opened */
  useEffect(() => {
    if (isOpen) setTimeout(() => closeRef.current?.focus(), 100);
  }, [isOpen]);

  /* Close on Escape */
  useEffect(() => {
    if (!isOpen) return;
    const fn = (e) => { if (e.key === "Escape") onClose(); };
    window.addEventListener("keydown", fn);
    return () => window.removeEventListener("keydown", fn);
  }, [isOpen, onClose]);

  if (!isOpen || !puzzle) return null;

  const stars     = starRating(attempts);
  const diffStyle = DIFF_STYLE[puzzle.difficulty] ?? DIFF_STYLE.Custom;
  const isCustom  = puzzle.id === -1;

  function handleShare() {
    const stars3 = "★".repeat(stars) + "☆".repeat(3 - stars);
    const text =
      `♟ Daily Chess Puzzle — "${puzzle.title}"\n` +
      `${stars3}  ${fmtTime(elapsed)}  ·  ${attempts} blunder${attempts !== 1 ? "s" : ""}  ·  ` +
      (puzzle.rating ? `${puzzle.rating} Elo` : "Custom position");
    navigator.clipboard?.writeText(text).then(() =>
      alert("Result copied to clipboard!")
    );
  }

  function handleBackdrop(e) {
    if (e.target === e.currentTarget) onClose();
  }

  /* ── Render ────────────────────────────────────────────────────────── */
  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center
                 bg-black/75 backdrop-blur-sm animate-fade-in px-4 py-6"
      onClick={handleBackdrop}
      role="dialog"
      aria-modal="true"
      aria-label="Puzzle solved"
    >
      {/* Add confetti keyframe via a style tag */}
      <style>{`
        @keyframes confettiFall {
          0%   { opacity: 1; transform: translateY(0) rotate(0deg); }
          100% { opacity: 0; transform: translateY(80px) rotate(360deg); }
        }
      `}</style>

      <div
        className="relative w-full max-w-sm bg-gray-900 border border-purple-800/60
                   rounded-2xl shadow-2xl overflow-hidden animate-slide-up"
        onClick={(e) => e.stopPropagation()}
      >
        <Confetti />

        {/* Close */}
        <button
          ref={closeRef}
          onClick={onClose}
          className="absolute top-4 right-4 z-10 text-gray-500 hover:text-gray-300
                     transition-colors focus:outline-none"
          aria-label="Close"
        >
          <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2}
                  d="M6 18L18 6M6 6l12 12"/>
          </svg>
        </button>

        {/* ── Top hero area ─────────────────────────────────────────── */}
        <div className="bg-gradient-to-b from-purple-950/80 to-gray-900 pt-8 pb-5 px-6
                        text-center space-y-2">
          {/* Trophy */}
          <div className="text-5xl leading-none" aria-hidden="true">
            {attempts === 0 ? "🏆" : stars === 2 ? "🥈" : "🥉"}
          </div>

          {/* Star rating */}
          <div className="flex justify-center gap-1 text-xl" aria-label={`${stars} out of 3 stars`}>
            {[1, 2, 3].map((s) => (
              <span key={s} className={s <= stars ? "text-yellow-400" : "text-gray-700"}>
                ★
              </span>
            ))}
          </div>

          <h2 className="text-xl font-bold text-white">Puzzle Solved!</h2>
          <p className="text-sm text-purple-300 font-medium">{puzzle.title}</p>

          {/* Difficulty + Elo row */}
          <div className="flex items-center justify-center gap-2 flex-wrap pt-1">
            <span className={[
              "text-xs font-semibold px-2.5 py-1 rounded-full border",
              diffStyle.bg, diffStyle.border, diffStyle.text,
            ].join(" ")}>
              {puzzle.difficulty}
            </span>

            {puzzle.rating && (
              <span className="text-xs font-mono px-2.5 py-1 rounded-full
                               bg-gray-800 border border-gray-700 text-gray-300">
                {puzzle.rating} Elo
              </span>
            )}

            {isCustom && (
              <span className="text-xs px-2.5 py-1 rounded-full
                               bg-emerald-900/50 border border-emerald-700 text-emerald-400">
                Custom Position
              </span>
            )}
          </div>
        </div>

        {/* ── Stats grid ────────────────────────────────────────────── */}
        <div className="px-5 py-4 grid grid-cols-3 gap-2">
          <StatBox label="Time"        value={fmtTime(elapsed)} highlight />
          <StatBox label="Blunders"    value={attempts} />
          <StatBox label="Hints used"  value={hintsUsed} />
        </div>

        {/* ── Solution line ─────────────────────────────────────────── */}
        {solution?.length > 0 && (
          <div className="px-5 pb-3">
            <p className="text-xs text-gray-500 uppercase tracking-wide mb-1.5">
              Solution
            </p>
            <p className="font-mono text-sm text-gray-200 bg-gray-800 rounded-lg
                          px-3 py-2.5 leading-relaxed break-words">
              {solution.join("  ")}
            </p>
          </div>
        )}

        {/* ── Buttons ───────────────────────────────────────────────── */}
        <div className="px-5 pb-5 space-y-2 pt-1">
          {/* Share */}
          <button
            onClick={handleShare}
            className="w-full flex items-center justify-center gap-2
                       py-2.5 rounded-xl bg-purple-700 hover:bg-purple-600
                       text-white font-semibold text-sm transition-colors
                       focus:outline-none focus:ring-2 focus:ring-purple-400"
          >
            <span aria-hidden="true">↗</span> Share result
          </button>

          <div className="grid grid-cols-2 gap-2">
            {/* Retry */}
            <button
              onClick={() => { onClose(); onRetry(); }}
              className="py-2.5 rounded-xl bg-gray-800 hover:bg-gray-700
                         border border-gray-700 text-gray-300 font-medium
                         text-sm transition-colors
                         focus:outline-none focus:ring-2 focus:ring-gray-500"
            >
              ↺ Retry
            </button>

            {/* Next puzzle — only for dataset puzzles */}
            {!isCustom && (
              <button
                onClick={() => { onClose(); onNext(); }}
                className="py-2.5 rounded-xl bg-blue-700 hover:bg-blue-600
                           text-white font-semibold text-sm transition-colors
                           focus:outline-none focus:ring-2 focus:ring-blue-400"
              >
                Next →
              </button>
            )}
            {isCustom && (
              <button
                onClick={onClose}
                className="py-2.5 rounded-xl bg-blue-700 hover:bg-blue-600
                           text-white font-semibold text-sm transition-colors
                           focus:outline-none focus:ring-2 focus:ring-blue-400"
              >
                Done ✓
              </button>
            )}
          </div>
        </div>

      </div>
    </div>
  );
}
