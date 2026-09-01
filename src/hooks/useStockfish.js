/**
 * useStockfish.js
 *
 * React hook that manages the Stockfish Web Worker lifecycle and exposes
 * a clean API for the rest of the application.
 *
 * Usage:
 *   const { analyse, stop, engineReady, lines, bestMove, isAnalysing } =
 *     useStockfish();
 *
 *   // Trigger analysis on a FEN
 *   analyse(fen, { depth: 18, multiPV: 3 });
 *
 *   // Stop ongoing search
 *   stop();
 *
 * Returned state:
 *   engineReady  — true once the UCI handshake is complete
 *   isAnalysing  — true while a search is in progress
 *   lines        — array of best lines, sorted by multiPv index
 *                  Each line: { depth, score, mate, pv, multiPv }
 *   bestMove     — the final best move UCI string from the last search
 *   error        — any error message from the engine, or null
 */

import { useEffect, useRef, useCallback, useState } from "react";

export function useStockfish() {
  const workerRef = useRef(null);

  const [engineReady, setEngineReady] = useState(false);
  const [isAnalysing, setIsAnalysing] = useState(false);
  const [lines, setLines] = useState([]);      // array indexed by multiPv
  const [bestMove, setBestMove] = useState(null);
  const [error, setError] = useState(null);

  /* ── Boot the worker once on mount ─────────────────────────────────────── */
  useEffect(() => {
    // Vite handles `?worker` imports; for plain usage we new Worker() the URL.
    const worker = new Worker(
      new URL("../workers/stockfish.worker.js", import.meta.url),
      { type: "module" }
    );

    worker.onmessage = (event) => {
      const msg = event.data;

      switch (msg.type) {
        case "ready":
          setEngineReady(true);
          break;

        case "info":
          // Accumulate principal variations; replace the entry at the
          // matching multiPv slot so we always hold the latest depth.
          setLines((prev) => {
            const next = [...prev];
            const slot = (msg.multiPv ?? 1) - 1; // convert 1-based to 0-based
            next[slot] = msg;
            return next;
          });
          break;

        case "bestmove":
          setBestMove(msg.move);
          setIsAnalysing(false);
          break;

        case "error":
          setError(msg.message);
          setIsAnalysing(false);
          break;

        default:
          break;
      }
    };

    worker.onerror = (err) => {
      setError(`Worker error: ${err.message}`);
      setIsAnalysing(false);
    };

    workerRef.current = worker;

    // Kick off engine initialisation immediately
    worker.postMessage({ type: "init" });

    return () => {
      worker.postMessage({ type: "quit" });
      worker.terminate();
    };
  }, []);

  /* ── Public API ─────────────────────────────────────────────────────────── */

  /**
   * Start an analysis on the given FEN string.
   *
   * @param {string} fen     - Position to analyse.
   * @param {object} options
   * @param {number} [options.depth=18]   - Search depth.
   * @param {number} [options.multiPV=3]  - Number of PV lines to return.
   */
  const analyse = useCallback((fen, { depth = 18, multiPV = 3 } = {}) => {
    if (!workerRef.current) return;
    // Reset state for the new search
    setLines([]);
    setBestMove(null);
    setError(null);
    setIsAnalysing(true);
    workerRef.current.postMessage({ type: "analyse", fen, depth, multiPV });
  }, []);

  /**
   * Halt any ongoing search.
   */
  const stop = useCallback(() => {
    if (!workerRef.current) return;
    workerRef.current.postMessage({ type: "stop" });
    setIsAnalysing(false);
  }, []);

  return { engineReady, isAnalysing, lines, bestMove, error, analyse, stop };
}
