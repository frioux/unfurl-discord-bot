import { describe, it, expect } from "vitest";
import { extractUrls, replaceUrl } from "../src/unfurl.js";

describe("extractUrls", () => {
  it("extracts a single URL from text", () => {
    const urls = extractUrls("check this out https://www.instagram.com/p/ABC123/");
    expect(urls).toEqual(["https://www.instagram.com/p/ABC123/"]);
  });

  it("extracts multiple URLs from text", () => {
    const urls = extractUrls("https://x.com/foo and https://www.instagram.com/p/123");
    expect(urls).toHaveLength(2);
  });

  it("returns empty array for text with no URLs", () => {
    const urls = extractUrls("no links here");
    expect(urls).toEqual([]);
  });

  it("handles URLs with query strings and fragments", () => {
    const urls = extractUrls("https://x.com/post?ref=home#top");
    expect(urls).toEqual(["https://x.com/post?ref=home#top"]);
  });

  it("extracts URLs from inside angle brackets", () => {
    const urls = extractUrls("check <https://x.com/foo> out");
    expect(urls).toEqual(["https://x.com/foo"]);
  });

  it("only matches http and https URLs", () => {
    const urls = extractUrls("not://a-real-url and https://valid.com/path");
    expect(urls).toEqual(["https://valid.com/path"]);
  });
});

describe("replaceUrl", () => {
  it("replaces the domain and preserves the path", () => {
    const result = replaceUrl("https://www.instagram.com/p/ABC123/", "www.instagram.com", "vxinstagram.com");
    expect(result).toBe("https://vxinstagram.com/p/ABC123/");
  });

  it("preserves query string and fragment", () => {
    const result = replaceUrl("https://x.com/post?ref=home#top", "x.com", "girlcockx.com");
    expect(result).toBe("https://girlcockx.com/post?ref=home#top");
  });

  it("preserves the protocol", () => {
    const result = replaceUrl("http://x.com/foo", "x.com", "girlcockx.com");
    expect(result).toBe("http://girlcockx.com/foo");
  });

  it("returns null if domain does not match", () => {
    const result = replaceUrl("https://other.com/path", "x.com", "girlcockx.com");
    expect(result).toBeNull();
  });
});
