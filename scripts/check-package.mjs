import { execFileSync } from "node:child_process";
import { mkdtempSync, readFileSync, rmSync } from "node:fs";
import { createRequire } from "node:module";
import { tmpdir } from "node:os";
import { join } from "node:path";

const MAX_UNPACKED_SIZE = 42_445;
const expectedFiles = [
  "CHANGELOG.md",
  "LICENSE",
  "README.md",
  "THIRD_PARTY_NOTICES.md",
  "dist/index.cjs",
  "dist/index.d.cts",
  "dist/index.d.ts",
  "dist/index.js",
  "package.json",
].sort();
const expectedRuntimeExports = [
  "addTrailers",
  "formatTrailer",
  "parseTrailers",
  "serializeTrailers",
].sort();
const expectedDeclarationExports = [
  "AddOptions",
  "AddWhere",
  "IfExists",
  "IfMissing",
  "ParseOptions",
  "ParseResult",
  "Trailer",
  "TrailerInput",
  ...expectedRuntimeExports,
];

verifyPackageExports();
await verifyBuildOutputs();

const cache = mkdtempSync(join(tmpdir(), "git-trailers-pack-"));
let output;

try {
  output = execFileSync(
    "npm",
    ["pack", "--dry-run", "--json", "--ignore-scripts", "--cache", cache],
    { encoding: "utf8" },
  );
} finally {
  rmSync(cache, { recursive: true, force: true });
}

const manifests = JSON.parse(output);
if (!Array.isArray(manifests) || manifests.length !== 1) {
  throw new Error("npm pack did not return exactly one package manifest.");
}

const manifest = manifests[0];
if (
  !Array.isArray(manifest.files) ||
  typeof manifest.unpackedSize !== "number"
) {
  throw new Error("npm pack manifest is missing files or unpackedSize.");
}

const actualFiles = manifest.files.map(({ path }) => path).sort();
const duplicates = actualFiles.filter(
  (path, index) => index > 0 && path === actualFiles[index - 1],
);
const missing = expectedFiles.filter((path) => !actualFiles.includes(path));
const extra = actualFiles.filter((path) => !expectedFiles.includes(path));
const prohibited = actualFiles.filter((path) =>
  /(^|\/)(?:src|test|tests|\.agent-work|\.superpowers)(\/|$)|(?:^|\/)(?:.*(?:prd|plan|spec|research|review).*\.md)$/i.test(
    path,
  ),
);

if (duplicates.length > 0 || missing.length > 0 || extra.length > 0) {
  throw new Error(
    [
      "Unexpected package contents.",
      `Expected: ${expectedFiles.join(", ")}`,
      `Actual: ${actualFiles.join(", ")}`,
      duplicates.length > 0 ? `Duplicates: ${duplicates.join(", ")}` : "",
      missing.length > 0 ? `Missing: ${missing.join(", ")}` : "",
      extra.length > 0 ? `Extra: ${extra.join(", ")}` : "",
    ]
      .filter(Boolean)
      .join("\n"),
  );
}

if (prohibited.length > 0) {
  throw new Error(
    `Package contains prohibited source, test, or meta-document files: ${prohibited.join(", ")}`,
  );
}

if (manifest.unpackedSize > MAX_UNPACKED_SIZE) {
  throw new Error(
    `Package unpacked size exceeds ${MAX_UNPACKED_SIZE} bytes: ${manifest.unpackedSize} bytes.`,
  );
}

console.log(
  `Package contents and exports verified (${actualFiles.length} files, ${manifest.unpackedSize} bytes; ceiling ${MAX_UNPACKED_SIZE} bytes).`,
);
console.log(
  manifest.files.map(({ path, size }) => `- ${path}: ${size} bytes`).join("\n"),
);

function verifyPackageExports() {
  const packageJson = JSON.parse(readFileSync("package.json", "utf8"));
  const expectedMetadata = {
    main: "./dist/index.cjs",
    module: "./dist/index.js",
    types: "./dist/index.d.ts",
  };

  for (const [key, value] of Object.entries(expectedMetadata)) {
    if (packageJson[key] !== value) {
      throw new Error(`package.json ${key} must be ${value}.`);
    }
  }

  const rootExport = packageJson.exports?.["."];
  if (
    rootExport?.types !== "./dist/index.d.ts" ||
    rootExport?.import !== "./dist/index.js" ||
    rootExport?.require !== "./dist/index.cjs"
  ) {
    throw new Error(
      "package.json exports must map types, import, and require to dist/index outputs.",
    );
  }
}

async function verifyBuildOutputs() {
  const esm = await import("../dist/index.js");
  const require = createRequire(import.meta.url);
  const commonJs = require("../dist/index.cjs");
  const esmExports = Object.keys(esm).sort();
  const commonJsExports = Object.keys(commonJs).sort();

  if (JSON.stringify(esmExports) !== JSON.stringify(expectedRuntimeExports)) {
    throw new Error(`Unexpected ESM exports: ${esmExports.join(", ")}`);
  }
  if (
    JSON.stringify(commonJsExports) !== JSON.stringify(expectedRuntimeExports)
  ) {
    throw new Error(
      `Unexpected CommonJS exports: ${commonJsExports.join(", ")}`,
    );
  }

  for (const file of ["dist/index.d.ts", "dist/index.d.cts"]) {
    const declaration = readFileSync(file, "utf8");
    const missing = expectedDeclarationExports.filter(
      (name) => !new RegExp(`\\b${name}\\b`).test(declaration),
    );
    if (missing.length > 0) {
      throw new Error(
        `${file} is missing declarations for ${missing.join(", ")}.`,
      );
    }
  }
}
