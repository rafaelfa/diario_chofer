'use client';

import type { DrivingSession } from '@/lib/types';
import { parseTimeToMinutes } from '@/lib/time';

interface DayTimelineProps {
  startTime: string;
  sessions?: DrivingSession[];
  /** Número de motoristas (1 = solo, 2 = equipa) — afeta o range máximo do timeline */
  numDrivers?: number;
}

export function DayTimeline({
  startTime,
  sessions = [],
  numDrivers = 1,
}: DayTimelineProps) {
  const now = new Date();
  const currentMinutes = now.getHours() * 60 + now.getMinutes();

  const startMinutes = parseTimeToMinutes(startTime) ?? 0;

  // Build list of all significant times from sessions + start time
  const allTimes: number[] = [];
  if (startMinutes > 0) allTimes.push(startMinutes);

  for (const session of sessions) {
    const sStart = parseTimeToMinutes(session.startTime);
    if (sStart !== null) allTimes.push(sStart);
    if (session.endTime) {
      const sEnd = parseTimeToMinutes(session.endTime);
      if (sEnd !== null) allTimes.push(sEnd);
    }
  }
  allTimes.push(currentMinutes);

  // Calculate dynamic range: 1h before earliest, 1h after latest
  // Para equipa de 2 motoristas, o dia pode durar até 21h (ex: 06:00 → 03:00 dia seguinte)
  const MIN_START = 6 * 60;    // 06:00
  const isTeam = numDrivers === 2;
  const MAX_END = isTeam ? 24 * 60 : 21 * 60;     // 24:00 para equipa, 21:00 para solo
  const ABS_MIN = 0;           // 00:00
  const ABS_MAX = 23 * 60 + 59; // 23:59

  const earliest = allTimes.length > 0 ? Math.min(...allTimes) : MIN_START;
  const latest = allTimes.length > 0 ? Math.max(...allTimes) : MAX_END;

  let timelineStart = earliest - 60; // 1 hour before earliest
  let timelineEnd = latest + 60;     // 1 hour after latest

  // Clamp to minimum range
  timelineStart = Math.max(timelineStart, MIN_START);
  timelineEnd = Math.min(timelineEnd, MAX_END);

  // Ensure at least default range
  if (timelineStart > MIN_START || timelineEnd < MAX_END) {
    if (timelineStart < MIN_START + 60 && timelineEnd > MAX_END - 60) {
      timelineStart = MIN_START;
      timelineEnd = MAX_END;
    }
  }

  // Clamp to absolute bounds
  timelineStart = Math.max(timelineStart, ABS_MIN);
  timelineEnd = Math.min(timelineEnd, ABS_MAX);

  const totalTimelineMinutes = timelineEnd - timelineStart;

  const getPosition = (minutes: number) => {
    const pos = ((minutes - timelineStart) / totalTimelineMinutes) * 100;
    return Math.max(0, Math.min(100, pos));
  };

  // Generate hour labels based on the dynamic range
  const rangeHours: string[] = [];
  const startHour = Math.floor(timelineStart / 60);
  const endHour = Math.ceil(timelineEnd / 60);
  for (let h = startHour; h <= endHour; h++) {
    rangeHours.push(`${h.toString().padStart(2, '0')}:00`);
  }

  // If too many labels, thin them out
  let displayHours = rangeHours;
  if (displayHours.length > 12) {
    displayHours = rangeHours.filter((_, i) => i % 2 === 0);
  }
  if (displayHours.length > 12) {
    displayHours = rangeHours.filter((_, i) => i % 3 === 0);
  }

  return (
    <div className="w-full bg-slate-100 dark:bg-slate-800 rounded-lg p-3">
      <div className="flex items-center justify-between mb-2">
        <div className="text-xs text-muted-foreground font-medium">Timeline do Dia</div>
        {isTeam && (
          <span className="text-[9px] font-medium px-1.5 py-0.5 rounded-full bg-blue-100 dark:bg-blue-900/40 text-blue-700 dark:text-blue-300 border border-blue-200 dark:border-blue-800">
            Equipa 2 Motoristas
          </span>
        )}
      </div>

      {/* Timeline base */}
      <div className="relative h-8 bg-white dark:bg-slate-700 rounded overflow-hidden">
        {/* Marcas de hora */}
        {displayHours.map((hour) => {
          const hourMinutes = parseInt(hour.split(':')[0]) * 60;
          const pos = getPosition(hourMinutes);
          return (
            <div
              key={hour}
              className="absolute top-0 bottom-0 w-px bg-slate-300 dark:bg-slate-600"
              style={{ left: `${pos}%` }}
            >
              <span className="absolute -bottom-5 left-1 text-[9px] text-muted-foreground -translate-x-1/2">
                {hour}
              </span>
            </div>
          );
        })}

        {/* Barras de condução e pausas */}
        {sessions.length > 0 ? (
          sessions.map((session, idx) => {
            const sStart = parseTimeToMinutes(session.startTime);
            const sEnd = session.endTime ? parseTimeToMinutes(session.endTime) : currentMinutes;
            if (sStart === null) return null;

            const startPos = getPosition(sStart);
            const endPos = sEnd !== null ? getPosition(sEnd) : getPosition(currentMinutes);
            const width = Math.max(endPos - startPos, 0.5);

            return (
              <div key={idx}>
                {/* Condução (verde) */}
                <div
                  className="absolute top-1 bottom-1 bg-emerald-500 rounded"
                  style={{ left: `${startPos}%`, width: `${Math.min(width, 100 - startPos)}%` }}
                />

                {/* Pausa entre sessões (amarela) */}
                {(() => {
                  if (idx >= sessions.length - 1 || !session.endTime || !sessions[idx + 1]?.startTime) return null;
                  const pauseStart = parseTimeToMinutes(session.endTime);
                  const pauseEnd = parseTimeToMinutes(sessions[idx + 1].startTime);
                  if (pauseStart === null || pauseEnd === null || pauseEnd <= pauseStart) return null;
                  const pausePos = getPosition(pauseStart);
                  const pauseWidth = getPosition(pauseEnd) - pausePos;
                  if (pauseWidth <= 0.3) return null;
                  return (
                    <div
                      className="absolute top-2 bottom-2 bg-amber-400/60 rounded"
                      style={{ left: `${pausePos}%`, width: `${pauseWidth}%` }}
                    />
                  );
                })()}
              </div>
            );
          })
        ) : startTime ? (
          <div
            className="absolute top-1 bottom-1 bg-emerald-500 rounded"
            style={{
              left: `${getPosition(startMinutes)}%`,
              width: `${Math.min(getPosition(currentMinutes) - getPosition(startMinutes), 100 - getPosition(startMinutes))}%`,
            }}
          />
        ) : null}

        {/* Marcador de tempo atual */}
        <div
          className="absolute top-0 bottom-0 w-0.5 bg-red-500 z-10"
          style={{ left: `${getPosition(currentMinutes)}%` }}
        >
          <div className="absolute -top-0.5 left-1/2 -translate-x-1/2 w-2 h-2 bg-red-500 rounded-full" />
        </div>
      </div>

      {/* Legenda */}
      <div className="flex items-center justify-center gap-4 mt-5 text-[10px] text-muted-foreground">
        <div className="flex items-center gap-1">
          <div className="w-3 h-2 bg-emerald-500 rounded" />
          <span>Condução</span>
        </div>
        <div className="flex items-center gap-1">
          <div className="w-3 h-2 bg-amber-400 rounded" />
          <span>{isTeam ? 'Troca' : 'Pausa'}</span>
        </div>
        <div className="flex items-center gap-1">
          <div className="w-0.5 h-2 bg-red-500" />
          <span>Agora</span>
        </div>
      </div>
    </div>
  );
}
