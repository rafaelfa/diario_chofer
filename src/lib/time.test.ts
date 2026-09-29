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