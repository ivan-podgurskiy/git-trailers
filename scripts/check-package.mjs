import { execFileSync } from "node:child_process";
import {
  copyFileSync,
  mkdirSync,
  mkdtempSync,
  readFileSync,
  realpathSync,
  rmSync,
  writeFileSync,
} from "node:fs";
import { createRequire } from "node:module";
import { tmpdir } from "node:os";
import { join, resolve } from "node:path";
import ts from "typescript";

import { validatePackageExports } from "./package-exports.mjs";

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

const errors = validatePackageExports(
  JSON.parse(readFileSync("package.json", "utf8")),
);
errors.push(...(await verifyBuildOutputs()));

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
  errors.push(
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
  errors.push(
    `Package contains prohibited source, test, or meta-document files: ${prohibited.join(", ")}`,
  );
}

if (manifest.unpackedSize > MAX_UNPACKED_SIZE) {
  errors.push(
    `Package unpacked size exceeds ${MAX_UNPACKED_SIZE} bytes: ${manifest.unpackedSize} bytes.`,
  );
}

if (errors.length > 0) {
  throw new Error(errors.join("\n\n"));
}

console.log(
  `Package contents and exports verified (${actualFiles.length} files, ${manifest.unpackedSize} bytes; ceiling ${MAX_UNPACKED_SIZE} bytes).`,
);
console.log(
  manifest.files.map(({ path, size }) => `- ${path}: ${size} bytes`).join("\n"),
);

async function verifyBuildOutputs() {
  const errors = [];
  const esm = await import("git-trailers");
  const require = createRequire(import.meta.url);
  const commonJs = require("git-trailers");
  const esmExports = Object.keys(esm).sort();
  const commonJsExports = Object.keys(commonJs).sort();

  if (JSON.stringify(esmExports) !== JSON.stringify(expectedRuntimeExports)) {
    errors.push(`Unexpected ESM exports: ${esmExports.join(", ")}`);
  }
  if (
    JSON.stringify(commonJsExports) !== JSON.stringify(expectedRuntimeExports)
  ) {
    errors.push(`Unexpected CommonJS exports: ${commonJsExports.join(", ")}`);
  }

  errors.push(...verifyDeclarationExports());
  errors.push(...verifyTypeScriptConsumerResolution());
  return errors;
}

function verifyDeclarationExports() {
  const errors = [];
  const declarationFiles = [
    resolve("dist/index.d.ts"),
    resolve("dist/index.d.cts"),
  ];
  const program = ts.createProgram({
    rootNames: declarationFiles,
    options: {
      module: ts.ModuleKind.NodeNext,
      moduleResolution: ts.ModuleResolutionKind.NodeNext,
      noEmit: true,
      strict: true,
    },
  });
  const diagnostics = ts.getPreEmitDiagnostics(program);

  if (diagnostics.length > 0) {
    errors.push(
      `Declaration diagnostics:\n${ts.formatDiagnosticsWithColorAndContext(diagnostics, diagnosticHost())}`,
    );
  }

  const checker = program.getTypeChecker();
  for (const declarationFile of declarationFiles) {
    const sourceFile = program.getSourceFile(declarationFile);
    const moduleSymbol = sourceFile && checker.getSymbolAtLocation(sourceFile);
    if (moduleSymbol === undefined) {
      errors.push(
        `${declarationFile} does not have a declaration module symbol.`,
      );
      continue;
    }
    const actual = checker
      .getExportsOfModule(moduleSymbol)
      .map((symbol) => symbol.getName())
      .sort();
    const missing = expectedDeclarationExports.filter(
      (name) => !actual.includes(name),
    );
    const unexpected = actual.filter(
      (name) => !expectedDeclarationExports.includes(name),
    );
    if (missing.length > 0 || unexpected.length > 0) {
      errors.push(
        `${declarationFile} exports mismatch; missing: ${missing.join(", ") || "none"}; unexpected: ${unexpected.join(", ") || "none"}.`,
      );
    }
  }

  return errors;
}

function verifyTypeScriptConsumerResolution() {
  const errors = [];
  const consumerDirectory = mkdtempSync(
    join(tmpdir(), "git-trailers-installed-consumer-"),
  );
  const installedPackageDirectory = join(
    consumerDirectory,
    "node_modules",
    "git-trailers",
  );
  const consumers = [
    {
      kind: "ESM",
      file: join(consumerDirectory, "consumer.mts"),
      expectedDeclaration: join(installedPackageDirectory, "dist/index.d.ts"),
    },
    {
      kind: "CommonJS",
      file: join(consumerDirectory, "consumer.cts"),
      expectedDeclaration: join(installedPackageDirectory, "dist/index.d.cts"),
    },
  ];
  const compilerOptions = {
    module: ts.ModuleKind.NodeNext,
    moduleResolution: ts.ModuleResolutionKind.NodeNext,
    noEmit: true,
    strict: true,
    target: ts.ScriptTarget.ES2022,
  };

  try {
    writeFileSync(
      join(consumerDirectory, "package.json"),
      `${JSON.stringify({ name: "git-trailers-installed-consumer", private: true }, null, 2)}\n`,
    );
    mkdirSync(join(installedPackageDirectory, "dist"), { recursive: true });
    copyFileSync(
      "package.json",
      join(installedPackageDirectory, "package.json"),
    );
    for (const output of [
      "index.cjs",
      "index.d.cts",
      "index.d.ts",
      "index.js",
    ]) {
      copyFileSync(
        join("dist", output),
        join(installedPackageDirectory, "dist", output),
      );
    }

    for (const consumer of consumers) {
      writeFileSync(
        consumer.file,
        'import { parseTrailers } from "git-trailers";\nconst result = parseTrailers("subject");\nresult.trailers;\n',
      );
    }

    const program = ts.createProgram({
      rootNames: consumers.map((consumer) => consumer.file),
      options: compilerOptions,
    });
    const diagnostics = ts.getPreEmitDiagnostics(program);
    if (diagnostics.length > 0) {
      errors.push(
        `TypeScript consumer diagnostics:\n${ts.formatDiagnosticsWithColorAndContext(diagnostics, diagnosticHost())}`,
      );
    }

    for (const consumer of consumers) {
      const sourceFile = program.getSourceFile(consumer.file);
      const importDeclaration = sourceFile?.statements.find(
        ts.isImportDeclaration,
      );
      const moduleSpecifier = importDeclaration?.moduleSpecifier;
      const resolution =
        sourceFile !== undefined && moduleSpecifier !== undefined
          ? program.getResolvedModuleFromModuleSpecifier(
              moduleSpecifier,
              sourceFile,
            )?.resolvedModule
          : undefined;
      if (resolution === undefined) {
        errors.push(
          `${consumer.kind} consumer could not resolve git-trailers.`,
        );
      } else if (
        realpathSync(resolution.resolvedFileName) !==
        realpathSync(consumer.expectedDeclaration)
      ) {
        errors.push(
          `${consumer.kind} consumer resolved ${resolution.resolvedFileName}; expected ${consumer.expectedDeclaration}.`,
        );
      } else {
        console.log(
          `${consumer.kind} installed TypeScript consumer resolved ${resolution.resolvedFileName}.`,
        );
      }
    }
  } finally {
    rmSync(consumerDirectory, { recursive: true, force: true });
  }

  return errors;
}

function diagnosticHost() {
  return {
    getCanonicalFileName: (fileName) => fileName,
    getCurrentDirectory: () => process.cwd(),
    getNewLine: () => "\n",
  };
}
