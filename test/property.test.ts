import fc from "fast-check";
import { describe, expect, it } from "vitest";

import { addTrailers, parseTrailers } from "../src/index.js";

const safeText = fc.string({
  unit: fc.constantFrom(
    ..."abcdefghijklmnopqrstuvwxyzABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789 .,!?",
  ),
});

describe("public API properties", () => {
  it("parseTrailers is total for arbitrary message strings", () => {
    fc.assert(
      fc.property(fc.string(), (message) => {
        expect(() => parseTrailers(message)).not.toThrow();
      }),
      { numRuns: 1_000, seed: 0x75130001 },
    );
  });

  it("an always-added trailer is observable through parsing", () => {
    fc.assert(
      fc.property(
        fc.string(),
        fc.stringMatching(/^[A-Za-z0-9-]+$/),
        fc.string(),
        (message, key, value) => {
          const output = addTrailers(message, [{ key, value }], {
            ifExists: "add",
          });
          expect(
            parseTrailers(output).trailers.some(
              (trailer) => trailer.key.toLowerCase() === key.toLowerCase(),
            ),
          ).toBe(true);
        },
      ),
      { numRuns: 500, seed: 0x75130002 },
    );
  });

  it("unfolding an already unfolded value is idempotent", () => {
    fc.assert(
      fc.property(safeText, safeText, (first, second) => {
        const folded = parseTrailers(`subject\n\nKey: ${first}\n  ${second}\n`)
          .trailers[0]!.value;
        const unfoldedAgain = parseTrailers(`subject\n\nKey: ${folded}\n`)
          .trailers[0]!.value;
        expect(unfoldedAgain).toBe(folded);
      }),
      { numRuns: 500, seed: 0x75130003 },
    );
  });

  it("mutation preserves generated prefix and divider suffix byte-for-byte", () => {
    fc.assert(
      fc.property(safeText, safeText, (body, patch) => {
        const prefix = `subject\n\n${body}\n\n`;
        const suffix = `---\n${patch}`;
        const output = addTrailers(`${prefix}Key: old\n${suffix}`, [
          { key: "Reviewed-by", value: "Alice" },
        ]);
        expect(output.startsWith(prefix)).toBe(true);
        expect(output.endsWith(suffix)).toBe(true);
      }),
      { numRuns: 500, seed: 0x75130004 },
    );
  });
});
