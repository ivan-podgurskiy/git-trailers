export function buildExpectedParseOutput(result, options = {}) {
  const separator = options.separators?.[0] ?? ":";
  return result.trailers
    .map((trailer) => `${trailer.key}${separator} ${trailer.value}\n`)
    .join("");
}
