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
import { parseTimeToMinutes, minutesToFormatted } from '@/lib/time';
import { formatDatePt } from '@/lib/timezone';
import type { ConformityStatus, WorkingTimeResult, BreakState } from './useDiarioActions';

export function useWorkingTime(currentDay: WorkDay | null, breakState?: BreakState) {
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
    if (!breakState) return 0;

    let total = breakState.completedBreakMinutes || 0;

    // Se há uma pausa activa, somar o tempo desde o início até agora
    if (breakState.isActive && breakState.startTime) {
      const elapsed = Math.floor((Date.now() - breakState.startTime.getTime()) / 60000);
      total += Math.max(elapsed, 0);
    }

    return total;
  }, [breakState]);

  const calculateWorkingTime = useCallback((): WorkingTimeResult => {
    if (!currentDay?.startTime) return { hours: 0, minutes: 0, formatted: '0:00', totalMinutes: 0 };

    const sessions = currentDay.drivingSessions || [];
    const now = new Date();
    const nowMinutes = now.getHours() * 60 + now.getMinutes();
    let totalMinutes = 0;

    for (const session of sessions) {
      const sessionStart = parseTimeToMinutes(session.startTime);
      if (sessionStart === null) continue;

      if (session.endTime) {
        const sessionEnd = parseTimeToMinutes(session.endTime);
        if (sessionEnd !== null) {
          let diff = sessionEnd - sessionStart;
          if (diff < 0) diff += 24 * 60;
          totalMinutes += diff;
        }
      } else {
        let diff = nowMinutes - sessionStart;
        if (diff < 0) diff += 24 * 60;
        totalMinutes += diff;
      }
    }

    if (totalMinutes === 0) {
      // Fallback: usar startTime → agora (tempo total decorrido)
      const startMin = parseTimeToMinutes(currentDay.startTime);
      if (startMin !== null) {
        let diff = nowMinutes - startMin;
        if (diff < 0) diff += 24 * 60;
        totalMinutes = diff;
      }
    }

    // ═══════════════════════════════════════════════════════════════
    // SUBTRAIR TEMPO DE PAUSA (Reg. CE 561/2006)
    // O tempo de pausa NÃO conta como tempo de condução.
    // Isto aplica-se ao cálculo das 9h diárias de condução.
    // ═══════════════════════════════════════════════════════════════
    const breakMinutes = getBreakMinutes();
    const drivingMinutes = Math.max(0, totalMinutes - breakMinutes);

    return {
      hours: Math.floor(drivingMinutes / 60),
      minutes: drivingMinutes % 60,
      formatted: minutesToFormatted(drivingMinutes),
      totalMinutes: drivingMinutes,
    };
  }, [currentDay, getBreakMinutes]);

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
    getConformityStatus,
    formatTime,
    formatDate,
  };
}
