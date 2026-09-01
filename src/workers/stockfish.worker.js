/**
 * stockfish.worker.js
 *
 * Web Worker that wraps the Stockfish 17 WASM engine (loaded via CDN).
 * Communicates with the main thread using a simple message protocol.
 *
 * Inbound messages from main thread:
 *   { type: "init" }
 *     — Load and initialise the Stockfish engine.
 *
 *   { type: "analyse", fen: string, depth: number, multiPV: number }
 *     — Run analysis on the given FEN position.
 *       depth   : search depth (default 18)
 *       multiPV : number of principal variations to return (default 3)
 *
 *   { type: "stop" }
 *     — Immediately halt the current search.
 *
 *   { type: "quit" }
 *     — Terminate the engine cleanly.
 *
 * Outbound messages to main thread:
 *   { type: "ready" }
 *     — Engine loaded and UCI handshake complete.
 *
 *   { type: "info", depth, score, mate, pv, pvSan }
 *     — Incremental info line from an ongoing search.
 *       score  : centipawn score (null when mate is present)
 *       mate   : mate-in-N (null when score is present)
 *       pv     : best line as UCI move strings (e.g. ["e2e4","e7e5"])
 *
 *   { type: "bestmove", move: string }
 *     — Final best move once the search completes.
 *
 *   { type: "error", message: string }
 *     — Any error encountered inside the worker.
 */

/* ── State ──────────────────────────────────────────────────────────────── */
let engine = null;       // Stockfish instance (has postMessage & onmessage)
let engineReady = false;
let currentFen = null;

/* ── Load Stockfish from CDN ─────────────────────────────────────────────── */
const STOCKFISH_CDN =
  "https://cdn.jsdelivr.net/npm/stockfish@16.0.0/src/stockfish.js";

async function loadEngine() {
  try {
    // importScripts blocks until the script is parsed and executed.
    // Stockfish exposes itself as a global factory function called `Stockfish`.
    importScripts(STOCKFISH_CDN);

    // The CDN build exposes a factory; call it to get the engine instance.
    engine = await Stockfish(); // eslint-disable-line no-undef

    // Wire up engine → worker output handler
    engine.onmessage = handleEngineOutput;

    // Standard UCI initialisation handshake
    engine.postMessage("uci");
  } catch (err) {
    self.postMessage({ type: "error", message: `Engine load failed: ${err.message}` });
  }
}

/* ── Parse UCI output ────────────────────────────────────────────────────── */
function handleEngineOutput(event) {
  const line = typeof event === "string" ? event : event.data;
  if (!line) return;

  // Engine confirmed UCI mode
  if (line === "uciok") {
    engine.postMessage("isready");
    return;
  }

  // Engine is ready to receive commands
  if (line === "readyok") {
    engineReady = true;
    self.postMessage({ type: "ready" });
    return;
  }

  // Best move at the end of a search
  if (line.startsWith("bestmove")) {
    const parts = line.split(" ");
    const move = parts[1] && parts[1] !== "(none)" ? parts[1] : null;
    self.postMessage({ type: "bestmove", move });
    return;
  }

  // Incremental search info lines
  if (line.startsWith("info") && line.includes(" pv ")) {
    const info = parseInfoLine(line);
    if (info) self.postMessage({ type: "info", ...info });
  }
}

/**
 * Parses a Stockfish UCI "info" line into a structured object.
 *
 * Example input:
 *   "info depth 18 seldepth 24 multipv 1 score cp 45 nodes 120345 nps 982345
 *    time 123 pv e2e4 e7e5 g1f3 b8c6"
 *
 * @param {string} line - Raw UCI info line.
 * @returns {{ depth, score, mate, pv, multiPv } | null}
 */
function parseInfoLine(line) {
  const tokens = line.split(" ");
  const get = (key) => {
    const idx = tokens.indexOf(key);
    return idx !== -1 ? tokens[idx + 1] : null;
  };

  const depth = parseInt(get("depth"), 10);
  const multiPv = parseInt(get("multipv"), 10) || 1;

  // Score: either "cp <n>" or "mate <n>"
  let score = null;
  let mate = null;
  const scoreType = get("score"); // "cp" or "mate"
  if (scoreType === "cp") {
    score = parseInt(tokens[tokens.indexOf("score") + 2], 10);
  } else if (scoreType === "mate") {
    mate = parseInt(tokens[tokens.indexOf("score") + 2], 10);
  }

  // Principal variation — everything after the "pv" token
  const pvIdx = tokens.indexOf("pv");
  const pv = pvIdx !== -1 ? tokens.slice(pvIdx + 1) : [];

  if (!pv.length) return null;

  return { depth, score, mate, pv, multiPv };
}

/* ── Inbound message handler ─────────────────────────────────────────────── */
self.onmessage = async function (event) {
  const msg = event.data;

  switch (msg.type) {
    case "init":
      if (!engine) await loadEngine();
      break;

    case "analyse": {
      if (!engineReady) {
        self.postMessage({ type: "error", message: "Engine not ready yet." });
        return;
      }
      const fen = msg.fen;
      const depth = msg.depth ?? 18;
      const multiPV = msg.multiPV ?? 3;

      currentFen = fen;

      // Stop any ongoing search before starting a new one
      engine.postMessage("stop");

      // Configure and start analysis
      engine.postMessage(`setoption name MultiPV value ${multiPV}`);
      engine.postMessage("ucinewgame");
      engine.postMessage(`position fen ${fen}`);
      engine.postMessage(`go depth ${depth}`);
      break;
    }

    case "stop":
      if (engine && engineReady) engine.postMessage("stop");
      break;

    case "quit":
      if (engine && engineReady) engine.postMessage("quit");
      engineReady = false;
      engine = null;
      break;

    default:
      self.postMessage({ type: "error", message: `Unknown message type: ${msg.type}` });
  }
};
