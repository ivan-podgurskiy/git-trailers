import { scanLines, type PhysicalLine } from "./lines.js";
import { parseTrailers } from "./parse.js";
import { parseTrailerLine } from "./trailer-line.js";
import { validateTrailer, type TrailerInput } from "./format.js";

export type AddWhere = "end" | "start" | "after" | "before";
export type IfExists =
  "addIfDifferentNeighbor" | "addIfDifferent" | "add" | "replace" | "doNothing";
export type IfMissing = "add" | "doNothing";

export interface AddOptions {
  where?: AddWhere;
  ifExists?: IfExists;
  ifMissing?: IfMissing;
  trimEmpty?: boolean;
  separators?: string;
  divider?: boolean;
}

interface NormalizedAddOptions {
  where: AddWhere;
  ifExists: IfExists;
  ifMissing: IfMissing;
  trimEmpty: boolean;
  separators: string;
  divider: boolean;
}

interface TrailerItem {
  kind: "trailer";
  key: string;
  value: string;
  firstValue: string;
  continuations: string[];
}

interface OtherItem {
  kind: "other";
  content: string;
}

type BlockItem = TrailerItem | OtherItem;

const DEFAULT_OPTIONS: NormalizedAddOptions = {
  where: "end",
  ifExists: "addIfDifferentNeighbor",
  ifMissing: "add",
  trimEmpty: false,
  separators: ":",
  divider: true,
};

export function addTrailers(
  message: string,
  trailers: readonly TrailerInput[],
  options?: AddOptions,
): string {
  if (typeof message !== "string")
    throw new TypeError("message must be a string");
  if (!Array.isArray(trailers))
    throw new TypeError("trailers must be an array");
  const normalized = normalizeOptions(options);
  if (trailers.length === 0 && !normalized.trimEmpty) return message;

  const incoming = trailers.map(validateTrailer);
  const lines = scanLines(message);
  const newline = "\n";
  const parsed = parseTrailers(message, {
    separators: normalized.separators,
    divider: normalized.divider,
    unfold: false,
  });
  const suffixStart = effectiveEnd(lines, normalized.divider);
  const fallbackBlockStart =
    parsed.blockStart === -1
      ? findOverlappingSeparatorBlockStart(
          lines,
          suffixStart,
          normalized.separators,
        )
      : -1;
  const trailerBlockStart =
    parsed.blockStart === -1 ? fallbackBlockStart : parsed.blockStart;
  const hasBlock = trailerBlockStart !== -1;
  const blockStart = hasBlock ? lines[trailerBlockStart]!.start : suffixStart;
  let items = hasBlock
    ? parseBlockItems(
        lines,
        trailerBlockStart,
        suffixStart,
        normalized.separators,
      )
    : [];
  let trimmed = false;
  if (normalized.trimEmpty) {
    const withoutEmpty = items.filter(
      (item) => item.kind !== "trailer" || item.value.trim() !== "",
    );
    if (withoutEmpty.length !== items.length) {
      items = withoutEmpty;
      trimmed = true;
    }
  }

  let inserted = false;
  for (const trailer of incoming) {
    if (normalized.trimEmpty && trailer.value === "") continue;
    const next = applyOne(items, trailer, normalized);
    inserted ||= next !== items;
    items = next;
  }

  if (!inserted && !trimmed) return message;

  if (!hasBlock && items.length === 0) return message;

  if (!hasBlock) {
    const prefix = message.slice(0, suffixStart);
    const suffix = message.slice(suffixStart);
    return `${prepareNewBlockPrefix(prefix, newline)}${serializeBlock(
      items,
      normalized.separators[0]!,
      newline,
      true,
    )}${suffix}`;
  }

  const prefix = message.slice(0, blockStart);
  const suffix = message.slice(suffixStart);
  const hadTerminalNewline = lastLineBefore(lines, suffixStart)?.eol !== "";
  return `${prefix}${serializeBlock(
    items,
    normalized.separators[0]!,
    newline,
    inserted || hadTerminalNewline,
  )}${suffix}`;
}

function normalizeOptions(options?: AddOptions): NormalizedAddOptions {
  if (options === undefined) return { ...DEFAULT_OPTIONS };
  if (
    options === null ||
    typeof options !== "object" ||
    Array.isArray(options)
  ) {
    throw new TypeError("options must be an object");
  }

  const allowed = new Set([
    "where",
    "ifExists",
    "ifMissing",
    "trimEmpty",
    "separators",
    "divider",
  ]);
  for (const key of Object.keys(options)) {
    if (!allowed.has(key)) throw new TypeError(`unknown option: ${key}`);
  }

  const normalized: NormalizedAddOptions = {
    ...DEFAULT_OPTIONS,
    ...options,
  };
  if (
    !(["end", "start", "after", "before"] as const).includes(normalized.where)
  ) {
    throw new TypeError("where is invalid");
  }
  if (
    !(
      [
        "addIfDifferentNeighbor",
        "addIfDifferent",
        "add",
        "replace",
        "doNothing",
      ] as const
    ).includes(normalized.ifExists)
  ) {
    throw new TypeError("ifExists is invalid");
  }
  if (!(["add", "doNothing"] as const).includes(normalized.ifMissing)) {
    throw new TypeError("ifMissing is invalid");
  }
  if (typeof normalized.trimEmpty !== "boolean") {
    throw new TypeError("trimEmpty must be a boolean");
  }
  if (typeof normalized.divider !== "boolean") {
    throw new TypeError("divider must be a boolean");
  }
  if (
    typeof normalized.separators !== "string" ||
    normalized.separators.length === 0 ||
    /[\r\n]/.test(normalized.separators)
  ) {
    throw new TypeError(
      "separators must be a non-empty string without CR or LF characters",
    );
  }
  return normalized;
}

function sameToken(existing: string, incoming: string): boolean {
  const normalize = (token: string) =>
    token.replace(/[^A-Za-z0-9]+$/, "").toLowerCase();
  const left = normalize(existing);
  const right = normalize(incoming);
  return left.startsWith(right) || right.startsWith(left);
}

function sameValue(existing: string, incoming: string): boolean {
  return existing.trim().toLowerCase() === incoming.trim().toLowerCase();
}

function insertionIndex(
  items: BlockItem[],
  key: string,
  where: AddWhere,
): number {
  const matching = items
    .map((item, index) =>
      item.kind === "trailer" && sameToken(item.key, key) ? index : -1,
    )
    .filter((index) => index !== -1);
  if (where === "start") return 0;
  if (matching.length === 0) return items.length;
  if (where === "before") return matching[0]!;
  if (where === "after") return matching[matching.length - 1]! + 1;
  return items.length;
}

function applyOne(
  items: BlockItem[],
  trailer: TrailerInput,
  options: NormalizedAddOptions,
): BlockItem[] {
  const matching = items
    .map((item, index) =>
      item.kind === "trailer" && sameToken(item.key, trailer.key) ? index : -1,
    )
    .filter((index) => index !== -1);
  if (matching.length === 0 && options.ifMissing === "doNothing") return items;
  if (matching.length > 0 && options.ifExists === "doNothing") return items;
  if (
    matching.length > 0 &&
    options.ifExists === "addIfDifferent" &&
    matching.some((index) =>
      sameValue((items[index] as TrailerItem).value, trailer.value),
    )
  ) {
    return items;
  }

  let index = insertionIndex(items, trailer.key, options.where);
  if (matching.length > 0 && options.ifExists === "addIfDifferentNeighbor") {
    const neighbor =
      items[
        options.where === "before" || options.where === "start"
          ? index
          : index - 1
      ];
    if (
      neighbor?.kind === "trailer" &&
      sameToken(neighbor.key, trailer.key) &&
      sameValue(neighbor.value, trailer.value)
    ) {
      return items;
    }
  }

  let next = items;
  if (matching.length > 0 && options.ifExists === "replace") {
    const remove = matching.reduce((nearest, candidate) =>
      Math.abs(candidate - index) < Math.abs(nearest - index)
        ? candidate
        : nearest,
    );
    next = items.filter((_, itemIndex) => itemIndex !== remove);
    if (remove < index) index -= 1;
  }

  const item: TrailerItem = {
    kind: "trailer",
    key: trailer.key,
    value: trailer.value,
    firstValue: trailer.value,
    continuations: [],
  };
  return [...next.slice(0, index), item, ...next.slice(index)];
}

function parseBlockItems(
  lines: PhysicalLine[],
  blockStart: number,
  end: number,
  separators: string,
): BlockItem[] {
  const items: BlockItem[] = [];
  for (let index = blockStart; index < lines.length; index += 1) {
    const line = lines[index]!;
    if (line.start >= end) break;
    const trailer = parseTrailerLine(line.content, separators);
    if (trailer === undefined) {
      items.push({ kind: "other", content: line.content });
      continue;
    }
    const continuations: string[] = [];
    while (
      index + 1 < lines.length &&
      lines[index + 1]!.start < end &&
      /^[ \t]/.test(lines[index + 1]!.content)
    ) {
      index += 1;
      continuations.push(lines[index]!.content);
    }
    const sourceValue = line.content.slice(trailer.separatorIndex + 1);
    const value = [sourceValue, ...continuations].join("\n").trim();
    const [firstValue = "", ...trimmedContinuations] = value.split("\n");
    items.push({
      kind: "trailer",
      key: trailer.key,
      value,
      firstValue,
      continuations: trimmedContinuations,
    });
  }
  return items;
}

function findOverlappingSeparatorBlockStart(
  lines: PhysicalLine[],
  end: number,
  separators: string,
): number {
  if (![...separators].some((separator) => /[A-Za-z0-9-]/.test(separator))) {
    return -1;
  }

  let trailers = 0;
  for (let index = lines.length - 1; index >= 0; index -= 1) {
    const line = lines[index]!;
    if (line.end > end) continue;
    if (isBlank(line.content)) {
      return trailers > 0 &&
        isFallbackTrailerBlock(lines, index + 1, end, separators)
        ? index + 1
        : -1;
    }
    if (line.content.startsWith("#")) continue;
    if (/^[ \t]/.test(line.content)) continue;
    if (parseTrailerLine(line.content, separators) === undefined) return -1;
    trailers += 1;
  }
  return -1;
}

function isFallbackTrailerBlock(
  lines: PhysicalLine[],
  start: number,
  end: number,
  separators: string,
): boolean {
  let sawTrailer = false;
  for (let index = start; index < lines.length; index += 1) {
    const line = lines[index]!;
    if (line.start >= end) break;
    if (line.content.startsWith("#")) continue;
    if (/^[ \t]/.test(line.content)) {
      if (!sawTrailer) return false;
      continue;
    }
    if (parseTrailerLine(line.content, separators) === undefined) return false;
    sawTrailer = true;
  }
  return sawTrailer;
}

function serializeBlock(
  items: BlockItem[],
  separator: string,
  newline: string,
  terminalNewline: boolean,
): string {
  const serialized = items
    .map((item) => {
      if (item.kind === "other") return item.content;
      return [
        `${item.key}${separator} ${item.firstValue}`,
        ...item.continuations,
      ].join(newline);
    })
    .join(newline);
  return terminalNewline && serialized !== ""
    ? `${serialized}${newline}`
    : serialized;
}

function prepareNewBlockPrefix(prefix: string, newline: string): string {
  if (prefix.endsWith(`${newline}${newline}`)) return prefix;
  if (prefix.endsWith(newline)) return `${prefix}${newline}`;
  return prefix === "" ? newline : `${prefix}${newline}${newline}`;
}

function effectiveEnd(lines: PhysicalLine[], divider: boolean): number {
  let end = dividerOrScissorsStart(lines, divider, lines.at(-1)?.end ?? 0);
  for (let index = lines.length - 1; index >= 0; index -= 1) {
    const line = lines[index]!;
    if (line.end > end) continue;
    if (!isBlank(line.content) && !line.content.startsWith("#")) break;
    end = line.start;
  }
  return end;
}

function dividerOrScissorsStart(
  lines: PhysicalLine[],
  divider: boolean,
  fallback: number,
): number {
  const scissors = lines.find((line) =>
    /^#\s*-{20,}\s*>8\s*-{20,}\s*$/.test(line.content),
  );
  const scissorsStart = scissors?.start ?? fallback;
  if (!divider) return scissorsStart;
  return (
    lines.find(
      (line) =>
        line.start < scissorsStart && /^---(?:[ \t].*)?$/.test(line.content),
    )?.start ?? scissorsStart
  );
}

function lastLineBefore(
  lines: PhysicalLine[],
  offset: number,
): PhysicalLine | undefined {
  for (let index = lines.length - 1; index >= 0; index -= 1) {
    if (lines[index]!.end <= offset) return lines[index];
  }
  return undefined;
}

function isBlank(line: string): boolean {
  return /^[ \t]*$/.test(line);
}
