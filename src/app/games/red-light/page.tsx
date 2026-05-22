/**
 * src/app/games/red-light/page.tsx
 *
 * Next.js 14 App Router page for the Red Light / Green Light game.
 *
 * Responsibilities
 * ─────────────────
 *  • Provide Next.js Metadata (title, OG, viewport)
 *  • Dynamically import RedLightGreenLight (no SSR — requires window / Canvas)
 *  • Render a full-screen cinematic wrapper matching the existing design system
 *  • Wire the onExit callback → router.push("/") with a crossfade transition
 *  • Show a deterministic loading skeleton while the game bundle hydrates
 *
 * WHY dynamic import?
 *   RedLightGreenLight accesses `window`, `performance`, `AudioContext`, and
 *   the Canvas API on mount.  Next.js pre-renders pages on the server by
 *   default; all of these APIs are undefined in the Node.js SSR context.
 *   `ssr: false` tells Next.js to only evaluate this module in the browser,
 *   eliminating "window is not defined" build errors without wrapping every
 *   access in typeof-window guards.
 *
 * WHY a dedicated loading skeleton?
 *   The game bundle (~200–350 KB after tree-shaking Howler + Framer Motion) can
 *   take 200–600 ms to parse on a mid-range mobile CPU.  A black screen during
 *   that window reads as "broken".  The skeleton fires immediately from cached
 *   CSS and communicates intentional loading, building player trust before the
 *   first frame.
 */

import type { Metadata } from "next";
import dynamic from "next/dynamic";
import { Suspense } from "react";
import GamePageClient from "./GamePageClient";

// ─── Metadata ─────────────────────────────────────────────────────────────────

export const metadata: Metadata = {
  title: "Red Light, Green Light",
  description:
    "A cinematic survival arcade game. Move only on Green Light. Stop on Red. One mistake — you're out.",
  robots: { index: false, follow: false },
  openGraph: {
    title: "Red Light, Green Light",
    description: "Survive the doll. 60fps browser arcade.",
    type: "website",
  },
};

// ─── Page ─────────────────────────────────────────────────────────────────────

/**
 * Server component shell.  Renders immediately; hands off to the client
 * boundary (GamePageClient) which handles the dynamic import + exit routing.
 *
 * Suspense is required by Next.js App Router when a child uses `use()` or
 * async data.  We include it here as a future-proofing measure and as a clean
 * boundary for the loading skeleton.
 */
export default function RedLightPage() {
  return (
    <Suspense fallback={<LoadingSkeleton />}>
      <GamePageClient />
    </Suspense>
  );
}

// ─── Loading Skeleton ─────────────────────────────────────────────────────────

/**
 * Shown while the client bundle is downloading / parsing.
 * Pure CSS — zero JS execution cost.  Matches the game's dark colour palette
 * so the transition into the game canvas is invisible.
 */
function LoadingSkeleton() {
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
      {/* Pulsing doll silhouette placeholder */}
      <div
        className="animate-pulse-glow"
        style={{
          width: 52,
          height: 52,
          borderRadius: "50%",
          border: "2px solid var(--color-accent)",
          boxShadow: "0 0 32px var(--color-accent-dim)",
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
        Loading…
      </p>
    </div>
  );
}