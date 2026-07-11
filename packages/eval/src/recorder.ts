/**
 * Deterministic replay (S09). Non-determinism is poison for CI: a live model gives a different answer every
 * run, so a test that calls it can't assert anything stable. The fix: **record real model outputs once, replay
 * them forever.** Live-Claude runs are a separate, cost-capped nightly job (never the PR gate); CI replays the
 * recording. This is how AI features get deterministic tests without pretending the model is deterministic.
 */
import type { LlmProvider, CompleteRequest, CompleteResponse } from "@harbor/llm";
import { promptHash, estimateTokens } from "@harbor/llm";

export type Fixtures = Record<string, string>;

/**
 * Wrap a live provider to capture every (promptHash → text) it returns. Run this in the nightly live job to
 * refresh fixtures; commit the result. The recording is keyed by a hash of the request, so the same prompt
 * always replays to the same answer.
 */
export class RecordingProvider implements LlmProvider {
  readonly fixtures: Fixtures = {};
  constructor(private readonly inner: LlmProvider) {}
  async complete(req: CompleteRequest): Promise<CompleteResponse> {
    const res = await this.inner.complete(req);
    this.fixtures[promptHash(req)] = res.text;
    return res;
  }
}

/**
 * Build a deterministic replay provider from recorded fixtures — what CI uses. A miss (a prompt with no
 * recording) is loud on purpose: it means the dataset or prompt changed and the fixtures need re-recording,
 * which should be a visible action, not a silent live call.
 */
export function replayProvider(fixtures: Fixtures): LlmProvider {
  return {
    complete(req: CompleteRequest): Promise<CompleteResponse> {
      const key = promptHash(req);
      const text = key in fixtures ? fixtures[key] : `[replay-miss:${key}] re-record fixtures`;
      return Promise.resolve({
        text,
        usage: { inputTokens: estimateTokens((req.system ?? "") + req.messages.map((m) => m.content).join(" ")), outputTokens: estimateTokens(text) },
        stopReason: "end_turn",
      });
    },
  };
}
