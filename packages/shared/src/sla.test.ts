import { describe, it, expect } from "vitest";
import { businessMillisBetween, slaStatus, crossedThresholds, EscalationLog, type SlaWindow } from "./sla";
import type { BusinessHours } from "./routing";

const HOUR = 3_600_000;
// Mon–Fri 09:00–17:00 (8h/day) in UTC (offset 0) to keep the arithmetic legible.
const mf9to17: BusinessHours = {
  utcOffsetMinutes: 0,
  windows: { 1: h(9, 17), 2: h(9, 17), 3: h(9, 17), 4: h(9, 17), 5: h(9, 17) },
};
function h(open: number, close: number) {
  return { openMin: open * 60, closeMin: close * 60 };
}

describe("businessMillisBetween (S07)", () => {
  it("counts only in-hours time on a single day", () => {
    // Tue 10:00 → 14:00 UTC = 4 business hours
    expect(businessMillisBetween(new Date("2024-01-02T10:00:00Z"), new Date("2024-01-02T14:00:00Z"), mf9to17)).toBe(4 * HOUR);
  });

  it("excludes nights and weekends", () => {
    // Fri 15:00 → Mon 11:00: Fri 15–17 (2h) + Mon 9–11 (2h) = 4h; the weekend contributes nothing
    expect(businessMillisBetween(new Date("2024-01-05T15:00:00Z"), new Date("2024-01-08T11:00:00Z"), mf9to17)).toBe(4 * HOUR);
  });

  it("clamps to the window edges and is zero for reversed ranges", () => {
    // 06:00 → 12:00 counts only 09:00–12:00 = 3h
    expect(businessMillisBetween(new Date("2024-01-02T06:00:00Z"), new Date("2024-01-02T12:00:00Z"), mf9to17)).toBe(3 * HOUR);
    expect(businessMillisBetween(new Date("2024-01-02T14:00:00Z"), new Date("2024-01-02T10:00:00Z"), mf9to17)).toBe(0);
  });
});

describe("SLA status with pauses (S07)", () => {
  it("pauses the clock while awaiting the customer", () => {
    // target 4 business-hours; started Tue 09:00; paused Tue 10:00–12:00 (awaiting customer); now Tue 13:00.
    // gross = 09→13 = 4h; paused = 10→12 = 2h; consumed = 2h; remaining = 2h.
    const w: SlaWindow = {
      targetMs: 4 * HOUR,
      startedAt: new Date("2024-01-02T09:00:00Z"),
      pauses: [{ from: new Date("2024-01-02T10:00:00Z"), to: new Date("2024-01-02T12:00:00Z") }],
    };
    const s = slaStatus(w, new Date("2024-01-02T13:00:00Z"), mf9to17);
    expect(s.consumedMs).toBe(2 * HOUR);
    expect(s.remainingMs).toBe(2 * HOUR);
    expect(s.breached).toBe(false);
  });

  it("flags at-risk then breached as the budget runs out", () => {
    const w: SlaWindow = { targetMs: 4 * HOUR, startedAt: new Date("2024-01-02T09:00:00Z"), pauses: [] };
    expect(slaStatus(w, new Date("2024-01-02T12:30:00Z"), mf9to17).atRisk).toBe(true); // 3.5h of 4h → within 20%
    expect(slaStatus(w, new Date("2024-01-02T14:00:00Z"), mf9to17).breached).toBe(true); // 5h > 4h
  });
});

describe("escalation thresholds, fired once (S07)", () => {
  it("reports crossed thresholds by consumed fraction", () => {
    const w: SlaWindow = { targetMs: 4 * HOUR, startedAt: new Date("2024-01-02T09:00:00Z"), pauses: [] };
    // 3.7h of 4h = 92.5% → crossed 0.75 and 0.9, not 1.0
    expect(crossedThresholds(w, new Date("2024-01-02T12:42:00Z"), mf9to17)).toEqual([0.75, 0.9]);
  });

  it("fires each (window, threshold) exactly once", () => {
    const log = new EscalationLog();
    expect(log.shouldFire("win-1", 0.75)).toBe(true);
    expect(log.shouldFire("win-1", 0.75)).toBe(false); // already fired → no double alert
    expect(log.shouldFire("win-1", 0.9)).toBe(true); // different threshold, fresh
  });
});
