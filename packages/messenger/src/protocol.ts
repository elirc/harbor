/**
 * The messenger wire protocol (S05). The host page and the iframe widget live in DIFFERENT origins and cannot
 * touch each other's DOM or JS — the only channel between them is `window.postMessage`, which carries plain
 * structured-cloneable data. So we define an explicit, typed envelope for that channel. Keeping it pure (no
 * DOM) means the whole protocol is unit-testable without a browser.
 *
 * 🔗 The reverse of the S03 email lesson: there we *received* messy structured data; here we *design* the
 * structure, so we get to make it clean. A namespaced envelope also lets a page that hosts several widgets (or
 * other libraries also using postMessage) tell whose message is whose.
 */

/** Every Harbor message carries this tag so unrelated postMessage traffic is ignored by shape. */
export const PROTOCOL = "harbor-messenger/1" as const;

// Host → widget (the page tells the widget something)
export type HostToWidget =
  | { protocol: typeof PROTOCOL; dir: "host->widget"; type: "identify"; user: IdentifyPayload }
  | { protocol: typeof PROTOCOL; dir: "host->widget"; type: "open" }
  | { protocol: typeof PROTOCOL; dir: "host->widget"; type: "close" }
  | { protocol: typeof PROTOCOL; dir: "host->widget"; type: "host-info"; url: string };

// Widget → host (the widget asks the page to do something only the page can do)
export type WidgetToHost =
  | { protocol: typeof PROTOCOL; dir: "widget->host"; type: "ready" }
  | { protocol: typeof PROTOCOL; dir: "widget->host"; type: "resize"; height: number }
  | { protocol: typeof PROTOCOL; dir: "widget->host"; type: "unread"; count: number }
  | { protocol: typeof PROTOCOL; dir: "widget->host"; type: "opened" }
  | { protocol: typeof PROTOCOL; dir: "widget->host"; type: "closed" };

export type BridgeMessage = HostToWidget | WidgetToHost;

export interface IdentifyPayload {
  /** A stable id for the end-user in the HOST's system (email, user id…). Optional → stays anonymous. */
  externalId?: string;
  email?: string;
  name?: string;
}

/** A message is ours only if it's an object literally tagged with our protocol constant. */
export function isBridgeMessage(data: unknown): data is BridgeMessage {
  return typeof data === "object" && data !== null && (data as { protocol?: unknown }).protocol === PROTOCOL;
}

export function isFromHost(msg: BridgeMessage): msg is HostToWidget {
  return msg.dir === "host->widget";
}
export function isFromWidget(msg: BridgeMessage): msg is WidgetToHost {
  return msg.dir === "widget->host";
}
