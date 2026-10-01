import assert from 'node:assert/strict';
import test from 'node:test';
import {
  blockDurationMin,
  breakRemainingMinutes,
  computeBreakPlan,
  drivingMinutesSinceLastValidBreak,
  validateBreakBlocks,
} from './breakBlocks.ts';

const MIN = 60_000;

test('validateBreakBlocks discards blocks shorter than 15 minutes', () => {
  const blocks = [
    { startMs: 0, endMs: 10 * MIN },   // 10min → descartado
    { startMs: 20 * MIN, endMs: 35 * MIN }, // 15min → aceite
    { startMs: 40 * MIN, endMs: 70 * MIN }, // 30min → aceite
  ];
  const v = validateBreakBlocks(blocks);
  assert.equal(v.validMinutes, 45);
  assert.equal(v.acceptedBlocks.length, 2);
  assert.equal(v.discardedBlocks.length, 1);
  assert.equal(v.satisfied, true);
});

test('validateBreakBlocks: 44 valid minutes is not satisfied', () => {
  const v = validateBreakBlocks([{ startMs: 0, endMs: 44 * MIN }]);
  assert.equal(v.validMinutes, 44);
  assert.equal(v.satisfied, false);
});

test('breakRemainingMinutes computes missing time (45/30/15)', () => {
  assert.equal(breakRemainingMinutes(0), 45);
  assert.equal(breakRemainingMinutes(15), 30);
  assert.equal(breakRemainingMinutes(30), 15);
  assert.equal(breakRemainingMinutes(45), 0);
  assert.equal(breakRemainingMinutes(60), 0);
});

test('computeBreakPlan recommends continuous 45 when nothing done', () => {
  const plan = computeBreakPlan(0);
  assert.equal(plan.strategy, 'continuous-45');
  assert.equal(plan.stepMinutes, 45);
});

test('computeBreakPlan recommends split step B (30min) after a valid 15min block', () => {
  const plan = computeBreakPlan(15);
  assert.equal(plan.strategy, 'split-15-30');
  assert.equal(plan.nextStep, 'B');
  assert.equal(plan.stepMinutes, 30);
});

test('computeBreakPlan with 30min done asks for remaining 15min', () => {
  const plan = computeBreakPlan(30);
  assert.equal(plan.stepMinutes, 15);
});

test('blockDurationMin clamps future end times to now', () => {
  const now = 100 * MIN;
  assert.equal(blockDurationMin({ startMs: 90 * MIN, endMs: 200 * MIN }, now), 10);
});

test('drivingMinutesSinceLastValidBreak resets clock after a satisfied 45min pause', () => {
  const start = 0;
  const blocks = [{ startMs: 60 * MIN, endMs: 105 * MIN }]; // pausa válida de 45min às 60→105
  // agora = 120min → desde o fim da pausa válida: 15 min de condução contínua
  assert.equal(drivingMinutesSinceLastValidBreak(start, blocks, 120 * MIN), 15);
  // sem pausa cumprida → conta desde o início
  assert.equal(drivingMinutesSinceLastValidBreak(start, [], 120 * MIN), 120);
});
