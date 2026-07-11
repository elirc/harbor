import { useState, type CSSProperties } from "react";

/**
 * A rendered email message (S03). Shows the display-stripped body by default; "show original" reveals the
 * untouched raw MIME. 🔍 The toggle is both UX (a clean thread) and a debugging tool (when stripping guesses
 * wrong, the original is one click away) — because we display-strip but store-raw, imperfection is recoverable.
 */
export function MessageView({ parsed, raw }: { parsed: string; raw: string }) {
  const [showOriginal, setShowOriginal] = useState(false);
  return (
    <div style={box}>
      {showOriginal ? <pre style={pre}>{raw}</pre> : <div style={{ whiteSpace: "pre-wrap" }}>{parsed}</div>}
      <button style={toggle} onClick={() => setShowOriginal((v) => !v)}>
        {showOriginal ? "show stripped" : "show original"}
      </button>
    </div>
  );
}

const box: CSSProperties = { border: "1px solid #232a32", borderRadius: 10, padding: 12, marginBottom: 8 };
const pre: CSSProperties = { whiteSpace: "pre-wrap", fontSize: 12, color: "#8b93a1", overflowX: "auto" };
const toggle: CSSProperties = { marginTop: 8, background: "transparent", color: "#7c8794", border: "1px solid #232a32", borderRadius: 6, padding: "3px 8px", cursor: "pointer", fontSize: 11 };
