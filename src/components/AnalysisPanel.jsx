/**
 * AnalysisPanel.jsx
 *
 * Full game analysis panel — paste a PGN or FEN, click Analyse,
 * and get a Stockfish evaluation bar + move-by-move score list.
 *
 * Props
 *   onClose        {Function}  — close the panel
 *   engineReady    {boolean}
 *   isAnalysing    {boolean}
 *   lines          {Array}     — PV lines from useStockfish
 *   bestMove       {string}
 *   onAnalyse      {Function(fen, opts)}  — fires the engine
 *   onStop         {Function}  — stop engine
 */

import { useState, useCallback, useMemo } from "react";
import { Chess } from "chess.js";
import { formatScore, scoreColourClass, uciSequenceToSan } from "../utils/uciUtils.js";

/* ── Helpers ─────────────────────────────────────────────────────────────── */

/** Try to load a FEN; return {game, error} */
function loadFen(fen) {
  try {
    const g = new Chess(fen.trim());
    return { game: g, error: null };
  } catch {
    return { game: null, error: "Invalid FEN — check the string and try again." };
  }
}

/** Try to load a PGN; return {game, moves[], error} */
function loadPgn(pgn) {
  try {
    const g = new Chess();
    g.loadPgn(pgn.trim());
    const history = g.history({ verbose: true });
    return { game: g, moves: history, error: null };
  } catch {
    return { game: null, moves: [], error: "Invalid PGN — check the text and try again." };
  }
}

/** Clamp + convert centipawns to a 0-100 bar percentage (50 = equal) */
function evalToBarPct(score, mate) {
  if (mate !== null && mate !== undefined) return mate > 0 ? 95 : 5;
  if (score === null || score === undefined) return 50;
  const clamped = Math.max(-1000, Math.min(1000, score));
  return 50 + (clamped / 1000) * 45; // maps ±1000cp → 5–95 %
}

/* ── Evaluation Bar ─────────────────────────────────────────────────────── */
function EvalBar({ score, mate, isAnalysing }) {
  const pct   = evalToBarPct(score, mate);
  const label = formatScore(score, mate);
  const white = pct;       // white portion (bottom of bar)
  const black = 100 - pct;

  return (
    <div className="flex items-center gap-3" aria-label={`Evaluation: ${label}`}>
      {/* Vertical bar */}
      <div className="relative w-6 h-36 rounded-full overflow-hidden border border-gray-700 bg-gray-800 shrink-0">
        {/* Black side (top) */}
        <div
          className="absolute top-0 left-0 right-0 bg-gray-900 transition-all duration-500"
          style={{ height: `${black}%` }}
        />
        {/* White side (bottom) */}
        <div
          className="absolute bottom-0 left-0 right-0 bg-white transition-all duration-500"
          style={{ height: `${white}%` }}
        />
        {/* Midline */}
        <div className="absolute top-1/2 left-0 right-0 h-px bg-gray-500 opacity-40" />
      </div>

      {/* Numeric label */}
      <div className="space-y-0.5">
        <p className={`font-mono text-xl font-bold ${scoreColourClass(score, mate)}`}>
          {isAnalysing ? (
            <span className="inline-block w-14 h-6 bg-gray-700 rounded animate-pulse" />
          ) : label}
        </p>
        <p className="text-xs text-gray-500">
          {score !== null && score !== undefined && mate === null
            ? score >= 0 ? "White is better" : "Black is better"
            : mate !== null && mate !== undefined
            ? mate > 0 ? `White mates in ${Math.abs(mate)}` : `Black mates in ${Math.abs(mate)}`
            : "Equal position"}
        </p>
      </div>
    </div>
  );
}

/* ── Move list row ──────────────────────────────────────────────────────── */
function MoveRow({ moveNumber, whiteSan, blackSan, whiteScore, blackScore, whiteMate, blackMate }) {
  return (
    <div className="grid grid-cols-[2rem_1fr_1fr] gap-1 items-center text-sm py-1
                    border-b border-gray-800/60 last:border-0">
      <span className="font-mono text-gray-600 text-xs text-right pr-1">
        {moveNumber}.
      </span>

      {/* White move */}
      <div className="flex items-center gap-1.5">
        <span className="font-mono text-gray-100">{whiteSan ?? "—"}</span>
        {whiteScore !== undefined && (
          <span className={`text-xs font-mono ${scoreColourClass(whiteScore, whiteMate)}`}>
            {formatScore(whiteScore, whiteMate)}
          </span>
        )}
      </div>

      {/* Black move */}
      <div className="flex items-center gap-1.5">
        <span className="font-mono text-gray-100">{blackSan ?? ""}</span>
        {blackScore !== undefined && blackSan && (
          <span className={`text-xs font-mono ${scoreColourClass(blackScore, blackMate)}`}>
            {formatScore(blackScore, blackMate)}
          </span>
        )}
      </div>
    </div>
  );
}

/* ── Main component ──────────────────────────────────────────────────────── */
export default function AnalysisPanel({
  onClose,
  engineReady,
  isAnalysing,
  lines,
  bestMove,
  onAnalyse,
  onStop,
}) {
  /* ── Tab: "fen" | "pgn" */
  const [tab, setTab]           = useState("fen");
  const [fenInput, setFenInput] = useState("");
  const [pgnInput, setPgnInput] = useState("");
  const [inputError, setInputError] = useState("");

  /* Active game state after successful load */
  const [activeFen,   setActiveFen]   = useState(null);
  const [pgnMoves,    setPgnMoves]    = useState([]);   // verbose move objects
  const [pgnFens,     setPgnFens]     = useState([]);   // FEN after each move
  const [selectedIdx, setSelectedIdx] = useState(null); // which move to analyse

  /* Per-move scores from engine (populated as user clicks moves) */
  const [moveScores, setMoveScores] = useState({});     // { idx: {score, mate} }

  /* Best line for the current position */
  const topLine = useMemo(() => (lines ?? []).filter(Boolean)[0] ?? null, [lines]);
  const topScore = topLine?.score ?? null;
  const topMate  = topLine?.mate  ?? null;
  const topPv    = topLine?.pv    ?? [];

  /* ── Load position ─────────────────────────────────────────────────── */
  const handleLoad = useCallback(() => {
    setInputError("");
    setMoveScores({});
    setSelectedIdx(null);

    if (tab === "fen") {
      const { game, error } = loadFen(fenInput);
      if (error) { setInputError(error); return; }
      setActiveFen(game.fen());
      setPgnMoves([]);
      setPgnFens([]);
      onAnalyse(game.fen(), { depth: 20, multiPV: 3 });
    } else {
      const { game, moves, error } = loadPgn(pgnInput);
      if (error) { setInputError(error); return; }

      // Build the FEN snapshot after every move
      const fens = [];
      const replay = new Chess();
      fens.push(replay.fen()); // starting FEN
      for (const mv of moves) {
        replay.move({ from: mv.from, to: mv.to, promotion: mv.promotion });
        fens.push(replay.fen());
      }

      setPgnMoves(moves);
      setPgnFens(fens);
      setActiveFen(game.fen()); // final position
      onAnalyse(game.fen(), { depth: 20, multiPV: 3 });
    }
  }, [tab, fenInput, pgnInput, onAnalyse]);

  /* ── Click a move to analyse that specific position ─────────────────── */
  function handleMoveClick(idx) {
    const fen = pgnFens[idx + 1]; // +1 because fens[0] is starting pos
    if (!fen) return;
    setSelectedIdx(idx);
    setActiveFen(fen);
    onAnalyse(fen, { depth: 20, multiPV: 1 });
  }

  /* ── Store engine score for the selected move ───────────────────────── */
  // When analysis finishes (isAnalysing flips false) and we have a selectedIdx,
  // store the score.
  const prevIsAnalysing = useMemo(() => isAnalysing, [isAnalysing]);

  /* Best PV as SAN */
  const bestLineSan = useMemo(() => {
    if (!activeFen || !topPv.length) return [];
    return uciSequenceToSan(activeFen, topPv);
  }, [activeFen, topPv]);

  /* Pair up moves for display */
  const movePairs = useMemo(() => {
    const pairs = [];
    for (let i = 0; i < pgnMoves.length; i += 2) {
      pairs.push({
        num:    Math.floor(i / 2) + 1,
        wIdx:   i,
        bIdx:   i + 1,
        wSan:   pgnMoves[i]?.san,
        bSan:   pgnMoves[i + 1]?.san,
      });
    }
    return pairs;
  }, [pgnMoves]);

  /* ── Render ──────────────────────────────────────────────────────────── */
  return (
    <div className="flex flex-col h-full bg-gray-950 text-gray-100">

      {/* ── Header ────────────────────────────────────────────────────── */}
      <div className="flex items-center justify-between px-5 py-4
                      border-b border-gray-800 shrink-0">
        <div className="flex items-center gap-2">
          <span className="text-lg" aria-hidden="true">⚙</span>
          <h2 className="text-base font-bold">Game Analysis</h2>
        </div>
        <button
          onClick={onClose}
          aria-label="Close analysis panel"
          className="text-gray-500 hover:text-gray-300 transition-colors
                     focus:outline-none focus:ring-2 focus:ring-gray-500 rounded"
        >
          <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2}
                  d="M6 18L18 6M6 6l12 12" />
          </svg>
        </button>
      </div>

      {/* ── Scrollable body ───────────────────────────────────────────── */}
      <div className="flex-1 overflow-y-auto px-5 py-4 space-y-5">

        {/* ── Tab bar ───────────────────────────────────────────────── */}
        <div className="flex rounded-lg overflow-hidden border border-gray-700 text-sm font-medium">
          {["fen", "pgn"].map((t) => (
            <button
              key={t}
              onClick={() => { setTab(t); setInputError(""); }}
              className={[
                "flex-1 py-2 transition-colors uppercase tracking-wide text-xs",
                tab === t
                  ? "bg-blue-700 text-white"
                  : "bg-gray-800 text-gray-400 hover:bg-gray-700",
              ].join(" ")}
            >
              {t === "fen" ? "FEN" : "PGN"}
            </button>
          ))}
        </div>

        {/* ── Input area ────────────────────────────────────────────── */}
        {tab === "fen" ? (
          <div className="space-y-2">
            <label className="text-xs text-gray-400 font-medium" htmlFor="fen-input">
              Paste a FEN string
            </label>
            <input
              id="fen-input"
              type="text"
              value={fenInput}
              onChange={(e) => { setFenInput(e.target.value); setInputError(""); }}
              placeholder="rnbqkbnr/pppppppp/8/8/8/8/PPPPPPPP/RNBQKBNR w KQkq - 0 1"
              className="w-full bg-gray-800 border border-gray-600 rounded-lg
                         px-3 py-2 text-xs font-mono text-gray-200
                         placeholder-gray-600 focus:outline-none focus:ring-2
                         focus:ring-blue-500 transition-colors"
            />
          </div>
        ) : (
          <div className="space-y-2">
            <label className="text-xs text-gray-400 font-medium" htmlFor="pgn-input">
              Paste PGN notation
            </label>
            <textarea
              id="pgn-input"
              value={pgnInput}
              onChange={(e) => { setPgnInput(e.target.value); setInputError(""); }}
              placeholder={"1. e4 e5 2. Nf3 Nc6 3. Bb5 …"}
              rows={5}
              className="w-full bg-gray-800 border border-gray-600 rounded-lg
                         px-3 py-2 text-xs font-mono text-gray-200
                         placeholder-gray-600 focus:outline-none focus:ring-2
                         focus:ring-blue-500 transition-colors resize-none"
            />
          </div>
        )}

        {/* Error */}
        {inputError && (
          <p className="text-xs text-red-400 bg-red-900/20 border border-red-800
                        rounded-lg px-3 py-2">
            {inputError}
          </p>
        )}

        {/* Analyse button */}
        <button
          onClick={isAnalysing ? onStop : handleLoad}
          disabled={!engineReady}
          className={[
            "w-full py-2.5 rounded-xl font-semibold text-sm transition-colors",
            "focus:outline-none focus:ring-2 focus:ring-blue-500",
            "disabled:opacity-40 disabled:cursor-not-allowed",
            isAnalysing
              ? "bg-red-700 hover:bg-red-600 text-white"
              : "bg-blue-700 hover:bg-blue-600 text-white",
          ].join(" ")}
        >
          {!engineReady
            ? "Engine loading…"
            : isAnalysing
            ? "⏹ Stop analysis"
            : "▶ Analyse position"}
        </button>

        {/* ── Evaluation bar + score ─────────────────────────────────── */}
        {activeFen && (
          <div className="bg-gray-900 rounded-xl border border-gray-800 p-4">
            <p className="text-xs text-gray-500 mb-3 uppercase tracking-wide font-medium">
              Evaluation
            </p>
            <EvalBar score={topScore} mate={topMate} isAnalysing={isAnalysing} />

            {/* Engine status line */}
            <div className="mt-3 flex items-center gap-2">
              <span
                className={[
                  "w-2 h-2 rounded-full shrink-0",
                  isAnalysing ? "bg-blue-400 animate-pulse" : engineReady ? "bg-green-400" : "bg-gray-600",
                ].join(" ")}
                aria-hidden="true"
              />
              <span className="text-xs text-gray-500 font-mono">
                {isAnalysing
                  ? `Searching… depth ${topLine?.depth ?? "—"}`
                  : topLine
                  ? `Depth ${topLine.depth} · ${topLine.pv?.length ?? 0} moves ahead`
                  : "Ready"}
              </span>
            </div>
          </div>
        )}

        {/* ── Best line ─────────────────────────────────────────────── */}
        {bestLineSan.length > 0 && (
          <div className="bg-gray-900 rounded-xl border border-gray-800 p-4 space-y-1">
            <p className="text-xs text-gray-500 uppercase tracking-wide font-medium mb-2">
              Best continuation
            </p>
            <div className="flex items-center gap-1.5">
              {bestMove && (
                <span className="bg-blue-700 text-white text-xs font-mono
                                 px-2 py-0.5 rounded-md font-bold shrink-0">
                  {bestLineSan[0]}
                </span>
              )}
              <p className="font-mono text-sm text-gray-300 leading-relaxed break-words">
                {bestLineSan.slice(1, 8).join("  ")}
                {bestLineSan.length > 8 && <span className="text-gray-600"> …</span>}
              </p>
            </div>
          </div>
        )}

        {/* ── PGN move list ──────────────────────────────────────────── */}
        {movePairs.length > 0 && (
          <div className="bg-gray-900 rounded-xl border border-gray-800 p-4">
            <p className="text-xs text-gray-500 uppercase tracking-wide font-medium mb-3">
              Move list  <span className="text-gray-600 normal-case">(click to analyse)</span>
            </p>

            <div className="space-y-0">
              {movePairs.map(({ num, wIdx, bIdx, wSan, bSan }) => (
                <div
                  key={num}
                  className="grid grid-cols-[2rem_1fr_1fr] gap-1 items-center
                             text-sm py-1.5 border-b border-gray-800/50 last:border-0"
                >
                  {/* Move number */}
                  <span className="font-mono text-gray-600 text-xs text-right pr-2">
                    {num}.
                  </span>

                  {/* White move */}
                  <button
                    onClick={() => handleMoveClick(wIdx)}
                    className={[
                      "text-left font-mono px-1.5 py-0.5 rounded transition-colors",
                      selectedIdx === wIdx
                        ? "bg-blue-700 text-white"
                        : "text-gray-200 hover:bg-gray-800",
                    ].join(" ")}
                  >
                    {wSan}
                  </button>

                  {/* Black move */}
                  {bSan ? (
                    <button
                      onClick={() => handleMoveClick(bIdx)}
                      className={[
                        "text-left font-mono px-1.5 py-0.5 rounded transition-colors",
                        selectedIdx === bIdx
                          ? "bg-blue-700 text-white"
                          : "text-gray-200 hover:bg-gray-800",
                      ].join(" ")}
                    >
                      {bSan}
                    </button>
                  ) : (
                    <span />
                  )}
                </div>
              ))}
            </div>
          </div>
        )}

        {/* ── Empty state ────────────────────────────────────────────── */}
        {!activeFen && (
          <div className="text-center py-8 space-y-2">
            <p className="text-3xl" aria-hidden="true">♜</p>
            <p className="text-gray-500 text-sm">
              Paste a FEN or PGN above and click Analyse.
            </p>
          </div>
        )}

      </div>{/* end scroll body */}
    </div>
  );
}
