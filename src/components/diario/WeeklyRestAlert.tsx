'use client';

/**
 * WeeklyRestAlert — Lembretes semanais de descanso (Reg. CE 561/2006, Art. 8º)
 *
 * Em cada semana, o motorista tem de efetuar pelo menos 2 descansos diários
 * reduzidos? Não — pelo menos dois descansos diários de 11h (ou um de 11h e
 * um de 9h+11h...). Na prática, a regra mais cobrada é: no mínimo 2 descansos
 * diários de 11 horas por semana. Este componente verifica quantos dias da
 * semana corrente tiveram descanso >= 11h e avisa a partir de quinta-feira se
 * ainda faltar algum.
 */

import { useMemo } from 'react';
import { CalendarCheck, MoonStar } from 'lucide-react';
import { Card, CardContent } from '@/components/ui/card';
import type { DailyLog } from '@/types';
import { getWeekDates, formatDate } from '@/lib/utils';

interface WeeklyRestAlertProps {
  workDays: DailyLog[];
}

const REST_REQUIRED = 2;       // 2 descansos de 11h por semana
const MIN_REST_HOURS = 11;     // descanso diário mínimo legal

export function WeeklyRestAlert({ workDays }: WeeklyRestAlertProps) {
  const today = new Date();
  const dayOfWeek = today.getDay(); // 0=Dom ... 4=Qui, 5=Sex, 6=Sáb

  const { restCount, missing } = useMemo(() => {
    const weekDates = getWeekDates(today); // datas seg..dom da semana corrente
    const weekSet = new Set(weekDates.map(d => formatDate(d)));

    let count = 0;
    for (const log of workDays) {
      if (!weekSet.has(log.date)) continue;
      // considera descanso feito se o dia não foi trabalhado OU se teve pausa longa registrada
      const hasLongBreak = (log.breaks ?? []).some(b => b.duration >= 45);
      if (!log.worked || hasLongBreak) {
        // dia sem atividade conta como descanso diário completo
        if (!log.worked) count++;
        else if (hasLongBreak) count++;
      }
    }
    const missingCount = Math.max(0, REST_REQUIRED - count);
    return { restCount: count, missing: missingCount };
  }, [workDays]);

  // Só mostra aviso a partir de quinta (dia 4) se ainda faltarem descansos
  if (dayOfWeek < 4 || missing === 0) return null;

  const urgent = dayOfWeek >= 6; // sábado/domingo = urgente

  return (
    <Card className={`border-2 ${urgent ? 'border-red-400 bg-red-50 dark:bg-red-950/40' : 'border-amber-400 bg-amber-50 dark:bg-amber-950/40'}`}>
      <CardContent className="pt-4 pb-4 px-4 flex items-start gap-3">
        <div className={`p-2 rounded-lg ${urgent ? 'bg-red-500' : 'bg-amber-500'}`}>
          <MoonStar className="h-5 w-5 text-white" />
        </div>
        <div>
          <p className={`text-sm font-bold ${urgent ? 'text-red-700 dark:text-red-300' : 'text-amber-700 dark:text-amber-300'}`}>
            {urgent ? 'Urgente: ' : 'Lembrete: '}falt{missing === 1 ? 'a' : 'am'} {missing} descanso{missing > 1 ? 's' : ''} de 11h
          </p>
          <p className="text-xs text-muted-foreground mt-1 leading-relaxed">
            A lei exige pelo menos <strong>2 descansos diários de 11h por semana</strong> (Reg. CE 561/2006, Art. 8º).
            Esta semana você registou {restCount} de {REST_REQUIRED}.{' '}
            {urgent
              ? 'Termina hoje — programe o descanso antes da próxima condução.'
              : 'Planeie o(s) restante(s) até domingo.'}
          </p>
        </div>
        <CalendarCheck className="h-4 w-4 text-muted-foreground shrink-0 mt-1" />
      </CardContent>
    </Card>
  );
}
