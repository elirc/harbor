import { describe, it, expect } from "vitest";
import { threadEmail, type KnownMessage, type ScopedConversation } from "./thread";

/**
 * S13 — the final harvest of flaw #1 (threading), the swampy feature hardened across THREE sprints: S03 shipped
 * subject-only (weak), S07 added Message-ID headers + contact-scoped subject fallback, and S13 closes the
 * forwarded-chain edge cases. These pin the cross-contact contamination that headers *reintroduced*.
 */
const known: KnownMessage[] = [{ messageId: "<alice-msg-1@harbor>", conversationId: "conv-alice", contactId: "alice" }];
const open: ScopedConversation[] = [
  { id: "conv-alice", subject: "Billing question", contactId: "alice" },
  { id: "conv-bob", subject: "Billing question", contactId: "bob" },
];

describe("threadEmail: forwarded-chain cross-contact guard (S13)", () => {
  it("REGRESSION: Bob forwarding Alice's email does NOT splice into Alice's thread", () => {
    // Bob forwards Alice's message; his email carries Alice's Message-ID in References. A naive header match
    // would thread Bob's forward into conv-alice — leaking Bob into Alice's conversation. The guard blocks it.
    const bobForward = threadEmail(
      { inReplyTo: null, references: ["<alice-msg-1@harbor>"], subject: "Fwd: Billing question", fromContactId: "bob" },
      known,
      open,
    );
    expect(bobForward.conversationId).not.toBe("conv-alice");
    expect(bobForward.via).toBe("subject"); // falls back to Bob's OWN same-subject thread
    expect(bobForward.conversationId).toBe("conv-bob");
  });

  it("Alice's own reply still threads on the header (same contact)", () => {
    const aliceReply = threadEmail(
      { inReplyTo: "<alice-msg-1@harbor>", references: [], subject: "Re: Billing question", fromContactId: "alice" },
      known,
      open,
    );
    expect(aliceReply).toEqual({ conversationId: "conv-alice", via: "headers" });
  });

  it("an unknown sender with a matching header still threads (can't attribute a forward)", () => {
    const unknown = threadEmail(
      { inReplyTo: "<alice-msg-1@harbor>", references: [], subject: "Re: Billing question", fromContactId: null },
      known,
      open,
    );
    expect(unknown.via).toBe("headers"); // no contact to scope against → honor the chain
  });
});
