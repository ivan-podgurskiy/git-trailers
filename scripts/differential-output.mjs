export function buildExpectedParseOutput(result, options = {}) {
  const separator = options.separators?.[0] ?? ":";
  return result.trailers
    .map((trailer) => {
      const configuredKey = options.knownKeys?.find(
        (knownKey) => knownKey.toLowerCase() === trailer.key.toLowerCase(),
      );
      return `${configuredKey ?? trailer.key}${separator} ${trailer.value}\n`;
    })
    .join("");
}
