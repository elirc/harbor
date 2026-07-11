import { describe, it, expect } from "vitest";
import { planEscalations, type MonitoredWindow } from "./sla-monitor";
import { EscalationLog, type SlaWindow } from "@harbor/shared";
import type { BusinessHours } from "@harbor/shared";

const HOUR = 3_600_000;
const mf9to17: BusinessHours = { utcOffsetMinutes: 0, windows: { 1: { openMin: 540, closeMin: 1020 }, 2: { openMin: 540, closeMin: 1020 } } };

// target 4 business-hours from Tue 09:00; no pauses, so consumed == elapsed in-hours time.
const win4h: SlaWindow = { targetMs: 4 * HOUR, startedAt: new Date("2024-01-02T09:00:00Z"), pauses: [] };

describe("SLA monitor escalation planning (S07)", () => {
  it("classifies warn (<100%) vs breach (>=100%) and fires each threshold once", () => {
    const windows: MonitoredWindow[] = [{ windowId: "w1", conversationId: "c1", window: win4h }];
    const log = new EscalationLog();
    const now = new Date("2024-01-02T12:42:00Z"); // 3h42m = 3.7h of 4h → 92.5%

    const first = planEscalations(windows, now, mf9to17, log);
    expect(first.map((a) => a.threshold)).toEqual([0.75, 0.9]); // crossed both, both warns
    expect(first.every((a) => a.kind === "warn")).toBe(true);

    // Run again immediately — nothing new fires (idempotent per window+threshold).
    expect(planEscalations(windows, now, mf9to17, log)).toEqual([]);
  });

  it("emits a breach action once the target is fully consumed", () => {
    const windows: MonitoredWindow[] = [{ windowId: "w2", conversationId: "c2", window: { targetMs: 4 * HOUR, startedAt: new Date("2024-01-02T09:00:00Z"), pauses: [] } }];
    const log = new EscalationLog();
    const actions = planEscalations(windows, new Date("2024-01-02T14:00:00Z"), mf9to17, log); // 5h > 4h
    expect(actions.some((a) => a.kind === "breach" && a.threshold === 1.0)).toBe(true);
  });
});
