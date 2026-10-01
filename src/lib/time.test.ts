import assert from 'node:assert/strict';
import test from 'node:test';
import {
  calcDrivingMinutes,
  calcHoursWorked,
  calcKmTraveled,
  calcWorkDayHours,
  continuousDrivingSinceLastValidBreak,
  dedupeBreakBlocks,
  diffInMinutes,
  getTimeAtUtcOffset,
  getTotalBreakMinutes,
  parseStoredBreakBlocks,
  parseTimeToMinutes,
  requiredBreakPlan,
} from './time.ts';

test('parseTimeToMinutes accepts valid 24-hour times only', () => {
  assert.equal(parseTimeToMinutes('00:00'), 0);
  assert.equal(parseTimeToMinutes('23:59'), 1439);
  for (const value of ['24:00', '12:60', '9:10', '12:3', '12:ab']) {
    assert.equal(parseTimeToMinutes(value), null);
  }
});

test('diffInMinutes handles midnight without accepting malformed values', () => {
  assert.equal(diffInMinutes('23:30', '01:00'), 90);
  assert.equal(diffInMinutes('08:00', '08:00'), 0);
  assert.equal(diffInMinutes('25:00', '26:00'), null);
});

test('calcDrivingMinutes includes an active session and subtracts persisted breaks', () => {
  const minutes = calcDrivingMinutes([
    { startTime: '08:00', endTime: '10:00', status: 'paused' },
    { startTime: '10:45', endTime: null, status: 'active' },
  ], '08:00', null, { currentTime: '13:15', breakMinutes: 45 });
  assert.equal(minutes, 225);
});

test('calcHoursWorked does not silently clamp valid durations', () => {
  assert.equal(calcHoursWorked([], '00:00', '16:00'), 16);
});

test('calcKmTraveled rejects invalid session mileage and supports zero readings', () => {
  assert.equal(calcKmTraveled([{ startKm: 100, endKm: 180 }, { startKm: 180, endKm: 240 }]), 140);
  assert.equal(calcKmTraveled([{ startKm: 180, endKm: 100 }]), null);
  assert.equal(calcKmTraveled([], 0, 0), 0);
});

test('calcWorkDayHours counts only the requested driver by default', () => {
  const workDay = {
    startTime: '08:00',
    endTime: '12:00',
    drivingSessions: [
      { startTime: '08:00', endTime: '09:00', status: 'paused', driverNumber: 1 },
      { startTime: '09:00', endTime: '12:00', status: 'ended', driverNumber: 2 },
    ],
  };
  const now = new Date('2026-09-28T12:00:00.000Z');
  assert.equal(calcWorkDayHours(workDay, now), 1);
  assert.equal(calcWorkDayHours(workDay, now, null), 4);
});

test('calcWorkDayHours follows the selected primary driver', () => {
  const workDay = {
    primaryDriverNumber: 2,
    drivingSessions: [
      { startTime: '08:00', endTime: '09:00', status: 'paused', driverNumber: 1 },
      { startTime: '09:00', endTime: '12:00', status: 'ended', driverNumber: 2 },
    ],
  };
  const now = new Date('2026-09-28T12:00:00.000Z');
  assert.equal(calcWorkDayHours(workDay, now), 3);
  assert.equal(calcWorkDayHours(workDay, now, null), 4);
});

test('getTimeAtUtcOffset formats a UTC instant in the recorded offset', () => {
  assert.equal(getTimeAtUtcOffset(new Date('2026-01-02T23:30:00.000Z'), '+02:00'), '01:30');
  assert.equal(getTimeAtUtcOffset(new Date('2026-01-02T23:30:00.000Z'), '-03:00'), '20:30');
});

test('getTotalBreakMinutes includes elapsed active break time', () => {
  assert.equal(
    getTotalBreakMinutes(15, new Date('2026-09-28T10:00:00.000Z'), new Date('2026-09-28T11:40:00.000Z')),
    115
  );
});

// ─── Blocos de pausa (breakBlocks) e limite de 4h30 — Reg. CE 561/2006 Art. 7 ───

const iso = (day: string, hhmm: string) => `${day}T${hhmm}:00.000Z`;

test('parseStoredBreakBlocks accepts JSON strings and arrays of valid blocks', () => {
  const json = JSON.stringify([
    { start: iso('2026-10-02', '10:00'), end: iso('2026-10-02', '10:45'), minutes: 45 },
  ]);
  assert.equal(parseStoredBreakBlocks(json).length, 1);
  assert.equal(parseStoredBreakBlocks([{ start: iso('2026-10-02', '10:00'), end: iso('2026-10-02', '10:15'), minutes: 15 }]).length, 1);
});

test('parseStoredBreakBlocks rejects invalid blocks and garbage input', () => {
  assert.deepEqual(parseStoredBreakBlocks('not-json'), []);
  assert.deepEqual(parseStoredBreakBlocks(null), []);
  assert.deepEqual(parseStoredBreakBlocks(undefined), []);
  assert.deepEqual(parseStoredBreakBlocks('{"start": "x"}'), []);
  // end antes do start
  assert.deepEqual(parseStoredBreakBlocks([{ start: iso('2026-10-02', '11:00'), end: iso('2026-10-02', '10:00'), minutes: 60 }]), []);
  // minutos <= 0
  assert.deepEqual(parseStoredBreakBlocks([{ start: iso('2026-10-02', '10:00'), end: iso('2026-10-02', '10:30'), minutes: 0 }]), []);
  // timestamps inválidos
  assert.deepEqual(parseStoredBreakBlocks([{ start: 'abc', end: 'def', minutes: 20 }]), []);
  // minutes maior que o intervalo real é limitado ao intervalo
  const [block] = parseStoredBreakBlocks([{ start: iso('2026-10-02', '10:00'), end: iso('2026-10-02', '10:20'), minutes: 500 }]);
  assert.equal(block.minutes, 20);
});

test('dedupeBreakBlocks removes duplicates and sorts by start', () => {
  const a = { start: iso('2026-10-02', '12:00'), end: iso('2026-10-02', '12:30'), minutes: 30 };
  const b = { start: iso('2026-10-02', '10:00'), end: iso('2026-10-02', '10:15'), minutes: 15 };
  const deduped = dedupeBreakBlocks([a, b, { ...a }]);
  assert.equal(deduped.length, 2);
  assert.equal(deduped[0].start, b.start);
});

test('requiredBreakPlan: continuous 45min break satisfies the requirement', () => {
  const plan = requiredBreakPlan([
    { start: iso('2026-10-02', '12:00'), end: iso('2026-10-02', '12:45'), minutes: 45 },
  ]);
  assert.equal(plan.mode, 'continuous');
  assert.equal(plan.isSatisfied, true);
  assert.equal(plan.remainingMinutes, 0);
});

test('requiredBreakPlan: split 15+30 combination satisfies the requirement', () => {
  const plan = requiredBreakPlan([
    { start: iso('2026-10-02', '10:00'), end: iso('2026-10-02', '10:15'), minutes: 15 },
    { start: iso('2026-10-02', '12:00'), end: iso('2026-10-02', '12:30'), minutes: 30 },
  ]);
  assert.equal(plan.mode, 'split');
  assert.equal(plan.isSatisfied, true);
  assert.equal(plan.remainingMinutes, 0);
});

test('requiredBreakPlan: partial breaks report remaining minutes', () => {
  const plan = requiredBreakPlan([
    { start: iso('2026-10-02', '10:00'), end: iso('2026-10-02', '10:15'), minutes: 15 },
  ]);
  assert.equal(plan.isSatisfied, false);
  assert.equal(plan.hasValidBreak, true);
  assert.equal(plan.remainingMinutes, 30);
});

test('requiredBreakPlan: multiple renewals — last valid break wins', () => {
  const plan = requiredBreakPlan([
    { start: iso('2026-10-02', '09:00'), end: iso('2026-10-02', '09:45'), minutes: 45 },
    { start: iso('2026-10-02', '13:00'), end: iso('2026-10-02', '13:15'), minutes: 15 },
    { start: iso('2026-10-02', '15:00'), end: iso('2026-10-02', '15:30'), minutes: 30 },
  ]);
  assert.equal(plan.isSatisfied, true);
  assert.equal(plan.mode, 'split');
});

test('continuousDrivingSinceLastValidBreak counts only driving after the last valid break', () => {
  const day = '2026-10-02';
  const sessions = [
    { startTime: '06:00', endTime: '12:00', status: 'ended' }, // 360 min antes da pausa
    { startTime: '12:45', endTime: '14:00', status: 'ended' }, // 75 min depois da pausa
  ];
  const blocks = [{ start: iso(day, '12:00'), end: iso(day, '12:45'), minutes: 45 }];
  const now = new Date(`${day}T14:00:00.000Z`);
  assert.equal(continuousDrivingSinceLastValidBreak(sessions, day, '+00:00', blocks, now), 75);
});

test('continuousDrivingSinceLastValidBreak without any break counts all driving up to now', () => {
  const day = '2026-10-02';
  const sessions = [{ startTime: '08:00', endTime: null, status: 'active' }];
  const now = new Date(`${day}T12:30:00.000Z`);
  assert.equal(continuousDrivingSinceLastValidBreak(sessions, day, '+00:00', [], now), 270);
});

test('continuousDrivingSinceLastValidBreak respects the UTC offset of the day', () => {
  const day = '2026-10-02';
  // Sessões em hora local "+01:00": 08:00–10:00 local = 07:00–09:00 UTC.
  const sessions = [{ startTime: '08:00', endTime: '10:00', status: 'ended' }];
  const now = new Date(`${day}T09:00:00.000Z`); // 10:00 local
  assert.equal(continuousDrivingSinceLastValidBreak(sessions, day, '+01:00', [], now), 120);
});

test('continuousDrivingSinceLastValidBreak: split break 15+30 renews the cycle', () => {
  const day = '2026-10-02';
  const sessions = [
    { startTime: '06:00', endTime: '10:00', status: 'ended' },
    { startTime: '10:15', endTime: '10:45', status: 'ended' },
    { startTime: '11:15', endTime: '12:00', status: 'ended' },
  ];
  const blocks = [
    { start: iso(day, '10:00'), end: iso(day, '10:15'), minutes: 15 },
    { start: iso(day, '10:45'), end: iso(day, '11:15'), minutes: 30 },
  ];
  const now = new Date(`${day}T12:00:00.000Z`);
  assert.equal(continuousDrivingSinceLastValidBreak(sessions, day, '+00:00', blocks, now), 45);
});