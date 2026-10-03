import assert from 'node:assert/strict';
import test from 'node:test';
import { aggregateDrivingByDate, computeDrivingLimits, countWeeklyDailyDrivingExceptions, evaluateCurrentDailyDriving, evaluateDailyDrivingLimits, getIsoWeekNumberUtc, getMonday } from './regulation561.ts';

test('getMonday returns the UTC Monday for a date in the week', () => {
  assert.equal(getMonday(new Date('2026-09-30T23:00:00.000Z')).toISOString(), '2026-09-28T00:00:00.000Z');
  assert.equal(getMonday(new Date('2026-10-04T23:00:00.000Z')).toISOString(), '2026-09-28T00:00:00.000Z');
});

test('computeDrivingLimits sums this and previous week, excluding future days', () => {
  const limits = computeDrivingLimits([
    { date: '2026-09-21', hoursWorked: 40 },
    { date: '2026-09-28', hoursWorked: 30 },
    { date: '2026-10-05', hoursWorked: 80 },
  ], new Date('2026-09-30T12:00:00.000Z'));

  assert.equal(limits.weeklyHours, 30);
  assert.equal(limits.biweeklyHours, 70);
  assert.equal(limits.weeklyStatus, 'ok');
});

test('computeDrivingLimits reports weekly and biweekly overages', () => {
  const limits = computeDrivingLimits([
    { date: '2026-09-21', hoursWorked: 45 },
    { date: '2026-09-28', hoursWorked: 58 },
  ], new Date('2026-09-30T12:00:00.000Z'));

  assert.equal(limits.weeklyStatus, 'danger');
  assert.equal(limits.biweeklyStatus, 'danger');
});

test('aggregateDrivingByDate sums multiple shifts on the same civil date', () => {
  const daily = aggregateDrivingByDate([
    { date: '2026-09-28T00:00:00.000Z', hoursWorked: 6 },
    { date: '2026-09-28T00:00:00.000Z', hoursWorked: 5 },
  ]);
  assert.equal(daily.length, 1);
  assert.equal(daily[0].hours, 11);
});

test('getIsoWeekNumberUtc returns ISO week around year boundaries', () => {
  assert.equal(getIsoWeekNumberUtc(new Date('2026-09-28T00:00:00.000Z')), 40);
  assert.equal(getIsoWeekNumberUtc(new Date('2021-01-01T00:00:00.000Z')), 53);
});

test('daily driving limits allow two 10-hour exceptions and reject later ones', () => {
  const dates = ['2026-09-28', '2026-09-29', '2026-09-30'];
  const result = evaluateDailyDrivingLimits(dates.map(value => ({
    date: new Date(`${value}T00:00:00.000Z`),
    hours: 10,
  })));
  assert.equal(result.overAbsoluteLimit.length, 0);
  assert.deepEqual(result.exceededWeeklyExceptions.map(day => day.date.toISOString().slice(0, 10)), ['2026-09-30']);
});

test('weekly exception count uses exact thresholds and ISO week boundaries', () => {
  const result = countWeeklyDailyDrivingExceptions([
    { date: '2026-09-27', hours: 10 },
    { date: '2026-09-28', hours: 9 },
    { date: '2026-09-29', hours: 541 / 60 },
    { date: '2026-09-30', hours: 10 },
    { date: '2026-10-01', hours: 601 / 60 },
    { date: '2026-10-05', hours: 10 },
  ], new Date('2026-09-30T12:00:00.000Z'));

  assert.equal(result, 2);
});

test('live daily driving status respects the two extensions and absolute 10-hour cap', () => {
  assert.equal(evaluateCurrentDailyDriving(540, 0).status, 'warning');
  assert.equal(evaluateCurrentDailyDriving(541, 0).extensionNumber, 1);
  assert.equal(evaluateCurrentDailyDriving(541, 1).extensionNumber, 2);
  assert.equal(evaluateCurrentDailyDriving(541, 2).reason, 'exceptions-exhausted');
  assert.equal(evaluateCurrentDailyDriving(601, 0).reason, 'absolute-limit');
});