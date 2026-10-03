'use client';

/**
 * Hook useDayForms — manages start/end forms, event input, and matricula KM check.
 */

import { useState } from 'react';
import type { StartFormState, EndFormState, NewEventState, LastKmInfo } from './useDiarioActions';
import { logError } from '@/lib/logger';
import { validateMatricula } from '@/lib/validators';

export function useDayForms() {
  const [startForm, setStartForm] = useState<StartFormState>({
    startCountry: '',
    startKm: '',
    lastRest: '',
    truckCheck: false,
    matricula: '',
    numDrivers: 1,
    primaryDriverNumber: 1,
    startMode: 'driving',
    initialActivityType: 'loading',
  });

  const [endForm, setEndForm] = useState<EndFormState>({
    endCountry: '',
    endKm: '',
    observations: '',
  });

  const [newEvent, setNewEvent] = useState<NewEventState>({ time: '', description: '' });
  const [showEventInput, setShowEventInput] = useState(false);
  const [showEndForm, setShowEndForm] = useState(false);

  const [lastKmInfo, setLastKmInfo] = useState<LastKmInfo | null>(null);
  const [checkingMatricula, setCheckingMatricula] = useState(false);

  const checkLastKm = async (matricula: string) => {
    const { valid, normalized: clean } = validateMatricula(matricula);
    if (!valid) {
      setLastKmInfo(null);
      return;
    }

    setCheckingMatricula(true);
    setLastKmInfo(null);
    try {
      const res = await fetch(`/api/matricula/lastkm?matricula=${encodeURIComponent(clean)}`);
      if (res.ok) {
        const data = await res.json();
        setLastKmInfo(data);
        if (data.found && data.lastKm != null) {
          setStartForm(prev => ({ ...prev, startKm: String(data.lastKm) }));
        }
      } else {
        setLastKmInfo({ found: false, lastKm: null, message: 'Erro ao consultar último registro' });
      }
    } catch (error) {
      logError('Erro ao buscar último KM:', error);
      setLastKmInfo({ found: false, lastKm: null, message: 'Erro de conexão' });
    } finally {
      setCheckingMatricula(false);
    }
  };

  return {
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
    lastKmInfo,
    setLastKmInfo,
    checkingMatricula,
    checkLastKm,
  };
}
