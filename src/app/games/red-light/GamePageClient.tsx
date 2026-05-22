/**
 * src/app/games/red-light/GamePageClient.tsx
 *
 * "use client" boundary for the Red Light / Green Light game page.
 *
 * Separated from page.tsx so that the server component (page.tsx) can export
 * Metadata while this file owns all browser-side state and effects.
 *
 * Architecture notes
 * ───────────────────
 *  • `dynamic(..., { ssr: false })` — prevents Canvas / Web Audio SSR errors.
 *  • `useRouter` for the exit transition — soft navigation preserves the
 *    Next.js client router cache; the root page is never re-fetched from the
 *    server on exit.
 *  • `isExiting` state triggers a Framer Motion crossfade before navigation,
 *    giving the player a clean visual farewell rather than an abrupt cut.
 *  • The scanlines overlay is applied here (CSS class from globals.css) so it
 *    sits above the Canvas layer without requiring a Canvas draw call.
 */

"use client";

import React, { useCallback, useState } from "react";
import dynamic from "next/dynamic";
import { useRouter } from "next/navigation";
import { motion, AnimatePresence } from "framer-motion";

// ─── Dynamic Import ───────────────────────────────────────────────────────────

/**
 * WHY ssr: false?
 *   RedLightGreenLight.tsx uses:
 *     – HTMLCanvasElement API      (undefined in Node.js)
 *     – window.performance.now()  (undefined in Node.js)
 *     – AudioContext / Howler.js   (undefined in Node.js)
 *     – ResizeObserver             (undefined in Node.js)
 *   Disabling SSR means Next.js skips server-rendering this subtree entirely.
 *   The Suspense fallback in page.tsx covers the loading window.
 *
 * WHY a named loading spinner here too?
 *   `dynamic` has its own loading prop for the intra-component load state
 *   (distinct from Suspense).  Providing it ensures no flash of undefined
 *   between Suspense resolving and the dynamic module evaluating.
 */
const RedLightGreenLight = dynamic(
  () => import('../../../components/games/RedLightGreenLight'),
  { ssr: false }
);

// ─── Component ────────────────────────────────────────────────────────────────

export default function GamePageClient() {
  const router = useRouter();
  const [isExiting, setIsExiting] = useState(false);

  /**
   * Called by RedLightGreenLight when the player presses the EXIT button on
   * the Game Over / Victory overlay.
   *
   * Flow:
   *  1. Set isExiting → true  → triggers fade-out animation
   *  2. After animation completes (400 ms) → router.push("/")
   *
   * WHY the delay?
   *   Without it, React immediately unmounts the canvas on navigation,
   *   producing a jarring black flash.  The 400 ms matches the exit motion
   *   duration and lets the animation complete before DOM teardown.
   */
  const handleExit = useCallback(() => {
    setIsExiting(true);
    setTimeout(() => {
      router.push("/");
    }, 400);
  }, [router]);

  return (
    <>
      {/*
       * Full-screen cinematic wrapper.
       * – position fixed keeps it above any root layout chrome.
       * – scanlines class applies the subtle CRT overlay from globals.css.
       * – background matches C.bg0 (#050810) so no visible seam when the
       *   Canvas initialises.
       */}
      <AnimatePresence mode="wait">
        {!isExiting ? (
          <motion.div
            key="game"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            transition={{ duration: 0.35, ease: [0.16, 1, 0.3, 1] }}
            style={{
              position: "fixed",
              inset: 0,
              background: "#050810",
              overflow: "hidden",
            }}
            className="scanlines"
          >
            <RedLightGreenLight onExit={handleExit} />
          </motion.div>
        ) : (
          /*
           * Fade-to-black exit screen.
           * key="exit" keeps AnimatePresence from recycling the same DOM node,
           * ensuring the exit animation fires independently of the game unmount.
           */
          <motion.div
            key="exit"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            transition={{ duration: 0.38 }}
            style={{
              position: "fixed",
              inset: 0,
              background: "#000",
            }}
          />
        )}
      </AnimatePresence>
    </>
  );
}

// ─── Inline Loader ────────────────────────────────────────────────────────────

/**
 * Shown only during the dynamic() bundle load window — typically < 100 ms on
 * a warm cache.  Matches the skeleton in page.tsx so there is no visual jump
 * if Suspense resolves before dynamic() finishes evaluating.
 */
function InlineLoader() {
  return (
    <div
      style={{
        position: "fixed",
        inset: 0,
        background: "#050810",
        display: "flex",
        flexDirection: "column",
        alignItems: "center",
        justifyContent: "center",
        gap: 20,
      }}
    >
      <div
        className="animate-pulse-glow"
        style={{
          width: 48,
          height: 48,
          borderRadius: "50%",
          border: "2px solid var(--color-accent)",
          boxShadow: "0 0 28px var(--color-accent-dim)",
        }}
      />
      <p
        style={{
          fontFamily: "var(--font-mono)",
          fontSize: 11,
          letterSpacing: "0.28em",
          color: "var(--color-accent)",
          textTransform: "uppercase",
          margin: 0,
        }}
      >
        Initialising…
      </p>
    </div>
  );
}