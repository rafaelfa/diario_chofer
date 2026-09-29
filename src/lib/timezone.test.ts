import assert from 'node:assert/strict';
import test from 'node:test';
import { formatDatePt, formatDatePtServer } from './timezone.ts';

test('date-only values keep their civil date in negative timezones', () => {
  const options = { year: 'numeric', month: '2-digit', day: '2-digit' } as const;
  assert.equal(formatDatePt('2026-01-01T00:00:00.000Z', options), '01/01/2026');
  assert.equal(formatDatePtServer(new Date('2026-01-01T00:00:00.000Z'), 'America/Los_Angeles', options), '01/01/2026');
});