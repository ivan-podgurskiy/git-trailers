import { spawnSync } from "node:child_process";
import {
  chmodSync,
  copyFileSync,
  existsSync,
  mkdirSync,
  mkdtempSync,
  readFileSync,
  rmSync,
  writeFileSync,
} from "node:fs";
import { tmpdir } from "node:os";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

import { expect, test } from "vitest";

const projectRoot = dirname(dirname(fileURLToPath(import.meta.url)));

test("differential Git subprocesses ignore ambient Git state and use a fresh directory", () => {
  const fixtureRoot = mkdtempSync(join(tmpdir(), "git-trailers-runner-test-"));

  try {
    const runner = join(fixtureRoot, "scripts", "differential.mjs");
    const corpus = join(fixtureRoot, "test", "fixtures", "conformance.json");
    const library = join(fixtureRoot, "dist", "index.js");
    const marker = join(fixtureRoot, "git-invocations.jsonl");
    const fakeGit = join(fixtureRoot, "fake-git.mjs");

    mkdirSync(dirname(runner), { recursive: true });
    mkdirSync(dirname(corpus), { recursive: true });
    mkdirSync(dirname(library), { recursive: true });
    copyFileSync(join(projectRoot, "scripts", "differential.mjs"), runner);
    copyFileSync(
      join(projectRoot, "scripts", "differential-output.mjs"),
      join(fixtureRoot, "scripts", "differential-output.mjs"),
    );
    copyFileSync(
      join(projectRoot, "test", "fixtures", "conformance.json"),
      corpus,
    );
    const corpusData = JSON.parse(readFileSync(corpus, "utf8"));
    writeFileSync(
      library,
      `
        import { readFileSync } from "node:fs";
        const corpus = JSON.parse(readFileSync(new URL("../test/fixtures/conformance.json", import.meta.url), "utf8"));
        const optionsMatch = (left, right) => JSON.stringify(left ?? {}) === JSON.stringify(right ?? {});
        export function parseTrailers(input, options) {
          return corpus.parseCases.find((item) => item.input === input && optionsMatch(item.options, options))?.expected ?? { trailers: [] };
        }
        export function addTrailers(input, trailers, options) {
          return corpus.addCases.find((item) => item.input === input && optionsMatch(item.options, options))?.expected ?? input;
        }
      `,
    );
    writeFileSync(
      fakeGit,
      `#!${process.execPath}
        import { appendFileSync, readdirSync, realpathSync } from "node:fs";
        const gitEnvironment = Object.fromEntries(Object.entries(process.env).filter(([key]) => key.startsWith("GIT_")));
        appendFileSync(${JSON.stringify(marker)}, JSON.stringify({ cwd: process.cwd(), entries: readdirSync(process.cwd()), gitEnvironment, home: process.env.HOME, homeReal: realpathSync(process.env.HOME), xdg: process.env.XDG_CONFIG_HOME, xdgReal: realpathSync(process.env.XDG_CONFIG_HOME) }) + "\\n");
        if (process.argv[2] === "--version") process.stdout.write("git version 2.54.0\\n");
      `,
    );
    chmodSync(fakeGit, 0o755);

    const maliciousGitEnvironment = {
      GIT_CONFIG_COUNT: "2",
      GIT_CONFIG_KEY_0: "trailer.separators",
      GIT_CONFIG_VALUE_0: "%",
      GIT_CONFIG_KEY_1: "core.commentChar",
      GIT_CONFIG_VALUE_1: ";",
      GIT_CONFIG_PARAMETERS: "'trailer.separators=%'",
      GIT_DIR: join(fixtureRoot, "host.git"),
      GIT_WORK_TREE: join(fixtureRoot, "host-worktree"),
      GIT_COMMON_DIR: join(fixtureRoot, "common.git"),
      GIT_OBJECT_DIRECTORY: join(fixtureRoot, "objects"),
      GIT_ALTERNATE_OBJECT_DIRECTORIES: join(fixtureRoot, "alternate-objects"),
      GIT_INDEX_FILE: join(fixtureRoot, "index"),
      GIT_CEILING_DIRECTORIES: fixtureRoot,
      GIT_DISCOVERY_ACROSS_FILESYSTEM: "1",
      GIT_NAMESPACE: "injected",
      GIT_PREFIX: "injected/",
      GIT_TRACE: "1",
      GIT_EXEC_PATH: join(fixtureRoot, "exec-path"),
      GIT_CONFIG_GLOBAL: join(fixtureRoot, "global-config"),
      GIT_CONFIG_SYSTEM: join(fixtureRoot, "system-config"),
    };
    const result = spawnSync(process.execPath, [runner], {
      encoding: "utf8",
      env: {
        ...process.env,
        ...maliciousGitEnvironment,
        GIT_TRAILERS_GIT: fakeGit,
        HOME: join(fixtureRoot, "host-home"),
        XDG_CONFIG_HOME: join(fixtureRoot, "host-xdg"),
      },
    });

    expect(result.status).toBe(1);
    const invocations = readFileSync(marker, "utf8")
      .trimEnd()
      .split("\n")
      .map((line) => JSON.parse(line));
    expect(invocations).toHaveLength(
      1 + corpusData.parseCases.length + corpusData.addCases.length + 8,
    );
    expect(new Set(invocations.map((invocation) => invocation.cwd)).size).toBe(
      1,
    );
    for (const invocation of invocations) {
      expect(invocation.entries).toEqual([]);
      expect(invocation.gitEnvironment).toEqual({
        GIT_CONFIG_NOSYSTEM: "1",
      });
      for (const key of Object.keys(maliciousGitEnvironment)) {
        expect(invocation.gitEnvironment[key]).toBeUndefined();
      }
      expect(invocation.home).not.toBe(join(fixtureRoot, "host-home"));
      expect(invocation.xdg).not.toBe(join(fixtureRoot, "host-xdg"));
      expect(dirname(invocation.homeReal)).toBe(dirname(invocation.cwd));
      expect(dirname(invocation.xdgReal)).toBe(dirname(invocation.cwd));
    }
    expect(existsSync(invocations[0].cwd)).toBe(false);
  } finally {
    rmSync(fixtureRoot, { recursive: true, force: true });
  }
});
