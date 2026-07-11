import { describe, it, expect, vi } from "vitest";
import { HostBridge, WidgetBridge, isOriginAllowed, type MessageEventLike, type PostTarget } from "./bridge";
import { PROTOCOL, isBridgeMessage, type WidgetToHost, type HostToWidget } from "./protocol";

const HOST_ORIGIN = "https://acme.example";
const APP_ORIGIN = "https://widget.harbor.example";

function fakeTarget(): PostTarget & { sent: Array<{ message: unknown; targetOrigin: string }> } {
  const sent: Array<{ message: unknown; targetOrigin: string }> = [];
  return { sent, postMessage: (message, targetOrigin) => sent.push({ message, targetOrigin }) };
}
const ev = (data: unknown, origin: string): MessageEventLike => ({ data, origin });

describe("protocol envelope (S05)", () => {
  it("recognizes only its own tagged messages", () => {
    expect(isBridgeMessage({ protocol: PROTOCOL, dir: "widget->host", type: "ready" })).toBe(true);
    expect(isBridgeMessage({ type: "ready" })).toBe(false);
    expect(isBridgeMessage(null)).toBe(false);
  });
});

describe("origin allowlist (S13, flaw #2 harvest)", () => {
  it("allows listed origins, rejects others, and treats '*' as allow-all", () => {
    expect(isOriginAllowed(HOST_ORIGIN, [HOST_ORIGIN])).toBe(true);
    expect(isOriginAllowed("https://evil.example", [HOST_ORIGIN])).toBe(false);
    expect(isOriginAllowed("https://anything.example", ["*"])).toBe(true);
  });
});

describe("HostBridge (S05 + S13)", () => {
  it("delivers widget→host messages from an allowed origin, drops wrong direction / unrelated traffic", () => {
    const widget = fakeTarget();
    const bridge = new HostBridge(widget, { allowedOrigins: [APP_ORIGIN], targetOrigin: APP_ORIGIN });
    const seen: WidgetToHost[] = [];
    bridge.onWidgetMessage((m) => seen.push(m));

    bridge.receive(ev({ protocol: PROTOCOL, dir: "widget->host", type: "resize", height: 480 }, APP_ORIGIN));
    bridge.receive(ev({ hello: "world" }, APP_ORIGIN)); // not ours
    bridge.receive(ev({ protocol: PROTOCOL, dir: "host->widget", type: "open" }, APP_ORIGIN)); // wrong direction
    expect(seen).toEqual([{ protocol: PROTOCOL, dir: "widget->host", type: "resize", height: 480 }]);
  });

  it("sends to the configured origin, never '*'", () => {
    const widget = fakeTarget();
    new HostBridge(widget, { allowedOrigins: [APP_ORIGIN], targetOrigin: APP_ORIGIN }).send({ protocol: PROTOCOL, dir: "host->widget", type: "open" });
    expect(widget.sent[0]?.targetOrigin).toBe(APP_ORIGIN);
    expect(widget.sent[0]?.targetOrigin).not.toBe("*");
  });
});

describe("WidgetBridge forgery probe (S13, flaw #2 harvest)", () => {
  it("DROPS a well-formed message from a hostile origin", () => {
    const host = fakeTarget();
    const bridge = new WidgetBridge(host, { allowedOrigins: [HOST_ORIGIN], targetOrigin: HOST_ORIGIN });
    const seen: HostToWidget[] = [];
    bridge.onHostMessage((m) => seen.push(m));

    // A perfectly-shaped identify message — but from evil.example, not the installed host. Pre-S13 this drove
    // the widget (impersonating a user). Now the origin check stops it before dispatch.
    bridge.receive(ev({ protocol: PROTOCOL, dir: "host->widget", type: "identify", user: { externalId: "victim" } }, "https://evil.example"));
    expect(seen).toHaveLength(0); // forged message rejected

    // The same message from the legitimate host is delivered.
    bridge.receive(ev({ protocol: PROTOCOL, dir: "host->widget", type: "identify", user: { externalId: "u_1" } }, HOST_ORIGIN));
    expect(seen[0]).toMatchObject({ type: "identify", user: { externalId: "u_1" } });
  });

  it("unsubscribes cleanly", () => {
    const host = fakeTarget();
    const bridge = new WidgetBridge(host, { allowedOrigins: [HOST_ORIGIN], targetOrigin: HOST_ORIGIN });
    const fn = vi.fn();
    const off = bridge.onHostMessage(fn);
    off();
    bridge.receive(ev({ protocol: PROTOCOL, dir: "host->widget", type: "open" }, HOST_ORIGIN));
    expect(fn).not.toHaveBeenCalled();
  });
});
