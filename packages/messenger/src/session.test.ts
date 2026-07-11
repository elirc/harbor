import { describe, it, expect } from "vitest";
import { newSession, identify, open, close, receiveAgentMessage } from "./session";
import { widgetIframeSrc } from "./loader";

describe("messenger session: anonymous → identified (S05)", () => {
  it("starts anonymous and upgrades on identify", () => {
    let s = newSession("sess-1");
    expect(s.status).toBe("anonymous");
    expect(s.externalId).toBeNull();
    s = identify(s, "user_42");
    expect(s.status).toBe("identified");
    expect(s.externalId).toBe("user_42");
  });

  it("an empty external id keeps the session anonymous", () => {
    const s = identify(newSession("sess-2"), "");
    expect(s.status).toBe("anonymous");
  });
});

describe("messenger unread counting (S05)", () => {
  it("bumps unread only while closed; opening clears it", () => {
    let s = newSession("sess-3");
    s = receiveAgentMessage(s); // closed → +1
    s = receiveAgentMessage(s); // closed → +1
    expect(s.unread).toBe(2);
    s = open(s); // reading → cleared
    expect(s.unread).toBe(0);
    s = receiveAgentMessage(s); // open → no bump
    expect(s.unread).toBe(0);
    s = close(s);
    s = receiveAgentMessage(s); // closed again → +1
    expect(s.unread).toBe(1);
  });
});

describe("loader iframe src (S05)", () => {
  it("targets the app origin with workspace + protocol version", () => {
    const src = widgetIframeSrc({ workspaceId: "ws_123", appOrigin: "https://cdn.harbor.example" });
    const u = new URL(src);
    expect(u.origin).toBe("https://cdn.harbor.example");
    expect(u.pathname).toBe("/widget");
    expect(u.searchParams.get("ws")).toBe("ws_123");
    expect(u.searchParams.get("v")).toBe("harbor-messenger/1");
  });
});
