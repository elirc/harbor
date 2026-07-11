import { describe, it, expect } from "vitest";
import { threadEmail, type KnownMessage, type ScopedConversation } from "./thread";

/**
 * S07 — the harvest of flaw #1. These tests pin the behavior that subject-only threading got WRONG: they lock
 * in header-based threading and the contact-scoped subject fallback. The star is the cross-contact regression:
 * two different customers with the same subject must NOT be merged.
 */
const known: KnownMessage[] = [{ messageId: "<parent-1@harbor>", conversationId: "conv-A" }];
const open: ScopedConversation[] = [
  { id: "conv-A", subject: "Invoice", contactId: "contact-alice" },
  { id: "conv-B", subject: "Invoice", contactId: "contact-bob" }, // same subject, different person!
];

describe("threadEmail: correct signal first (S07)", () => {
  it("threads on the Message-ID chain even when the subject changed", () => {
    const r = threadEmail(
      { inReplyTo: "<parent-1@harbor>", references: [], subject: "totally different subject", fromContactId: "contact-alice" },
      known,
      open,
    );
    expect(r).toEqual({ conversationId: "conv-A", via: "headers" });
  });

  it("uses References ancestry when In-Reply-To is absent", () => {
    const r = threadEmail(
      { inReplyTo: null, references: ["<root@x>", "<parent-1@harbor>"], subject: "Re: Invoice", fromContactId: "contact-alice" },
      known,
      open,
    );
    expect(r.via).toBe("headers");
    expect(r.conversationId).toBe("conv-A");
  });
});

describe("threadEmail: subject fallback is contact-scoped (harvest of flaw #1)", () => {
  it("REGRESSION: two contacts' same-subject emails stay separate", () => {
    // Bob emails "Re: Invoice" with no threading headers. Subject-only threading (the S03 flaw) would have
    // merged this into Alice's conv-A. It must land in Bob's own conv-B instead.
    const bob = threadEmail({ inReplyTo: null, references: [], subject: "Re: Invoice", fromContactId: "contact-bob" }, [], open);
    expect(bob).toEqual({ conversationId: "conv-B", via: "subject" });

    const alice = threadEmail({ inReplyTo: null, references: [], subject: "Invoice", fromContactId: "contact-alice" }, [], open);
    expect(alice.conversationId).toBe("conv-A");
  });

  it("an unknown sender gets no subject fallback (starts fresh)", () => {
    const r = threadEmail({ inReplyTo: null, references: [], subject: "Invoice", fromContactId: null }, [], open);
    expect(r).toEqual({ conversationId: null, via: "none" });
  });
});
