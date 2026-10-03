'use client';

/**
 * Hook useWorkingTime — time calculations and formatting helpers.
 * Takes currentDay and breakState as parameters so it remains pure.
 *
 * IMPORTANT (v4.1.5): Break time does NOT count toward driving time.
 *   Reg. CE 561/2006, Art. 5 — Maximum driving time is 9h/day.
 *   Breaks (30+15 or 45min) are excluded from this calculation.
 *   The TrafficLightStatus and CircularTimeCounter show DRIVING time only.
 *   The AmplitudeCard (separate) shows total amplitude including breaks.
 *
 * IMPORTANT (v4.2.0): Non-driving work activities (loading, unloading, refueling)
 *   never count as driving — they only extend the day's amplitude.
 *   `calculateContinuousTime` tracks driving since the last LEGAL break (4h30 limit);
 *   an activity neither adds to it nor resets it.
 */

import { useCallback } from 'react';
import type { WorkDay } from '@/lib/types';
import { calcDrivingMinutes, calcContinuousDrivingMinutes, getBreakDurationMinutes, minutesToFormatted } from '@/lib/time';
import { evaluateCurrentDailyDriving } from '@/lib/regulation561';
import { formatDatePt, getLocalTimeString } from '@/lib/timezone';
import type { ConformityStatus, WorkingTimeResult, BreakState } from './useDiarioActions';

export function useWorkingTime(currentDay: WorkDay | null, breakState?: BreakState, now: Date | null = null) {
  const formatTime = (time: string | null) => time || '--:--';

  const formatDate = (dateStr: string) => {
    return formatDatePt(dateStr);
  };

  /**
   * Calcula o total de minutos de pausa que devem ser subtraídos.
   * Inclui:
    *   - Duração real das pausas concluídas (completedPauseMinutes)
   *   - Pausa activa em curso (se houver)
   */
  const getBreakMinutes = useCallback((): number => {
    let total = breakState?.completedPauseMinutes
      ?? getBreakDurationMinutes(currentDay?.breakPeriods, currentDay?.breakMinutes, currentDay?.breakStart, now ?? new Date());

    if (breakState?.isActive && breakState.startTime && now) {
      const elapsed = Math.floor((now.getTime() - breakState.startTime.getTime()) / 60000);
      total += Math.max(elapsed, 0);
    }

    return Math.max(total, 0);
  }, [breakState, currentDay?.breakMinutes, currentDay?.breakPeriods, currentDay?.breakStart, now]);

  const calculateWorkingTime = useCallback((): WorkingTimeResult => {
    if (!currentDay?.startTime) return { hours: 0, minutes: 0, formatted: '0:00', totalMinutes: 0 };

    const sessions = (currentDay.drivingSessions || []).filter(
      session => (session.driverNumber ?? 1) === (currentDay.primaryDriverNumber ?? 1)
    );
    const drivingMinutes = calcDrivingMinutes(
      sessions,
      currentDay.startTime,
      currentDay.endTime,
      {
        currentTime: now ? getLocalTimeString(now) : undefined,
        breakMinutes: getBreakMinutes(),
        activities: currentDay.workActivities,
        utcOffset: currentDay.utcOffset,
      }
    ) ?? 0;

    return {
      hours: Math.floor(drivingMinutes / 60),
      minutes: drivingMinutes % 60,
      formatted: minutesToFormatted(drivingMinutes),
      totalMinutes: drivingMinutes,
    };
  }, [currentDay, getBreakMinutes, now]);

  /**
   * Condução contínua desde a última pausa legal concluída (Reg. CE 561/2006, Art. 5º — 4h30).
   * Carregamento/abastecimento não somam aqui (não são condução) e também não reiniciam
   * o contador — só a pausa legal de 45min o reinicia.
   */
  const calculateContinuousTime = useCallback((): WorkingTimeResult => {
    const totalMinutes = calcContinuousDrivingMinutes(
      calculateWorkingTime().totalMinutes,
      currentDay?.drivingMinutesAtLastBreak
    );

    return {
      hours: Math.floor(totalMinutes / 60),
      minutes: totalMinutes % 60,
      formatted: minutesToFormatted(totalMinutes),
      totalMinutes,
    };
  }, [calculateWorkingTime, currentDay?.drivingMinutesAtLastBreak]);

  const getConformityStatus = useCallback((weeklyExceptionsUsedBeforeToday = 0, dailyDrivingMinutes?: number): ConformityStatus => {
    if (!currentDay?.startTime) {
      return { status: 'ok', message: '', maxHours: 9, dailyExtensionsUsedBeforeToday: weeklyExceptionsUsedBeforeToday };
    }

    const total = calculateWorkingTime();
    const breakMinutes = getBreakMinutes();
    const drivingMinutes = dailyDrivingMinutes ?? total.totalMinutes;
    const drivingFormatted = minutesToFormatted(drivingMinutes);
    const dailyStatus = evaluateCurrentDailyDriving(drivingMinutes, weeklyExceptionsUsedBeforeToday);
    const pauseSummary = breakMinutes > 0 ? ` — Pausas: ${minutesToFormatted(breakMinutes)}` : '';

    const message = dailyStatus.reason === 'absolute-limit'
      ? `Limite absoluto de 10h excedido: ${drivingFormatted} de condução.`
      : dailyStatus.reason === 'exceptions-exhausted'
        ? `As duas extensões semanais já foram usadas. O limite diário de 9h foi ultrapassado (${drivingFormatted}).`
        : dailyStatus.reason === 'extension'
          ? `Extensão legal ${dailyStatus.extensionNumber}/2 em uso: ${drivingFormatted} de condução (máximo de 10h hoje).`
          : dailyStatus.reason === 'approaching'
            ? `${drivingFormatted} de condução — próximo do limite diário de 9h.`
            : `${drivingFormatted} de condução — dentro do limite diário de 9h.`;

    return {
      status: dailyStatus.status,
      message: `${message}${pauseSummary}`,
      maxHours: dailyStatus.maxHours,
      dailyExtensionsUsedBeforeToday: weeklyExceptionsUsedBeforeToday,
    };
  }, [currentDay, calculateWorkingTime, getBreakMinutes]);

  return {
    calculateWorkingTime,
    calculateContinuousTime,
    getBreakMinutes,
    getConformityStatus,
    formatTime,
    formatDate,
  };
}
