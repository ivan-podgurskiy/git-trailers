import { createHash } from "node:crypto";
import { readFileSync } from "node:fs";

const EXPECTED_SHA256 =
  "46a387d535d6b70ca797900e20fd5081ce160358e0dd92265bc2b6993f799306";
const fixture = new URL("../test/fixtures/conformance.json", import.meta.url);
const actual = createHash("sha256").update(readFileSync(fixture)).digest("hex");

if (actual !== EXPECTED_SHA256) {
  console.error(
    `conformance.json SHA-256 mismatch\nexpected: ${EXPECTED_SHA256}\nactual:   ${actual}`,
  );
  process.exitCode = 1;
} else {
  console.log(`conformance.json SHA-256 ${actual}`);
}
