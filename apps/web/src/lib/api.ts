const BASE = (import.meta.env.VITE_API_URL as string | undefined) ?? "http://localhost:3001";

export async function apiGet<T>(path: string): Promise<T> {
  const res = await fetch(`${BASE}${path}`, { cache: "no-store" });
  if (!res.ok) throw new Error(`GET ${path} → ${res.status}`);
  return res.json() as Promise<T>;
}

/** POST JSON; on a non-2xx, throw the parsed error envelope so callers can show the reason (e.g. ALREADY_CLAIMED). */
export async function apiPost<T>(path: string, body: unknown): Promise<T> {
  const res = await fetch(`${BASE}${path}`, {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify(body),
  });
  const json = (await res.json().catch(() => null)) as unknown;
  if (!res.ok) {
    const code = (json as { error?: { code?: string } } | null)?.error?.code ?? String(res.status);
    throw new Error(code);
  }
  return json as T;
}

export interface InboxEvent {
  workspaceId: string;
  type: "conversation.updated" | "conversation.assigned" | "message.created";
  conversationId: string;
  data?: unknown;
}

/**
 * Subscribe to the live inbox over SSE. Returns an unsubscribe fn. The browser's EventSource auto-reconnects;
 * we re-fetch on every event rather than trusting the payload to be a full snapshot (events are hints, the
 * server is the source of truth — 🔗 the same "events are notifications, not state" rule as Tracer's board).
 */
export function subscribeInbox(workspaceId: string, onEvent: (e: InboxEvent) => void): () => void {
  const es = new EventSource(`${BASE}/events?workspaceId=${encodeURIComponent(workspaceId)}`);
  es.onmessage = (m) => {
    try {
      onEvent(JSON.parse(m.data as string) as InboxEvent);
    } catch {
      /* keep-alive comment lines and malformed frames are ignored */
    }
  };
  return () => es.close();
}
