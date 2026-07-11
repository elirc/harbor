import { describe, it, expect } from "vitest";
import { slugify, publishedOnly, escapeHtml, renderArticleHtml } from "./helpcenter";

describe("slugify (S05)", () => {
  it("lowercases, hyphenates, strips diacritics and trims", () => {
    expect(slugify("Getting Started")).toBe("getting-started");
    expect(slugify("  How do I reset my café password?! ")).toBe("how-do-i-reset-my-cafe-password");
    expect(slugify("!!!")).toBe("untitled"); // no usable characters
  });
});

describe("publishedOnly (S05)", () => {
  it("drops drafts so they never reach the public site", () => {
    const arts = [
      { slug: "a", status: "published" },
      { slug: "b", status: "draft" },
      { slug: "c", status: "published" },
    ];
    expect(publishedOnly(arts).map((a) => a.slug)).toEqual(["a", "c"]);
  });
});

describe("help-center HTML rendering (S05)", () => {
  it("escapes untrusted article content (no stored XSS on a public page)", () => {
    expect(escapeHtml(`<script>alert('x')</script>`)).toBe("&lt;script&gt;alert(&#39;x&#39;)&lt;/script&gt;");
  });

  it("renders a full document with title, canonical, and escaped body", () => {
    const html = renderArticleHtml({
      slug: "hi",
      title: "Hi <b>there</b>",
      body: "First para.\n\nSecond <i>para</i>.",
      status: "published",
      categoryName: "Basics",
    });
    expect(html).toContain("<!doctype html>");
    expect(html).toContain("<h1>Hi &lt;b&gt;there&lt;/b&gt;</h1>"); // title escaped
    expect(html).toContain('<link rel="canonical" href="/help/hi">');
    expect(html).toContain("<p>Second &lt;i&gt;para&lt;/i&gt;.</p>"); // body escaped + split
    expect(html).not.toContain("<b>there</b>"); // raw HTML must not survive
  });
});
