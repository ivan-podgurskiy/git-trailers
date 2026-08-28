import { readFile } from "node:fs/promises";

import { describe, expect, it } from "vitest";

describe("CI workflow", () => {
  it.each(["ci.yml", "publish.yml"])(
    "%s builds the pinned Git binary without optional curl support",
    async (filename) => {
      const workflow = await readFile(`.github/workflows/${filename}`, "utf8");

      expect(workflow).toContain(
        "make -j2 git NO_CURL=YesPlease NO_TCLTK=YesPlease",
      );
    },
  );
});
