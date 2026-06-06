"use client";

import React, { Component, type ErrorInfo, type ReactNode } from "react";

interface Props {
  children: ReactNode;
}

interface State {
  hasError: boolean;
  error: Error | null;
}

/**
 * Global Error Boundary — catches runtime crashes in the React tree
 * and shows a recovery UI instead of a blank black screen.
 *
 * Without this, any uncaught error silently unmounts the entire app,
 * leaving only the <body> background visible (black).
 */
export class ErrorBoundary extends Component<Props, State> {
  constructor(props: Props) {
    super(props);
    this.state = { hasError: false, error: null };
  }

  static getDerivedStateFromError(error: Error): State {
    return { hasError: true, error };
  }

  componentDidCatch(error: Error, errorInfo: ErrorInfo): void {
    console.error("[ErrorBoundary] Caught:", error, errorInfo);
  }

  render(): ReactNode {
    if (this.state.hasError) {
      return (
        <div
          style={{
            width: "100vw",
            height: "100dvh",
            display: "flex",
            flexDirection: "column",
            alignItems: "center",
            justifyContent: "center",
            gap: "1.5rem",
            background: "#060608",
            color: "#f5f5f5",
            fontFamily:
              "var(--font-mono, 'JetBrains Mono', 'Fira Mono', monospace)",
            textAlign: "center",
            padding: "2rem",
          }}
        >
          <div
            style={{
              fontSize: "3rem",
              color: "#ed1b76",
              fontWeight: 900,
              letterSpacing: "0.2em",
              fontFamily:
                "var(--font-display, 'Rajdhani', sans-serif)",
              textTransform: "uppercase",
            }}
          >
            ■ SYSTEM ERROR
          </div>
          <div
            style={{
              fontSize: "0.75rem",
              letterSpacing: "0.15em",
              color: "rgba(245,245,245,0.45)",
              maxWidth: "500px",
              lineHeight: 1.7,
            }}
          >
            {this.state.error?.message || "An unexpected error occurred."}
          </div>
          <button
            onClick={() => {
              this.setState({ hasError: false, error: null });
              window.location.reload();
            }}
            style={{
              marginTop: "1rem",
              padding: "12px 28px",
              background: "transparent",
              border: "2px solid #ed1b76",
              color: "#ed1b76",
              fontFamily:
                "var(--font-display, 'Rajdhani', sans-serif)",
              fontSize: "1rem",
              fontWeight: 700,
              letterSpacing: "0.2em",
              textTransform: "uppercase",
              cursor: "pointer",
              borderRadius: 0,
              transition: "all 0.15s",
            }}
            onMouseEnter={(e) => {
              e.currentTarget.style.background = "#ed1b76";
              e.currentTarget.style.color = "#000";
            }}
            onMouseLeave={(e) => {
              e.currentTarget.style.background = "transparent";
              e.currentTarget.style.color = "#ed1b76";
            }}
          >
            ● RETRY
          </button>
        </div>
      );
    }

    return this.props.children;
  }
}
