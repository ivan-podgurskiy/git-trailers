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

  it("uses the leading trailer as the duplicate neighbor for start insertion", () => {
    const message = "subject\n\nFixes: one\nReviewed-by: A\n";
    expect(
      addTrailers(message, [{ key: "Fixes", value: "one" }], {
        where: "start",
      }),
    ).toBe(message);
  });

  it("uses the trailer after a before insertion as its duplicate neighbor", () => {
    const message = "subject\n\nReviewed-by: A\nFixes: two\n";
    expect(
      addTrailers(message, [{ key: "Fixes", value: "two" }], {
        where: "before",
      }),
    ).toBe(message);
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

  it("places start at the beginning of the block, not the first matching key", () => {
    expect(
      addTrailers(
        "subject\n\nReviewed-by: A\nFixes: one\n",
        [{ key: "Fixes", value: "two" }],
        { where: "start", ifExists: "add" },
      ),
    ).toBe("subject\n\nFixes: two\nReviewed-by: A\nFixes: one\n");
  });

  it("applies additions sequentially", () => {
    expect(
      addTrailers("subject", [
        { key: "Reviewed-by", value: "A" },
        { key: "Reviewed-by", value: "B" },
      ]),
    ).toBe("subject\n\nReviewed-by: A\nReviewed-by: B\n");
  });

  it("uses observed CRLF when mutating an existing block", () => {
    expect(
      addTrailers("subject\r\n\r\nFixes: one\r\n", [
        { key: "Reviewed-by", value: "A" },
      ]),
    ).toBe("subject\r\n\r\nFixes: one\r\nReviewed-by: A\r\n");
  });

  it("recognizes an overlapping hyphen separator for replacement and canonicalization", () => {
    expect(
      addTrailers("subject\n\nFixes- one\n", [{ key: "fixes", value: "two" }], {
        separators: "-:",
        ifExists: "replace",
      }),
    ).toBe("subject\n\nfixes- two\n");
  });

  it("recognizes an alphanumeric configured separator", () => {
    expect(
      addTrailers("subject\n\nFixesa one\n", [{ key: "Fixes", value: "two" }], {
        separators: "a:",
        ifExists: "replace",
      }),
    ).toBe("subject\n\nFixesa two\n");
  });

  it("uses the first repeated overlapping separator for canonical trailer records", () => {
    expect(
      addTrailers(
        "subject\n\nSigned-off-by: A\n",
        [{ key: "Signed", value: "B" }],
        { separators: "-:", ifExists: "add" },
      ),
    ).toBe("subject\n\nSigned- off-by: A\nSigned- B\n");
  });

  it("recognizes a folded overlapping-separator trailer without appending a block", () => {
    const message = "subject\n\nFixes- one\n  continued\n";
    expect(
      addTrailers(message, [{ key: "Fixes", value: "one continued" }], {
        separators: "-:",
      }),
    ).toBe(message);
  });

  it("rejects an orphan continuation from an overlapping-separator fallback block", () => {
    expect(
      addTrailers(
        "subject\n\n  orphan\nFixes- one\n",
        [{ key: "Reviewed-by", value: "A" }],
        { separators: "-:" },
      ),
    ).toBe("subject\n\n  orphan\nFixes- one\n\nReviewed-by- A\n");
  });

  it("retains folded trailers and internal non-trailer records", () => {
    expect(
      addTrailers(
        "subject\n\nSigned-off-by: A\n  folded value\nnot trailer\n",
        [{ key: "Reviewed-by", value: "B" }],
      ),
    ).toBe(
      "subject\n\nSigned-off-by: A\n  folded value\nnot trailer\nReviewed-by: B\n",
    );
  });

  it("inserts before a trailing ignored blank and comment suffix", () => {
    expect(
      addTrailers("subject\n\nbody\n\n# keep\n", [
        { key: "Reviewed-by", value: "A" },
      ]),
    ).toBe("subject\n\nbody\n\nReviewed-by: A\n\n# keep\n");
  });

  it("preserves a scissors suffix when divider processing is disabled", () => {
    expect(
      addTrailers(
        "subject\n\n# ------------------------ >8 ------------------------\nignored\n",
        [{ key: "Reviewed-by", value: "A" }],
        { divider: false },
      ),
    ).toBe(
      "subject\n\nReviewed-by: A\n\n# ------------------------ >8 ------------------------\nignored\n",
    );
  });

  it("validates empty additions before returning the original message", () => {
    expect(() =>
      addTrailers("subject", [], { where: "middle" as never }),
    ).toThrow(TypeError);
  });

  it("rejects invalid add arguments and options", () => {
    expect(() =>
      addTrailers("subject", null as unknown as [], undefined),
    ).toThrow(TypeError);
    expect(() =>
      addTrailers("subject", [{ key: "invalid key", value: "A" }]),
    ).toThrow(TypeError);
    expect(() =>
      addTrailers("subject", [{ key: "Reviewed-by", value: "A" }], {
        separators: "",
      }),
    ).toThrow(TypeError);
  });

  it("leaves a divider and patch suffix byte-for-byte unchanged", () => {
    expect(
      addTrailers("subject\n\n---\ndiff --git a/a b/a\n", [
        { key: "Reviewed-by", value: "A" },
      ]),
    ).toBe("subject\n\nReviewed-by: A\n\n---\ndiff --git a/a b/a\n");
  });
});
