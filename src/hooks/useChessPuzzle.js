/**
 * useChessPuzzle.js
 *
 * Central game-state hook. Owns:
 *   — Puzzle loading (date-seeded)
 *   — Chess.js board state
 *   — Move validation against the solution sequence
 *   — Opponent (puzzle) reply automation
 *   — Status machine: idle → yourTurn → correct → blunder → solved
 *   — Stockfish trigger on wrong moves
 *   — Puzzle reset / retry
 *
 * Status values (exported as STATUSES constant):
 *   "idle"      — puzzle just loaded, not yet interacted
 *   "yourTurn"  — waiting for the user's move
 *   "correct"   — user played the right move; opponent will reply
 *   "blunder"   — user played a wrong move; engine hint available
 *   "solved"    — all solution moves completed correctly
 *   "opponent"  — opponent is playing its response move (brief flash)
 */

import { useCallback, useEffect, useReducer, useRef } from "react";
import { Chess } from "chess.js";

import puzzles from "../data/puzzles.js";
import { getTodaysPuzzleIndex, msUntilMidnight } from "../utils/dateSeeder.js";
import { uciToMoveObject } from "../utils/uciUtils.js";

/* ── Status constants ────────────────────────────────────────────────────── */
export const STATUSES = {
  IDLE: "idle",
  YOUR_TURN: "yourTurn",
  CORRECT: "correct",
  OPPONENT: "opponent",
  BLUNDER: "blunder",
  SOLVED: "solved",
};

/* ── Reducer ─────────────────────────────────────────────────────────────── */
const initialState = {
  puzzle: null,           // current puzzle object from dataset
  game: null,             // Chess instance (treated as immutable snapshot)
  fen: "",                // current FEN — drives board re-render
  solutionStep: 0,        // index into puzzle.solution the user must play next
  status: STATUSES.IDLE,
  lastMove: null,         // { from, to } of the most recent move
  wrongMove: null,        // UCI string of the incorrect move, triggers engine
  attempts: 0,            // total wrong attempts this session
  hintsUsed: 0,           // times user explicitly requested a hint
  solved: false,
};

function reducer(state, action) {
  switch (action.type) {

    case "LOAD_PUZZLE": {
      const game = new Chess(action.puzzle.fen);
      return {
        ...initialState,
        puzzle: action.puzzle,
        game,
        fen: game.fen(),
        status: STATUSES.YOUR_TURN,
      };
    }

    case "MOVE_CORRECT": {
      // Apply the user's correct move to the board
      const game = new Chess(state.fen);
      game.move(action.moveObj);
      const nextStep = state.solutionStep + 1;
      const solved = nextStep >= state.puzzle.solution.length;
      return {
        ...state,
        game,
        fen: game.fen(),
        solutionStep: nextStep,
        lastMove: { from: action.moveObj.from, to: action.moveObj.to },
        status: solved ? STATUSES.SOLVED : STATUSES.CORRECT,
        wrongMove: null,
        solved,
      };
    }

    case "OPPONENT_REPLY": {
      // Apply the puzzle's automated opponent move
      const game = new Chess(state.fen);
      game.move(action.moveObj);
      const nextStep = state.solutionStep + 1;
      return {
        ...state,
        game,
        fen: game.fen(),
        solutionStep: nextStep,
        lastMove: { from: action.moveObj.from, to: action.moveObj.to },
        status: STATUSES.YOUR_TURN,
      };
    }

    case "MOVE_WRONG": {
      return {
        ...state,
        status: STATUSES.BLUNDER,
        wrongMove: action.uci,
        attempts: state.attempts + 1,
      };
    }

    case "HINT_USED":
      return { ...state, hintsUsed: state.hintsUsed + 1 };

    case "RESET": {
      const game = new Chess(state.puzzle.fen);
      return {
        ...initialState,
        puzzle: state.puzzle,
        game,
        fen: game.fen(),
        status: STATUSES.YOUR_TURN,
      };
    }

    case "LOAD_CUSTOM_FEN": {
      // Load an arbitrary FEN with no solution — free-play / exploration mode
      const game = new Chess(action.fen);
      const customPuzzle = {
        id: -1,
        fen: action.fen,
        solution: [],        // no required solution
        difficulty: "Custom",
        theme: "Custom",
        title: action.name || "Custom Position",
        rating: null,
      };
      return {
        ...initialState,
        puzzle: customPuzzle,
        game,
        fen: game.fen(),
        status: STATUSES.YOUR_TURN,
      };
    }

    default:
      return state;
  }
}

/* ── Hook ────────────────────────────────────────────────────────────────── */

/**
 * @param {Function} onWrongMove  — called with (fen) when user blunders;
 *                                  the parent should trigger Stockfish here.
 */
export function useChessPuzzle({ onWrongMove } = {}) {
  const [state, dispatch] = useReducer(reducer, initialState);
  const opponentTimerRef = useRef(null);

  /* ── Load today's puzzle ──────────────────────────────────────────────── */
  const loadPuzzle = useCallback((index) => {
    const idx = index ?? getTodaysPuzzleIndex();
    const puzzle = puzzles[idx];
    if (!puzzle) return;
    dispatch({ type: "LOAD_PUZZLE", puzzle });
  }, []);

  // Load on mount
  useEffect(() => {
    loadPuzzle();
  }, [loadPuzzle]);

  // Refresh puzzle at midnight
  useEffect(() => {
    const ms = msUntilMidnight();
    const timer = setTimeout(() => loadPuzzle(), ms);
    return () => clearTimeout(timer);
  }, [loadPuzzle]);

  /* ── Opponent auto-reply ──────────────────────────────────────────────── */
  // After a correct user move, play the puzzle's next move automatically
  // (unless the puzzle is now solved).
  useEffect(() => {
    if (state.status !== STATUSES.CORRECT) return;

    // Clear any prior pending timer
    if (opponentTimerRef.current) clearTimeout(opponentTimerRef.current);

    opponentTimerRef.current = setTimeout(() => {
      const { puzzle, solutionStep } = state;
      const opponentUci = puzzle.solution[solutionStep];
      if (!opponentUci) return;

      const moveObj = uciToMoveObject(opponentUci);
      if (!moveObj) return;

      // Verify the move is legal before dispatching
      const testGame = new Chess(state.fen);
      const result = testGame.move(moveObj);
      if (!result) return;

      dispatch({ type: "OPPONENT_REPLY", moveObj });
    }, 600); // 600 ms feels natural

    return () => clearTimeout(opponentTimerRef.current);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [state.status, state.solutionStep]);

  /* ── User move handler ────────────────────────────────────────────────── */
  /**
   * Called by the board component when the user drops a piece.
   *
   * @param {string} from  - Source square, e.g. "e2"
   * @param {string} to    - Target square, e.g. "e4"
   * @param {string} [promotion="q"] - Promotion piece if applicable
   * @returns {boolean} true if the move should be applied on the board visually
   */
  const onUserMove = useCallback(
    (from, to, promotion = "q") => {
      const { status, puzzle, solutionStep, fen } = state;

      // Only accept moves when it is the user's turn
      if (status !== STATUSES.YOUR_TURN && status !== STATUSES.BLUNDER) {
        return false;
      }

      // After a blunder the user retries from the same position — reset board
      // to the pre-blunder FEN before checking
      const activeFen =
        status === STATUSES.BLUNDER
          ? (() => {
              // Reconstruct the FEN before the wrong move was attempted.
              // Since we never mutated the Chess instance on a blunder,
              // state.fen is already the correct position.
              return fen;
            })()
          : fen;

      // Verify legality with chess.js
      const testGame = new Chess(activeFen);
      const moveObj = { from, to, ...(promotion ? { promotion } : {}) };
      let result;
      try {
        result = testGame.move(moveObj);
      } catch {
        result = null;
      }
      if (!result) return false; // Illegal move — reject silently

      // Build the UCI string for comparison
      const playedUci = `${from}${to}${promotion && result.flags.includes("p") ? promotion : ""}`;

      // Compare against the expected solution move
      const expectedUci = puzzle.solution[solutionStep];

      // Custom position (no solution) — any legal move is accepted
      if (!puzzle.solution.length) {
        dispatch({ type: "MOVE_CORRECT", moveObj: result });
        return true;
      }

      const isCorrect = normaliseUci(playedUci) === normaliseUci(expectedUci);

      if (isCorrect) {
        dispatch({ type: "MOVE_CORRECT", moveObj: result });
      } else {
        dispatch({ type: "MOVE_WRONG", uci: playedUci });
        // Notify parent so it can fire Stockfish on the current position
        if (typeof onWrongMove === "function") {
          onWrongMove(activeFen);
        }
      }

      return isCorrect; // board component uses this to decide whether to snap back
    },
    [state, onWrongMove]
  );

  /* ── Retry (keep same puzzle, reset to start) ─────────────────────────── */
  const resetPuzzle = useCallback(() => {
    if (opponentTimerRef.current) clearTimeout(opponentTimerRef.current);
    dispatch({ type: "RESET" });
  }, []);

  /* ── Load a custom FEN (no solution) ──────────────────────────────────── */
  const loadCustomFen = useCallback((fen, name) => {
    if (opponentTimerRef.current) clearTimeout(opponentTimerRef.current);
    dispatch({ type: "LOAD_CUSTOM_FEN", fen, name });
  }, []);

  /* ── Mark hint used ───────────────────────────────────────────────────── */
  const markHintUsed = useCallback(() => {
    dispatch({ type: "HINT_USED" });
  }, []);

  /* ── Derived helpers exposed to the UI ───────────────────────────────────*/

  /** The UCI move the user must play right now */
  const expectedMove =
    state.puzzle?.solution[state.solutionStep] ?? null;

  /** Progress through solution e.g. "1 / 3" */
  const progress = state.puzzle
    ? `${Math.floor(state.solutionStep / 2) + (state.status === STATUSES.YOUR_TURN ? 1 : 1)} / ${Math.ceil(state.puzzle.solution.length / 2)}`
    : "—";

  return {
    // State
    puzzle: state.puzzle,
    fen: state.fen,
    status: state.status,
    lastMove: state.lastMove,
    wrongMove: state.wrongMove,
    attempts: state.attempts,
    hintsUsed: state.hintsUsed,
    solved: state.solved,
    solutionStep: state.solutionStep,
    expectedMove,
    progress,
    // Actions
    onUserMove,
    resetPuzzle,
    loadPuzzle,
    loadCustomFen,
    markHintUsed,
  };
}

/* ── Helpers ─────────────────────────────────────────────────────────────── */

/**
 * Strip trailing default promotion from a UCI string so "e7e8q" and "e7e8"
 * compare equal when the expected move omits the promotion suffix.
 *
 * @param {string} uci
 * @returns {string}
 */
function normaliseUci(uci) {
  if (!uci) return "";
  // If the move is a promotion and ends with "q", strip it for comparison
  // since puzzles.js may or may not include the suffix consistently.
  return uci.length === 5 && uci[4] === "q" ? uci.slice(0, 4) : uci;
}
