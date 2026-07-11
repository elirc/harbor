import { describe, it, expect, vi } from "vitest";
import { HostBridge, WidgetBridge, type MessageEventLike, type PostTarget } from "./bridge";
import { PROTOCOL, isBridgeMessage, type WidgetToHost, type HostToWidget } from "./protocol";

function fakeTarget(): PostTarget & { sent: Array<{ message: unknown; targetOrigin: string }> } {
  const sent: Array<{ message: unknown; targetOrigin: string }> = [];
  return { sent, postMessage: (message, targetOrigin) => sent.push({ message, targetOrigin }) };
}
const ev = (data: unknown, origin = "https://acme.example"): MessageEventLike => ({ data, origin });

describe("protocol envelope (S05)", () => {
  it("recognizes only its own tagged messages", () => {
    expect(isBridgeMessage({ protocol: PROTOCOL, dir: "widget->host", type: "ready" })).toBe(true);
    expect(isBridgeMessage({ type: "ready" })).toBe(false); // untagged
    expect(isBridgeMessage("ready")).toBe(false);
    expect(isBridgeMessage(null)).toBe(false);
  });
});

describe("HostBridge (S05)", () => {
  it("delivers widget→host messages and ignores unrelated / wrong-direction traffic", () => {
    const widget = fakeTarget();
    const bridge = new HostBridge(widget);
    const seen: WidgetToHost[] = [];
    bridge.onWidgetMessage((m) => seen.push(m));

    bridge.receive(ev({ protocol: PROTOCOL, dir: "widget->host", type: "resize", height: 480 }));
    bridge.receive(ev({ hello: "world" })); // not ours → ignored
    bridge.receive(ev({ protocol: PROTOCOL, dir: "host->widget", type: "open" })); // wrong direction → ignored

    expect(seen).toEqual([{ protocol: PROTOCOL, dir: "widget->host", type: "resize", height: 480 }]);
  });

  it("sends typed host→widget messages", () => {
    const widget = fakeTarget();
    new HostBridge(widget).send({ protocol: PROTOCOL, dir: "host->widget", type: "open" });
    expect(widget.sent[0]?.message).toMatchObject({ type: "open", dir: "host->widget" });
  });
});

describe("WidgetBridge (S05)", () => {
  it("delivers host→widget messages (e.g. identify) to handlers", () => {
    const host = fakeTarget();
    const bridge = new WidgetBridge(host);
    const seen: HostToWidget[] = [];
    bridge.onHostMessage((m) => seen.push(m));
    bridge.receive(ev({ protocol: PROTOCOL, dir: "host->widget", type: "identify", user: { externalId: "u_1" } }));
    expect(seen[0]).toMatchObject({ type: "identify", user: { externalId: "u_1" } });
  });

  it("unsubscribes cleanly", () => {
    const host = fakeTarget();
    const bridge = new WidgetBridge(host);
    const fn = vi.fn();
    const off = bridge.onHostMessage(fn);
    off();
    bridge.receive(ev({ protocol: PROTOCOL, dir: "host->widget", type: "open" }));
    expect(fn).not.toHaveBeenCalled();
  });

  // NOTE (S05): the bridge dispatches host→widget messages regardless of event.origin. Whether that is safe
  // enough for a widget embedded on arbitrary third-party pages is a question we return to when we harden the
  // trust boundary. For now the protocol shape + direction are the only gates.
});
