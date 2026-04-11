'use client';

import { BarChart3 } from 'lucide-react';
import type { Report } from '@/lib/types';
import { formatDecimalHours } from '@/lib/time';

interface WeeklyBarsProps {
  weeklyData: Report | null;
  referenceDate?: string; // ISO date string for the week to display
}

export function WeeklyBars({ weeklyData, referenceDate }: WeeklyBarsProps) {
  const days = ['Seg', 'Ter', 'Qua', 'Qui', 'Sex', 'Sáb', 'Dom'];
  const today = referenceDate ? new Date(referenceDate + 'T12:00:00') : new Date();
  const todayDay = today.getDay();
  const adjustedToday = referenceDate ? -1 : (todayDay === 0 ? 6 : todayDay - 1); // -1 means no day is "today"

  // Calcular data de cada dia da semana (usando fuso local, NÃO UTC)
  const getDateStr = (index: number): string => {
    const d = new Date(today);
    const diff = todayDay === 0 ? 6 : todayDay - 1;
    d.setDate(d.getDate() - diff + index);
    const yyyy = d.getFullYear();
    const mm = String(d.getMonth() + 1).padStart(2, '0');
    const dd = String(d.getDate()).padStart(2, '0');
    return `${yyyy}-${mm}-${dd}`;
  };

  // Extrair horas reais por dia da semana a partir dos workDays do relatório
  const hoursPerDay = days.map((_, i) => {
    if (!weeklyData?.workDays) return 0;
    const dateStr = getDateStr(i);

    // Somar horas de todos os workDays que caem neste dia (limitar a 24h por dia)
    const dayHours = weeklyData.workDays
      .filter(d => {
        if (!d.date) return false;
        // Comparar data local (não UTC)
        const dStr = d.date.split('T')[0];
        return dStr === dateStr;
      })
      .reduce((sum, d) => sum + (d.hoursWorked ?? 0), 0);

    // Limitar a 15h (segurança contra bugs de cálculo)
    return parseFloat(Math.min(dayHours, 15).toFixed(1));
  });

  // Calcular número do dia do mês para cada posição
  const dayNumbers = days.map((_, i) => {
    const d = new Date(today);
    const diff = todayDay === 0 ? 6 : todayDay - 1;
    d.setDate(d.getDate() - diff + i);
    return d.getDate();
  });

  return (
    <div className="bg-white dark:bg-slate-800 rounded-lg p-3">
      <div className="text-xs text-muted-foreground mb-3 font-medium flex items-center gap-2">
        <BarChart3 className="h-3 w-3" />
        Horas por Dia da Semana
      </div>

      <div className="flex items-end justify-between gap-1.5">
        {days.map((day, i) => {
          const hours = hoursPerDay[i];
          const isToday = referenceDate ? false : i === adjustedToday;
          const isPast = i < adjustedToday;
          const isFuture = i > adjustedToday;

          // Cor baseada nas horas (dias passados com dados)
          const getBarColor = () => {
            if (hours >= 9) return 'bg-red-500';
            if (hours >= 8) return 'bg-amber-500';
            return 'bg-emerald-500';
          };

          // Altura da barra
          const height = hours > 0 ? Math.min((hours / 9) * 100, 100) : 0;

          return (
            <div key={day} className="flex-1 flex flex-col items-center gap-1.5">
              {/* Horas no topo (só se houver dados) */}
              {hours > 0 && (
                <span className={`text-[9px] font-semibold ${
                  hours >= 9 ? 'text-red-600' : hours >= 8 ? 'text-amber-600' : 'text-emerald-600'
                }`}>
                  {formatDecimalHours(hours)}
                </span>
              )}

              {/* Container da barra */}
              <div className="w-full h-20 bg-slate-100 dark:bg-slate-700 rounded-lg relative overflow-hidden">
                {isFuture ? (
                  /* DIAS FUTUROS — vazio */
                  <div className="w-full h-full" />
                ) : isPast ? (
                  /* DIAS PASSADOS — barra estática + linha vermelha */
                  <>
                    {hours > 0 && (
                      <div
                        className={`absolute bottom-0 left-0 right-0 rounded-b-lg ${getBarColor()}`}
                        style={{ height: `${height}%` }}
                      />
                    )}
                    <div className="absolute bottom-0 left-0 right-0 h-0.5 bg-red-400" />
                  </>
                ) : (
                  /* DIA ATUAL — linha verde fina na base */
                  <div className="absolute bottom-0 left-0 right-0 h-0.5 bg-emerald-500" />
                )}

                {/* Linha de limite 9h (tracejada) — só nos dias passados com dados */}
                {!isFuture && hours > 0 && (
                  <div className="absolute top-0 left-0 right-0 border-t border-dashed border-red-300 dark:border-red-500/50" />
                )}
              </div>

              {/* Círculo com número do dia */}
              <div className={`w-7 h-7 rounded-full flex items-center justify-center text-[11px] font-bold transition-colors ${
                isToday
                  ? 'bg-emerald-500 text-white shadow-md shadow-emerald-500/30'
                  : isPast && hours > 0
                    ? `${hours >= 9 ? 'bg-red-100 text-red-700 dark:bg-red-900/40 dark:text-red-300' : hours >= 8 ? 'bg-amber-100 text-amber-700 dark:bg-amber-900/40 dark:text-amber-300' : 'bg-emerald-100 text-emerald-700 dark:bg-emerald-900/40 dark:text-emerald-300'}`
                    : isPast
                      ? 'bg-slate-200 text-slate-500 dark:bg-slate-700 dark:text-slate-400'
                      : 'bg-slate-100 text-slate-400 dark:bg-slate-700/50 dark:text-slate-500'
              }`}>
                {dayNumbers[i]}
              </div>

              {/* Label do dia */}
              <span className={`text-[9px] ${isToday ? 'font-bold text-emerald-600 dark:text-emerald-400' : 'text-muted-foreground'}`}>
                {day}
              </span>
            </div>
          );
        })}
      </div>
    </div>
  );
}
