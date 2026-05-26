"use client";

import React from "react";

interface DalgonaCandyProps {
  onExit?: () => void;
}

export default function DalgonaCandy({ onExit }: DalgonaCandyProps) {
  return (
    <div style={{ position: "relative", width: "100%", height: "100%" }}>
      {/* Back Button overlay so you can escape the iframe */}
      {onExit && (
        <button 
          onClick={onExit}
          style={{
            position: "absolute",
            top: 16,
            left: 16,
            zIndex: 50,
            padding: "8px 16px",
            background: "#ed1b76", // Squid Game Pink
            color: "#fff",
            border: "4px solid #000",
            fontFamily: "'Courier New', monospace",
            fontWeight: 900,
            cursor: "pointer",
            textTransform: "uppercase"
          }}
        >
          ◀ MENU
        </button>
      )}

      <iframe 
        src="/dalgona.html" 
        style={{ width: '100%', height: '100vh', border: 'none', display: 'block' }}
        title="Dalgona Candy Game"
      />
    </div>
  );
}