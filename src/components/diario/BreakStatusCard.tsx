'use client';

/**
 * BreakStatusCard — indicador do estado de pausa / condução contínua.
 *
 * Reg. CE 561/2006, Art. 7: após 4h30 de condução contínua é obrigatória
 * uma pausa de 45 min (ou combinada: 15 min + 30 min). Este cartão:
 *  - mostra os minutos de condução contínua desde a última pausa válida;
 *  - atualiza o relógio a cada 10 segundos (com execução imediata ao montar);
 *  - avisa quando a pausa obrigatória se aproxima (>= 4h) ou venceu (>= 4h30);
 *  - permite abrir a pausa diretamente pelo botão do cartão.
 */

import { useEffect, useState, useCallback } from 'react';
import { Card, CardContent } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Coffee, AlertTriangle, CheckCircle2, TimerReset } from 'lucide-react';
import { minutesToFormatted } from '@/lib/time';

/** Intervalo de atualização do relógio de estado de pausa: 10 segundos */
const REFRESH_INTERVAL_MS = 10_000;

export interface ContinuousDrivingInfo {
  /** Minutos de condução contínua desde a última pausa válida (45min ou 15+30) */
  continuousMinutes: number;
  /** Limite legal em minutos (270 = 4h30) */
  limitMinutes: number;
  /** true se já existe pausa válida que renovou o ciclo */
  hasValidBreak: boolean;
  /** Modo da última pausa válida: contínua (45) ou dividida (15+30) */
  mode: 'continuous' | 'split' | null;
  /** true se o limite de 4h30 foi atingido/excedido — pausa obrigatória */
  breakRequired: boolean;
  /** true se faltam <= 30 min para o limite — aviso antecipado */
  approachingLimit: boolean;
}

interface BreakStatusCardProps {
  info: ContinuousDrivingInfo | null;
  /** Pausa em curso? Se true, o cartão mostra o estado de pausa ativa. */
  isOnBreak?: boolean;
  /** Chamado ao premir o botão de pausa (abre o diálogo de seleção de tipo). */
  onOpenBreak?: () => void;
}

export function BreakStatusCard({ info, isOnBreak = false, onOpenBreak }: BreakStatusCardProps) {
  // Relógio local: atualização imediata na montagem + intervalo de 10 segundos.
  const [, setTick] = useState(0);
  useEffect(() => {
    setTick(t => t + 1); // execução imediata
    const interval = setInterval(() => {
      setTick(t => t + 1);
    }, REFRESH_INTERVAL_MS);
    return () => clearInterval(interval);
  }, []);

  const handleClick = useCallback(() => {
    if (!isOnBreak && onOpenBreak) onOpenBreak();
  }, [isOnBreak, onOpenBreak]);

  if (!info) return null;

  const remaining = Math.max(0, info.limitMinutes - info.continuousMinutes);

  if (isOnBreak) {
    return (
      <Card className="border-emerald-300 dark:border-emerald-800 bg-emerald-50/70 dark:bg-emerald-950/30">
        <CardContent className="pt-4">
          <div className="flex items-center gap-3">
            <Coffee className="h-8 w-8 text-emerald-600 shrink-0" />
            <div className="flex-1">
              <p className="font-bold text-emerald-700 dark:text-emerald-300">Pausa em curso</p>
              <p className="text-xs text-muted-foreground">
                Condução contínua antes da pausa: {minutesToFormatted(info.continuousMinutes)} · Atualizado a cada 10s
              </p>
            </div>
            <Badge className="bg-emerald-600 text-white hover:bg-emerald-600">PAUSA</Badge>
          </div>
        </CardContent>
      </Card>
    );
  }

  if (info.breakRequired) {
    return (
      <Card className="border-red-300 dark:border-red-800 bg-red-50/80 dark:bg-red-950/30" onClick={handleClick}>
        <CardContent className="pt-4">
          <div className="flex items-center gap-3">
            <AlertTriangle className="h-8 w-8 text-red-600 shrink-0" />
            <div className="flex-1">
              <p className="font-bold text-red-700 dark:text-red-300">
                PAUSA OBRIGATÓRIA — {minutesToFormatted(info.continuousMinutes)} de condução contínua
              </p>
              <p className="text-xs text-muted-foreground">
                Limite legal de 4h30 atingido (Reg. CE 561/2006, Art. 7). Faça 45 min de pausa ou 15 + 30 min.
              </p>
            </div>
            <Badge className="bg-red-600 text-white hover:bg-red-600">OBRIG.</Badge>
          </div>
        </CardContent>
      </Card>
    );
  }

  const warning = info.approachingLimit;
  return (
    <Card
      className={
        warning
          ? 'border-amber-300 dark:border-amber-800 bg-amber-50/70 dark:bg-amber-950/30 cursor-pointer'
          : 'border-slate-200 dark:border-slate-800 cursor-pointer'
      }
      onClick={handleClick}
    >
      <CardContent className="pt-4">
        <div className="flex items-center gap-3">
          {warning ? (
            <TimerReset className="h-8 w-8 text-amber-600 shrink-0" />
          ) : (
            <CheckCircle2 className="h-8 w-8 text-emerald-600 shrink-0" />
          )}
          <div className="flex-1">
            <p className={`font-bold ${warning ? 'text-amber-700 dark:text-amber-300' : ''}`}>
              Condução contínua: {minutesToFormatted(info.continuousMinutes)} / 4:30
            </p>
            <p className="text-xs text-muted-foreground">
              {warning
                ? `Faltam ${minutesToFormatted(remaining)} para a pausa obrigatória de 45 min (ou 15+30).`
                : info.hasValidBreak
                  ? `Ciclo renovado por pausa ${info.mode === 'continuous' ? 'contínua (45 min)' : 'dividida (15+30)'}. Toque para nova pausa.`
                  : 'Toque para iniciar pausa.'}
            </p>
          </div>
          <Badge variant={warning ? 'destructive' : 'secondary'}>
            {warning ? 'ATENÇÃO' : 'OK'}
          </Badge>
        </div>
      </CardContent>
    </Card>
  );
}
