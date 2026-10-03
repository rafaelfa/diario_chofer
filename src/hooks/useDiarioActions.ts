'use client';

/**
 * Hook useDiarioActions — FACADE that composes smaller hooks.
 *
 * Delegates to:
 *  - useConnectivity    (online/offline monitoring)
 *  - useWorkingTime     (time calculations, format helpers)
 *  - useDayForms        (start/end forms, events, matricula check)
 *  - useDialogManager   (toasts, dialogs, view/edit/delete, pause)
 *  - useReportFilters   (report type, custom dates)
 *
 * The return signature remains IDENTICAL so page.tsx needs no changes.
 */

import { useState, useEffect, useCallback } from 'react';
import { useRouter } from 'next/navigation';
import { useGeolocation } from '@/hooks/use-geolocation';
import { useConnectivity } from '@/hooks/useConnectivity';
import { useWorkingTime } from '@/hooks/useWorkingTime';
import { useDayForms } from '@/hooks/useDayForms';
import { useDialogManager } from '@/hooks/useDialogManager';
import { useReportFilters } from '@/hooks/useReportFilters';
import type { WorkActivityType, WorkDay, ActiveView } from '@/lib/types';
import { logError } from '@/lib/logger';
import { calcDrivingMinutes, calcWorkDayDrivingMinutes, getCompletedBreakDurationMinutes, getCreditedBreakMinutes, getRemainingBreakDebt, minutesToFormatted, resolveBreakCredit } from '@/lib/time';
import { aggregateDrivingByDate, countWeeklyDailyDrivingExceptions, getMonday } from '@/lib/regulation561';
import { validateMatricula } from '@/lib/validators';
import {
  getLocalDateString,
  getLocalTimeString,
  getClientTimezone,
  getUtcOffsetString,
} from '@/lib/timezone';

// ─── Re-export types (consumed by components) ────────────────────────────────

export interface StartFormState {
  startCountry: string;
  startKm: string;
  lastRest: string;
  truckCheck: boolean;
  matricula: string;
  numDrivers: number; // 1 = motorista único, 2 = equipa
  primaryDriverNumber: 1 | 2;
  /** Como a jornada arranca: condução ou serviço (carregamento/abastecimento) */
  startMode: 'driving' | 'service';
  /** Tipo de atividade quando startMode = 'service' */
  initialActivityType: WorkActivityType;
}

export interface EndFormState {
  endCountry: string;
  endKm: string;
  observations: string;
}

export interface NewEventState {
  time: string;
  description: string;
}

export interface LastKmInfo {
  found: boolean;
  lastKm: number | null;
  date?: string | null;
  endTime?: string | null;
  endCountry?: string | null;
  message?: string;
}

export interface ConfirmDialogState {
  open: boolean;
  title: string;
  description: string;
  options?: Array<{ label: string; onClick: () => void; variant?: 'default' | 'outline' | 'destructive' }>;
  onConfirm?: () => void;
}

export interface ConformityStatus {
  status: 'ok' | 'warning' | 'danger';
  message: string;
  maxHours?: number;
  dailyExtensionsUsed?: number;
  dailyExtensionsUsedBeforeToday?: number;
}

export interface BreakState {
  isActive: boolean;
  startTime: Date | null;
  type: 'none' | 'continuous' | 'split';
  /** Acumula o total de minutos de pausas válidas já concluídas no dia (não inclui pausa em curso) */
  completedBreakMinutes: number;
  /** Duração real das pausas concluídas, inclusive o tempo acima do crédito legal */
  completedPauseMinutes: number;
  /** Dívida atual da pausa: 45 quando ainda não houve creditação válida, 30 quando já foi credita 15m */
  remainingBreakDebtMinutes: number;
}

export interface WorkingTimeResult {
  hours: number;
  minutes: number;
  formatted: string;
  totalMinutes: number;
}

// Use ReturnType to match actual hook signatures
export type WorkDaysActions = ReturnType<typeof import('@/hooks/useWorkDays').useWorkDays>;
export type ReportsActions = ReturnType<typeof import('@/hooks/useReports').useReports>;

// ─── Facade Hook ─────────────────────────────────────────────────────────────

export function useDiarioActions(workDaysActions: WorkDaysActions, reportsActions: ReportsActions) {
  const router = useRouter();
  const {
    workDays, currentDay, isLoading,
    loadData: loadWorkDays,
    startDay, endDay, editDay, deleteDay, addEvent,
    pauseDriving, resumeDriving, saveBreakState, changeNonDrivingActivity,
  } = workDaysActions;

  const {
    loadWeeklyReport,
    loadReport,
    loadVehicleStats,
  } = reportsActions;

  // ─── Compose sub-hooks ──────────────────────────────────────────────────
  const { isOnline } = useConnectivity();
  const [clockNow, setClockNow] = useState<Date | null>(null);

  // useDialogManager MUST be called before useWorkingTime because
  // useWorkingTime depends on breakState from useDialogManager.
  const {
    toast, setToast, showToast,
    confirmDialog, setConfirmDialog,
    viewingDay, setViewingDay,
    editingDay, setEditingDay,
    editForm, setEditForm,
    deleteConfirm, setDeleteConfirm,
    showPauseDialog, setShowPauseDialog,
    isProcessingPause,
    setIsProcessingPause,
    breakState,
    setBreakState,
  } = useDialogManager();

  const {
    calculateWorkingTime,
    calculateContinuousTime,
    getBreakMinutes,
    getConformityStatus,
    formatTime,
    formatDate,
  } = useWorkingTime(currentDay, breakState, clockNow);

  const workingTime = calculateWorkingTime();
  const limitsNow = clockNow ?? new Date();
  const currentDateKey = currentDay?.date.slice(0, 10) ?? getLocalDateString(limitsNow);
  const weekReferenceDate = new Date(`${currentDateKey}T00:00:00.000Z`);
  const weekStartKey = getMonday(weekReferenceDate).toISOString().slice(0, 10);
  const nextWeekDate = new Date(`${weekStartKey}T00:00:00.000Z`);
  nextWeekDate.setUTCDate(nextWeekDate.getUTCDate() + 7);
  const nextWeekKey = nextWeekDate.toISOString().slice(0, 10);
  const currentWeekWorkDays = workDays.filter(day => {
    const dayKey = day.date.slice(0, 10);
    return dayKey >= weekStartKey && dayKey < nextWeekKey;
  });
  const dailyDrivingTotals = aggregateDrivingByDate([
    ...currentWeekWorkDays.map(day => ({
      date: day.date,
      hoursWorked: (day.id === currentDay?.id
        ? workingTime.totalMinutes
        : calcWorkDayDrivingMinutes(day, limitsNow) ?? 0) / 60,
    })),
    ...(currentDay && !currentWeekWorkDays.some(day => day.id === currentDay.id)
      ? [{ date: currentDay.date, hoursWorked: workingTime.totalMinutes / 60 }]
      : []),
  ]);
  const exceptionsUsedBeforeToday = countWeeklyDailyDrivingExceptions(
    dailyDrivingTotals.filter(day => day.date.toISOString().slice(0, 10) < currentDateKey),
    weekReferenceDate
  );
  const dailyExtensionsUsed = countWeeklyDailyDrivingExceptions(dailyDrivingTotals, weekReferenceDate);
  const currentDateDailyMinutes = Math.round(
    (dailyDrivingTotals.find(day => day.date.toISOString().slice(0, 10) === currentDateKey)?.hours
      ?? workingTime.totalMinutes / 60) * 60
  );
  const conformity = {
    ...getConformityStatus(exceptionsUsedBeforeToday, currentDateDailyMinutes),
    dailyExtensionsUsed,
    dailyExtensionsUsedBeforeToday: exceptionsUsedBeforeToday,
  };

  const {
    startForm, setStartForm,
    endForm, setEndForm,
    newEvent, setNewEvent,
    showEventInput, setShowEventInput,
    showEndForm, setShowEndForm,
    lastKmInfo, setLastKmInfo,
    checkingMatricula,
    checkLastKm,
  } = useDayForms();

  const {
    reportType, setReportType,
    customDateStart, setCustomDateStart,
    customDateEnd, setCustomDateEnd,
  } = useReportFilters();

  // ─── Estado local (not extracted — unique to facade) ─────────────────────
  const [activeView, setActiveView] = useState<ActiveView>('main');
  const [currentUser, setCurrentUser] = useState<{ username: string } | null>(null);
  const [isStarting, setIsStarting] = useState(false);
  const [isEnding, setIsEnding] = useState(false);
  const [, setIsSaving] = useState(false);
  const [isDeleting, setIsDeleting] = useState(false);
  const [showActivityDialog, setShowActivityDialog] = useState(false);
  const [activityType, setActivityType] = useState<WorkActivityType>('loading');
  const [isProcessingActivity, setIsProcessingActivity] = useState(false);

  const { country: gpsCountry, loading: loadingGps, error: gpsError, getLocation } = useGeolocation();

  // ═══════════════════════════════════════════════════════════════════════
  //  EFFECTS
  // ═══════════════════════════════════════════════════════════════════════

  // Atualizar o relógio fora do render para manter os cálculos puros.
  useEffect(() => {
    const frame = requestAnimationFrame(() => setClockNow(new Date()));
    const interval = setInterval(() => {
      setClockNow(new Date());
    }, 60000);
    return () => {
      cancelAnimationFrame(frame);
      clearInterval(interval);
    };
  }, []);

  // Carregar dados iniciais (auth + workdays + weekly report)
  const loadAppData = useCallback(async () => {
    try {
      const meRes = await fetch('/api/auth/me');
      if (meRes.ok) {
        const meData = await meRes.json();
        if (!meData.authenticated) {
          router.push('/login');
          return;
        }
        setCurrentUser(meData.user);
      }

      await Promise.all([
        loadWorkDays(),
        loadWeeklyReport(),
      ]);
    } catch (error) {
      logError('Erro ao carregar dados:', error);
      showToast('Erro de conexão. Verifique sua internet.', 'error');
    }
  }, [loadWorkDays, loadWeeklyReport, showToast, router]);

  useEffect(() => {
    const frame = requestAnimationFrame(() => { void loadAppData(); });
    return () => cancelAnimationFrame(frame);
  }, [loadAppData]);

  // Preencher país automaticamente quando GPS detectar
  useEffect(() => {
    if (gpsCountry && !startForm.startCountry && !loadingGps) {
      setStartForm(prev => ({ ...prev, startCountry: gpsCountry }));
      showToast(`País detectado: ${gpsCountry}`, 'success');
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [gpsCountry, loadingGps]);

  // Detectar país automaticamente quando abrir o formulário de fim de dia.
  useEffect(() => {
    if (showEndForm) {
      setEndForm(prev => ({ ...prev, endKm: '' }));
    }
    if (showEndForm && !endForm.endCountry) {
      getLocation();
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [showEndForm]);

  // Preencher país no fim do dia quando GPS detectar
  useEffect(() => {
    if (gpsCountry && showEndForm && !endForm.endCountry && !loadingGps) {
      setEndForm(prev => ({ ...prev, endCountry: gpsCountry }));
      showToast(`País de fim detectado: ${gpsCountry}`, 'success');
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [gpsCountry, loadingGps, showEndForm]);

  // Carregar estatísticas quando mudar para view de relatórios
  useEffect(() => {
    if (activeView === 'reports') {
      loadVehicleStats();
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [activeView]);

  // Recarregar relatório quando mudar o tipo
  useEffect(() => {
    if (activeView === 'reports') {
      if (reportType === 'weekly') {
        loadWeeklyReport();
      } else if (reportType === 'monthly') {
        loadReport('monthly');
      } else if (reportType === 'custom' && customDateStart && customDateEnd) {
        loadReport('custom', customDateStart, customDateEnd);
      }
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [reportType, activeView, customDateStart, customDateEnd]);

  // ═══════════════════════════════════════════════════════════════════════
  //  HANDLERS PRINCIPAIS
  // ═══════════════════════════════════════════════════════════════════════

  // Logout
  const handleLogout = async () => {
    try {
      await fetch('/api/auth/logout', { method: 'POST' });
      router.push('/login');
    } catch {
      showToast('Erro ao sair', 'error');
    }
  };

  // Iniciar novo dia
  const handleStartDay = async () => {
    const now = new Date();
    const today = getLocalDateString(now);

    const openDay = workDays.find(d => !d.endTime);

    if (openDay) {
      const openDayDate = openDay.date ? getLocalDateString(new Date(openDay.date)) : today;
      const isToday = openDayDate === today;

      setConfirmDialog({
        open: true,
        title: 'Jornada em Andamento',
        description: isToday
          ? `Já existe uma jornada aberta hoje iniciada às ${openDay.startTime}. O que deseja fazer?`
          : `Existe uma jornada aberta de ${formatDate(openDay.date)} iniciada às ${openDay.startTime}. Finalize-a antes de iniciar nova jornada.`,
        options: [
          {
            label: 'Continuar Jornada',
            onClick: () => { setConfirmDialog(null); },
            variant: 'default' as const,
          },
          {
            label: 'Cancelar',
            onClick: () => setConfirmDialog(null),
            variant: 'outline' as const,
          },
        ],
      });
      return;
    }

    const todayRecords = workDays.filter(d => d.date && d.date.split('T')[0] === today && d.endTime);

    if (todayRecords.length > 0) {
      const jornadas = todayRecords.map(r => `${r.startTime}-${r.endTime}`).join(', ');

      setConfirmDialog({
        open: true,
        title: 'Jornadas de Hoje',
        description: `Você já registrou ${todayRecords.length} jornada(s) hoje (${jornadas}). Deseja iniciar uma nova jornada?`,
        options: [
          {
            label: 'Nova Jornada',
            onClick: () => { setConfirmDialog(null); proceedWithStartDay(today, now); },
            variant: 'default' as const,
          },
          {
            label: 'Ver Histórico',
            onClick: () => { setConfirmDialog(null); setActiveView('history'); },
            variant: 'outline' as const,
          },
          {
            label: 'Cancelar',
            onClick: () => setConfirmDialog(null),
            variant: 'outline' as const,
          },
        ],
      });
      return;
    }

    await proceedWithStartDay(today, now);
  };

  const proceedWithStartDay = async (date: string, now: Date) => {
    // Validate required fields
    if (!startForm.startCountry) {
      showToast('País de Início é obrigatório', 'error');
      return;
    }
    if (!startForm.matricula) {
      showToast('Matrícula é obrigatória', 'error');
      return;
    }
    if (!startForm.truckCheck) {
      showToast('Check do Caminhão é obrigatório', 'error');
      return;
    }
    const initialKm = Number(startForm.startKm);
    if (!startForm.startKm || !Number.isSafeInteger(initialKm) || initialKm < 0) {
      showToast('KM inicial deve ser um inteiro não negativo', 'error');
      return;
    }

    setIsStarting(true);
    try {
      if (startForm.matricula) {
        const { valid } = validateMatricula(startForm.matricula);
        if (!valid) {
          showToast('Formato de matrícula inválido. Use AA-00-BB (ex: PT-12-AB)', 'error');
          return;
        }
      }

      await startDay({
        date,
        startTime: getLocalTimeString(now),
        startCountry: startForm.startCountry,
        startKm: String(initialKm),
        lastRest: startForm.lastRest,
        truckCheck: startForm.truckCheck,
        matricula: startForm.matricula.toUpperCase(),
        numDrivers: startForm.numDrivers,
        primaryDriverNumber: startForm.numDrivers === 2 ? startForm.primaryDriverNumber : 1,
        timezone: getClientTimezone(),
        utcOffset: getUtcOffsetString(now),
        startMode: startForm.startMode,
        initialActivityType: startForm.initialActivityType,
      });

      setStartForm({
        startCountry: '', startKm: '', lastRest: '', truckCheck: false, matricula: '',
        numDrivers: 1, primaryDriverNumber: 1, startMode: 'driving', initialActivityType: 'loading',
      });
      setLastKmInfo(null);
      // Reiniciar contador de pausas acumuladas ao iniciar novo dia
      setBreakState({
        isActive: false,
        startTime: null,
        type: 'none',
        completedBreakMinutes: 0,
        completedPauseMinutes: 0,
        remainingBreakDebtMinutes: 45,
      });
      showToast(
        startForm.startMode === 'service'
          ? 'Dia iniciado em atividade sem condução!'
          : 'Dia iniciado com sucesso!',
        'success'
      );
    } catch (error) {
      showToast(error instanceof Error ? error.message : 'Erro de conexão', 'error');
    } finally {
      setIsStarting(false);
    }
  };

  // Finalizar dia
  const handleEndDay = async () => {
    if (!currentDay) return;
    if (currentDay.activeWorkActivity) {
      showToast('Finalize a atividade sem condução antes de encerrar a jornada', 'warning');
      return;
    }

    // Validate required fields
    if (!endForm.endCountry) {
      showToast('País de Fim é obrigatório', 'error');
      return;
    }
    const endKm = Number(endForm.endKm);
    if (!endForm.endKm || !Number.isSafeInteger(endKm) || endKm < 0) {
      showToast('KM final deve ser um inteiro não negativo', 'error');
      return;
    }

    if (currentDay.startKm != null && endKm < currentDay.startKm) {
      showToast('KM final não pode ser menor que o KM inicial da jornada', 'error');
      return;
    }

    const now = new Date();
    const endTime = getLocalTimeString(now);
    const totalDrivingMinutes = calcDrivingMinutes(
      (currentDay.drivingSessions || []).filter(session => (session.driverNumber ?? 1) === (currentDay.primaryDriverNumber ?? 1)),
      currentDay.startTime,
      currentDay.endTime,
      {
        currentTime: endTime,
        breakMinutes: getBreakMinutes(),
        activities: currentDay.workActivities,
        utcOffset: currentDay.utcOffset,
      }
    ) ?? 0;
    const previousSameDateMinutes = Math.max(0, currentDateDailyMinutes - workingTime.totalMinutes);
    const dailyDrivingMinutesAtClose = previousSameDateMinutes + totalDrivingMinutes;
    if (dailyDrivingMinutesAtClose > 9 * 60) {
      const description = dailyDrivingMinutesAtClose > 10 * 60
        ? `Você conduziu ${minutesToFormatted(dailyDrivingMinutesAtClose)}, acima do limite absoluto de 10h diárias.`
        : exceptionsUsedBeforeToday >= 2
          ? `Você conduziu ${minutesToFormatted(dailyDrivingMinutesAtClose)} e já usou as duas extensões semanais. O limite diário de 9h foi ultrapassado.`
          : `Você conduziu ${minutesToFormatted(dailyDrivingMinutesAtClose)}. Esta será a extensão ${exceptionsUsedBeforeToday + 1}/2 da semana, dentro do máximo de 10h.`;
      setConfirmDialog({
        open: true,
        title: dailyDrivingMinutesAtClose > 10 * 60 || exceptionsUsedBeforeToday >= 2
          ? 'Atenção: limite diário excedido'
          : 'Extensão diária de condução',
        description: `${description} Deseja finalizar mesmo assim?`,
        onConfirm: () => {
          setConfirmDialog(null);
          proceedWithEndDay();
        },
      });
      return;
    }

    await proceedWithEndDay();
  };

  const proceedWithEndDay = async () => {
    if (!currentDay) return;

    setIsEnding(true);
    try {
      const now = new Date();
      await endDay(currentDay.id, {
        endTime: getLocalTimeString(now),
        endCountry: endForm.endCountry,
        endKm: String(Number(endForm.endKm)),
        amplitude: '',
        observations: endForm.observations,
        breakStart: null,
        breakType: null,
        breakMinutes: breakState.completedBreakMinutes,
      });

      const completedPauseMinutes = getBreakMinutes();
      setBreakState({
        isActive: false,
        startTime: null,
        type: 'none',
        completedBreakMinutes: breakState.completedBreakMinutes,
        completedPauseMinutes,
        remainingBreakDebtMinutes: getRemainingBreakDebt(breakState.completedBreakMinutes),
      });
      setShowEndForm(false);
      setEndForm({ endCountry: '', endKm: '', observations: '' });
      showToast('Dia finalizado com sucesso!', 'success');
      loadWeeklyReport();
    } catch (error) {
      showToast(error instanceof Error ? error.message : 'Erro de conexão', 'error');
    } finally {
      setIsEnding(false);
    }
  };

  // Adicionar evento
  const handleAddEvent = async () => {
    if (!currentDay || !newEvent.description) {
      showToast('Por favor, descreva o evento', 'warning');
      return;
    }

    try {
      await addEvent(
        currentDay.id,
        newEvent.time || getLocalTimeString(),
        newEvent.description,
      );
      setNewEvent({ time: '', description: '' });
      setShowEventInput(false);
      showToast('Evento adicionado!', 'success');
    } catch (error) {
      showToast(error instanceof Error ? error.message : 'Erro de conexão', 'error');
    }
  };

  // ═══════════════════════════════════════════════════════════════════════
  //  PAUSAR / RETOMAR CONDUÇÃO
  // ═══════════════════════════════════════════════════════════════════════

  const handleOpenPauseDialog = () => {
    if (!currentDay) return;
    setShowPauseDialog(true);
  };

  const handlePauseDriving = async () => {
    if (!currentDay) return;

    setIsProcessingPause(true);
    try {
      await pauseDriving(currentDay.id);
      setShowPauseDialog(false);
      showToast('Condução pausada - outro motorista pode assumer', 'success');
    } catch (error) {
      showToast(error instanceof Error ? error.message : 'Erro de conexão', 'error');
    } finally {
      setIsProcessingPause(false);
    }
  };

  const handleResumeDriving = () => {
    if (!currentDay) return;
    setShowPauseDialog(true);
  };

  const handleConfirmResume = async () => {
    if (!currentDay) return;

    setIsProcessingPause(true);
    try {
      await resumeDriving(currentDay.id);
      setShowPauseDialog(false);
      showToast('Condução retomada!', 'success');
    } catch (error) {
      showToast(error instanceof Error ? error.message : 'Erro de conexão', 'error');
    } finally {
      setIsProcessingPause(false);
    }
  };

  const handleOpenNonDrivingActivity = () => {
    if (!currentDay) return;
    setShowActivityDialog(true);
  };

  const handleConfirmNonDrivingActivity = async () => {
    if (!currentDay) return;

    const isFinishingActivity = !!currentDay.activeWorkActivity;
    setIsProcessingActivity(true);
    try {
      await changeNonDrivingActivity(
        currentDay.id,
        isFinishingActivity ? 'finish' : 'start',
        isFinishingActivity ? undefined : activityType,
      );
      setShowActivityDialog(false);
      showToast(
        isFinishingActivity
          ? 'Atividade encerrada. Condução retomada.'
          : 'Condução pausada para atividade. A amplitude continua contando.',
        'success'
      );
    } catch (error) {
      showToast(error instanceof Error ? error.message : 'Erro ao atualizar atividade', 'error');
    } finally {
      setIsProcessingActivity(false);
    }
  };

  // ═══════════════════════════════════════════════════════════════════════
  //  BREAK (1 DRIVER - CLIENT-SIDE ONLY)
  // ═══════════════════════════════════════════════════════════════════════

  // Opens the break type selection screen
  // (#1) Restaurar pausa em curso vinda do banco ao carregar/atualizar o dia
  useEffect(() => {
    if (!currentDay) return;
    if (currentDay.endTime) return;
    const dbActive = !!currentDay.breakStart && !!currentDay.breakType;
    if (dbActive) {
      setBreakState(prev => {
        if (prev.isActive && prev.startTime) return prev;
        const completedBreakMinutes = currentDay.breakMinutes ?? 0;
        const completedPauseMinutes = getCompletedBreakDurationMinutes(currentDay.breakPeriods, completedBreakMinutes);
        return {
          isActive: true,
          startTime: new Date(currentDay.breakStart as string),
          type: currentDay.breakType as 'continuous' | 'split',
          completedBreakMinutes,
          completedPauseMinutes,
          remainingBreakDebtMinutes: getRemainingBreakDebt(completedBreakMinutes),
        };
      });
    } else {
      const completedBreakMinutes = currentDay.breakMinutes ?? 0;
      const completedPauseMinutes = getCompletedBreakDurationMinutes(currentDay.breakPeriods, completedBreakMinutes);
      setBreakState({
        isActive: false,
        startTime: null,
        type: 'none',
        completedBreakMinutes,
        completedPauseMinutes,
        remainingBreakDebtMinutes: getRemainingBreakDebt(completedBreakMinutes),
      });
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [currentDay?.id, currentDay?.breakStart, currentDay?.breakType]);
  const handleOpenBreak = useCallback(() => {
    if (breakState.isActive && breakState.startTime) {
      showToast('Já existe uma pausa em curso. Use RETOMAR para finalizar.', 'warning');
      return;
    }

    const startedAt = new Date();
    const type = 'continuous';
    setBreakState({
      ...breakState,
      isActive: true,
      startTime: startedAt,
      type,
      remainingBreakDebtMinutes: getRemainingBreakDebt(breakState.completedBreakMinutes),
    });

    if (currentDay) {
      void saveBreakState(currentDay.id, {
        breakStart: startedAt.toISOString(),
        breakType: type,
        breakMinutes: breakState.completedBreakMinutes,
      }).catch(() => showToast('Não foi possível salvar o início da pausa.', 'error'));
    }
  }, [breakState, currentDay, saveBreakState, setBreakState, showToast]);

  // Confirms break type and starts the timer
  const handleStartBreak = useCallback(async (type: 'continuous' | 'split') => {
    const startedAt = new Date();
    setBreakState(prev => ({
      ...prev,
      isActive: true,
      startTime: startedAt,
      type,
      remainingBreakDebtMinutes: getRemainingBreakDebt(prev.completedBreakMinutes),
    }));
    try {
      if (currentDay) {
        await saveBreakState(currentDay.id, {
          breakStart: startedAt.toISOString(),
          breakType: type,
          breakMinutes: breakState.completedBreakMinutes,
        });
      }
      showToast('Pausa iniciada!', 'success');
    } catch {
      showToast('Não foi possível salvar a pausa. Verifique a conexão.', 'error');
    }
  }, [breakState.completedBreakMinutes, currentDay, saveBreakState, setBreakState, showToast]);

  const handleEndBreak = useCallback(() => {
    const endedAt = new Date();
    const breakDuration = breakState.startTime
      ? Math.floor((endedAt.getTime() - breakState.startTime.getTime()) / 60000)
      : 0;
    const elapsedBreakMinutes = Math.max(breakDuration, 0);
    const credit = resolveBreakCredit(
      elapsedBreakMinutes,
      breakState.remainingBreakDebtMinutes || getRemainingBreakDebt(breakState.completedBreakMinutes)
    );
    const nextCompletedBreakMinutes = breakState.completedBreakMinutes + credit.creditedMinutes;
    const nextCompletedPauseMinutes = breakState.completedPauseMinutes + elapsedBreakMinutes;

    let drivingMinutesAtLastBreak: number | undefined;
    if (credit.resetContinuous && currentDay) {
      const sessions = (currentDay.drivingSessions || []).filter(
        session => (session.driverNumber ?? 1) === (currentDay.primaryDriverNumber ?? 1)
      );
      const totalDriving = calcDrivingMinutes(sessions, currentDay.startTime, currentDay.endTime, {
        currentTime: getLocalTimeString(),
        breakMinutes: nextCompletedPauseMinutes,
        activities: currentDay.workActivities,
        utcOffset: currentDay.utcOffset,
      });
      if (totalDriving !== null) drivingMinutesAtLastBreak = totalDriving;
    }

    setBreakState({
      isActive: false,
      startTime: null,
      type: 'none',
      completedBreakMinutes: nextCompletedBreakMinutes,
      completedPauseMinutes: nextCompletedPauseMinutes,
      remainingBreakDebtMinutes: credit.remainingDebtMinutes,
    });

    void (async () => {
      try {
        if (currentDay) {
          await saveBreakState(currentDay.id, {
            breakStart: null,
            breakType: null,
            breakMinutes: nextCompletedBreakMinutes,
            breakEndedAt: endedAt.toISOString(),
            ...(drivingMinutesAtLastBreak !== undefined ? { drivingMinutesAtLastBreak } : {}),
          });
        }
        if (credit.creditedMinutes > 0) {
          showToast(
            credit.resetContinuous
              ? 'Pausa válida concluída! Condução contínua reiniciada.'
              : 'Pausa validada: apenas o tempo preenchido foi contabilizado.',
            'success'
          );
        } else {
          showToast('Tempo insuficiente para validar pausa. Continue a condução e tente novamente.', 'warning');
        }
      } catch {
        showToast('Não foi possível salvar o fim da pausa. Verifique a conexão.', 'error');
      }
    })();
  }, [breakState, currentDay, saveBreakState, setBreakState, showToast]);

  // ═══════════════════════════════════════════════════════════════════════
  //  GERENCIAMENTO (VIEW / EDIT / DELETE)
  // ═══════════════════════════════════════════════════════════════════════

  const handleViewDay = (day: WorkDay) => {
    setViewingDay(day);
  };

  const handleEditClick = (day: WorkDay) => {
    setEditingDay(day);
    setEditForm({
      date: day.date ? getLocalDateString(new Date(day.date)) : getLocalDateString(),
      startTime: day.startTime || '',
      endTime: day.endTime || '',
      startCountry: day.startCountry || '',
      endCountry: day.endCountry || '',
      startKm: day.startKm?.toString() || '',
      endKm: day.endKm?.toString() || '',
      observations: day.observations || '',
      matricula: day.matricula || '',
    });
  };

  const handleSaveEdit = async () => {
    if (!editingDay) return;

    setIsSaving(true);
    try {
      await editDay(editingDay.id, {
        date: editForm.date,
        startTime: editForm.startTime,
        endTime: editForm.endTime || null,
        startCountry: editForm.startCountry || null,
        endCountry: editForm.endCountry || null,
        startKm: editForm.startKm || null,
        endKm: editForm.endKm || null,
        observations: editForm.observations || null,
        matricula: editForm.matricula ? editForm.matricula.toUpperCase() : null,
      });
      setEditingDay(null);
      showToast('Registro atualizado!', 'success');
    } catch (error) {
      showToast(error instanceof Error ? error.message : 'Erro de conexão', 'error');
    } finally {
      setIsSaving(false);
    }
  };

  const handleDeleteDay = async () => {
    if (!deleteConfirm) return;

    setIsDeleting(true);
    try {
      await deleteDay(deleteConfirm.id);
      setDeleteConfirm(null);
      showToast('Registro excluído!', 'success');
    } catch (error) {
      showToast(error instanceof Error ? error.message : 'Erro de conexão', 'error');
    } finally {
      setIsDeleting(false);
    }
  };

  // ═══════════════════════════════════════════════════════════════════════
  //  GERAR PDF
  // ═══════════════════════════════════════════════════════════════════════

  const handleGeneratePdf = async (type: 'weekly' | 'monthly' | 'custom', matricula?: string) => {
    if (type === 'custom') {
      if (!customDateStart || !customDateEnd) {
        showToast('Selecione as datas de início e fim', 'warning');
        return;
      }
      if (new Date(customDateStart) > new Date(customDateEnd)) {
        showToast('Data de início deve ser menor que data de fim', 'warning');
        return;
      }
    }

    try {
      const params = new URLSearchParams({ type });
      if (matricula) params.append('matricula', matricula);
      if (type === 'custom') {
        params.append('startDate', customDateStart);
        params.append('endDate', customDateEnd);
      }
      // Enviar timezone do cliente para formatação correcta no servidor
      params.append('timezone', getClientTimezone());

      const endpoint = matricula
        ? `/api/reports/pdf/veiculo?${params.toString()}`
        : `/api/reports/pdf?${params.toString()}`;

      window.open(endpoint, '_blank');
      showToast('Relatório aberto em nova aba! Use Ctrl+P para salvar como PDF.', 'success');
    } catch {
      showToast('Erro ao gerar relatório', 'error');
    }
  };

  // ═══════════════════════════════════════════════════════════════════════
  //  COMPUTED
  // ═══════════════════════════════════════════════════════════════════════

  /** Condução contínua desde a última pausa legal (limite 4h30) */
  const continuousTime = calculateContinuousTime();
  const displayedBreakCreditMinutes = getCreditedBreakMinutes(
    breakState.completedBreakMinutes,
    breakState.isActive && breakState.startTime && clockNow
      ? Math.max(0, Math.floor((clockNow.getTime() - breakState.startTime.getTime()) / 60000))
      : 0,
    breakState.remainingBreakDebtMinutes
  );

  // ═══════════════════════════════════════════════════════════════════════
  //  RETURN (identical signature)
  // ═══════════════════════════════════════════════════════════════════════

  return {
    // --- View ---
    activeView,
    setActiveView,

    // --- Toast ---
    toast,
    setToast,

    // --- Confirm Dialog ---
    confirmDialog,
    setConfirmDialog,

    // --- Forms ---
    startForm,
    setStartForm,
    endForm,
    setEndForm,
    newEvent,
    setNewEvent,
    showEventInput,
    setShowEventInput,
    showEndForm,
    setShowEndForm,

    // --- Last KM info ---
    lastKmInfo,
    setLastKmInfo,
    checkingMatricula,

    // --- Reports ---
    reportType,
    setReportType,
    customDateStart,
    setCustomDateStart,
    customDateEnd,
    setCustomDateEnd,

    // --- Online/GPS ---
    isOnline,
    loadingGps,
    gpsError,
    getLocation,

    // --- User ---
    currentUser,

    // --- View/Edit/Delete ---
    viewingDay,
    setViewingDay,
    editingDay,
    setEditingDay,
    editForm,
    setEditForm,
    deleteConfirm,
    setDeleteConfirm,

    // --- Pause/Resume ---
    showPauseDialog,
    setShowPauseDialog,
    isProcessingPause,
    showActivityDialog,
    setShowActivityDialog,
    activityType,
    setActivityType,
    isProcessingActivity,

    // --- Break (1 driver) ---
    breakState,
    setBreakState,
    handleOpenBreak,
    handleStartBreak,
    handleEndBreak,
    /** Total de minutos de pausa (concluídas + em curso) — v4.1.5 */
    breakMinutes: displayedBreakCreditMinutes,

    // --- Computed ---
    conformity,
    workingTime,
    continuousTime,

    // --- Data from hooks ---
    workDays,
    currentDay,
    isLoading,

    // --- Handlers ---
    handleStartDay,
    handleEndDay,
    handleAddEvent,
    handlePauseDriving,
    handleResumeDriving,
    handleOpenPauseDialog,
    handleConfirmResume,
    handleOpenNonDrivingActivity,
    handleConfirmNonDrivingActivity,
    handleViewDay,
    handleEditClick,
    handleSaveEdit,
    handleDeleteDay,
    handleGeneratePdf,
    handleLogout,
    showToast,

    // --- Loading states ---
    isStarting,
    isEnding,
    isDeleting,

    // --- Helpers ---
    formatTime,
    formatDate,
    checkLastKm,
    loadWorkDays,

    // --- Reports hook passthrough ---
    ...reportsActions,
  };
}
