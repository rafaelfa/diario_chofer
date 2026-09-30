'use client';

import { useEffect, useState } from 'react';
import { Card, CardContent } from '@/components/ui/card';
import { Coffee, Moon, Hourglass } from 'lucide-react';
import type { BreakState } from '@/hooks/useDiarioActions';
import { computeBreakPhase } from '@/lib/time';

interface BreakStatusCardProps {
  breakState: BreakState;
}

/**
 * Cartão de estado da pausa inteligente (botão único "PAUSA").
 * Mostra o tempo decorrido e quantos minutos ainda faltam para a pausa
 * ser contabilizada (Regr. CE 561/2006, Art. 7):
 *   • bloco contínuo ≥45 min → pausa cumprida;
 *   • bloco ≥15 min → fase 1 feita, falta um bloco contínuo de ≥30 min;
 *   • blocos fora destas regras não são contabilizados.
 */
export function BreakStatusCard({ breakState }: BreakStatusCardProps) {
  const [now, setNow] = useState(0);

  // Atualiza o relógio a cada 10s enquanto a pausa está em curso
  useEffect(() => {
    if (!breakState.isActive) return;
    const tick = () => setNow(Date.now());
    tick();
    const id = setInterval(tick, 10_000);
    return () => clearInterval(id);
  }, [breakState.isActive]);

  if (!breakState.isActive || !breakState.startTime) return null;

  const startedAtMs = new Date(breakState.startTime).getTime();
  // `now` é 0 até ao primeiro tick do intervalo — nesse caso usa o próprio
  // instante de início (elapsed = 0), mantendo o render puro.
  const elapsed = Math.max(0, Math.floor((Math.max(now, startedAtMs) - startedAtMs) / 60_000));
  const info = computeBreakPhase(elapsed, breakState.hadPhase15);

  const done = info.phase === 'done';
  const awaiting30 = info.phase === 'awaiting30' && breakState.hadPhase15;

  // Minutos que ainda faltam neste bloco para a pausa ficar válida
  const remainingInBlock = awaiting30
    ? Math.max(0, 30 - elapsed)
    : Math.max(0, 45 - elapsed);

  let message: string;
  if (awaiting30) {
    message =
      elapsed >= 30
        ? 'Pausa dividida cumprida ✓'
        : `Fase 1 cumprida — faltam ${remainingInBlock} min contínuos`;
  } else if (elapsed >= 45) {
    message = 'Pausa contínua cumprida ✓';
  } else if (elapsed >= 15) {
    message = 'Conta como fase 1 — ao retomar ficará "faltam 30 min"';
  } else {
    message = `Ainda não conta — faltam ${15 - elapsed} min para os 15 iniciais`;
  }

  return (
    <Card
      className={`border-2 transition-colors ${
        done
          ? 'border-emerald-300 dark:border-emerald-700 bg-emerald-50/80 dark:bg-emerald-950/40'
          : 'border-amber-300 dark:border-amber-700 bg-amber-50/80 dark:bg-amber-950/40'
      }`}
    >
      <CardContent className="pt-4">
        <div className="flex items-center justify-between gap-3">
          <div className="flex items-center gap-3">
            <div
              className={`flex h-11 w-11 items-center justify-center rounded-full ${
                done
                  ? 'bg-emerald-100 text-emerald-600 dark:bg-emerald-900/50 dark:text-emerald-300'
                  : 'bg-amber-100 text-amber-600 dark:bg-amber-900/50 dark:text-amber-300'
              }`}
            >
              {done ? (
                <Moon className="h-5 w-5" />
              ) : awaiting30 ? (
                <Hourglass className="h-5 w-5" />
              ) : (
                <Coffee className="h-5 w-5" />
              )}
            </div>
            <div>
              <p className="font-bold leading-tight">
                Pausa em curso — {elapsed} min
              </p>
              <p className="text-xs text-muted-foreground">{message}</p>
            </div>
          </div>
          {!done && remainingInBlock > 0 && (
            <div className="text-right shrink-0">
              <p className="text-xl font-bold text-amber-600 dark:text-amber-400">
                −{remainingInBlock}
              </p>
              <p className="text-[10px] uppercase tracking-wide text-muted-foreground">
                min restantes
              </p>
            </div>
          )}
        </div>
      </CardContent>
    </Card>
  );
}
