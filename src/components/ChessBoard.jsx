/**
 * ChessBoard.jsx
 *
 * Renders the interactive chessboard using react-chessboard.
 * Handles:
 *   — Piece drag-and-drop + click-to-move
 *   — Visual highlight of the last move (from/to squares)
 *   — Green highlight on correct move, red flash on blunder
 *   — Board orientation (always shows puzzle side at bottom)
 *   — Locked board during opponent reply and after solve
 *   — Promotion dialog via react-chessboard built-in
 *
 * NOTE: react-chessboard v4+ requires an explicit `boardWidth` number prop.
 * We use a ResizeObserver on the wrapper div so the board always fills its
 * container and is fully responsive.
 */

import { useState, useMemo, useEffect, useRef } from "react";
import { Chessboard } from "react-chessboard";
import { Chess } from "chess.js";
import { STATUSES } from "../hooks/useChessPuzzle.js";

/* ── Square highlight colours ───────────────────────────────────────────── */
const COLOURS = {
  lastMoveFrom: "rgba(246, 246, 105, 0.5)",  // subtle yellow
  lastMoveTo:   "rgba(246, 246, 105, 0.7)",
  correctFrom:  "rgba(34, 197, 94, 0.45)",    // green-500
  correctTo:    "rgba(34, 197, 94, 0.65)",
  blunderFrom:  "rgba(239, 68, 68, 0.45)",    // red-500
  blunderTo:    "rgba(239, 68, 68, 0.65)",
  selected:     "rgba(100, 149, 237, 0.5)",   // cornflower blue
  legalMove:    "rgba(100, 149, 237, 0.25)",
};

/**
 * Derives board orientation from the FEN active colour.
 * Puzzle side always sits at the bottom.
 *
 * @param {string} fen
 * @returns {"white" | "black"}
 */
function orientationFromFen(fen) {
  if (!fen) return "white";
  const parts = fen.split(" ");
  // parts[1] is "w" or "b" — that side is to move, so faces the user
  return parts[1] === "b" ? "black" : "white";
}

/* ── Component ───────────────────────────────────────────────────────────── */
export default function ChessBoard({
  fen,
  status,
  lastMove,
  onUserMove,
  puzzle,
  hintSquare,   // square string e.g. "e2" — piece to highlight on hint stage 1
  hintArrow,    // array of [from, to, color] for react-chessboard customArrows
}) {
  const [selectedSquare, setSelectedSquare] = useState(null);
  const [legalTargets, setLegalTargets]     = useState([]);

  /* ── Measure container width so boardWidth is always an explicit number ── */
  const wrapperRef  = useRef(null);
  const [boardWidth, setBoardWidth] = useState(480); // safe fallback

  useEffect(() => {
    const el = wrapperRef.current;
    if (!el) return;

    // Set initial size immediately
    setBoardWidth(el.clientWidth || 480);

    const ro = new ResizeObserver((entries) => {
      for (const entry of entries) {
        const w = Math.floor(entry.contentRect.width);
        if (w > 0) setBoardWidth(w);
      }
    });
    ro.observe(el);
    return () => ro.disconnect();
  }, []);

  /* Board orientation: puzzle side at bottom */
  const orientation = useMemo(
    () => (puzzle ? orientationFromFen(puzzle.fen) : "white"),
    [puzzle]
  );

  /* Board is interactive only when it is the user's turn or after a blunder */
  const isDraggable =
    status === STATUSES.YOUR_TURN || status === STATUSES.BLUNDER;

  /* ── Square highlight map ─────────────────────────────────────────────── */
  const customSquareStyles = useMemo(() => {
    const styles = {};

    // Last move highlight
    if (lastMove) {
      styles[lastMove.from] = { backgroundColor: COLOURS.lastMoveFrom };
      styles[lastMove.to]   = { backgroundColor: COLOURS.lastMoveTo };
    }

    // Overlay for correct/blunder on top of last-move highlight
    if (status === STATUSES.CORRECT || status === STATUSES.SOLVED) {
      if (lastMove) {
        styles[lastMove.from] = { backgroundColor: COLOURS.correctFrom };
        styles[lastMove.to]   = { backgroundColor: COLOURS.correctTo };
      }
    }

    if (status === STATUSES.BLUNDER && lastMove) {
      styles[lastMove.from] = { backgroundColor: COLOURS.blunderFrom };
      styles[lastMove.to]   = { backgroundColor: COLOURS.blunderTo };
    }

    // ── Hint: pulse-glow on the source piece square ──────────────────────
    if (hintSquare) {
      styles[hintSquare] = {
        backgroundColor: "rgba(251, 191, 36, 0.55)",   // amber-400 at 55%
        boxShadow: "inset 0 0 0 3px rgba(251, 191, 36, 0.9)",
        borderRadius: "4px",
        animation: "hintPulse 1s ease-in-out infinite",
      };
    }

    // Selected piece
    if (selectedSquare) {
      styles[selectedSquare] = { backgroundColor: COLOURS.selected };
    }

    // Legal move dots
    legalTargets.forEach((sq) => {
      styles[sq] = {
        ...(styles[sq] ?? {}),
        background: `radial-gradient(circle, ${COLOURS.legalMove} 30%, transparent 31%)`,
      };
    });

    return styles;
  }, [lastMove, status, selectedSquare, legalTargets, hintSquare]);

  /* ── Click-to-move: first click selects, second click moves ──────────── */
  function onSquareClick(square) {
    if (!isDraggable) return;

    // If clicking the already-selected square, deselect
    if (selectedSquare === square) {
      setSelectedSquare(null);
      setLegalTargets([]);
      return;
    }

    // If a square is already selected, attempt a move
    if (selectedSquare) {
      const moved = attemptMove(selectedSquare, square);
      if (moved) {
        setSelectedSquare(null);
        setLegalTargets([]);
        return;
      }
    }

    // Select the clicked square and compute legal destinations
    const game = new Chess(fen);
    const moves = game.moves({ square, verbose: true });
    if (moves.length > 0) {
      setSelectedSquare(square);
      setLegalTargets(moves.map((m) => m.to));
    } else {
      setSelectedSquare(null);
      setLegalTargets([]);
    }
  }

  /* ── Drag-and-drop ────────────────────────────────────────────────────── */
  function onPieceDrop(from, to, piece) {
    setSelectedSquare(null);
    setLegalTargets([]);
    const promotion = piece?.[1]?.toLowerCase() === "p" ? "q" : undefined;
    return attemptMove(from, to, promotion);
  }

  function onPieceDragBegin(_piece, square) {
    if (!isDraggable) return;
    const game = new Chess(fen);
    const moves = game.moves({ square, verbose: true });
    setSelectedSquare(square);
    setLegalTargets(moves.map((m) => m.to));
  }

  function onPieceDragEnd() {
    setSelectedSquare(null);
    setLegalTargets([]);
  }

  /* ── Shared move attempt ─────────────────────────────────────────────── */
  function attemptMove(from, to, promotion = "q") {
    if (!isDraggable) return false;
    // Validate promotion: only offer queen by default
    const accepted = onUserMove(from, to, promotion);
    return !!accepted;
  }

  /* ── Render ──────────────────────────────────────────────────────────── */
  return (
    <div
      ref={wrapperRef}
      className={[
        "relative w-full select-none",
        "rounded-lg overflow-hidden shadow-2xl",
        // Shake animation on blunder
        status === STATUSES.BLUNDER ? "animate-shake" : "",
      ]
        .filter(Boolean)
        .join(" ")}
      role="region"
      aria-label="Chess board"
    >
      {/* Hint pulse keyframe — injected once, scoped to this component */}
      <style>{`
        @keyframes hintPulse {
          0%, 100% { box-shadow: inset 0 0 0 3px rgba(251,191,36,0.9), 0 0 0 0 rgba(251,191,36,0); }
          50%       { box-shadow: inset 0 0 0 3px rgba(251,191,36,0.9), 0 0 12px 6px rgba(251,191,36,0.4); }
        }
      `}</style>

      {/* Overlay when board is locked */}
      {!isDraggable && status !== STATUSES.SOLVED && (
        <div
          className="absolute inset-0 z-10 cursor-not-allowed"
          aria-hidden="true"
        />
      )}

      {/* Solved overlay */}
      {status === STATUSES.SOLVED && (
        <div
          className="absolute inset-0 z-10 flex items-center justify-center
                     bg-black/30 backdrop-blur-[2px] pointer-events-none"
          aria-hidden="true"
        >
          <span className="text-5xl drop-shadow-lg animate-bounce">♛</span>
        </div>
      )}

      <Chessboard
        id="daily-puzzle-board"
        position={fen}
        boardWidth={boardWidth}
        onPieceDrop={onPieceDrop}
        onPieceDragBegin={onPieceDragBegin}
        onPieceDragEnd={onPieceDragEnd}
        onSquareClick={onSquareClick}
        boardOrientation={orientation}
        arePiecesDraggable={isDraggable}
        customSquareStyles={customSquareStyles}
        customArrows={hintArrow ?? []}
        customArrowColor="#f59e0b"
        animationDuration={250}
        customBoardStyle={{
          borderRadius: "0",
          boxShadow: "none",
        }}
        customDarkSquareStyle={{ backgroundColor: "#b58863" }}
        customLightSquareStyle={{ backgroundColor: "#f0d9b5" }}
      />
    </div>
  );
}
