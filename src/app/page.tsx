// src/app/page.tsx
"use client";
import GameRouter from "@/components/layout/GameRouter";

export default function Page() {
  return (
    <main style={{ width: "100%", height: "100%", position: "relative", overflow: "hidden", background: "#000" }}>
      <GameRouter />
    </main>
  );
}