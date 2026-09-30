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
// ─── Pausa inteligente (botão único, Reg. CE 561/2006 Art. 7) ───────────────
import { computeBreakPhase, creditedBreakMinutes, gainedBreakMinutes, nextBreakState } from './time.ts';

test('computeBreakPhase: blocos inválidos não contam, fase 1 exige 30 contínuos', () => {
  assert.deepEqual(computeBreakPhase(14, false), { phase: 'awaiting15', remainingRequiredMinutes: 45 });
  assert.deepEqual(computeBreakPhase(15, false), { phase: 'awaiting30', remainingRequiredMinutes: 30 });
  assert.deepEqual(computeBreakPhase(29, false), { phase: 'awaiting30', remainingRequiredMinutes: 30 });
  assert.deepEqual(computeBreakPhase(44, false), { phase: 'awaiting30', remainingRequiredMinutes: 30 });
  assert.deepEqual(computeBreakPhase(45, false), { phase: 'done', remainingRequiredMinutes: 0 });
  assert.deepEqual(computeBreakPhase(29, true), { phase: 'awaiting30', remainingRequiredMinutes: 30 });
  assert.deepEqual(computeBreakPhase(30, true), { phase: 'done', remainingRequiredMinutes: 0 });
});

test('creditedBreakMinutes: bloco conta pelo valor completo mais baixo (29m sem fase 1 = 15)', () => {
  assert.equal(creditedBreakMinutes(10, false), 0);   // <15 não conta
  assert.equal(creditedBreakMinutes(14, false), 0);
  assert.equal(creditedBreakMinutes(15, false), 15);
  assert.equal(creditedBreakMinutes(29, false), 15);  // utilizador: 29m sem fase 1 → conta 15
  assert.equal(creditedBreakMinutes(44, false), 15);
  assert.equal(creditedBreakMinutes(45, false), 45);
  assert.equal(creditedBreakMinutes(120, false), 45); // só desconta os 45 válidos
  assert.equal(creditedBreakMinutes(29, true), 15);   // fase 2 com 29m → nada novo
  assert.equal(creditedBreakMinutes(30, true), 45);   // fase 2 cumprida
});

test('nextBreakState ao terminar um bloco segue a regra dos três valores', () => {
  // Sem fase 1
  assert.deepEqual(nextBreakState(10, false), { hadPhase15: false, completedBreakMinutes: 0, fullyDone: false });
  assert.deepEqual(nextBreakState(29, false), { hadPhase15: true, completedBreakMinutes: 15, fullyDone: false });
  assert.deepEqual(nextBreakState(45, false), { hadPhase15: false, completedBreakMinutes: 45, fullyDone: true });
  // Com fase 1: <30 contínuos NÃO contabiliza e mantém a fase 1 pendente
  assert.deepEqual(nextBreakState(27, true), { hadPhase15: true, completedBreakMinutes: 0, fullyDone: false });
  assert.deepEqual(nextBreakState(29, true), { hadPhase15: true, completedBreakMinutes: 0, fullyDone: false });
  assert.deepEqual(nextBreakState(30, true), { hadPhase15: false, completedBreakMinutes: 45, fullyDone: true });
});

test('gainedBreakMinutes mantém a tabela de ganhos por bloco', () => {
  assert.equal(gainedBreakMinutes(14, false), 0);
  assert.equal(gainedBreakMinutes(29, false), 15);
  assert.equal(gainedBreakMinutes(45, false), 45);
  assert.equal(gainedBreakMinutes(29, true), 0);
  assert.equal(gainedBreakMinutes(30, true), 30);
});
