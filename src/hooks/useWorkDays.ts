'use client';

/**
 * Hook useWorkDays — extrai toda a lógica de fetch/mutação de dias de trabalho
 * que antes estava embutida no page.tsx.
 *
 * Responsabilidades:
 *  - Carregar lista de workdays
 *  - Criar novo dia (startDay)
 *  - Finalizar dia (endDay)
 *  - Editar dia (editDay)
 *  - Apagar dia (deleteDay)
 *  - Adicionar evento (addEvent)
 *  - Pausar / retomar condução
 */

import { useState, useCallback } from 'react';
import type { WorkActivityType, WorkDay } from '@/lib/types';
import { getLocalTimeString, getUtcOffsetString } from '@/lib/timezone';

interface StartDayPayload {
  date: string;
  startTime: string;
  startCountry: string;
  startKm: string;
  lastRest: string;
  truckCheck: boolean;
  matricula: string;
  numDrivers: number;
  primaryDriverNumber: 1 | 2;
  timezone?: string;
  utcOffset?: string;
  /** 'driving' cria logo sessão de condução; 'service' abre a jornada em atividade sem condução */
  startMode?: 'driving' | 'service';
  initialActivityType?: WorkActivityType;
}

interface EndDayPayload {
  endTime: string;
  endCountry: string;
  endKm: string;
  amplitude: string;
  observations: string;
  breakStart?: string | null;
  breakType?: string | null;
  breakMinutes?: number;
}

interface EditDayPayload {
  date?: string;
  startTime?: string;
  endTime?: string | null;
  startCountry?: string | null;
  endCountry?: string | null;
  startKm?: string | null;
  endKm?: string | null;
  lastRest?: string | null;
  amplitude?: string | null;
  truckCheck?: boolean;
  observations?: string | null;
  matricula?: string | null;
}

export function useWorkDays() {
  const [workDays, setWorkDays] = useState<WorkDay[]>([]);
  const [currentDay, setCurrentDay] = useState<WorkDay | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  /** Carrega todos os dias e determina o dia em curso */
  const loadData = useCallback(async () => {
    try {
      setIsLoading(true);
      setError(null);

      const res = await fetch('/api/workdays');
      if (!res.ok) throw new Error('Erro ao carregar dados');

      const days: WorkDay[] = await res.json();
      setWorkDays(days);

      // Dia em curso = mais recente sem endTime
      const active = days.find(d => !d.endTime) ?? null;
      setCurrentDay(active);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Erro desconhecido');
    } finally {
      setIsLoading(false);
    }
  }, []);

  /** Inicia um novo dia de trabalho */
  const startDay = useCallback(async (payload: StartDayPayload): Promise<WorkDay> => {
    const res = await fetch('/api/workdays', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        date: payload.date,
        startTime: payload.startTime,
        startCountry: payload.startCountry || null,
        startKm: payload.startKm || null,
        lastRest: payload.lastRest || null,
        truckCheck: payload.truckCheck,
        matricula: payload.matricula || null,
        numDrivers: payload.numDrivers || 1,
        primaryDriverNumber: payload.primaryDriverNumber,
        timezone: payload.timezone || null,
        utcOffset: payload.utcOffset || null,
        startMode: payload.startMode === 'service' ? 'service' : 'driving',
        ...(payload.startMode === 'service' ? { initialActivityType: payload.initialActivityType ?? 'other' } : {}),
      }),
    });

    if (!res.ok) {
      const data = await res.json();
      throw new Error(data.error || 'Erro ao iniciar dia');
    }

    const newDay: WorkDay = await res.json();
    setCurrentDay(newDay);
    setWorkDays(prev => [newDay, ...prev]);
    return newDay;
  }, []);

  /** Finaliza o dia em curso */
  const endDay = useCallback(
    async (dayId: string, payload: EndDayPayload): Promise<WorkDay> => {
      const res = await fetch(`/api/workdays/${dayId}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      });

      if (!res.ok) {
        const data = await res.json();
        throw new Error(data.error || 'Erro ao finalizar dia');
      }

      const updated: WorkDay = await res.json();
      setCurrentDay(null);
      setWorkDays(prev => prev.map(d => (d.id === updated.id ? updated : d)));
      return updated;
    },
    []
  );

  /** Edita um dia existente */
  const editDay = useCallback(
    async (dayId: string, payload: EditDayPayload): Promise<WorkDay> => {
      const res = await fetch(`/api/workdays/${dayId}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      });

      if (!res.ok) {
        const data = await res.json();
        throw new Error(data.error || 'Erro ao editar dia');
      }

      const updated: WorkDay = await res.json();
      setWorkDays(prev => prev.map(d => (d.id === updated.id ? updated : d)));
      if (currentDay?.id === updated.id) setCurrentDay(updated);
      return updated;
    },
    [currentDay]
  );

  /** Apaga um dia */
  const deleteDay = useCallback(
    async (dayId: string): Promise<void> => {
      const res = await fetch(`/api/workdays/${dayId}`, { method: 'DELETE' });

      if (!res.ok) {
        const data = await res.json();
        throw new Error(data.error || 'Erro ao apagar dia');
      }

      setWorkDays(prev => prev.filter(d => d.id !== dayId));
      if (currentDay?.id === dayId) setCurrentDay(null);
    },
    [currentDay]
  );

  /** Persiste o estado da pausa no banco (fire-and-forget com retry único) */
  const saveBreakState = useCallback(
    async (
      dayId: string,
      payload: {
        breakStart: string | null;
        breakType: string | null;
        breakMinutes: number;
        /** Base do contador 4h30 — enviada só quando a pausa legal foi cumprida */
        drivingMinutesAtLastBreak?: number;
      }
    ): Promise<void> => {
      const send = () => fetch(`/api/workdays/${dayId}`, {
          method: 'PUT',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(payload),
        });

      let response: Response;
      try {
        response = await send();
        if (!response.ok) response = await send();
      } catch {
        response = await send();
      }

      if (!response.ok) throw new Error('Não foi possível salvar a pausa');

      const updated: WorkDay = await response.json();
      setWorkDays(prev => prev.map(day => day.id === dayId ? updated : day));
      setCurrentDay(prev => prev?.id === dayId ? updated : prev);
    },
    []
  );

  const changeNonDrivingActivity = useCallback(
    async (dayId: string, action: 'start' | 'finish', currentKm: string, type?: WorkActivityType): Promise<WorkDay> => {
      const now = new Date();
      const res = await fetch(`/api/workdays/${dayId}/activities`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          action,
          ...(type ? { type } : {}),
          currentKm,
          currentAt: now.toISOString(),
          utcOffset: getUtcOffsetString(now),
        }),
      });

      if (!res.ok) {
        const data = await res.json();
        throw new Error(data.error || 'Erro ao atualizar atividade');
      }

      const updated: WorkDay = await res.json();
      setCurrentDay(updated);
      setWorkDays(prev => prev.map(day => day.id === updated.id ? updated : day));
      return updated;
    },
    []
  );

  /** Adiciona um evento ao dia em curso */
  const addEvent = useCallback(
    async (workDayId: string, time: string, description: string): Promise<void> => {
      const res = await fetch('/api/events', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ workDayId, time, description }),
      });

      if (!res.ok) {
        const data = await res.json();
        throw new Error(data.error || 'Erro ao adicionar evento');
      }

      // Recarregar para reflectir o novo evento
      await loadData();
    },
    [loadData]
  );

  /** Pausa a condução — envia currentTime do cliente para evitar bugs de fuso */
  const pauseDriving = useCallback(
    async (workDayId: string, currentKm?: string): Promise<WorkDay> => {
      const res = await fetch('/api/driving-sessions', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          workDayId,
          action: 'pause',
          currentKm: currentKm || null,
          currentTime: getLocalTimeString(),
          utcOffset: getUtcOffsetString(),
        }),
      });

      if (!res.ok) {
        const data = await res.json();
        throw new Error(data.error || 'Erro ao pausar condução');
      }

      const updated: WorkDay = await res.json();
      setCurrentDay(updated);
      setWorkDays(prev => prev.map(d => (d.id === updated.id ? updated : d)));
      return updated;
    },
    []
  );

  /** Retoma a condução — envia currentTime do cliente para evitar bugs de fuso */
  const resumeDriving = useCallback(
    async (workDayId: string, currentKm?: string): Promise<WorkDay> => {
      const res = await fetch('/api/driving-sessions', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          workDayId,
          action: 'resume',
          currentKm: currentKm || null,
          currentTime: getLocalTimeString(),
          utcOffset: getUtcOffsetString(),
        }),
      });

      if (!res.ok) {
        const data = await res.json();
        throw new Error(data.error || 'Erro ao retomar condução');
      }

      const updated: WorkDay = await res.json();
      setCurrentDay(updated);
      setWorkDays(prev => prev.map(d => (d.id === updated.id ? updated : d)));
      return updated;
    },
    []
  );

  return {
    workDays,
    currentDay,
    isLoading,
    error,
    loadData,
    startDay,
    endDay,
    editDay,
    deleteDay,
    addEvent,
    pauseDriving,
    resumeDriving,
    saveBreakState,
    changeNonDrivingActivity,
  };
}
