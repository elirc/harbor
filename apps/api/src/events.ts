/**
 * A tiny in-process event bus for the real-time inbox (S04). Emits conversation/message events to SSE
 * subscribers. Fast-forwarded from Tracer/Pulse's SSE pattern; in production this fans out via Redis across
 * instances, but the shape (subscribe, publish, per-workspace filter) is the same.
 */
export interface InboxEvent {
  workspaceId: string;
  type: "conversation.updated" | "conversation.assigned" | "message.created";
  conversationId: string;
  data?: unknown;
}

type Listener = (e: InboxEvent) => void;

export class EventBus {
  private readonly listeners = new Set<Listener>();
  subscribe(fn: Listener): () => void {
    this.listeners.add(fn);
    return () => this.listeners.delete(fn);
  }
  publish(e: InboxEvent): void {
    for (const fn of this.listeners) fn(e);
  }
}

export const bus = new EventBus();
