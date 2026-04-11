'use client';

import { AlertTriangle, Coffee } from 'lucide-react';

interface TrafficLightStatusProps {
  status: 'ok' | 'warning' | 'danger';
  totalMinutes: number;
  maxHours?: number;
  /** Total de minutos de pausa realizados (Reg. CE 561/2006 — pausas não contam para condução) */
  breakMinutes?: number;
}

export function TrafficLightStatus({
  status,
  totalMinutes,
  maxHours = 9,
  breakMinutes = 0,
}: TrafficLightStatusProps) {
  const hours = Math.floor(totalMinutes / 60);
  const minutes = totalMinutes % 60;
  const totalHours = totalMinutes / 60;
  const percentage = Math.min((totalHours / maxHours) * 100, 100);
  const isAlert = status === 'warning';
  const isDanger = status === 'danger';

  const getLightColor = () => {
    if (isDanger) return 'bg-red-500 shadow-red-500/50';
    if (isAlert) return 'bg-amber-500 shadow-amber-500/50';
    return 'bg-emerald-500 shadow-emerald-500/50';
  };

  // Formatar pausas
  const breakHours = Math.floor(breakMinutes / 60);
  const breakMins = breakMinutes % 60;
  const breakFormatted = breakMinutes > 0
    ? breakHours > 0
      ? `${breakHours}h${breakMins > 0 ? `${breakMins}min` : ''}`
      : `${breakMins}min`
    : null;

  return (
    <div className={`${isDanger ? 'animate-pulse bg-red-50 dark:bg-red-900/20' : isAlert ? 'animate-pulse bg-amber-50 dark:bg-amber-900/20' : 'bg-slate-50 dark:bg-slate-800/50'} p-4 rounded-lg`}>
      <div className="flex items-center gap-4">
        {/* Semáforo Visual */}
        <div className="flex flex-col gap-1 bg-slate-800 dark:bg-slate-900 p-2 rounded-lg">
          <div className={`w-6 h-6 rounded-full ${status === 'danger' ? 'bg-red-500 shadow-lg shadow-red-500/50 animate-pulse' : 'bg-red-900/50'}`} />
          <div className={`w-6 h-6 rounded-full ${status === 'warning' ? 'bg-amber-500 shadow-lg shadow-amber-500/50 animate-pulse' : 'bg-amber-900/50'}`} />
          <div className={`w-6 h-6 rounded-full ${status === 'ok' ? 'bg-emerald-500 shadow-lg shadow-emerald-500/50' : 'bg-emerald-900/50'}`} />
        </div>

        {/* Info e barra de progresso */}
        <div className="flex-1">
          <div className="flex items-center justify-between mb-2">
            <span className={`text-sm font-semibold ${isDanger ? 'text-red-600' : isAlert ? 'text-amber-600' : 'text-emerald-600'}`}>
              Condução: {hours}h{minutes > 0 ? `${minutes.toString().padStart(2, '0')}min` : ''}
            </span>
            <span className="text-xs text-muted-foreground">limite {maxHours}h</span>
          </div>

          {/* Barra de progresso */}
          <div className="h-3 bg-slate-200 dark:bg-slate-700 rounded-full overflow-hidden">
            <div
              className={`h-full rounded-full transition-all duration-500 ${
                isDanger ? 'bg-red-500' : isAlert ? 'bg-amber-500' : 'bg-emerald-500'
              }`}
              style={{ width: `${percentage}%` }}
            />
          </div>

          {/* Indicador de pausas realizadas */}
          {breakFormatted && (
            <div className="flex items-center gap-1 mt-1.5">
              <Coffee className="h-3 w-3 text-blue-500" />
              <span className="text-xs text-blue-600 dark:text-blue-400 font-medium">
                Pausas: {breakFormatted} <span className="text-muted-foreground font-normal">(não contam para condução)</span>
              </span>
            </div>
          )}

          {isDanger && (
            <p className="text-xs text-red-600 font-medium mt-1 flex items-center gap-1">
              <AlertTriangle className="h-3 w-3" />
              LIMITE EXCEDIDO - Faça uma pausa imediatamente!
            </p>
          )}
          {isAlert && !isDanger && (
            <p className="text-xs text-amber-600 font-medium mt-1 flex items-center gap-1">
              <AlertTriangle className="h-3 w-3" />
              Próximo do limite - Considere fazer uma pausa
            </p>
          )}
        </div>
      </div>
    </div>
  );
}
