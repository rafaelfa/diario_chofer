'use client';

/**
 * AmplitudeCard — Exibe a amplitude do dia (Reg. CE 561/2006, Art. 8º)
 *
 * Amplitude = tempo entre o início e o fim do período de trabalho diário,
 * incluindo condução, pausas e outros períodos de trabalho.
 *
 * Limites UE:
 *   1 Motorista:
 *     Normal: 15h
 *     Excecional (2x/semana): 16h
 *     Máximo absoluto: 18h
 *
 *   2 Motoristas (equipa):
 *     Normal: 21h
 *     Cada motorista deve ter pelo menos 9h de descanso em qualquer período de 30h
 *     (30h - 9h descanso = 21h de amplitude máxima)
 *
 * Cores (1 motorista):
 *   🟢 Verde:  < 12h  — confortável
 *   🟡 Amarelo: 12h-14h — atenção
 *   🟠 Laranja: 14h-15h — próximo do limite
 *   🔴 Vermelho: > 15h — limite excedido
 *
 * Cores (2 motoristas):
 *   🟢 Verde:  < 15h  — confortável
 *   🟡 Amarelo: 15h-18h — atenção
 *   🟠 Laranja: 18h-21h — próximo do limite
 *   🔴 Vermelho: > 21h — limite excedido
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

/**
 * Limites de amplitude conforme Reg. CE 561/2006
 *
 * 1 motorista: max 15h normal (18h absoluto)
 * 2 motoristas: max 21h (cada motorista com mínimo de 9h descanso em período de 30h)
 */
interface AmplitudeLimits {
  normal: number;      // Limite normal (15h solo, 21h equipa)
  attention1: number;  // Primeiro limiar de atenção
  attention2: number;  // Segundo limiar (próximo do limite)
  absolute: number;    // Limite absoluto
  label: string;       // Texto descritivo do limite
}

const AMPLITUDE_LIMITS: Record<number, AmplitudeLimits> = {
  1: {
    normal: 15,
    attention1: 12,
    attention2: 14,
    absolute: 18,
    label: '15:00h',
  },
  2: {
    normal: 21,
    attention1: 15,
    attention2: 18,
    absolute: 21,
    label: '21:00h',
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
  const level = getAmplitudeLevel(amplitudeHours, numDrivers);
  const config = AMPLITUDE_CONFIGS[level];
  const formattedTime = minutesToFormatted(Math.max(0, Math.round(amplitudeMinutes)));

  // Percentual em relação ao limite normal
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
              /* Referências para 1 motorista: 12h e 15h */
              <>
                {/* 12h = 80% de 15h */}
                <div className="absolute flex flex-col items-center" style={{ left: '80%' }}>
                  <div className="w-px h-1.5 bg-amber-400" />
                  <span className="text-[8px] text-amber-600 dark:text-amber-400 -mt-0.5">12h</span>
                </div>
                {/* 15h = 100% */}
                <div className="absolute flex flex-col items-center" style={{ left: '100%', transform: 'translateX(-100%)' }}>
                  <div className="w-px h-1.5 bg-red-400" />
                  <span className="text-[8px] text-red-600 dark:text-red-400 -mt-0.5">15h</span>
                </div>
              </>
            ) : (
              /* Referências para 2 motoristas: 15h e 21h */
              <>
                {/* 15h ≈ 71.4% de 21h */}
                <div className="absolute flex flex-col items-center" style={{ left: '71.4%' }}>
                  <div className="w-px h-1.5 bg-amber-400" />
                  <span className="text-[8px] text-amber-600 dark:text-amber-400 -mt-0.5">15h</span>
                </div>
                {/* 18h ≈ 85.7% de 21h */}
                <div className="absolute flex flex-col items-center" style={{ left: '85.7%' }}>
                  <div className="w-px h-1.5 bg-orange-400" />
                  <span className="text-[8px] text-orange-600 dark:text-orange-400 -mt-0.5">18h</span>
                </div>
                {/* 21h = 100% */}
                <div className="absolute flex flex-col items-center" style={{ left: '100%', transform: 'translateX(-100%)' }}>
                  <div className="w-px h-1.5 bg-red-400" />
                  <span className="text-[8px] text-red-600 dark:text-red-400 -mt-0.5">21h</span>
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
              ? `Amplitude > ${limits.normal}h — equipa de 2 motoristas excedeu o limite (Reg. CE 561/2006, Art. 8º)`
              : isTeam && level === 'proximo'
              ? `Amplitude próxima de ${limits.normal}h — cada motorista deve ter mínimo 9h descanso em 30h`
              : config.description}
          </p>
        </div>

        {/* Tabela de referência rápida */}
        <div className="mt-3 pt-3 border-t border-black/5 dark:border-white/10">
          {!isTeam ? (
            /* Referência para 1 motorista */
            <div className="grid grid-cols-2 gap-1.5">
              <div className="flex items-center gap-1.5">
                <div className="w-2.5 h-2.5 rounded-full bg-emerald-500" />
                <span className="text-[10px] text-muted-foreground">&lt; 12h Normal</span>
              </div>
              <div className="flex items-center gap-1.5">
                <div className="w-2.5 h-2.5 rounded-full bg-amber-500" />
                <span className="text-[10px] text-muted-foreground">12–14h Atenção</span>
              </div>
              <div className="flex items-center gap-1.5">
                <div className="w-2.5 h-2.5 rounded-full bg-orange-500" />
                <span className="text-[10px] text-muted-foreground">14–15h Crítico</span>
              </div>
              <div className="flex items-center gap-1.5">
                <div className="w-2.5 h-2.5 rounded-full bg-red-500" />
                <span className="text-[10px] text-muted-foreground">&gt; 15h Excedido</span>
              </div>
            </div>
          ) : (
            /* Referência para 2 motoristas (equipa) */
            <div className="grid grid-cols-2 gap-1.5">
              <div className="flex items-center gap-1.5">
                <div className="w-2.5 h-2.5 rounded-full bg-emerald-500" />
                <span className="text-[10px] text-muted-foreground">&lt; 15h Normal</span>
              </div>
              <div className="flex items-center gap-1.5">
                <div className="w-2.5 h-2.5 rounded-full bg-amber-500" />
                <span className="text-[10px] text-muted-foreground">15–18h Atenção</span>
              </div>
              <div className="flex items-center gap-1.5">
                <div className="w-2.5 h-2.5 rounded-full bg-orange-500" />
                <span className="text-[10px] text-muted-foreground">18–21h Crítico</span>
              </div>
              <div className="flex items-center gap-1.5">
                <div className="w-2.5 h-2.5 rounded-full bg-red-500" />
                <span className="text-[10px] text-muted-foreground">&gt; 21h Excedido</span>
              </div>
            </div>
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
