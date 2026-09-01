# Daily Chess Puzzle

A daily chess puzzle web app built with **React 18**, **Tailwind CSS 3**,
**Chess.js**, and **Stockfish 17** engine analysis via Web Worker.

---

## Features

| Feature | Detail |
|---|---|
| Date-based puzzle | mulberry32 PRNG seeded from `YYYYMMDD` — same puzzle all day, changes at midnight |
| 100 FEN puzzles | Mate in 1/2/3, forks, pins, skewers, discovered attacks, endgames, expert combos |
| Interactive board | Drag-and-drop + click-to-move, legal move dots, last-move highlights |
| Status machine | `idle → yourTurn → correct → opponent → blunder → solved` |
| Execution timer | Count-up MM:SS, colour shifts green→yellow→orange→red |
| Stockfish 17 | Fires automatically on a wrong move; shows up to 3 PV lines with score & SAN |
| Engine hint | 💡 button reveals the correct move in SAN notation |
| Share result | Copies a one-line result summary to clipboard |
| Responsive layout | Two-column desktop, stacked mobile |

---

## Prerequisites

- **Node.js** ≥ 18 and **npm** ≥ 9
  Download: https://nodejs.org/en/download

---

## Setup

```bash
# 1. Open the project folder in a terminal
cd "c:\Users\Abigael Alarcon\Documents\daily puzzle chess"

# 2. Install dependencies
npm install

# 3. Start the dev server
npm run dev
```

Then open **http://localhost:5173** in your browser.

> **Important:** Stockfish WASM requires `Cross-Origin-Opener-Policy: same-origin`
> and `Cross-Origin-Embedder-Policy: require-corp` headers. These are set
> automatically by `vite.config.js` for the dev server. For production deploys
> you must configure the same headers on your hosting provider.

---

## Build for production

```bash
npm run build      # outputs to dist/
npm run preview    # locally preview the production build
```

---

## Project structure

```
daily puzzle chess/
├── index.html
├── package.json
├── vite.config.js          # COEP/COOP headers + ES worker format
├── tailwind.config.js
├── postcss.config.js
└── src/
    ├── main.jsx            # React entry point
    ├── App.jsx             # Root layout + hook orchestration
    ├── index.css           # Tailwind base + custom utilities
    ├── components/
    │   ├── ChessBoard.jsx  # react-chessboard wrapper
    │   ├── StatusBanner.jsx# Dynamic status display
    │   ├── PuzzleTimer.jsx # Count-up execution timer
    │   └── EngineHint.jsx  # Stockfish PV line display
    ├── hooks/
    │   ├── useChessPuzzle.js  # Game state reducer + move logic
    │   └── useStockfish.js    # Web Worker lifecycle manager
    ├── data/
    │   └── puzzles.js      # 100 FEN-based puzzle dataset
    ├── utils/
    │   ├── dateSeeder.js   # mulberry32 date → puzzle index
    │   └── uciUtils.js     # UCI ↔ SAN conversion helpers
    └── workers/
        └── stockfish.worker.js  # UCI protocol + engine I/O
```

---

## Architecture notes

### Date seeding
`dateSeeder.js` converts `new Date()` to a `YYYYMMDD` integer, feeds it into
`mulberry32` (a single-pass 32-bit PRNG), and takes `floor(result * 100)` as
the puzzle index. No server needed — purely deterministic on the client.

### Game state machine
`useChessPuzzle` uses `useReducer` with six status transitions:

```
IDLE ──► YOUR_TURN ──► CORRECT ──► OPPONENT ──► YOUR_TURN
                  │                                    │
                  └──► BLUNDER ◄──────────────────────┘
                              └──► (retry) YOUR_TURN
YOUR_TURN ──► CORRECT ──► SOLVED  (last move)
```

### Stockfish integration
The Web Worker loads Stockfish from the jsDelivr CDN via `importScripts()`,
performs the UCI handshake (`uci` → `uciok` → `isready` → `readyok`), then
runs `go depth 18` with `MultiPV 3` whenever `analyse(fen)` is called.
Messages flow: `main thread → worker → engine → worker → main thread`.

---

## Troubleshooting

| Problem | Fix |
|---|---|
| Engine never shows "ready" | Browser must support SharedArrayBuffer. Use Chrome/Edge/Firefox with HTTPS or localhost. |
| Board pieces don't appear | Run `npm install` to ensure `react-chessboard` assets are present. |
| Wrong move doesn't trigger analysis | Check the browser console for worker errors; CDN fetch may be blocked by a firewall. |
| Puzzle doesn't change at midnight | The midnight timer uses local time. Hard-refresh the page if needed. |
