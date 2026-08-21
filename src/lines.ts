export interface PhysicalLine {
  index: number;
  start: number;
  end: number;
  content: string;
  eol: "" | "\n" | "\r\n";
  raw: string;
}

export function scanLines(input: string): PhysicalLine[] {
  const lines: PhysicalLine[] = [];
  let start = 0;
  let index = 0;

  for (let position = 0; position < input.length; position += 1) {
    if (input[position] !== "\n") continue;

    const eol: "\n" | "\r\n" =
      position > start && input[position - 1] === "\r" ? "\r\n" : "\n";
    const contentEnd = position - (eol === "\r\n" ? 1 : 0);
    const end = position + 1;
    lines.push({
      index,
      start,
      end,
      content: input.slice(start, contentEnd),
      eol,
      raw: input.slice(start, end),
    });
    index += 1;
    start = end;
  }

  if (start < input.length) {
    lines.push({
      index,
      start,
      end: input.length,
      content: input.slice(start),
      eol: "",
      raw: input.slice(start),
    });
  }

  return lines;
}

export function detectNewline(lines: PhysicalLine[]): "\n" | "\r\n" {
  return lines.some((line) => line.eol === "\r\n") ? "\r\n" : "\n";
}
