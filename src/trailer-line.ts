export interface ParsedTrailerLine {
  key: string;
  value: string;
  separator: string;
  separatorIndex: number;
}

export function parseTrailerLine(
  line: string,
  separators: string,
): ParsedTrailerLine | undefined {
  const separatorIndex = findSeparator(line, separators);
  if (separatorIndex === -1) return undefined;

  return {
    key: trimHorizontal(line.slice(0, separatorIndex)),
    value: trimHorizontal(line.slice(separatorIndex + 1)),
    separator: line[separatorIndex]!,
    separatorIndex,
  };
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

function isTokenCharacter(character: string | undefined): boolean {
  return character !== undefined && /[A-Za-z0-9-]/.test(character);
}

function trimHorizontal(value: string): string {
  return value.replace(/^[ \t]+|[ \t]+$/g, "");
}
