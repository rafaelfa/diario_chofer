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

export type WorkActivityType = 'loading' | 'unloading' | 'refueling' | 'other';

export interface WorkActivity {
  id: string;
  workDayId: string;
  userId: string;
  driverNumber: 1 | 2;
  type: WorkActivityType;
  startedAt: string;
  endedAt: string | null;
  startKm: number | null;
  endKm: number | null;
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
  breakType?: 'continuous' | 'split' | null;
  breakMinutes?: number;
  /** Minutos de condução acumulados quando a última pausa legal terminou (base do contador 4h30) */
  drivingMinutesAtLastBreak?: number | null;
  events: WorkDayEvent[];
  drivingSessions?: DrivingSession[];
  workActivities?: WorkActivity[];
  activeWorkActivity?: WorkActivity | null;
  // Campos calculados devolvidos pela API
  kmTraveled: number | null;
  hoursWorked: number | null;
  /** Minutos em atividades sem condução (carregamento, abastecimento, ...) */
  activityMinutes?: number;
  totalEvents: number;
  lastSessionKm?: number | null;
  sessionCount?: number;
}

export interface ReportStatistics {
  daysWorked: number;
  totalKm: number;
  totalHours: number;
  totalEvents: number;
  /** Minutos em atividades sem condução (carregamento, abastecimento, ...) no período */
  totalActivityMinutes?: number;
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
