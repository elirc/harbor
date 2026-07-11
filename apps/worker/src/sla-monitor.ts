/**
 * SLA monitor (S07). A background job runs this on a cadence: for each live SLA window, decide which escalation
 * thresholds have been crossed and haven't fired yet. The DECISION is a pure function (`planEscalations`) so
 * "fires once, classifies warn vs breach" is testable without BullMQ, Redis, or a clock; the job wrapper just
 * loads windows, calls this, and dispatches the actions.
 *
 * 🔗 Meridian S10's catch-up/fire-once semantics: a monitor that re-alerts every tick cries wolf. Idempotency
 * per (window, threshold) is the whole game.
 */
import { crossedThresholds, EscalationLog, type SlaWindow, type BusinessHours } from "@harbor/shared";

export interface MonitoredWindow {
  windowId: string;
  conversationId: string;
  window: SlaWindow;
}

export interface EscalationAction {
  windowId: string;
  conversationId: string;
  threshold: number;
  kind: "warn" | "breach";
}

/**
 * Plan the escalations to fire right now. `log` carries the fire-once memory (backed by a sent-marker table in
 * production) — a threshold already fired is skipped, so running the monitor twice a minute is safe.
 */
export function planEscalations(
  windows: readonly MonitoredWindow[],
  now: Date,
  hours: BusinessHours,
  log: EscalationLog,
  thresholds?: readonly number[],
): EscalationAction[] {
  const actions: EscalationAction[] = [];
  for (const mw of windows) {
    for (const threshold of crossedThresholds(mw.window, now, hours, thresholds)) {
      if (!log.shouldFire(mw.windowId, threshold)) continue; // already alerted — don't cry wolf
      actions.push({
        windowId: mw.windowId,
        conversationId: mw.conversationId,
        threshold,
        kind: threshold >= 1 ? "breach" : "warn",
      });
    }
  }
  return actions;
}

// The BullMQ job wrapper (real infra) would: load open SLA windows from the DB, call planEscalations with a
// persisted EscalationLog, then notify/reassign per action. Kept out of CI (no Redis); the decision above is
// what's tested. Tiered policy (ADR-0007): warn → notify owner; breach → notify team lead; reassign only when
// the owner is offline.
