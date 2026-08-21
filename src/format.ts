export interface TrailerInput {
  key: string;
  value: string;
}

export function formatTrailer(trailer: TrailerInput, separator = ":"): string {
  const { key, value } = validateTrailer(trailer);
  validateSeparator(separator);
  return `${key}${separator} ${value}`;
}

export function serializeTrailers(trailers: readonly TrailerInput[]): string {
  if (!Array.isArray(trailers)) {
    throw new TypeError("trailers must be an array");
  }
  return trailers.map((trailer) => formatTrailer(trailer)).join("\n");
}

export function validateTrailer(trailer: TrailerInput): TrailerInput {
  if (
    trailer === null ||
    typeof trailer !== "object" ||
    Array.isArray(trailer)
  ) {
    throw new TypeError("trailer must be an object");
  }
  if (typeof trailer.key !== "string" || typeof trailer.value !== "string") {
    throw new TypeError("trailer key and value must be strings");
  }

  const key = trailer.key.trim();
  if (!/^[A-Za-z0-9-]+$/.test(key)) {
    throw new TypeError(
      "trailer key must contain only letters, digits, and hyphens",
    );
  }
  return { key, value: trailer.value.trim() };
}

export function validateSeparator(separator: string): void {
  if (
    typeof separator !== "string" ||
    separator.length !== 1 ||
    /\s/.test(separator)
  ) {
    throw new TypeError("separator must be one non-whitespace character");
  }
}
