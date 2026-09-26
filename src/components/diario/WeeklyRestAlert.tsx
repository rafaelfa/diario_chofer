'use client';

/**
 * WeeklyRestAlert — Reg. CE 561/2006, Art. 8º, nº 6
 *
 * O motorista deve fazer pelo menos DOIS descansos semanais de 11h
 * (ou um reduzido ≥ 9h compensado) em cada semana (segunda 00:00 a
 * domingo 24:00).
 *
 * Este alerta aparece no início da atividade (tela "Iniciar Dia") e avisa:
 *   - Quarta-feira em diante: se ainda não há 2 descansos de 11h na semana
 *     ("faltam X para completar as 2 obrigatórias")
 *   - Sexta-feira em diante: aviso reforçado com tom vermelho
 *
 * Como o app só regista a HORA do último descanso (campo lastRest),
 * um dia é considerado "descanso de 11h" quando o intervalo desde o
 * fim da jornada anterior até ao início deste dia for ≥ 11 horas
 * (com passagem de meia-noite; > 24h conta como 24h).
 */

import { AlertTriangle, MoonStar } from 'lucide-react';
import { Card, CardContent } from '@/components/ui/card';
import type { WorkDay } from '@/lib/types';
import { parseTimeToMinutes } from '@/lib/time';

interface WeeklyRestAlertProps {
  workDays: WorkDay[];
}

/** Data local "YYYY-MM-DD" */
function toLocalDateStr(d: Date): string {
  const yyyy = d.getFullYear();
  const mm = String(d.getMonth() + 1).padStart(2, '0');
  const dd = String(d.getDate()).padStart(2, '0');
  return `${yyyy}-${mm}-${dd}`;
}

/** Segunda-feira (00:00 local) da semana da data informada */
function mondayOf(d: Date): Date {
  const m = new Date(d.getFullYear(), d.getMonth(), d.getDate());
  const dow = m.getDay(); // 0 = domingo
  m.setDate(m.getDate() - (dow === 0 ? 6 : dow - 1));
  return m;
}

/** Diferença em minutos entre dois instantes locais (date + "HH:MM"), limitada a ±24h */
function minutesBetween(dateA: string, timeA: string, dateB: string, timeB: string): number | null {
  const tA = parseTimeToMinutes(timeA);
  const tB = parseTimeToMinutes(timeB);
  if (tA === null || tB === null) return null;
  const msA = new Date(`${dateA}T${timeA}:00`).getTime();
  const msB = new Date(`${dateB}T${timeB}:00`).getTime();
  if (isNaN(msA) || isNaN(msB)) return null;
  let diff = Math.round((msB - msA) / 60000);
  if (diff < 0) diff += 24 * 60; // passou meia-noite
  if (diff > 24 * 60) diff = 24 * 60; // proteção contra dados irreais
  return diff;
}

export function getWeeklyRestInfo(workDays: WorkDay[]) {
  const now = new Date();
  const monday = mondayOf(now);
  const nextMonday = new Date(monday);
  nextMonday.setDate(nextMonday.getDate() + 7);

  // Dias da semana corrente (segunda → hoje), ordenados cronologicamente
  const weekDays = workDays
    .filter(d => {
      if (!d.date) return false;
      const dt = new Date(d.date);
      return dt >= monday && dt < nextMonday;
    })
    .sort((a, b) => new Date(a.date!).getTime() - new Date(b.date!).getTime());

  // Contar inícios de dia precedidos de descanso ≥ 11h
  let count11h = 0;
  const details: string[] = [];

  weekDays.forEach((day, i) => {
    const dayDate = toLocalDateStr(new Date(day.date!));
    let restMinutes: number | null = null;

    if (i === 0) {
      // Primeiro dia da semana: usa o "último descanso" declarado no próprio dia
      if (day.startTime && day.lastRest) {
        const prevDate = new Date(monday);
        prevDate.setDate(prevDate.getDate() - 1);
        restMinutes = minutesBetween(toLocalDateStr(prevDate), day.lastRest, dayDate, day.startTime);
      }
    } else {
      // Intervalo entre o fim da jornada anterior e o início desta
      const prev = weekDays[i - 1];
      if (prev?.endTime && day.startTime) {
        restMinutes = minutesBetween(toLocalDateStr(new Date(prev.date!)), prev.endTime, dayDate, day.startTime);
      }
    }

    if (restMinutes !== null && restMinutes >= 11 * 60) {
      count11h++;
      details.push(`${dayDate} (${Math.floor(restMinutes / 60)}h${String(restMinutes % 60).padStart(2, '0')}m)`);
    }
  });

  const missing = Math.max(0, 2 - count11h);

  // Dia da semana (1 = segunda ... 0 = domingo)
  const dow = now.getDay();
  const weekdayIndex = dow === 0 ? 6 : dow - 1; // 0 = segunda

  let level: 'ok' | 'warning' | 'urgent' = 'ok';
  if (missing > 0) {
    level = weekdayIndex >= 4 ? 'urgent' : weekdayIndex >= 2 ? 'warning' : 'ok';
  }

  return { count11h, missing, level, details };
}

export function WeeklyRestAlert({ workDays }: WeeklyRestAlertProps) {
  const info = getWeeklyRestInfo(workDays);

  if (info.missing === 0 || info.level === 'ok') return null;

  const urgent = info.level === 'urgent';

  return (
    <Card
      className={`border-2 ${
        urgent
          ? 'border-red-400 dark:border-red-600 bg-gradient-to-br from-red-50 to-red-100/50 dark:from-red-950/40 dark:to-red-900/20'
          : 'border-amber-300 dark:border-amber-700 bg-gradient-to-br from-amber-50 to-amber-100/50 dark:from-amber-950/40 dark:to-amber-900/20'
      }`}
    >
      <CardContent className="pt-4 pb-4 px-4">
        <div className="flex items-start gap-3">
          <div className={`p-2 rounded-lg shrink-0 ${urgent ? 'bg-red-500' : 'bg-amber-500'}`}>
            {urgent ? (
              <AlertTriangle className="h-5 w-5 text-white" />
            ) : (
              <MoonStar className="h-5 w-5 text-white" />
            )}
          </div>
          <div>
            <p className={`text-sm font-bold ${urgent ? 'text-red-700 dark:text-red-300' : 'text-amber-700 dark:text-amber-300'}`}>
              Descansos semanais de 11h: {info.count11h}/2
            </p>
            <p className="text-xs text-muted-foreground mt-1 leading-relaxed">
              {urgent
                ? `⚠️ Faltam ${info.missing} descanso(s) de 11h para completar esta semana. A lei exige pelo menos 2 por semana — planeie o descanso antes de iniciar a jornada.`
                : `Falta(m) ${info.missing} descanso(s) de 11h até domingo. A lei exige pelo menos 2 descansos semanais de 11h (Reg. CE 561/2006, Art. 8º, nº 6).`}
            </p>
            {info.details.length > 0 && (
              <p className="text-[10px] text-muted-foreground mt-1">
                Registados esta semana: {info.details.join(' · ')}
              </p>
            )}
          </div>
        </div>
      </CardContent>
    </Card>
  );
}
