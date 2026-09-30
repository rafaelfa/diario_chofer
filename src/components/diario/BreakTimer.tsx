'use client';

import { useState, useEffect, useRef } from 'react';
import { Card } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Coffee, Play, CheckCircle2, AlertTriangle } from 'lucide-react';
import {
  CONTINUOUS_BREAK_MIN,
  SPLIT_FIRST_BLOCK_MIN,
  SPLIT_SECOND_BLOCK_MIN,
  blocksToMinutes,
} from '@/lib/breakBlocks';
import type { BreakBlock } from '@/lib/breakBlocks';

interface BreakTimerProps {
  /** ISO string ou Date do início da pausa em curso */
  breakStartTime: Date | null;
  /** Blocos de pausa já concluídos no dia (timestamps reais) */
  completedBlocks?: BreakBlock[];
  /** Fecha a pausa em curso criando um bloco com timestamps reais */
  onResume: () => void;
}

/** Formata segundos decorridos como MM:SS (ou HH:MM:SS acima de 1h) */
function formatElapsed(totalSeconds: number): string {
  const safe = Math.max(0, Math.floor(totalSeconds));
  const h = Math.floor(safe / 3600);
  const m = Math.floor((safe % 3600) / 60);
  const s = safe % 60;
  const mm = String(m).padStart(2, '0');
  const ss = String(s).padStart(2, '0');
  return h > 0 ? `${String(h).padStart(2, '0')}:${mm}:${ss}` : `${mm}:${ss}`;
}

export function BreakTimer({ breakStartTime, completedBlocks = [], onResume }: BreakTimerProps) {
  // Cronómetro crescente (tempo decorrido em segundos, tick de 1s)
  const [elapsedSeconds, setElapsedSeconds] = useState(0);
  const intervalRef = useRef<ReturnType<typeof setInterval> | null>(null);

  useEffect(() => {
    if (!breakStartTime) {
      setElapsedSeconds(0);
      return;
    }

    const tick = () => {
      const elapsed = Math.floor((Date.now() - breakStartTime.getTime()) / 1000);
      setElapsedSeconds(Math.max(0, elapsed));
    };

    tick();
    intervalRef.current = setInterval(tick, 1000);

    return () => {
      if (intervalRef.current) clearInterval(intervalRef.current);
    };
  }, [breakStartTime]);

  const reached45 = elapsedSeconds >= CONTINUOUS_BREAK_MIN * 60;

  // Marcos de referência calculados sobre os BLOCOS concluídos + pausa em curso
  const blockDurations = blocksToMinutes(completedBlocks);
  const totalCompletedMin = blockDurations.reduce((acc, m) => acc + m, 0);
  const currentMin = Math.floor(elapsedSeconds / 60);

  const has15 = totalCompletedMin + currentMin >= SPLIT_FIRST_BLOCK_MIN;
  const has30 = totalCompletedMin + currentMin >= SPLIT_SECOND_BLOCK_MIN;

  // Barra de progresso até aos 45 minutos
  const progressPct = Math.min((elapsedSeconds / (CONTINUOUS_BREAK_MIN * 60)) * 100, 100);

  const handleResume = () => {
    if (intervalRef.current) clearInterval(intervalRef.current);
    onResume();
  };

  return (
    <Card className={`border-2 shadow-lg ring-2 ${
      reached45
        ? 'border-emerald-300 dark:border-emerald-700 bg-gradient-to-br from-emerald-50 to-white dark:from-emerald-950 dark:to-slate-900 ring-emerald-400/50'
        : 'border-amber-300 dark:border-amber-700 bg-gradient-to-br from-amber-50 to-white dark:from-amber-950 dark:to-slate-900 ring-amber-400/50'
    }`}>
      <div className="p-4 sm:p-6 text-center space-y-3 sm:space-y-4">
        {/* Cabeçalho */}
        <div className="flex items-center justify-center gap-2">
          <div className={`w-10 h-10 sm:w-12 sm:h-12 rounded-full flex items-center justify-center ${
            reached45 ? 'bg-emerald-500' : 'bg-amber-500'
          }`}>
            {reached45 ? (
              <CheckCircle2 className="h-5 w-5 sm:h-6 sm:w-6 text-white" />
            ) : (
              <Coffee className="h-5 w-5 sm:h-6 sm:w-6 text-white" />
            )}
          </div>
          <span className={`font-bold text-base sm:text-lg ${
            reached45 ? 'text-emerald-700 dark:text-emerald-300' : 'text-amber-700 dark:text-amber-300'
          }`}>
            Pausa em curso
          </span>
        </div>

        {/* Relógio crescente (tempo decorrido) */}
        <div className="py-2 sm:py-3">
          <p className={`text-5xl sm:text-6xl font-bold font-mono ${
            reached45 ? 'text-emerald-600 dark:text-emerald-400' : 'text-amber-600 dark:text-amber-400'
          }`}>
            {formatElapsed(elapsedSeconds)}
          </p>
          <p className="text-[10px] sm:text-xs text-muted-foreground mt-1">tempo decorrido</p>
        </div>

        {/* Barra de progresso até aos 45 min */}
        <div>
          <div className="h-2 sm:h-3 bg-slate-200 dark:bg-slate-700 rounded-full overflow-hidden">
            <div
              className={`h-full rounded-full transition-all duration-1000 ${
                reached45 ? 'bg-emerald-500' : 'bg-amber-500'
              }`}
              style={{ width: `${progressPct}%` }}
            />
          </div>
          <p className="text-[10px] text-muted-foreground mt-1">
            {Math.round(progressPct)}% dos 45 min contínuos
          </p>
        </div>

        {/* Marcos de referência: 15 / 30 / 45 min */}
        <div className="flex items-center justify-center gap-2 flex-wrap">
          {[
            { label: '15 min', done: has15 },
            { label: '30 min', done: has30 },
            { label: '45 min', done: reached45 },
          ].map(milestone => (
            <span
              key={milestone.label}
              className={`text-[10px] sm:text-xs font-bold px-2 sm:px-3 py-1 rounded-full ${
                milestone.done
                  ? 'bg-emerald-100 text-emerald-700 dark:bg-emerald-900/40 dark:text-emerald-300'
                  : 'bg-slate-100 text-slate-500 dark:bg-slate-800 dark:text-slate-400'
              }`}
            >
              {milestone.label} {milestone.done ? '✓' : ''}
            </span>
          ))}
        </div>

        {/* Botão único: TERMINAR PAUSA (âmbar) → RETOMAR CONDUÇÃO (verde) após 45 min */}
        <Button
          onClick={handleResume}
          className={`w-full h-12 sm:h-14 text-base sm:text-lg font-bold shadow-lg ${
            reached45
              ? 'bg-emerald-600 hover:bg-emerald-700'
              : 'bg-amber-600 hover:bg-amber-700'
          }`}
        >
          <Play className="h-5 w-5 mr-2" />
          {reached45 ? 'RETOMAR CONDUÇÃO' : 'TERMINAR PAUSA'}
        </Button>

        {/* Mensagem explicativa — regra do Art. 7º Reg. 561/2006 */}
        {reached45 ? (
          <div className="p-2 sm:p-3 bg-emerald-50 dark:bg-emerald-900/20 rounded-lg border border-emerald-200 dark:border-emerald-800">
            <p className="text-xs sm:text-sm font-medium text-emerald-700 dark:text-emerald-300">
              Pausa contínua de 45 minutos cumprida! As 4h30 de condução foram renovadas.
            </p>
          </div>
        ) : (
          <div className="flex items-start justify-center gap-2 text-amber-700 dark:text-amber-400">
            <AlertTriangle className="h-4 w-4 mt-0.5 shrink-0" />
            <p className="text-[10px] sm:text-xs text-left">
              Para renovar as 4h30 de condução é preciso uma pausa de{' '}
              <strong>45 minutos contínuos</strong> ou o par <strong>15 + 30 minutos</strong>{' '}
              terminado dentro de <strong>75 minutos</strong> desde o início da 1.ª pausa
              (Art. 7.º, Reg. CE 561/2006). Ao terminar agora fica registado um bloco de{' '}
              {currentMin === 0 ? 'menos de 1 minuto' : `${currentMin} min`} — pode voltar a
              pausar mais tarde para completar o par.
            </p>
          </div>
        )}
      </div>
    </Card>
  );
}
