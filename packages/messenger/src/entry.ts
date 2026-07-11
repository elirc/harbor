/**
 * The loader ENTRY (S05) — the code that actually runs when a customer's page loads `widget.js`. It reads the
 * script tag's config, injects the iframe, and wires a `HostBridge` so the page can react to the widget
 * (resize, unread) and drive it (`identify`). This is the thin DOM edge; all the logic it uses is the pure,
 * tested code in this package. Rule 2 from the loader: it must never throw into the host page.
 */
import { injectWidget, type LoaderConfig } from "./loader";
import { HostBridge } from "./bridge";
import { PROTOCOL, type IdentifyPayload } from "./protocol";

/** The tiny public surface we attach to the host page as `window.Harbor`. */
export interface HarborWidget {
  identify(user: IdentifyPayload): void;
  open(): void;
  close(): void;
}

export function boot(doc: Document, win: Window, config: LoaderConfig): HarborWidget | null {
  const iframe = injectWidget(doc, config);
  if (!iframe || !iframe.contentWindow) return null;
  const bridge = new HostBridge(iframe.contentWindow);

  // React to the widget's requests. The widget owns its size; the host just applies it.
  bridge.onWidgetMessage((m) => {
    if (m.type === "resize") iframe.style.height = `${m.height}px`;
    if (m.type === "opened") iframe.style.width = "380px";
    if (m.type === "closed") iframe.style.width = "96px";
  });
  win.addEventListener("message", (e) => bridge.receive(e));

  return {
    identify: (user) => bridge.send({ protocol: PROTOCOL, dir: "host->widget", type: "identify", user }),
    open: () => bridge.send({ protocol: PROTOCOL, dir: "host->widget", type: "open" }),
    close: () => bridge.send({ protocol: PROTOCOL, dir: "host->widget", type: "close" }),
  };
}

/** Auto-boot from the `<script data-workspace data-app-origin>` tag that loaded us. Never throws. */
export function autoBoot(): void {
  try {
    const script = document.currentScript as HTMLScriptElement | null;
    const workspaceId = script?.dataset.workspace;
    const appOrigin = script?.dataset.appOrigin ?? window.location.origin;
    if (!workspaceId) return; // misconfigured tag → no widget, but no error on the host page
    const api = boot(document, window, { workspaceId, appOrigin });
    if (api) (window as unknown as { Harbor?: HarborWidget }).Harbor = api;
  } catch {
    /* rule 2: a guest never crashes the host */
  }
}
