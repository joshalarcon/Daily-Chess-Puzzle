/**
 * AuthModal.jsx
 *
 * Full-screen centred modal for login / sign-up.
 *
 * Flow:
 *   Step 1 — Choose method: Facebook  |  Continue as Guest
 *   Step 2a (Facebook) — stub button that signs in immediately
 *   Step 2b (Guest)    — username input form
 *
 * After auth the modal calls onClose() and the user lands back on the app.
 */

import { useState, useRef, useEffect } from "react";
import { useAuth } from "../context/AuthContext.jsx";

/* ── Facebook brand colour ───────────────────────────────────────────────── */
const FB_BLUE = "#1877F2";

/* ── Username validation ─────────────────────────────────────────────────── */
function validateUsername(name) {
  if (!name || name.trim().length < 2) return "Username must be at least 2 characters.";
  if (name.trim().length > 20)         return "Username must be 20 characters or fewer.";
  if (!/^[a-zA-Z0-9_\- ]+$/.test(name)) return "Only letters, numbers, spaces, _ and - are allowed.";
  return null;
}

/* ── Component ───────────────────────────────────────────────────────────── */
export default function AuthModal({ isOpen, onClose }) {
  const { loginAsGuest, loginWithFacebook } = useAuth();

  // "choose" | "guest"
  const [step, setStep] = useState("choose");
  const [username, setUsername] = useState("");
  const [error, setError]       = useState("");
  const [fbLoading, setFbLoading] = useState(false);

  const inputRef = useRef(null);

  // Focus the username input when the guest step mounts
  useEffect(() => {
    if (step === "guest" && inputRef.current) {
      inputRef.current.focus();
    }
  }, [step]);

  // Reset internal state when the modal opens
  useEffect(() => {
    if (isOpen) {
      setStep("choose");
      setUsername("");
      setError("");
      setFbLoading(false);
    }
  }, [isOpen]);

  if (!isOpen) return null;

  /* ── Handlers ───────────────────────────────────────────────────────── */
  function handleFacebook() {
    setFbLoading(true);
    // Simulate async OAuth (replace with real SDK call later)
    setTimeout(() => {
      loginWithFacebook();
      setFbLoading(false);
      onClose();
    }, 800);
  }

  function handleGuestSubmit(e) {
    e.preventDefault();
    const err = validateUsername(username);
    if (err) { setError(err); return; }
    loginAsGuest(username);
    onClose();
  }

  /* ── Backdrop click closes modal ────────────────────────────────────── */
  function handleBackdrop(e) {
    if (e.target === e.currentTarget) onClose();
  }

  /* ── Render ─────────────────────────────────────────────────────────── */
  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center
                 bg-black/70 backdrop-blur-sm animate-fade-in px-4"
      onClick={handleBackdrop}
      role="dialog"
      aria-modal="true"
      aria-label="Sign in or create account"
    >
      <div className="relative w-full max-w-sm bg-gray-900 border border-gray-700
                      rounded-2xl shadow-2xl p-6 space-y-5 animate-slide-up">

        {/* Close button */}
        <button
          onClick={onClose}
          className="absolute top-4 right-4 text-gray-500 hover:text-gray-300
                     transition-colors focus:outline-none"
          aria-label="Close"
        >
          <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2}
                  d="M6 18L18 6M6 6l12 12" />
          </svg>
        </button>

        {/* ── STEP: choose method ────────────────────────────────────── */}
        {step === "choose" && (
          <>
            {/* Logo + heading */}
            <div className="text-center space-y-1 pt-2">
              <span className="text-4xl" aria-hidden="true">♟</span>
              <h2 className="text-xl font-bold text-white">Welcome</h2>
              <p className="text-sm text-gray-400">
                Sign in to track your progress
              </p>
            </div>

            {/* Facebook */}
            <button
              onClick={handleFacebook}
              disabled={fbLoading}
              style={{ backgroundColor: FB_BLUE }}
              className="w-full flex items-center justify-center gap-3 py-3 px-4
                         rounded-xl text-white font-semibold text-sm
                         hover:opacity-90 active:opacity-80 transition-opacity
                         disabled:opacity-60 focus:outline-none focus:ring-2
                         focus:ring-blue-400"
            >
              {/* Facebook logo SVG */}
              {fbLoading ? (
                <svg className="w-5 h-5 animate-spin" fill="none" viewBox="0 0 24 24">
                  <circle className="opacity-25" cx="12" cy="12" r="10"
                          stroke="currentColor" strokeWidth="4" />
                  <path className="opacity-75" fill="currentColor"
                        d="M4 12a8 8 0 018-8v4a4 4 0 00-4 4H4z" />
                </svg>
              ) : (
                <svg className="w-5 h-5 shrink-0" fill="currentColor" viewBox="0 0 24 24">
                  <path d="M24 12.073C24 5.406 18.627 0 12 0S0 5.406 0 12.073C0
                    18.1 4.388 23.094 10.125 24v-8.437H7.078v-3.49h3.047V9.41c0-3.025
                    1.791-4.697 4.533-4.697 1.312 0 2.686.235 2.686.235v2.97h-1.513
                    c-1.491 0-1.956.93-1.956 1.885v2.27h3.328l-.532 3.49h-2.796V24
                    C19.612 23.094 24 18.1 24 12.073z"/>
                </svg>
              )}
              {fbLoading ? "Connecting…" : "Continue with Facebook"}
            </button>

            {/* Divider */}
            <div className="flex items-center gap-3">
              <div className="flex-1 h-px bg-gray-700" />
              <span className="text-xs text-gray-500 uppercase tracking-wider">or</span>
              <div className="flex-1 h-px bg-gray-700" />
            </div>

            {/* Guest */}
            <button
              onClick={() => setStep("guest")}
              className="w-full flex items-center justify-center gap-2 py-3 px-4
                         rounded-xl bg-gray-800 hover:bg-gray-700 border border-gray-600
                         text-gray-200 font-semibold text-sm transition-colors
                         focus:outline-none focus:ring-2 focus:ring-gray-500"
            >
              <span aria-hidden="true">👤</span>
              Continue as Guest
            </button>

            <p className="text-center text-xs text-gray-600 leading-relaxed">
              Guest accounts are stored locally in your browser.
            </p>
          </>
        )}

        {/* ── STEP: guest username ───────────────────────────────────── */}
        {step === "guest" && (
          <>
            <div className="text-center space-y-1 pt-2">
              <span className="text-4xl" aria-hidden="true">👤</span>
              <h2 className="text-xl font-bold text-white">Choose a username</h2>
              <p className="text-sm text-gray-400">
                This is how other players will see you.
              </p>
            </div>

            <form onSubmit={handleGuestSubmit} className="space-y-4" noValidate>
              <div className="space-y-1">
                <label htmlFor="guest-username" className="text-xs font-medium text-gray-400">
                  Username
                </label>
                <input
                  id="guest-username"
                  ref={inputRef}
                  type="text"
                  maxLength={20}
                  value={username}
                  onChange={(e) => { setUsername(e.target.value); setError(""); }}
                  placeholder="e.g. ChessMaster99"
                  className="w-full bg-gray-800 border border-gray-600 rounded-lg
                             px-4 py-2.5 text-white placeholder-gray-500 text-sm
                             focus:outline-none focus:ring-2 focus:ring-blue-500
                             focus:border-transparent transition-colors"
                  aria-describedby={error ? "username-error" : undefined}
                />
                {error && (
                  <p id="username-error" className="text-xs text-red-400 mt-1">
                    {error}
                  </p>
                )}
                <p className="text-xs text-gray-600 text-right">
                  {username.length}/20
                </p>
              </div>

              <button
                type="submit"
                className="w-full py-3 rounded-xl bg-blue-600 hover:bg-blue-500
                           text-white font-semibold text-sm transition-colors
                           focus:outline-none focus:ring-2 focus:ring-blue-400"
              >
                Start Playing
              </button>

              <button
                type="button"
                onClick={() => { setStep("choose"); setError(""); }}
                className="w-full py-2 text-sm text-gray-500 hover:text-gray-300
                           transition-colors focus:outline-none"
              >
                ← Back
              </button>
            </form>
          </>
        )}
      </div>
    </div>
  );
}
