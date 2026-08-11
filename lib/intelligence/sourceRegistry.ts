import { createHash } from 'node:crypto';

export type NormalizedSignalInput = {
  title: string;
  summary: string;
  sourceUrl: string;
  publisher: string;
  publishedAt: string;
  retrievedAt: string;
  verticals: string[];
  evidenceClass?: 'fact' | 'estimate' | 'hypothesis';
};

export function normalizeSignal(input: NormalizedSignalInput) {
  const title = input.title.trim().replace(/\s+/g, ' ');
  const summary = input.summary.trim().replace(/\s+/g, ' ');
  const sourceUrl = new URL(input.sourceUrl).toString();
  const fingerprint = createHash('sha256').update(`${input.publisher.toLowerCase()}|${title.toLowerCase()}|${input.publishedAt.slice(0, 10)}`).digest('hex');
  const ageDays = Math.max(0, (Date.parse(input.retrievedAt) - Date.parse(input.publishedAt)) / 86_400_000);
  return { ...input, title, summary, sourceUrl, fingerprint, ageDays: Math.round(ageDays * 10) / 10, freshnessScore: Math.max(0, Math.round(100 * Math.exp(-ageDays / 30))), evidenceClass: input.evidenceClass || 'fact' };
}

export function dedupeSignals<T extends { fingerprint: string }>(signals: T[]) {
  return [...new Map(signals.map((signal) => [signal.fingerprint, signal])).values()];
}
