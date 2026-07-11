import { describe, it, expect } from "vitest";
import { IdentityResolver, pickSurvivor, isVerifiedIdentifier } from "./identity";

describe("identity resolution (S02)", () => {
  it("resolves the same identifier to the same contact", async () => {
    const r = new IdentityResolver();
    const a = await r.resolveOrCreate("ws", "email", "dana@x.com");
    const b = await r.resolveOrCreate("ws", "email", "dana@x.com");
    expect(a).toBe(b);
    expect(r.contactCount).toBe(1);
  });

  it("different identifiers create different contacts (unique per workspace/type/value)", async () => {
    const r = new IdentityResolver();
    await r.resolveOrCreate("ws", "email", "a@x.com");
    await r.resolveOrCreate("ws", "email", "b@x.com");
    await r.resolveOrCreate("ws", "messenger", "sess-1");
    expect(r.contactCount).toBe(3);
  });
});

describe("the merge race (S02, in-PR arc — Pulse S6 revisited)", () => {
  it("NAIVE resolve-or-create RACES: two channels, one new user → DUPLICATE contacts", async () => {
    const r = new IdentityResolver();
    // Both messages are for the same new person on the same identifier. Interleave so both pass the
    // existence check before either creates: call 1 stalls in its race window while call 2 creates.
    let release!: () => void;
    const gate = new Promise<void>((res) => (release = res));
    const p1 = r.resolveOrCreateNaive("ws", "email", "new@x.com", () => gate);
    const p2 = r.resolveOrCreateNaive("ws", "email", "new@x.com"); // no stall — creates immediately
    await p2;
    release(); // now p1 resumes and creates a SECOND contact
    const [id1, id2] = await Promise.all([p1, p2]);
    expect(id1).not.toBe(id2); // 💥 the race: two contacts for one person
    expect(r.contactCount).toBe(2);
  });

  it("the advisory-lock fix serializes per identifier → ONE contact", async () => {
    const r = new IdentityResolver();
    let release!: () => void;
    const gate = new Promise<void>((res) => (release = res));
    const p1 = r.resolveOrCreate("ws", "email", "new@x.com", () => gate); // holds the lock while stalled
    const p2 = r.resolveOrCreate("ws", "email", "new@x.com"); // BLOCKS on the lock
    release();
    const [id1, id2] = await Promise.all([p1, p2]);
    expect(id1).toBe(id2); // the second waited, then found the first's contact
    expect(r.contactCount).toBe(1);
  });

  it("locking is per-identifier — different identifiers resolve in parallel", async () => {
    const r = new IdentityResolver();
    const [a, b] = await Promise.all([r.resolveOrCreate("ws", "email", "a@x.com"), r.resolveOrCreate("ws", "email", "b@x.com")]);
    expect(a).not.toBe(b);
    expect(r.contactCount).toBe(2);
  });
});

describe("contact merge (S02)", () => {
  it("oldest contact wins; identities and conversations reattach; idempotent", async () => {
    const r = new IdentityResolver();
    const older = await r.resolveOrCreate("ws", "email", "dana@x.com");
    const newer = await r.resolveOrCreate("ws", "messenger", "sess-9");
    r.attachConversation("conv-1", newer);

    const survivor = r.merge(older, newer);
    expect(survivor).toBe(older); // oldest wins
    expect(r.contactCount).toBe(1);
    expect(r.conversationsOf(older)).toContain("conv-1"); // reattached — no orphan
    expect(r.identitiesOf(older)).toHaveLength(2); // both identifiers now point at the survivor

    // Idempotent: re-merging (either order) is a no-op.
    expect(r.merge(older, newer)).toBe(older);
    expect(r.merge(newer, older)).toBe(older);
    expect(r.contactCount).toBe(1);
  });

  it("pickSurvivor is deterministic regardless of argument order", () => {
    const a = { id: "a", createdAt: 1 };
    const b = { id: "b", createdAt: 2 };
    expect(pickSurvivor(a, b)).toBe(a);
    expect(pickSurvivor(b, a)).toBe(a);
  });

  it("auto-merge only on verified identifiers; external is a weak signal", () => {
    expect(isVerifiedIdentifier("email")).toBe(true);
    expect(isVerifiedIdentifier("messenger")).toBe(true);
    expect(isVerifiedIdentifier("external")).toBe(false);
  });
});
