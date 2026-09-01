/**
 * ProfileButton.jsx
 *
 * Circular avatar button in the top-right of the header.
 *
 * - Logged out : grey circle with "?" — clicking opens AuthModal
 * - Guest      : coloured circle with initials
 * - Facebook   : coloured circle with "FB" badge + initials
 *
 * Props:
 *   onOpenAuth  {Function}  — opens the AuthModal
 *   onOpenMenu  {Function}  — opens the slide menu (hamburger alternative)
 */

import { useAuth } from "../context/AuthContext.jsx";

/* ── Deterministic avatar colour from username ───────────────────────────── */
const AVATAR_COLOURS = [
  "bg-blue-600",   "bg-purple-600", "bg-green-600",
  "bg-rose-600",   "bg-amber-600",  "bg-teal-600",
  "bg-indigo-600", "bg-pink-600",
];

function avatarColour(username) {
  if (!username) return "bg-gray-600";
  let hash = 0;
  for (let i = 0; i < username.length; i++) {
    hash = username.charCodeAt(i) + ((hash << 5) - hash);
  }
  return AVATAR_COLOURS[Math.abs(hash) % AVATAR_COLOURS.length];
}

/* ── Component ───────────────────────────────────────────────────────────── */
export default function ProfileButton({ onOpenAuth }) {
  const { user, isLoggedIn, initials } = useAuth();

  const colour = isLoggedIn ? avatarColour(user?.username) : "bg-gray-700";
  const label  = isLoggedIn ? `Profile: ${user?.username}` : "Sign in";

  return (
    <button
      onClick={onOpenAuth}
      aria-label={label}
      title={label}
      className={[
        "relative w-9 h-9 rounded-full flex items-center justify-center",
        "border-2 border-transparent hover:border-white/30",
        "transition-all duration-200 focus:outline-none focus:ring-2",
        "focus:ring-white/40 shrink-0",
        colour,
      ].join(" ")}
    >
      {/* Initials / placeholder */}
      <span className="text-xs font-bold text-white select-none leading-none">
        {initials}
      </span>

      {/* Provider badge */}
      {user?.provider === "facebook" && (
        <span
          className="absolute -bottom-0.5 -right-0.5 w-3.5 h-3.5 rounded-full
                     bg-blue-500 border border-gray-900 flex items-center
                     justify-center text-white"
          style={{ fontSize: "7px", fontWeight: 700 }}
          aria-hidden="true"
        >
          f
        </span>
      )}

      {/* Online dot for logged-in users */}
      {isLoggedIn && (
        <span
          className="absolute -top-0.5 -right-0.5 w-2.5 h-2.5 rounded-full
                     bg-green-400 border-2 border-gray-900"
          aria-hidden="true"
        />
      )}
    </button>
  );
}
