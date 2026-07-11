/**
 * Bot autonomy (S14). The culmination of the eval-first thesis: the bot acts autonomously ONLY on a subset
 * proven safe by a committed eval score. "Confident enough to act" is a measured threshold, not a
 * product-manager's optimism. Autonomy is earned by eval, scoped narrowly, and always leaves a clean path back
 * to a human. 🔗 The S13 least-privilege stance, now the autonomy design.
 */

/**
 * The TRUST LADDER. Autonomy isn't on/off — it's rungs a customer climbs deliberately: off → draft (bot
 * suggests, human sends) → auto+CC (bot sends, an agent is copied) → auto (bot sends). Ship the whole ladder,
 * not just the top; most teams adopt through the middle.
 */
export type AutonomyMode = "off" | "draft" | "auto_cc" | "auto";

export interface AutonomySettings {
  mode: AutonomyMode;
  /** Topics eligible for auto-reply. Auto is scoped to allowlisted topics — a narrow, reviewed subset. */
  topicAllowlist: string[];
  businessHoursOnly: boolean;
  /** Thresholds from S12's eval, not guesses. The auto subset must clear these AND be near-zero-wrong in eval. */
  minConfidence: number;
  minRetrievalScore: number;
}

/** Safe default: autonomy OFF. Admins opt in per topic after reviewing the safety eval. */
export const DEFAULT_AUTONOMY: AutonomySettings = {
  mode: "off",
  topicAllowlist: [],
  businessHoursOnly: true,
  minConfidence: 0.85,
  minRetrievalScore: 0.3,
};

export type AutonomyAction = "auto_send" | "auto_send_cc" | "draft" | "handoff";
export interface AutonomyDecision {
  action: AutonomyAction;
  reason: string;
}

export interface AutonomyInput {
  settings: AutonomySettings;
  refused: boolean;
  confidence: number;
  retrievalScore: number;
  topic: string;
  businessHoursOk: boolean;
}

/**
 * 🔍 THREE GATES IN SERIES. Auto-reply requires (topic allowlisted) AND (confidence high) AND (retrieval
 * strong) — each gate narrows the blast radius. A refusal always hands off; anything short of all gates drafts
 * for a human. The safe answer at every branch is "let a human handle it," never "act anyway."
 */
export function autonomyDecision(input: AutonomyInput): AutonomyDecision {
  const s = input.settings;
  if (input.refused) return { action: "handoff", reason: "bot refused — no confident grounded answer" };
  if (s.mode === "off" || s.mode === "draft") return { action: "draft", reason: `mode=${s.mode}: draft for human` };

  if (!s.topicAllowlist.includes(input.topic)) return { action: "draft", reason: `topic "${input.topic}" not allowlisted for auto-reply` };
  if (input.confidence < s.minConfidence) return { action: "draft", reason: `confidence ${input.confidence.toFixed(2)} < ${s.minConfidence}` };
  if (input.retrievalScore < s.minRetrievalScore) return { action: "draft", reason: `retrieval ${input.retrievalScore.toFixed(2)} < ${s.minRetrievalScore}` };
  if (s.businessHoursOnly && !input.businessHoursOk) return { action: "draft", reason: "outside business hours" };

  return { action: s.mode === "auto_cc" ? "auto_send_cc" : "auto_send", reason: "all autonomy gates passed" };
}

// ── Handoff: the human inherits context, not a cold start ───────────────────────────────────────────
export interface BotAttempt {
  answer: string;
  refused: boolean;
  reason: string | null;
  citations: number[];
}

/**
 * 📘 A handoff that drops context makes the human start over and the customer repeat themselves — the worst
 * support experience. So the handoff carries a summary of the thread, what the bot TRIED, and why it stopped.
 * The bot's transparency is the entire value of the handoff.
 */
export function buildHandoffNote(subject: string, recentMessages: readonly string[], attempt: BotAttempt): string {
  const convo = recentMessages.slice(-3).map((m) => `  • ${m.slice(0, 140)}`).join("\n");
  const tried = attempt.refused
    ? `The bot could not answer (${attempt.reason ?? "no confident grounded answer"}) and did not reply.`
    : `The bot drafted: "${attempt.answer.slice(0, 200)}" (sources ${attempt.citations.join(", ") || "none"}).`;
  return [`Handoff — "${subject}"`, ``, `Recent messages:`, convo, ``, `What the AI tried:`, `  ${tried}`, ``, `Over to you — full history is in the thread.`].join("\n");
}

// ── Agent assists (low-risk, human-triggered, human-sent) ───────────────────────────────────────────
/** 📘 Human-triggered, human-sent AI (summarize/draft/tone) is the SAFE entry point — risk scales with autonomy. */
export function summarizeThreadPrompt(messages: readonly string[]): string {
  return `Summarize this support conversation in 2-3 sentences for an agent picking it up:\n\n${messages.map((m, i) => `${i + 1}. ${m}`).join("\n")}`;
}

export type Tone = "friendlier" | "more_formal" | "more_concise";
export function adjustTonePrompt(draft: string, tone: Tone): string {
  const how = { friendlier: "warmer and more empathetic", more_formal: "more formal and professional", more_concise: "shorter and more direct" }[tone];
  return `Rewrite this support reply to be ${how}, keeping every fact and any [n] citations unchanged:\n\n${draft}`;
}
