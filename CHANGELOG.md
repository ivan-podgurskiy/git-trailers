# Changelog

## 1.0.1 - 2026-08-30

- Match Git 2.54.0 when detecting orphan continuations across comments and
  unfolding folded values with pre-newline whitespace or CRLF.
- Preserve folded values during mutation, including internal whitespace, while
  trimming only their outer boundary and comparing them without unfolding.
- Apply `trimEmpty` to existing trailers even when no new trailers are added.
- Expand pinned Git 2.54.0 differential coverage from 49 to 57 comparisons.

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
