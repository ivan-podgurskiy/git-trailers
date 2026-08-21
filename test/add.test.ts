import { describe, expect, it } from "vitest";

import { addTrailers } from "../src/index.js";

const base = "subject\n\nFixes: one\nReviewed-by: A\nFixes: two\n";

describe("addTrailers", () => {
  it.each([
    [
      "end",
      "subject\n\nFixes: one\nReviewed-by: A\nFixes: two\nFixes: three\n",
    ],
    [
      "start",
      "subject\n\nFixes: three\nFixes: one\nReviewed-by: A\nFixes: two\n",
    ],
    [
      "after",
      "subject\n\nFixes: one\nReviewed-by: A\nFixes: two\nFixes: three\n",
    ],
    [
      "before",
      "subject\n\nFixes: three\nFixes: one\nReviewed-by: A\nFixes: two\n",
    ],
  ] as const)("places an existing key at %s", (where, expected) => {
    expect(
      addTrailers(base, [{ key: "Fixes", value: "three" }], { where }),
    ).toBe(expected);
  });

  it("suppresses an identical insertion neighbor", () => {
    expect(addTrailers(base, [{ key: "Fixes", value: "two" }])).toBe(base);
  });

  it("allows a value that differs from its insertion neighbor", () => {
    expect(addTrailers(base, [{ key: "Fixes", value: "one" }])).toBe(
      "subject\n\nFixes: one\nReviewed-by: A\nFixes: two\nFixes: one\n",
    );
  });

  it("suppresses a case-insensitive existing key and value", () => {
    expect(
      addTrailers(base, [{ key: "fixes", value: "ONE" }], {
        ifExists: "addIfDifferent",
      }),
    ).toBe(base);
  });

  it("always adds when requested", () => {
    expect(
      addTrailers(base, [{ key: "Fixes", value: "two" }], { ifExists: "add" }),
    ).toBe("subject\n\nFixes: one\nReviewed-by: A\nFixes: two\nFixes: two\n");
  });

  it("replaces the matching key nearest the insertion point", () => {
    expect(
      addTrailers(base, [{ key: "Fixes", value: "three" }], {
        ifExists: "replace",
      }),
    ).toBe("subject\n\nFixes: one\nReviewed-by: A\nFixes: three\n");
  });

  it("does nothing for a prefix-matching existing key", () => {
    expect(
      addTrailers(base, [{ key: "Fix", value: "three" }], {
        ifExists: "doNothing",
      }),
    ).toBe(base);
  });

  it("does nothing for an absent key when configured", () => {
    expect(
      addTrailers(base, [{ key: "Acked-by", value: "A" }], {
        ifMissing: "doNothing",
      }),
    ).toBe(base);
  });

  it("trims existing and incoming empty trailers", () => {
    expect(
      addTrailers(
        "subject\n\nFixes:   \nReviewed-by: A\n",
        [{ key: "Acked-by", value: " \t " }],
        { trimEmpty: true },
      ),
    ).toBe("subject\n\nReviewed-by: A\n");
  });

  it("keeps a block byte-for-byte when trimEmpty removes nothing", () => {
    const message = "subject\n\nFixes : one\n";
    expect(
      addTrailers(message, [{ key: "Fixes", value: "one" }], {
        trimEmpty: true,
      }),
    ).toBe(message);
  });

  it("returns an empty addition list byte-for-byte", () => {
    const message = "subject\r\n\r\nFixes: one\r\n";
    expect(addTrailers(message, [])).toBe(message);
  });

  it("creates a newline-terminated trailer block", () => {
    expect(addTrailers("subject", [{ key: "Reviewed-by", value: "A" }])).toBe(
      "subject\n\nReviewed-by: A\n",
    );
  });

  it("leaves a divider and patch suffix byte-for-byte unchanged", () => {
    expect(
      addTrailers("subject\n\n---\ndiff --git a/a b/a\n", [
        { key: "Reviewed-by", value: "A" },
      ]),
    ).toBe("subject\n\nReviewed-by: A\n---\ndiff --git a/a b/a\n");
  });
});
