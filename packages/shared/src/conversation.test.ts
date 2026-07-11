import { describe, it, expect } from "vitest";
import { canTransition, stateAfterInbound, InboxAssignments, isEmailable, renderCanned, buildReplyHeaders } from "./conversation";

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

describe("the double-claim race (S04, in-PR arc — Tracer S6 revisited)", () => {
  it("NAIVE claim RACES: two agents claim one unassigned conversation → BOTH think they won", async () => {
    const inbox = new InboxAssignments();
    inbox.seed("conv-1", null);
    let release!: () => void;
    const gate = new Promise<void>((res) => (release = res));
    const p1 = inbox.claimNaive("conv-1", "ada", () => gate); // stalls in the race window
    const p2 = inbox.claimNaive("conv-1", "ravi"); // reads null, writes ravi
    await p2;
    release();
    const [r1, r2] = await Promise.all([p1, p2]);
    expect(r1.ok && r2.ok).toBe(true); // 💥 BOTH succeeded — the shared-inbox race
    // ...and ada silently overwrote ravi: the assignee is whoever wrote last, with no one told they lost.
    expect(inbox.assigneeOf("conv-1")).toBe("ada");
  });

  it("the precondition claim (atomic set-if-null) lets exactly ONE agent win", () => {
    // RED until the next commit: `claim` does not exist yet. This test is the SPEC for the fix — exactly one
    // winner, the loser gets a clean "already claimed" with the winner's id, never a silent overwrite.
    const inbox = new InboxAssignments();
    inbox.seed("conv-2", null);
    const first = inbox.claim("conv-2", "ada");
    const second = inbox.claim("conv-2", "ravi");
    expect(first).toEqual({ ok: true, assigneeId: "ada" });
    expect(second).toEqual({ ok: false, assigneeId: "ada" }); // clean "already claimed", not an overwrite
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
