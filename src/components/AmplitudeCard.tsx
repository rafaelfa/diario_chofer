'use client';

/**
 * AmplitudeCard — Exibe a amplitude do dia (Reg. CE 561/2006, Art. 8º)
 *
 * Cores (1 motorista):
 *   🟢 Verde:    < 13h   — Normal
 *   🟡 Amarelo:  11h-12.5h — atenção
 *   🔴 Vermelho: > 13h   — excede o limite normal (só permitido como exceção até 15h, máx. 2x/semana)
 *
 * Cores (2 motoristas):
 *   🟢 Verde:    < 15h   — confortável
 *   🟡 Amarelo:  15h-21h — atenção
 *   🟠 Laranja:  21h-27h — próximo do limite
 *   🔴 Vermelho: > 27h   — exige verificação do descanso de 9h de cada motorista (limite da equipa: 30h)
 */

import { Card, CardContent } from '@/components/ui/card';
import { Clock, AlertTriangle, Timer, Users } from 'lucide-react';
import { parseTimeToMinutes, diffInMinutes, minutesToFormatted } from '@/lib/time';

interface AmplitudeCardProps {
  startTime: string | null;
  endTime: string | null | undefined;
  nowOverride?: Date;
  numDrivers?: number;
}

type AmplitudeLevel = 'confortavel' | 'atencao' | 'proximo' | 'excedido';

interface AmplitudeConfig {
  level: AmplitudeLevel;
  color: string;
  bg: string;
  border: string;
  iconBg: string;
  label: string;
  description: string;
}

const AMPLITUDE_CONFIGS: Record<AmplitudeLevel, AmplitudeConfig> = {
  confortavel: {
    level: 'confortavel',
    color: 'text-emerald-700 dark:text-emerald-300',
    bg: 'bg-gradient-to-br from-emerald-50 to-emerald-100/50 dark:from-emerald-950/40 dark:to-emerald-900/20',
    border: 'border-emerald-300 dark:border-emerald-700',
    iconBg: 'bg-emerald-500',
    label: 'Normal',
    description: 'Amplitude dentro dos limites legais',
  },
  atencao: {
    level: 'atencao',
    color: 'text-amber-700 dark:text-amber-300',
    bg: 'bg-gradient-to-br from-amber-50 to-amber-100/50 dark:from-amber-950/40 dark:to-amber-900/20',
    border: 'border-amber-300 dark:border-amber-700',
    iconBg: 'bg-amber-500',
    label: 'Atenção',
    description: 'Aproximando-se do limite de amplitude',
  },
  proximo: {
    level: 'proximo',
    color: 'text-orange-700 dark:text-orange-300',
    bg: 'bg-gradient-to-br from-orange-50 to-orange-100/50 dark:from-orange-950/40 dark:to-orange-900/20',
    border: 'border-orange-300 dark:border-orange-700',
    iconBg: 'bg-orange-500',
    label: 'Próximo do Limite',
    description: 'Amplitude próxima do limite — Reg. CE 561/2006',
  },
  excedido: {
    level: 'excedido',
    color: 'text-red-700 dark:text-red-300',
    bg: 'bg-gradient-to-br from-red-50 to-red-100/50 dark:from-red-950/40 dark:to-red-900/20',
    border: 'border-red-400 dark:border-red-600',
    iconBg: 'bg-red-500',
    label: 'Limite Excedido',
    description: 'Amplitude excedida — infringindo Reg. CE 561/2006',
  },
};

interface AmplitudeLimits {
  normal: number;
  attention1: number;
  attention2: number;
  absolute: number;
  label: string;
}

const AMPLITUDE_LIMITS: Record<number, AmplitudeLimits> = {
  1: {
    normal: 13,
    attention1: 11,
    attention2: 12.5,
    absolute: 15,
    label: '13:00h',
  },
  2: {
    normal: 27,
    attention1: 15,
    attention2: 21,
    absolute: 30,
    label: '30:00h',
  },
};

function getAmplitudeLevel(totalHours: number, numDrivers: number): AmplitudeLevel {
  const limits = AMPLITUDE_LIMITS[numDrivers] || AMPLITUDE_LIMITS[1];
  if (totalHours >= limits.normal) return 'excedido';
  if (totalHours >= limits.attention2) return 'proximo';
  if (totalHours >= limits.attention1) return 'atencao';
  return 'confortavel';
}

export function AmplitudeCard({ startTime, endTime, nowOverride, numDrivers = 1 }: AmplitudeCardProps) {
  const now = nowOverride ?? new Date();
  const isTeam = numDrivers === 2;
  const limits = AMPLITUDE_LIMITS[numDrivers] || AMPLITUDE_LIMITS[1];

  if (!startTime) return null;

  const startMin = parseTimeToMinutes(startTime);
  if (startMin === null) return null;

  let amplitudeMinutes: number;
  if (endTime) {
    const diff = diffInMinutes(startTime, endTime);
    amplitudeMinutes = diff ?? 0;
  } else {
    const nowMin = now.getHours() * 60 + now.getMinutes();
    amplitudeMinutes = nowMin - startMin;
    if (amplitudeMinutes < 0) amplitudeMinutes += 24 * 60;
  }

  const amplitudeHours = amplitudeMinutes / 60;
  const level = getAmplitudeLevel(amplitudeHours, numDrivers);
  const config = AMPLITUDE_CONFIGS[level];
  const formattedTime = minutesToFormatted(Math.max(0, Math.round(amplitudeMinutes)));

  const percentage = Math.min((amplitudeHours / limits.normal) * 100, 100);
  const isPulsing = level === 'excedido' || level === 'proximo';

  return (
    <Card className={`border-2 ${config.border} ${config.bg} ${isPulsing ? 'animate-pulse' : ''}`}>
      <CardContent className="pt-4 pb-4 px-4">
        {/* Cabeçalho */}
        <div className="flex items-center justify-between mb-3">
          <div className="flex items-center gap-2">
            <div className={`${config.iconBg} p-1.5 rounded-lg`}>
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
            <div className={`text-[10px] font-bold px-2 py-1 rounded-full ${config.color} ${config.iconBg}/15`}>
              {config.label}
            </div>
          </div>
        </div>

        {/* Tempo principal */}
        <div className="flex items-end justify-between mb-3">
          <div>
            <p className={`text-3xl font-bold font-mono ${config.color}`}>
              {formattedTime}
            </p>
            <p className="text-xs text-muted-foreground mt-0.5">
              {endTime ? 'Dia finalizado' : 'Em andamento...'}
            </p>
          </div>
          <div className="text-right">
            <p className="text-xs text-muted-foreground">
              {isTeam ? 'Máx. equipa' : 'Máx. normal'}
            </p>
            <p className="text-sm font-bold text-muted-foreground">{limits.label}</p>
          </div>
        </div>

        {/* Barra de progresso */}
        <div className="relative">
          <div className="h-3 bg-white/60 dark:bg-slate-700/60 rounded-full overflow-hidden">
            <div
              className={`h-full rounded-full transition-all duration-1000 ${
                level === 'excedido'
                  ? 'bg-red-500'
                  : level === 'proximo'
                  ? 'bg-orange-500'
                  : level === 'atencao'
                  ? 'bg-amber-500'
                  : 'bg-emerald-500'
              }`}
              style={{ width: `${percentage}%` }}
            />
          </div>
          {/* Marcas de referência na barra */}
          <div className="relative h-0 mt-0.5">
            {!isTeam ? (
              /* Referências para 1 motorista: 11h, 12.5h, 13h, 15h — barra escala até 15h */
              <>
                {/* 11h = ~73% de 15h (atenção) */}
                <div className="absolute flex flex-col items-center" style={{ left: '73%' }}>
                  <div className="w-px h-1.5 bg-amber-400" />
                  <span className="text-[8px] text-amber-600 dark:text-amber-400 -mt-0.5">11h</span>
                </div>
                {/* 12.5h = ~83% de 15h (crítico) */}
                <div className="absolute flex flex-col items-center" style={{ left: '83%' }}>
                  <div className="w-px h-1.5 bg-orange-400" />
                  <span className="text-[8px] text-orange-600 dark:text-orange-400 -mt-0.5">12.5h</span>
                </div>
                {/* 13h = ~87% de 15h (limite normal) */}
                <div className="absolute flex flex-col items-center" style={{ left: '87%' }}>
                  <div className="w-px h-1.5 bg-red-400" />
                  <span className="text-[8px] text-red-600 dark:text-red-400 -mt-0.5">13h</span>
                </div>
                {/* 15h = 100% (máximo excecional) */}
                <div className="absolute flex flex-col items-center" style={{ left: '100%', transform: 'translateX(-100%)' }}>
                  <div className="w-px h-1.5 bg-red-500" />
                  <span className="text-[8px] text-red-600 dark:text-red-400 -mt-0.5">15h</span>
                </div>
              </>
            ) : (
              /* Referências para 2 motoristas (equipa): 21h e 30h — barra escala até 30h */
              <>
                {/* 21h = 70% de 30h */}
                <div className="absolute flex flex-col items-center" style={{ left: '70%' }}>
                  <div className="w-px h-1.5 bg-amber-400" />
                  <span className="text-[8px] text-amber-600 dark:text-amber-400 -mt-0.5">21h</span>
                </div>
                {/* 27h = 90% de 30h */}
                <div className="absolute flex flex-col items-center" style={{ left: '90%' }}>
                  <div className="w-px h-1.5 bg-orange-400" />
                  <span className="text-[8px] text-orange-600 dark:text-orange-400 -mt-0.5">27h</span>
                </div>
                {/* 30h = 100% (limite da equipa, com 9h descanso p/ cada) */}
                <div className="absolute flex flex-col items-center" style={{ left: '100%', transform: 'translateX(-100%)' }}>
                  <div className="w-px h-1.5 bg-red-400" />
                  <span className="text-[8px] text-red-600 dark:text-red-400 -mt-0.5">30h</span>
                </div>
              </>
            )}
          </div>
        </div>

        {/* Descrição / Alerta */}
        <div className="mt-3 flex items-start gap-2">
          {(level === 'excedido' || level === 'proximo') ? (
            <AlertTriangle className={`h-4 w-4 mt-0.5 shrink-0 ${config.color}`} />
          ) : (
            <Clock className={`h-4 w-4 mt-0.5 shrink-0 text-muted-foreground`} />
          )}
          <p className={`text-xs ${level === 'excedido' || level === 'proximo' ? 'font-medium' : 'text-muted-foreground'}`}>
            {isTeam && level === 'excedido'
              ? `Amplitude > ${limits.normal}h — aproximan-se do limite de 30h da equipa; cada motorista deve ter mínimo 9h descanso (Reg. CE 561/2006, Art. 8º, nº 8)`
              : isTeam && level === 'proximo'
              ? `Amplitude próxima de ${limits.normal}h — cada motorista deve ter mínimo 9h descanso em 30h`
              : !isTeam && level === 'excedido' && amplitudeHours <= limits.absolute
              ? `Acima de 13h — permitido só como exceção (até 15h), máx. 2x/semana`
              : config.description}
          </p>
        </div>

        {/* Tabela de referência rápida */}
        <div className="mt-3 pt-3 border-t border-black/5 dark:border-white/10">
          {!isTeam ? (
            /* Referência para 1 motorista: normal 13h, atenção 11–12.5h, excecional até 15h */
            <div className="grid grid-cols-2 gap-1.5">
              <div className="flex items-center gap-1.5">
                <div className="w-2.5 h-2.5 rounded-full bg-emerald-500" />
                <span className="text-[10px] text-muted-foreground">&lt; 11h Normal</span>
              </div>
              <div className="flex items-center gap-1.5">
                <div className="w-2.5 h-2.5 rounded-full bg-amber-500" />
                <span className="text-[10px] text-muted-foreground">11–12.5h Atenção</span>
              </div>
              <div className="flex items-center gap-1.5">
                <div className="w-2.5 h-2.5 rounded-full bg-orange-500" />
                <span className="text-[10px] text-muted-foreground">12.5–13h Crítico</span>
              </div>
              <div className="flex items-center gap-1.5">
                <div className="w-2.5 h-2.5 rounded-full bg-red-500" />
                <span className="text-[10px] text-muted-foreground">&gt; 13h Excedido*</span>
              </div>
            </div>
          ) : (
            /* Referência para 2 motoristas (equipa): limite 30h com 9h descanso cada */
            <div className="grid grid-cols-2 gap-1.5">
              <div className="flex items-center gap-1.5">
                <div className="w-2.5 h-2.5 rounded-full bg-emerald-500" />
                <span className="text-[10px] text-muted-foreground">&lt; 15h Normal</span>
              </div>
              <div className="flex items-center gap-1.5">
                <div className="w-2.5 h-2.5 rounded-full bg-amber-500" />
                <span className="text-[10px] text-muted-foreground">15–21h Atenção</span>
              </div>
              <div className="flex items-center gap-1.5">
                <div className="w-2.5 h-2.5 rounded-full bg-orange-500" />
                <span className="text-[10px] text-muted-foreground">21–27h Crítico</span>
              </div>
              <div className="flex items-center gap-1.5">
                <div className="w-2.5 h-2.5 rounded-full bg-red-500" />
                <span className="text-[10px] text-muted-foreground">&gt; 27h Verificar (máx. 30h)</span>
              </div>
            </div>
          )}
          {!isTeam && (
            <p className="text-[9px] text-muted-foreground leading-relaxed mt-1.5">
              * Acima de 13h só é permitido como exceção (até 15h), no máximo 2 vezes por semana — Reg. CE 561/2006 / Diretiva 2002/15/CE.
            </p>
          )}
        </div>

        {/* Info extra para equipa de 2 motoristas */}
        {isTeam && (
          <div className="mt-2 pt-2 border-t border-black/5 dark:border-white/10">
            <p className="text-[9px] text-muted-foreground leading-relaxed">
              <strong>Equipa de 2 motoristas:</strong> Cada motorista deve ter pelo menos 9h de descanso
              em qualquer período de 30h (Reg. CE 561/2006, Art. 8º, nº 8).
              Limite de condução individual: 9h/dia (10h 2x/semana).
            </p>
          </div>
        )}
      </CardContent>
    </Card>
  );
}
