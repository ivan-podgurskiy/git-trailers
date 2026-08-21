# Changelog

## 1.0.0 - 2026-08-21

- Add Git 2.54.0-compatible parsing, formatting, serialization, and trailer
  mutation behavior.
- Preserve lossless raw trailer source while supporting folded-value unfolding.
- Support placement plus existing, missing, and empty-value mutation policies.
- Support custom separators and Git divider handling.
- Ship ESM, CommonJS, and TypeScript declarations with zero runtime
  dependencies and Node.js 20 or newer support.
- Provide browser-bundler-compatible, string-only processing with no Git
  executable or ambient Git configuration.
- Cover behavior with shared conformance fixtures, Git 2.54.0 differential
  checks, and property tests.
