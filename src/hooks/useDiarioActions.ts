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
import type { WorkDay, ActiveView } from '@/lib/types';
import { logError } from '@/lib/logger';
import {
  buildBreakBlock,
  calcDrivingMinutes,
  evaluateBreakBlocks,
  minutesToFormatted,
  normalizeBreakBlocks,
} from '@/lib/time';
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
}

/**
 * Persistência no Prisma (PostgreSQL):
 *   - WorkDay.breakBlocks (Json?) — array de blocos { start, end, minutes } com timestamps reais.
 *   - WorkDay.breakStart  (DateTime?) — início da pausa em curso (sobrevive a refresh).
 *   - WorkDay.breakMinutes (Int legado) — total bruto histórico; mantido por compatibilidade.
 */
export interface BreakBlock {
  /** Timestamp ISO do início do bloco de pausa */
  start: string;
  /** Timestamp ISO do fim do bloco ('' se ainda estiver em curso) */
  end: string;
  /** Duração real medida em minutos completos */
  minutes: number;
}

export interface BreakState {
  isActive: boolean;
  startTime: Date | null;
  /** @deprecated A regra atual usa um botão único — o tipo já não é escolhido pelo utilizador. */
  type: 'none' | 'continuous' | 'split';
  /** @deprecated Legado (fallback para dias antigos sem breakBlocks). */
  completedBreakMinutes: number;
  /** Histórico de blocos de pausa medidos (fonte primária da regra 45m / 15m+30m) */
  blocks: BreakBlock[];
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
    pauseDriving, resumeDriving, saveBreakState,
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
    pauseKm, setPauseKm,
    isProcessingPause,
    setIsProcessingPause,
    breakState,
    setBreakState,
  } = useDialogManager();

  const {
    calculateWorkingTime,
    getBreakMinutes,
    getConformityStatus,
    formatTime,
    formatDate,
  } = useWorkingTime(currentDay, breakState, clockNow);

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

  // Detectar país automaticamente quando abrir o formulário de fim de dia
  // E pré-preencher o KM final com o último KM registrado
  useEffect(() => {
    if (showEndForm && !endForm.endCountry) {
      getLocation();
    }
    if (showEndForm && currentDay) {
      const lastKm = currentDay.lastSessionKm ?? currentDay.startKm ?? 0;
      setEndForm(prev => ({ ...prev, endKm: lastKm ? lastKm.toString() : '' }));
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
        startKm: startForm.startKm ? String(parseInt(startForm.startKm)) : '',
        lastRest: startForm.lastRest,
        truckCheck: startForm.truckCheck,
        matricula: startForm.matricula.toUpperCase(),
        numDrivers: startForm.numDrivers,
        primaryDriverNumber: startForm.numDrivers === 2 ? startForm.primaryDriverNumber : 1,
        timezone: getClientTimezone(),
        utcOffset: getUtcOffsetString(now),
      });

      setStartForm({ startCountry: '', startKm: '', lastRest: '', truckCheck: false, matricula: '', numDrivers: 1, primaryDriverNumber: 1 });
      setLastKmInfo(null);
      // Reiniciar contador de pausas acumuladas ao iniciar novo dia
      setBreakState({ isActive: false, startTime: null, type: 'none', completedBreakMinutes: 0, blocks: [] });
      showToast('Dia iniciado com sucesso!', 'success');
    } catch (error) {
      showToast(error instanceof Error ? error.message : 'Erro de conexão', 'error');
    } finally {
      setIsStarting(false);
    }
  };

  // Finalizar dia
  const handleEndDay = async () => {
    if (!currentDay) return;

    // Validate required fields
    if (!endForm.endCountry) {
      showToast('País de Fim é obrigatório', 'error');
      return;
    }

    const previousKm = currentDay.lastSessionKm ?? currentDay.startKm;
    if (endForm.endKm && previousKm != null) {
      const endKm = Number(endForm.endKm);
      if (!Number.isSafeInteger(endKm) || endKm < previousKm) {
        showToast('KM final deve ser um inteiro e não pode ser menor que o último KM registrado', 'error');
        return;
      }
    }

    const now = new Date();
    const endTime = getLocalTimeString(now);
    const totalDrivingMinutes = calcDrivingMinutes(
      (currentDay.drivingSessions || []).filter(session => (session.driverNumber ?? 1) === (currentDay.primaryDriverNumber ?? 1)),
      currentDay.startTime,
      currentDay.endTime,
      { currentTime: endTime, breakMinutes: getBreakMinutes() }
    ) ?? 0;
    const hoursWorked = totalDrivingMinutes / 60;

    if (hoursWorked > 9) {
      setConfirmDialog({
        open: true,
        title: 'Atenção: Limite de horas excedido',
        description: `Você conduziu ${minutesToFormatted(totalDrivingMinutes)}, o que excede o limite de 9h do Reg. CE 561/2006. Deseja finalizar mesmo assim?`,
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
        endKm: endForm.endKm ? String(parseInt(endForm.endKm)) : '',
        amplitude: '',
        observations: endForm.observations,
        breakStart: null,
        breakType: null,
        breakMinutes: getBreakMinutes(),
        breakBlocks: breakState.blocks,
      });

      setBreakState({ isActive: false, startTime: null, type: 'none', completedBreakMinutes: getBreakMinutes(), blocks: breakState.blocks });
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
    const lastKm = currentDay.lastSessionKm ?? currentDay.startKm ?? 0;
    setPauseKm(lastKm ? lastKm.toString() : '');
    setShowPauseDialog(true);
  };

  const handlePauseDriving = async () => {
    if (!currentDay) return;

    const kmValue = pauseKm ? Number(pauseKm) : null;

    if (kmValue === null || !Number.isSafeInteger(kmValue) || kmValue < 0) {
      showToast('Por favor, informe o KM atual', 'warning');
      return;
    }

    setIsProcessingPause(true);
    try {
      await pauseDriving(currentDay.id, pauseKm);
      setShowPauseDialog(false);
      setPauseKm('');
      showToast('Condução pausada - outro motorista pode assumer', 'success');
    } catch (error) {
      showToast(error instanceof Error ? error.message : 'Erro de conexão', 'error');
    } finally {
      setIsProcessingPause(false);
    }
  };

  const handleResumeDriving = () => {
    if (!currentDay) return;
    const lastKm = currentDay.lastSessionKm ?? currentDay.startKm ?? 0;
    setPauseKm(lastKm ? lastKm.toString() : '');
    setShowPauseDialog(true);
  };

  const handleConfirmResume = async () => {
    if (!currentDay) return;

    const kmValue = pauseKm ? Number(pauseKm) : null;

    if (kmValue === null || !Number.isSafeInteger(kmValue) || kmValue < 0) {
      showToast('Por favor, informe o KM atual do veículo', 'warning');
      return;
    }

    setIsProcessingPause(true);
    try {
      await resumeDriving(currentDay.id, pauseKm);
      setShowPauseDialog(false);
      setPauseKm('');
      showToast('Condução retomada!', 'success');
    } catch (error) {
      showToast(error instanceof Error ? error.message : 'Erro de conexão', 'error');
    } finally {
      setIsProcessingPause(false);
    }
  };

  // ═══════════════════════════════════════════════════════════════════════
  //  BREAK (1 DRIVER — botão único, regra 45m ou 15m + 30m)
  // ═══════════════════════════════════════════════════════════════════════

  // (#1) Restaurar pausa em curso + histórico de blocos vindos do banco ao carregar/atualizar o dia
  useEffect(() => {
    if (!currentDay) return;
    if (currentDay.endTime) return;
    const blocks = normalizeBreakBlocks(currentDay.breakBlocks);
    const dbActive = !!currentDay.breakStart;
    setBreakState(prev => {
      if (prev.isActive && prev.startTime && dbActive && prev.startTime.getTime() === new Date(currentDay.breakStart as string).getTime()) {
        return { ...prev, blocks };
      }
      if (!dbActive && !prev.isActive && prev.blocks.length === blocks.length) return prev;
      return {
        isActive: dbActive,
        startTime: dbActive ? new Date(currentDay.breakStart as string) : null,
        type: 'none',
        completedBreakMinutes: currentDay.breakMinutes ?? 0,
        blocks,
      };
    });
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [currentDay?.id, currentDay?.breakStart, currentDay?.breakBlocks]);

  // Botão único "PAUSA": inicia um bloco de pausa com timestamp real de início
  const handleOpenBreak = useCallback(() => {
    if (!currentDay) return;
    if (breakState.isActive && breakState.startTime) {
      showToast('Já existe uma pausa em curso. Use RETOMAR para finalizar.', 'warning');
      return;
    }
    const startedAt = new Date();
    setBreakState(prev => ({
      ...prev,
      isActive: true,
      startTime: startedAt,
      type: 'none',
      blocks: [...prev.blocks, { start: startedAt.toISOString(), end: '', minutes: 0 }],
    }));
    void (async () => {
      try {
        await saveBreakState(currentDay.id, {
          breakStart: startedAt.toISOString(),
          breakType: null,
          breakMinutes: breakState.completedBreakMinutes,
          breakBlocks: [...breakState.blocks, { start: startedAt.toISOString(), end: '', minutes: 0 }],
        });
        showToast('Pausa iniciada — o tempo real será medido ao retomar.', 'success');
      } catch {
        showToast('Não foi possível salvar a pausa. Verifique a conexão.', 'error');
      }
    })();
  }, [breakState, currentDay, saveBreakState, setBreakState, showToast]);

  // Botão único "RETOMAR": fecha o bloco com a duração REAL medida e persiste os blocos
  const handleEndBreak = useCallback(() => {
    if (!currentDay) return;

    const endedAt = new Date();
    const openIndex = breakState.blocks.findIndex(block => !block.end);
    let blocks: BreakBlock[];
    if (openIndex >= 0) {
      blocks = breakState.blocks.map((block, index) => {
        if (index !== openIndex) return block;
        const start = new Date(block.start);
        const minutes = Number.isNaN(start.getTime())
          ? 0
          : Math.max(0, Math.floor((endedAt.getTime() - start.getTime()) / 60000));
        return { ...block, end: endedAt.toISOString(), minutes };
      });
    } else if (breakState.startTime) {
      blocks = [...breakState.blocks, buildBreakBlock(breakState.startTime, endedAt)];
    } else {
      blocks = breakState.blocks;
    }

    const status = evaluateBreakBlocks(blocks, null, endedAt);
    const legacyTotal = blocks.reduce((sum, block) => sum + block.minutes, 0);

    setBreakState({
      isActive: false,
      startTime: null,
      type: 'none',
      completedBreakMinutes: legacyTotal,
      blocks,
    });

    void (async () => {
      try {
        await saveBreakState(currentDay.id, {
          breakStart: null,
          breakType: null,
          breakMinutes: legacyTotal,
          breakBlocks: blocks,
        });
        if (status.isComplete) {
          showToast('Pausa obrigatória cumprida! Pode retomar a condução.', 'success');
        } else if (status.validMinutes > 0) {
          showToast(`Bloco válido registado (${status.validMinutes} min). ${status.label}.`, 'warning');
        } else {
          showToast('Pausa inferior a 15 minutos — não contabiliza para a pausa obrigatória.', 'warning');
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

  const conformity = getConformityStatus();
  const workingTime = calculateWorkingTime();

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
    pauseKm,
    setPauseKm,
    isProcessingPause,

    // --- Break (1 driver) — botão único, regra 45m / 15m+30m ---
    breakState,
    setBreakState,
    handleOpenBreak,
    handleEndBreak,
    /** Total de minutos de pausa VALIDOS segundo a regra 45m/15+30m (inclui bloco em curso) */
    breakMinutes: getBreakMinutes(),
    /** Estado avaliado da pausa (blocos válidos, o que falta, rótulo para a UI) */
    breakStatus: evaluateBreakBlocks(
      breakState.blocks,
      breakState.isActive ? breakState.startTime : null,
      clockNow ?? new Date()
    ),

    // --- Computed ---
    conformity,
    workingTime,

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
