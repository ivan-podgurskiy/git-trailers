import { readFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { spawnSync } from "node:child_process";

const REQUIRED_VERSION = "git version 2.54.0\n";
const gitBinary = process.env.GIT_TRAILERS_GIT;

if (!gitBinary) {
  fail("GIT_TRAILERS_GIT is required and must point to Git 2.54.0");
}

const cleanGitEnvironment = {
  ...process.env,
  GIT_CONFIG_GLOBAL: process.platform === "win32" ? "NUL" : "/dev/null",
  GIT_CONFIG_NOSYSTEM: "1",
  GIT_CONFIG_SYSTEM: process.platform === "win32" ? "NUL" : "/dev/null",
};
const version = spawnSync(gitBinary, ["--version"], {
  encoding: "utf8",
  env: cleanGitEnvironment,
  cwd: tmpdir(),
});

if (version.error) {
  fail(`unable to execute GIT_TRAILERS_GIT: ${version.error.message}`);
}
if (version.status !== 0) {
  fail(
    `GIT_TRAILERS_GIT --version exited ${version.status}: ${version.stderr}`,
  );
}
if (version.stdout !== REQUIRED_VERSION) {
  fail(
    `GIT_TRAILERS_GIT must report exactly ${JSON.stringify(
      REQUIRED_VERSION.trimEnd(),
    )}; received ${JSON.stringify(version.stdout.trimEnd())}`,
  );
}

let library;
try {
  library = await import("../dist/index.js");
} catch {
  fail(
    "dist/index.js is required; run npm run build before differential tests",
  );
}

const corpus = JSON.parse(
  readFileSync(
    new URL("../test/fixtures/conformance.json", import.meta.url),
    "utf8",
  ),
);
const failures = [];

for (const testCase of corpus.parseCases) {
  const options = testCase.options ?? {};
  const result = library.parseTrailers(testCase.input, options);
  const expected = result.trailers
    .map((trailer) => `${trailer.key}${trailer.separator} ${trailer.value}\n`)
    .join("");
  const args = gitConfigArgs(options);
  args.push("interpret-trailers");
  args.push(options.unfold === false ? "--only-trailers" : "--parse");
  if (options.unfold === false) args.push("--only-input");
  if (options.divider === false) args.push("--no-divider");
  compareGitOutput(`parse: ${testCase.name}`, args, testCase.input, expected);
}

for (const testCase of corpus.addCases) {
  const options = testCase.options ?? {};
  const expected = library.addTrailers(
    testCase.input,
    testCase.trailers,
    options,
  );
  const args = gitConfigArgs(options);
  args.push("interpret-trailers");
  if (options.where) args.push(`--where=${options.where}`);
  if (options.ifExists) args.push(`--if-exists=${options.ifExists}`);
  if (options.ifMissing) args.push(`--if-missing=${options.ifMissing}`);
  if (options.trimEmpty === true) args.push("--trim-empty");
  if (options.divider === false) args.push("--no-divider");
  for (const trailer of testCase.trailers) {
    args.push(`--trailer=${trailer.key}=${trailer.value}`);
  }
  compareGitOutput(`add: ${testCase.name}`, args, testCase.input, expected);
}

if (failures.length > 0) {
  for (const failure of failures) console.error(failure);
  fail(`${failures.length} differential comparison(s) failed`);
}

console.log(
  `Git 2.54.0 differential checks passed (${corpus.parseCases.length} parse, ${corpus.addCases.length} add)`,
);

function gitConfigArgs(options) {
  const args = [];
  if (options.separators) {
    args.push("-c", `trailer.separators=${options.separators}`);
  }
  for (const [index, key] of (options.knownKeys ?? []).entries()) {
    args.push("-c", `trailer.conformance${index}.key=${key}`);
  }
  return args;
}

function compareGitOutput(name, args, input, expected) {
  const result = spawnSync(gitBinary, args, {
    input,
    encoding: "utf8",
    env: cleanGitEnvironment,
    cwd: tmpdir(),
  });
  if (result.error) {
    failures.push(`${name}: failed to execute Git: ${result.error.message}`);
    return;
  }
  if (result.status !== 0) {
    failures.push(
      `${name}: Git exited ${result.status}: ${JSON.stringify(result.stderr)}`,
    );
    return;
  }
  if (result.stdout !== expected) {
    failures.push(
      `${name}: byte mismatch\nexpected ${JSON.stringify(expected)}\nreceived ${JSON.stringify(result.stdout)}`,
    );
  }
}

function fail(message) {
  console.error(message);
  process.exit(1);
}
