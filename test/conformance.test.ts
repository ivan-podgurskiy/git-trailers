import { describe, expect, it } from "vitest";

import { addTrailers, parseTrailers } from "../src/index.js";
import type { AddOptions } from "../src/index.js";
import corpus from "./fixtures/conformance.json" with { type: "json" };

describe("Git 2.54.0 shared conformance corpus", () => {
  for (const testCase of corpus.parseCases) {
    it(`parses: ${testCase.name}`, () => {
      expect(parseTrailers(testCase.input, testCase.options)).toEqual(
        testCase.expected,
      );
    });
  }

  for (const testCase of corpus.addCases) {
    it(`adds: ${testCase.name}`, () => {
      expect(
        addTrailers(
          testCase.input,
          testCase.trailers,
          testCase.options as AddOptions | undefined,
        ),
      ).toBe(testCase.expected);
    });
  }
});
