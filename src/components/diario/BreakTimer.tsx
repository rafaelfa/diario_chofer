'use client';

import { useState, useEffect, useRef, useCallback } from 'react';
import { Card } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Clock, Coffee, Play, CheckCircle2, Timer, AlertTriangle } from 'lucide-react';

export type BreakType = 'none' | 'continuous' | 'split';

interface BreakTimerProps {
  /** ISO string ou Date do início da pausa */
  breakStartTime: Date | null;
  breakType: BreakType;
  onBreakTypeSelect: (type: 'continuous' | 'split') => void;
  onResume: () => void;
}

const CONTINUOUS_SECONDS = 45 * 60; // 45 minutos
const SPLIT_PHASE1_SECONDS = 30 * 60; // 30 minutos
const SPLIT_PHASE2_SECONDS = 15 * 60; // 15 minutos

export function BreakTimer({ breakStartTime, breakType, onBreakTypeSelect, onResume }: BreakTimerProps) {
  const [remaining, setRemaining] = useState(0);
  const [phase, setPhase] = useState<1 | 2>(1);
  const intervalRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const resumedEarlyRef = useRef(false);

  const getTargetSeconds = useCallback((bt: BreakType, ph: 1 | 2) => {
    if (bt === 'continuous') return CONTINUOUS_SECONDS;
    return ph === 1 ? SPLIT_PHASE1_SECONDS : SPLIT_PHASE2_SECONDS;
  }, []);

  const getPhaseTotal = useCallback((bt: BreakType, ph: 1 | 2) => {
    if (bt === 'continuous') return CONTINUOUS_SECONDS;
    return ph === 1 ? SPLIT_PHASE1_SECONDS : SPLIT_PHASE2_SECONDS;
  }, []);

  // Cronômetro principal
  useEffect(() => {
    if (!breakStartTime) {
      setRemaining(0);
      return;
    }

    const tick = () => {
      if (resumedEarlyRef.current) return;

      const now = Date.now();
      const elapsed = Math.floor((now - breakStartTime.getTime()) / 1000);
      let target = getTargetSeconds(breakType, phase);

      if (breakType === 'split') {
        if (phase === 1 && elapsed >= SPLIT_PHASE1_SECONDS) {
          // Mudar para fase 2
          setPhase(2);
          target = SPLIT_PHASE2_SECONDS;
          const phase2Elapsed = elapsed - SPLIT_PHASE1_SECONDS;
          setRemaining(Math.max(0, target - phase2Elapsed));
        } else if (phase === 2) {
          const phase2Elapsed = elapsed - SPLIT_PHASE1_SECONDS;
          setRemaining(Math.max(0, target - phase2Elapsed));
        } else {
          setRemaining(Math.max(0, target - elapsed));
        }
      } else {
        setRemaining(Math.max(0, target - elapsed));
      }
    };

    tick();
    intervalRef.current = setInterval(tick, 1000);

    return () => {
      if (intervalRef.current) clearInterval(intervalRef.current);
    };
  }, [breakStartTime, breakType, phase, getTargetSeconds]);

  // Formatar MM:SS
  const formatTime = (seconds: number): string => {
    const m = Math.floor(seconds / 60);
    const s = seconds % 60;
    return `${m.toString().padStart(2, '0')}:${s.toString().padStart(2, '0')}`;
  };

  const isComplete = remaining <= 0 && breakStartTime !== null;
  const phaseTotal = getPhaseTotal(breakType, phase);
  const percentage = phaseTotal > 0 ? Math.min(((phaseTotal - remaining) / phaseTotal) * 100, 100) : 0;

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
              onClick={() => onBreakTypeSelect('continuous')}
              className="w-full h-12 sm:h-14 bg-blue-600 hover:bg-blue-700 text-base font-bold"
            >
              <Clock className="h-5 w-5 mr-2" />
              45 min Contínua
            </Button>
            <Button
              onClick={() => onBreakTypeSelect('split')}
              variant="outline"
              className="w-full h-12 sm:h-14 border-blue-400 text-blue-700 dark:text-blue-300 dark:border-blue-700 text-base font-bold"
            >
              <Timer className="h-5 w-5 mr-2" />
              Dividir: 30min + 15min
            </Button>
          </div>
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

        {/* Info da fase */}
        {breakType === 'split' && (
          <div className="flex items-center justify-center gap-2">
            <span className={`text-[10px] sm:text-xs font-bold px-2 sm:px-3 py-1 rounded-full ${
              phase === 1
                ? (remaining > 0 ? 'bg-blue-100 text-blue-700 dark:bg-blue-900/40 dark:text-blue-300' : 'bg-slate-100 text-slate-500 dark:bg-slate-800 dark:text-slate-400 line-through')
                : (remaining > 0 ? 'bg-amber-100 text-amber-700 dark:bg-amber-900/40 dark:text-amber-300' : 'bg-slate-100 text-slate-500 dark:bg-slate-800 dark:text-slate-400 line-through')
            }`}>
              1ª Pausa: 30min
            </span>
            {phase === 2 && remaining > 0 && (
              <span className="text-[10px] sm:text-xs font-bold px-2 sm:px-3 py-1 rounded-full bg-amber-100 text-amber-700 dark:bg-amber-900/40 dark:text-amber-300">
                2ª Pausa: 15min
              </span>
            )}
            {phase === 2 && remaining <= 0 && (
              <span className="text-[10px] sm:text-xs font-bold px-2 sm:px-3 py-1 rounded-full bg-emerald-100 text-emerald-700 dark:bg-emerald-900/40 dark:text-emerald-300">
                2ª Pausa: 15min ✓
              </span>
            )}
          </div>
        )}

        {breakType === 'continuous' && !isComplete && (
          <p className="text-[10px] sm:text-xs font-medium text-muted-foreground">
            Pausa contínua de 45 minutos
          </p>
        )}

        {/* Cronômetro */}
        <div className="py-2 sm:py-3">
          <p className={`text-5xl sm:text-6xl font-bold font-mono ${isComplete ? 'text-emerald-600 dark:text-emerald-400' : colors.text}`}>
            {isComplete ? '00:00' : formatTime(remaining)}
          </p>
        </div>

        {/* Barra de progresso */}
        {!isComplete && (
          <div className="h-2 sm:h-3 bg-slate-200 dark:bg-slate-700 rounded-full overflow-hidden">
            <div
              className={`h-full rounded-full transition-all duration-1000 ${colors.barBg}`}
              style={{ width: `${percentage}%` }}
            />
          </div>
        )}

        {/* Alerta quando falta pouco */}
        {remaining > 0 && remaining <= 300 && (
          <div className="flex items-center justify-center gap-1 text-red-600 dark:text-red-400">
            <AlertTriangle className="h-4 w-4" />
            <span className="text-[10px] sm:text-xs font-medium">
              Pausa quase completa — pode retomar quando quiser
            </span>
          </div>
        )}

        {/* Completa */}
        {isComplete && (
          <div className="p-2 sm:p-3 bg-emerald-50 dark:bg-emerald-900/20 rounded-lg border border-emerald-200 dark:border-emerald-800">
            <p className="text-xs sm:text-sm font-medium text-emerald-700 dark:text-emerald-300">
              Pausa obrigatória cumprida! Pode retomar a condução.
            </p>
          </div>
        )}

        {/* Botão Retomar */}
        <Button
          onClick={handleResume}
          className={`w-full h-12 sm:h-14 text-base sm:text-lg font-bold shadow-lg ${
            isComplete
              ? 'bg-emerald-600 hover:bg-emerald-700'
              : 'bg-amber-600 hover:bg-amber-700'
          }`}
        >
          <Play className="h-5 w-5 mr-2" />
          {isComplete ? 'RETOMAR CONDUÇÃO' : 'RETOMAR (pausa incompleta)'}
        </Button>

        {!isComplete && (
          <p className="text-[9px] sm:text-[10px] text-muted-foreground text-center">
            Pode retomar antes do tempo, mas a pausa legal de 45min não ficará cumprida.
          </p>
        )}
      </div>
    </Card>
  );
}
