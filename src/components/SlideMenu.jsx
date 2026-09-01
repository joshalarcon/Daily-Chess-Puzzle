/**
 * SlideMenu.jsx
 *
 * Right-to-left slide-out drawer.  It does NOT cover the full width —
 * it stops at 320 px (desktop) / 85 vw (mobile) so the board stays
 * partially visible behind it.
 *
 * Sections (top → bottom):
 *   1. Profile block  — avatar, username, provider badge, join date
 *                       "Edit username" for guests
 *   2. Engine status  — live Stockfish indicator + depth / state
 *   3. Nav items      — Analyse Game, Daily Puzzle (active), Settings
 *   4. Footer         — Sign out (if logged in)
 *
 * Props
 *   isOpen          {boolean}
 *   onClose         {Function}
 *   onOpenAnalysis  {Function}  — opens the full-screen AnalysisPanel
 *   onOpenAuth      {Function}  — opens AuthModal
 *   engineReady     {boolean}
 *   isAnalysing     {boolean}
 *   puzzleStatus    {string}    — current STATUSES value
 *   engineLines     {Array}     — top PV lines from useStockfish
 */

import { useState, useRef, useEffect } from "react";
import { useAuth } from "../context/AuthContext.jsx";
import { STATUSES } from "../hooks/useChessPuzzle.js";
import { formatScore, scoreColourClass } from "../utils/uciUtils.js";

/* ── Avatar colour (same logic as ProfileButton) ────────────────────────── */
const AVATAR_COLOURS = [
  "bg-blue-600",   "bg-purple-600", "bg-green-600",
  "bg-rose-600",   "bg-amber-600",  "bg-teal-600",
  "bg-indigo-600", "bg-pink-600",
];
function avatarColour(username) {
  if (!username) return "bg-gray-600";
  let h = 0;
  for (let i = 0; i < username.length; i++) h = username.charCodeAt(i) + ((h << 5) - h);
  return AVATAR_COLOURS[Math.abs(h) % AVATAR_COLOURS.length];
}

/* ── Provider display config ─────────────────────────────────────────────── */
const PROVIDER_LABEL = { guest: "Guest", facebook: "Facebook" };
const PROVIDER_COLOUR = { guest: "text-gray-400", facebook: "text-blue-400" };

/* ── Status display for puzzle ───────────────────────────────────────────── */
const STATUS_META = {
  [STATUSES.IDLE]:     { label: "Idle",           colour: "bg-gray-600" },
  [STATUSES.YOUR_TURN]:{ label: "Your turn",       colour: "bg-blue-500" },
  [STATUSES.CORRECT]:  { label: "Correct move!",   colour: "bg-green-500" },
  [STATUSES.OPPONENT]: { label: "Opponent's turn", colour: "bg-gray-500" },
  [STATUSES.BLUNDER]:  { label: "Blunder!",        colour: "bg-red-500" },
  [STATUSES.SOLVED]:   { label: "Puzzle solved!",  colour: "bg-purple-500" },
};

/* ── Nav item component ──────────────────────────────────────────────────── */
function NavItem({ icon, label, onClick, active = false, badge }) {
  return (
    <button
      onClick={onClick}
      className={[
        "w-full flex items-center gap-3 px-4 py-3 rounded-xl text-sm font-medium",
        "transition-colors focus:outline-none focus:ring-2 focus:ring-inset focus:ring-gray-500",
        active
          ? "bg-blue-700/30 border border-blue-700/50 text-blue-300"
          : "hover:bg-gray-800 text-gray-300 hover:text-white border border-transparent",
      ].join(" ")}
    >
      <span className="text-lg w-6 text-center shrink-0" aria-hidden="true">{icon}</span>
      <span className="flex-1 text-left">{label}</span>
      {badge && (
        <span className="text-xs px-2 py-0.5 rounded-full bg-gray-700 text-gray-400">
          {badge}
        </span>
      )}
      {active && (
        <span className="w-1.5 h-1.5 rounded-full bg-blue-400 shrink-0" aria-hidden="true" />
      )}
    </button>
  );
}

/* ── Section header ──────────────────────────────────────────────────────── */
function SectionLabel({ children }) {
  return (
    <p className="px-4 pt-4 pb-1 text-[10px] font-semibold uppercase tracking-widest text-gray-600">
      {children}
    </p>
  );
}

/* ── Divider ─────────────────────────────────────────────────────────────── */
function Divider() {
  return <div className="mx-4 border-t border-gray-800" />;
}

/* ── Main component ──────────────────────────────────────────────────────── */
export default function SlideMenu({
  isOpen,
  onClose,
  onOpenAnalysis,
  onOpenAuth,
  onOpenCustomFen,
  engineReady,
  isAnalysing,
  puzzleStatus,
  engineLines,
}) {
  const { user, isLoggedIn, initials, logout, updateUsername } = useAuth();
  const colour = avatarColour(user?.username);

  /* Username inline edit for guests */
  const [editingName, setEditingName] = useState(false);
  const [draftName,   setDraftName]   = useState("");
  const nameInputRef = useRef(null);

  useEffect(() => {
    if (editingName && nameInputRef.current) nameInputRef.current.focus();
  }, [editingName]);

  function startEdit() {
    setDraftName(user?.username ?? "");
    setEditingName(true);
  }
  function commitEdit(e) {
    e?.preventDefault();
    const trimmed = draftName.trim();
    if (trimmed.length >= 2 && trimmed.length <= 20) updateUsername(trimmed);
    setEditingName(false);
  }

  /* Top PV line for engine status */
  const topLine    = (engineLines ?? []).filter(Boolean)[0] ?? null;
  const topScore   = topLine?.score ?? null;
  const topMate    = topLine?.mate  ?? null;
  const topDepth   = topLine?.depth ?? null;
  const scoreLabel = formatScore(topScore, topMate);
  const scoreClass = scoreColourClass(topScore, topMate);

  const statusMeta  = STATUS_META[puzzleStatus] ?? STATUS_META[STATUSES.IDLE];

  /* Format join date */
  const joinedLabel = user?.joinedAt
    ? new Date(user.joinedAt).toLocaleDateString("en-US", {
        month: "short", day: "numeric", year: "numeric",
      })
    : null;

  /* Trap focus & close on Escape */
  useEffect(() => {
    if (!isOpen) return;
    function onKey(e) { if (e.key === "Escape") onClose(); }
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [isOpen, onClose]);

  return (
    <>
      {/* ── Backdrop ─────────────────────────────────────────────────── */}
      {/* Partially transparent so board stays visible */}
      <div
        aria-hidden="true"
        onClick={onClose}
        className={[
          "fixed inset-0 z-30 bg-black/50 backdrop-blur-[2px]",
          "transition-opacity duration-300",
          isOpen ? "opacity-100 pointer-events-auto" : "opacity-0 pointer-events-none",
        ].join(" ")}
      />

      {/* ── Drawer ───────────────────────────────────────────────────── */}
      <aside
        role="dialog"
        aria-modal="true"
        aria-label="Main menu"
        className={[
          /* width: 320px on md+, 85vw on small screens */
          "fixed top-0 right-0 bottom-0 z-40",
          "w-[85vw] max-w-[320px]",
          "flex flex-col",
          "bg-gray-950 border-l border-gray-800 shadow-2xl",
          "transition-transform duration-300 ease-in-out",
          isOpen ? "translate-x-0" : "translate-x-full",
        ].join(" ")}
      >
        {/* ── Drawer header ──────────────────────────────────────────── */}
        <div className="flex items-center justify-between px-4 py-4
                        border-b border-gray-800 shrink-0">
          <span className="text-sm font-semibold text-gray-400 uppercase tracking-widest">
            Menu
          </span>
          <button
            onClick={onClose}
            aria-label="Close menu"
            className="text-gray-500 hover:text-gray-300 transition-colors
                       focus:outline-none focus:ring-2 focus:ring-gray-500 rounded-lg p-1"
          >
            <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2}
                    d="M6 18L18 6M6 6l12 12" />
            </svg>
          </button>
        </div>

        {/* ── Scrollable body ────────────────────────────────────────── */}
        <div className="flex-1 overflow-y-auto">

          {/* ══ 1. PROFILE SECTION ════════════════════════════════════ */}
          <div className="px-4 py-5">
            <div className="flex items-start gap-4">

              {/* Avatar circle */}
              <button
                onClick={onOpenAuth}
                aria-label={isLoggedIn ? "Edit profile" : "Sign in"}
                className={[
                  "w-14 h-14 rounded-full shrink-0 flex items-center justify-center",
                  "text-xl font-bold text-white border-2 border-white/10",
                  "hover:border-white/30 transition-all focus:outline-none",
                  "focus:ring-2 focus:ring-white/30",
                  colour,
                ].join(" ")}
              >
                {initials}
              </button>

              {/* Name + info */}
              <div className="flex-1 min-w-0 pt-0.5 space-y-1">

                {/* Username row */}
                {editingName ? (
                  <form onSubmit={commitEdit} className="flex items-center gap-1">
                    <input
                      ref={nameInputRef}
                      value={draftName}
                      onChange={(e) => setDraftName(e.target.value)}
                      maxLength={20}
                      className="flex-1 min-w-0 bg-gray-800 border border-gray-600
                                 rounded-lg px-2 py-1 text-sm text-white
                                 focus:outline-none focus:ring-2 focus:ring-blue-500"
                      aria-label="New username"
                    />
                    <button type="submit"
                      className="text-xs text-green-400 hover:text-green-300 px-1 shrink-0">
                      ✓
                    </button>
                    <button type="button" onClick={() => setEditingName(false)}
                      className="text-xs text-gray-500 hover:text-gray-300 px-1 shrink-0">
                      ✗
                    </button>
                  </form>
                ) : (
                  <div className="flex items-center gap-2">
                    <p className="font-semibold text-white text-sm truncate">
                      {isLoggedIn ? user.username : "Guest"}
                    </p>
                    {isLoggedIn && user?.provider === "guest" && (
                      <button
                        onClick={startEdit}
                        className="text-[10px] text-gray-600 hover:text-gray-400
                                   transition-colors shrink-0"
                        aria-label="Edit username"
                      >
                        ✎ edit
                      </button>
                    )}
                  </div>
                )}

                {/* Provider badge */}
                <p className={`text-xs ${isLoggedIn ? PROVIDER_COLOUR[user.provider] : "text-gray-600"}`}>
                  {isLoggedIn
                    ? `${PROVIDER_LABEL[user.provider] ?? user.provider} account`
                    : "Not signed in"}
                </p>

                {/* Joined date */}
                {joinedLabel && (
                  <p className="text-[10px] text-gray-600">Joined {joinedLabel}</p>
                )}

                {/* Sign in / out button */}
                {!isLoggedIn ? (
                  <button
                    onClick={() => { onClose(); onOpenAuth(); }}
                    className="mt-1 text-xs bg-blue-700 hover:bg-blue-600 text-white
                               px-3 py-1 rounded-full transition-colors
                               focus:outline-none focus:ring-2 focus:ring-blue-500"
                  >
                    Sign in / Sign up
                  </button>
                ) : null}
              </div>
            </div>
          </div>

          <Divider />

          {/* ══ 2. PUZZLE STATUS ══════════════════════════════════════ */}
          <SectionLabel>Puzzle status</SectionLabel>
          <div className="px-4 pb-2">
            <div className="flex items-center gap-2.5 bg-gray-900 rounded-xl
                            border border-gray-800 px-4 py-3">
              <span className={`w-2.5 h-2.5 rounded-full shrink-0 ${statusMeta.colour}`}
                    aria-hidden="true" />
              <span className="text-sm text-gray-200 font-medium">
                {statusMeta.label}
              </span>
            </div>
          </div>

          <Divider />

          {/* ══ 3. ENGINE STATUS ══════════════════════════════════════ */}
          <SectionLabel>Stockfish 17</SectionLabel>
          <div className="px-4 pb-3 space-y-2">

            {/* Ready / loading */}
            <div className="flex items-center gap-2.5 bg-gray-900 rounded-xl
                            border border-gray-800 px-4 py-3">
              <span
                className={[
                  "w-2.5 h-2.5 rounded-full shrink-0",
                  isAnalysing
                    ? "bg-blue-400 animate-pulse"
                    : engineReady ? "bg-green-400" : "bg-gray-600",
                ].join(" ")}
                aria-hidden="true"
              />
              <span className="text-sm text-gray-300">
                {isAnalysing
                  ? "Analysing…"
                  : engineReady ? "Engine ready" : "Loading engine…"}
              </span>
            </div>

            {/* Score pill — visible after any analysis */}
            {topLine && (
              <div className="flex items-center justify-between bg-gray-900
                              rounded-xl border border-gray-800 px-4 py-3">
                <span className="text-xs text-gray-500 uppercase tracking-wide">
                  Evaluation
                </span>
                <div className="flex items-center gap-2">
                  <span className={`font-mono text-base font-bold ${scoreClass}`}>
                    {scoreLabel}
                  </span>
                  {topDepth && (
                    <span className="text-xs text-gray-600 font-mono">
                      d{topDepth}
                    </span>
                  )}
                </div>
              </div>
            )}
          </div>

          <Divider />

          {/* ══ 4. NAVIGATION ═════════════════════════════════════════ */}
          <SectionLabel>Navigation</SectionLabel>
          <nav className="px-3 pb-3 space-y-1" aria-label="Main navigation">

            <NavItem
              icon="♟"
              label="Daily Puzzle"
              active={true}
              onClick={onClose}
            />

            <NavItem
              icon="➕"
              label="Add Puzzle"
              onClick={() => { onClose(); onOpenCustomFen(); }}
            />

            <NavItem
              icon="⚙"
              label="Analyse Game"
              onClick={() => { onClose(); onOpenAnalysis(); }}
            />

            <NavItem
              icon="📖"
              label="How to play"
              onClick={() => {
                onClose();
                alert(
                  "Daily Chess Puzzle\n\n" +
                  "• A new puzzle appears every day based on the calendar date.\n" +
                  "• Drag or click pieces to make your move.\n" +
                  "• If you play the wrong move, Stockfish analyses the position.\n" +
                  "• Use 💡 Hint to reveal the correct move.\n" +
                  "• Use Add Puzzle to load any FEN position.\n" +
                  "• Use Analyse Game to paste any FEN or PGN for engine evaluation."
                );
              }}
            />

          </nav>

          <Divider />

          {/* ══ 5. SIGN OUT ═══════════════════════════════════════════ */}
          {isLoggedIn && (
            <div className="px-3 py-3">
              <button
                onClick={() => { logout(); onClose(); }}
                className="w-full flex items-center gap-3 px-4 py-3 rounded-xl
                           text-sm font-medium text-red-400 hover:bg-red-900/20
                           border border-transparent hover:border-red-900/40
                           transition-colors focus:outline-none focus:ring-2
                           focus:ring-red-500"
              >
                <span className="text-lg w-6 text-center" aria-hidden="true">⎋</span>
                Sign out
              </button>
            </div>
          )}

        </div>{/* end scroll body */}

        {/* ── Drawer footer ──────────────────────────────────────────── */}
        <div className="px-4 py-3 border-t border-gray-800 shrink-0">
          <p className="text-[10px] text-gray-700 text-center">
            Daily Chess Puzzle · Powered by Stockfish 17
          </p>
        </div>

      </aside>
    </>
  );
}
