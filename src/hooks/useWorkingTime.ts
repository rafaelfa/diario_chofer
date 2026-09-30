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
 */

import { useCallback } from 'react';
import type { WorkDay } from '@/lib/types';
import { calcDrivingMinutes, minutesToFormatted, creditedBreakMinutes } from '@/lib/time';
import { formatDatePt, getLocalTimeString } from '@/lib/timezone';
import type { ConformityStatus, WorkingTimeResult, BreakState } from './useDiarioActions';

export function useWorkingTime(currentDay: WorkDay | null, breakState?: BreakState, now: Date | null = null) {
  const formatTime = (time: string | null) => time || '--:--';

  const formatDate = (dateStr: string) => {
    return formatDatePt(dateStr);
  };

  /**
   * Calcula o total de minutos de pausa VÁLIDOS que devem ser subtraídos.
   * Inclui:
   *   - Pausas já concluídas e válidas (completedBreakMinutes)
   *   - Pausa activa em curso — só desconta se for válida segundo o Reg. 561:
   *       • bloco ≥45 min contínuos, OU
   *       • fase 1 ≥15 min (desconta 15) seguida de fase 2 ≥30 min (desconta +30).
   *   Blocos inválidos (<15 sem fase 1; <30 com fase 1 cumprida) não descontam.
   */
  const getBreakMinutes = useCallback((): number => {
    let total = breakState?.completedBreakMinutes ?? currentDay?.breakMinutes ?? 0;

    if (breakState?.isActive && breakState.startTime && now) {
      const elapsed = Math.floor((now.getTime() - breakState.startTime.getTime()) / 60000);
      total += creditedBreakMinutes(elapsed, !!breakState.hadPhase15);
    }

    return Math.max(total, 0);
  }, [breakState, currentDay?.breakMinutes, now]);

  const calculateWorkingTime = useCallback((): WorkingTimeResult => {
    if (!currentDay?.startTime) return { hours: 0, minutes: 0, formatted: '0:00', totalMinutes: 0 };

    const sessions = (currentDay.drivingSessions || []).filter(
      session => (session.driverNumber ?? 1) === (currentDay.primaryDriverNumber ?? 1)
    );
    const drivingMinutes = calcDrivingMinutes(
      sessions,
      currentDay.startTime,
      currentDay.endTime,
      { currentTime: now ? getLocalTimeString(now) : undefined, breakMinutes: getBreakMinutes() }
    ) ?? 0;

    return {
      hours: Math.floor(drivingMinutes / 60),
      minutes: drivingMinutes % 60,
      formatted: minutesToFormatted(drivingMinutes),
      totalMinutes: drivingMinutes,
    };
  }, [currentDay, getBreakMinutes, now]);

  const getConformityStatus = useCallback((): ConformityStatus => {
    if (!currentDay?.startTime) return { status: 'ok', message: '' };

    const total = calculateWorkingTime();
    const totalHours = total.totalMinutes / 60;
    const breakMinutes = getBreakMinutes();

    if (totalHours > 9) {
      return {
        status: 'danger',
        message: `LIMITE DIÁRIO: ${total.formatted} de condução (máx 9h) — Pausas: ${minutesToFormatted(breakMinutes)}`
      };
    } else if (totalHours > 8) {
      return {
        status: 'warning',
        message: `${total.formatted} de condução — Aproximando do limite (pausas: ${minutesToFormatted(breakMinutes)})`
      };
    }

    if (breakMinutes > 0) {
      return { status: 'ok', message: `${total.formatted} de condução — Pausas: ${minutesToFormatted(breakMinutes)}` };
    }

    return { status: 'ok', message: `${total.formatted} de condução — OK` };
  }, [currentDay, calculateWorkingTime, getBreakMinutes]);

  return {
    calculateWorkingTime,
    getBreakMinutes,
    getConformityStatus,
    formatTime,
    formatDate,
  };
}
