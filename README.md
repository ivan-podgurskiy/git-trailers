# git-trailers — Git commit-message trailers for JavaScript and TypeScript

## Badges

[![CI](https://github.com/ivan-podgurskiy/git-trailers/actions/workflows/ci.yml/badge.svg)](https://github.com/ivan-podgurskiy/git-trailers/actions/workflows/ci.yml)
[![npm](https://img.shields.io/npm/v/git-trailers.svg)](https://www.npmjs.com/package/git-trailers)
[![Types](https://img.shields.io/npm/types/git-trailers.svg)](https://www.npmjs.com/package/git-trailers)
[![License: MIT](https://img.shields.io/badge/License-MIT-yellow.svg)](LICENSE)

`git-trailers` parses, serializes, and manipulates Git commit-message trailers
in JavaScript and TypeScript. It implements the string format used by
`git interpret-trailers` without invoking Git, reading a repository, or using
runtime dependencies.

## Install

```sh
npm install git-trailers
```

## Quick Start

Use the ESM entry point from TypeScript or an ESM JavaScript project:

```ts
import { parseTrailers } from "git-trailers";

const result = parseTrailers(
  `Add parser\n\nSigned-off-by: Alice <alice@example.com>\n`,
);

console.log(result.trailers[0]);
// {
//   key: "Signed-off-by",
//   value: "Alice <alice@example.com>",
//   raw: "Signed-off-by: Alice <alice@example.com>\n",
//   separator: ":"
// }
```

CommonJS uses the same package entry point:

```js
const { parseTrailers } = require("git-trailers");

const result = parseTrailers("Fix bug\n\nFixes: #42\n");
console.log(result.trailers[0].value); // "#42"
```

## Add Trailers

`addTrailers` applies Git-compatible placement and duplicate policies without
changing the message outside the trailer block:

```ts
import { addTrailers } from "git-trailers";

const message = addTrailers(
  "Fix parser\n\nFixes: #42\n",
  [{ key: "Reviewed-by", value: "Bob <bob@example.com>" }],
  { where: "after", ifExists: "addIfDifferent" },
);

console.log(message);
// Fix parser
//
// Fixes: #42
// Reviewed-by: Bob <bob@example.com>
```

## Features

- Parse final Git trailer blocks, including the Git 25% recognition rule.
- Preserve source text for every parsed trailer in `raw` while optionally
  unfolding its value.
- Add trailers with Git placement, existing-value, missing-value, and
  empty-value policies.
- Support explicit custom separator sets and divider control.
- Ship ESM, CommonJS, and TypeScript declarations with zero runtime
  dependencies.
- Work on input strings only: no Git executable, shell command, filesystem,
  repository, network access, or ambient Git configuration is used.

## Trailer Block Detection

A trailer block must be separated from preceding commit-message text by a blank
line. The block is either all trailer lines, or has at least one recognized
Git/explicit `knownKeys` trailer and enough trailer lines to meet Git's 25%
rule. Default recognition includes Git's `Signed-off-by:` and cherry-pick
prefixes; `knownKeys` extends that recognition for a call.

By default, a `---` divider line stops trailer detection before patch material.
Scissors lines are always excluded. Set `divider: false` only when a divider is
part of the commit-message content you want considered; it does not disable
scissors handling.

Git trailers are not Conventional Commits footers. This package implements
Git's trailer-block detection and mutation semantics, not Conventional Commits
types, scopes, `BREAKING CHANGE` interpretation, or its footer grammar. Use a
Conventional Commits parser when that grammar is what your application needs.

## Folded Values

Continuation lines that begin with a space or tab are folded values. Parsing
defaults to `unfold: true`, which replaces each LF and the following horizontal
whitespace with one space, then trims the complete value's outer boundary. This
matches Git's treatment of whitespace immediately before a fold and CRLF input.
`raw` always keeps the exact source lines, including their original line
endings.

```ts
import { parseTrailers } from "git-trailers";

const message = "Subject\n\nReviewed-by: Alice\n  <alice@example.com>\n";

parseTrailers(message).trailers[0].value;
// "Alice <alice@example.com>"

parseTrailers(message, { unfold: false }).trailers[0].value;
// "Alice\n  <alice@example.com>"
```

## API

```ts
interface Trailer {
  key: string;
  value: string;
  raw: string;
  separator: string;
}

interface ParseResult {
  trailers: Trailer[];
  subject: string;
  body: string;
  blockStart: number;
  hasDivider: boolean;
}

interface ParseOptions {
  separators?: string;
  divider?: boolean;
  unfold?: boolean;
  knownKeys?: string[];
}

function parseTrailers(message: string, options?: ParseOptions): ParseResult;
```

`parseTrailers` is total for every string: content that is malformed or has no
trailer block simply returns `trailers: []`, with the message retained in the
result. It throws `TypeError` only for programmer misuse, such as a non-string
`message` or invalid option values/types.

Defaults are `separators: ":"`, `divider: true`, `unfold: true`, and
`knownKeys: []`. `blockStart` is the zero-based trailer-block line index or
`-1` when no block is found. `hasDivider` says whether an active `---` divider
was found.

```ts
type AddWhere = "end" | "start" | "after" | "before";
type IfExists =
  "addIfDifferentNeighbor" | "addIfDifferent" | "add" | "replace" | "doNothing";
type IfMissing = "add" | "doNothing";

interface AddOptions {
  where?: AddWhere;
  ifExists?: IfExists;
  ifMissing?: IfMissing;
  trimEmpty?: boolean;
  separators?: string;
  divider?: boolean;
}

interface TrailerInput {
  key: string;
  value: string;
}

function addTrailers(
  message: string,
  trailers: readonly TrailerInput[],
  options?: AddOptions,
): string;
```

Defaults are `where: "end"`, `ifExists: "addIfDifferentNeighbor"`,
`ifMissing: "add"`, `trimEmpty: false`, `separators: ":"`, and
`divider: true`. `where` chooses `end`, `start`, after the last same-key
trailer, or before the first same-key trailer. `ifExists` controls duplicate
handling; `replace` removes the matching trailer nearest the insertion point.
`ifMissing: "doNothing"` suppresses a new key, and `trimEmpty: true` removes
empty existing trailers and skips empty additions.

When a mutation occurs, Git canonicalizes the affected trailer block with LF
line endings. Bytes outside that block keep their original endings, so a CRLF
message can intentionally contain a CRLF prefix followed by an LF trailer
block. An empty addition list returns the complete input byte-for-byte unless
`trimEmpty: true` removes empty existing trailers.

`AddOptions.separators` must be non-empty and cannot contain CR or LF. Every
configured character is recognized in input, including SP and TAB, and the
first character is used for canonical additions. The canonical following space
is separate from the configured separator, so an SP separator emits
`Key  value`, while TAB emits `Key\t value`. This differs intentionally from
the optional `formatTrailer` separator, which must be exactly one
non-whitespace character.

```ts
function formatTrailer(trailer: TrailerInput, separator?: string): string;
function serializeTrailers(trailers: readonly TrailerInput[]): string;
```

`formatTrailer` defaults to `":"` and returns canonical `key: value` text.
`serializeTrailers` formats each input with that default and joins them with
`"\n"`. `addTrailers`, `formatTrailer`, and `serializeTrailers` throw
`TypeError` for invalid argument shapes, values, or options; message content
itself is never a parse error. Every caller-supplied `TrailerInput.value` must
fit on one physical line: a value containing `"\r"` or `"\n"` is a programmer
error and throws `TypeError`. This does not restrict parsed message content;
folded input remains valid, and `parseTrailers` with `unfold: false` can return
a value containing its original line endings.

## Compatibility

The package supports Node.js 20 or newer. It exports ESM (`import`) and
CommonJS (`require`) builds with `.d.ts` and `.d.cts` declarations.

The runtime implementation uses platform-neutral string processing and no
Node-only runtime APIs, so it can be bundled for browsers, edge runtimes, and
serverless applications. A bundler should resolve the package's normal ESM or
CommonJS export; this package does not provide browser globals or a CLI.

## Scope

Version 1 covers parsing, formatting, serializing, and adding Git
commit-message trailers, including folding, custom separators, divider
handling, explicit known keys, placement, duplicate policies, missing-key
policy, and empty-value trimming.

It deliberately does not read `trailer.*` or other Git configuration, resolve
aliases, execute `cmd`/`command` settings, invoke a shell or Git, discover a
repository, read commit messages from disk, or manipulate mbox/patch contents.
Pass every behavior choice as an explicit option and supply the message string
yourself.

## Alternatives

Use `git interpret-trailers` when a Git installation, its configured aliases,
and command behavior are required. Use a Conventional Commits parser for that
separate specification. `git-trailers` is for portable, dependency-free,
Git-trailer processing within JavaScript and TypeScript applications.

## Provenance

Behavior is independently implemented and tested against Git 2.54.0's
`git-interpret-trailers(1)` documentation, `trailer.c`, and selected behavior
from `t/t7513-interpret-trailers.sh`. The project includes independently
expressed conformance fixtures, differential tests against Git 2.54.0, and
property tests. No Git production source or shell-test code is included.

Git continues to evolve, and Git configuration, aliases, commands, and
non-message Git workflows are intentionally outside this package's compatibility
promise. See [THIRD_PARTY_NOTICES.md](./THIRD_PARTY_NOTICES.md) for details.

## License

MIT.
