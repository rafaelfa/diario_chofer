import assert from 'node:assert/strict';
import test from 'node:test';
import {
  calcActivityMinutesInRange,
  calcContinuousDrivingMinutes,
  calcDrivingMinutes,
  calcHoursWorked,
  calcKmTraveled,
  calcWorkDayDrivingMinutes,
  calcWorkActivityMinutes,
  calcWorkDayHours,
  diffInMinutes,
  getTimeAtUtcOffset,
  getTotalBreakMinutes,
  parseTimeToMinutes,
  resolveBreakCredit,
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
  assert.equal(calcKmTraveled([{ startKm: 100, endKm: null }, { startKm: null, endKm: 150 }], 100, 150), 50);
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

test('calcWorkDayDrivingMinutes preserves the exact minute above nine hours', () => {
  const minutes = calcWorkDayDrivingMinutes({
    startTime: '08:00',
    endTime: '17:01',
    drivingSessions: [{ startTime: '08:00', endTime: '17:01', status: 'ended', driverNumber: 1 }],
  }, new Date('2026-09-28T17:01:00.000Z'));

  assert.equal(minutes, 541);
});

test('non-driving work activity stays in amplitude but not driving time', () => {
  const now = new Date('2026-09-28T12:30:00.000Z');
  const workDay = {
    startTime: '08:00',
    drivingSessions: [
      { startTime: '08:00', endTime: '10:00', status: 'paused', driverNumber: 1, utcOffset: '+00:00' },
      { startTime: '11:00', endTime: null, status: 'active', driverNumber: 1, utcOffset: '+00:00' },
    ],
    workActivities: [{ type: 'refueling', startedAt: '2026-09-28T10:00:00.000Z', endedAt: '2026-09-28T11:00:00.000Z' }],
  };

  assert.equal(calcWorkDayHours(workDay, now), 3.5);
  assert.equal(diffInMinutes(workDay.startTime, '12:30'), 270);
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

test('calcActivityMinutesInRange only counts the overlap with the window', () => {
  const offset = '+00:00';
  const inside = [{ startedAt: '2026-09-28T10:00:00.000Z', endedAt: '2026-09-28T11:00:00.000Z' }];
  assert.equal(calcActivityMinutesInRange(inside, '08:00', '12:00', offset), 60);

  const partial = [{ startedAt: '2026-09-28T07:00:00.000Z', endedAt: '2026-09-28T09:00:00.000Z' }];
  assert.equal(calcActivityMinutesInRange(partial, '08:00', '12:00', offset), 60);

  const openEnded = [{ startedAt: '2026-09-28T11:30:00.000Z', endedAt: null }];
  assert.equal(calcActivityMinutesInRange(openEnded, '08:00', '12:00', offset), 30);

  assert.equal(calcActivityMinutesInRange(null, '08:00', '12:00', offset), 0);
  assert.equal(calcActivityMinutesInRange(inside, null, '12:00', offset), 0);
});

test('calcActivityMinutesInRange covers windows that cross midnight', () => {
  const activity = [{ startedAt: '2026-09-28T23:30:00.000Z', endedAt: '2026-09-29T00:15:00.000Z' }];
  assert.equal(calcActivityMinutesInRange(activity, '23:00', '01:00', '+00:00'), 45);
});

test('calcDrivingMinutes subtracts activities with sessions and with the fallback', () => {
  const activities = [{ startedAt: '2026-09-28T10:00:00.000Z', endedAt: '2026-09-28T11:00:00.000Z' }];

  const fallback = calcDrivingMinutes([], '08:00', null, {
    currentTime: '12:00',
    activities,
    utcOffset: '+00:00',
  });
  assert.equal(fallback, 180);

  const session = calcDrivingMinutes(
    [{ startTime: '08:00', endTime: '13:00', status: 'paused' }],
    '08:00',
    null,
    { activities, utcOffset: '+00:00' }
  );
  assert.equal(session, 240);
});

test('calcDrivingMinutes subtracts activity from a session crossing midnight', () => {
  const minutes = calcDrivingMinutes(
    [{ startTime: '23:00', endTime: '01:00', status: 'paused' }],
    null,
    null,
    {
      activities: [{ startedAt: '2026-09-28T23:30:00.000Z', endedAt: '2026-09-29T00:15:00.000Z' }],
      utcOffset: '+00:00',
    }
  );
  assert.equal(minutes, 75);
});

test('resolveBreakCredit only counts valid pauses and ignores partial/random time', () => {
  assert.deepEqual(resolveBreakCredit(16, 45), { creditedMinutes: 15, remainingDebtMinutes: 30, resetContinuous: false });
  assert.deepEqual(resolveBreakCredit(30, 30), { creditedMinutes: 30, remainingDebtMinutes: 45, resetContinuous: true });
  assert.deepEqual(resolveBreakCredit(27, 30), { creditedMinutes: 0, remainingDebtMinutes: 30, resetContinuous: false });
  assert.deepEqual(resolveBreakCredit(29, 45), { creditedMinutes: 15, remainingDebtMinutes: 30, resetContinuous: false });
  assert.deepEqual(resolveBreakCredit(45, 45), { creditedMinutes: 45, remainingDebtMinutes: 45, resetContinuous: true });
  assert.deepEqual(resolveBreakCredit(15, 45), { creditedMinutes: 15, remainingDebtMinutes: 30, resetContinuous: false });
});

test('calcContinuousDrivingMinutes only resets with a legal break', () => {
  assert.equal(calcContinuousDrivingMinutes(250, null), 250);
  assert.equal(calcContinuousDrivingMinutes(250, 0), 250);
  assert.equal(calcContinuousDrivingMinutes(250, 60), 190);
  assert.equal(calcContinuousDrivingMinutes(45, 120), 0);
});

test('calcWorkActivityMinutes totals activities up to now', () => {
  const now = new Date('2026-09-28T12:00:00.000Z');
  const activities = [
    { startedAt: '2026-09-28T09:00:00.000Z', endedAt: '2026-09-28T09:30:00.000Z' },
    { startedAt: '2026-09-28T11:00:00.000Z', endedAt: null },
  ];
  assert.equal(calcWorkActivityMinutes(activities, now), 90);
  assert.equal(calcWorkActivityMinutes(null, now), 0);
});