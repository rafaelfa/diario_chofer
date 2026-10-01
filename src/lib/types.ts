/**
 * Tipos partilhados entre componentes e hooks.
 * Centraliza as interfaces que antes estavam duplicadas no topo de page.tsx.
 */

export interface DrivingSession {
  id: string;
  workDayId: string;
  startTime: string;
  endTime: string | null;
  startKm: number | null;
  endKm: number | null;
  status: 'active' | 'paused' | 'ended';
  driverNumber?: 1 | 2;
  utcOffset?: string | null;
}

export interface WorkDayEvent {
  id: string;
  workDayId: string;
  time: string;
  description: string;
}

export interface BreakBlock {
  /** Timestamp ISO do início do bloco de pausa */
  start: string;
  /** Timestamp ISO do fim do bloco ('' se ainda estiver em curso) */
  end: string;
  /** Duração real medida em minutos completos */
  minutes: number;
}

/** Estado da avaliação da pausa (regra 45m / 15m+30m) — ver evaluateBreakBlocks em lib/time. */
export interface BreakStatusInfo {
  validMinutes: number;
  remainingMinutes: number;
  isComplete: boolean;
  hasContinuous45: boolean;
  hasFirstBlock: boolean;
  hasSecondBlock: boolean;
  activeMinutes: number;
  activeRemaining: number;
  label: string;
}

export interface WorkDay {
  id: string;
  date: string;
  startTime: string;
  endTime: string | null;
  startCountry: string | null;
  endCountry: string | null;
  startKm: number | null;
  endKm: number | null;
  lastRest: string | null;
  amplitude: string | null;
  truckCheck: boolean;
  observations: string | null;
  matricula: string | null;
  isPaused: boolean;
  numDrivers: number;
  primaryDriverNumber?: 1 | 2;
  timezone?: string | null;
  utcOffset?: string | null;
  breakStart?: string | null;
  /** @deprecated Campo legado — a regra atual usa blocos medidos (breakBlocks). */
  breakType?: 'continuous' | 'split' | null;
  /** @deprecated Total bruto legado; usar breakBlocks para a regra 45m/15+30m. */
  breakMinutes?: number;
  /** Blocos de pausa medidos (persistidos como Json na tabela work_days) */
  breakBlocks?: BreakBlock[] | unknown;
  events: WorkDayEvent[];
  drivingSessions?: DrivingSession[];
  // Campos calculados devolvidos pela API
  kmTraveled: number | null;
  hoursWorked: number | null;
  totalEvents: number;
  lastSessionKm?: number | null;
  sessionCount?: number;
}

export interface ReportStatistics {
  daysWorked: number;
  totalKm: number;
  totalHours: number;
  totalEvents: number;
  avgHoursPerDay: number;
  avgKmPerDay: number;
}

import type { DrivingLimitResult } from '@/lib/regulation561';

export interface Report {
  period: { start: string; end: string; type: string };
  statistics: ReportStatistics;
  alerts: string[];
  drivingLimits?: DrivingLimitResult | null;
  workDays?: WorkDay[];
}

export interface VehicleStats {
  matricula: string;
  viagens: number;
  diasTrabalhados: number;
  totalKm: number;
  totalHoras: number;
  mediaKmPorDia: number;
  mediaHorasPorDia: number;
  totalEventos: number;
  kmInicial: number | null;
  kmFinal: number | null;
  primeiroRegistro: string;
  ultimoRegistro: string;
  paises: string[];
  checksRealizados: number;
}

export interface VehicleHistory {
  id: string;
  date: string;
  startTime: string;
  endTime: string;
  startKm: number | null;
  endKm: number | null;
  kmTraveled: number | null;
  startCountry: string | null;
  endCountry: string | null;
}

export type ActiveView = 'main' | 'history' | 'reports' | 'settings';
export type ToastType = 'success' | 'error' | 'warning';

export interface ToastState {
  message: string;
  type: ToastType;
}
