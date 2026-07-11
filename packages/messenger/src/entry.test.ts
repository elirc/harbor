import { describe, it, expect, vi } from "vitest";
import { boot } from "./entry";
import { PROTOCOL, type WidgetToHost } from "./protocol";

/**
 * Full-loop bridge test (S05), the pure half of the E2E: boot the host integration against a fake iframe and
 * window, then simulate the widget posting messages back and assert the host reacts (resize, open/close). The
 * DB half — widget message → agent inbox → reply → widget — is exercised against the running stack in the
 * deploy demo; here we prove the boundary-crossing wiring without a browser.
 */
function fakeDom() {
  const iframe = {
    style: {} as Record<string, string>,
    src: "",
    title: "",
    setAttribute: vi.fn(),
    contentWindow: { posted: [] as unknown[], postMessage: (m: unknown) => (iframe.contentWindow.posted as unknown[]).push(m) },
  };
  // `style.cssText` is assigned as a whole string in injectWidget; allow it.
  Object.defineProperty(iframe.style, "cssText", { set() {}, configurable: true });
  const listeners: Array<(e: { data: unknown; origin: string }) => void> = [];
  const doc = {
    body: { appendChild: vi.fn() },
    createElement: () => iframe,
  } as unknown as Document;
  const win = {
    addEventListener: (_t: string, fn: (e: { data: unknown; origin: string }) => void) => listeners.push(fn),
    location: { origin: "https://acme.example" },
  } as unknown as Window;
  const emit = (msg: WidgetToHost) => listeners.forEach((fn) => fn({ data: msg, origin: "https://widget.harbor.example" }));
  return { iframe, doc, win, emit };
}

describe("host integration boot (S05)", () => {
  it("wires the bridge and reacts to widget resize/open/close", () => {
    const { iframe, doc, win, emit } = fakeDom();
    const api = boot(doc, win, { workspaceId: "demo-ws", appOrigin: "https://widget.harbor.example" });
    expect(api).not.toBeNull();

    emit({ protocol: PROTOCOL, dir: "widget->host", type: "resize", height: 520 });
    expect(iframe.style.height).toBe("520px");

    emit({ protocol: PROTOCOL, dir: "widget->host", type: "opened" });
    expect(iframe.style.width).toBe("380px");

    emit({ protocol: PROTOCOL, dir: "widget->host", type: "closed" });
    expect(iframe.style.width).toBe("96px");
  });

  it("exposes identify/open/close that post host→widget messages", () => {
    const { iframe, doc, win } = fakeDom();
    const api = boot(doc, win, { workspaceId: "demo-ws", appOrigin: "https://widget.harbor.example" });
    api?.identify({ externalId: "user_42" });
    api?.open();
    const posted = iframe.contentWindow.posted as Array<{ type: string }>;
    expect(posted.map((p) => p.type)).toEqual(["identify", "open"]);
  });
});
