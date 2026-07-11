import { describe, it, expect } from "vitest";
import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";

/**
 * The bundle-budget gate (S05). 🔗 Pulse S3's discipline: code that ships to strangers' pages has a SIZE
 * BUDGET, enforced in CI so a careless import can't silently bloat it. The loader is the featherweight tier —
 * its whole job is to inject an iframe — so its source footprint (loader + the protocol constants it pulls in)
 * must stay small. The heavy widget UI lives inside the iframe and loads lazily; it is NOT on this budget.
 *
 * We gate raw source bytes as a conservative proxy: minification + gzip only make the shipped size smaller, so
 * "raw source < 30KB" guarantees "shipped < 30KB". If this test ever fails, someone put weight in the loader
 * that belongs behind the iframe.
 */
const LOADER_BUDGET_BYTES = 30 * 1024;

function sizeOf(relative: string): number {
  const path = fileURLToPath(new URL(relative, import.meta.url));
  return Buffer.byteLength(readFileSync(path, "utf8"), "utf8");
}

describe("messenger loader budget (S05)", () => {
  it("the loader + its protocol deps stay under 30KB of source", () => {
    const total = sizeOf("./loader.ts") + sizeOf("./protocol.ts");
    expect(total).toBeLessThan(LOADER_BUDGET_BYTES);
  });
});
