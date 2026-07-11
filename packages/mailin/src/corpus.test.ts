import { describe, it, expect } from "vitest";
import { parseEmail, stripForDisplay, stripQuotedReply, normalizeSubject, threadBySubject } from "./index";

/**
 * THE NASTY-EMAIL CORPUS (S03) — the sprint's real asset. 📘 For a messy domain, a corpus of real inputs
 * with expected outputs beats any amount of unit-test theorizing. Each email below documents its TRAP; the
 * corpus grows every time production surprises you. (Run via `test:corpus`.)
 */

// ── Email 1: Gmail reply — "On … wrote:" quote + base64 body + encoded-word subject ────────────────
const gmailReply = [
  "From: dana@example.com",
  "Subject: =?UTF-8?B?UmU6IEludm9pY2U=?=", // "Re: Invoice"
  "Content-Type: text/plain; charset=UTF-8",
  "Content-Transfer-Encoding: base64",
  "",
  // base64 of: "Thanks!\n\nOn Mon, Jan 1, 2026 at 9:00 AM Support wrote:\n> Your invoice is attached."
  btoa("Thanks!\n\nOn Mon, Jan 1, 2026 at 9:00 AM Support wrote:\n> Your invoice is attached."),
].join("\n");

// ── Email 2: Outlook — "-----Original Message-----" + quoted-printable + encoded-word ──────────────
const outlookReply = [
  "From: bob@corp.example",
  "Subject: =?UTF-8?Q?RE=3A_Caf=C3=A9_booking?=", // "RE: Café booking"
  "Content-Type: text/plain; charset=UTF-8",
  "Content-Transfer-Encoding: quoted-printable",
  "",
  "Sounds good =E2=80=94 see you then.",
  "",
  "-----Original Message-----",
  "From: Support",
  "Sent: Monday",
  "Can you confirm the time?",
].join("\n");

// ── Email 3: multipart/alternative — text + HTML of the same body ──────────────────────────────────
const multipartAlt = [
  'Content-Type: multipart/alternative; boundary="b1"',
  "Subject: New ticket",
  "",
  "--b1",
  "Content-Type: text/plain",
  "",
  "Plain version",
  "--b1",
  "Content-Type: text/html",
  "",
  "<p>HTML version</p>",
  "--b1--",
].join("\n");

// ── Email 4: multipart/mixed with an attachment ────────────────────────────────────────────────────
const withAttachment = [
  'Content-Type: multipart/mixed; boundary="x"',
  "Subject: Logs",
  "",
  "--x",
  "Content-Type: text/plain",
  "",
  "See attached.",
  "--x",
  "Content-Type: application/octet-stream",
  'Content-Disposition: attachment; filename="error.log"',
  "",
  "(binary)",
  "--x--",
].join("\n");

// ── Email 5: signature with the RFC "-- " delimiter ────────────────────────────────────────────────
const withSignature = ["From: cs@example.com", "Subject: Hi", "", "The actual message.", "", "-- ", "Jane Doe", "Support Lead", "+1 555 123 4567"].join("\n");

describe("corpus: MIME parsing (S03)", () => {
  it("Gmail: decodes base64 body + encoded-word subject, and strips the quoted reply", () => {
    const p = parseEmail(gmailReply);
    expect(p.subject).toBe("Re: Invoice");
    expect(p.text).toContain("Thanks!");
    expect(stripForDisplay(p.text)).toBe("Thanks!"); // the "On … wrote:" quote is gone
  });

  it("Outlook: decodes quoted-printable (incl. non-ASCII) and strips the Original-Message block", () => {
    const p = parseEmail(outlookReply);
    expect(p.subject).toBe("RE: Café booking");
    expect(p.text).toContain("see you then");
    expect(p.text).toContain("—"); // =E2=80=94 decoded to an em-dash (the mojibake museum, handled)
    expect(stripForDisplay(p.text)).toBe("Sounds good — see you then.");
  });

  it("multipart/alternative: extracts BOTH text and html leaves of the tree", () => {
    const p = parseEmail(multipartAlt);
    expect(p.text).toBe("Plain version");
    expect(p.html).toBe("<p>HTML version</p>");
  });

  it("multipart/mixed: pulls out the attachment, keeps the body", () => {
    const p = parseEmail(withAttachment);
    expect(p.text).toBe("See attached.");
    expect(p.attachments).toEqual([{ filename: "error.log", contentType: "application/octet-stream" }]);
  });

  it("strips a '-- ' delimited signature (for display) but the raw still has it", () => {
    const p = parseEmail(withSignature);
    expect(p.text).toContain("Jane Doe"); // raw/parsed body keeps everything
    expect(stripForDisplay(p.text)).toBe("The actual message."); // display drops the signature
  });
});

describe("corpus: threading by subject (S03)", () => {
  const open = [
    { id: "conv-invoice", subject: "Invoice" },
    { id: "conv-booking", subject: "Café booking" },
  ];

  it("'Re: Re: Fwd: Invoice' normalizes and threads into the Invoice conversation", () => {
    expect(normalizeSubject("Re: Re: Fwd: Invoice")).toBe("invoice");
    expect(threadBySubject("Re: Re: Fwd: Invoice", open)).toBe("conv-invoice");
  });

  it("a brand-new subject starts a new conversation (null)", () => {
    expect(threadBySubject("Totally new question", open)).toBeNull();
  });

  it("quoted-reply stripping leaves only the new content", () => {
    const body = "My reply here.\n\nOn Tue someone wrote:\n> old stuff\n> more old stuff";
    expect(stripQuotedReply(body)).toBe("My reply here.");
  });
});
