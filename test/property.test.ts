import fc from "fast-check";
import { describe, expect, it } from "vitest";

import { addTrailers, formatTrailer, parseTrailers } from "../src/index.js";

const safeText = fc.string({
  unit: fc.constantFrom(
    ..."abcdefghijklmnopqrstuvwxyzABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789 .,!?",
  ),
});
const trailerValue = fc.string().filter((value) => !/[\r\n]/.test(value));

describe("public API properties", () => {
  it("parseTrailers is total for arbitrary message strings", () => {
    fc.assert(
      fc.property(fc.string(), (message) => {
        expect(() => parseTrailers(message)).not.toThrow();
      }),
      { numRuns: 1_000, seed: 0x75130001 },
    );
  });

  it("repeated parsing is stable for arbitrary message strings", () => {
    fc.assert(
      fc.property(fc.string(), (message) => {
        const first = parseTrailers(message);
        expect(parseTrailers(message)).toEqual(first);
        expect(parseTrailers(message)).toEqual(first);
      }),
      { numRuns: 1_000, seed: 0x75130006 },
    );
  });

  it("an always-added trailer is observable through parsing", () => {
    fc.assert(
      fc.property(
        fc.string(),
        fc.stringMatching(/^[A-Za-z0-9-]+$/),
        trailerValue,
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

  it("multiline TrailerInput values are always rejected", () => {
    fc.assert(
      fc.property(
        trailerValue,
        fc.constantFrom("\n", "\r", "\r\n"),
        trailerValue,
        (before, lineBreak, after) => {
          const value = `${before}${lineBreak}${after}`;
          expect(() => formatTrailer({ key: "Key", value })).toThrow(TypeError);
          expect(() => addTrailers("subject", [{ key: "Key", value }])).toThrow(
            TypeError,
          );
        },
      ),
      { numRuns: 500, seed: 0x75130005 },
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
