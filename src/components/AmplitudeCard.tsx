'use client';

/**
 * AmplitudeCard — Exibe a amplitude do dia (Reg. CE 561/2006, Art. 8º)
 *
 * Amplitude = tempo entre o início e o fim do período de trabalho diário,
 * incluindo condução, pausas e outros períodos de trabalho.
 *
 * Limites (1 motorista):
 *   Normal:     até 13h
 *   Exceção:    até 15h, no máximo 2x por semana
 *
 * Cores (1 motorista):
 *   🟢 Verde:    < 11h    — Normal
 *   🟡 Amarelo:  11h–12.5h — Atenção
 *   🔴 Vermelho: > 13h    — excede o limite normal (só permitido como exceção até 15h, máx. 2x/semana)
 *
 * Cores (2 motoristas / equipa):
 *   🟢 Verde:    < 21h  — confortável
 *   🟡 Amarelo:  21h–27h — atenção
 *   🟠 Laranja:  27h–30h — próximo do limite da equipa
 *   🔴 Vermelho: > 30h  — exige verificação do descanso de 9h de cada motorista
 */

import { Card, CardContent } from '@/components/ui/card';
import { Clock, AlertTriangle, Timer, Users } from 'lucide-react';
import { parseTimeToMinutes, diffInMinutes, minutesToFormatted } from '@/lib/time';

interface AmplitudeCardProps {
  startTime: string | null;
  endTime: string | null | undefined;
  /** Força a hora "agora" (para testes) */
  nowOverride?: Date;
  /** Número de motoristas (1 = solo, 2 = equipa) */
  numDrivers?: number;
}

export function AmplitudeCard({ startTime, endTime, nowOverride, numDrivers = 1 }: AmplitudeCardProps) {
  const now = nowOverride ?? new Date();
  const isTeam = numDrivers === 2;

  // Sem startTime → sem amplitude
  if (!startTime) return null;

  const startMin = parseTimeToMinutes(startTime);
  if (startMin === null) return null;

  // Calcular amplitude: startTime → endTime (ou agora)
  let amplitudeMinutes: number;
  if (endTime) {
    const diff = diffInMinutes(startTime, endTime);
    amplitudeMinutes = diff ?? 0;
  } else {
    // Dia em andamento — amplitude cresce em tempo real
    const nowMin = now.getHours() * 60 + now.getMinutes();
    amplitudeMinutes = nowMin - startMin;
    if (amplitudeMinutes < 0) amplitudeMinutes += 24 * 60; // passou meia-noite
  }

  const amplitudeHours = amplitudeMinutes / 60;

  // ── Estados ────────────────────────────────────────────────────────────────
  // 1 motorista: 🟢 < 11h · 🟡 ≥ 11h · 🔴 > 13h (exceção até 15h, máx. 2x/semana)
  // 2 motoristas (equipa): 🟢 < 21h · 🟡 21–27h · 🟠 27–30h · 🔴 > 30h
  type Level = 'ok' | 'atencao' | 'proximo' | 'excedido';
  const level: Level = isTeam
    ? amplitudeHours > 30
      ? 'excedido'
      : amplitudeHours >= 27
      ? 'proximo'
      : amplitudeHours >= 21
      ? 'atencao'
      : 'ok'
    : amplitudeHours > 13
    ? 'excedido'
    : amplitudeHours >= 11
    ? 'atencao'
    : 'ok';

  const LEVEL_STYLES: Record<Level, { border: string; bg: string; icon: string; bar: string; text: string; chip: string; label: string }> = {
    ok: {
      border: 'border-emerald-300 dark:border-emerald-700',
      bg: 'bg-gradient-to-br from-emerald-50 to-emerald-100/50 dark:from-emerald-950/40 dark:to-emerald-900/20',
      icon: 'bg-emerald-500',
      bar: 'bg-emerald-500',
      text: 'text-emerald-700 dark:text-emerald-300',
      chip: 'text-emerald-700 dark:text-emerald-300 bg-emerald-100 dark:bg-emerald-900/40',
      label: 'Normal',
    },
    atencao: {
      border: 'border-amber-300 dark:border-amber-700',
      bg: 'bg-gradient-to-br from-amber-50 to-amber-100/50 dark:from-amber-950/40 dark:to-amber-900/20',
      icon: 'bg-amber-500',
      bar: 'bg-amber-500',
      text: 'text-amber-700 dark:text-amber-300',
      chip: 'text-amber-700 dark:text-amber-300 bg-amber-100 dark:bg-amber-900/40',
      label: 'Atenção',
    },
    proximo: {
      border: 'border-orange-300 dark:border-orange-700',
      bg: 'bg-gradient-to-br from-orange-50 to-orange-100/50 dark:from-orange-950/40 dark:to-orange-900/20',
      icon: 'bg-orange-500',
      bar: 'bg-orange-500',
      text: 'text-orange-700 dark:text-orange-300',
      chip: 'text-orange-700 dark:text-orange-300 bg-orange-100 dark:bg-orange-900/40',
      label: 'Próximo do Limite',
    },
    excedido: {
      border: 'border-red-400 dark:border-red-600',
      bg: 'bg-gradient-to-br from-red-50 to-red-100/50 dark:from-red-950/40 dark:to-red-900/20',
      icon: 'bg-red-500',
      bar: 'bg-red-500',
      text: 'text-red-700 dark:text-red-300',
      chip: 'text-red-700 dark:text-red-300 bg-red-100 dark:bg-red-900/40',
      label: 'Excedido',
    },
  };
  const s = LEVEL_STYLES[level];
  const exceeded = level === 'excedido';

  const formattedTime = minutesToFormatted(Math.max(0, Math.round(amplitudeMinutes)));

  // Escala da barra: 15h (1 motorista) ou 30h (equipa)
  const scaleMax = isTeam ? 30 : 15;
  const percentage = Math.min((amplitudeHours / scaleMax) * 100, 100);

  const description = isTeam
    ? exceeded
      ? 'Equipa acima de 30h — verifique o descanso de 9h de cada motorista (Reg. CE 561/2006, Art. 8º, nº 8)'
      : level === 'proximo'
      ? 'Equipa próxima das 30h — cada motorista deve ter no mínimo 9h de descanso neste período'
      : level === 'atencao'
      ? 'Equipa a passar das 21h — planeie os descansos de 9h de cada motorista (limite: 30h)'
      : 'Equipa de 2 motoristas: cada um deve ter no mínimo 9h de descanso em qualquer período de 30h (Reg. CE 561/2006, Art. 8º, nº 8)'
    : exceeded
    ? amplitudeHours <= 15
      ? 'Acima de 13h — só permitido como exceção (até 15h), no máximo 2x por semana'
      : 'Acima de 15h — limite máximo excedido (mesmo como exceção não é permitido)'
    : level === 'atencao'
    ? 'Atenção — faltam cerca de 2h para o limite normal de 13h'
    : 'Amplitude dentro do limite normal de 13h';

  return (
    <Card className={`border-2 ${s.border} ${s.bg} ${level === 'proximo' || exceeded ? 'animate-pulse' : ''}`}>
      <CardContent className="pt-4 pb-4 px-4">
        {/* Cabeçalho */}
        <div className="flex items-center justify-between mb-3">
          <div className="flex items-center gap-2">
            <div className={`p-1.5 rounded-lg ${s.icon}`}>
              {isTeam ? <Users className="h-4 w-4 text-white" /> : <Timer className="h-4 w-4 text-white" />}
            </div>
            <div>
              <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">
                Amplitude do Dia
              </p>
              <p className="text-[10px] text-muted-foreground">
                Reg. CE 561/2006 · Art. 8º {isTeam && '· Equipa'}
              </p>
            </div>
          </div>
          <div className="flex items-center gap-2">
            {isTeam && (
              <span className="text-[10px] font-medium px-2 py-0.5 rounded-full bg-blue-100 dark:bg-blue-900/40 text-blue-700 dark:text-blue-300 border border-blue-200 dark:border-blue-800">
                2 Motoristas
              </span>
            )}
            <div className={`text-[10px] font-bold px-2 py-1 rounded-full ${s.chip}`}>
              {s.label}
            </div>
          </div>
        </div>

        {/* Tempo principal */}
        <div className="flex items-end justify-between mb-3">
          <div>
            <p className={`text-3xl font-bold font-mono ${s.text}`}>{formattedTime}</p>
            <p className="text-xs text-muted-foreground mt-0.5">
              {endTime ? 'Dia finalizado' : 'Em andamento...'}
            </p>
          </div>
          <div className="text-right">
            <p className="text-xs text-muted-foreground">{isTeam ? 'Máx. equipa' : 'Limite normal'}</p>
            <p className="text-sm font-bold text-muted-foreground">{isTeam ? '30:00h' : '13:00h'}</p>
          </div>
        </div>

        {/* Barra de progresso */}
        <div className="relative">
          <div className="h-3 bg-white/60 dark:bg-slate-700/60 rounded-full overflow-hidden">
            <div
              className={`h-full rounded-full transition-all duration-1000 ${s.bar}`}
              style={{ width: `${percentage}%` }}
            />
          </div>
          {!isTeam ? (
            <>
              {/* Marca dos 13h = ~87% da barra de 15h */}
              <div className="absolute flex flex-col items-center" style={{ left: '87%' }}>
                <div className="w-px h-1.5 bg-red-400" />
                <span className="text-[8px] text-red-600 dark:text-red-400 -mt-0.5">13h</span>
              </div>
              {/* Marca dos 15h = 100% */}
              <div className="absolute flex flex-col items-center" style={{ left: '100%', transform: 'translateX(-100%)' }}>
                <div className="w-px h-1.5 bg-red-500" />
                <span className="text-[8px] text-red-600 dark:text-red-400 -mt-0.5">15h</span>
              </div>
            </>
          ) : (
            <>
              {/* Marca dos 21h = 70% da barra de 30h */}
              <div className="absolute flex flex-col items-center" style={{ left: '70%' }}>
                <div className="w-px h-1.5 bg-amber-400" />
                <span className="text-[8px] text-amber-600 dark:text-amber-400 -mt-0.5">21h</span>
              </div>
              {/* Marca dos 27h = 90% */}
              <div className="absolute flex flex-col items-center" style={{ left: '90%' }}>
                <div className="w-px h-1.5 bg-orange-400" />
                <span className="text-[8px] text-orange-600 dark:text-orange-400 -mt-0.5">27h</span>
              </div>
              {/* Marca dos 30h = 100% */}
              <div className="absolute flex flex-col items-center" style={{ left: '100%', transform: 'translateX(-100%)' }}>
                <div className="w-px h-1.5 bg-red-500" />
                <span className="text-[8px] text-red-600 dark:text-red-400 -mt-0.5">30h</span>
              </div>
            </>
          )}
        </div>

        {/* Descrição / Alerta */}
        <div className="mt-3 flex items-start gap-2">
          {level === 'proximo' || exceeded ? (
            <AlertTriangle className={`h-4 w-4 mt-0.5 shrink-0 ${s.text}`} />
          ) : (
            <Clock className="h-4 w-4 mt-0.5 shrink-0 text-muted-foreground" />
          )}
          <p className={`text-xs ${level === 'proximo' || exceeded ? `font-medium ${s.text}` : 'text-muted-foreground'}`}>
            {description}
          </p>
        </div>
      </CardContent>
    </Card>
  );
}
