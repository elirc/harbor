import { z } from "zod";

/**
 * Harbor's shared vocabulary (S01). Conversations, messages, contacts — the walking skeleton's domain.
 *
 * 🔗 A `Message` stores BOTH `raw` and `parsed`. Today they're identical; by S03 (inbound email) `raw` is the
 * untouched MIME and `parsed` is the stripped, threaded, display-ready text. Naming for that future now means
 * S03 is a fill-in, not a migration — and "store the original, derive the view" is the email lesson early.
 */

export const ConversationState = z.enum(["open", "pending", "snoozed", "closed"]);
export type ConversationState = z.infer<typeof ConversationState>;

export const MessageDirection = z.enum(["inbound", "outbound", "note"]);
export type MessageDirection = z.infer<typeof MessageDirection>;

/** Post a message into a conversation (S01: just text; S03+ carries raw MIME). */
export const PostMessageSchema = z.object({
  body: z.string().min(1),
  direction: MessageDirection.default("inbound"),
});
export type PostMessage = z.infer<typeof PostMessageSchema>;

export interface InboxItem {
  conversationId: string;
  subject: string;
  state: ConversationState;
  lastMessagePreview: string;
  updatedAt: string;
}

export * from "./identity";
