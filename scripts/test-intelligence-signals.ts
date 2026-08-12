import assert from 'node:assert/strict';
import { dedupeSignals, normalizeSignal } from '../lib/intelligence/sourceRegistry';

const a = normalizeSignal({ title: '  Rate outlook  ', summary: '  Primary update. ', sourceUrl: 'https://example.gov/rates', publisher: 'Example Gov', publishedAt: '2026-08-01T00:00:00Z', retrievedAt: '2026-08-02T00:00:00Z', verticals: ['business_capital'] });
const b = normalizeSignal({ ...a, sourceUrl: 'https://mirror.example/rates' });
assert.equal(a.title, 'Rate outlook');
assert.equal(a.freshnessScore > 90, true);
assert.equal(dedupeSignals([a, b]).length, 1);
assert.equal(normalizeSignal({ ...a, publishedAt: '2026-01-01T00:00:00Z' }).freshnessScore < 20, true);
console.log('Intelligence normalization and dedupe tests passed.');
