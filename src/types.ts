export interface Trailer {
  key: string;
  value: string;
  raw: string;
  separator: string;
}

export interface ParseResult {
  trailers: Trailer[];
  subject: string;
  body: string;
  blockStart: number;
  hasDivider: boolean;
}

export interface ParseOptions {
  separators?: string;
  divider?: boolean;
  unfold?: boolean;
  knownKeys?: string[];
}
