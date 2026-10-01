'use client';

/**
 * BreakStatusCard — cartão de pausas com botão ÚNICO de "Pausa".
 *
 * Substitui os antigos botões fixos ("45 min Contínua" / "15min + 30min") por um
 * fluxo inteligente: o sistema mede a duração REAL de cada pausa e aplica a regra
 * do Reg. CE 561/2006, Art. 4º:
 *   - Pausa válida = bloco único de ≥45min OU 1º bloco ≥15min + 2º bloco ≥30min.
 *   - Blocos <15min não contabilizam para a pausa obrigatória.
 */

import { Card } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Coffee, Play, CheckCircle2, Pause, Timer, AlertTriangle } from 'lucide-react';
import type { BreakStatusInfo } from '@/lib/types';

interface BreakStatusCardProps {
  /** Estado avaliado da pausa (blocos válidos + bloco em curso) */
  status: BreakStatusInfo;
  /** true quando existe uma pausa em curso (botão mostra RETOMAR) */
  isOnBreak: boolean;
  /** Inicia um novo bloco de pausa (timestamp real de início) */
  onStartBreak: () => void;
  /** Fecha o bloco em curso (timestamp real de fim → duração medida) */
  onEndBreak: () => void;
}

export function BreakStatusCard({ status, isOnBreak, onStartBreak, onEndBreak }: BreakStatusCardProps) {
  const progressMinutes = Math.min(status.validMinutes + (isOnBreak ? status.activeMinutes : 0), 45);
  const percentage = Math.min((progressMinutes / 45) * 100, 100);

  return (
    <Card className={`border-2 shadow-lg ring-2 ${
      status.isComplete
        ? 'border-emerald-300 dark:border-emerald-700 bg-gradient-to-br from-emerald-50 to-white dark:from-emerald-950 dark:to-slate-900 ring-emerald-400/50'
        : isOnBreak
          ? 'border-blue-300 dark:border-blue-700 bg-gradient-to-br from-blue-50 to-white dark:from-blue-950 dark:to-slate-900 ring-blue-400/50'
          : 'border-amber-300 dark:border-amber-700 bg-gradient-to-br from-amber-50 to-white dark:from-amber-950 dark:to-slate-900 ring-amber-400/40'
    }`}>
      <div className="p-4 sm:p-5 space-y-3">
        {/* Cabeçalho */}
        <div className="flex items-center justify-between gap-2">
          <div className="flex items-center gap-2">
            {status.isComplete ? (
              <CheckCircle2 className="h-5 w-5 text-emerald-600" />
            ) : isOnBreak ? (
              <Timer className="h-5 w-5 text-blue-600 animate-pulse" />
            ) : (
              <Coffee className="h-5 w-5 text-amber-600" />
            )}
            <span className="font-bold text-sm sm:text-base">
              {status.isComplete ? 'Pausa Cumprida' : isOnBreak ? 'Pausa em Curso' : 'Pausa Obrigatória'}
            </span>
          </div>
          <span className={`text-xs font-bold px-2 py-1 rounded-full ${
            status.isComplete
              ? 'bg-emerald-100 text-emerald-700 dark:bg-emerald-900/40 dark:text-emerald-300'
              : 'bg-amber-100 text-amber-700 dark:bg-amber-900/40 dark:text-amber-300'
          }`}>
            {progressMinutes}/45 min
          </span>
        </div>

        {/* Estado textual — diz claramente o que falta */}
        <p className={`text-xs sm:text-sm font-medium ${
          status.isComplete ? 'text-emerald-700 dark:text-emerald-300' : 'text-amber-700 dark:text-amber-300'
        }`}>
          {status.label}
        </p>

        {/* Detalhe dos blocos exigidos pela regra */}
        {!status.isComplete && (
          <div className="flex flex-wrap items-center gap-2 text-[10px] sm:text-xs">
            <span className={`font-bold px-2 py-1 rounded-full ${
              status.hasFirstBlock || status.hasContinuous45
                ? 'bg-emerald-100 text-emerald-700 dark:bg-emerald-900/40 dark:text-emerald-300 line-through'
                : 'bg-slate-100 text-slate-600 dark:bg-slate-800 dark:text-slate-400'
            }`}>
              1ª parte: 15 min {status.hasFirstBlock || status.hasContinuous45 ? '✓' : ''}
            </span>
            <span className={`font-bold px-2 py-1 rounded-full ${
              status.hasSecondBlock || status.hasContinuous45
                ? 'bg-emerald-100 text-emerald-700 dark:bg-emerald-900/40 dark:text-emerald-300 line-through'
                : 'bg-slate-100 text-slate-600 dark:bg-slate-800 dark:text-slate-400'
            }`}>
              2ª parte: 30 min {status.hasSecondBlock || status.hasContinuous45 ? '✓' : ''}
            </span>
          </div>
        )}

        {/* Barra de progresso (minutos válidos acumulados até 45) */}
        <div className="h-2 sm:h-3 bg-slate-200 dark:bg-slate-700 rounded-full overflow-hidden">
          <div
            className={`h-full rounded-full transition-all duration-700 ${
              status.isComplete ? 'bg-emerald-500' : isOnBreak ? 'bg-blue-500' : 'bg-amber-500'
            }`}
            style={{ width: `${percentage}%` }}
          />
        </div>

        {/* Tempo real do bloco em curso */}
        {isOnBreak && status.activeMinutes > 0 && !status.isComplete && (
          <div className="flex items-center justify-between text-xs text-muted-foreground">
            <span>Tempo de pausa medido: <strong>{status.activeMinutes} min</strong></span>
            {status.activeRemaining > 0 ? (
              <span>Faltam <strong>{status.activeRemaining} min</strong> para fechar este bloco</span>
            ) : (
              <span className="text-emerald-600 font-semibold flex items-center gap-1">
                <AlertTriangle className="h-3.5 w-3.5" /> Bloco atinge os mínimos — pode retomar
              </span>
            )}
          </div>
        )}

        {/* BOTÃO ÚNICO: Pausa / Retomar */}
        {isOnBreak ? (
          <Button
            onClick={onEndBreak}
            className={`w-full h-12 sm:h-14 text-base font-bold shadow-lg ${
              status.activeRemaining === 0 || status.isComplete
                ? 'bg-emerald-600 hover:bg-emerald-700'
                : 'bg-amber-600 hover:bg-amber-700'
            }`}
          >
            <Play className="h-5 w-5 mr-2" />
            RETOMAR CONDUÇÃO
          </Button>
        ) : status.isComplete ? (
          <div className="p-2 sm:p-3 bg-emerald-50 dark:bg-emerald-900/20 rounded-lg border border-emerald-200 dark:border-emerald-800 text-center">
            <p className="text-xs sm:text-sm font-medium text-emerald-700 dark:text-emerald-300">
              Obrigação de pausa cumprida ({status.hasContinuous45 ? '45 min contínuos' : '15 min + 30 min'}). Bom trabalho!
            </p>
          </div>
        ) : (
          <Button
            onClick={onStartBreak}
            className="w-full h-12 sm:h-14 text-base font-bold shadow-lg bg-blue-600 hover:bg-blue-700"
          >
            <Pause className="h-5 w-5 mr-2" />
            PAUSA
            <span className="ml-2 text-xs font-normal opacity-80">
              ({status.remainingMinutes} min por cumprir)
            </span>
          </Button>
        )}

        <p className="text-[9px] sm:text-[10px] text-muted-foreground text-center">
          Reg. CE 561/2006 — pausa de 45 min, ou fracionada em 15 min + 30 min. Pausas abaixo de 15 min não contabilizam.
        </p>
      </div>
    </Card>
  );
}
