'use client';

interface CircularTimeCounterProps {
  hours: number;
  minutes: number;
  maxHours?: number;
  label?: string;
  size?: number;
}

export function CircularTimeCounter({
  hours,
  minutes,
  maxHours = 4.5,
  label = 'Condução',
  size = 140,
}: CircularTimeCounterProps) {
  const totalMinutes = hours * 60 + minutes;
  const maxMinutes = maxHours * 60;
  const percentage = Math.min((totalMinutes / maxMinutes) * 100, 100);

  // Calcular cor baseada no tempo
  const getColor = () => {
    const hoursValue = totalMinutes / 60;
    if (maxHours === 4.5) {
      // Para pausa: verde até 4h, amarelo 4h-4h30, vermelho >4h30
      if (hoursValue >= 4.5) return { ring: '#ef4444', bg: 'bg-red-100 dark:bg-red-900/30', text: 'text-red-600' };
      if (hoursValue >= 4) return { ring: '#f59e0b', bg: 'bg-amber-100 dark:bg-amber-900/30', text: 'text-amber-600' };
      return { ring: '#10b981', bg: 'bg-emerald-100 dark:bg-emerald-900/30', text: 'text-emerald-600' };
    } else {
      // Para dia: verde até 8h, amarelo 8h-9h, vermelho >9h
      if (hoursValue >= 9) return { ring: '#ef4444', bg: 'bg-red-100 dark:bg-red-900/30', text: 'text-red-600' };
      if (hoursValue >= 8) return { ring: '#f59e0b', bg: 'bg-amber-100 dark:bg-amber-900/30', text: 'text-amber-600' };
      return { ring: '#10b981', bg: 'bg-emerald-100 dark:bg-emerald-900/30', text: 'text-emerald-600' };
    }
  };

  const colors = getColor();
  const strokeWidth = 10;
  const radius = (size - strokeWidth) / 2;
  const circumference = 2 * Math.PI * radius;
  const strokeDashoffset = circumference - (percentage / 100) * circumference;
  const shouldPulse = (maxHours === 4.5 && totalMinutes / 60 >= 4) || (maxHours === 9 && totalMinutes / 60 >= 8);

  return (
    <div className={`relative inline-flex items-center justify-center ${shouldPulse ? 'animate-pulse' : ''}`}>
      <svg width={size} height={size} className="transform -rotate-90">
        {/* Background circle */}
        <circle
          cx={size / 2}
          cy={size / 2}
          r={radius}
          fill="none"
          stroke="currentColor"
          strokeWidth={strokeWidth}
          className="text-slate-200 dark:text-slate-700"
        />
        {/* Progress circle */}
        <circle
          cx={size / 2}
          cy={size / 2}
          r={radius}
          fill="none"
          stroke={colors.ring}
          strokeWidth={strokeWidth}
          strokeDasharray={circumference}
          strokeDashoffset={strokeDashoffset}
          strokeLinecap="round"
          className="transition-all duration-500"
        />
      </svg>
      <div className="absolute inset-0 flex flex-col items-center justify-center">
        <span className="text-2xl font-bold font-mono">
          {hours}:{minutes.toString().padStart(2, '0')}
        </span>
        <span className="text-xs text-muted-foreground">{label}</span>
      </div>
    </div>
  );
}
