import { describe, expect, it } from "vitest";

import { parseTrailers } from "../src/index.js";
// @ts-expect-error Vitest loads fixture text through Vite's raw import query.
import aiAttribution from "./fixtures/real-world/ai-attribution.txt?raw";
// @ts-expect-error Vitest loads fixture text through Vite's raw import query.
import linuxSignedOff from "./fixtures/real-world/linux-signed-off.txt?raw";

describe("real-world commit message fixtures", () => {
  it("parses a Linux-style review and Signed-off-by chain", () => {
    expect(parseTrailers(linuxSignedOff)).toEqual({
      subject: "net: account transmitted packets exactly once",
      body: "\nAvoid charging the packet counter on both the retry and completion paths.\n",
      blockStart: 4,
      hasDivider: false,
      trailers: [
        {
          key: "Fixes",
          value: '0123456789ab ("net: introduce packet accounting")',
          raw: 'Fixes: 0123456789ab ("net: introduce packet accounting")\n',
          separator: ":",
        },
        {
          key: "Reported-by",
          value: "Alice Example <alice@example.com>",
          raw: "Reported-by: Alice Example <alice@example.com>\n",
          separator: ":",
        },
        {
          key: "Reviewed-by",
          value: "Bob Example <bob@example.com>",
          raw: "Reviewed-by: Bob Example <bob@example.com>\n",
          separator: ":",
        },
        {
          key: "Signed-off-by",
          value: "Carol Example <carol@example.com>",
          raw: "Signed-off-by: Carol Example <carol@example.com>\n",
          separator: ":",
        },
        {
          key: "Signed-off-by",
          value: "David Example <david@example.com>",
          raw: "Signed-off-by: David Example <david@example.com>\n",
          separator: ":",
        },
      ],
    });
  });

  it("parses modern co-author and generator attribution trailers", () => {
    expect(parseTrailers(aiAttribution)).toEqual({
      subject: "feat: preserve generated change attribution",
      body: "\nKeep authorship and tool provenance available to audit consumers.\n",
      blockStart: 4,
      hasDivider: false,
      trailers: [
        {
          key: "Co-authored-by",
          value: "Claude <noreply@anthropic.com>",
          raw: "Co-authored-by: Claude <noreply@anthropic.com>\n",
          separator: ":",
        },
        {
          key: "Generated-with",
          value: "Claude Code",
          raw: "Generated-with: Claude Code\n",
          separator: ":",
        },
        {
          key: "Reviewed-by",
          value: "Ada Example <ada@example.com>",
          raw: "Reviewed-by: Ada Example <ada@example.com>\n",
          separator: ":",
        },
      ],
    });
  });
});
