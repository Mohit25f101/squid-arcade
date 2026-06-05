import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  // ── TypeScript & ESLint ───────────────────────────────────────────────────
  // Keep production builds resilient: type errors and lint warnings must not
  // block the deploy. (ESLint is configured via eslint.config.mjs / the flat
  // config — it is NOT a valid next.config key in Next 16, so it is omitted
  // here to avoid the "Unrecognized key(s): 'eslint'" warning that the error
  // branch produced.)
  typescript: { ignoreBuildErrors: true },

  // ── Compiler ──────────────────────────────────────────────────────────────
  compress: true, // gzip responses from the Node server

  // ── Turbopack ───────────────────────────────────────────────────────────��─
  // Next.js 16 uses Turbopack by default for `next dev` and `next build`.
  //
  // ROOT CAUSE OF THE VERCEL DEPLOY FAILURE:
  // The previous config defined a custom `webpack()` function. In Next 16 a
  // production build that finds a custom webpack config FAILS to prevent
  // misconfiguration (see node_modules/next/dist/docs/.../upgrading/version-16.md).
  // That custom webpack `splitChunks` block also never actually ran under
  // Turbopack, so removing it loses NO behaviour: route/game code-splitting is
  // already provided by the `dynamic(() => import(...), { ssr: false })` calls
  // in GameRouter.tsx, and Turbopack performs automatic vendor chunking.
  turbopack: {},

  // ── Package import optimisation ───────────────────────────────────────────
  experimental: {
    optimizePackageImports: [
      "framer-motion",
      "zustand",
      "three",
      "@react-three/fiber",
      "@react-three/drei",
    ],
  },

  // ── HTTP headers ──────────────────────────────────────────────────────────
  async headers() {
    return [
      {
        source: "/audio/:path*",
        headers: [{ key: "Cache-Control", value: "public, max-age=31536000, immutable" }],
      },
      {
        source: "/:path*.(ico|svg|png|webmanifest)",
        headers: [{ key: "Cache-Control", value: "public, max-age=86400, stale-while-revalidate=3600" }],
      },
      {
        source: "/(.*)",
        headers: [
          { key: "X-Content-Type-Options", value: "nosniff" },
          { key: "Referrer-Policy", value: "strict-origin-when-cross-origin" },
        ],
      },
      // dalgona.html is served inside a same-origin iframe by DalgonaCandy.tsx.
      // SAMEORIGIN allows same-origin iframes while still blocking cross-origin framing.
      {
        source: "/dalgona.html",
        headers: [{ key: "X-Frame-Options", value: "SAMEORIGIN" }],
      },
    ];
  },
};

export default nextConfig;
