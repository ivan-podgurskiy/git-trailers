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
