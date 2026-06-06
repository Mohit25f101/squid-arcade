"use client";

import React from "react";
import { getLeaderboard } from "@/lib/Leaderboard";

interface LeaderboardProps {
  onBack: () => void;
  highlightSession?: string | null;
}

export default function Leaderboard({ onBack, highlightSession }: LeaderboardProps) {
  const entries = getLeaderboard();

  return (
    <div style={{
      position: "fixed",
      inset: 0,
      background: "var(--sq-darker, #050508)",
      display: "flex",
      flexDirection: "column",
      alignItems: "center",
      justifyContent: "center",
      color: "#fff",
      padding: "2rem",
      zIndex: 1000,
    }}>
      <div
        className="absolute inset-0"
        style={{
          backgroundImage: `linear-gradient(rgba(255,0,102,0.03) 1px, transparent 1px), linear-gradient(90deg, rgba(255,0,102,0.03) 1px, transparent 1px)`,
          backgroundSize: '40px 40px',
        }}
      />
      <div
        className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-96 h-96 rounded-full pointer-events-none"
        style={{ background: 'radial-gradient(circle, rgba(0,255,178,0.08), transparent)', filter: 'blur(40px)' }}
      />

      <div className="relative glass-dark p-8 rounded-2xl w-full max-w-3xl" style={{ border: "1px solid rgba(0,255,178,0.2)" }}>
        <h2 className="font-bebas text-5xl text-center mb-8" style={{ color: "var(--sq-teal, #00FFB2)", letterSpacing: "0.1em" }}>
          LEADERBOARD
        </h2>

        {entries.length === 0 ? (
          <p className="font-mono-sq text-center text-white/50 py-12">No scores yet</p>
        ) : (
          <div style={{
            maxHeight: "50vh",
            overflowY: "auto",
            width: "100%",
          }} className="no-scrollbar">
            <table style={{ width: "100%", borderCollapse: "collapse" }} className="font-mono-sq text-sm">
              <thead>
                <tr style={{ borderBottom: "1px solid rgba(255,255,255,0.1)", color: "var(--sq-teal, #00FFB2)" }}>
                  <th style={{ padding: "1rem", textAlign: "left", fontWeight: "normal" }}>RANK</th>
                  <th style={{ padding: "1rem", textAlign: "left", fontWeight: "normal" }}>NAME</th>
                  <th style={{ padding: "1rem", textAlign: "right", fontWeight: "normal" }}>SCORE</th>
                  <th style={{ padding: "1rem", textAlign: "right", fontWeight: "normal" }}>SURVIVED</th>
                  <th style={{ padding: "1rem", textAlign: "right", fontWeight: "normal" }}>BEST</th>
                </tr>
              </thead>
              <tbody>
                {entries.map((entry, idx) => {
                  const isHighlighted = entry.sessionId === highlightSession;
                  return (
                    <tr
                      key={`${entry.sessionId}-${idx}`}
                      style={{
                        borderBottom: "1px solid rgba(255,255,255,0.05)",
                        background: isHighlighted ? "rgba(255,0,102,0.1)" : "transparent",
                        color: isHighlighted ? "var(--sq-pink, #FF0066)" : "rgba(255,255,255,0.8)",
                      }}
                    >
                      <td style={{ padding: "1rem", textAlign: "left" }} className="font-bebas text-xl">{idx + 1}</td>
                      <td style={{ padding: "1rem", textAlign: "left" }}>{entry.name}</td>
                      <td style={{ padding: "1rem", textAlign: "right" }} className="font-bebas text-lg">{entry.totalScore}</td>
                      <td style={{ padding: "1rem", textAlign: "right" }}>{entry.gamesSurvived}</td>
                      <td style={{ padding: "1rem", textAlign: "right" }}>{entry.bestSingleGame}</td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}

        <div className="flex justify-center mt-8">
          <button
            onClick={onBack}
            className="font-bebas tracking-widest px-8 py-3 rounded transition-all"
            style={{
              background: "transparent",
              border: "1px solid var(--sq-teal, #00FFB2)",
              color: "var(--sq-teal, #00FFB2)",
              fontSize: "1.2rem",
            }}
            onMouseEnter={(e) => {
              e.currentTarget.style.background = "var(--sq-teal, #00FFB2)";
              e.currentTarget.style.color = "#000";
              e.currentTarget.style.boxShadow = "0 0 15px rgba(0,255,178,0.4)";
            }}
            onMouseLeave={(e) => {
              e.currentTarget.style.background = "transparent";
              e.currentTarget.style.color = "var(--sq-teal, #00FFB2)";
              e.currentTarget.style.boxShadow = "none";
            }}
          >
            RETURN TO MENU
          </button>
        </div>
      </div>
    </div>
  );
}
