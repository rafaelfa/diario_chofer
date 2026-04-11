import { Home, History, BarChart3, Settings } from 'lucide-react';
import type { ActiveView } from '@/lib/types';

interface BottomNavProps {
  activeView: ActiveView;
  setActiveView: (view: ActiveView) => void;
}

const NAV_ITEMS = [
  { id: 'main' as ActiveView,     label: 'Hoje',       icon: Home },
  { id: 'history' as ActiveView,  label: 'Histórico',  icon: History },
  { id: 'reports' as ActiveView,  label: 'Relatórios', icon: BarChart3 },
  { id: 'settings' as ActiveView, label: 'Mais',       icon: Settings },
];

export function BottomNav({ activeView, setActiveView }: BottomNavProps) {
  return (
    <nav className="fixed bottom-0 left-0 right-0 bg-white dark:bg-slate-900 border-t border-slate-200 dark:border-slate-700 z-50 sm:hidden">
      <div className="flex items-center justify-around h-14">
        {NAV_ITEMS.map(({ id, label, icon: Icon }) => {
          const isActive = activeView === id;
          return (
            <button
              key={id}
              onClick={() => setActiveView(id)}
              className={`flex flex-col items-center justify-center flex-1 h-full transition-colors ${
                isActive
                  ? 'text-emerald-600 bg-emerald-50 dark:bg-emerald-900/20'
                  : 'text-slate-500 dark:text-slate-400'
              }`}
            >
              <Icon className={`h-5 w-5 ${isActive ? 'text-emerald-600' : ''}`} />
              <span className="text-[10px] mt-0.5">{label}</span>
            </button>
          );
        })}
      </div>
    </nav>
  );
}
