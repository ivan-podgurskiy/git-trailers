import { createHash } from "node:crypto";
import { readFileSync } from "node:fs";

const EXPECTED_SHA256 =
  "8e57140d1b93d3d92f08cc43d91eeb507fb9af0a9ef60d4f966e6e175db2ac68";
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
