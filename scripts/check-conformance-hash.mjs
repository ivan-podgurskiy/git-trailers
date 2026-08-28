import { createHash } from "node:crypto";
import { readFileSync } from "node:fs";

const EXPECTED_SHA256 =
  "370656cc18b2c753b458b26e824f1cc095a0b6a1ac4143a78da898c6623cddf8";
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
