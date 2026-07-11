import { describe, it, expect } from "vitest";
import { chunkFixed, chunkStructured } from "./chunk";
import { MockEmbedder } from "./embed";
import { vectorTopK, type VectorDoc } from "./retrieve";

/**
 * THE CHUNKER SHOWDOWN (S10) — harvest of flaw #3, part 1.
 *
 * S08 shipped two chunkers and ADR-0008 said, honestly, that "structure-aware is better" was a HYPOTHESIS it
 * couldn't grade — no eval existed yet. S09 built the eval. Now we cash the check: chunk the same corpus both
 * ways, embed, retrieve, and measure whether the top-1 retrieved chunk actually CONTAINS the answer. The naive
 * fixed chunker isn't "worse" by assertion anymore — it's worse by the number.
 */
const CORPUS = [
  {
    slug: "reset-password",
    md: `# Resetting your password

## From the login screen
Click Forgot password on the login screen and enter your account email address.

## Reset link expiry
The password reset link expires after exactly one hour for security reasons. Request a fresh link if it lapses.`,
  },
  {
    slug: "two-factor",
    md: `# Two-factor authentication

## Turning it on
Open security settings and choose Enable two factor authentication, then scan the QR code.

## Recovery codes
Store your ten recovery codes somewhere safe; each recovery code works exactly once if you lose your device.`,
  },
];

// Query → the answer phrase that a correctly-retrieved chunk must contain.
const QUERIES = [
  { q: "how long until the password reset link expires", answer: "exactly one hour" },
  { q: "how many times can I use a recovery code", answer: "exactly once" },
];

const embedder = new MockEmbedder(96);

function containmentAt1(chunkTextsBySlug: Array<{ text: string }>): number {
  const corpus: VectorDoc[] = chunkTextsBySlug.map((c, i) => ({ id: String(i), vector: embedder.embed(c.text) }));
  let hits = 0;
  for (const { q, answer } of QUERIES) {
    const top = vectorTopK(embedder.embed(q), corpus, 1);
    const topText = chunkTextsBySlug[Number(top[0].id)].text;
    if (topText.toLowerCase().includes(answer)) hits++;
  }
  return hits / QUERIES.length;
}

describe("chunker showdown — flaw #3 part 1, now measured (S10)", () => {
  it("structure-aware retrieval surfaces the answer; fixed-size does not", () => {
    // Structured: whole coherent sections, so the answer sentence stays intact inside one chunk.
    const structured = CORPUS.flatMap((a) => chunkStructured(a.md, { articleSlug: a.slug }).map((c) => ({ text: c.text })));
    // Fixed: 48-char windows shear sentences, so "exactly one hour" / "exactly once" get split across chunks.
    const fixed = CORPUS.flatMap((a) => chunkFixed(`${a.md}`, 48).map((c) => ({ text: c.text })));

    const structuredScore = containmentAt1(structured);
    const fixedScore = containmentAt1(fixed);

    // The harvest: structured retrieves a chunk that contains the answer; fixed's top chunk is sheared/diluted.
    expect(structuredScore).toBe(1);
    expect(structuredScore).toBeGreaterThan(fixedScore);
  });
});
