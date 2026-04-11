import { X, CheckCircle2, AlertCircle, AlertTriangle } from 'lucide-react';
import type { ToastType } from '@/lib/types';

interface ToastProps {
  message: string;
  type: ToastType;
  onClose: () => void;
}

const CONFIG: Record<ToastType, { bg: string; Icon: typeof CheckCircle2 }> = {
  success: { bg: 'bg-emerald-600', Icon: CheckCircle2 },
  error:   { bg: 'bg-red-600',     Icon: AlertCircle },
  warning: { bg: 'bg-amber-500',   Icon: AlertTriangle },
};

export function Toast({ message, type, onClose }: ToastProps) {
  const { bg, Icon } = CONFIG[type];

  return (
    <div
      className={`fixed top-4 right-4 z-50 ${bg} text-white px-4 py-3 rounded-lg shadow-lg flex items-center gap-3 animate-in slide-in-from-right`}
    >
      <Icon className="h-5 w-5 shrink-0" />
      <span className="flex-1">{message}</span>
      <button onClick={onClose} className="hover:opacity-70">
        <X className="h-4 w-4" />
      </button>
    </div>
  );
}
