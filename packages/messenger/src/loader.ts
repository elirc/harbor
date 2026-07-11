/**
 * The loader (S05). This is the ONE script a customer pastes into their site:
 *
 *   <script async src="https://cdn.harbor.example/widget.js" data-workspace="ws_123"></script>
 *
 * Its whole job is to inject an iframe and get out of the way. Two hard rules for code that runs on strangers'
 * pages (🔗 Pulse S3's SDK discipline):
 *   1. **Tiny + async.** The loader must not block the host's render. Budget: < 30KB (gated in CI). The heavy
 *      widget UI lives INSIDE the iframe and loads lazily — a two-tier size strategy: a featherweight loader,
 *      a full app behind it.
 *   2. **Never throw.** A crash in someone else's page is their bug report and our churn. Every entry point is
 *      wrapped so a failure degrades to "no widget," never to a broken host page.
 *
 * 📘 Why an iframe and not inline DOM? Isolation. Inside an iframe our CSS can't leak onto their checkout
 * button and their global `$` can't break our widget. The cost is this postMessage plumbing — worth it when
 * you can't predict the host environment (ADR-0005).
 */
import { PROTOCOL } from "./protocol";

export interface LoaderConfig {
  workspaceId: string;
  /** Origin that serves the iframe app; the loader points the iframe here and (later) checks messages against it. */
  appOrigin: string;
}

/** Build the iframe `src` for a workspace. Pure so it's testable. */
export function widgetIframeSrc(config: LoaderConfig): string {
  const u = new URL("/widget", config.appOrigin);
  u.searchParams.set("ws", config.workspaceId);
  u.searchParams.set("v", PROTOCOL);
  return u.toString();
}

/**
 * Inject the widget iframe into the host document. Thin DOM edge (verified by typecheck/build, not unit tests).
 * Wrapped so it can never throw into the host page — rule 2.
 */
export function injectWidget(doc: Document, config: LoaderConfig): HTMLIFrameElement | null {
  try {
    const iframe = doc.createElement("iframe");
    iframe.src = widgetIframeSrc(config);
    iframe.title = "Harbor messenger";
    iframe.setAttribute("aria-label", "Customer support chat");
    // Visual containment; the widget requests real dimensions via a `resize` bridge message.
    iframe.style.cssText = "position:fixed;bottom:16px;right:16px;width:96px;height:96px;border:0;z-index:2147483000;color-scheme:normal;";
    doc.body.appendChild(iframe);
    return iframe;
  } catch {
    // Degrade to "no widget" — never surface an error on the host page.
    return null;
  }
}
