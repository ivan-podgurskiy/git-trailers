import { describe, expect, it } from "vitest";

import { parseTrailers } from "../src/index.js";

describe("parseTrailers", () => {
  it("returns all post-subject content as body when no block is found", () => {
    expect(parseTrailers("subject\n\nbody")).toMatchObject({
      subject: "subject",
      body: "\nbody",
      trailers: [],
      blockStart: -1,
      hasDivider: false,
    });
  });

  it("parses a signed-off-by trailer", () => {
    expect(
      parseTrailers("subject\n\nSigned-off-by: Alice <a@example.com>\n"),
    ).toEqual({
      subject: "subject",
      body: "",
      trailers: [
        {
          key: "Signed-off-by",
          value: "Alice <a@example.com>",
          raw: "Signed-off-by: Alice <a@example.com>\n",
          separator: ":",
        },
      ],
      blockStart: 2,
      hasDivider: false,
    });
  });

  it("unfolds continuation lines by default while retaining their raw text", () => {
    expect(parseTrailers("s\n\nKey: one\n  two\n")).toMatchObject({
      trailers: [
        {
          key: "Key",
          value: "one two",
          raw: "Key: one\n  two\n",
          separator: ":",
        },
      ],
    });
  });

  it("accepts a block at the built-in recognized-prefix 25 percent boundary", () => {
    expect(
      parseTrailers(
        "s\n\nSigned-off-by: A\nnot trailer\nnot trailer\nnot trailer\n",
      ),
    ).toHaveProperty("trailers.length", 1);
  });

  it("keeps body as the contiguous pre-block region for a 25 percent candidate", () => {
    expect(
      parseTrailers(
        "s\n\nSigned-off-by: A\nnot trailer\nnot trailer\nnot trailer\n",
      ),
    ).toMatchObject({ body: "", blockStart: 2 });
  });

  it("uses a configured known key for the 25 percent boundary", () => {
    expect(
      parseTrailers("s\n\nKnown: A\nnot trailer\nnot trailer\nnot trailer\n", {
        knownKeys: ["Known"],
      }),
    ).toHaveProperty("trailers.length", 1);
  });

  it("accepts a cherry-pick recognized block without returning the prefix", () => {
    expect(
      parseTrailers(
        "s\n\n(cherry picked from commit abcdef)\none\ntwo\nthree\n",
      ),
    ).toMatchObject({
      trailers: [],
      body: "",
      blockStart: 2,
    });
  });

  it("counts a folded trailer atomically for the 25 percent rule", () => {
    expect(
      parseTrailers("s\n\nKnown: A\n  folded\none\ntwo\nthree\nfour\n", {
        knownKeys: ["Known"],
      }),
    ).toMatchObject({
      trailers: [],
      blockStart: -1,
    });
  });

  it("uses the first configured separator when it overlaps key characters", () => {
    expect(
      parseTrailers("s\n\nSigned-off-by: Alice\n", { separators: "-:" }),
    ).toMatchObject({
      trailers: [
        {
          key: "Signed",
          value: "off-by: Alice",
          separator: "-",
        },
      ],
    });
  });

  it("rejects a line when the first configured separator occurs at offset zero", () => {
    expect(
      parseTrailers("subject\n\nKey: value\n", { separators: "K:" }),
    ).toMatchObject({
      trailers: [],
      body: "\nKey: value\n",
      blockStart: -1,
    });
  });

  it("ends a trailer block at a divider before a patch", () => {
    expect(
      parseTrailers("s\n\nKey: v\n---\ndiff --git a/a b/a\n"),
    ).toMatchObject({
      hasDivider: true,
      blockStart: 2,
    });
  });

  it("ignores an internal default comment while detecting an all-trailer block", () => {
    expect(parseTrailers("s\n\nKey: one\n# note\nOther: two\n")).toMatchObject({
      blockStart: 2,
      trailers: [
        { key: "Key", value: "one", raw: "Key: one\n" },
        { key: "Other", value: "two", raw: "Other: two\n" },
      ],
    });
  });

  it("rejects an unrecognized block with a leading orphan continuation", () => {
    expect(
      parseTrailers("s\n\n  orphan continuation\nKey: value\n"),
    ).toMatchObject({
      blockStart: -1,
      trailers: [],
    });
  });
});
