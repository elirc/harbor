import { describe, it, expect } from "vitest";
import { PostMessageSchema, ConversationState } from "./index";

describe("shared vocabulary (S01)", () => {
  it("accepts a valid message post and defaults direction to inbound", () => {
    expect(PostMessageSchema.parse({ body: "hello" })).toEqual({ body: "hello", direction: "inbound" });
  });

  it("rejects an empty body", () => {
    expect(PostMessageSchema.safeParse({ body: "" }).success).toBe(false);
  });

  it("conversation states are the four we model", () => {
    expect(ConversationState.options).toEqual(["open", "pending", "snoozed", "closed"]);
  });
});
