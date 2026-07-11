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

/** Runs on the HOST page: sends host→widget, receives widget→host (resize, unread, ready…). */
export class HostBridge {
  private readonly handlers = new Set<Handler<WidgetToHost>>();
  constructor(private readonly widget: PostTarget) {}

  onWidgetMessage(fn: Handler<WidgetToHost>): () => void {
    this.handlers.add(fn);
    return () => this.handlers.delete(fn);
  }

  /** Feed this the page's `message` events. */
  receive(event: MessageEventLike): void {
    if (!isBridgeMessage(event.data)) return; // ignore unrelated postMessage traffic by shape
    if (!isFromWidget(event.data)) return; // only accept the widget→host direction here
    for (const fn of this.handlers) fn(event.data);
  }

  send(msg: HostToWidget): void {
    this.widget.postMessage(msg, "*");
  }
}

/** Runs INSIDE the iframe: sends widget→host (resize/unread/ready), receives host→widget (identify/open/close). */
export class WidgetBridge {
  private readonly handlers = new Set<Handler<HostToWidget>>();
  constructor(private readonly host: PostTarget) {}

  onHostMessage(fn: Handler<HostToWidget>): () => void {
    this.handlers.add(fn);
    return () => this.handlers.delete(fn);
  }

  /** Feed this the iframe's `message` events. */
  receive(event: MessageEventLike): void {
    if (!isBridgeMessage(event.data)) return; // ignore unrelated postMessage traffic by shape
    if (!isFromHost(event.data)) return; // only accept the host→widget direction here
    for (const fn of this.handlers) fn(event.data);
  }

  send(msg: WidgetToHost): void {
    this.host.postMessage(msg, "*");
  }
}
