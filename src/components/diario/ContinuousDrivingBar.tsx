'use client';

import { Coffee, AlertTriangle, CheckCircle2 } from 'lucide-react';
import { MAX_CONTINUOUS_DRIVING_MIN, LEGAL_BREAK_MINUTES } from '@/lib/regulation561';
import { minutesToFormatted } from '@/lib/time';

interface ContinuousDrivingBarProps {
  /** Minutos de condução contínua desde a última pausa legal concluída */
  minutes: number;
  /** Limite de condução contínua (default 4h30 = 270min) */
  maxMinutes?: number;
}

/**
 * Barra de condução contínua — Reg. CE 561/2006, Art. 5º.
 * Verde < 4h · Amarelo 4h–4h30 · Vermelho ≥ 4h30 (pausa obrigatória de 45min).
 *
 * Atividades sem condução (carregamento, abastecimento) não somam aqui e também
 * não reiniciam o contador — apenas a pausa legal o faz.
 */
export function ContinuousDrivingBar({ minutes, maxMinutes = MAX_CONTINUOUS_DRIVING_MIN }: ContinuousDrivingBarProps) {
  const percentage = Math.min((minutes / maxMinutes) * 100, 100);
  const remaining = Math.max(0, maxMinutes - minutes);
  const exceeded = minutes >= maxMinutes;
  const warning = !exceeded && minutes >= 240;

  const tone = exceeded
    ? {
        card: 'border-red-300 dark:border-red-700 bg-red-50 dark:bg-red-950/40 animate-pulse',
        bar: 'bg-red-500',
        text: 'text-red-600 dark:text-red-400',
      }
    : warning
    ? {
        card: 'border-amber-300 dark:border-amber-700 bg-amber-50 dark:bg-amber-950/40',
        bar: 'bg-amber-500',
        text: 'text-amber-600 dark:text-amber-400',
      }
    : {
        card: 'border-emerald-300 dark:border-emerald-700 bg-emerald-50 dark:bg-emerald-950/40',
        bar: 'bg-emerald-500',
        text: 'text-emerald-600 dark:text-emerald-400',
      };

  const status = exceeded
    ? `Pausa obrigatória de ${LEGAL_BREAK_MINUTES}min — 4h30 de condução contínua atingidas`
    : warning
    ? `Faltam ${minutesToFormatted(remaining)} para as 4h30 — prepare a pausa de ${LEGAL_BREAK_MINUTES}min`
    : `Faltam ${minutesToFormatted(remaining)} de condução para a pausa de ${LEGAL_BREAK_MINUTES}min`;

  return (
    <div className={`p-4 rounded-lg border-2 ${tone.card}`}>
      <div className="flex items-center justify-between mb-2 gap-2">
        <span className="flex items-center gap-2 text-sm font-semibold">
          <Coffee className="h-4 w-4 shrink-0" />
          Condução contínua · pausa obrigatória às 4h30
        </span>
        <span className={`font-mono font-bold ${tone.text}`}>{minutesToFormatted(minutes)} / 4:30</span>
      </div>

      <div className="h-3 bg-white/70 dark:bg-slate-700 rounded-full overflow-hidden">
        <div
          className={`h-full rounded-full transition-all duration-500 ${tone.bar}`}
          style={{ width: `${percentage}%` }}
        />
      </div>

      <p className={`mt-2 text-xs flex items-center gap-1 ${tone.text}`}>
        {exceeded ? <AlertTriangle className="h-3.5 w-3.5 shrink-0" /> : <CheckCircle2 className="h-3.5 w-3.5 shrink-0" />}
        {status}
      </p>
      <p className="mt-1 text-[11px] text-muted-foreground">
        Carregamento, abastecimento e outros serviços não contam como condução nem reiniciam este contador.
      </p>
    </div>
  );
}
