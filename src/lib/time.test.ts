import assert from 'node:assert/strict';
import test from 'node:test';
import {
  calcDrivingMinutes,
  calcHoursWorked,
  calcKmTraveled,
  calcWorkDayHours,
  diffInMinutes,
  getTimeAtUtcOffset,
  getTotalBreakMinutes,
  parseTimeToMinutes,
  parseStoredBreakBlocks,
  continuousDrivingSinceLastValidBreak,
  buildAbsoluteSessions,
  getContinuousDrivingInfo,
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
// ─── v4.1.8: renovação dos 4h30 (condução contínua, Reg. CE 561/2006 Art. 7) ──

test('parseStoredBreakBlocks accepts JSON string or array and drops invalid blocks', () => {
  const valid = { start: '2026-10-01T10:00:00.000Z', end: '2026-10-01T10:45:00.000Z', minutes: 45 };
  assert.deepEqual(parseStoredBreakBlocks(JSON.stringify([valid])), [valid]);
  assert.deepEqual(parseStoredBreakBlocks([valid, valid]), [valid]); // dedupe
  assert.deepEqual(parseStoredBreakBlocks('not json'), []);
  assert.deepEqual(parseStoredBreakBlocks(null), []);
  assert.deepEqual(parseStoredBreakBlocks([{ ...valid, minutes: 0 }]), []);
  assert.deepEqual(parseStoredBreakBlocks([{ start: valid.end, end: valid.start, minutes: 45 }]), []);
});

test('continuousDrivingSinceLastValidBreak resets on a valid 45min break', () => {
  const day = '2026-10-01';
  const sessions = [
    { start: new Date(`${day}T05:00:00.000Z`), end: new Date(`${day}T09:30:00.000Z`) }, // 4h30
    { start: new Date(`${day}T10:30:00.000Z`), end: new Date(`${day}T12:00:00.000Z`) }, // +1h30 após pausa
  ];
  const blocks = [{ start: `${day}T09:30:00.000Z`, end: `${day}T10:15:00.000Z`, minutes: 45 }];
  assert.equal(continuousDrivingSinceLastValidBreak(sessions, blocks, new Date('2026-10-01T12:00:00.000Z')), 90);
});

test('a 15+30 pair within 75min renews the counter, isolated 15min does not', () => {
  const day = '2026-10-01';
  const sessions = [
    { start: new Date(`${day}T05:00:00.000Z`), end: new Date(`${day}T07:30:00.000Z`) }, // 2h30
    { start: new Date(`${day}T09:00:00.000Z`), end: new Date(`${day}T11:00:00.000Z`) }, // 2h
  ];
  // Par 15+30 com intervalo de 15min entre blocos (dentro de ≤75min) → válido
  const pair = [
    { start: `${day}T07:30:00.000Z`, end: `${day}T07:45:00.000Z`, minutes: 15 },
    { start: `${day}T08:00:00.000Z`, end: `${day}T08:30:00.000Z`, minutes: 30 },
  ];
  assert.equal(continuousDrivingSinceLastValidBreak(sessions, pair, new Date('2026-10-01T11:00:00.000Z')), 120);
  // Apenas 15min isolados → NÃO renova: acumula 2h30 + 2h = 4h30
  assert.equal(
    continuousDrivingSinceLastValidBreak(sessions, [pair[0]], new Date('2026-10-01T11:00:00.000Z')),
    270
  );
});

test('multiple valid breaks renew repeatedly (4h30→break→3h30 totals 8h)', () => {
  const day = '2026-10-01';
  const sessions = [
    { start: new Date(`${day}T05:00:00.000Z`), end: new Date(`${day}T09:30:00.000Z`) }, // 4h30
    { start: new Date(`${day}T10:15:00.000Z`), end: new Date(`${day}T12:00:00.000Z`) }, // 1h45
  ];
  const blocks = [
    { start: `${day}T09:30:00.000Z`, end: `${day}T10:15:00.000Z`, minutes: 45 },
  ];
  // Última pausa válida às 10:15 → contínuo = 1h45
  assert.equal(continuousDrivingSinceLastValidBreak(sessions, blocks, new Date('2026-10-01T12:00:00.000Z')), 105);
});

test('buildAbsoluteSessions converts HH:MM with utcOffset to absolute dates', () => {
  const sessions = buildAbsoluteSessions(
    '2026-10-01',
    [{ startTime: '08:00', endTime: '12:30', utcOffset: '+01:00' }],
    '+01:00'
  );
  assert.equal(sessions.length, 1);
  assert.equal(sessions[0].start.toISOString(), '2026-10-01T07:00:00.000Z');
  assert.equal(sessions[0].end?.toISOString(), '2026-10-01T11:30:00.000Z');
});

test('getContinuousDrivingInfo reports warning/exceeded states', () => {
  const workDay = {
    date: '2026-10-01',
    utcOffset: '+00:00',
    drivingSessions: [{ startTime: '05:00', endTime: '09:15', status: 'paused', driverNumber: 1 }],
    breakBlocks: [],
  };
  const info = getContinuousDrivingInfo(workDay, { now: new Date('2026-10-01T09:15:00.000Z') });
  assert.equal(info.continuousMinutes, 255);
  assert.equal(info.remainingMinutes, 15);
  assert.equal(info.warning, true);
  assert.equal(info.exceeded, false);
  assert.equal(info.limitMinutes, 270);

  const over = getContinuousDrivingInfo(
    { ...workDay, drivingSessions: [{ startTime: '05:00', endTime: '10:00', status: 'paused', driverNumber: 1 }] },
    { now: new Date('2026-10-01T10:00:00.000Z') }
  );
  assert.equal(over.continuousMinutes, 300);
  assert.equal(over.exceeded, true);
  assert.equal(over.remainingMinutes, 0);
});
