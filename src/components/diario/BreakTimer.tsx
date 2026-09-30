'use client';

import { useState, useEffect, useRef, useCallback } from 'react';
import { Card } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Coffee, Play, CheckCircle2, Pause, AlertTriangle } from 'lucide-react';

export type BreakType = 'none' | 'part1' | 'part2';

interface BreakTimerProps {
  /** ISO string ou Date do início da pausa */
  breakStartTime: Date | null;
  breakType: BreakType;
  onBreakTypeSelect: (type: 'part1' | 'part2') => void;
  onResume: () => void;
  /** Minutos de pausas já concluídos no dia (para o total legal de 45 min) */
  completedBreakMinutes?: number;
}

// Reg. CE 561/2006, Art. 7º — nova lógica de pausa obrigatória:
// após 4h30 de condução, pausa mínima de 45 minutos.
// Pode ser dividida em duas partes: 15 min + 30 min (totalizando 45 min).
const PART1_SECONDS = 15 * 60; // 1ª parte: 15 minutos
const PART2_SECONDS = 30 * 60; // 2ª parte: 30 minutos
const TOTAL_REQUIRED_SECONDS = 45 * 60; // mínimo legal total: 45 minutos

export function BreakTimer({ breakStartTime, breakType, onBreakTypeSelect, onResume, completedBreakMinutes = 0 }: BreakTimerProps) {
  const [remaining, setRemaining] = useState(0);
  const intervalRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const resumedEarlyRef = useRef(false);

  const getTargetSeconds = useCallback((bt: BreakType) => {
    return bt === 'part2' ? PART2_SECONDS : PART1_SECONDS;
  }, []);

  // Cronômetro principal — conta os minutos da parte selecionada (15 ou 30)
  useEffect(() => {
    if (!breakStartTime) {
      return;
    }

    const tick = () => {
      if (resumedEarlyRef.current) return;

      const now = Date.now();
      const elapsed = Math.floor((now - breakStartTime.getTime()) / 1000);
      const target = getTargetSeconds(breakType);
      setRemaining(Math.max(0, target - elapsed));
    };

    tick();
    intervalRef.current = setInterval(tick, 1000);

    return () => {
      if (intervalRef.current) clearInterval(intervalRef.current);
    };
  }, [breakStartTime, breakType, getTargetSeconds]);

  // Formatar MM:SS
  const formatTime = (seconds: number): string => {
    const m = Math.floor(seconds / 60);
    const s = seconds % 60;
    return `${m.toString().padStart(2, '0')}:${s.toString().padStart(2, '0')}`;
  };

  const isComplete = remaining <= 0 && breakStartTime !== null;
  const partTotal = getTargetSeconds(breakType);
  const percentage = partTotal > 0 ? Math.min(((partTotal - remaining) / partTotal) * 100, 100) : 0;

  // Progresso do total legal de 45 min (partes concluídas + tempo desta parte)
  const secondsThisPart = partTotal - remaining;
  const totalLegalSeconds = Math.min(completedBreakMinutes * 60 + Math.max(secondsThisPart, 0), TOTAL_REQUIRED_SECONDS);
  const totalPercentage = Math.min((totalLegalSeconds / TOTAL_REQUIRED_SECONDS) * 100, 100);
  const isFullyComplete = totalLegalSeconds >= TOTAL_REQUIRED_SECONDS;

  // Cores baseadas no tempo restante
  const getColor = () => {
    if (isComplete) return { text: 'text-emerald-600 dark:text-emerald-400', bg: 'bg-emerald-500', border: 'border-emerald-300 dark:border-emerald-700', barBg: 'bg-emerald-500' };
    if (remaining <= 300) return { text: 'text-red-600 dark:text-red-400', bg: 'bg-red-500', border: 'border-red-300 dark:border-red-700', barBg: 'bg-red-500' }; // ≤ 5min
    if (remaining <= 900) return { text: 'text-amber-600 dark:text-amber-400', bg: 'bg-amber-500', border: 'border-amber-300 dark:border-amber-700', barBg: 'bg-amber-500' }; // ≤ 15min
    return { text: 'text-blue-600 dark:text-blue-400', bg: 'bg-blue-500', border: 'border-blue-300 dark:border-blue-700', barBg: 'bg-blue-500' };
  };

  const colors = getColor();

  const handleResume = () => {
    resumedEarlyRef.current = true;
    if (intervalRef.current) clearInterval(intervalRef.current);
    onResume();
  };

  // Se ainda não escolheu o tipo de pausa, mostrar seleção
  if (breakType === 'none') {
    return (
      <Card className="border-2 border-blue-300 dark:border-blue-700 bg-gradient-to-br from-blue-50 to-white dark:from-blue-950 dark:to-slate-900 shadow-lg ring-2 ring-blue-400/50">
        <div className="p-4 sm:p-6 text-center space-y-3 sm:space-y-4">
          <div className="flex items-center justify-center gap-2 text-blue-600">
            <Coffee className="h-5 w-5 sm:h-6 sm:w-6" />
            <span className="font-bold text-base sm:text-lg">Pausa Obrigatória</span>
          </div>
          <p className="text-xs text-muted-foreground">
            Reg. CE 561/2006 — Pausa mínima de 45 minutos após 4,5h de condução
          </p>
          <div className="space-y-3 pt-1 sm:pt-2">
            <Button
              onClick={() => onBreakTypeSelect('part1')}
              className="w-full h-12 sm:h-14 bg-blue-600 hover:bg-blue-700 text-base font-bold"
            >
              <Pause className="h-5 w-5 mr-2" />
              1ª parte: 15 min
            </Button>
            <Button
              onClick={() => onBreakTypeSelect('part2')}
              variant="outline"
              className="w-full h-12 sm:h-14 border-blue-400 text-blue-700 dark:text-blue-300 dark:border-blue-700 text-base font-bold"
            >
              <Coffee className="h-5 w-5 mr-2" />
              2ª parte: 30 min
            </Button>
          </div>
          <p className="text-[10px] sm:text-xs text-muted-foreground">
            A pausa pode ser dividida em duas partes: 15 min + 30 min (total de 45 min).
          </p>
        </div>
      </Card>
    );
  }

  // Timer ativo ou completo
  return (
    <Card className={`border-2 shadow-lg ring-2 ${isComplete ? 'border-emerald-300 dark:border-emerald-700 bg-gradient-to-br from-emerald-50 to-white dark:from-emerald-950 dark:to-slate-900 ring-emerald-400/50' : `${colors.border} bg-gradient-to-br from-slate-50 to-white dark:from-slate-900 dark:to-slate-900 ring-blue-400/50`}`}>
      <div className="p-4 sm:p-6 text-center space-y-3 sm:space-y-4">
        {/* Cabeçalho */}
        <div className="flex items-center justify-center gap-2">
          {isComplete ? (
            <div className="w-10 h-10 sm:w-12 sm:h-12 rounded-full bg-emerald-500 flex items-center justify-center">
              <CheckCircle2 className="h-5 w-5 sm:h-6 sm:w-6 text-white" />
            </div>
          ) : (
            <div className={`w-10 h-10 sm:w-12 sm:h-12 rounded-full ${colors.bg} flex items-center justify-center`}>
              <Coffee className="h-5 w-5 sm:h-6 sm:w-6 text-white" />
            </div>
          )}
        </div>

        {/* Info da parte da pausa (divisão 15 + 30) */}
        <div className="flex items-center justify-center gap-2 flex-wrap">
          <span className={`text-[10px] sm:text-xs font-bold px-2 sm:px-3 py-1 rounded-full ${
            breakType === 'part1'
              ? (remaining > 0 ? 'bg-blue-100 text-blue-700 dark:bg-blue-900/40 dark:text-blue-300' : 'bg-emerald-100 text-emerald-700 dark:bg-emerald-900/40 dark:text-emerald-300')
              : 'bg-emerald-100 text-emerald-700 dark:bg-emerald-900/40 dark:text-emerald-300'
          }`}>
            1ª parte: 15min {breakType === 'part2' || (breakType === 'part1' && remaining <= 0) ? '✓' : ''}
          </span>
          <span className={`text-[10px] sm:text-xs font-bold px-2 sm:px-3 py-1 rounded-full ${
            breakType === 'part2'
              ? (remaining > 0 ? 'bg-amber-100 text-amber-700 dark:bg-amber-900/40 dark:text-amber-300' : 'bg-emerald-100 text-emerald-700 dark:bg-emerald-900/40 dark:text-emerald-300')
              : (remaining <= 0 ? 'bg-amber-100 text-amber-700 dark:bg-amber-900/40 dark:text-amber-300' : 'bg-slate-100 text-slate-500 dark:bg-slate-800 dark:text-slate-400')
          }`}>
            2ª parte: 30min {breakType === 'part2' && remaining <= 0 ? '✓' : ''}
          </span>
        </div>

        <p className="text-[10px] sm:text-xs font-medium text-muted-foreground">
          {breakType === 'part1'
            ? 'Pausa dividida — 1ª parte de 15 minutos'
            : 'Pausa dividida — 2ª parte de 30 minutos'}
        </p>

        {/* Cronômetro */}
        <div className="py-2 sm:py-3">
          <p className={`text-5xl sm:text-6xl font-bold font-mono ${isComplete ? 'text-emerald-600 dark:text-emerald-400' : colors.text}`}>
            {isComplete ? '00:00' : formatTime(remaining)}
          </p>
        </div>

        {/* Barra de progresso — parte atual */}
        {!isComplete && (
          <div className="h-2 sm:h-3 bg-slate-200 dark:bg-slate-700 rounded-full overflow-hidden">
            <div
              className={`h-full rounded-full transition-all duration-1000 ${colors.barBg}`}
              style={{ width: `${percentage}%` }}
            />
          </div>
        )}

        {/* Progresso do total legal de 45 minutos */}
        <div className="space-y-1">
          <div className="flex items-center justify-between text-[10px] sm:text-xs text-muted-foreground">
            <span>Total da pausa obrigatória</span>
            <span className="font-bold">{Math.floor(totalLegalSeconds / 60)} / 45 min</span>
          </div>
          <div className="h-2 bg-slate-200 dark:bg-slate-700 rounded-full overflow-hidden">
            <div
              className={`h-full rounded-full transition-all duration-1000 ${isFullyComplete ? 'bg-emerald-500' : 'bg-blue-500'}`}
              style={{ width: `${totalPercentage}%` }}
            />
          </div>
        </div>

        {/* Alerta quando falta pouco */}
        {remaining > 0 && remaining <= 300 && (
          <div className="flex items-center justify-center gap-1 text-red-600 dark:text-red-400">
            <AlertTriangle className="h-4 w-4" />
            <span className="text-[10px] sm:text-xs font-medium">
              Pausa quase completa — pode retomar quando quiser
            </span>
          </div>
        )}

        {/* Parte concluída, falta a 2ª parte */}
        {isComplete && breakType === 'part1' && !isFullyComplete && (
          <div className="p-2 sm:p-3 bg-blue-50 dark:bg-blue-900/20 rounded-lg border border-blue-200 dark:border-blue-800 space-y-2">
            <p className="text-xs sm:text-sm font-medium text-blue-700 dark:text-blue-300">
              1ª parte concluída! Conduza até 4h30 e faça a 2ª parte de 30 minutos.
            </p>
            <Button
              onClick={() => onBreakTypeSelect('part2')}
              variant="outline"
              className="w-full h-10 border-blue-400 text-blue-700 dark:text-blue-300 dark:border-blue-700 font-bold"
            >
              <Coffee className="h-4 w-4 mr-2" />
              Fazer 2ª parte agora (30 min)
            </Button>
          </div>
        )}

        {/* Pausa obrigatória totalmente cumprida */}
        {isComplete && isFullyComplete && (
          <div className="p-2 sm:p-3 bg-emerald-50 dark:bg-emerald-900/20 rounded-lg border border-emerald-200 dark:border-emerald-800">
            <p className="text-xs sm:text-sm font-medium text-emerald-700 dark:text-emerald-300">
              Pausa obrigatória cumprida (45 min)! Pode retomar a condução.
            </p>
          </div>
        )}

        {/* Botão Retomar */}
        <Button
          onClick={handleResume}
          className={`w-full h-12 sm:h-14 text-base sm:text-lg font-bold shadow-lg ${
            isFullyComplete
              ? 'bg-emerald-600 hover:bg-emerald-700'
              : 'bg-amber-600 hover:bg-amber-700'
          }`}
        >
          <Play className="h-5 w-5 mr-2" />
          {isFullyComplete ? 'RETOMAR CONDUÇÃO' : 'RETOMAR (pausa incompleta)'}
        </Button>

        {!isFullyComplete && (
          <p className="text-[9px] sm:text-[10px] text-muted-foreground text-center">
            Pode retomar antes do tempo, mas a pausa legal de 45min não ficará cumprida.
          </p>
        )}
      </div>
    </Card>
  );
}
