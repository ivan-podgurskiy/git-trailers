import { scanLines, type PhysicalLine } from "./lines.js";
import type { ParseOptions, ParseResult, Trailer } from "./types.js";

const DEFAULT_OPTIONS: Required<ParseOptions> = {
  separators: ":",
  divider: true,
  unfold: true,
  knownKeys: [],
};

const BUILTIN_PREFIXES = ["Signed-off-by: ", "(cherry picked from commit "];

export function parseTrailers(
  message: string,
  options?: ParseOptions,
): ParseResult {
  if (typeof message !== "string") {
    throw new TypeError("message must be a string");
  }

  const normalized = normalizeParseOptions(options);
  const lines = scanLines(message);
  const { offset: effectiveEnd, hasDivider } = findEffectiveEnd(
    message,
    lines,
    normalized.divider,
  );
  const blockStart = findTrailerBlockStart(
    lines,
    effectiveEnd,
    normalized.separators,
    normalized.knownKeys,
  );
  const subject = lines[0]?.content ?? "";

  if (blockStart === -1) {
    return {
      trailers: [],
      subject,
      body: message.slice(lines[0]?.end ?? 0),
      blockStart,
      hasDivider,
    };
  }

  const separatorLine = lines[blockStart - 1];
  const boundaryStart =
    separatorLine !== undefined && isBlank(separatorLine.content)
      ? separatorLine.start
      : lines[blockStart]!.start;

  return {
    trailers: parseTrailerEntries(lines, blockStart, effectiveEnd, normalized),
    subject,
    body: message.slice(lines[0]?.end ?? 0, boundaryStart),
    blockStart,
    hasDivider,
  };
}

function normalizeParseOptions(options?: ParseOptions): Required<ParseOptions> {
  if (options === undefined) return { ...DEFAULT_OPTIONS };
  if (
    options === null ||
    typeof options !== "object" ||
    Array.isArray(options)
  ) {
    throw new TypeError("options must be an object");
  }

  const { separators, divider, unfold, knownKeys } = options;
  if (
    separators !== undefined &&
    (typeof separators !== "string" || separators.length === 0)
  ) {
    throw new TypeError("separators must be a non-empty string");
  }
  if (divider !== undefined && typeof divider !== "boolean") {
    throw new TypeError("divider must be a boolean");
  }
  if (unfold !== undefined && typeof unfold !== "boolean") {
    throw new TypeError("unfold must be a boolean");
  }
  if (
    knownKeys !== undefined &&
    (!Array.isArray(knownKeys) ||
      knownKeys.some((key) => typeof key !== "string"))
  ) {
    throw new TypeError("knownKeys must be an array of strings");
  }

  return {
    separators: separators ?? DEFAULT_OPTIONS.separators,
    divider: divider ?? DEFAULT_OPTIONS.divider,
    unfold: unfold ?? DEFAULT_OPTIONS.unfold,
    knownKeys: knownKeys ?? DEFAULT_OPTIONS.knownKeys,
  };
}

function findEffectiveEnd(
  message: string,
  lines: PhysicalLine[],
  divider: boolean,
): { offset: number; hasDivider: boolean } {
  let offset = message.length;

  for (const line of lines) {
    if (isScissors(line.content)) {
      offset = line.start;
      break;
    }
  }

  let hasDivider = false;
  if (divider) {
    for (const line of lines) {
      if (line.start >= offset) break;
      if (isDivider(line.content)) {
        offset = line.start;
        hasDivider = true;
        break;
      }
    }
  }

  for (let index = lines.length - 1; index >= 0; index -= 1) {
    const line = lines[index]!;
    if (line.end > offset) continue;
    if (!isBlank(line.content) && !isComment(line.content)) break;
    offset = line.start;
  }

  return { offset, hasDivider };
}

function findTrailerBlockStart(
  lines: PhysicalLine[],
  effectiveEnd: number,
  separators: string,
  knownKeys: readonly string[],
): number {
  const endIndex = lastLineBefore(lines, effectiveEnd);
  if (endIndex < 0) return -1;

  let trailerLines = 0;
  let nonTrailerLines = 0;
  let possibleContinuationLines = 0;
  let recognizedPrefix = false;

  for (let index = endIndex; index >= 0; index -= 1) {
    const line = lines[index]!;
    if (isBlank(line.content)) {
      nonTrailerLines += possibleContinuationLines;
      possibleContinuationLines = 0;
      const start = index + 1;
      const accepted =
        trailerLines > 0 &&
        (nonTrailerLines === 0 ||
          (recognizedPrefix && trailerLines * 3 >= nonTrailerLines));
      return accepted ? start : -1;
    }

    if (isComment(line.content)) continue;

    if (isRecognizedPrefix(line.content)) {
      trailerLines += 1;
      possibleContinuationLines = 0;
      recognizedPrefix = true;
      continue;
    }

    const separator = findSeparator(line.content, separators);
    if (separator !== -1) {
      trailerLines += 1;
      possibleContinuationLines = 0;
      const key = line.content.slice(0, separator).trim();
      if (isRecognizedPrefix(line.content) || isKnownKey(key, knownKeys)) {
        recognizedPrefix = true;
      }
      continue;
    }

    if (isContinuation(line.content)) {
      possibleContinuationLines += 1;
      continue;
    }

    nonTrailerLines += 1 + possibleContinuationLines;
    possibleContinuationLines = 0;
  }

  return -1;
}

function findSeparator(line: string, separators: string): number {
  let whitespaceFound = false;

  for (let index = 0; index < line.length; index += 1) {
    const character = line[index]!;
    if (separators.includes(character)) return index === 0 ? -1 : index;
    if (!whitespaceFound && isTokenCharacter(character)) continue;
    if (index !== 0 && (character === " " || character === "\t")) {
      whitespaceFound = true;
      continue;
    }
    break;
  }

  return -1;
}

function parseTrailerEntries(
  lines: PhysicalLine[],
  blockStart: number,
  effectiveEnd: number,
  options: Required<ParseOptions>,
): Trailer[] {
  const trailers: Trailer[] = [];
  const endIndex = lastLineBefore(lines, effectiveEnd);

  for (let index = blockStart; index <= endIndex; index += 1) {
    const line = lines[index]!;
    const separator = findSeparator(line.content, options.separators);
    if (separator === -1) continue;

    let end = index;
    while (end + 1 <= endIndex && isContinuation(lines[end + 1]!.content))
      end += 1;
    const valueLines = lines.slice(index, end + 1);
    trailers.push({
      key: trimHorizontal(line.content.slice(0, separator)),
      value: normalizeValue(valueLines, separator, options.unfold),
      raw:
        line.raw +
        lines
          .slice(index + 1, end + 1)
          .map((continuation) => continuation.raw)
          .join(""),
      separator: line.content[separator]!,
    });
    index = end;
  }

  return trailers;
}

function normalizeValue(
  lines: PhysicalLine[],
  separator: number,
  unfold: boolean,
): string {
  const first = lines[0]!.content.slice(separator + 1);
  if (unfold) {
    return [first, ...lines.slice(1).map((line) => line.content)]
      .map(trimHorizontal)
      .join(" ")
      .replace(/^[ \t]+|[ \t]+$/g, "");
  }

  let value = first;
  for (let index = 1; index < lines.length; index += 1) {
    value += `${lines[index - 1]!.eol}${lines[index]!.content}`;
  }
  return trimHorizontal(value);
}

function lastLineBefore(lines: PhysicalLine[], offset: number): number {
  for (let index = lines.length - 1; index >= 0; index -= 1) {
    if (lines[index]!.end <= offset) return index;
  }
  return -1;
}

function isTokenCharacter(character: string | undefined): boolean {
  return character !== undefined && /[A-Za-z0-9-]/.test(character);
}

function isBlank(line: string | undefined): boolean {
  return line !== undefined && /^[ \t]*$/.test(line);
}

function isContinuation(line: string): boolean {
  return line.startsWith(" ") || line.startsWith("\t");
}

function isComment(line: string): boolean {
  return line.startsWith("#");
}

function isDivider(line: string): boolean {
  return /^---(?:[ \t].*)?$/.test(line);
}

function isScissors(line: string): boolean {
  return /^#\s*-{20,}\s*>8\s*-{20,}\s*$/.test(line);
}

function isRecognizedPrefix(line: string): boolean {
  return BUILTIN_PREFIXES.some((prefix) => line.startsWith(prefix));
}

function isKnownKey(key: string, knownKeys: readonly string[]): boolean {
  return knownKeys.some(
    (knownKey) => knownKey.toLowerCase() === key.toLowerCase(),
  );
}

function trimHorizontal(value: string): string {
  return value.replace(/^[ \t]+|[ \t]+$/g, "");
}
