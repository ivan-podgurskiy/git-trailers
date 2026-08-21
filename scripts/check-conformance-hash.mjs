import { createHash } from "node:crypto";
import { readFileSync } from "node:fs";

const EXPECTED_SHA256 =
  "4106d80b602f1b35e6b1d1bbd2f212431b6cc1538eb018f550adbd23f3093227";
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
