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
import {
  calcDrivingMinutes,
  minutesToFormatted,
  parseStoredBreakBlocks,
  requiredBreakPlan,
  continuousDrivingSinceLastValidBreak,
  MAX_CONTINUOUS_DRIVING_MINUTES,
} from '@/lib/time';
import { formatDatePt, getLocalTimeString } from '@/lib/timezone';
import type { ConformityStatus, WorkingTimeResult, BreakState } from './useDiarioActions';
import type { ContinuousDrivingInfo } from '@/components/diario/BreakStatusCard';

export function useWorkingTime(currentDay: WorkDay | null, breakState?: BreakState, now: Date | null = null) {
  const formatTime = (time: string | null) => time || '--:--';

  const formatDate = (dateStr: string) => {
    return formatDatePt(dateStr);
  };

  /**
   * Calcula o total de minutos de pausa que devem ser subtraídos.
   * Inclui:
   *   - Pausas já concluídas (completedBreakMinutes)
   *   - Pausa activa em curso (se houver)
   */
  const getBreakMinutes = useCallback((): number => {
    let total = breakState?.completedBreakMinutes ?? currentDay?.breakMinutes ?? 0;

    if (breakState?.isActive && breakState.startTime && now) {
      const elapsed = Math.floor((now.getTime() - breakState.startTime.getTime()) / 60000);
      total += Math.max(elapsed, 0);
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

  /**
   * Calcula a condução contínua (limite legal de 4h30 — Reg. CE 561/2006, Art. 7)
   * combinando:
   *  - as sessões de condução do dia ("HH:MM" convertidos em Dates absolutos com
   *    base na data do dia e no offset UTC do dia);
   *  - os blocos de pausa persistidos (`currentDay.breakBlocks` via parseStoredBreakBlocks)
   *    juntando os blocos concluídos locais (breakState.completedBlocks);
   *  - o plano obrigatório de pausa (requiredBreakPlan: 45 min contínuos OU 15+30);
   *  - a pausa em curso (startTime de breakState), que congela o contador.
   */
  const getContinuousDrivingInfo = useCallback((): ContinuousDrivingInfo | null => {
    if (!currentDay?.startTime || currentDay.endTime) return null;

    const referenceNow = now ?? new Date();

    // Blocos persistidos + blocos locais ainda não gravados (sem duplicar).
    const storedBlocks = parseStoredBreakBlocks(currentDay.breakBlocks);
    const localBlocks = breakState?.completedBlocks ?? [];
    const seen = new Set(storedBlocks.map(b => `${b.start}|${b.end}`));
    const blocks = [...storedBlocks, ...localBlocks.filter(b => !seen.has(`${b.start}|${b.end}`))];

    const plan = requiredBreakPlan(blocks);

    // Pausa em curso: o contador de condução contínua está congelado.
    if (breakState?.isActive && breakState.startTime) {
      return {
        continuousMinutes: continuousDrivingSinceLastValidBreak(
          currentDay.drivingSessions ?? [],
          currentDay.date,
          currentDay.utcOffset,
          blocks,
          breakState.startTime
        ),
        limitMinutes: MAX_CONTINUOUS_DRIVING_MINUTES,
        hasValidBreak: plan.hasValidBreak,
        mode: plan.mode,
        breakRequired: false,
        approachingLimit: false,
      };
    }

    const continuousMinutes = continuousDrivingSinceLastValidBreak(
      currentDay.drivingSessions ?? [],
      currentDay.date,
      currentDay.utcOffset,
      blocks,
      referenceNow
    );

    return {
      continuousMinutes,
      limitMinutes: MAX_CONTINUOUS_DRIVING_MINUTES,
      hasValidBreak: plan.hasValidBreak,
      mode: plan.mode,
      breakRequired: continuousMinutes >= MAX_CONTINUOUS_DRIVING_MINUTES,
      approachingLimit:
        continuousMinutes >= MAX_CONTINUOUS_DRIVING_MINUTES - 30 &&
        continuousMinutes < MAX_CONTINUOUS_DRIVING_MINUTES,
    };
  }, [currentDay, breakState, now]);

  return {
    calculateWorkingTime,
    getBreakMinutes,
    getConformityStatus,
    getContinuousDrivingInfo,
    formatTime,
    formatDate,
  };
}
