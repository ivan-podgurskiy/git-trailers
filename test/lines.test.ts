import { describe, expect, it } from "vitest";

import { detectNewline, scanLines } from "../src/lines.js";

describe("physical line scanning", () => {
  it("retains exact CRLF and LF records with offsets", () => {
    expect(scanLines("a\r\nb\n")).toEqual([
      { index: 0, start: 0, end: 3, content: "a", eol: "\r\n", raw: "a\r\n" },
      { index: 1, start: 3, end: 5, content: "b", eol: "\n", raw: "b\n" },
    ]);
  });

  it("detects CRLF when it is present", () => {
    expect(detectNewline(scanLines("a\r\nb\r\n"))).toBe("\r\n");
  });

  it("uses LF when no newline is present", () => {
    expect(detectNewline(scanLines("a"))).toBe("\n");
  });
});
