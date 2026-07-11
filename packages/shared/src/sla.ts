/**
 * SLA clock (S07). An SLA is a promise measured on a BUSINESS CALENDAR, and the calendar is where the bugs
 * live. This is a pure functional core — business-time between two instants, given a weekly schedule — so the
 * subtle cases (off-hours, weekends, the pause while awaiting the customer) are property-testable without a DB
 * or a wall clock. 🔗 Meridian S6's working-days math, restated for support.
 */
import type { BusinessHours } from "./routing";

const DAY_MS = 86_400_000;
const MIN_MS = 60_000;

/**
 * Elapsed BUSINESS time (ms) between two UTC instants, counting only minutes inside the schedule's daily
 * windows. Walks local day by local day and sums the overlap of [start, end] with each day's open window.
 * 🔗 We shift into local once (offset as data) and compare there — the same discipline as isWithinBusinessHours.
 */
export function businessMillisBetween(startUtc: Date, endUtc: Date, hours: BusinessHours): number {
  const startLocal = startUtc.getTime() + hours.utcOffsetMinutes * MIN_MS;
  const endLocal = endUtc.getTime() + hours.utcOffsetMinutes * MIN_MS;
  if (endLocal <= startLocal) return 0;

  let total = 0;
  // Local midnight of the start day (localMs treated as a UTC-shifted timeline, as elsewhere in this file).
  for (let dayStart = Math.floor(startLocal / DAY_MS) * DAY_MS; dayStart < endLocal; dayStart += DAY_MS) {
    const weekday = new Date(dayStart).getUTCDay() as 0 | 1 | 2 | 3 | 4 | 5 | 6;
    const window = hours.windows[weekday];
    if (!window) continue; // closed day contributes nothing
    const winOpen = dayStart + window.openMin * MIN_MS;
    const winClose = dayStart + window.closeMin * MIN_MS;
    const lo = Math.max(winOpen, startLocal);
    const hi = Math.min(winClose, endLocal);
    if (hi > lo) total += hi - lo;
  }
  return total;
}

// ── SLA window & status ──────────────────────────────────────────────────────────────────────────
export interface SlaWindow {
  targetMs: number; // business-time budget (e.g. 4 business hours to first response)
  startedAt: Date;
  /** Intervals during which the clock is PAUSED (awaiting customer). `to: null` = still paused. */
  pauses: ReadonlyArray<{ from: Date; to: Date | null }>;
}

export interface SlaStatus {
  consumedMs: number;
  remainingMs: number;
  breached: boolean;
  atRisk: boolean; // within the risk fraction of the target but not yet breached
}

/**
 * ⚠️ The clock PAUSES while we await the customer. An SLA that keeps ticking during customer latency punishes
 * agents for something they don't control — the pause rules are a FAIRNESS decision, documented in ADR-0007.
 * Consumed business-time = gross business-time since start MINUS business-time spent paused.
 */
export function slaConsumedMs(w: SlaWindow, now: Date, hours: BusinessHours): number {
  const gross = businessMillisBetween(w.startedAt, now, hours);
  let paused = 0;
  for (const p of w.pauses) {
    const from = p.from < w.startedAt ? w.startedAt : p.from;
    const toRaw = p.to ?? now;
    const to = toRaw > now ? now : toRaw;
    paused += businessMillisBetween(from, to, hours);
  }
  return Math.max(0, gross - paused);
}

export function slaStatus(w: SlaWindow, now: Date, hours: BusinessHours, riskFraction = 0.2): SlaStatus {
  const consumedMs = slaConsumedMs(w, now, hours);
  const remainingMs = w.targetMs - consumedMs;
  return {
    consumedMs,
    remainingMs,
    breached: remainingMs <= 0,
    atRisk: remainingMs > 0 && remainingMs <= w.targetMs * riskFraction,
  };
}

// ── Escalation thresholds, fired exactly once ──────────────────────────────────────────────────────
/** Thresholds as fractions of the target consumed (0.75 = warn at 75%, 1.0 = breach). */
export const DEFAULT_THRESHOLDS = [0.75, 0.9, 1.0] as const;

/** Which thresholds a window has crossed at `now` (consumed / target). */
export function crossedThresholds(w: SlaWindow, now: Date, hours: BusinessHours, thresholds: readonly number[] = DEFAULT_THRESHOLDS): number[] {
  if (w.targetMs <= 0) return [];
  const frac = slaConsumedMs(w, now, hours) / w.targetMs;
  return thresholds.filter((t) => frac >= t);
}

/**
 * 🔗 Fire-once semantics (Meridian S10). A monitor runs repeatedly; without a marker it re-escalates every
 * tick and cries wolf. `shouldFire` records (windowId, threshold) and returns true only the first time — the
 * in-memory model of a persisted sent-marker.
 */
export class EscalationLog {
  private readonly fired = new Set<string>();
  shouldFire(windowId: string, threshold: number): boolean {
    const key = `${windowId}|${threshold}`;
    if (this.fired.has(key)) return false;
    this.fired.add(key);
    return true;
  }
  hasFired(windowId: string, threshold: number): boolean {
    return this.fired.has(`${windowId}|${threshold}`);
  }
}
