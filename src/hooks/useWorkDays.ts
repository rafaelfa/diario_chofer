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
import type { WorkDay } from '@/lib/types';
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
  timezone?: string;
  utcOffset?: string;
}

interface EndDayPayload {
  endTime: string;
  endCountry: string;
  endKm: string;
  amplitude: string;
  observations: string;
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
        timezone: payload.timezone || null,
        utcOffset: payload.utcOffset || null,
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
  };
}
