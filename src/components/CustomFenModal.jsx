/**
 * CustomFenModal.jsx
 *
 * Modal for adding and managing custom FEN puzzles.
 *
 * Features:
 *   — Paste a FEN + give it a name → saved permanently in localStorage
 *   — "My Puzzles" library lists every saved puzzle, survives page refresh
 *   — Click any saved puzzle to load it on the board
 *   — Delete individual saved puzzles
 *   — Quick-pick preset positions
 *   — FEN validation via chess.js before saving
 *
 * localStorage key: "chess_custom_puzzles"
 * Stored as: JSON array of { id, name, fen, addedAt }
 *
 * Props
 *   isOpen  {boolean}
 *   onClose {Function}
 *   onLoad  {Function(fen: string, name: string)} — load position on board
 */

import { useState, useEffect, useRef, useCallback } from "react";
import { Chess } from "chess.js";

/* ── Storage key ─────────────────────────────────────────────────────────── */
const STORAGE_KEY = "chess_custom_puzzles";

/* ── localStorage helpers ────────────────────────────────────────────────── */
function readSaved() {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    return raw ? JSON.parse(raw) : [];
  } catch {
    return [];
  }
}

function writeSaved(list) {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(list));
  } catch {
    // localStorage full or blocked — silent fail
  }
}

/* ── FEN validation ──────────────────────────────────────────────────────── */
function validateFen(raw) {
  if (!raw || !raw.trim()) return "Please enter a FEN string.";
  try {
    new Chess(raw.trim());
    return null;
  } catch {
    return "Invalid FEN — check the string and try again.";
  }
}

/* ── Which side to move, from FEN ────────────────────────────────────────── */
function sideToMove(fen) {
  const part = fen.trim().split(" ")[1];
  return part === "b" ? "Black" : "White";
}

/* ── Format a stored date ────────────────────────────────────────────────── */
function fmtDate(iso) {
  try {
    return new Date(iso).toLocaleDateString("en-US", {
      month: "short", day: "numeric", year: "numeric",
    });
  } catch {
    return "";
  }
}

/* ── Preset positions ────────────────────────────────────────────────────── */
const PRESETS = [
  { label: "Starting position",    fen: "rnbqkbnr/pppppppp/8/8/8/8/PPPPPPPP/RNBQKBNR w KQkq - 0 1" },
  { label: "Sicilian after 1.e4 c5", fen: "rnbqkbnr/pp1ppppp/8/2p5/4P3/8/PPPP1PPP/RNBQKBNR w KQkq c6 0 2" },
  { label: "Italian Game",          fen: "r1bqkbnr/pppp1ppp/2n5/4p3/2B1P3/5N2/PPPP1PPP/RNBQK2R w KQkq - 4 4" },
  { label: "Ruy López",             fen: "r1bqkbnr/pppp1ppp/2n5/1B2p3/4P3/5N2/PPPP1PPP/RNBQK2R b KQkq - 3 3" },
  { label: "Queen's Gambit",        fen: "rnbqkbnr/ppp1pppp/8/3p4/2PP4/8/PP2PPPP/RNBQKBNR b KQkq c3 0 2" },
];

/* ── Tab type ────────────────────────────────────────────────────────────── */
// "add" | "saved"

/* ════════════════════════════════════════════════════════════════════════════
   Component
   ════════════════════════════════════════════════════════════════════════════ */
export default function CustomFenModal({ isOpen, onClose, onLoad }) {
  /* ── Tab ---------------------------------------------------------------- */
  const [tab, setTab] = useState("add");

  /* ── Add-tab state ------------------------------------------------------ */
  const [fenInput,  setFenInput]  = useState("");
  const [nameInput, setNameInput] = useState("");
  const [error,     setError]     = useState("");
  const fenInputRef = useRef(null);

  /* ── Saved puzzles (synced with localStorage) --------------------------- */
  const [saved, setSaved] = useState(readSaved);

  /* Reload from storage whenever the modal opens */
  useEffect(() => {
    if (isOpen) {
      setSaved(readSaved());
      setTab("add");
      setFenInput("");
      setNameInput("");
      setError("");
      setTimeout(() => fenInputRef.current?.focus(), 60);
    }
  }, [isOpen]);

  /* Close on Escape */
  useEffect(() => {
    if (!isOpen) return;
    const fn = (e) => { if (e.key === "Escape") onClose(); };
    window.addEventListener("keydown", fn);
    return () => window.removeEventListener("keydown", fn);
  }, [isOpen, onClose]);

  if (!isOpen) return null;

  /* ── Save a new puzzle -------------------------------------------------- */
  function handleSaveAndLoad(e) {
    e.preventDefault();
    const err = validateFen(fenInput);
    if (err) { setError(err); return; }

    const trimmedFen  = fenInput.trim();
    const trimmedName = nameInput.trim() || `Custom Puzzle ${saved.length + 1}`;

    const entry = {
      id:      crypto.randomUUID?.() ?? `${Date.now()}-${Math.random()}`,
      name:    trimmedName,
      fen:     trimmedFen,
      addedAt: new Date().toISOString(),
    };

    const updated = [entry, ...saved]; // newest first
    writeSaved(updated);
    setSaved(updated);

    onLoad(trimmedFen, trimmedName);
    onClose();
  }

  /* ── Load a saved puzzle without re-saving ------------------------------ */
  function handleLoadSaved(entry) {
    onLoad(entry.fen, entry.name);
    onClose();
  }

  /* ── Delete a saved puzzle ---------------------------------------------- */
  function handleDelete(id, e) {
    e.stopPropagation(); // don't trigger load
    if (!window.confirm("Remove this puzzle from your saved list?")) return;
    const updated = saved.filter((p) => p.id !== id);
    writeSaved(updated);
    setSaved(updated);
  }

  /* ── Preset click fills inputs ------------------------------------------ */
  function handlePreset(fen, label) {
    setFenInput(fen);
    setNameInput(label);
    setError("");
  }

  /* ── Backdrop dismiss --------------------------------------------------- */
  function handleBackdrop(e) {
    if (e.target === e.currentTarget) onClose();
  }

  /* ════════════════════════════════════════════════════════════════════════
     Render
     ════════════════════════════════════════════════════════════════════════ */
  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center
                 bg-black/70 backdrop-blur-sm animate-fade-in px-4 py-6"
      onClick={handleBackdrop}
      role="dialog"
      aria-modal="true"
      aria-label="Custom puzzle library"
    >
      <div
        className="relative w-full max-w-md bg-gray-900 border border-gray-700
                   rounded-2xl shadow-2xl flex flex-col animate-slide-up
                   max-h-[90vh]"
        onClick={(e) => e.stopPropagation()}
      >

        {/* ── Modal header ──────────────────────────────────────────────── */}
        <div className="flex items-center justify-between px-6 pt-5 pb-3 shrink-0">
          <h2 className="text-lg font-bold text-white flex items-center gap-2">
            <span aria-hidden="true">➕</span> Custom Puzzles
          </h2>
          <button
            onClick={onClose}
            className="text-gray-500 hover:text-gray-300 transition-colors
                       focus:outline-none rounded"
            aria-label="Close"
          >
            <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2}
                    d="M6 18L18 6M6 6l12 12" />
            </svg>
          </button>
        </div>

        {/* ── Tab bar ───────────────────────────────────────────────────── */}
        <div className="flex border-b border-gray-800 px-6 shrink-0">
          {[
            { key: "add",   label: "Add New" },
            { key: "saved", label: `My Puzzles${saved.length ? ` (${saved.length})` : ""}` },
          ].map(({ key, label }) => (
            <button
              key={key}
              onClick={() => setTab(key)}
              className={[
                "pb-2.5 mr-5 text-sm font-medium border-b-2 transition-colors",
                tab === key
                  ? "border-blue-500 text-blue-400"
                  : "border-transparent text-gray-500 hover:text-gray-300",
              ].join(" ")}
            >
              {label}
            </button>
          ))}
        </div>

        {/* ── Scrollable body ───────────────────────────────────────────── */}
        <div className="overflow-y-auto flex-1 px-6 py-4">

          {/* ══════ TAB: ADD NEW ══════════════════════════════════════════ */}
          {tab === "add" && (
            <div className="space-y-4">

              <p className="text-sm text-gray-400">
                Paste a FEN and give it a name. It will be saved permanently
                so you can reload it any time from <strong className="text-gray-300">My Puzzles</strong>.
              </p>

              <form onSubmit={handleSaveAndLoad} className="space-y-3" noValidate>

                {/* Name */}
                <div className="space-y-1">
                  <label htmlFor="puzzle-name"
                    className="text-xs font-medium text-gray-400">
                    Puzzle name <span className="text-gray-600">(optional)</span>
                  </label>
                  <input
                    id="puzzle-name"
                    type="text"
                    maxLength={40}
                    value={nameInput}
                    onChange={(e) => setNameInput(e.target.value)}
                    placeholder="e.g. My endgame study"
                    className="w-full bg-gray-800 border border-gray-600 rounded-lg
                               px-3 py-2.5 text-sm text-gray-200 placeholder-gray-600
                               focus:outline-none focus:ring-2 focus:ring-blue-500
                               transition-colors"
                  />
                </div>

                {/* FEN */}
                <div className="space-y-1">
                  <label htmlFor="custom-fen"
                    className="text-xs font-medium text-gray-400">
                    FEN string <span className="text-red-500">*</span>
                  </label>
                  <input
                    id="custom-fen"
                    ref={fenInputRef}
                    type="text"
                    value={fenInput}
                    onChange={(e) => { setFenInput(e.target.value); setError(""); }}
                    placeholder="rnbqkbnr/pppppppp/8/8/8/8/PPPPPPPP/RNBQKBNR w KQkq - 0 1"
                    className="w-full bg-gray-800 border border-gray-600 rounded-lg
                               px-3 py-2.5 text-xs font-mono text-gray-200
                               placeholder-gray-600
                               focus:outline-none focus:ring-2 focus:ring-blue-500
                               transition-colors"
                    spellCheck={false}
                    autoComplete="off"
                    aria-describedby={error ? "fen-error" : undefined}
                  />
                  {error && (
                    <p id="fen-error" role="alert" className="text-xs text-red-400">
                      {error}
                    </p>
                  )}
                </div>

                <button
                  type="submit"
                  className="w-full py-2.5 rounded-xl bg-emerald-600 hover:bg-emerald-500
                             text-white font-semibold text-sm transition-colors
                             focus:outline-none focus:ring-2 focus:ring-emerald-400"
                >
                  💾 Save &amp; Load Puzzle
                </button>
              </form>

              {/* Divider */}
              <div className="flex items-center gap-3 pt-1">
                <div className="flex-1 h-px bg-gray-800" />
                <span className="text-xs text-gray-600 uppercase tracking-wider">
                  quick presets
                </span>
                <div className="flex-1 h-px bg-gray-800" />
              </div>

              {/* Presets */}
              <div className="space-y-1.5">
                {PRESETS.map((p) => (
                  <button
                    key={p.label}
                    type="button"
                    onClick={() => handlePreset(p.fen, p.label)}
                    className={[
                      "w-full text-left px-3 py-2.5 rounded-lg border text-sm",
                      "transition-colors focus:outline-none focus:ring-2 focus:ring-blue-500",
                      fenInput === p.fen
                        ? "bg-blue-700/30 border-blue-600 text-blue-200"
                        : "bg-gray-800 border-gray-700 text-gray-300 hover:bg-gray-700",
                    ].join(" ")}
                  >
                    <span className="font-medium">{p.label}</span>
                    <span className="block font-mono text-[10px] text-gray-500 mt-0.5 truncate">
                      {p.fen}
                    </span>
                  </button>
                ))}
              </div>
            </div>
          )}

          {/* ══════ TAB: MY PUZZLES ═══════════════════════════════════════ */}
          {tab === "saved" && (
            <div className="space-y-3">

              {saved.length === 0 ? (
                /* Empty state */
                <div className="text-center py-10 space-y-3">
                  <p className="text-4xl" aria-hidden="true">♟</p>
                  <p className="text-gray-500 text-sm">
                    No saved puzzles yet.
                  </p>
                  <button
                    onClick={() => setTab("add")}
                    className="text-sm text-blue-400 hover:text-blue-300 underline
                               focus:outline-none"
                  >
                    Add your first puzzle →
                  </button>
                </div>
              ) : (
                <>
                  <p className="text-xs text-gray-600">
                    {saved.length} saved puzzle{saved.length !== 1 ? "s" : ""} —
                    click any to load it on the board.
                  </p>

                  {saved.map((entry) => (
                    <div
                      key={entry.id}
                      className="group relative bg-gray-800 hover:bg-gray-750
                                 border border-gray-700 hover:border-gray-600
                                 rounded-xl p-3.5 cursor-pointer transition-colors"
                      onClick={() => handleLoadSaved(entry)}
                      role="button"
                      tabIndex={0}
                      onKeyDown={(e) => e.key === "Enter" && handleLoadSaved(entry)}
                      aria-label={`Load puzzle: ${entry.name}`}
                    >
                      {/* Row: name + delete */}
                      <div className="flex items-start justify-between gap-2">
                        <p className="font-semibold text-sm text-white leading-tight">
                          {entry.name}
                        </p>

                        {/* Delete button */}
                        <button
                          onClick={(e) => handleDelete(entry.id, e)}
                          className="shrink-0 text-gray-600 hover:text-red-400
                                     transition-colors p-0.5 rounded
                                     focus:outline-none focus:ring-1 focus:ring-red-500
                                     opacity-0 group-hover:opacity-100"
                          aria-label={`Delete ${entry.name}`}
                        >
                          <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24"
                               stroke="currentColor">
                            <path strokeLinecap="round" strokeLinejoin="round"
                                  strokeWidth={2}
                                  d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2
                                     2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1
                                     1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
                          </svg>
                        </button>
                      </div>

                      {/* FEN preview */}
                      <p className="font-mono text-[10px] text-gray-500 mt-1 truncate">
                        {entry.fen}
                      </p>

                      {/* Meta row */}
                      <div className="flex items-center gap-3 mt-2">
                        <span className="text-[10px] text-gray-600">
                          Added {fmtDate(entry.addedAt)}
                        </span>
                        <span className="text-[10px] px-1.5 py-0.5 rounded-full
                                         bg-gray-700 text-gray-400">
                          {sideToMove(entry.fen)} to move
                        </span>
                      </div>

                      {/* Load hint */}
                      <p className="text-[10px] text-emerald-600 mt-1.5
                                    group-hover:text-emerald-400 transition-colors">
                        Click to load →
                      </p>
                    </div>
                  ))}
                </>
              )}
            </div>
          )}

        </div>{/* end scroll body */}

        {/* ── Modal footer ──────────────────────────────────────────────── */}
        <div className="px-6 py-3 border-t border-gray-800 shrink-0">
          <p className="text-[10px] text-gray-700 text-center">
            Puzzles are saved in your browser's local storage and persist across sessions.
          </p>
        </div>

      </div>
    </div>
  );
}
