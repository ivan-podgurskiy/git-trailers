export function validatePackageExports(packageJson) {
  const errors = [];
  const expectedMetadata = {
    main: "./dist/index.cjs",
    module: "./dist/index.js",
    types: "./dist/index.d.ts",
  };

  for (const [key, value] of Object.entries(expectedMetadata)) {
    if (packageJson[key] !== value) {
      errors.push(`package.json ${key} must be ${value}.`);
    }
  }

  const rootExport = packageJson.exports?.["."];
  const expectedConditions = {
    import: {
      types: "./dist/index.d.ts",
      default: "./dist/index.js",
    },
    require: {
      types: "./dist/index.d.cts",
      default: "./dist/index.cjs",
    },
  };

  if (rootExport?.types !== undefined) {
    errors.push(
      'package.json exports["."] must not have a top-level types condition because it preempts import and require declaration resolution.',
    );
  }
  if (!hasExactKeys(rootExport, ["import", "require"])) {
    errors.push(
      'package.json exports["."] keys must be exactly ordered as import, require.',
    );
  }
  for (const [condition, expected] of Object.entries(expectedConditions)) {
    const actual = rootExport?.[condition];
    if (
      actual?.types !== expected.types ||
      actual?.default !== expected.default ||
      !hasExactKeys(actual, ["types", "default"])
    ) {
      errors.push(
        `package.json exports["."].${condition} must be ${JSON.stringify(expected)}.`,
      );
    }
  }

  return errors;
}

function hasExactKeys(value, expectedKeys) {
  return (
    value !== null &&
    typeof value === "object" &&
    !Array.isArray(value) &&
    JSON.stringify(Object.keys(value)) === JSON.stringify(expectedKeys)
  );
}
