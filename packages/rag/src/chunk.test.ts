import { describe, it, expect } from "vitest";
import { chunkFixed, chunkStructured } from "./chunk";
import { parseSections, normalizeText } from "./normalize";

const ARTICLE = `# Resetting your password

Sometimes you need to start fresh. This guide walks you through it.

## From the login screen

Click "Forgot password" on the login screen. Enter the email address on your account and press send.

We email you a reset link. The link expires after one hour for security.

## If the email doesn't arrive

Check your spam folder first. Corporate mail filters often hold automated messages.

If it's still missing after ten minutes, contact support and we'll reset it manually.`;

describe("normalization + section parsing (S08)", () => {
  it("collapses whitespace but keeps paragraph breaks", () => {
    expect(normalizeText("a   b\n\n\n\nc  \n  d")).toBe("a b\n\nc\nd");
  });

  it("splits an article into title + sections", () => {
    const doc = parseSections(ARTICLE);
    expect(doc.title).toBe("Resetting your password");
    expect(doc.sections.map((s) => s.heading)).toEqual(["Overview", "From the login screen", "If the email doesn't arrive"]);
  });
});

describe("[J] fixed chunker — the naive baseline (flaw #3 seed) (S08)", () => {
  it("splits on a raw character count, cutting mid-word", () => {
    const text = "The quick brown fox jumps over the lazy dog and keeps on running.";
    const chunks = chunkFixed(text, 20);
    expect(chunks).toHaveLength(4);
    expect(chunks[0].text).toBe("The quick brown fox "); // 20 chars, no word boundary respect
    expect(chunks[1].text).toBe("jumps over the lazy "); // "lazy" then "dog" split across chunks
    // The seam between chunk 0 and 1 falls between words only by luck; the real damage:
    const tight = chunkFixed("password-reset-instructions", 10);
    expect(tight[0].text).toBe("password-r"); // 💥 mid-word — meaning sheared in half
  });
});

describe("[S] structured chunker — the rebuild (S08)", () => {
  it("chunks by section, tags each chunk with its heading + position", () => {
    const chunks = chunkStructured(ARTICLE, { maxChars: 200, overlap: 0, articleSlug: "reset-password" });
    // Every chunk knows where it came from — the raw material of a citation (S12).
    expect(chunks.every((c) => c.metadata.articleSlug === "reset-password")).toBe(true);
    expect(chunks.every((c) => typeof c.metadata.heading === "string")).toBe(true);
    // No chunk cuts mid-word: each begins and ends on a whitespace/boundary of the source paragraphs.
    for (const c of chunks) expect(c.text).toBe(c.text.trim());
    // The login-screen guidance is together, not sheared across a fixed window.
    const login = chunks.find((c) => c.metadata.heading === "From the login screen");
    expect(login?.text).toContain("Forgot password");
  });

  it("carries an overlap tail across chunk boundaries when overlap > 0", () => {
    const doc = parseSections(`## S\n\n${"alpha ".repeat(40).trim()}\n\n${"beta ".repeat(40).trim()}`);
    const chunks = chunkStructured(doc, { maxChars: 120, overlap: 20 });
    expect(chunks.length).toBeGreaterThan(1);
    // The tail of chunk N reappears at the head of chunk N+1 (context preserved across the boundary).
    const tail = chunks[0].text.slice(-20);
    expect(chunks[1].text.startsWith(tail)).toBe(true);
  });
});
