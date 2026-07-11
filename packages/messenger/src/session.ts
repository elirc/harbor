/**
 * Messenger session state (S05) — pure, so the anonymous→identified upgrade is testable without a browser or a
 * DB. A widget conversation starts ANONYMOUS: we mint a random session id, and any messages belong to that
 * session. When the host calls `identify()`, the same session upgrades to a known contact, and everything said
 * while anonymous is retroactively attributed to them.
 *
 * 🔗 The anonymous-then-identify arc, third appearance (Pulse's web SDK, Tracer's offline id, now the
 * messenger). The lesson each time: don't force identity up front; let people talk first, attribute later.
 */
export type SessionStatus = "anonymous" | "identified";

export interface SessionState {
  sessionId: string;
  status: SessionStatus;
  externalId: string | null;
  unread: number;
  open: boolean;
}

export function newSession(sessionId: string): SessionState {
  return { sessionId, status: "anonymous", externalId: null, unread: 0, open: false };
}

/** Upgrade an anonymous session to identified. Idempotent; re-identifying with a new id re-points it. */
export function identify(state: SessionState, externalId: string): SessionState {
  if (!externalId) return state; // empty id → stay anonymous (see IdentifyPayload)
  return { ...state, status: "identified", externalId };
}

/** Opening the widget clears unread (you're looking at it now). */
export function open(state: SessionState): SessionState {
  return { ...state, open: true, unread: 0 };
}
export function close(state: SessionState): SessionState {
  return { ...state, open: false };
}

/** A new inbound agent message bumps unread ONLY while the widget is closed. */
export function receiveAgentMessage(state: SessionState): SessionState {
  return state.open ? state : { ...state, unread: state.unread + 1 };
}
