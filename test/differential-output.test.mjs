import { expect, test } from "vitest";

import { buildExpectedParseOutput } from "../scripts/differential-output.mjs";

test("Git parse stdout uses the first configured separator", () => {
  const result = {
    trailers: [
      {
        key: "Key",
        value: "value",
        raw: "Key: value\n",
        separator: ":",
      },
    ],
  };

  expect(buildExpectedParseOutput(result, { separators: "%:" })).toBe(
    "Key% value\n",
  );
});

test("Git parse stdout uses configured key casing for a known key", () => {
  const result = {
    trailers: [
      {
        key: "Audit-key",
        value: "yes",
        raw: "Audit-key: yes\n",
        separator: ":",
      },
    ],
  };

  expect(buildExpectedParseOutput(result, { knownKeys: ["audit-KEY"] })).toBe(
    "audit-KEY: yes\n",
  );
});
