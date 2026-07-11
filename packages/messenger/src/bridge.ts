/**
 * The postMessage bridge (S05). Two thin wrappers over `window.postMessage`: `HostBridge` runs on the
 * customer's page, `WidgetBridge` runs inside our iframe. They exchange the typed envelopes from `protocol.ts`.
 *
 * 📘 How postMessage works: `target.postMessage(data, targetOrigin)` clones `data` into another browsing
 * context and fires a `message` event there. The receiver reads `event.data` (the payload), `event.origin`
 * (the sender's scheme+host+port), and `event.source` (a handle back to the sender's window). Because the two
 * sides are different origins, this is the ONLY way they can communicate — there is no shared DOM or JS scope.
 *
 * We keep the DOM out of these classes: they take a `PostTarget` (anything with `.postMessage`) and are fed
 * `MessageEventLike` objects, so the whole bridge is testable without a browser. The real wiring (a
 * `window.addEventListener("message", …)` and an `iframe.contentWindow`) lives at the edges in `loader.ts` and
 * the widget entry.
 */
import {
  isBridgeMessage,
  isFromHost,
  isFromWidget,
  type HostToWidget,
  type WidgetToHost,
} from "./protocol";

/** The subset of `Window`/`MessagePort` we use to send. */
export interface PostTarget {
  postMessage(message: unknown, targetOrigin: string): void;
}

/** The subset of the `message` DOM event we read. */
export interface MessageEventLike {
  data: unknown;
  origin: string;
  source?: unknown;
}

type Handler<M> = (msg: M) => void;

/**
 * 🔒 Bridge options (S13, harvest of flaw #2). S05 shipped the bridge with NO origin check and `targetOrigin:
 * "*"` — any page could drive the widget and our messages leaked to any origin. Now every side declares who it
 * trusts (`allowedOrigins`) and exactly where it posts (`targetOrigin`, never "*").
 */
export interface BridgeOptions {
  /** Origins permitted to send us messages. A message from any other origin is dropped. */
  allowedOrigins: readonly string[];
  /** The single origin we post TO. Never "*" — that broadcasts to every listener, including hostile ones. */
  targetOrigin: string;
}

/** Is this origin on the allowlist? `"*"` allows all (discouraged — the whole point is to not do this). */
export function isOriginAllowed(origin: string, allowed: readonly string[]): boolean {
  return allowed.includes("*") || allowed.includes(origin);
}

/** Runs on the HOST page: sends host→widget, receives widget→host (resize, unread, ready…). */
export class HostBridge {
  private readonly handlers = new Set<Handler<WidgetToHost>>();
  constructor(private readonly widget: PostTarget, private readonly opts: BridgeOptions) {}

  onWidgetMessage(fn: Handler<WidgetToHost>): () => void {
    this.handlers.add(fn);
    return () => this.handlers.delete(fn);
  }

  /** Feed this the page's `message` events. */
  receive(event: MessageEventLike): void {
    if (!isOriginAllowed(event.origin, this.opts.allowedOrigins)) return; // 🔒 verify WHO is talking, first
    if (!isBridgeMessage(event.data)) return; // ignore unrelated postMessage traffic by shape
    if (!isFromWidget(event.data)) return; // only accept the widget→host direction here
    for (const fn of this.handlers) fn(event.data);
  }

  send(msg: HostToWidget): void {
    this.widget.postMessage(msg, this.opts.targetOrigin);
  }
}

/** Runs INSIDE the iframe: sends widget→host (resize/unread/ready), receives host→widget (identify/open/close). */
export class WidgetBridge {
  private readonly handlers = new Set<Handler<HostToWidget>>();
  constructor(private readonly host: PostTarget, private readonly opts: BridgeOptions) {}

  onHostMessage(fn: Handler<HostToWidget>): () => void {
    this.handlers.add(fn);
    return () => this.handlers.delete(fn);
  }

  /** Feed this the iframe's `message` events. */
  receive(event: MessageEventLike): void {
    if (!isOriginAllowed(event.origin, this.opts.allowedOrigins)) return; // 🔒 a forged message from a hostile origin stops here
    if (!isBridgeMessage(event.data)) return; // ignore unrelated postMessage traffic by shape
    if (!isFromHost(event.data)) return; // only accept the host→widget direction here
    for (const fn of this.handlers) fn(event.data);
  }

  send(msg: WidgetToHost): void {
    this.host.postMessage(msg, this.opts.targetOrigin);
  }
}
