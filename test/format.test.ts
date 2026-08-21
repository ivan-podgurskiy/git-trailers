import { describe, expect, it } from "vitest";

import { formatTrailer, serializeTrailers } from "../src/index.js";

describe("trailer formatting", () => {
  it("canonicalizes a trailer using the default separator", () => {
    expect(formatTrailer({ key: " Fixes ", value: " #42 " })).toBe(
      "Fixes: #42",
    );
  });

  it("uses a requested separator", () => {
    expect(formatTrailer({ key: "Bug", value: "42" }, "#")).toBe("Bug# 42");
  });

  it("serializes trailers as newline-separated canonical lines", () => {
    expect(
      serializeTrailers([
        { key: "A", value: "1" },
        { key: "B", value: "2" },
      ]),
    ).toBe("A: 1\nB: 2");
  });

  it.each(["", "bad key"])("rejects an invalid key (%j)", (key) => {
    expect(() => formatTrailer({ key, value: "x" })).toThrow(TypeError);
  });
});
