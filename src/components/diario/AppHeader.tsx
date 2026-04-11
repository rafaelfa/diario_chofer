'use client';

import { Button } from '@/components/ui/button';
import { Truck, Wifi, WifiOff, LogOut, User } from 'lucide-react';
import type { ActiveView } from '@/lib/types';

interface AppHeaderProps {
  activeView: ActiveView;
  onViewChange: (view: ActiveView) => void;
  isOnline: boolean;
  currentUser: { username: string } | null;
  onLogout: () => void;
}

export function AppHeader({
  activeView,
  onViewChange,
  isOnline,
  currentUser,
  onLogout,
}: AppHeaderProps) {
  return (
    <header className="sticky top-0 z-40 border-b bg-white/90 backdrop-blur-sm dark:bg-slate-900/90">
      <div className="container mx-auto px-3 py-2">
        <div className="flex items-center justify-between">
          {/* Logo e Título */}
          <div className="flex items-center gap-2">
            <div className="bg-emerald-600 p-1.5 rounded-lg">
              <Truck className="h-5 w-5 text-white" />
            </div>
            <div>
              <h1 className="text-base font-bold text-slate-900 dark:text-white">Diário do Motorista</h1>
              <p className="text-xs text-slate-500 hidden sm:block">
                {new Date().toLocaleDateString('pt-PT', { weekday: 'long', day: 'numeric', month: 'long' })}
              </p>
            </div>
          </div>

          {/* Status Online/Offline */}
          <div className={`flex items-center gap-1 px-2 py-1 rounded-full text-xs ${
            isOnline
              ? 'bg-emerald-100 text-emerald-700 dark:bg-emerald-900/30 dark:text-emerald-300'
              : 'bg-amber-100 text-amber-700 dark:bg-amber-900/30 dark:text-amber-300'
          }`}>
            {isOnline ? (
              <Wifi className="h-3 w-3" />
            ) : (
              <WifiOff className="h-3 w-3" />
            )}
          </div>

          {/* Menu Desktop */}
          <div className="hidden sm:flex items-center gap-1">
            <Button
              variant="ghost"
              size="sm"
              onClick={() => onViewChange('main')}
              className={activeView === 'main' ? 'bg-slate-200 dark:bg-slate-700' : ''}
            >
              Hoje
            </Button>
            <Button
              variant="ghost"
              size="sm"
              onClick={() => onViewChange('history')}
              className={activeView === 'history' ? 'bg-slate-200 dark:bg-slate-700' : ''}
            >
              Histórico
            </Button>
            <Button
              variant="ghost"
              size="sm"
              onClick={() => onViewChange('reports')}
              className={activeView === 'reports' ? 'bg-slate-200 dark:bg-slate-700' : ''}
            >
              Relatórios
            </Button>

            {/* Usuário e Logout */}
            <div className="flex items-center gap-2 ml-2 pl-2 border-l">
              <div className="flex items-center gap-1 text-sm text-muted-foreground">
                <User className="h-4 w-4" />
                <span>{currentUser?.username}</span>
              </div>
              <Button
                variant="ghost"
                size="sm"
                onClick={onLogout}
                className="text-red-600 hover:text-red-700 hover:bg-red-50"
              >
                <LogOut className="h-4 w-4" />
              </Button>
            </div>
          </div>
        </div>
      </div>
    </header>
  );
}
