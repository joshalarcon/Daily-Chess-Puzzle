/**
 * App.jsx
 *
 * Root layout and orchestration layer.
 *
 * Layout (desktop ≥ lg):
 *   ┌──────────────────────────────────────────────────────────┐
 *   │  Header: logo · date · engine pill · ProfileButton · ☰  │
 *   ├─────────────────────────┬────────────────────────────────┤
 *   │  ChessBoard             │  Sidebar                       │
 *   │                         │  ├─ Puzzle title               │
 *   │                         │  ├─ Timer row                  │
 *   │                         │  ├─ StatusBanner               │
 *   │                         │  ├─ Action buttons             │
 *   │                         │  ├─ Solved summary             │
 *   │                         │  └─ EngineHint (on blunder)    │
 *   └─────────────────────────┴────────────────────────────────┘
 *
 * Overlays (rendered at root level, above everything):
 *   SlideMenu      — right-to-left partial drawer
 *   AuthModal      — centred modal for login / sign-up
 *   AnalysisPanel  — full-screen slide-over for game analysis
 *
 * Hook wiring:
 *   useChessPuzzle  → game state + move handler
 *   useStockfish    → shared engine (puzzle blunders + analysis panel)
 */

import { useCallback, useEffect, useState } from "react";

import { AuthProvider }             from "./context/AuthContext.jsx";
import { useChessPuzzle, STATUSES } from "./hooks/useChessPuzzle.js";
import { useStockfish }             from "./hooks/useStockfish.js";
import { formatPuzzleDate }         from "./utils/dateSeeder.js";
import { uciSequenceToSan }         from "./utils/uciUtils.js";

import ChessBoard       from "./components/ChessBoard.jsx";
import StatusBanner    from "./components/StatusBanner.jsx";
import PuzzleTimer     from "./components/PuzzleTimer.jsx";
import EngineHint      from "./components/EngineHint.jsx";
import SlideMenu       from "./components/SlideMenu.jsx";
import AuthModal       from "./components/AuthModal.jsx";
import ProfileButton   from "./components/ProfileButton.jsx";
import AnalysisPanel   from "./components/AnalysisPanel.jsx";
import CustomFenModal  from "./components/CustomFenModal.jsx";
import SolvedModal     from "./components/SolvedModal.jsx";

/* ─────────────────────────────────────────────────────────────────────────
   Inner shell — needs AuthProvider already in tree so hooks can fire
   ───────────────────────────────────────────────────────────────────────── */
function AppShell() {

  /* ── UI overlay state ─────────────────────────────────────────────────── */
  const [menuOpen,      setMenuOpen]      = useState(false);
  const [authOpen,      setAuthOpen]      = useState(false);
  const [analysisOpen,  setAnalysisOpen]  = useState(false);
  const [customFenOpen, setCustomFenOpen] = useState(false);
  const [solvedOpen,    setSolvedOpen]    = useState(false);

  /* Track elapsed seconds for the solved modal */
  const [elapsed,     setElapsed]     = useState(0);
  const [solvedOnce,  setSolvedOnce]  = useState(false); // prevent re-trigger

  /* ── Stockfish engine (shared between puzzle blunders + analysis panel) ── */
  const {
    engineReady,
    isAnalysing,
    lines,
    bestMove,
    analyse,
    stop: stopEngine,
  } = useStockfish();

  /* ── Trigger Stockfish when user blunders in the puzzle ───────────────── */
  const handleWrongMove = useCallback(
    (fen) => analyse(fen, { depth: 18, multiPV: 3 }),
    [analyse]
  );

  /* ── Puzzle game-state hook ───────────────────────────────────────────── */
  const {
    puzzle,
    fen,
    status,
    lastMove,
    attempts,
    hintsUsed,
    expectedMove,
    progress,
    onUserMove,
    resetPuzzle,
    loadPuzzle,
    loadCustomFen,
    markHintUsed,
  } = useChessPuzzle({ onWrongMove: handleWrongMove });

  /* ── Stop engine when puzzle state resets or resolves ────────────────── */
  useEffect(() => {
    if (status === STATUSES.SOLVED || status === STATUSES.YOUR_TURN) {
      stopEngine();
    }
  }, [status, stopEngine]);

  /* ── Track elapsed time (seconds) for the solved modal ───────────────── */
  useEffect(() => {
    if (status === STATUSES.IDLE || status === STATUSES.SOLVED) return;
    // reset when puzzle loads fresh
    if (status === STATUSES.YOUR_TURN && solvedOnce === false) {
      setElapsed(0);
    }
    const id = setInterval(() => setElapsed((s) => s + 1), 1000);
    return () => clearInterval(id);
  }, [status, solvedOnce]);

  /* ── Open solved modal once when puzzle is solved ─────────────────────── */
  useEffect(() => {
    if (status === STATUSES.SOLVED && !solvedOnce) {
      setSolvedOnce(true);
      // small delay so the board move animation finishes first
      setTimeout(() => setSolvedOpen(true), 600);
    }
    // Reset flag when puzzle resets (status goes back to YOUR_TURN)
    if (status === STATUSES.YOUR_TURN) {
      setSolvedOnce(false);
      setSolvedOpen(false);
    }
  }, [status, solvedOnce]);

  /* ── Hint state — 0=off, 1=piece highlighted, 2=arrow shown ─────────── */
  const [hintStage, setHintStage] = useState(0);

  /* Clear hint whenever the puzzle resets or the user makes a move */
  useEffect(() => {
    setHintStage(0);
  }, [status, puzzle]);

  /* ── Hint handler — two-click progressive reveal ─────────────────────── */
  function handleShowHint() {
    markHintUsed();
    if (!expectedMove || !fen) return;

    if (hintStage === 0) {
      // First click — just highlight the source piece
      setHintStage(1);
    } else if (hintStage === 1) {
      // Second click — show the arrow
      setHintStage(2);
    } else {
      // Third click — clear
      setHintStage(0);
    }
  }

  /* ── Derived ──────────────────────────────────────────────────────────── */
  const todayLabel      = formatPuzzleDate();
  const showEnginePanel = status === STATUSES.BLUNDER;

  // Parse hint from expectedMove UCI string (e.g. "e2e4" → from="e2", to="e4")
  const hintFrom   = expectedMove ? expectedMove.slice(0, 2) : null;
  const hintTo     = expectedMove ? expectedMove.slice(2, 4) : null;
  // Square to highlight on stage 1
  const hintSquare = hintStage >= 1 ? hintFrom : null;
  // Arrow to draw on stage 2: [from, to, color]
  const hintArrow  = hintStage >= 2 && hintFrom && hintTo
    ? [[hintFrom, hintTo, "#f59e0b"]]   // amber arrow
    : [];

  /* ── Render ───────────────────────────────────────────────────────────── */
  return (
    /* Wrapper — overflow-x hidden prevents drawer from widening the page */
    <div className="min-h-screen bg-gray-950 flex flex-col overflow-x-hidden">

      {/* ══ HEADER ═══════════════════════════════════════════════════════ */}
      <header className="border-b border-gray-800 bg-gray-900/80 backdrop-blur-sm
                         sticky top-0 z-20">
        <div className="max-w-6xl mx-auto px-4 py-3
                        flex items-center justify-between gap-3">

          {/* Left: logo + title */}
          <div className="flex items-center gap-3 min-w-0">
            <span className="text-2xl leading-none shrink-0" aria-hidden="true">♟</span>
            <div className="min-w-0">
              <h1 className="text-base font-bold text-white leading-tight tracking-tight truncate">
                Daily Chess Puzzle
              </h1>
              <p className="text-xs text-gray-500 leading-tight truncate">{todayLabel}</p>
            </div>
          </div>

          {/* Right: engine pill · puzzle counter · profile · hamburger */}
          <div className="flex items-center gap-2 shrink-0">

            {/* Engine status pill — hidden on very small screens */}
            <div
              className="hidden sm:flex items-center gap-1.5 text-xs px-3 py-1.5
                         rounded-full border border-gray-700 bg-gray-800 select-none"
              title={engineReady ? "Stockfish 17 ready" : "Engine loading…"}
            >
              <span
                className={[
                  "w-2 h-2 rounded-full shrink-0",
                  isAnalysing
                    ? "bg-blue-400 animate-pulse"
                    : engineReady ? "bg-green-400 animate-pulse-slow" : "bg-gray-600",
                ].join(" ")}
                aria-hidden="true"
              />
              <span className={engineReady ? "text-green-300" : "text-gray-500"}>
                {isAnalysing
                  ? "Analysing…"
                  : engineReady ? "Engine ready" : "Loading…"}
              </span>
            </div>

            {/* Puzzle number */}
            {puzzle && (
              <span className="text-xs font-mono text-gray-600 hidden md:block select-none">
                #{puzzle.id + 1}/100
              </span>
            )}

            {/* Profile avatar button */}
            <ProfileButton onOpenAuth={() => setAuthOpen(true)} />

            {/* Hamburger — opens the slide menu */}
            <button
              onClick={() => setMenuOpen(true)}
              aria-label="Open menu"
              className="flex flex-col justify-center items-center gap-[5px]
                         w-9 h-9 rounded-lg hover:bg-gray-800 border border-transparent
                         hover:border-gray-700 transition-colors
                         focus:outline-none focus:ring-2 focus:ring-gray-500"
            >
              <span className="w-5 h-0.5 bg-gray-300 rounded-full" />
              <span className="w-5 h-0.5 bg-gray-300 rounded-full" />
              <span className="w-4 h-0.5 bg-gray-300 rounded-full self-start ml-[2px]" />
            </button>

          </div>
        </div>
      </header>

      {/* ══ MAIN CONTENT ══════════════════════════════════════════════════ */}
      <main className="flex-1 max-w-6xl mx-auto w-full px-4 py-6 lg:py-10">
        <div className="flex flex-col lg:flex-row gap-6 lg:gap-8 items-start">

          {/* ── Chessboard ─────────────────────────────────────────────── */}
          <div className="w-full lg:w-auto lg:shrink-0">
            <div className="w-full max-w-[560px] mx-auto lg:mx-0">
              <ChessBoard
                fen={fen}
                status={status}
                lastMove={lastMove}
                onUserMove={(from, to, promo) => {
                  setHintStage(0); // clear hint on any move attempt
                  return onUserMove(from, to, promo);
                }}
                puzzle={puzzle}
                hintSquare={hintSquare}
                hintArrow={hintArrow}
              />
            </div>
          </div>

          {/* ── Right sidebar ──────────────────────────────────────────── */}
          <div className="w-full lg:flex-1 space-y-4 min-w-0">

            {/* Puzzle title + difficulty + elo */}
            {puzzle && (
              <div className="animate-fade-in space-y-2">
                <div className="flex items-center gap-2 flex-wrap">
                  <h2 className="text-xl font-bold text-white leading-tight">
                    {puzzle.title}
                  </h2>
                  {puzzle.id === -1 && (
                    <span className="text-xs font-semibold px-2 py-0.5 rounded-full
                                     bg-emerald-900/50 border border-emerald-700
                                     text-emerald-400">
                      Custom
                    </span>
                  )}
                </div>

                {/* Difficulty + Elo badges */}
                <div className="flex items-center gap-2 flex-wrap">
                  {/* Difficulty */}
                  {{
                    Beginner:     "bg-green-900/40 border-green-700 text-green-400",
                    Intermediate: "bg-yellow-900/40 border-yellow-700 text-yellow-400",
                    Advanced:     "bg-orange-900/40 border-orange-700 text-orange-400",
                    Expert:       "bg-red-900/40 border-red-700 text-red-400",
                    Custom:       "bg-emerald-900/40 border-emerald-700 text-emerald-400",
                  }[puzzle.difficulty] && (
                    <span className={`text-xs font-semibold px-2.5 py-1 rounded-full border
                      ${{
                        Beginner:     "bg-green-900/40 border-green-700 text-green-400",
                        Intermediate: "bg-yellow-900/40 border-yellow-700 text-yellow-400",
                        Advanced:     "bg-orange-900/40 border-orange-700 text-orange-400",
                        Expert:       "bg-red-900/40 border-red-700 text-red-400",
                        Custom:       "bg-emerald-900/40 border-emerald-700 text-emerald-400",
                      }[puzzle.difficulty]}`}>
                      {puzzle.difficulty}
                    </span>
                  )}

                  {/* Elo rating */}
                  {puzzle.rating && (
                    <span className="text-xs font-mono px-2.5 py-1 rounded-full
                                     bg-gray-800 border border-gray-700 text-gray-300">
                      {puzzle.rating} Elo
                    </span>
                  )}
                </div>

                <p className="text-sm text-gray-400">
                  {puzzle.id === -1
                    ? "Free exploration — make any move"
                    : <>Find the best move for{" "}
                        <span className="text-white font-medium">
                          {puzzle.fen.split(" ")[1] === "w" ? "White" : "Black"}
                        </span>
                      </>
                  }
                </p>
              </div>
            )}

            {/* Timer row */}
            <div className="flex items-center justify-between glass rounded-xl px-4 py-3">
              <div className="flex items-center gap-2 text-gray-400 text-sm">
                <span aria-hidden="true">⏱</span>
                <span>Time</span>
              </div>
              <PuzzleTimer status={status} puzzleId={puzzle?.id} />
            </div>

            {/* Status banner */}
            <StatusBanner
              status={status}
              puzzle={puzzle}
              progress={progress}
              attempts={attempts}
            />

            {/* Action buttons */}
            <div className="flex flex-wrap gap-2">

              {/* Retry */}
              <button
                onClick={resetPuzzle}
                disabled={status === STATUSES.IDLE}
                className="flex items-center gap-1.5 px-4 py-2 rounded-lg
                           bg-gray-800 hover:bg-gray-700 border border-gray-700
                           text-sm text-gray-300 font-medium
                           disabled:opacity-40 disabled:cursor-not-allowed
                           transition-colors focus:outline-none focus:ring-2
                           focus:ring-gray-500"
              >
                <span aria-hidden="true">↺</span> Retry
              </button>

              {/* Hint */}
              {(status === STATUSES.YOUR_TURN || status === STATUSES.BLUNDER) && (
                <button
                  onClick={handleShowHint}
                  className={[
                    "flex items-center gap-1.5 px-4 py-2 rounded-lg",
                    "border text-sm font-medium transition-colors",
                    "focus:outline-none focus:ring-2 focus:ring-yellow-500",
                    hintStage === 0
                      ? "bg-yellow-900/40 hover:bg-yellow-900/60 border-yellow-700 text-yellow-400"
                      : hintStage === 1
                      ? "bg-yellow-700/50 hover:bg-yellow-700/70 border-yellow-500 text-yellow-200"
                      : "bg-amber-700/50 hover:bg-amber-700/70 border-amber-500 text-amber-200",
                  ].join(" ")}
                >
                  <span aria-hidden="true">💡</span>
                  {hintStage === 0 && "Hint"}
                  {hintStage === 1 && "Show arrow"}
                  {hintStage === 2 && "Hide hint"}
                  {hintsUsed > 0 && (
                    <span className="ml-1 text-xs opacity-60">({hintsUsed})</span>
                  )}
                </button>
              )}

              {/* Analyse — shortcut into analysis panel */}
              <button
                onClick={() => setAnalysisOpen(true)}
                className="flex items-center gap-1.5 px-4 py-2 rounded-lg
                           bg-gray-800 hover:bg-gray-700 border border-gray-700
                           text-sm text-gray-300 font-medium
                           transition-colors focus:outline-none focus:ring-2
                           focus:ring-gray-500"
              >
                <span aria-hidden="true">⚙</span> Analyse
              </button>

              {/* Share — only after solve */}
              {status === STATUSES.SOLVED && (
                <button
                  onClick={() => {
                    const text =
                      `I solved today's Daily Chess Puzzle "${puzzle?.title}" ` +
                      `in ${attempts === 0 ? "no" : attempts} wrong move` +
                      `${attempts !== 1 ? "s" : ""}! ♟`;
                    navigator.clipboard
                      ?.writeText(text)
                      .then(() => alert("Result copied to clipboard!"));
                  }}
                  className="flex items-center gap-1.5 px-4 py-2 rounded-lg
                             bg-purple-900/40 hover:bg-purple-900/60
                             border border-purple-600 text-sm text-purple-300
                             font-medium transition-colors
                             focus:outline-none focus:ring-2 focus:ring-purple-500"
                >
                  <span aria-hidden="true">↗</span> Share result
                </button>
              )}
            </div>

            {/* Solved summary card */}
            {status === STATUSES.SOLVED && (
              <div className="glass rounded-xl px-4 py-4 space-y-2 animate-slide-up
                              border border-purple-900">
                <h3 className="text-sm font-semibold text-purple-300">
                  ✦ Puzzle complete
                </h3>
                <div className="grid grid-cols-3 gap-2 text-center">
                  <StatCell label="Wrong moves" value={attempts} />
                  <StatCell label="Hints used"  value={hintsUsed} />
                  <StatCell
                    label="Solution"
                    value={
                      puzzle
                        ? uciSequenceToSan(puzzle.fen, puzzle.solution).join(", ") || "—"
                        : "—"
                    }
                    small
                  />
                </div>
              </div>
            )}

            {/* Engine hint panel — blunder only */}
            <EngineHint
              visible={showEnginePanel}
              isAnalysing={isAnalysing}
              engineReady={engineReady}
              lines={lines}
              bestMove={bestMove}
              fen={fen}
              expectedMove={expectedMove}
              onShowHint={handleShowHint}
            />

          </div>{/* end sidebar */}
        </div>
      </main>

      {/* ══ FOOTER ════════════════════════════════════════════════════════ */}
      <footer className="border-t border-gray-800 py-4 px-4 text-center">
        <p className="text-xs text-gray-700">
          Powered by{" "}
          <span className="text-gray-500 font-medium">Chess.js</span>
          {" · "}
          <span className="text-gray-500 font-medium">react-chessboard</span>
          {" · "}
          <span className="text-gray-500 font-medium">Stockfish 17</span>
        </p>
      </footer>

      {/* ══ OVERLAYS ══════════════════════════════════════════════════════ */}

      {/* Slide menu — right-to-left partial drawer */}
      <SlideMenu
        isOpen={menuOpen}
        onClose={() => setMenuOpen(false)}
        onOpenAnalysis={() => setAnalysisOpen(true)}
        onOpenAuth={() => setAuthOpen(true)}
        onOpenCustomFen={() => setCustomFenOpen(true)}
        engineReady={engineReady}
        isAnalysing={isAnalysing}
        puzzleStatus={status}
        engineLines={lines}
      />

      {/* Auth modal */}
      <AuthModal
        isOpen={authOpen}
        onClose={() => setAuthOpen(false)}
      />

      {/* Custom FEN modal */}
      <CustomFenModal
        isOpen={customFenOpen}
        onClose={() => setCustomFenOpen(false)}
        onLoad={(fen, name) => {
          loadCustomFen(fen, name);
          stopEngine();
        }}
      />

      {/* Solved pop-up */}
      <SolvedModal
        isOpen={solvedOpen}
        puzzle={puzzle}
        elapsed={elapsed}
        attempts={attempts}
        hintsUsed={hintsUsed}
        solution={puzzle ? uciSequenceToSan(puzzle.fen, puzzle.solution) : []}
        onClose={() => setSolvedOpen(false)}
        onRetry={() => { setSolvedOpen(false); resetPuzzle(); }}
        onNext={() => {
          setSolvedOpen(false);
          // Pick a random puzzle index different from the current one
          const currentId = puzzle?.id ?? -1;
          let nextIdx;
          do { nextIdx = Math.floor(Math.random() * 100); } while (nextIdx === currentId);
          loadPuzzle(nextIdx);
        }}
      />

      {/* Analysis panel — full-height right-side sheet */}
      <AnalysisSheet
        isOpen={analysisOpen}
        onClose={() => setAnalysisOpen(false)}
        engineReady={engineReady}
        isAnalysing={isAnalysing}
        lines={lines}
        bestMove={bestMove}
        onAnalyse={analyse}
        onStop={stopEngine}
      />

    </div>
  );
}

/* ─────────────────────────────────────────────────────────────────────────
   AnalysisSheet
   A full-height slide-over that wraps <AnalysisPanel> with its own
   backdrop + transition so it sits above the slide menu when both
   could theoretically be open at once.
   ───────────────────────────────────────────────────────────────────────── */
function AnalysisSheet({
  isOpen, onClose,
  engineReady, isAnalysing, lines, bestMove, onAnalyse, onStop,
}) {
  /* Close on Escape */
  useEffect(() => {
    if (!isOpen) return;
    const fn = (e) => { if (e.key === "Escape") onClose(); };
    window.addEventListener("keydown", fn);
    return () => window.removeEventListener("keydown", fn);
  }, [isOpen, onClose]);

  return (
    <>
      {/* Backdrop */}
      <div
        aria-hidden="true"
        onClick={onClose}
        className={[
          "fixed inset-0 z-40 bg-black/60 backdrop-blur-sm",
          "transition-opacity duration-300",
          isOpen ? "opacity-100 pointer-events-auto" : "opacity-0 pointer-events-none",
        ].join(" ")}
      />

      {/* Sheet */}
      <div
        role="dialog"
        aria-modal="true"
        aria-label="Game analysis"
        className={[
          "fixed top-0 right-0 bottom-0 z-50",
          "w-[92vw] max-w-[480px]",
          "bg-gray-950 border-l border-gray-800 shadow-2xl",
          "transition-transform duration-300 ease-in-out",
          isOpen ? "translate-x-0" : "translate-x-full",
        ].join(" ")}
      >
        <AnalysisPanel
          onClose={onClose}
          engineReady={engineReady}
          isAnalysing={isAnalysing}
          lines={lines}
          bestMove={bestMove}
          onAnalyse={onAnalyse}
          onStop={onStop}
        />
      </div>
    </>
  );
}

/* ─────────────────────────────────────────────────────────────────────────
   StatCell — small labelled metric in the solved summary card
   ───────────────────────────────────────────────────────────────────────── */
function StatCell({ label, value, small = false }) {
  return (
    <div className="bg-gray-800/60 rounded-lg px-2 py-2">
      <p className={`font-semibold text-white ${small ? "text-xs break-words" : "text-lg"}`}>
        {value}
      </p>
      <p className="text-xs text-gray-500 mt-0.5">{label}</p>
    </div>
  );
}

/* ─────────────────────────────────────────────────────────────────────────
   Root export — wraps everything in AuthProvider
   ───────────────────────────────────────────────────────────────────────── */
export default function App() {
  return (
    <AuthProvider>
      <AppShell />
    </AuthProvider>
  );
}
