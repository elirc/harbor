import { describe, it, expect } from "vitest";
import { canTransition, stateAfterInbound, isEmailable, renderCanned, buildReplyHeaders } from "./conversation";

describe("conversation state machine (S04)", () => {
  it("allows valid transitions and rejects invalid ones", () => {
    expect(canTransition("open", "closed")).toBe(true);
    expect(canTransition("closed", "open")).toBe(true); // reopen
    expect(canTransition("closed", "snoozed")).toBe(false); // must reopen first
    expect(canTransition("snoozed", "open")).toBe(true);
  });

  it("an inbound message reopens the conversation from any state", () => {
    expect(stateAfterInbound("closed")).toBe("open");
    expect(stateAfterInbound("snoozed")).toBe("open");
  });
});

describe("internal notes never leave the building (S04)", () => {
  it("a note is never emailable; a reply is", () => {
    expect(isEmailable("reply")).toBe(true);
    expect(isEmailable("note")).toBe(false);
  });
});

describe("canned replies — safe interpolation, no eval (S04)", () => {
  it("substitutes {{path}} variables literally", () => {
    expect(renderCanned("Hi {{contact.name}}, thanks!", { "contact.name": "Dana" })).toBe("Hi Dana, thanks!");
  });
  it("unknown variables render empty; nothing executes", () => {
    expect(renderCanned("{{ oops }} and {{missing}}", {})).toBe(" and ");
    // A template that looks like code is treated as literal text — no eval.
    expect(renderCanned("{{constructor}}", {})).toBe("");
  });
});

describe("outbound threading headers (S04)", () => {
  it("sets In-Reply-To + References so the customer's client threads the reply", () => {
    const h = buildReplyHeaders("<msg-2@harbor>", ["<msg-1@harbor>"]);
    expect(h.inReplyTo).toBe("<msg-2@harbor>");
    expect(h.references).toEqual(["<msg-1@harbor>", "<msg-2@harbor>"]);
  });
});
