import { distance } from "fastest-levenshtein";

interface MatchCandidate {
  id: number;
  name: string;
}

function normalize(s: string): string {
  return s
    .toLowerCase()
    .trim()
    .replace(/[^\w\s]/g, "")
    .replace(/\s+/g, " ");
}

function similarity(a: string, b: string): number {
  const na = normalize(a);
  const nb = normalize(b);
  const maxLen = Math.max(na.length, nb.length);
  if (maxLen === 0) return 1;
  return 1 - distance(na, nb) / maxLen;
}

export function findBestCompanyMatch(
  rawName: string,
  companies: MatchCandidate[],
  threshold = 0.85
): { match: MatchCandidate; similarity: number } | null {
  let best: { match: MatchCandidate; similarity: number } | null = null;
  for (const c of companies) {
    const sim = similarity(rawName, c.name);
    if (sim >= threshold && (!best || sim > best.similarity)) {
      best = { match: c, similarity: sim };
    }
  }
  return best;
}
