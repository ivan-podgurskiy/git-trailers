import { describe, expect, it } from "vitest";

import { validatePackageExports } from "../scripts/package-exports.mjs";

const validPackage = {
  main: "./dist/index.cjs",
  module: "./dist/index.js",
  types: "./dist/index.d.ts",
  exports: {
    ".": {
      import: {
        types: "./dist/index.d.ts",
        default: "./dist/index.js",
      },
      require: {
        types: "./dist/index.d.cts",
        default: "./dist/index.cjs",
      },
    },
  },
};

describe("package export validation", () => {
  it("accepts the exact condition order", () => {
    expect(validatePackageExports(validPackage)).toEqual([]);
  });

  it("rejects reordered nested conditions", () => {
    const reorderedPackage = structuredClone(validPackage);
    reorderedPackage.exports["."].import = {
      default: "./dist/index.js",
      types: "./dist/index.d.ts",
    };

    expect(validatePackageExports(reorderedPackage)).not.toEqual([]);
  });
});
